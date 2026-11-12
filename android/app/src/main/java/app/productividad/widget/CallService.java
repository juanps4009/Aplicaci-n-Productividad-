package app.productividad.widget;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Una llamada con Claude, de principio a fin. Servicio en primer plano de tipo «llamada» para que siga aunque
 * la pantalla se apague:
 *  - RING (aviso de Firebase): suena con notificación de llamada a pantalla completa; 40 s sin contestar → perdida.
 *  - ANSWER / OUTGOING: abre la conversación de voz con Gemini Live; al colgar sube la transcripción cifrada.
 * Flujo tomado de agentring (github.com/mutonby/agentring, Apache-2.0), sin LiveKit ni servidor de audio.
 */
public class CallService extends Service {

    static final String ACTION_RING = "app.productividad.widget.RING";
    static final String ACTION_ANSWER = "app.productividad.widget.ANSWER";
    static final String ACTION_OUTGOING = "app.productividad.widget.OUTGOING";
    static final String ACTION_DECLINE = "app.productividad.widget.DECLINE";
    static final String ACTION_HANGUP = "app.productividad.widget.HANGUP";
    static final String ACTION_MUTE = "app.productividad.widget.MUTE";
    static final String ACTION_SPEAKER = "app.productividad.widget.SPEAKER";
    static final String EXTRA_ID = "id";
    static final String EXTRA_URGENT = "urgent";
    private static final int NOTIF_ID = 4101;

    enum Phase { RINGING, CONNECTING, TALKING, ENDED }

    /** La pantalla de llamada escucha los cambios. */
    interface Ui { void onCallChanged(); }

    static volatile CallService current;
    static volatile Ui ui;

    String callId = "";
    boolean fromClaude = true, urgent, speaker, muted;
    volatile Phase phase = Phase.RINGING;
    String reason = "", status = "", error = null;
    final CallLogic.Transcript transcript = new CallLogic.Transcript();
    long talkStartedAt;

