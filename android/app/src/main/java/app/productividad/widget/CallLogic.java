package app.productividad.widget;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Lógica de las llamadas sin dependencias de Android (solo org.json), para poder probarla con Java normal:
 * formatos cifrados (iguales a herramientas/llamar.mjs), instrucciones para la IA de voz, mensajes de Gemini Live
 * y la transcripción. Idea tomada de agentring (github.com/mutonby/agentring, Apache-2.0).
 */
final class CallLogic {

    private CallLogic() {}

    static final int IN_RATE = 16000;   // micrófono → Gemini
    static final int OUT_RATE = 24000;  // Gemini → altavoz
    static final long RING_MS = 40000;  // igual que el servidor
    static final long MAX_MS = 14 * 60000; // Gemini corta las sesiones de solo audio a los 15 min

    /* ---------- datos autenticados de cada cosa cifrada (los mismos que la herramienta y la app web) ---------- */
    static String aadInvite(String callId) { return "inv|" + callId; }
    static String aadResult(String callId) { return "res|" + callId; }
    static String aadMsg(String id) { return "msg|" + id; }

    static String newId(String prefix) {
        byte[] b = new byte[12];
        new java.security.SecureRandom().nextBytes(b);
        return prefix + Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** Lo que Claude manda al llamar: {v, reason, context, from, at}. */
    static final class Invite {
        String reason = "";
        String context = "";
        String from = "Claude";

        static Invite parse(String plain) {
            Invite inv = new Invite();
            if (plain == null) return inv;
            try {
                JSONObject j = new JSONObject(plain);
                inv.reason = j.optString("reason", "");
                inv.context = j.optString("context", "");
                inv.from = j.optString("from", "Claude");
            } catch (JSONException ignored) { }
            return inv;
        }
    }

    static String inviteJson(String reason, String from, long at) throws JSONException {
        return new JSONObject().put("v", 1).put("reason", reason).put("context", "").put("from", from).put("at", at).toString();
    }

    static String messageJson(String text) throws JSONException {
        return new JSONObject().put("v", 1).put("text", text).toString();
    }

    /* ---------- instrucciones para la IA de voz ---------- */
    static String instructions(boolean outgoingFromClaude, Invite inv, String today) {
        StringBuilder s = new StringBuilder();
        s.append("Eres la voz de Claude, el asistente de IA del dueño de la app Pendientes, en una llamada de teléfono. ")
         .append("Habla siempre en español, con frases cortas y naturales, como en una llamada. Hoy es ").append(today).append(". ");
        if (outgoingFromClaude) {
            s.append("Claude (un agente que trabaja en la nube) pidió hacer esta llamada. Motivo: «").append(inv.reason).append("». ");
            if (!inv.context.isEmpty()) s.append("Contexto que dejó Claude:\n").append(inv.context).append("\n");
            s.append("Explica el motivo en pocas palabras, responde sus preguntas con ese contexto y consigue una respuesta o decisión clara. ")
             .append("No inventes nada que no esté en el contexto: si no lo sabes, dilo y ofrece guardarlo como encargo para Claude. ")
             .append("Antes de despedirte repite en una frase lo que decidió. ");
        } else {
            s.append("El dueño te está llamando. Puedes consultar sus pendientes con la herramienta ver_pendientes. ")
             .append("Si te pide algo que debe hacer Claude (investigar, escribir, buscar ofertas, revisar algo), guárdalo con dejar_encargo, ")
             .append("con todos los detalles que te dé, y dile que Claude lo atenderá en su próxima revisión y le contestará en la app. ")
             .append("No prometas que se hará al instante. ");
        }
        s.append("Si el dueño quiere dejarle algo a Claude, usa dejar_encargo. Cuando la conversación termine, despídete y usa la herramienta colgar.");
        return s.toString();
    }

    static JSONArray tools(boolean outgoingFromClaude) throws JSONException {
        JSONArray decl = new JSONArray();
        decl.put(new JSONObject().put("name", "colgar").put("description", "Termina la llamada después de despedirte."));
        decl.put(new JSONObject().put("name", "dejar_encargo")
                .put("description", "Guarda un encargo o recado para Claude, que lo atenderá en su próxima revisión.")
                .put("parameters", new JSONObject().put("type", "OBJECT")
                        .put("properties", new JSONObject().put("texto", new JSONObject().put("type", "STRING").put("description", "El encargo completo, con todos los detalles.")))
                        .put("required", new JSONArray().put("texto"))));
        if (!outgoingFromClaude) {
            decl.put(new JSONObject().put("name", "ver_pendientes").put("description", "Lista las tareas pendientes del dueño, con prioridad y fecha límite."));
        }
        return new JSONArray().put(new JSONObject().put("functionDeclarations", decl));
    }

    /* ---------- mensajes de Gemini Live (BidiGenerateContent) ---------- */
    static String setupMessage(String model, String voice, String instructions, JSONArray tools) throws JSONException {
        JSONObject setup = new JSONObject()
                .put("model", model.startsWith("models/") ? model : "models/" + model)
                .put("generationConfig", new JSONObject()
                        .put("responseModalities", new JSONArray().put("AUDIO"))
                        .put("speechConfig", new JSONObject().put("voiceConfig", new JSONObject()
                                .put("prebuiltVoiceConfig", new JSONObject().put("voiceName", voice)))))
                .put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", instructions))))
                .put("tools", tools)
                // menos sensible a ruido/eco para que no corte a Claude a media frase
                .put("realtimeInputConfig", new JSONObject().put("automaticActivityDetection", new JSONObject()
                        .put("startOfSpeechSensitivity", "START_SENSITIVITY_LOW")
                        .put("endOfSpeechSensitivity", "END_SENSITIVITY_LOW")
                        .put("prefixPaddingMs", 300)
                        .put("silenceDurationMs", 900)))
                .put("inputAudioTranscription", new JSONObject())
                .put("outputAudioTranscription", new JSONObject());
        return new JSONObject().put("setup", setup).toString();
    }

    static String textTurn(String text) throws JSONException {
        return new JSONObject().put("clientContent", new JSONObject()
                .put("turns", new JSONArray().put(new JSONObject().put("role", "user")
                        .put("parts", new JSONArray().put(new JSONObject().put("text", text)))))
                .put("turnComplete", true)).toString();
    }

    static String firstTurn(boolean outgoingFromClaude) throws JSONException {
        return textTurn(outgoingFromClaude
                ? "(El dueño acaba de contestar. Salúdalo brevemente y explícale el motivo de la llamada.)"
                : "(El dueño te acaba de llamar. Salúdalo y pregúntale en qué le ayudas.)");
    }

    static String audioMessage(byte[] pcm, int len) {
        String b64 = Base64.getEncoder().encodeToString(len == pcm.length ? pcm : java.util.Arrays.copyOf(pcm, len));
        return "{\"realtimeInput\":{\"audio\":{\"data\":\"" + b64 + "\",\"mimeType\":\"audio/pcm;rate=" + IN_RATE + "\"}}}";
    }

    static String toolResponse(String id, String name, String result) throws JSONException {
        JSONObject r = new JSONObject().put("name", name).put("response", new JSONObject().put("result", result));
        if (id != null) r.put("id", id);
        return new JSONObject().put("toolResponse", new JSONObject().put("functionResponses", new JSONArray().put(r))).toString();
    }

    /** Un evento de lo que manda Gemini, en el orden en que hay que atenderlo. */
    static final class Event {
        enum Kind { SETUP_COMPLETE, TOOL_CALL, GO_AWAY, INTERRUPTED, AUDIO, TRANSCRIPT, TURN_COMPLETE, ERROR }
        final Kind kind;
        byte[] audio;
        String who, text, id, name;
        JSONObject args;
        Event(Kind kind) { this.kind = kind; }
    }

    static List<Event> parse(String raw) {
        List<Event> out = new ArrayList<>();
        JSONObject m;
        try { m = new JSONObject(raw); } catch (JSONException e) { return out; }
        if (m.has("setupComplete")) out.add(new Event(Event.Kind.SETUP_COMPLETE));
        if (m.has("error")) { Event e = new Event(Event.Kind.ERROR); e.text = String.valueOf(m.opt("error")); out.add(e); }
        JSONObject tc = m.optJSONObject("toolCall");
        if (tc != null) {
            JSONArray calls = tc.optJSONArray("functionCalls");
            for (int i = 0; calls != null && i < calls.length(); i++) {
                JSONObject fc = calls.optJSONObject(i);
                if (fc == null) continue;
                Event e = new Event(Event.Kind.TOOL_CALL);
                e.id = fc.has("id") ? fc.optString("id") : null;
                e.name = fc.optString("name", "");
                e.args = fc.optJSONObject("args") == null ? new JSONObject() : fc.optJSONObject("args");
                out.add(e);
            }
        }
        if (m.has("goAway")) out.add(new Event(Event.Kind.GO_AWAY));
        JSONObject sc = m.optJSONObject("serverContent");
        if (sc == null) return out;
        if (sc.optBoolean("interrupted")) out.add(new Event(Event.Kind.INTERRUPTED));
        JSONObject turn = sc.optJSONObject("modelTurn");
        JSONArray parts = turn == null ? null : turn.optJSONArray("parts");
        for (int i = 0; parts != null && i < parts.length(); i++) {
            JSONObject inline = parts.optJSONObject(i) == null ? null : parts.optJSONObject(i).optJSONObject("inlineData");
            if (inline == null) continue;
            Event e = new Event(Event.Kind.AUDIO);
            e.audio = Base64.getDecoder().decode(inline.optString("data", ""));
            out.add(e);
        }
        String[][] pairs = { { "inputTranscription", "yo" }, { "outputTranscription", "ia" } };
        for (String[] p : pairs) {
            JSONObject t = sc.optJSONObject(p[0]);
            String text = t == null ? "" : t.optString("text", "");
            if (!text.isEmpty()) { Event e = new Event(Event.Kind.TRANSCRIPT); e.who = p[1]; e.text = text; out.add(e); }
        }
        if (sc.optBoolean("turnComplete") || sc.optBoolean("interrupted")) out.add(new Event(Event.Kind.TURN_COMPLETE));
        return out;
    }

    /* ---------- transcripción ---------- */
    static final class Transcript {
        final List<String[]> turns = new ArrayList<>(); // {who, text}

        /** Gemini manda la transcripción a trozos: se juntan mientras hable la misma persona. */
        synchronized void add(String who, String text) {
            if (text == null || text.isEmpty()) return;
            if (!turns.isEmpty() && turns.get(turns.size() - 1)[0].equals(who)) {
                String[] last = turns.get(turns.size() - 1);
                last[1] = joinFragments(last[1], text);
            } else {
                turns.add(new String[] { who, text.trim() });
            }
        }

        synchronized String text() {
            StringBuilder s = new StringBuilder();
            for (String[] t : turns) s.append(t[0].equals("yo") ? "Tú: " : "Claude: ").append(t[1].trim()).append("\n\n");
            return s.toString().trim();
        }

        synchronized String resultJson(long seconds) throws JSONException {
            JSONArray arr = new JSONArray();
            for (String[] t : turns) {
                String text = t[1].trim();
                if (!text.isEmpty()) arr.put(new JSONObject().put("who", t[0]).put("text", text));
            }
            return new JSONObject().put("v", 1).put("turns", arr).put("seconds", seconds).toString();
        }
    }

    /** Gemini ya incluye los espacios dentro de cada trozo: se pegan tal cual. */
    static String joinFragments(String a, String b) {
        return a.isEmpty() ? b.trim() : a + b;
    }

    /** Pendientes en texto para la IA de voz (máximo 25, primero las vencidas). */
    static String tasksForVoice(List<TaskLogic.Task> tasks, LocalDate today) {
        if (tasks.isEmpty()) return "No tiene tareas pendientes.";
        StringBuilder s = new StringBuilder("Tareas pendientes (" + tasks.size() + "):\n");
        int n = 0;
        for (TaskLogic.Task t : tasks) {
            if (n++ >= 25) { s.append("… y ").append(tasks.size() - 25).append(" más."); break; }
            s.append("- ").append(t.text);
            if ("high".equals(t.priority)) s.append(" (prioridad alta)");
            if (!t.due.isEmpty()) s.append(" — ").append(TaskLogic.isOverdue(t.due, today) ? "vencida, " : "").append(TaskLogic.dueLabel(t.due, today));
            s.append("\n");
        }
        return s.toString().trim();
    }
}
