package app.productividad.widget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Ajustes y utilidades de las llamadas: Firebase, canales de notificación, permisos y activación. */
final class Calls {

    private Calls() {}

    static final String CH_RING = "llamadas_v1";
    static final String CH_ONGOING = "llamada_en_curso";
    static final String CH_MSG = "mensajes_claude";
    static final ExecutorService IO = Executors.newCachedThreadPool();

    static SharedPreferences prefs(Context c) { return TaskRepo.prefs(c); }

    static boolean isEnabled(Context c) { return prefs(c).getBoolean("calls.enabled", false); }

    static String deviceId(Context c) {
        SharedPreferences p = prefs(c);
        String id = p.getString("calls.device", "");
        if (id.isEmpty()) {
            id = "a" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
            p.edit().putString("calls.device", id).apply();
        }
        return id;
    }

    static CallApi api(Context c) throws Exception {
        if (!TaskRepo.isConfigured(c)) throw new IllegalStateException("Primero conecta el widget con tu código.");
        return new CallApi(TaskRepo.server(c), prefs(c).getString("code", ""));
    }

    /** Inicia Firebase con la configuración que dio el servidor (no hace falta google-services.json en el APK). */
    static synchronized boolean initFirebase(Context c) {
        if (!FirebaseApp.getApps(c).isEmpty()) return true;
        String saved = prefs(c).getString("calls.firebase", "");
        if (saved.isEmpty()) return false;
        try {
            JSONObject j = new JSONObject(saved);
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApiKey(j.getString("apiKey"))
                    .setApplicationId(j.getString("appId"))
                    .setProjectId(j.getString("projectId"))
                    .setGcmSenderId(j.getString("senderId"))
                    .build();
            FirebaseApp.initializeApp(c.getApplicationContext(), options);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    interface Done { void done(String error); } // null = todo bien

    /** «Activar llamadas»: pide la configuración al servidor, inicia Firebase y registra este celular. Corre fuera del hilo principal. */
    static void activate(Context c, Done done) {
        Context app = c.getApplicationContext();
        IO.execute(() -> {
            try {
                CallApi api = api(app);
                JSONObject cfg = api.config();
                prefs(app).edit().putString("calls.firebase", cfg.toString()).apply();
                if (!initFirebase(app)) { done.done("No se pudo iniciar Firebase con la configuración del servidor."); return; }
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (!task.isSuccessful() || task.getResult() == null) {
                        done.done("Firebase no dio un token. ¿Tiene el celular los servicios de Google Play?");
                        return;
                    }
                    String token = task.getResult();
                    IO.execute(() -> {
                        try {
                            api.registerDevice(deviceId(app), token);
                            prefs(app).edit().putBoolean("calls.enabled", true).putString("calls.token", token).apply();
                            done.done(null);
                        } catch (Exception e) {
                            done.done(errorText(e));
                        }
                    });
                });
            } catch (Exception e) {
                done.done(errorText(e));
            }
        });
    }

    static void deactivate(Context c, Done done) {
        Context app = c.getApplicationContext();
        IO.execute(() -> {
            try {
                api(app).removeDevice(deviceId(app));
                prefs(app).edit().putBoolean("calls.enabled", false).apply();
                done.done(null);
            } catch (Exception e) {
                done.done(errorText(e));
            }
        });
    }

    /** Firebase cambió el token: se vuelve a registrar. */
    static void onNewToken(Context c, String token) {
        if (!isEnabled(c)) return;
        Context app = c.getApplicationContext();
        IO.execute(() -> {
            try {
                api(app).registerDevice(deviceId(app), token);
                prefs(app).edit().putString("calls.token", token).apply();
            } catch (Exception ignored) { }
        });
    }

    static String errorText(Exception e) {
        if (e instanceof CallApi.ApiError) {
            switch (((CallApi.ApiError) e).code) {
                case "llamadas_no_configuradas": return "El servidor todavía no tiene Firebase configurado (lo hace quien publica la app).";
                case "voz_no_configurada": return "El servidor todavía no tiene la clave de Gemini (lo hace quien publica la app).";
                case "voz_no_disponible": return "Gemini no respondió. Prueba en un momento.";
                case "limite_diario": return "Se llegó al límite de llamadas de hoy.";
                case "demasiadas peticiones": return "Demasiados intentos seguidos; espera un minuto.";
                default: return "El servidor respondió " + ((CallApi.ApiError) e).status + ".";
            }
        }
        if (e instanceof java.io.IOException) return "Sin conexión con el servidor.";
        return e.getMessage() == null ? "Algo falló." : e.getMessage();
    }

    /* ---------- permisos ---------- */
    static boolean has(Context c, String perm) {
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    static String[] missingRuntimePermissions(Context c) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (!has(c, Manifest.permission.RECORD_AUDIO)) out.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33 && !has(c, Manifest.permission.POST_NOTIFICATIONS)) out.add(Manifest.permission.POST_NOTIFICATIONS);
        return out.toArray(new String[0]);
    }

    /** Android 14+: el permiso para mostrar la llamada a pantalla completa con el celular bloqueado. */
    static boolean needsFullScreenPermission(Context c) {
        if (Build.VERSION.SDK_INT < 34) return false;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && !nm.canUseFullScreenIntent();
    }

    static Intent fullScreenSettings(Context c) {
        return new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + c.getPackageName()));
    }

    /* ---------- notificaciones ---------- */
    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ring = new NotificationChannel(CH_RING, "Llamadas de Claude", NotificationManager.IMPORTANCE_HIGH);
        ring.setDescription("Suena como una llamada cuando Claude te llama.");
        ring.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ring.enableVibration(true);
        ring.setVibrationPattern(new long[] { 0, 800, 600, 800, 600 });
        ring.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationChannel ongoing = new NotificationChannel(CH_ONGOING, "Llamada en curso", NotificationManager.IMPORTANCE_LOW);
        NotificationChannel msg = new NotificationChannel(CH_MSG, "Mensajes de Claude", NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(ring);
        nm.createNotificationChannel(ongoing);
        nm.createNotificationChannel(msg);
    }

    static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    /** Aviso de «Claude te escribió»; al tocarlo se abre la app en los mensajes. */
    static void notifyMessage(Context c, String id, String text) {
        ensureChannels(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        Intent open = new Intent(c, OpenTaskActivity.class).putExtra(OpenTaskActivity.EXTRA_HASH, "mensajes");
        Notification n = new Notification.Builder(c, CH_MSG)
                .setSmallIcon(R.drawable.ic_call_small)
                .setContentTitle("Claude te escribió")
                .setContentText(text.isEmpty() ? "Toca para leerlo en la app." : text)
                .setStyle(new Notification.BigTextStyle().bigText(text.isEmpty() ? "Toca para leerlo en la app." : text))
                .setContentIntent(PendingIntent.getActivity(c, 7, open, FLAGS))
                .setAutoCancel(true)
                .build();
        nm.notify(id.hashCode(), n);
    }
}
