"use strict";
/* Claude: mensajes, encargos y llamadas por voz (versión 0.22).
   - Hilo con Claude: lo que Claude te escribe (herramientas/llamar.mjs), tus respuestas y tus encargos.
   - «Llamar a Claude» desde el navegador: conversación de voz con Gemini Live (token temporal del servidor).
   - El celular con el widget 2.0 suena cuando Claude llama (eso lo hace el widget, no esta página).
   Usa el estado y las funciones de app.js (se carga después) y la lógica pura de calllogic.js.
   Todo viaja cifrado con la clave del código de sincronización: el servidor no puede leerlo. */

const CLAUDE_KEY = "prod.claude";
const claude = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CLAUDE_KEY) || "{}") || {}; } catch { saved = {}; }
  return {
    thread: Array.isArray(saved.thread) ? saved.thread : [],
    seq: Number.isInteger(saved.seq) ? saved.seq : 0,
    seen: Number.isInteger(saved.seen) ? saved.seen : 0,
    space: typeof saved.space === "string" ? saved.space : "",
    status: null,      // { devices, push, voice } del servidor
    returned: new Set(),
    busy: false, error: "", live: null,
  };
})();

function saveClaude() {
  try {
    localStorage.setItem(CLAUDE_KEY, JSON.stringify({ thread: claude.thread.slice(-200), seq: claude.seq, seen: claude.seen, space: claude.space }));
  } catch { /* sin espacio: el hilo se vuelve a bajar */ }
}

