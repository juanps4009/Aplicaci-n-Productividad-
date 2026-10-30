"use strict";
/* Captura rápida: un botón «Anotar» (y Ctrl+K o «/» en el computador) abre una hoja con un solo campo que entiende
   frases como «mañana 9am llamar a Ana !» (quickparse.js), resalta lo que entendió y lo guarda donde corresponde:
   Pendientes, Rutina, Oportunidades o Ingresos (si la app ya los tiene). Usa las funciones de app.js (cargar después de app.js). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MON3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const PRIO = { high: "Alta", medium: "Media", low: "Baja" };
  const ICON = {
    cal: '<path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    repeat: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.2 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.5-2.7-1.4M12 6.5V8M12 16v1.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" class="qc-i" aria-hidden="true">${ICON[n]}</svg>`;

  /* ---------- adaptador con app.js ---------- */
  const has = (name) => { try { return typeof eval(name) !== "undefined"; } catch { return false; } }; // eslint-disable-line no-eval
  const todayKey = () => QuickParse.dateKey(new Date());
  const KINDS = [
    { k: "task", label: "Pendiente", icon: "list", tab: "tasks", ok: () => has("state") && has("persistTasks") },
    { k: "routine", label: "Rutina", icon: "repeat", tab: "routine", ok: () => has("Routine") && has("commitRoutine") },
    { k: "opp", label: "Oportunidad", icon: "brief", tab: "work", ok: () => has("Work") && has("commitRoutine") },
    { k: "income", label: "Ingreso", icon: "coin", tab: "work", ok: () => has("Work") && typeof Work.addIncome === "function" },
  ];
  const money = (n) => "$ " + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");
  const kindOf = (k) => KINDS.find((x) => x.k === k);
  const rerender = (tab) => {
    if (tab === "tasks" && has("renderTasks")) renderTasks();
    if (tab === "routine" && has("renderRoutine")) renderRoutine();
    if (tab === "work" && has("renderWork")) renderWork();
    if (window.AppHooks && typeof AppHooks.render === "function") { try { AppHooks.render(); } catch (e) { console.warn(e); } }
  };
  const goTab = (tab) => { if (has("showTab")) showTab(tab); };

  function addTask(p, raw) {
    const due = p.due || (p.time || p.remind ? todayKey() : "");
    const task = { id: uid(), text: (p.title || raw).slice(0, 200), done: false, priority: p.priority || "medium", due, reminders: [] };
    if (p.time || p.remind) {
      const at = `${due}T${p.time || "09:00"}`;
      if (Reminders.localMs(at) > Date.now()) addReminder(task, { id: uid(), kind: "once", at, created: Date.now() });
    }
    state.tasks.unshift(task);
    persistTasks();
    if (has("runReminders")) runReminders();
    return { id: task.id, undo: () => { state.tasks = state.tasks.filter((t) => t.id !== task.id); persistTasks(); } };
  }
  function addRoutine(p, raw) {
    const rec = Routine.addItem(state.routine, { text: p.title || raw, freq: p.rec ? p.rec.freq : "daily", days: p.rec ? p.rec.days : [] }, Date.now(), uid());
    if (!rec) return null;
    commitRoutine(); rerender("routine");
    return { id: rec.id, undo: () => { Routine.removeItem(state.routine, rec.id); commitRoutine(); rerender("routine"); } };
  }
  function addOpp(p, raw) {
    const rec = Work.add(state.work, { title: p.title || raw, url: p.url, closes: p.closes || p.due, source: p.url ? "" : "Anotada a mano" }, Date.now(), uid());
    if (!rec) return null;
    commitRoutine(); rerender("work");
    return { id: rec.id, undo: () => { Work.remove(state.work, rec.id); commitRoutine(); rerender("work"); } };
  }
  function addIncome(p, raw) {
    if (!p.amount) return null;
    const rec = Work.addIncome(state.work, { client: p.title || "Cliente", amount: p.amount, date: p.due || todayKey(), type: p.itype || "claude" }, Date.now(), uid());
    if (!rec) return null;
    if ("workView" in state) state.workView = "income";
    commitRoutine(); rerender("work");
    return { id: rec.id, undo: () => { state.work = state.work.filter((r) => r.id !== rec.id); commitRoutine(); rerender("work"); } };
  }
  const SAVE = { task: addTask, routine: addRoutine, opp: addOpp, income: addIncome };

  /* ---------- aviso con «Deshacer» (lo usa también swipe.js) ---------- */
  let toastTimer;
  function toast(msg, actionLabel, action) {
    if (actionLabel === "Deshacer" && typeof showUndo === "function") { showUndo(msg, action); return; } // el aviso de app.js, si existe
    let el = $("#qc-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "qc-toast"; el.className = "qc-toast"; el.setAttribute("role", "status");
      el.innerHTML = '<span></span><button type="button"></button>';
      document.body.append(el);
    }
    el.querySelector("span").textContent = msg;
    const b = el.querySelector("button");
    b.hidden = !actionLabel; b.textContent = actionLabel || "";
    b.onclick = () => { el.classList.remove("show"); if (action) action(); };
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 5000);
  }

  /* ---------- etiquetas ---------- */
  const parseKey = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  function dateLabel(s) {
    const d = parseKey(s), n = Math.round((d - parseKey(todayKey())) / 864e5);
    if (n === 0) return "Hoy"; if (n === 1) return "Mañana"; if (n === -1) return "Ayer";
    if (n > 1 && n < 7) return DOW[d.getDay()].charAt(0).toUpperCase() + DOW[d.getDay()].slice(1);
    return `${d.getDate()} ${MON3[d.getMonth()]}`;
  }
  function recLabel(rec) {
    if (!rec || rec.freq === "daily" && !rec.days.length) return "Cada día";
    if (rec.freq === "weekly") return "Cada semana"; if (rec.freq === "monthly") return "Cada mes";
    if (rec.days.join() === "1,2,3,4,5") return "Lunes a viernes"; if (rec.days.join() === "6,7") return "Fines de semana";
    return "Cada " + rec.days.map((d) => DOW[d % 7]).join(", ");
  }

  /* ---------- la hoja ---------- */
  const EXAMPLES = ["mañana 9am llamar a Ana !", "cada lunes revisar ofertas en Workana", "viernes a las 4 entregar transcripción recuérdame", "oferta traductor remoto cierra el viernes"];
  let override = null;
  const sheet = document.createElement("div");
  sheet.id = "qc-sheet"; sheet.className = "sheet-backdrop qc-backdrop hidden";
  sheet.innerHTML = `<div class="sheet qc-sheet" role="dialog" aria-modal="true" aria-label="Anotar algo nuevo">
    <div class="qc-grab" aria-hidden="true"></div>
    <div class="qc-field"><div class="qc-mirror" aria-hidden="true"></div>
      <textarea id="qc-input" class="qc-input" rows="1" placeholder="Escribe lo que sea…" aria-label="Qué quieres anotar" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></textarea></div>
    <div id="qc-body"></div>
    <div class="qc-foot"><span class="qc-hint" id="qc-hint"></span><button type="button" class="btn-primary qc-save" id="qc-save">Guardar</button></div>
  </div>`;
  const fab = document.createElement("button");
  fab.type = "button"; fab.id = "qc-fab"; fab.className = "qc-fab";
  fab.setAttribute("aria-label", "Anotar algo nuevo");
  fab.innerHTML = `${ic("plus")}<span>Anotar</span>`;
  document.body.append(sheet, fab);
  const input = $("#qc-input", sheet), body = $("#qc-body", sheet), mirror = $(".qc-mirror", sheet), saveBtn = $("#qc-save", sheet);

  const isOpen = () => !sheet.classList.contains("hidden");
  function open(prefill = "") {
    override = null;
    input.value = prefill;
    if (typeof openSheet === "function") openSheet("#qc-sheet"); else sheet.classList.remove("hidden");
    $("#qc-hint", sheet).textContent = matchMedia("(pointer: fine)").matches ? "Enter guarda · Esc cierra" : "Toca un color para quitarlo";
    update();
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
  }
  function close() {
    if (!isOpen()) return;
    if (typeof closeSheet === "function") closeSheet("#qc-sheet"); else sheet.classList.add("hidden");
    input.blur();
  }

  function update() {
    const v = input.value, p = QuickParse.parse(v);
    let html = "", last = 0;
    p.spans.forEach((s) => { html += esc(v.slice(last, s.s)) + `<mark class="qc-mk qc-${s.type}">${esc(v.slice(s.s, s.e))}</mark>`; last = s.e; });
    mirror.innerHTML = html + esc(v.slice(last)) + " ";
    input.style.height = "auto"; input.style.height = input.scrollHeight + "px";
    if (!v.trim()) {
      body.innerHTML = `<p class="qc-label">Prueba con</p><div class="qc-examples">${EXAMPLES.map((x) => `<button type="button" class="qc-example" data-qc="example" data-v="${esc(x)}">${ic("arrow")}${esc(x)}</button>`).join("")}</div>`;
      saveBtn.disabled = true; return;
    }
    saveBtn.disabled = false;
    let kind = override || p.kind;
    if (!kindOf(kind) || !kindOf(kind).ok()) kind = "task";
    const chips = [];
    const span = (type) => p.spans.find((s) => s.type === type);
    const chip = (cls, icon, label, sp) => chips.push(`<button type="button" class="qc-chip qc-c-${cls}" ${sp ? `data-qc="unspan" data-s="${sp.s}" data-e="${sp.e}" aria-label="Quitar ${esc(label)}"` : "tabindex=\"-1\""}>${ic(icon)}${esc(label)}${sp ? ic("x") : ""}</button>`);
    if (kind === "task") {
      if (p.due) chip("date", "cal", dateLabel(p.due), span("date")); else if (p.time || p.remind) chip("date", "cal", "Hoy");
      if (p.time) chip("date", "clock", "Aviso " + p.time, span("time"));
      else if (p.remind) chip("rem", "bell", "Aviso 09:00", span("rem"));
      if (p.priority) chip("prio", "flag", PRIO[p.priority], span("prio"));
    } else if (kind === "routine") {
      chip("rut", "repeat", recLabel(p.rec), span("rut"));
    } else if (kind === "opp") {
      const c = p.closes || p.due;
      chip("opp", "clock", c ? "Cierra " + dateLabel(c).toLowerCase() : "Sin fecha de cierre", span("date"));
      if (p.url) { try { chip("opp", "link", new URL(p.url).hostname.replace(/^www\./, ""), span("url")); } catch { /* enlace raro: se ignora */ } }
    } else if (kind === "income") {
      chip("rut", "coin", p.amount ? money(p.amount) : "Falta el monto, por ejemplo $150.000", span("money"));
      chip("opp", "brief", p.itype === "presencial" ? "Presencial" : "Con Claude");
      chip("date", "cal", p.due ? dateLabel(p.due) : "Hoy", span("date"));
    }
    const where = { task: "Pendientes", routine: "Rutina", opp: "Oportunidades", income: "Ingresos" }[kind];
    body.innerHTML = `<div class="qc-preview"><p class="qc-label">Va a ${where}</p>
      <p class="qc-title ${p.title ? "" : "qc-empty"}">${esc(p.title || "Sigue escribiendo…")}</p>${chips.length ? `<div class="qc-chips">${chips.join("")}</div>` : ""}</div>
      <p class="qc-label">¿Va en otro lugar?</p><div class="qc-dest" role="radiogroup">${KINDS.filter((x) => x.ok()).map((x) => `<button type="button" class="qc-chip" role="radio" data-qc="kind" data-v="${x.k}" aria-checked="${x.k === kind}">${ic(x.icon)}${x.label}</button>`).join("")}</div>`;
  }

  function save() {
    const raw = input.value.trim();
    if (!raw) return;
    const p = QuickParse.parse(raw);
    let kind = override || p.kind;
    if (!kindOf(kind) || !kindOf(kind).ok()) kind = "task";
    if (!p.title && kind !== "task") p.title = raw;
    let res = null;
    try { res = SAVE[kind](p, raw); } catch (e) { console.error(e); }
    if (!res) { toast(kind === "income" ? "Falta el monto. Escribe, por ejemplo, «cobré $150.000 Ana»." : "No se pudo guardar. Revisa el texto e inténtalo de nuevo."); return; }
    close();
    const tab = kindOf(kind).tab;
    const msg = kind === "task" ? `Añadido a Pendientes${p.due ? " · " + dateLabel(p.due).toLowerCase() : ""}${p.time ? " " + p.time : ""}`
      : kind === "routine" ? "Añadido a tu rutina · " + recLabel(p.rec).toLowerCase()
      : kind === "income" ? `Ingreso de ${money(p.amount)} guardado` : "Oferta guardada · por revisar";
    if (typeof state !== "undefined" && state.tab !== tab) goTab(tab);
    toast(msg, "Deshacer", () => { res.undo(); toast("Listo, no se guardó"); });
  }

  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) { close(); return; }
    const b = e.target.closest("[data-qc]");
    if (!b) return;
    if (b.dataset.qc === "example") { input.value = b.dataset.v; update(); input.focus(); }
    if (b.dataset.qc === "kind") { override = b.dataset.v; update(); }
    if (b.dataset.qc === "unspan") {
      input.value = (input.value.slice(0, +b.dataset.s) + input.value.slice(+b.dataset.e)).replace(/\s{2,}/g, " ").replace(/^\s+/, "");
      update(); input.focus();
    }
  });
  input.addEventListener("input", () => { override = null; update(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  input.addEventListener("scroll", () => { mirror.scrollTop = input.scrollTop; });
  saveBtn.addEventListener("click", save);
  fab.addEventListener("click", () => open());

  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("widget-mode")) return; // el widget de escritorio es de solo lectura
    const t = document.activeElement;
    const typing = t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); isOpen() ? close() : open(); return; }
    if (!typing && e.key === "/" && !isOpen() && !document.querySelector(".sheet-backdrop:not(.hidden), .page:not(.hidden)")) { e.preventDefault(); open(); }
  });

  window.QuickCapture = { open, close, toast };
})();
