"use strict";
/* Llamadas y mensajes con Claude: lógica pura (sin DOM ni red), igual a la del widget de Android (CallLogic.java)
   y a la de herramientas/llamar.mjs. La usa calls.js y se prueba con Node.
   Idea tomada de agentring (github.com/mutonby/agentring, Apache-2.0).

   Formatos cifrados con la clave del código (sync.js, «e1:»):
     invitación  aad "inv|<id llamada>"  {v, reason, context, from, at}
     resultado   aad "res|<id llamada>"  {v, turns:[{who:"yo"|"ia", text}], seconds, summary?}
     mensaje     aad "msg|<id>"          {v, text}          (kind "msg" o "encargo")
     perdida     kind "missed": su `data` es la invitación de la llamada `ref` */
(function (root) {
  const IN_RATE = 16000, OUT_RATE = 24000;
  const MAX_TEXT = 8000;
  const AAD = { invite: (id) => `inv|${id}`, result: (id) => `res|${id}`, msg: (id) => `msg|${id}` };

  const b64url = (bytes) => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const newId = (prefix) => prefix + b64url(crypto.getRandomValues(new Uint8Array(12)));

  /* Mensajes descifrados → hilo ordenado, un elemento por id (el último estado manda) */
  function mergeThread(prev, incoming) {
    const byId = new Map((prev || []).map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, { ...(byId.get(m.id) || {}), ...m });
    return [...byId.values()].sort((a, b) => a.at - b.at || a.seq - b.seq);
  }

  function messageText(kind, body) {
    if (!body) return "";
    if (kind === "missed") return `Llamada perdida${body.reason ? `: ${body.reason}` : ""}`;
    return String(body.text || "");
  }

  const unread = (thread, seenSeq) => thread.filter((m) => m.sender === "claude" && m.seq > seenSeq).length;
  const openErrands = (thread) => thread.filter((m) => m.kind === "encargo" && !m.done);

  /* ---------- IA de voz (Gemini Live) ---------- */
  function instructions(fromClaude, invite, today) {
    let s = "Eres la voz de Claude, el asistente de IA del dueño de la app Pendientes, en una llamada. " +
      `Habla siempre en español, con frases cortas y naturales, como en una llamada. Hoy es ${today}. `;
    if (fromClaude) {
      s += `Claude (un agente que trabaja en la nube) pidió hacer esta llamada. Motivo: «${invite.reason || ""}». `;
      if (invite.context) s += `Contexto que dejó Claude:\n${invite.context}\n`;
      s += "Explica el motivo en pocas palabras, responde sus preguntas con ese contexto y consigue una respuesta o decisión clara. " +
        "No inventes nada que no esté en el contexto: si no lo sabes, dilo y ofrece guardarlo como encargo para Claude. " +
        "Antes de despedirte repite en una frase lo que decidió. ";
    } else {
      s += "El dueño te está llamando. Puedes consultar sus pendientes con la herramienta ver_pendientes. " +
        "Si te pide algo que debe hacer Claude (investigar, escribir, buscar ofertas, revisar algo), guárdalo con dejar_encargo, " +
        "con todos los detalles que te dé, y dile que Claude lo atenderá en su próxima revisión y le contestará en la app. " +
        "No prometas que se hará al instante. ";
    }
    return s + "Si el dueño quiere dejarle algo a Claude, usa dejar_encargo. Cuando la conversación termine, despídete y usa la herramienta colgar.";
  }

  function tools(fromClaude) {
    const decl = [
      { name: "colgar", description: "Termina la llamada después de despedirte." },
      { name: "dejar_encargo", description: "Guarda un encargo o recado para Claude, que lo atenderá en su próxima revisión.",
        parameters: { type: "OBJECT", properties: { texto: { type: "STRING", description: "El encargo completo, con todos los detalles." } }, required: ["texto"] } },
    ];
    if (!fromClaude) decl.push({ name: "ver_pendientes", description: "Lista las tareas pendientes del dueño, con prioridad y fecha límite." });
    return [{ functionDeclarations: decl }];
  }

  function setupMessage(model, voice, instr, toolList) {
    return { setup: {
      model: model.startsWith("models/") ? model : `models/${model}`,
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      systemInstruction: { parts: [{ text: instr }] },
      tools: toolList,
      realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: "START_SENSITIVITY_LOW", endOfSpeechSensitivity: "END_SENSITIVITY_LOW", prefixPaddingMs: 300, silenceDurationMs: 900 } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    } };
  }

  const textTurn = (text) => ({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });
  const firstTurn = (fromClaude) => textTurn(fromClaude
    ? "(El dueño acaba de contestar. Salúdalo brevemente y explícale el motivo de la llamada.)"
    : "(El dueño te acaba de llamar. Salúdalo y pregúntale en qué le ayudas.)");
  const audioMessage = (b64) => ({ realtimeInput: { audio: { data: b64, mimeType: `audio/pcm;rate=${IN_RATE}` } } });
  const toolResponse = (id, name, result) => ({ toolResponse: { functionResponses: [{ ...(id ? { id } : {}), name, response: { result } }] } });

  /* Un mensaje de Gemini → eventos en el orden en que hay que atenderlos */
  function parse(m) {
    const out = [];
    if (!m || typeof m !== "object") return out;
    if (m.setupComplete) out.push({ kind: "ready" });
    if (m.error) out.push({ kind: "error", text: String(m.error.message || m.error) });
    for (const fc of (m.toolCall && m.toolCall.functionCalls) || []) out.push({ kind: "tool", id: fc.id, name: fc.name || "", args: fc.args || {} });
    if (m.goAway) out.push({ kind: "goaway" });
    const sc = m.serverContent || {};
    if (sc.interrupted) out.push({ kind: "interrupted" });
    for (const p of (sc.modelTurn && sc.modelTurn.parts) || []) if (p.inlineData && p.inlineData.data) out.push({ kind: "audio", data: p.inlineData.data });
    if (sc.inputTranscription && sc.inputTranscription.text) out.push({ kind: "transcript", who: "yo", text: sc.inputTranscription.text });
    if (sc.outputTranscription && sc.outputTranscription.text) out.push({ kind: "transcript", who: "ia", text: sc.outputTranscription.text });
    if (sc.turnComplete || sc.interrupted) out.push({ kind: "turn" });
    return out;
  }

  /* Gemini manda la transcripción a trozos (con sus espacios): se juntan mientras hable la misma persona */
  function addTranscript(turns, who, text) {
    if (!text) return turns;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text += text;
    else turns.push({ who, text: text.trimStart() });
    return turns;
  }

  const resultBody = (turns, seconds) => ({ turns: turns.map((t) => ({ who: t.who, text: t.text.trim() })).filter((t) => t.text), seconds });

  function tasksForVoice(tasks, today) {
    const open = tasks.filter((t) => !t.done);
    if (!open.length) return "No tiene tareas pendientes.";
    const rank = (t) => (t.due && t.due < today ? 0 : t.due ? 1 : 2);
    const sorted = open.slice().sort((a, b) => rank(a) - rank(b) || String(a.due || "").localeCompare(String(b.due || "")));
    const lines = sorted.slice(0, 25).map((t) => `- ${t.text}${t.priority === "high" ? " (prioridad alta)" : ""}${t.due ? ` — ${t.due < today ? "vencida, " : ""}${t.due}` : ""}`);
    if (open.length > 25) lines.push(`… y ${open.length - 25} más.`);
    return `Tareas pendientes (${open.length}):\n${lines.join("\n")}`;
  }

  /* PCM: Float32 (Web Audio) ↔ Int16 little-endian en base64 */
  function floatToB64(samples) {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToFloat(b64) {
    const bin = atob(b64);
    const n = Math.floor(bin.length / 2), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
      if (v >= 0x8000) v -= 0x10000;
      out[i] = v / 0x8000;
    }
    return out;
  }

  /* «colgar» sin cortar la despedida: cuelga cuando ya pasó un mínimo, no llegó audio nuevo en un rato y no queda
     audio por reproducir; con un tope por si algo falla. Misma regla que CallService.hangupWhenSilent (Android). */
  const FAREWELL = { minMs: 1500, quietMs: 1200, maxMs: 20000 };
  function shouldHangup(waitedMs, sinceAudioMs, playbackLeftSec) {
    if (waitedMs >= FAREWELL.maxMs) return true;
    return waitedMs >= FAREWELL.minMs && sinceAudioMs > FAREWELL.quietMs && playbackLeftSec <= 0.05;
  }

  const ERRORS = {
    sin_celular: "No hay ningún celular con llamadas activadas.",
    llamadas_no_configuradas: "El servidor todavía no tiene las llamadas configuradas (Firebase).",
    voz_no_configurada: "El servidor todavía no tiene la clave de la voz (Gemini).",
    voz_no_disponible: "La voz no respondió. Prueba en un momento.",
    limite_diario: "Se llegó al límite de hoy. Prueba mañana.",
  };

  const api = { IN_RATE, OUT_RATE, MAX_TEXT, AAD, newId, mergeThread, messageText, unread, openErrands, instructions, tools, setupMessage,
    textTurn, firstTurn, audioMessage, toolResponse, parse, addTranscript, resultBody, tasksForVoice, floatToB64, b64ToFloat, FAREWELL, shouldHangup, ERRORS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CallLogic = api;
})(typeof self !== "undefined" ? self : this);
