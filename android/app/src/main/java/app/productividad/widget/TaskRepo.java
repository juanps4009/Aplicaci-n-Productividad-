package app.productividad.widget;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Guarda los ajustes del widget y carga las tareas (con caché para funcionar sin conexión). */
final class TaskRepo {

    static final String DEFAULT_APP_URL = "https://juanps4009.github.io/Aplicaci-n-Productividad-/";

    private TaskRepo() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("widget", Context.MODE_PRIVATE);
    }

    static boolean isConfigured(Context c) {
        SharedPreferences p = prefs(c);
        return !p.getString("server", "").isEmpty() && !p.getString("code", "").isEmpty();
    }

    static String appUrl(Context c) {
        String url = prefs(c).getString("appUrl", DEFAULT_APP_URL);
        return url.isEmpty() ? DEFAULT_APP_URL : url;
    }

    /** Guarda los ajustes; si cambia el servidor o el código, borra lo descargado. */
    static void save(Context c, String server, String code, String appUrl) {
        SharedPreferences p = prefs(c);
        boolean changed = !server.equals(p.getString("server", "")) || !code.equals(p.getString("code", ""));
        SharedPreferences.Editor e = p.edit()
                .putString("server", server)
                .putString("code", code)
                .putString("appUrl", appUrl);
        if (changed) e.remove("cache").remove("seq");
        e.apply();
    }

    /** Descarga lo nuevo (si hay conexión) y devuelve las tareas pendientes ordenadas. */
    static List<TaskLogic.Task> load(Context c) {
        if (!isConfigured(c)) return new ArrayList<>();
        SharedPreferences p = prefs(c);
        TaskLogic.Cache cache = TaskLogic.Cache.fromJson(p.getString("cache", "{}"), p.getLong("seq", 0));
        try {
            TaskLogic.sync(p.getString("server", ""), p.getString("code", ""), cache, new HttpTransport());
            p.edit().putString("cache", cache.toJson()).putLong("seq", cache.seq).apply();
        } catch (Exception e) {
            // sin conexión o servidor caído: se muestra lo último que se descargó
        }
        return TaskLogic.visible(cache);
    }

    static LocalDate today() {
        return LocalDate.now();
    }

    private static final class HttpTransport implements TaskLogic.Transport {
        @Override
        public String post(String url, String json) throws IOException {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            try {
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(json.getBytes(StandardCharsets.UTF_8));
                }
                int status = conn.getResponseCode();
                if (status != 200) throw new IOException("HTTP " + status);
                try (InputStream in = conn.getInputStream(); ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                    return new String(buf.toByteArray(), StandardCharsets.UTF_8);
                }
            } finally {
                conn.disconnect();
            }
        }
    }
}
