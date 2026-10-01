package app.productividad.widget;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lógica del widget sin dependencias de Android (solo org.json), para poder probarla con Java normal.
 * Lee las tareas del mismo servidor que usa la app web: POST {servidor}/space/sync.
 */
final class TaskLogic {

    private TaskLogic() {}

    static final class Task {
        String id = "";
        String text = "";
        String priority = "medium";
        String due = "";
        boolean done = false;
        long updatedAt = 0;
    }

    /** Copia local de las tareas ya descargadas, para pedir al servidor solo lo nuevo. */
    static final class Cache {
        final Map<String, Task> tasks = new LinkedHashMap<>();
        long seq = 0;

        static Cache fromJson(String json, long seq) {
            Cache c = new Cache();
            c.seq = seq;
            try {
                JSONObject o = new JSONObject(json);
                Iterator<String> keys = o.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject t = o.getJSONObject(id);
                    c.tasks.put(id, toTask(id, t, t.optLong("updatedAt")));
                }
            } catch (JSONException e) {
                c.tasks.clear();
                c.seq = 0; // caché ilegible: empezar de cero
            }
            return c;
        }

        String toJson() {
            JSONObject o = new JSONObject();
            try {
                for (Task t : tasks.values()) {
                    JSONObject j = new JSONObject();
                    j.put("text", t.text);
                    j.put("priority", t.priority);
                    j.put("due", t.due);
                    j.put("done", t.done);
                    j.put("updatedAt", t.updatedAt);
                    o.put(t.id, j);
                }
            } catch (JSONException ignored) {
                // put() solo falla con números no finitos
            }
            return o.toString();
        }
    }

    /** Envía una petición POST con JSON y devuelve el cuerpo de la respuesta. */
    interface Transport {
        String post(String url, String json) throws IOException;
    }

    private static Task toTask(String id, JSONObject j, long updatedAt) {
        Task t = new Task();
        t.id = id;
        t.text = j.optString("text", "");
        t.priority = j.optString("priority", "medium");
        t.due = j.optString("due", "");
        t.done = j.optBoolean("done", false);
        t.updatedAt = updatedAt;
        return t;
    }

    /** Mayúsculas, sin separadores; O→0, I/L→1 (igual que la app). */
    static String normalizeCode(String s) {
        return String.valueOf(s == null ? "" : s).toUpperCase()
                .replaceAll("[^0-9A-Z]", "").replace('O', '0').replace('I', '1').replace('L', '1');
    }

    static boolean isValidCode(String normalized) {
        return normalized.matches("[0-9A-HJKMNP-TV-Z]{20}");
    }

    /** SHA-256 en hexadecimal de "sync-v1:" + código: es el "espacio" que identifica tus datos en el servidor. */
    static String spaceId(String code) throws NoSuchAlgorithmException {
        byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(("sync-v1:" + normalizeCode(code)).getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b & 0xff));
        return sb.toString();
    }

    /** Descarga lo nuevo desde el servidor y lo aplica a la caché (gana el cambio más reciente). */
    static void sync(String server, String code, Cache cache, Transport net) throws Exception {
        String space = spaceId(code);
        byte[] key = TaskCrypto.deriveKey(code);
        String url = server.replaceAll("/+$", "") + "/space/sync";
        long since = cache.seq;
        boolean more;
        do {
            JSONObject body = new JSONObject();
            body.put("space", space);
            body.put("since", since);
            body.put("records", new JSONArray());
            JSONObject res = new JSONObject(net.post(url, body.toString()));
            JSONArray records = res.getJSONArray("records");
            for (int i = 0; i < records.length(); i++) {
                JSONObject r = records.getJSONObject(i);
                if (!"tasks".equals(r.optString("col"))) continue;
                String id = r.getString("id");
                long updatedAt = r.getLong("updatedAt");
                Task prev = cache.tasks.get(id);
                if (prev != null && prev.updatedAt > updatedAt) continue;
                if (r.optInt("deleted") == 1) {
                    cache.tasks.remove(id);
                } else {
                    String plain = TaskCrypto.decrypt(key, r.getString("data"), id + "|tasks");
                    if (plain == null) continue; // cifrado con otro código o alterado: se ignora
                    cache.tasks.put(id, toTask(id, new JSONObject(plain), updatedAt));
                }
            }
            since = res.getLong("seq");
            more = res.optBoolean("more", false);
        } while (more);
        cache.seq = since;
    }

    private static int rank(String priority) {
        return "high".equals(priority) ? 0 : "low".equals(priority) ? 2 : 1;
    }

    /** Pendientes (sin completar), por fecha límite (las sin fecha al final) y luego por prioridad. */
    static List<Task> visible(Cache cache) {
        List<Task> out = new ArrayList<>();
        for (Task t : cache.tasks.values()) {
            if (!t.done && !t.text.trim().isEmpty()) out.add(t);
        }
        Collections.sort(out, new Comparator<Task>() {
            @Override public int compare(Task a, Task b) {
                String da = a.due.isEmpty() ? "9999-99-99" : a.due;
                String db = b.due.isEmpty() ? "9999-99-99" : b.due;
                int c = da.compareTo(db);
                if (c != 0) return c;
                c = Integer.compare(rank(a.priority), rank(b.priority));
                return c != 0 ? c : a.text.compareToIgnoreCase(b.text);
            }
        });
        return out;
    }

    private static final String[] MONTHS = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"};

    /** "Hoy", "Mañana", "Vencida · 28 sep" o "9 oct". Cadena vacía si no hay fecha. */
    static String dueLabel(String due, LocalDate today) {
        if (due == null || due.isEmpty()) return "";
        LocalDate d;
        try { d = LocalDate.parse(due); } catch (Exception e) { return ""; }
        long diff = ChronoUnit.DAYS.between(today, d);
        String date = d.getDayOfMonth() + " " + MONTHS[d.getMonthValue() - 1];
        if (diff < 0) return "Vencida · " + date;
        if (diff == 0) return "Hoy";
        if (diff == 1) return "Mañana";
        return date;
    }

    static boolean isOverdue(String due, LocalDate today) {
        try { return !due.isEmpty() && LocalDate.parse(due).isBefore(today); } catch (Exception e) { return false; }
    }
}