async function claudeApi(path, body) {
  const res = await fetch(`${serverUrl()}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ space: state.sync.space, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(CallLogic.ERRORS[data.error] || `El servidor respondió ${res.status}.`); e.code = data.error; throw e; }
  return data;
}

async function claudeSeal(obj, aad) { return Sync.encryptText(await getSyncKey(), JSON.stringify({ v: 1, ...obj }), aad); }
async function claudeOpen(data, aad) {
  if (!data) return null;
  const plain = await Sync.decryptText(await getSyncKey(), data, aad);
  if (plain === null) return null;
  try { return JSON.parse(plain); } catch { return null; }
}

/* ---------- hilo ---------- */
async function refreshClaude() {
  if (!syncLinked() || claude.busy) return;
  if (claude.space !== state.sync.space) Object.assign(claude, { thread: [], seq: 0, seen: 0, space: state.sync.space, returned: new Set() }); // otro código: hilo nuevo
  claude.busy = true;
  try {
    let more = true;
    while (more) {
      const page = await claudeApi("/msg/list", { after: claude.seq });
      const items = [];
      for (const m of page.messages) {
        const body = await claudeOpen(m.data, m.kind === "missed" ? CallLogic.AAD.invite(m.ref) : CallLogic.AAD.msg(m.id));
        if (!body) continue;
        items.push({ id: m.id, seq: m.seq, sender: m.sender, kind: m.kind, done: m.done, at: m.createdAt, text: CallLogic.messageText(m.kind, body) });
      }
      claude.thread = CallLogic.mergeThread(claude.thread, items);
      claude.seq = page.seq;
      more = page.more;
    }
    claude.error = "";
    if (isClaudeOpen()) claude.seen = claude.seq;
    saveClaude();
  } catch (e) {
    claude.error = e.message || "Sin conexión con el servidor.";
  } finally {
    claude.busy = false;
  }
  renderClaudeBadge();
  if (isClaudeOpen()) renderClaude();
  if (state.tab === "home" && typeof renderHome === "function") renderHome();
}

async function sendToClaude(kind, text) {
  text = text.trim();
  if (!text) return;
  if (text.length > CallLogic.MAX_TEXT) throw new Error("El mensaje es muy largo.");
  const id = CallLogic.newId("y");
  await claudeApi("/msg/send", { id, sender: "yo", kind, data: await claudeSeal({ text }, CallLogic.AAD.msg(id)) });
  await refreshClaude();
}

const isClaudeOpen = () => !$("#claude-sheet").classList.contains("hidden");
const claudeUnread = () => CallLogic.unread(claude.thread, claude.seen);

function renderClaudeBadge() {
  const n = syncLinked() ? claudeUnread() : 0;
  $("#claude-badge").classList.toggle("hidden", !n);
  $("#open-claude").setAttribute("aria-label", n ? `Claude: ${n} mensaje${n === 1 ? "" : "s"} nuevo${n === 1 ? "" : "s"}` : "Claude: mensajes y llamadas");
}

/* Tarjeta del Inicio (home.js la pone si existe): solo si hay algo que ver */
function claudeHomeStrip() {
  if (!syncLinked()) return "";
  const n = claudeUnread(), open = CallLogic.openErrands(claude.thread).length;
  if (!n && !open) return "";
  const last = [...claude.thread].reverse().find((m) => m.sender === "claude");
  return `<button class="card claude-strip" data-action="open-claude">
    <span class="claude-dot" aria-hidden="true">C</span>
    <span class="claude-strip-text"><b>${n ? `Claude te escribió${n > 1 ? ` (${n})` : ""}` : `${open} encargo${open === 1 ? "" : "s"} para Claude`}</b>
    <small>${esc(n && last ? last.text.slice(0, 90) : "Claude los atiende en su próxima revisión.")}</small></span>
  </button>`;
}

const claudeTime = (ms) => new Date(ms).toLocaleString("es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const claudeClock = (ms) => new Date(ms).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
const missedLabel = (m) => m.text.replace(/^Llamada perdida:?\s*/, "") || "Claude intentó llamarte";
const MISSED_PHONE_SVG = `<svg class="msg-missed-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/><path d="M15 3l6 6M21 3l-6 6"/></svg>`;

function renderClaude() {
  const linked = syncLinked();
  const st = claude.status;
  $("#claude-setup").innerHTML = !linked
    ? `<p>Para hablar con Claude, primero conecta tus dispositivos en Ajustes.</p>`
    : st ? `<p>${st.devices ? "Celular para llamadas: conectado" : "Para que Claude te llame, activa las llamadas en el widget de Android."}${st.voice ? "" : " · La voz aún no está configurada en el servidor."}</p>`
      : "";
  const list = $("#claude-thread");
  const pendBox = $("#claude-pending");
  if (!linked) {
    list.innerHTML = "";
    if (pendBox) { pendBox.innerHTML = ""; pendBox.classList.add("hidden"); }
    $("#claude-call").classList.add("hidden");
    $("#claude-compose").classList.add("hidden");
    $("#claude-live").classList.add("hidden");
    $("#claude-sheet").classList.remove("is-live");
    return;
  }

  // TODO v3: respuestas rápidas en preguntas de llamada entrante (requiere endpoint en servidor)
  const pending = claude.thread.filter((m) => m.kind === "missed" && !claude.returned.has(m.id));
  if (pendBox) {
    pendBox.classList.toggle("hidden", !pending.length);
    pendBox.setAttribute("aria-label", `Esperan tu respuesta, ${pending.length}`);
    pendBox.innerHTML = pending.length
      ? `<h3 class="claude-pending-head"><span>Esperan tu respuesta</span><span class="claude-pending-count">${pending.length}</span></h3>` +
        pending.map((p) => `
          <div class="claude-pending-item" data-id="${esc(p.id)}">
            <span class="claude-pending-title">${esc(missedLabel(p))}</span>
            <span class="claude-pending-meta">Llamada perdida · ${esc(claudeClock(p.at))}</span>
            <button type="button" class="claude-pending-act" data-action="call-back" data-id="${esc(p.id)}">Devolver llamada</button>
          </div>`).join("")
      : "";
  }

  list.innerHTML = claude.thread.length
    ? claude.thread.slice(-80).map((m) => {
      if (m.kind === "missed") {
        return `<li class="msg ${m.sender === "yo" ? "mine" : "theirs"} missed">
          ${MISSED_PHONE_SVG}
          <span class="msg-missed-text">${esc(missedLabel(m))} · ${esc(claudeClock(m.at))}</span>
          <button type="button" class="msg-missed-act" data-action="call-back" data-id="${esc(m.id)}">Devolver llamada</button>
        </li>`;
      }
      return `<li class="msg ${m.sender === "yo" ? "mine" : "theirs"} ${esc(m.kind)}">
        <div class="msg-bubble"><p>${esc(m.text)}</p></div>
        <div class="msg-meta">
          ${m.kind === "encargo" ? `<span class="msg-tag ${m.done ? "is-done" : ""}">Encargo · ${m.done ? "atendido" : "pendiente"}</span>` : ""}
          <span>${m.sender === "yo" ? "Tú" : "Claude"} · ${esc(claudeTime(m.at))}</span>
        </div>
      </li>`;
    }).join("")
    : (!pending.length ? `<li class="claude-empty">Aquí verás lo que Claude te escribe y lo que le pides.</li>` : "");
  $("#claude-error").textContent = claude.error;
  const scroller = $("#claude-scroll");
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  list.scrollTop = list.scrollHeight;
  renderClaudeLive();
}

async function openClaude() {
  claudeNative.tried = false; // cada vez que se abre la hoja se vuelve a intentar la llamada nativa
  renderClaude();
  openSheet("#claude-sheet");
  const scroller = $("#claude-scroll");
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
  $("#claude-thread").scrollTop = $("#claude-thread").scrollHeight; // ya visible: mostrar lo último
  claude.seen = claude.seq;
  saveClaude();
  renderClaudeBadge();
  if (!syncLinked()) return;
  claudeApi("/call/status", {}).then((s) => { claude.status = s; renderClaude(); }).catch(() => {});
  await refreshClaude();
}

function closeClaude() {
  if (claude.live) return; // durante una llamada la hoja no se cierra (se cuelga con el botón)
  closeSheet("#claude-sheet");
}

/* ---------- llamada por voz desde el navegador (Gemini Live) ---------- */
const fmtCallDur = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function updateVoiceMeter(L) {
  const bar = $("#claude-voice-bar");
  const meter = bar?.parentElement;
  const stateEl = $("#claude-voice-state");
  if (!L) return;
  const speakingClaude = L.lastAudioIn && Date.now() - L.lastAudioIn < 900;
  const lvl = L.muted ? 0 : Math.max(0, Math.min(1, L.voiceLevel || 0));
  if (bar) bar.style.transform = `scaleX(${lvl.toFixed(3)})`;
  if (meter) meter.setAttribute("aria-valuenow", String(Math.round(lvl * 100)));
  if (stateEl) {
    stateEl.textContent = !L.started ? L.status : L.muted ? "Silenciado" : speakingClaude ? "Claude habla" : "Te escucho";
  }
}

function renderClaudeLive() {
  const L = claude.live;
  $("#claude-sheet").classList.toggle("is-live", !!L);
  $("#claude-call").classList.toggle("hidden", !!L || !syncLinked());
  $("#claude-live").classList.toggle("hidden", !L);
  $("#claude-compose").classList.toggle("hidden", !!L || !syncLinked());
  if (!L) return;
  $("#claude-live-status").textContent = L.status === "En llamada" ? "En llamada con Claude" : L.status;
  const durEl = $("#claude-live-dur");
  if (durEl) durEl.textContent = L.started ? fmtCallDur(Math.floor((Date.now() - L.started) / 1000)) : "0:00";

  let lastIaIdx = -1;
  for (let i = L.turns.length - 1; i >= 0; i--) { if (L.turns[i].who !== "yo") { lastIaIdx = i; break; } }
  const txtEl = $("#claude-live-text");
  txtEl.innerHTML = L.turns.length
    ? L.turns.map((t, i) => `<p class="${t.who !== "yo" && i === lastIaIdx ? "claude-live-claude" : "claude-live-you"}">${t.who === "yo" ? `Tú: ${esc(t.text)}` : esc(t.text)}</p>`).join("")
    : `<p class="claude-live-empty">${esc(L.started ? "Escuchando…" : L.status)}</p>`;
  txtEl.scrollTop = txtEl.scrollHeight;

  const muteBtn = $("#claude-mute");
  const muteLabel = muteBtn.querySelector("span");
  if (muteLabel) muteLabel.textContent = L.muted ? "Silenciado" : "Silenciar";
  else muteBtn.textContent = L.muted ? "Activar micrófono" : "Silenciar";
  muteBtn.setAttribute("aria-pressed", String(!!L.muted));
  muteBtn.classList.toggle("active", L.muted);
  $("#claude-mute-slash")?.setAttribute("d", L.muted ? "M4 4l16 16" : "");
  updateVoiceMeter(L);
}

/* En Android con el widget 2.0 instalado, «Llamar a Claude» abre su pantalla de llamada (auricular/altavoz, silencio, colgar,
   y sigue con la pantalla apagada). Si el widget no está, la página sigue visible y la llamada se hace aquí en el navegador. */
const claudeNative = {
  android: typeof isAndroid !== "undefined" && isAndroid,
  url: "intent://call#Intent;scheme=pendientes;package=app.productividad.widget;end",
  wait: 1500,
  open(url) { location.href = url; },
};

async function startClaudeCall() {
  if (claude.live || !syncLinked()) return;
  if (claudeNative.android && !claudeNative.tried) {
    claudeNative.tried = true; // un solo intento por apertura de la hoja: si no abre la app, se llama aquí mismo
    claude.error = "";
    $("#claude-call").disabled = true;
    try { claudeNative.open(claudeNative.url); } catch { /* sin app: se llama en el navegador */ }
    await new Promise((r) => setTimeout(r, claudeNative.wait));
    $("#claude-call").disabled = false;
    if (document.hidden) { claudeNative.tried = false; return; } // la app nativa tomó la llamada
  }
  if (!navigator.mediaDevices || !window.WebSocket || !window.AudioContext) { claude.error = "Este navegador no permite llamadas de voz."; renderClaude(); return; }
  const L = claude.live = { status: "Pidiendo el micrófono…", turns: [], muted: false, voiceLevel: 0, id: "", ws: null, stream: null, mic: null, out: null, sources: [], playhead: 0, started: 0, durTimer: null, ended: false };
  renderClaudeLive();
  try {
    L.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    L.status = "Conectando…"; renderClaudeLive();
    L.id = CallLogic.newId("w");
    await claudeApi("/call/new", { id: L.id, dir: "in", invite: await claudeSeal({ reason: "Llamada del dueño", context: "", from: "Dueño", at: Date.now() }, CallLogic.AAD.invite(L.id)) });
    const t = await claudeApi("/voice/token", { id: L.id });
    if (L.ended) return;
    const todayText = new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const setup = CallLogic.setupMessage(t.model, t.voice, CallLogic.instructions(false, {}, todayText), CallLogic.tools(false));
    L.ws = new WebSocket(`${t.url}?access_token=${encodeURIComponent(t.token)}`);
    L.ws.onopen = () => L.ws.send(JSON.stringify(setup));
    L.ws.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text()); } catch { return; }
      for (const e of CallLogic.parse(msg)) onLiveEvent(L, e);
    };
    L.ws.onclose = (ev) => { if (!L.ended) endClaudeCall(ev.code === 1000 ? "" : "La voz se cortó."); };
    L.ws.onerror = () => { if (!L.ended) endClaudeCall("No se pudo conectar con la voz."); };
    L.maxTimer = setTimeout(() => endClaudeCall(""), 14 * 60000); // Gemini corta a los 15 min
  } catch (e) {
    endClaudeCall(e.name === "NotAllowedError" ? "Sin permiso de micrófono no se puede hablar." : e.message || "No se pudo llamar.");
  }
}

