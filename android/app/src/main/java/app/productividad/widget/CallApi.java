package app.productividad.widget;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Rutas de llamadas y mensajes del servidor (ver worker/index.js). Sin dependencias de Android. */
final class CallApi {

    /** Error del servidor con su código (por ejemplo "sin_celular" o "voz_no_configurada"). */
    static final class ApiError extends IOException {
        final int status;
        final String code;
        ApiError(int status, String code) {
            super("HTTP " + status + (code.isEmpty() ? "" : " " + code));
            this.status = status;
            this.code = code;
        }
    }

    final String server;
    final String space;
    final byte[] key;

    CallApi(String server, String code) throws Exception {
        this.server = server;
        this.space = TaskLogic.spaceId(code);
        this.key = TaskCrypto.deriveKey(code);
    }

    JSONObject post(String path, JSONObject body) throws Exception {
        body.put("space", space);
        HttpURLConnection conn = (HttpURLConnection) new URL(server + path).openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = conn.getResponseCode();
            InputStream in = status < 400 ? conn.getInputStream() : conn.getErrorStream();
            String text = "";
            if (in != null) {
                try (InputStream s = in; ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = s.read(chunk)) > 0) buf.write(chunk, 0, n);
                    text = new String(buf.toByteArray(), StandardCharsets.UTF_8);
                }
            }
            JSONObject res;
            try { res = new JSONObject(text.isEmpty() ? "{}" : text); } catch (Exception e) { res = new JSONObject(); }
            if (status != 200) throw new ApiError(status, res.optString("error", ""));
            return res;
        } finally {
            conn.disconnect();
        }
    }

    String seal(String json, String aad) throws Exception {
        return TaskCrypto.encrypt(key, json, aad);
    }

    String open(String data, String aad) {
        return TaskCrypto.decrypt(key, data, aad);
    }

    /* ---------- atajos ---------- */
    JSONObject config() throws Exception { return post("/call/config", new JSONObject()); }

    void registerDevice(String device, String fcm) throws Exception {
        post("/call/device", new JSONObject().put("device", device).put("fcm", fcm));
    }

    void removeDevice(String device) throws Exception {
        post("/call/device", new JSONObject().put("device", device).put("remove", true));
    }

    JSONObject getCall(String id) throws Exception { return post("/call/get", new JSONObject().put("id", id)); }

    JSONObject setState(String id, String state, String result) throws Exception {
        JSONObject b = new JSONObject().put("id", id).put("state", state);
        if (result != null) b.put("result", result);
        return post("/call/update", b);
    }

    CallLogic.Invite invite(String id) throws Exception {
        JSONObject c = getCall(id);
        return CallLogic.Invite.parse(open(c.optString("invite", ""), CallLogic.aadInvite(id)));
    }

    /** Llamada que hace el dueño desde el celular. Devuelve el id. */
    String newIncoming() throws Exception {
        String id = CallLogic.newId("i");
        String invite = seal(CallLogic.inviteJson("Llamada del dueño", "Dueño", System.currentTimeMillis()), CallLogic.aadInvite(id));
        post("/call/new", new JSONObject().put("id", id).put("dir", "in").put("invite", invite));
        return id;
    }

    JSONObject voiceToken(String callId) throws Exception {
        return post("/voice/token", new JSONObject().put("id", callId));
    }

    /** Mensaje del dueño para Claude (kind "msg" o "encargo"). */
    void sendFromMe(String kind, String text) throws Exception {
        String id = CallLogic.newId("y");
        post("/msg/send", new JSONObject().put("id", id).put("sender", "yo").put("kind", kind)
                .put("data", seal(CallLogic.messageJson(text), CallLogic.aadMsg(id))));
    }

    /** Texto de un mensaje de Claude (para la notificación), o "" si no se encuentra. */
    String messageText(String id) throws Exception {
        long after = 0;
        for (int page = 0; page < 20; page++) {
            JSONObject res = post("/msg/list", new JSONObject().put("after", after));
            org.json.JSONArray list = res.optJSONArray("messages");
            for (int i = 0; list != null && i < list.length(); i++) {
                JSONObject m = list.getJSONObject(i);
                if (!id.equals(m.optString("id"))) continue;
                String plain = open(m.optString("data"), CallLogic.aadMsg(id));
                return plain == null ? "" : new JSONObject(plain).optString("text", "");
            }
            if (!res.optBoolean("more")) break;
            after = res.optLong("seq");
        }
        return "";
    }
}