    private final Handler main = new Handler(Looper.getMainLooper());
    private CallApi api;
    private GeminiLive live;
    private PowerManager.WakeLock wakeLock;
    private final Runnable ringTimeout = () -> endCall(null, "No contestaste a tiempo.");
    private final Runnable maxTimeout = () -> hangup();

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) { stopSelf(); return START_NOT_STICKY; }
        Calls.ensureChannels(this);
        switch (action) {
            case ACTION_RING: ring(intent.getStringExtra(EXTRA_ID), intent.getBooleanExtra(EXTRA_URGENT, false)); break;
            case ACTION_ANSWER: answer(); break;
            case ACTION_OUTGOING: outgoing(); break;
            case ACTION_DECLINE: decline(); break;
            case ACTION_HANGUP: hangup(); break;
            case ACTION_MUTE: setMuted(!muted); break;
            case ACTION_SPEAKER: setSpeaker(!speaker); break;
            default: break;
        }
        return START_NOT_STICKY;
    }

    /* ---------- sonar ---------- */
    private void ring(String id, boolean isUrgent) {
        if (id == null || id.isEmpty()) { stopIfIdle(); return; }
        if (current != null && current != this) { return; }
        if (current == this && phase != Phase.ENDED) { // ya hay una llamada: la nueva queda como perdida
            return;
        }
        current = this;
        callId = id;
        fromClaude = true;
        urgent = isUrgent;
        phase = Phase.RINGING;
        reason = "";
        status = "Claude te está llamando…";
        startInForeground(ringingNotification(), false);
        main.postDelayed(ringTimeout, CallLogic.RING_MS);
        notifyUi();
        Calls.IO.execute(() -> {
            try {
                api = Calls.api(this);
                JSONObject c = api.getCall(id);
                if (!"invited".equals(c.optString("state")) && !"ringing".equals(c.optString("state"))) {
                    main.post(() -> endCall(null, "La llamada ya terminó.")); // el aviso llegó tarde
                    return;
                }
                CallLogic.Invite inv = CallLogic.Invite.parse(api.open(c.optString("invite"), CallLogic.aadInvite(id)));
                api.setState(id, "ringing", null);
                main.post(() -> {
                    reason = inv.reason;
                    pendingInvite = inv;
                    if (phase == Phase.RINGING) updateNotification(ringingNotification());
                    notifyUi();
                });
            } catch (Exception e) {
                main.post(() -> { error = Calls.errorText(e); notifyUi(); });
            }
        });
    }

    private CallLogic.Invite pendingInvite = new CallLogic.Invite();

    /* ---------- contestar o llamar ---------- */
    private void answer() {
        if (current != this || phase != Phase.RINGING) return;
        main.removeCallbacks(ringTimeout);
        connect(true);
    }

    private void outgoing() {
        if (current != null && current != this) return;
        if (current == this && phase != Phase.ENDED) return;
        current = this;
        fromClaude = false;
        callId = "";
        reason = "Llamada a Claude";
        pendingInvite = new CallLogic.Invite();
        connect(false);
    }

    private void connect(boolean answering) {
        phase = Phase.CONNECTING;
        status = "Conectando…";
        error = null;
        startInForeground(ongoingNotification(), true);
        acquireWakeLock();
        routeAudio(true);
        notifyUi();
        Calls.IO.execute(() -> {
            try {
                if (api == null) api = Calls.api(this);
                if (!answering) callId = api.newIncoming();
                else {
                    if (pendingInvite.reason.isEmpty()) pendingInvite = api.invite(callId); // contestó antes de que llegara el motivo
                    api.setState(callId, "active", null);
                }
                JSONObject t = api.voiceToken(callId);
                String today = DateFormat.getDateInstance(DateFormat.FULL, new Locale("es")).format(new Date());
                String setup = CallLogic.setupMessage(t.getString("model"), t.getString("voice"),
                        CallLogic.instructions(fromClaude, pendingInvite, today), CallLogic.tools(fromClaude));
                live = new GeminiLive(setup, CallLogic.firstTurn(fromClaude), voiceListener);
                live.setMuted(muted);
                live.start(t.getString("url"), t.getString("token"));
            } catch (Exception e) {
                main.post(() -> endCall(Calls.errorText(e), null));
            }
        });
    }

    private final GeminiLive.Listener voiceListener = new GeminiLive.Listener() {
        @Override public void onReady() {
            main.post(() -> {
                phase = Phase.TALKING;
                talkStartedAt = System.currentTimeMillis();
                status = "En llamada";
                main.postDelayed(maxTimeout, CallLogic.MAX_MS);
                updateNotification(ongoingNotification());
                notifyUi();
            });
        }

        @Override public void onTranscript(String who, String text) {
            transcript.add(who, text);
            main.post(CallService.this::notifyUi);
        }

        @Override public void onToolCall(String id, String name, JSONObject args) {
            Calls.IO.execute(() -> {
                String result;
                try {
                    if ("colgar".equals(name)) {
                        result = "Listo, la llamada termina.";
                        main.postDelayed(CallService.this::hangup, 2500); // deja terminar la despedida
                    } else if ("dejar_encargo".equals(name)) {
                        String text = args.optString("texto", "").trim();
                        if (text.isEmpty()) result = "Falta el texto del encargo.";
                        else { api.sendFromMe("encargo", text); result = "Encargo guardado para Claude."; }
                    } else if ("ver_pendientes".equals(name)) {
                        result = CallLogic.tasksForVoice(TaskRepo.load(CallService.this), TaskRepo.today());
                    } else {
                        result = "Herramienta desconocida.";
                    }
                } catch (Exception e) {
                    result = "No se pudo: " + Calls.errorText(e);
                }
                try { GeminiLive l = live; if (l != null) l.send(CallLogic.toolResponse(id, name, result)); } catch (Exception ignored) { }
            });
        }

        @Override public void onClosed(String reason) {
            main.post(() -> endCall(reason, null));
        }
    };

    /* ---------- terminar ---------- */
    private void decline() {
        if (current != this || phase != Phase.RINGING) { stopIfIdle(); return; }
        main.removeCallbacks(ringTimeout);
        String id = callId;
        Calls.IO.execute(() -> { try { (api != null ? api : Calls.api(this)).setState(id, "declined", null); } catch (Exception ignored) { } });
        endCall(null, "Rechazaste la llamada.");
    }

    void hangup() {
        if (current != this || phase == Phase.ENDED) return;
        if (phase == Phase.RINGING) { decline(); return; }
        endCall(null, null);
    }

    /** Cierra todo una sola vez: voz, notificación y, si hubo conversación, sube la transcripción cifrada. */
    private void endCall(String err, String message) {
        if (phase == Phase.ENDED) return;
        boolean talked = phase == Phase.TALKING || phase == Phase.CONNECTING;
        phase = Phase.ENDED;
        main.removeCallbacks(ringTimeout);
        main.removeCallbacks(maxTimeout);
        GeminiLive l = live;
        live = null;
        if (l != null) Calls.IO.execute(l::stop);
        routeAudio(false);
        releaseWakeLock();
        error = err;
        status = message != null ? message : err != null ? "La llamada terminó: " + err : "Llamada terminada";
        notifyUi();
        final String id = callId;
        final long seconds = talkStartedAt == 0 ? 0 : (System.currentTimeMillis() - talkStartedAt) / 1000;
        final CallApi a = api;
        if (talked && a != null && !id.isEmpty()) {
            Calls.IO.execute(() -> {
                try { a.setState(id, "ended", a.seal(transcript.resultJson(seconds), CallLogic.aadResult(id))); } catch (Exception ignored) { }
            });
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        main.postDelayed(() -> { if (current == this) current = null; stopSelf(); }, 400);
    }

    private void stopIfIdle() { if (current == null) stopSelf(); }

    /* ---------- silencio y altavoz ---------- */
    private void setMuted(boolean m) {
        muted = m;
        GeminiLive l = live;
        if (l != null) l.setMuted(m);
        notifyUi();
    }

    private void setSpeaker(boolean on) {
        speaker = on;
        applySpeaker();
        notifyUi();
    }

    private void routeAudio(boolean inCall) {
        AudioManager am = getSystemService(AudioManager.class);
        if (am == null) return;
        if (inCall) {
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            applySpeaker();
        } else {
            if (Build.VERSION.SDK_INT >= 31) am.clearCommunicationDevice(); else am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        }
    }

    private void applySpeaker() {
        AudioManager am = getSystemService(AudioManager.class);
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= 31) {
            int wanted = speaker ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
            for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                if (d.getType() == wanted) { am.setCommunicationDevice(d); return; }
            }
        } else {
            am.setSpeakerphoneOn(speaker);
        }
    }

    private void acquireWakeLock() {
        PowerManager pm = getSystemService(PowerManager.class);
        if (pm == null || wakeLock != null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pendientes:llamada");
        wakeLock.acquire(CallLogic.MAX_MS + 60000);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    /* ---------- notificaciones ---------- */
    private void startInForeground(Notification n, boolean withMic) {
        if (Build.VERSION.SDK_INT >= 30) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL | (withMic ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0);
            startForeground(NOTIF_ID, n, type);
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void updateNotification(Notification n) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null && phase != Phase.ENDED) nm.notify(NOTIF_ID, n);
    }

    private PendingIntent screen(String action, int code) {
        Intent i = new Intent(this, CallActivity.class).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(this, code, i, Calls.FLAGS);
    }

    private PendingIntent service(String action, int code) {
        return PendingIntent.getService(this, code, new Intent(this, CallService.class).setAction(action), Calls.FLAGS);
    }

    private Notification ringingNotification() {
        String text = reason.isEmpty() ? "Toca para contestar." : reason;
        Notification.Builder b = new Notification.Builder(this, Calls.CH_RING)
                .setSmallIcon(R.drawable.ic_call_small)
                .setContentTitle(urgent ? "Claude te llama (urgente)" : "Claude te llama")
                .setContentText(text)
                .setCategory(Notification.CATEGORY_CALL)
                .setOngoing(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(screen(CallActivity.ACTION_SHOW, 1))
                .setFullScreenIntent(screen(CallActivity.ACTION_SHOW, 2), true);
        PendingIntent decline = service(ACTION_DECLINE, 3), answer = screen(ACTION_ANSWER, 4);
        if (Build.VERSION.SDK_INT >= 31) {
            Person claude = new Person.Builder().setName("Claude").setImportant(true).build();
            b.setStyle(Notification.CallStyle.forIncomingCall(claude, decline, answer));
        } else {
            b.addAction(new Notification.Action.Builder(null, "Rechazar", decline).build());
            b.addAction(new Notification.Action.Builder(null, "Contestar", answer).build());
        }
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT; // el timbre se repite hasta contestar
        return n;
    }

    private Notification ongoingNotification() {
        Notification.Builder b = new Notification.Builder(this, Calls.CH_ONGOING)
                .setSmallIcon(R.drawable.ic_call_small)
                .setContentTitle(fromClaude ? "Llamada con Claude" : "Llamando a Claude")
                .setContentText(status)
                .setCategory(Notification.CATEGORY_CALL)
                .setOngoing(true)
                .setUsesChronometer(phase == Phase.TALKING)
                .setContentIntent(screen(CallActivity.ACTION_SHOW, 5));
        PendingIntent hang = service(ACTION_HANGUP, 6);
        if (Build.VERSION.SDK_INT >= 31) {
            Person claude = new Person.Builder().setName("Claude").setImportant(true).build();
            b.setStyle(Notification.CallStyle.forOngoingCall(claude, hang));
        } else {
            b.addAction(new Notification.Action.Builder(null, "Colgar", hang).build());
        }
        return b.build();
    }

    private void notifyUi() {
        Ui u = ui;
        if (u != null) main.post(u::onCallChanged);
    }

    @Override
    public void onDestroy() {
        main.removeCallbacksAndMessages(null);
        GeminiLive l = live;
        live = null;
        if (l != null) l.stop();
        releaseWakeLock();
        if (current == this) current = null;
        super.onDestroy();
    }

    /** Arranca el servicio con una acción (desde la pantalla de llamada o el aviso de Firebase). */
    static void send(Context c, String action, Intent extras) {
        Intent i = new Intent(c, CallService.class).setAction(action);
        if (extras != null) i.putExtras(extras);
        if (ACTION_RING.equals(action) || ACTION_OUTGOING.equals(action)) c.startForegroundService(i);
        else c.startService(i);
    }
}