function onLiveEvent(L, e) {
  if (L.ended) return;
  if (e.kind === "ready") {
    L.status = "En llamada"; L.started = Date.now();
    clearInterval(L.durTimer);
    L.durTimer = setInterval(() => {
      if (L.ended) return;
      const durEl = $("#claude-live-dur");
      if (durEl && L.started) durEl.textContent = fmtCallDur(Math.floor((Date.now() - L.started) / 1000));
      updateVoiceMeter(L);
    }, 500);
    startLiveAudio(L);
    L.ws.send(JSON.stringify(CallLogic.firstTurn(false)));
  } else if (e.kind === "audio") {
    L.lastAudioIn = Date.now(); L.voiceLevel = 0.65;
    if (L.hang) L.hang.audio = true;
    playLive(L, e.data);
  }
  else if (e.kind === "turn") { if (L.hang && L.hang.audio) L.hang.turn = true; }
  else if (e.kind === "interrupted") { for (const s of L.sources) { try { s.stop(); } catch { /* ya terminó */ } } L.sources = []; L.playhead = 0; }
  else if (e.kind === "transcript") CallLogic.addTranscript(L.turns, e.who, e.text);
  else if (e.kind === "tool") runLiveTool(L, e);
  else if (e.kind === "error") { endClaudeCall("La voz respondió con un error."); return; }
  renderClaudeLive();
}

