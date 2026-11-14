package app.productividad.widget;

import android.annotation.SuppressLint;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;

import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
 * Conversación de voz con Gemini Live, directa desde el celular (sin servidor de audio en medio):
 * micrófono a 16 kHz → WebSocket → voz a 24 kHz por el auricular o el altavoz, con transcripción de los dos lados.
 * El token es temporal y de un solo uso (lo da el servidor de la app; la clave de Gemini nunca llega al celular).
 */
final class GeminiLive {

    interface Listener {
        void onReady();
        void onTranscript(String who, String text);
        void onToolCall(String id, String name, org.json.JSONObject args);
        void onClosed(String reason); // null = normal
    }

    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .build();

    private final Listener listener;
    private final String setupJson, firstTurnJson;
    private WebSocket ws;
    private volatile boolean running, ready, muted;
    private AudioRecord recorder;
    private AudioTrack player;
    private Thread micThread, playThread;
    private final LinkedBlockingQueue<byte[]> playQueue = new LinkedBlockingQueue<>();
    private static final byte[] FLUSH = new byte[0];

    GeminiLive(String setupJson, String firstTurnJson, Listener listener) {
        this.setupJson = setupJson;
        this.firstTurnJson = firstTurnJson;
        this.listener = listener;
    }

    void start(String url, String token) {
        running = true;
        Request req = new Request.Builder().url(url + "?access_token=" + token).build();
        ws = HTTP.newWebSocket(req, new WebSocketListener() {
            @Override public void onOpen(WebSocket socket, Response response) {
                socket.send(setupJson);
            }

            @Override public void onMessage(WebSocket socket, String text) { handle(text); }

            @Override public void onMessage(WebSocket socket, okio.ByteString bytes) { handle(bytes.utf8()); }

            @Override public void onClosing(WebSocket socket, int code, String reason) {
                socket.close(1000, null);
                finish(code == 1000 ? null : "La voz se cortó (" + code + (reason == null || reason.isEmpty() ? "" : ": " + reason) + ")");
            }

            @Override public void onFailure(WebSocket socket, Throwable t, Response response) {
                finish("No se pudo conectar con la voz" + (response != null ? " (" + response.code() + ")" : "") + ".");
            }
        });
    }

    private void handle(String raw) {
        List<CallLogic.Event> events = CallLogic.parse(raw);
        for (CallLogic.Event e : events) {
            switch (e.kind) {
                case SETUP_COMPLETE:
                    if (ready) break;
                    ready = true;
                    startAudio();
                    ws.send(firstTurnJson);
                    listener.onReady();
                    break;
                case AUDIO: playQueue.offer(e.audio); break;
                case INTERRUPTED: playQueue.clear(); playQueue.offer(FLUSH); break;
                case TRANSCRIPT: listener.onTranscript(e.who, e.text); break;
                case TOOL_CALL: listener.onToolCall(e.id, e.name, e.args); break;
                case GO_AWAY: break; // la sesión se acaba pronto; la llamada termina sola con MAX_MS
                case ERROR: finish("La voz respondió con un error."); break;
                default: break;
            }
        }
    }

    void send(String json) {
        WebSocket s = ws;
        if (s != null && running) s.send(json);
    }

    void setMuted(boolean m) { muted = m; }

    boolean isMuted() { return muted; }

    @SuppressLint("MissingPermission") // el permiso de micrófono se pide antes de contestar o llamar
    private void startAudio() {
        int inMin = AudioRecord.getMinBufferSize(CallLogic.IN_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, CallLogic.IN_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(inMin, 3200) * 2);
        if (AcousticEchoCanceler.isAvailable()) {
            AcousticEchoCanceler aec = AcousticEchoCanceler.create(recorder.getAudioSessionId());
            if (aec != null) aec.setEnabled(true);
        }
        if (NoiseSuppressor.isAvailable()) {
            NoiseSuppressor ns = NoiseSuppressor.create(recorder.getAudioSessionId());
            if (ns != null) ns.setEnabled(true);
        }
        int outMin = AudioTrack.getMinBufferSize(CallLogic.OUT_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        player = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(CallLogic.OUT_RATE)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(Math.max(outMin, 9600) * 2)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();

        recorder.startRecording();
        player.play();

        micThread = new Thread(() -> {
            byte[] buf = new byte[1280]; // 40 ms a 16 kHz
            byte[] silence = new byte[1280];
            while (running) {
                int n = recorder.read(buf, 0, buf.length);
                if (n <= 0) continue;
                send(CallLogic.audioMessage(muted ? silence : buf, n));
            }
        }, "voz-micro");
        playThread = new Thread(() -> {
            while (running) {
                try {
                    byte[] chunk = playQueue.poll(200, TimeUnit.MILLISECONDS);
                    if (chunk == null) continue;
                    if (chunk == FLUSH) { player.pause(); player.flush(); player.play(); continue; }
                    player.write(chunk, 0, chunk.length);
                } catch (InterruptedException e) {
                    return;
                }
            }
        }, "voz-altavoz");
        micThread.start();
        playThread.start();
    }

    private synchronized void finish(String reason) {
        if (!running) return;
        stop();
        listener.onClosed(reason);
    }

    /** Cierra todo (también se usa al colgar). */
    synchronized void stop() {
        running = false;
        WebSocket s = ws;
        ws = null;
        if (s != null) s.close(1000, "colgó");
        if (micThread != null) micThread.interrupt();
        if (playThread != null) playThread.interrupt();
        try { // que los hilos suelten el micrófono y el altavoz antes de liberarlos
            if (micThread != null && micThread != Thread.currentThread()) micThread.join(300);
            if (playThread != null && playThread != Thread.currentThread()) playThread.join(300);
        } catch (InterruptedException ignored) { }
        try { if (recorder != null) { recorder.stop(); recorder.release(); } } catch (Exception ignored) { }
        try { if (player != null) { player.stop(); player.release(); } } catch (Exception ignored) { }
        recorder = null;
        player = null;
        playQueue.clear();
    }
}