async function runLiveTool(L, e) {
  let result;
  try {
    if (e.name === "colgar") { result = "Listo, la llamada termina."; if (!L.hang) { L.hang = { since: Date.now(), audio: false, turn: false }; hangupWhenSilent(L); } }
    else if (e.name === "dejar_encargo") {
      const text = String(e.args.texto || "").trim();
      if (!text) result = "Falta el texto del encargo.";
      else { await sendToClaude("encargo", text); result = "Encargo guardado para Claude."; }
    } else if (e.name === "ver_pendientes") result = CallLogic.tasksForVoice(state.tasks, today());
    else result = "Herramienta desconocida.";
  } catch (err) { result = `No se pudo: ${err.message}`; }
  if (L.ws && L.ws.readyState === 1) L.ws.send(JSON.stringify(CallLogic.toolResponse(e.id, e.name, result)));
}

/* Cuelga cuando Claude terminó de despedirse (no a los 2,5 s fijos, que cortaba la frase a la mitad) */
function hangupWhenSilent(L) {
  setTimeout(() => {
    if (L.ended) return;
    const left = L.out ? Math.max(0, L.playhead - L.out.currentTime) : 0;
    if (CallLogic.shouldHangup(Date.now() - L.hang.since, Date.now() - (L.lastAudioIn || 0), left, L.hang.turn, L.hang.audio)) endClaudeCall("");
    else hangupWhenSilent(L);
  }, 400);
}

function startLiveAudio(L) {
  L.mic = new AudioContext({ sampleRate: CallLogic.IN_RATE });
  L.out = new AudioContext({ sampleRate: CallLogic.OUT_RATE });
  const src = L.mic.createMediaStreamSource(L.stream);
  const proc = L.mic.createScriptProcessor(2048, 1, 1); // ~128 ms; sencillo y funciona en todos los navegadores
  const mute = L.mic.createGain(); mute.gain.value = 0;  // el procesador necesita salida, pero no se escucha
  proc.onaudioprocess = (ev) => {
    if (L.ended || !L.ws || L.ws.readyState !== 1) return;
    const raw = ev.inputBuffer.getChannelData(0);
    const data = L.muted ? new Float32Array(ev.inputBuffer.length) : raw;
    if (!L.muted && !(L.lastAudioIn && Date.now() - L.lastAudioIn < 900)) {
      let sum = 0;
      for (let i = 0; i < raw.length; i += 8) sum += raw[i] * raw[i];
      const rms = Math.sqrt(sum / Math.max(1, Math.ceil(raw.length / 8)));
      L.voiceLevel = Math.min(1, rms * 6);
      updateVoiceMeter(L);
    }
    L.ws.send(JSON.stringify(CallLogic.audioMessage(CallLogic.floatToB64(data))));
  };
  src.connect(proc); proc.connect(mute); mute.connect(L.mic.destination);
  try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then((w) => { L.wake = w; if (L.ended) w.release(); }).catch(() => {}); } catch { /* sin soporte */ }
}

function playLive(L, b64) {
  if (!L.out) return;
  const samples = CallLogic.b64ToFloat(b64);
  if (!samples.length) return;
  const buf = L.out.createBuffer(1, samples.length, CallLogic.OUT_RATE);
  buf.copyToChannel(samples, 0);
  const s = L.out.createBufferSource();
  s.buffer = buf;
  s.connect(L.out.destination);
  const at = Math.max(L.out.currentTime + 0.02, L.playhead);
  s.start(at);
  L.playhead = at + buf.duration;
  L.sources.push(s);
  s.onended = () => { L.sources = L.sources.filter((x) => x !== s); };
}

async function endClaudeCall(reason) {
  const L = claude.live;
  if (!L || L.ended) return;
  L.ended = true;
  clearTimeout(L.maxTimer);
  clearInterval(L.durTimer);
  try { if (L.wake) L.wake.release(); } catch { /* ya liberado */ }
  try { if (L.ws) L.ws.close(1000); } catch { /* ya cerrado */ }
  if (L.stream) L.stream.getTracks().forEach((tr) => tr.stop());
  for (const ctx of [L.mic, L.out]) { try { if (ctx) await ctx.close(); } catch { /* ya cerrado */ } }
  claude.live = null;
  claude.error = reason || "";
  renderClaude();
  if (L.id) {
    try {
      const seconds = L.started ? Math.round((Date.now() - L.started) / 1000) : 0;
      await claudeApi("/call/update", { id: L.id, state: "ended", result: await claudeSeal(CallLogic.resultBody(L.turns, seconds), CallLogic.AAD.result(L.id)) });
    } catch { /* la llamada se cierra sola en el servidor */ }
  }
  // TODO v3: tarjeta de confirmación al colgar con barra de 5 s y botón «Corregir» (requiere soporte en servidor)
  refreshClaude();
}

function growClaudeInput() {
  const el = $("#claude-input");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight + 2, 108) + "px";
}

/* ---------- eventos ---------- */
$("#open-claude").addEventListener("click", openClaude);
$("#close-claude").addEventListener("click", closeClaude);
$("#claude-sheet").addEventListener("click", (e) => {
  if (e.target.id === "claude-sheet") { closeClaude(); return; }
  const back = e.target.closest("[data-action='call-back']");
  if (back) {
    if (back.dataset.id) claude.returned.add(back.dataset.id);
    renderClaude();
    startClaudeCall();
  }
});
$("#claude-call").addEventListener("click", startClaudeCall);
$("#claude-hangup").addEventListener("click", () => endClaudeCall(""));
$("#claude-mute").addEventListener("click", () => {
  if (claude.live) {
    claude.live.muted = !claude.live.muted;
    if (claude.live.muted) claude.live.voiceLevel = 0;
    renderClaudeLive();
  }
});
document.addEventListener("click", (e) => { if (e.target.closest("[data-action='open-claude']")) openClaude(); });

$("#claude-input").addEventListener("input", growClaudeInput);
$("#claude-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    $("#claude-compose").requestSubmit($("#claude-compose [data-kind='encargo']"));
  }
});

$("#claude-compose").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kind = e.submitter && e.submitter.dataset.kind === "msg" ? "msg" : "encargo";
  const input = $("#claude-input");
  const buttons = $$("#claude-compose button");
  buttons.forEach((b) => { b.disabled = true; });
  try {
    await sendToClaude(kind, input.value);
    input.value = "";
    growClaudeInput();
    claude.error = "";
  } catch (err) {
    claude.error = err.message || "No se pudo enviar.";
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
    renderClaude();
  }
});

/* #mensajes (desde la notificación del widget) abre el hilo */
function handleClaudeHash() {
  if (location.hash !== "#mensajes") return;
  history.replaceState(history.state, "", location.pathname + location.search);
  openClaude();
}
window.addEventListener("hashchange", handleClaudeHash);
handleClaudeHash();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  refreshClaude();
  const L = claude.live; // al volver a la página el navegador puede haber suspendido el audio
  if (L && !L.ended) for (const c of [L.mic, L.out]) { try { if (c && c.state === "suspended") c.resume(); } catch { /* sin soporte */ } }
  if (L && !L.ended && L.stream && navigator.wakeLock && !L.wake) { try { navigator.wakeLock.request("screen").then((w) => { L.wake = w; }).catch(() => {}); } catch { /* sin soporte */ } }
});
setInterval(() => { if (!document.hidden && syncLinked()) refreshClaude(); }, 60000);
setInterval(() => { if (!document.hidden && isClaudeOpen() && !claude.live) refreshClaude(); }, 8000);
renderClaudeBadge();
refreshClaude();
