"use strict";

/* ---------- Almacenamiento ---------- */
const APP_VERSION = "0.13.1-beta";

const KEYS = {
  tasks: "prod.tasks", books: "prod.books", filter: "prod.filter", tab: "prod.tab",
  settings: "prod.settings", collapsed: "prod.collapsed",
  remstate: "prod.remstate", sync: "prod.sync", tomb: "prod.tomb",
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento lleno o bloqueado */ }
}

const TYPE_FROM_ENTRY = { title: "h1", subtitle: "h2", text: "p" };
const migrateTask = (t) => {
  const task = { priority: "medium", due: "", reminders: [], ...t };
  if (!Array.isArray(task.reminders)) task.reminders = [];
  delete task.notified;
  if (!task.doc) { // formato antiguo: texto plano → bloques de texto
    task.doc = (task.notes || "").split("\n").filter((l) => l.trim()).map((l) => ({ id: uid(), type: "p", text: l }));
  }
  delete task.notes;
  return task;
};
const migrateBook = (b) => {
  const book = { ...b };
  if (!book.doc) {
    book.doc = (book.entries || []).map((e) => ({ id: e.id, type: TYPE_FROM_ENTRY[e.type] || "p", text: e.text }));
  }
  delete book.entries;
  return book;
};

/* Migra una lista guardada; un elemento dañado se descarta en vez de romper la app */
function loadList(key, migrate) {
  const raw = load(key, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object" || !item.id) return [];
    try { return [migrate(item)]; } catch { return []; }
  });
}

const state = {
  // Migración: tareas de la v1 no tenían prioridad, fecha ni aviso
  tasks: loadList(KEYS.tasks, migrateTask),
  books: loadList(KEYS.books, migrateBook),
  filter: load(KEYS.filter, "all"),
  tab: load(KEYS.tab, "tasks"),
  settings: { theme: "", priorityStyle: "dot", groupBy: "date", notifyHere: true, ...load(KEYS.settings, {}) },
  remState: load(KEYS.remstate, {}),   // qué avisos ya sonaron EN ESTE dispositivo (no se sincroniza)
  sync: { code: "", space: "", lastSeq: 0, lastPushAt: 0, ...load(KEYS.sync, {}) },
  tombs: load(KEYS.tomb, []),          // borrados pendientes de propagar
  collapsed: { done: true, ...load(KEYS.collapsed, {}) },
  newPriority: "medium",
  editing: new Set(),      // ids de resúmenes en edición
  openBook: null,          // id del resumen abierto a página completa
  drafts: new Map(),       // copias de trabajo de los resúmenes en edición
  remTask: null,           // tarea abierta en la hoja de recordatorios
  remDraft: null,          // recordatorio que se está creando
  menuTask: null,          // tarea del menú ⋮
  notesTask: null,         // tarea abierta en notas
  editingTask: null,       // id de tarea en edición
};

/* Migraciones de datos guardados por versiones anteriores */
(function migrateStorage() {
  const st = state.settings;
  if (!st.serverUrl && st.pushUrl) st.serverUrl = st.pushUrl; // antes la dirección era solo para avisos
  delete st.pushUrl;
  state.tasks.forEach((t) => t.reminders.forEach((r) => { // el estado de avisos pasa a ser local de cada dispositivo
    if (r.lastFired !== undefined || r.acked !== undefined) {
      if (!state.remState[r.id]) state.remState[r.id] = { lastFired: r.lastFired || 0, acked: !!r.acked };
      delete r.lastFired; delete r.acked;
    }
  }));
})();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const APP = window.APP_CONFIG || {};
/* Servidor efectivo: el propio del usuario (avanzado) o el de la app, sin que nadie cree nada */
const serverUrl = () => state.settings.serverUrl || APP.server || "";
const tracker = Sync.newTracker();
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}


/* ---------- Tema (claro / oscuro con interruptor) ---------- */
const hostTheme = document.documentElement.dataset.theme || ""; // el visor de betas puede fijar uno
function initTheme() { // la primera vez toma el tema del sistema y queda fijo
  if (state.settings.theme === "light" || state.settings.theme === "dark") return;
  state.settings.theme = hostTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  save(KEYS.settings, state.settings);
}
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.settings.theme === "dark" ? "#1e293b" : "#ffffff";
}

/* ---------- Diálogo de confirmación propio (confirm() no funciona en todos los visores) ---------- */
function askConfirm(message, okLabel = "Eliminar") {
  return new Promise((resolve) => {
    $("#confirm-msg").textContent = message;
    $("#confirm-ok").textContent = okLabel;
    const box = $("#confirm");
    box.classList.remove("hidden");
    const done = (v) => { box.classList.add("hidden"); box.onclick = null; resolve(v); };
    $("#confirm-ok").onclick = () => done(true);
    $("#confirm-cancel").onclick = () => done(false);
    box.onclick = (e) => { if (e.target === box) done(false); };
  });
}

/* ---------- Navegación ---------- */
const TITLES = { tasks: "Pendientes", books: "Resúmenes" };

function showTab(tab) {
  state.tab = tab;
  save(KEYS.tab, tab);
  $("#tab-tasks").classList.toggle("hidden", tab !== "tasks");
  $("#tab-books").classList.toggle("hidden", tab !== "books");
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#page-title").textContent = TITLES[tab];
  $("#open-filter").classList.toggle("hidden", tab !== "tasks");
  window.scrollTo(0, 0);
}

$$(".nav-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

/* ---------- Pendientes ---------- */
const PRIORITIES = [
  { key: "high", label: "Alta" },
  { key: "medium", label: "Media" },
  { key: "low", label: "Baja" },
];
const PRIO_RANK = { high: 0, medium: 1, low: 2 };

const pad = (n) => String(n).padStart(2, "0");
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const today = () => dateStr(new Date());

function dueLabel(due) {
  if (!due) return "";
  const t = new Date(today() + "T00:00:00");
  const diff = Math.round((new Date(due + "T00:00:00") - t) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return new Date(due + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short", year: diff < -300 || diff > 300 ? "numeric" : undefined });
}

function prioChipsHTML(selected, name) {
  return PRIORITIES.map((p) => `
    <button type="button" class="prio-chip ${p.key === selected ? "active" : ""}" data-prio="${p.key}"
            role="radio" aria-checked="${p.key === selected}" ${name ? `data-for="${name}"` : ""}>
      <span class="dot"></span>${p.label}
    </button>`).join("");
}

const NOTEBOOK_ICON = `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M6 3v18M10 8h5M10 12h5M10 16h3"/></svg>`;

function taskHTML(t) {
  if (state.editingTask === t.id) {
    return `
    <li class="task-item editing" data-id="${t.id}" data-prio="${t.priority}">
      <input class="field" data-edit="text" value="${esc(t.text)}" maxlength="200" aria-label="Texto de la tarea">
      <div class="flex flex-wrap items-center gap-2">
        <div class="prio-chips" role="radiogroup" data-edit="prio" data-value="${t.priority}">${prioChipsHTML(t.priority, "edit")}</div>
        <input type="date" class="field due-field" data-edit="due" value="${esc(t.due)}" aria-label="Fecha límite">
      </div>
      <div class="flex gap-2">
        <button data-action="cancel-task" class="btn-secondary flex-1">Cancelar</button>
        <button data-action="save-task" class="btn-primary flex-1">Guardar</button>
      </div>
    </li>`;
  }
  const overdue = t.due && !t.done && t.due < today();
  const hasNotes = (t.doc || []).some((b) => b.text.trim());
  const next = t.done ? null : Reminders.nextFires(t, Date.now(), 60, 1, deviceId())[0];
  const meta = [t.due ? `📅 ${dueLabel(t.due)}` : "", next ? `🔔 ${Reminders.fmtStamp(next.ms)}` : ""].filter(Boolean).join(" · ");
  return `
    <li class="task-item ${t.done ? "done" : ""}" data-id="${t.id}" data-prio="${t.priority}">
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Completada">
      <span class="dot" aria-label="Prioridad ${PRIORITIES.find((p) => p.key === t.priority)?.label ?? ""}"></span>
      <div class="task-main">
        <div class="task-text">${esc(t.text)}</div>
        ${meta ? `<div class="due-label ${overdue ? "overdue" : ""}">${meta}</div>` : ""}
      </div>
      <button class="icon-btn ${hasNotes ? "has-notes" : ""}" data-action="notes-task" aria-label="Notas de la tarea">${NOTEBOOK_ICON}</button>
      <button class="icon-btn" data-action="menu-task" aria-label="Más opciones" style="font-size:1.4rem;font-weight:700">⋮</button>
    </li>`;
}

function sortTasks(list) {
  return [...list].sort((a, b) =>
    (a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1
      : PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
}

function buildGroups(active) {
  const now = today();
  if (state.settings.groupBy === "priority") {
    return PRIORITIES.map((p) => ({ key: p.key, label: p.label, tasks: sortTasks(active.filter((t) => t.priority === p.key)) }));
  }
  return [
    { key: "overdue", label: "Vencidas", cls: "overdue", tasks: sortTasks(active.filter((t) => t.due && t.due < now)) },
    { key: "today", label: "Hoy", tasks: sortTasks(active.filter((t) => t.due === now)) },
    { key: "upcoming", label: "Próximas", tasks: sortTasks(active.filter((t) => t.due > now)) },
    { key: "nodate", label: "Sin fecha", tasks: sortTasks(active.filter((t) => !t.due)) },
  ];
}

function groupHTML(g, forceOpen) {
  const collapsed = !forceOpen && !!state.collapsed[g.key];
  return `
    <section class="group ${collapsed ? "collapsed" : ""}" data-group="${g.key}">
      <button class="group-head ${g.cls || ""}" data-action="toggle-group" aria-expanded="${!collapsed}">
        <span>${g.label}</span><span class="count">${g.tasks.length}</span><span class="chevron">▾</span>
      </button>
      ${collapsed ? "" : `<ul class="group-list">${g.tasks.map(taskHTML).join("")}</ul>${g.extra || ""}`}
    </section>`;
}

function renderTasks() {
  document.body.classList.toggle("style-border", state.settings.priorityStyle === "border");
  $$("#filters button").forEach((b) => b.classList.toggle("active", b.dataset.filter === state.filter));
  $("#filter-badge").classList.toggle("hidden", state.filter === "all");

  const active = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);
  const groups = [];

  if (state.filter !== "done") {
    groups.push(...buildGroups(active).filter((g) => g.tasks.length));
  }
  if (state.filter !== "pending" && done.length) {
    groups.push({
      key: "done", label: "Completadas", cls: "", tasks: done,
      extra: `<button class="clear-done" data-action="clear-done">Borrar completadas</button>`,
    });
  }

  $("#task-groups").innerHTML = groups.map((g) => groupHTML(g, g.key === "done" && state.filter === "done")).join("");
  $("#task-empty").classList.toggle("hidden", groups.length > 0);
  $("#task-counter").textContent = state.tasks.length
    ? `${active.length} pendiente${active.length === 1 ? "" : "s"} de ${state.tasks.length}` : "";
  $("#new-priority").innerHTML = prioChipsHTML(state.newPriority, "new");
  renderAttention();
}

/* Guardar = estampar cambios (para sincronizar) + persistir + programar subidas */
function commitTasks() {
  Sync.stampChanges("tasks", state.tasks, tracker, state.tombs, Date.now());
  save(KEYS.tasks, state.tasks);
  save(KEYS.tomb, state.tombs);
  schedulePushSync();
  scheduleSync();
}
function commitBooks() {
  Sync.stampChanges("books", state.books, tracker, state.tombs, Date.now());
  save(KEYS.books, state.books);
  save(KEYS.tomb, state.tombs);
  scheduleSync();
}
function persistTasks() { commitTasks(); renderTasks(); }

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#task-input");
  const text = input.value.trim();
  if (!text) return;
  state.tasks.unshift({
    id: uid(), text, done: false, priority: state.newPriority,
    due: $("#task-due").value, reminders: [],
  });
  input.value = "";
  $("#task-due").value = "";
  persistTasks();
  runReminders();
});

$("#new-priority").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-prio]");
  if (!chip) return;
  state.newPriority = chip.dataset.prio;
  $("#new-priority").innerHTML = prioChipsHTML(state.newPriority, "new");
});

/* Hojas emergentes: se cierran tocando el fondo */
function openSheet(id) { $(id).classList.remove("hidden"); }
function closeSheet(id) { $(id).classList.add("hidden"); }
["#filter-sheet", "#task-menu"].forEach((id) =>
  $(id).addEventListener("click", (e) => { if (e.target === $(id)) closeSheet(id); }));

$("#open-filter").addEventListener("click", () => openSheet("#filter-sheet"));
$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  save(KEYS.filter, state.filter);
  closeSheet("#filter-sheet");
  renderTasks();
});

$("#menu-edit").addEventListener("click", () => {
  state.editingTask = state.menuTask;
  closeSheet("#task-menu");
  renderTasks();
});
$("#menu-delete").addEventListener("click", () => {
  state.tasks = state.tasks.filter((t) => t.id !== state.menuTask);
  closeSheet("#task-menu");
  persistTasks();
});


$("#task-groups").addEventListener("click", (e) => {
  const chip = e.target.closest(".prio-chip[data-for='edit']");
  if (chip) {
    const box = chip.closest("[data-edit='prio']");
    box.dataset.value = chip.dataset.prio;
    box.innerHTML = prioChipsHTML(chip.dataset.prio, "edit");
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const li = btn.closest("li[data-id]");
  const task = li && state.tasks.find((t) => t.id === li.dataset.id);

  switch (btn.dataset.action) {
    case "toggle-group": {
      const key = btn.closest("[data-group]").dataset.group;
      state.collapsed[key] = !state.collapsed[key];
      save(KEYS.collapsed, state.collapsed);
      renderTasks();
      break;
    }
    case "clear-done": {
      const n = state.tasks.filter((t) => t.done).length;
      askConfirm(`¿Borrar ${n} tarea${n === 1 ? "" : "s"} completada${n === 1 ? "" : "s"}?`, "Borrar").then((ok) => {
        if (!ok) return;
        state.tasks = state.tasks.filter((t) => !t.done);
        persistTasks();
      });
      break;
    }
    case "menu-task":
      if (task) {
        state.menuTask = task.id;
        $("#task-menu-title").textContent = task.text;
        openSheet("#task-menu");
      }
      break;
    case "notes-task":
      if (task) openNotes(task);
      break;
    case "cancel-task":
      state.editingTask = null;
      renderTasks();
      scheduleSync(500);
      break;
    case "save-task": {
      if (!task) break;
      const text = li.querySelector("[data-edit='text']").value.trim();
      if (!text) break;
      const due = li.querySelector("[data-edit='due']").value;
          task.text = text;
      task.due = due;
      task.priority = li.querySelector("[data-edit='prio']").dataset.value;
      state.editingTask = null;
      persistTasks();
      runReminders();
      break;
    }
  }
});

$("#task-groups").addEventListener("change", (e) => {
  const li = e.target.closest("li[data-id]");
  const task = li && state.tasks.find((t) => t.id === li.dataset.id);
  if (!task || e.target.type !== "checkbox") return;
  task.done = e.target.checked;
  persistTasks();
});

/* ---------- Ajustes ---------- */
function renderSettings() {
  $("#app-version").textContent = `Versión ${APP_VERSION}`;
  $$(".seg[data-setting]").forEach((seg) => {
    const current = state.settings[seg.dataset.setting];
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === current));
  });
  $("#theme-switch").setAttribute("aria-checked", String(state.settings.theme === "dark"));
  $("#notify-switch").setAttribute("aria-checked", String(!!state.settings.notifyHere));

  const btn = $("#enable-notif");
  if (!("Notification" in window)) {
    btn.textContent = "Notificaciones no disponibles"; btn.disabled = true;
  } else if (Notification.permission === "granted") {
    btn.textContent = "🔔 Permiso de notificaciones concedido"; btn.disabled = true;
  } else if (Notification.permission === "denied") {
    btn.textContent = "Notificaciones bloqueadas en el navegador"; btn.disabled = true;
  } else {
    btn.textContent = "Permitir notificaciones"; btn.disabled = false;
  }

  const push = $("#push-switch");
  push.setAttribute("aria-checked", String(!!state.settings.pushOn));
  push.disabled = pushStatus.kind === "busy";
  const ps = $("#push-status");
  ps.textContent = pushStatus.text || (state.settings.pushOn ? "Activo" : serverUrl()
    ? "Apagado: los avisos solo suenan con la app abierta o al abrirla."
    : "Necesita tu servidor (abajo). Sin él, los avisos suenan con la app abierta o al abrirla.");
  ps.classList.toggle("rem-error", pushStatus.kind === "error");

  if (document.activeElement !== $("#server-url")) $("#server-url").value = state.settings.serverUrl || "";
  const adv = $("#server-adv");
  if (!APP.server) { adv.open = true; $("#sync-card").open = true; } // sin servidor de la app, esta es la única forma de conectarse
  $("#server-connect").textContent = state.settings.serverUrl ? "Guardar dirección" : "Conectar";
  $("#server-reset").classList.toggle("hidden", !(state.settings.serverUrl && APP.server));
  const ss = $("#server-status");
  ss.textContent = serverStatus.text || (state.settings.serverUrl ? "Usando tu servidor." : APP.server ? "Usando el servidor de la app." : "Sin servidor: todo funciona, pero solo en este dispositivo.");
  ss.classList.toggle("rem-error", serverStatus.kind === "error");
  renderSyncBody();
  renderWidgetBlock();
  $("#sync-badge").classList.toggle("hidden", !syncLinked());
}

$("#open-settings").addEventListener("click", () => { renderSettings(); $("#settings").classList.remove("hidden"); });
$("#open-sync").addEventListener("click", () => { // atajo desde la cabecera: abre Ajustes en la tarjeta de sincronización
  renderSettings();
  $("#sync-card").open = true;
  $("#settings").classList.remove("hidden");
  $("#sync-card").scrollIntoView({ block: "start" });
});
$("#close-settings").addEventListener("click", () => $("#settings").classList.add("hidden"));
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") e.currentTarget.classList.add("hidden"); });

$$(".seg[data-setting]").forEach((seg) => seg.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  state.settings[seg.dataset.setting] = b.dataset.value;
  save(KEYS.settings, state.settings);
  applyTheme();
  renderSettings();
  renderTasks();
}));

$("#enable-notif").addEventListener("click", async () => {
  try { await Notification.requestPermission(); } catch { /* navegador sin soporte */ }
  renderSettings();
  runReminders();
});

$("#theme-switch").addEventListener("click", () => {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  save(KEYS.settings, state.settings);
  applyTheme();
  renderSettings();
});

$("#notify-switch").addEventListener("click", async () => {
  state.settings.notifyHere = !state.settings.notifyHere;
  save(KEYS.settings, state.settings);
  if (state.settings.notifyHere && "Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* sin soporte */ }
  }
  schedulePushSync();
  renderSettings();
});

/* ---------- Recordatorios por tarea ---------- */
const PLAN_KINDS = [
  { kind: "once", label: "Fecha y hora" },
  { kind: "before", label: "Antes del vencimiento" },
  { kind: "daily", label: "Todos los días" },
  { kind: "weekly", label: "Cada semana" },
  { kind: "every", label: "Cada X horas" },
];
const WEEKDAY_CHIPS = [[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const pad2 = (n) => String(n).padStart(2, "0");
const toInputValue = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
/* Un recordatorio creado aquí empieza a contar desde su creación (no dispara lo anterior) */
function addReminder(task, rem) {
  task.reminders.push(rem);
  state.remState[rem.id] = { lastFired: rem.created, acked: true };
  save(KEYS.remstate, state.remState);
}
const remTask = () => state.tasks.find((t) => t.id === state.remTask);
const toMinutes = (hm) => { const [h, m] = (hm || "0:0").split(":").map(Number); return h * 60 + m; };

function defaultDraft(task, kind) {
  const d = { kind, time: "09:00", weekday: 1, days: 1, everyHours: 2, winFrom: "08:00", winTo: "20:00", error: "" };
  if (kind === "once") { // por defecto: 2 días antes del vencimiento a las 3 pm, o mañana a las 9 am
    let t = task.due ? Reminders.localMs(`${task.due}T15:00`) - 2 * Reminders.DAY : 0;
    if (t <= Date.now()) { const x = new Date(Date.now() + Reminders.DAY); x.setHours(9, 0, 0, 0); t = x.getTime(); }
    d.at = toInputValue(t);
  }
  return d;
}

function readDraftFields() {
  const d = state.remDraft;
  if (!d) return;
  const val = (id) => document.querySelector(id)?.value;
  if (val("#rem-at") !== undefined) d.at = val("#rem-at");
  if (val("#rem-time") !== undefined) d.time = val("#rem-time");
  if (val("#rem-days") !== undefined) d.days = Number(val("#rem-days"));
  if (val("#rem-every") !== undefined) d.everyHours = Number(val("#rem-every"));
  if (val("#rem-from") !== undefined) d.winFrom = val("#rem-from");
  if (val("#rem-to") !== undefined) d.winTo = val("#rem-to");
}

function draftFormHTML(task, d) {
  const chips = PLAN_KINDS.map((p) => {
    const off = p.kind === "before" && !task.due;
    return `<button type="button" class="plan-chip ${d.kind === p.kind ? "active" : ""}" data-action="rem-kind" data-kind="${p.kind}" ${off ? 'disabled title="La tarea no tiene fecha límite"' : ""}>${p.label}</button>`;
  }).join("");
  const timeField = `<label class="setting-label" for="rem-time">Hora</label><input id="rem-time" type="time" class="field" value="${d.time}">`;
  let fields = "";
  if (d.kind === "once") fields = `<label class="setting-label" for="rem-at">Cuándo</label><input id="rem-at" type="datetime-local" class="field" value="${d.at}">`;
  if (d.kind === "before") fields = `
    <label class="setting-label" for="rem-days">Avisar</label>
    <select id="rem-days" class="field">${[0, 1, 2, 3, 7].map((n) => `<option value="${n}" ${d.days === n ? "selected" : ""}>${n === 0 ? "El mismo día del vencimiento" : `${n} día${n === 1 ? "" : "s"} antes`}</option>`).join("")}</select>${timeField}`;
  if (d.kind === "daily") fields = timeField;
  if (d.kind === "weekly") fields = `
    <p class="setting-label">Día de la semana</p>
    <div class="day-chips">${WEEKDAY_CHIPS.map(([n, l]) => `<button type="button" class="day-chip ${d.weekday === n ? "active" : ""}" data-action="rem-day" data-day="${n}" aria-label="${Reminders.DAYS_ES[n]}">${l}</button>`).join("")}</div>${timeField}`;
  if (d.kind === "every") fields = `
    <label class="setting-label" for="rem-every">Repetir</label>
    <select id="rem-every" class="field">${[1, 2, 3, 4, 6, 8].map((n) => `<option value="${n}" ${d.everyHours === n ? "selected" : ""}>Cada ${n} hora${n === 1 ? "" : "s"}</option>`).join("")}</select>
    <div class="flex gap-2">
      <div class="flex-1"><label class="setting-label" for="rem-from">Desde</label><input id="rem-from" type="time" class="field" value="${d.winFrom}"></div>
      <div class="flex-1"><label class="setting-label" for="rem-to">Hasta</label><input id="rem-to" type="time" class="field" value="${d.winTo}"></div>
    </div>
    <p class="muted text-xs">Se repite dentro de ese horario hasta que completes la tarea.</p>`;
  return `
    <div class="rem-form">
      <div class="plan-chips">${chips}</div>
      <div class="rem-fields">${fields}</div>
      ${d.error ? `<p class="rem-error" role="alert">${esc(d.error)}</p>` : ""}
      <div class="flex gap-2">
        <button data-action="rem-cancel" class="btn-secondary flex-1 py-3">Cancelar</button>
        <button data-action="rem-save" class="btn-primary flex-1 py-3">Guardar</button>
      </div>
    </div>`;
}

function permissionNote() {
  if (!("Notification" in window)) return `<p class="muted mt-3 text-xs">Este navegador no permite notificaciones; verás los avisos dentro de la app.</p>`;
  if (Notification.permission === "denied") return `<p class="rem-error mt-3 text-xs">Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o de la app instalada para recibir avisos.</p>`;
  if (Notification.permission === "default") return `<p class="muted mt-3 text-xs">Al guardar te pediremos permiso para enviar notificaciones.</p>`;
  return "";
}

function renderReminderSheet() {
  const task = remTask();
  if (!task) return;
  $("#rem-title").textContent = task.text;
  const rows = task.reminders.filter((r) => !r.onlyDevice || r.onlyDevice === deviceId()).map((rem) => {
    const nx = Reminders.nextFires({ ...task, done: false, reminders: [rem] }, Date.now(), 60, 1, deviceId())[0];
    return `
      <div class="rem-row">
        <div class="min-w-0"><b>${esc(Reminders.describe(rem))}</b><small>${nx ? `Próximo: ${Reminders.fmtStamp(nx.ms)}` : "Sin próximos avisos"}</small></div>
        <button class="icon-btn danger" data-action="rem-del" data-id="${rem.id}" aria-label="Quitar recordatorio">✕</button>
      </div>`;
  }).join("");
  const d = state.remDraft;
  $("#rem-body").innerHTML =
    (rows || `<p class="muted text-sm">Esta tarea aún no tiene recordatorios.</p>`) +
    (d ? draftFormHTML(task, d) : `<button class="btn-secondary mt-3 w-full py-3" data-action="rem-add">+ Añadir recordatorio</button>`) +
    permissionNote();
}

function closeReminders() {
  state.remDraft = null;
  state.remTask = null;
  closeSheet("#reminder-sheet");
}

async function saveDraft() {
  readDraftFields();
  const d = state.remDraft, task = remTask();
  if (!d || !task) return;
  const fail = (msg) => { d.error = msg; renderReminderSheet(); };
  const rem = { id: uid(), kind: d.kind, created: Date.now() };
  if (d.kind !== "once" && d.kind !== "every" && !d.time) return fail("Elige una hora.");
  if (d.kind === "once") {
    if (!d.at) return fail("Elige fecha y hora.");
    if (Reminders.localMs(d.at) <= Date.now()) return fail("Esa fecha y hora ya pasó. Elige una futura.");
    rem.at = d.at;
  } else if (d.kind === "before") {
    Object.assign(rem, { days: d.days, time: d.time });
    if (!Reminders.occurrences(rem, task, Date.now(), Date.now() + 400 * Reminders.DAY).length) {
      return fail("Ese aviso ya quedó en el pasado. Prueba con menos días de anticipación.");
    }
  } else if (d.kind === "daily") rem.time = d.time;
  else if (d.kind === "weekly") Object.assign(rem, { weekday: d.weekday, time: d.time });
  else if (d.kind === "every") {
    if (!d.winFrom || !d.winTo || toMinutes(d.winFrom) >= toMinutes(d.winTo)) return fail("La hora final debe ser después de la inicial.");
    Object.assign(rem, { everyHours: d.everyHours, winFrom: d.winFrom, winTo: d.winTo });
  }
  // el permiso se pide dentro del toque del usuario
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* sin soporte */ }
  }
  addReminder(task, rem);
  state.remDraft = null;
  persistTasks();
  renderReminderSheet();
  renderSettings();
  runReminders();
}

$("#menu-remind").addEventListener("click", () => {
  state.remTask = state.menuTask;
  state.remDraft = null;
  closeSheet("#task-menu");
  renderReminderSheet();
  openSheet("#reminder-sheet");
});
$("#rem-close").addEventListener("click", closeReminders);
$("#reminder-sheet").addEventListener("click", (e) => {
  if (e.target.id === "reminder-sheet") return closeReminders();
  const btn = e.target.closest("[data-action]");
  const task = remTask();
  if (!btn || !task) return;
  switch (btn.dataset.action) {
    case "rem-add": state.remDraft = defaultDraft(task, "once"); renderReminderSheet(); break;
    case "rem-kind":
      if (state.remDraft.kind !== btn.dataset.kind) state.remDraft = defaultDraft(task, btn.dataset.kind);
      renderReminderSheet();
      break;
    case "rem-day": readDraftFields(); state.remDraft.weekday = Number(btn.dataset.day); renderReminderSheet(); break;
    case "rem-cancel": state.remDraft = null; renderReminderSheet(); break;
    case "rem-save": saveDraft(); break;
    case "rem-del":
      task.reminders = task.reminders.filter((r) => r.id !== btn.dataset.id);
      persistTasks();
      renderReminderSheet();
      break;
  }
});

/* Avisos por atender: recordatorios que ya sonaron (o se perdieron con la app cerrada), una fila por tarea */
const pendingOf = (task) => task.reminders.filter((r) => { const st = state.remState[r.id]; return st && st.lastFired && !st.acked; });

function renderAttention() {
  const items = state.tasks
    .filter((t) => !t.done && pendingOf(t).length)
    .map((task) => ({ task, last: Math.max(...pendingOf(task).map((r) => state.remState[r.id].lastFired)) }))
    .sort((a, b) => b.last - a.last);
  const box = $("#attention");
  box.classList.toggle("hidden", !items.length);
  box.innerHTML = items.map(({ task, last }) => `
    <div class="att-row" data-task="${task.id}">
      <div class="min-w-0"><b>🔔 ${esc(task.text)}</b><small>Sonó ${Reminders.fmtStamp(last)}</small></div>
      <div class="att-actions">
        <button data-action="att-snooze" data-min="10">10 min</button>
        <button data-action="att-snooze" data-min="60">1 h</button>
        <button data-action="att-tomorrow">Mañana</button>
        <button data-action="att-ok">Listo</button>
      </div>
    </div>`).join("");
}

function acknowledge(task) {
  const pending = pendingOf(task);
  pending.forEach((r) => { state.remState[r.id].acked = true; });
  task.reminders = task.reminders.filter((r) => !(pending.includes(r) && r.kind === "once"));
  save(KEYS.remstate, state.remState);
}

$("#attention").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  const row = btn && btn.closest("[data-task]");
  const task = row && state.tasks.find((t) => t.id === row.dataset.task);
  if (!task) return;
  const action = btn.dataset.action;
  acknowledge(task);
  if (action === "att-snooze" || action === "att-tomorrow") {
    let at;
    if (action === "att-tomorrow") { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); at = d.getTime(); }
    else at = Math.ceil((Date.now() + Number(btn.dataset.min) * 60000) / 60000) * 60000;
    addReminder(task, { id: uid(), kind: "once", atMs: at, created: Date.now(), auto: true, onlyDevice: deviceId() }); // solo suena en este dispositivo
  }
  persistTasks();
});

/* Planificador local: dispara lo que ya tocaba (la app abierta, en segundo plano reciente o al abrirla) */
async function showNotice(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, opts);
  } catch { /* sin service worker: usar la API directa */ }
  try { new Notification(title, opts); } catch { /* algunos móviles exigen service worker */ }
}

function runReminders() {
  const now = Date.now();
  const dev = deviceId();
  let changed = false;
  state.tasks.forEach((task) => {
    task.reminders.forEach((rem) => { // visto por primera vez aquí (p. ej. llegó por sincronización): empieza desde ahora
      if (!state.remState[rem.id]) { state.remState[rem.id] = { lastFired: now, acked: true }; changed = true; }
    });
    Reminders.dueFires(task, now, state.remState, dev).forEach(({ rem, ms }) => {
      const st = state.remState[rem.id];
      st.lastFired = ms;
      st.acked = !state.settings.notifyHere; // sin avisos en este dispositivo: se descartan en silencio
      changed = true;
      if (state.settings.notifyHere && now - ms <= 3 * 60000) { // si se perdió hace rato, solo queda en "avisos por atender"
        showNotice(task.text, task.due ? `Vence ${dueLabel(task.due)}` : "Recordatorio", `r-${rem.id}-${ms}`);
      }
    });
  });
  if (changed) {
    const live = new Set(state.tasks.flatMap((t) => t.reminders.map((r) => r.id)));
    Object.keys(state.remState).forEach((id) => { if (!live.has(id)) delete state.remState[id]; });
    save(KEYS.remstate, state.remState);
    renderTasks();
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { runReminders(); schedulePushSync(); scheduleSync(300); } });

/* ---------- Avisos con la app cerrada (servidor de avisos / push) ---------- */
/* La app le manda al servidor los próximos avisos; el servidor los entrega a la hora exacta aunque
   la app esté cerrada. Ver worker/README.md. Sin servidor configurado todo sigue funcionando en local. */
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64uToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
let pushStatus = { kind: "idle", text: "" };
let pushTimer = null;

/* Clave por dispositivo para cifrar el texto de los avisos que pasan por el servidor.
   Se guarda también en IndexedDB para que el service worker pueda descifrarlos con la app cerrada. */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("prod-keys", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
async function pushCryptoKey() {
  if (!state.settings.pushKey) {
    state.settings.pushKey = Sync.b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
    save(KEYS.settings, state.settings);
  }
  const raw = Sync.b64u.dec(state.settings.pushKey);
  await idbPut("pushKey", raw);
  return Sync.importRawKey(raw);
}

function deviceId() {
  if (!state.settings.deviceId) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    state.settings.deviceId = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
    save(KEYS.settings, state.settings);
  }
  return state.settings.deviceId;
}

function setPushStatus(kind, text) { pushStatus = { kind, text }; renderSettings(); }

async function pushGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
  return res.json();
}

async function enablePush() {
  const url = serverUrl();
  if (!url) return setPushStatus("error", "No hay servidor configurado. Conecta uno en «Servidor propio (avanzado)».");
  if (!pushSupported()) return setPushStatus("error", "Este navegador no admite avisos con la app cerrada. Instala la app desde su dirección web.");
  setPushStatus("busy", "Conectando…");
  try {
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") throw new Error("Falta el permiso de notificaciones. Actívalo en los ajustes del navegador.");
    const { publicKey } = await pushGet(`${url}/vapid`);
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && state.settings.vapidKey !== publicKey) { await sub.unsubscribe(); sub = null; } // servidor nuevo: otra clave
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
    await pushCryptoKey();
    Object.assign(state.settings, { pushOn: true, vapidKey: publicKey });
    save(KEYS.settings, state.settings);
    await syncPush();
  } catch (err) {
    const msg = err && err.name === "TypeError" ? "No pude conectar con esa dirección. Revisa que sea correcta." : (err && err.message) || "Error desconocido";
    setPushStatus("error", msg);
  }
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (serverUrl()) {
      await fetch(`${serverUrl()}/unsync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device: deviceId() }) }).catch(() => {});
    }
  } catch { /* ya estaba desactivado */ }
  state.settings.pushOn = false;
  save(KEYS.settings, state.settings);
  setPushStatus("idle", "");
}

function schedulePushSync() {
  if (!state.settings.pushOn) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 1500);
}

async function syncPush() {
  const { pushOn } = state.settings;
  const server = serverUrl();
  if (!pushOn || !server) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) throw new Error("La suscripción se perdió. Desactiva y vuelve a activar los avisos.");
    const now = Date.now();
    const items = [];
    const pk = await pushCryptoKey();
    for (const task of (state.settings.notifyHere ? state.tasks : [])) {
      for (const { ms, remId } of Reminders.nextFires(task, now, 14, 100, deviceId())) {
        const tag = `r-${remId}-${ms}`;
        const text = JSON.stringify({ t: task.text.slice(0, 120), b: task.due ? `Vence ${dueLabel(task.due)}` : "Recordatorio" });
        items.push({ id: `${remId}:${ms}`, fireAt: ms, title: await Sync.encryptText(pk, text, tag), body: "", tag }); // el servidor no puede leer el texto
      }
    }
    items.sort((a, b) => a.fireAt - b.fireAt);
    items.length = Math.min(items.length, 300);
    const res = await fetch(`${server}/sync`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: deviceId(), subscription: sub.toJSON(), items }),
    });
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
    setPushStatus("ok", `Activo · ${items.length} aviso${items.length === 1 ? "" : "s"} programado${items.length === 1 ? "" : "s"} · sincronizado ${new Date(now).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" })}`);
  } catch (err) {
    setPushStatus("error", (err && err.name === "TypeError") ? "Sin conexión con el servidor; se reintentará al abrir la app." : err.message);
  }
}

$("#push-switch").addEventListener("click", () => (state.settings.pushOn ? disablePush() : enablePush()));

/* ---------- Servidor y sincronización entre dispositivos ---------- */
let serverStatus = { kind: "idle", text: "" };
let syncInfo = { kind: "idle", text: "", at: 0 };
let syncTimer = null, syncing = false, qrOpen = false;

const syncLinked = () => !!(serverUrl() && state.sync.space);
const saveSync = () => save(KEYS.sync, state.sync);

async function connectServer() {
  const url = $("#server-url").value.trim().replace(/\/+$/, "");
  const fail = (text) => { serverStatus = { kind: "error", text }; renderSettings(); };
  if (!/^https:\/\/[^/]+/.test(url)) return fail("Escribe la dirección completa, empezando con https://");
  serverStatus = { kind: "busy", text: "Conectando…" };
  renderSettings();
  try {
    const res = await fetch(`${url}/`);
    const txt = await res.text();
    if (!res.ok || !txt.includes("funcionando")) return fail("Esa dirección no responde como tu servidor de avisos.");
    if (state.settings.serverUrl !== url) { // servidor distinto: hay que volver a subir todo
      state.settings.serverUrl = url;
      Object.assign(state.sync, { lastSeq: 0, lastPushAt: 0 });
      saveSync();
      save(KEYS.settings, state.settings);
    }
    serverStatus = { kind: "ok", text: "Conectado ✓" };
    renderSettings();
    scheduleSync(0);
  } catch (err) {
    fail(err && err.name === "TypeError" ? "No pude conectar. Revisa que la dirección sea correcta." : (err && err.message) || "Error desconocido");
  }
}
$("#server-connect").addEventListener("click", connectServer);
$("#server-reset").addEventListener("click", () => {
  delete state.settings.serverUrl;
  Object.assign(state.sync, { lastSeq: 0, lastPushAt: 0 });
  saveSync();
  save(KEYS.settings, state.settings);
  serverStatus = { kind: "idle", text: "" };
  renderSettings();
  scheduleSync(0);
});

function agoText(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  return m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`;
}

function qrSvg() {
  const url = `${location.origin}${location.pathname}#sync=${state.sync.code}&server=${encodeURIComponent(serverUrl())}`;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function renderSyncBody() {
  const box = $("#sync-body");
  const typed = $("#sync-code-in") ? $("#sync-code-in").value : "";
  if (!serverUrl()) {
    box.innerHTML = `<p class="muted text-xs">No hay servidor configurado. Conecta uno en «Servidor propio (avanzado)», más abajo. Sin servidor, tus datos solo viven en este dispositivo.</p>`;
    return;
  }
  if (!state.sync.space) {
    box.innerHTML = `
      <div class="sync-actions">
        <button class="btn-primary py-3" data-action="sync-create">Crear código nuevo</button>
        <p class="muted text-xs">Si ya creaste uno en tu otro dispositivo, escríbelo aquí:</p>
        <input id="sync-code-in" class="field" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="Código de sincronización" value="${esc(typed)}">
        <button class="btn-secondary py-3" data-action="sync-join">Unirme con este código</button>
        ${syncInfo.kind === "error" ? `<p class="rem-error text-xs" role="alert">${esc(syncInfo.text)}</p>` : ""}
      </div>`;
    return;
  }
  const status = syncInfo.kind === "busy" ? "Sincronizando…"
    : syncInfo.kind === "ok" ? `Sincronizado ${agoText(syncInfo.at)} · ${state.tasks.length} tarea${state.tasks.length === 1 ? "" : "s"} · ${state.books.filter((b) => !b.isNew).length} resumen${state.books.length === 1 ? "" : "es"}`
      : syncInfo.text;
  box.innerHTML = `
    <div class="sync-actions">
      <div class="code-box" aria-label="Tu código de sincronización">${Sync.formatCode(state.sync.code)}</div>
      <div class="sync-row">
        <button class="btn-secondary py-3" data-action="sync-copy">Copiar</button>
        <button class="btn-secondary py-3" data-action="sync-qr">${qrOpen ? "Ocultar QR" : "Mostrar QR"}</button>
      </div>
      ${qrOpen ? `<div class="qr-box">${qrSvg()}<p class="muted text-xs">Escanéalo con la cámara de tu otro dispositivo.</p></div>` : ""}
      <p class="text-xs ${syncInfo.kind === "error" ? "rem-error" : "muted"}" role="status">${esc(status)}</p>
      <div class="sync-row">
        <button class="btn-secondary py-3" data-action="sync-now">Sincronizar ahora</button>
        <button class="btn-danger-soft py-3" data-action="sync-unlink">Desvincular</button>
      </div>
      <button class="link-btn" data-action="sync-erase">Borrar mis datos del servidor</button>
    </div>`;
}

async function joinSpace(code) {
  state.sync = { code, space: await Sync.spaceId(code), lastSeq: 0, lastPushAt: 0, v: 2 };
  syncKeyPromise = null;
  saveSync();
  qrOpen = false;
  syncInfo = { kind: "busy", text: "", at: 0 };
  renderSettings();
  await syncNow();
}

$("#sync-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  switch (btn.dataset.action) {
    case "sync-create":
      await joinSpace(Sync.makeCode(crypto.getRandomValues(new Uint8Array(20))));
      break;
    case "sync-join": {
      const code = Sync.normalizeCode($("#sync-code-in").value);
      if (!Sync.isValidCode(code)) { syncInfo = { kind: "error", text: "El código debe tener 20 letras y números (por ejemplo K7QM-2XPD-9RVA-4HNT-B3WE).", at: 0 }; renderSettings(); break; }
      await joinSpace(code);
      break;
    }
    case "sync-copy":
      try { await navigator.clipboard.writeText(Sync.formatCode(state.sync.code)); btn.textContent = "Copiado ✓"; }
      catch { btn.textContent = "Selecciona y copia el código"; }
      setTimeout(() => { btn.textContent = "Copiar"; }, 1800);
      break;
    case "sync-qr": qrOpen = !qrOpen; renderSettings(); break;
    case "sync-now": syncNow(); break;
    case "sync-erase":
      if (await askConfirm("¿Borrar tus datos del servidor? Se quedan en este dispositivo, pero los demás dispositivos con este código dejarán de recibir cambios.", "Borrar")) {
        try {
          const res = await fetch(`${serverUrl()}/space/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: state.sync.space }) });
          if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
          state.sync = { code: "", space: "", lastSeq: 0, lastPushAt: 0 };
          syncKeyPromise = null;
          saveSync();
          syncInfo = { kind: "idle", text: "", at: 0 };
          qrOpen = false;
        } catch (err) {
          syncInfo = { kind: "error", at: 0, text: err && err.name === "TypeError" ? "Sin conexión: no se pudo borrar. Inténtalo de nuevo." : err.message };
        }
        renderSettings();
      }
      break;
    case "sync-unlink":
      if (await askConfirm("¿Desvincular este dispositivo? Tus datos se quedan aquí, pero dejan de sincronizarse.", "Desvincular")) {
        state.sync = { code: "", space: "", lastSeq: 0, lastPushAt: 0 };
        syncKeyPromise = null;
        saveSync();
        syncInfo = { kind: "idle", text: "", at: 0 };
        qrOpen = false;
        renderSettings();
      }
      break;
  }
});

/* ---------- Widget de Android: un toque conecta el widget con tus datos ---------- */
const isAndroid = /Android/i.test(navigator.userAgent);

function widgetLink() {
  const q = new URLSearchParams({ code: state.sync.code, server: serverUrl(), app: location.origin + location.pathname });
  const fallback = encodeURIComponent(APP.widgetDownload || "");
  return `intent://link?${q.toString()}#Intent;scheme=${APP.widgetScheme || "pendientes"};package=${APP.widgetPackage || "app.productividad.widget"};S.browser_fallback_url=${fallback};end`;
}

function renderWidgetBlock() {
  const box = $("#widget-block");
  if (!isAndroid) {
    box.innerHTML = `<p class="muted text-xs">El widget de pantalla de inicio es solo para Android. Abre esta app desde tu celular Android para conectarlo.</p>`;
  } else if (!syncLinked()) {
    box.innerHTML = `<p class="muted text-xs">El widget lee tus tareas desde tu código de sincronización. Primero crea tu código (arriba) y vuelve aquí.</p>`;
  } else {
    box.innerHTML = `
      <p class="muted text-xs">Muestra tus tareas pendientes con su prioridad en la pantalla de inicio. Al tocar una, se abre aquí.</p>
      <a class="btn-primary block py-3 text-center" id="widget-connect" href="${esc(widgetLink())}">Conectar el widget</a>
      <ol class="steps">
        <li>Toca «Conectar el widget». Si aún no lo tienes, se descarga solo.</li>
        <li>Al terminar, toca <b>Abrir</b> y luego <b>Instalar</b> (si Android lo pide, permite instalar desde este navegador).</li>
        <li>Vuelve aquí y toca «Conectar el widget» otra vez. Después, mantén pulsada la pantalla de inicio → Widgets → Pendientes.</li>
      </ol>
      <p class="muted text-xs">¿Ya lo tienes instalado? «Conectar el widget» no lo vuelve a descargar. Para tener la versión nueva (tamaños desde 2x2):</p>
      <a class="btn-secondary block py-3 text-center" id="widget-update" href="${esc(APP.widgetDownload || "#")}" download="pendientes-widget.apk">Descargar la versión nueva del widget</a>
      <ol class="steps">
        <li>Ábrelo cuando termine y toca <b>Instalar</b> (se instala encima, sin borrar nada).</li>
        <li>Quita de la pantalla de inicio el widget que ya tenías (mantenlo pulsado → Quitar) y añádelo otra vez desde Widgets → Pendientes. Así Android toma los tamaños nuevos.</li>
        <li>Mantenlo pulsado y arrastra los bordes para achicarlo (2x2) o agrandarlo.</li>
      </ol>`;
  }
}

/* Ids que se están editando ahora mismo: no se pisan con datos que llegan */
const busyIds = () => new Set([...state.editing, ...state.drafts.keys(), state.editingTask, state.notesTask].filter(Boolean));

function scheduleSync(delay = 2000) {
  if (!syncLinked()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, delay);
}

let syncKeyPromise = null;
const getSyncKey = () => (syncKeyPromise ||= Sync.deriveKey(state.sync.code));

const SYNC_ERRORS = {
  413: "Tus datos superan el límite gratuito por código.",
  429: "El servidor está ocupado; se reintentará en un momento.",
  503: "El servicio está lleno por ahora; tus datos siguen a salvo en este dispositivo.",
};

async function syncNow() {
  if (!syncLinked()) return;
  if (syncing) return scheduleSync(1500);
  syncing = true;
  const t0 = Date.now();
  const server = serverUrl();
  try {
    commitTasksQuiet();
    const key = await getSyncKey();
    if (state.sync.v !== 2) { // datos subidos sin cifrar por versiones anteriores: bajar todo y volver a subirlo cifrado
      Object.assign(state.sync, { lastSeq: 0, lastPushAt: 0, v: 2 });
    }
    const pending = Sync.collectPush(state.tasks, state.books, state.tombs, state.sync.lastPushAt);
    let since = state.sync.lastSeq, deferred = 0, changed = false, more = false;
    do {
      const chunk = await Promise.all(pending.splice(0, 100).map(async (r) => (
        r.deleted ? r : { ...r, data: await Sync.encryptText(key, r.data, `${r.id}|${r.col}`) })));
      const res = await fetch(`${server}/space/sync`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space: state.sync.space, since, records: chunk }),
      });
      if (!res.ok) throw new Error(SYNC_ERRORS[res.status] || `El servidor respondió ${res.status}`);
      const data = await res.json();
      // descifrar lo que llega; lo que no se pueda descifrar (otra clave o alterado) se ignora
      const incoming = [];
      for (const r of data.records) {
        if (r.deleted) { incoming.push(r); continue; }
        const plain = await Sync.decryptText(key, r.data, `${r.id}|${r.col}`);
        if (plain !== null) incoming.push({ ...r, data: plain });
      }
      data.records = incoming;
      const busy = busyIds();
      const rt = Sync.mergeIncoming("tasks", state.tasks, data.records, tracker, state.tombs, busy);
      const rb = Sync.mergeIncoming("books", state.books, data.records, tracker, state.tombs, busy);
      deferred += rt.deferred.length + rb.deferred.length;
      changed = changed || rt.changed || rb.changed;
      since = data.seq;
      more = data.more;
    } while (pending.length || more);
    if (!deferred) state.sync.lastSeq = since; // si algo quedó en espera, se vuelve a pedir después
    state.sync.lastPushAt = t0;
    state.tombs = Sync.purgeTombs(state.tombs, Date.now(), 60);
    saveSync();
    save(KEYS.tasks, state.tasks);
    save(KEYS.books, state.books);
    save(KEYS.tomb, state.tombs);
    syncInfo = { kind: "ok", text: "", at: Date.now() };
    if (changed) {
      if (pendingFocus && focusTask(pendingFocus)) pendingFocus = null;
      runReminders();
      if (state.editingTask === null) renderTasks();
      if (state.editing.size) renderBookList(); else renderBooks();
      schedulePushSync();
    }
  } catch (err) {
    syncInfo = { kind: "error", at: 0, text: err && err.name === "TypeError" ? "Sin conexión con el servidor; se reintentará." : err.message };
  } finally {
    syncing = false;
    renderSettings();
  }
}

/* Estampa y guarda sin programar otra sincronización */
function commitTasksQuiet() {
  const now = Date.now();
  Sync.stampChanges("tasks", state.tasks, tracker, state.tombs, now);
  Sync.stampChanges("books", state.books, tracker, state.tombs, now);
}

/* Enlace directo a una tarea: #task=ID (lo usa el widget de Android) */
let pendingFocus = null;

function focusTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return false;
  if (state.openBook) closeBook();
  if (state.notesTask) closeNotes();
  showTab("tasks");
  if (state.filter !== "all") { state.filter = "all"; save(KEYS.filter, state.filter); }
  // abrir la sección plegada que contiene la tarea
  const group = task.done ? "done" : buildGroups(state.tasks.filter((t) => !t.done)).find((g) => g.tasks.includes(task));
  const key = task.done ? "done" : group && group.key;
  if (key && state.collapsed[key]) { state.collapsed[key] = false; save(KEYS.collapsed, state.collapsed); }
  renderTasks();
  const el = document.querySelector(`li[data-id="${CSS.escape(id)}"]`);
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 2400);
  }
  return true;
}

function handleTaskHash() {
  if (!location.hash.startsWith("#task=")) return;
  const id = decodeURIComponent(location.hash.slice(6)).trim();
  history.replaceState(null, "", location.pathname + location.search);
  if (!id || focusTask(id)) return;
  pendingFocus = id; // quizá aún no llegó por sincronización
  setTimeout(() => { pendingFocus = null; }, 15000);
}

/* Enlace de vinculación (el QR): https://…/#sync=CODIGO&server=URL */
function handleLinkHash() {
  if (!location.hash.startsWith("#sync=")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const code = Sync.normalizeCode(params.get("sync"));
  const server = (params.get("server") || "").replace(/\/+$/, "");
  history.replaceState(null, "", location.pathname + location.search); // el código no se queda en la barra de direcciones
  if (!Sync.isValidCode(code) || !/^https:\/\/[^/]+/.test(server) || state.sync.code === code) return;
  askConfirm(`¿Unir este dispositivo al código ${Sync.formatCode(code)}? Tus tareas y resúmenes de aquí se sumarán a los del otro dispositivo.`, "Unir").then(async (ok) => {
    if (!ok) return;
    if (serverUrl() !== server) { state.settings.serverUrl = server; save(KEYS.settings, state.settings); } // solo si es otro servidor
    renderSettings();
    $("#sync-card").open = true;
    $("#settings").classList.remove("hidden");
    await joinSpace(code);
  });
}

/* ---------- Editor libre (estilo Notion) ---------- */
/* Un documento es una lista de bloques {id, type, text}. Lo que es título, subtítulo, lista o cita
   se decide con el comando "/" mientras escribes. */
const BLOCK_TYPES = [
  { type: "h1", label: "Título", hint: "Sección grande", icon: "T", keys: "titulo encabezado h1" },
  { type: "h2", label: "Subtítulo", hint: "Sección mediana", icon: "t", keys: "subtitulo h2" },
  { type: "p", label: "Texto", hint: "Párrafo normal", icon: "¶", keys: "texto parrafo normal" },
  { type: "ul", label: "Lista", hint: "Con viñetas", icon: "•", keys: "lista vineta bullet" },
  { type: "quote", label: "Cita", hint: "Frase destacada", icon: "”", keys: "cita quote" },
];
const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function makeBlock(b) {
  const el = document.createElement("div");
  el.className = "blk";
  el.dataset.type = b.type || "p";
  el.dataset.id = b.id || uid();
  if (b.text) el.textContent = b.text;
  return el;
}

function blockText(el) {
  let t = "";
  el.childNodes.forEach((n) => { if (n.nodeType === 3) t += n.nodeValue; else if (n.nodeName !== "BR") t += n.textContent; });
  return t;
}

function readDoc(root) {
  return [...root.children].map((el) => ({
    id: el.dataset.id || (el.dataset.id = uid()),
    type: el.dataset.type || "p",
    text: blockText(el),
  }));
}
function trimDoc(doc) {
  const out = [...doc];
  while (out.length && !out[out.length - 1].text.trim()) out.pop();
  return out;
}

function docViewHTML(doc) {
  return `<div class="doc">${doc.filter((b) => b.text.trim()).map((b) =>
    `<div class="blk" data-type="${b.type}" data-id="${esc(b.id)}">${esc(b.text)}</div>`).join("")}</div>`;
}

function currentBlock(root) {
  const sel = getSelection();
  if (!sel.rangeCount || !root.contains(sel.anchorNode)) return null;
  let n = sel.anchorNode;
  if (n === root) return root.children[Math.min(sel.anchorOffset, root.children.length - 1)] || null;
  while (n && n.parentNode !== root) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}

function caretOffset(blk) {
  const sel = getSelection();
  if (!sel.rangeCount) return 0;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(blk);
  pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}

function setCaret(blk, offset) {
  const range = document.createRange();
  let left = offset, placed = false;
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (placed) return;
      if (c.nodeType === 3) {
        if (left <= c.length) { range.setStart(c, left); placed = true; return; }
        left -= c.length;
      } else walk(c);
    }
  };
  walk(blk);
  if (!placed) range.setStart(blk, blk.childNodes.length);
  range.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function normalizeRoot(root) {
  [...root.childNodes].forEach((n) => {
    const isBlk = n.nodeType === 1 && n.classList.contains("blk");
    if (!isBlk) {
      const el = makeBlock({ type: "p", text: n.textContent });
      root.replaceChild(el, n);
      setCaret(el, el.textContent.length);
      return;
    }
    if (n.innerHTML === "<br>") n.innerHTML = "";
    else if (n.children.length) { // el navegador metió etiquetas: aplanar conservando el cursor
      const inside = root.contains(getSelection().anchorNode) && n.contains(getSelection().anchorNode);
      const off = inside ? caretOffset(n) : 0;
      n.textContent = blockText(n);
      if (inside) setCaret(n, off);
    }
  });
  if (!root.firstChild) root.appendChild(makeBlock({ type: "p" }));
}

function refreshEmpty(root) {
  root.classList.toggle("is-empty", root.children.length <= 1 && !blockText(root.firstElementChild || root).trim());
}

/* Menú "/" */
const slash = { open: false, root: null, blk: null, start: 0, q: "", items: [], index: 0 };

function closeSlash() {
  slash.open = false;
  $("#slash-menu").classList.add("hidden");
}

function checkSlash(root) {
  const blk = currentBlock(root);
  const sel = getSelection();
  if (!blk || !sel.isCollapsed) return closeSlash();
  const off = caretOffset(blk);
  const m = /(^|\s)\/([^\s/]{0,20})$/.exec(blockText(blk).slice(0, off));
  if (!m) return closeSlash();
  const q = norm(m[2]);
  const starts = (b) => (norm(b.label).startsWith(q) ? 0 : 1);
  const items = BLOCK_TYPES.filter((b) => !q || norm(b.label + " " + b.keys).includes(q)).sort((a, b) => starts(a) - starts(b));
  if (!items.length) return closeSlash();

  if (!slash.open || slash.q !== q) slash.index = 0;
  Object.assign(slash, { open: true, root, blk, start: off - m[2].length - 1, q, items });
  slash.index = Math.min(slash.index, items.length - 1);

  const menu = $("#slash-menu");
  menu.innerHTML = items.map((it, i) => `
    <button type="button" data-i="${i}" class="slash-item ${i === slash.index ? "active" : ""}" role="option">
      <span class="slash-icon">${it.icon}</span>
      <span><b>${it.label}</b><small>${it.hint}</small></span>
    </button>`).join("");
  menu.classList.remove("hidden");

  let rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.height) rect = blk.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv ? vv.offsetTop : 0, viewBottom = viewTop + (vv ? vv.height : innerHeight);
  const h = menu.offsetHeight, w = menu.offsetWidth;
  let top = rect.bottom + 6;
  if (top + h > viewBottom - 8) top = Math.max(viewTop + 8, rect.top - h - 6);
  menu.style.top = `${top}px`;
  menu.style.left = `${Math.min(Math.max(12, rect.left), innerWidth - w - 12)}px`;
}

function applySlash(i) {
  const { root, blk, start, items } = slash;
  const item = items[i];
  if (!item || !blk.isConnected) return closeSlash();
  const text = blockText(blk), off = caretOffset(blk);
  blk.textContent = text.slice(0, start) + text.slice(off);
  blk.dataset.type = item.type;
  closeSlash();
  root.focus();
  setCaret(blk, start);
  root.dispatchEvent(new Event("input", { bubbles: true }));
}

$("#slash-menu").addEventListener("pointerdown", (e) => {
  e.preventDefault(); // no perder el foco del editor
  const btn = e.target.closest("[data-i]");
  if (btn) applySlash(Number(btn.dataset.i));
});
document.addEventListener("selectionchange", () => { if (slash.open) checkSlash(slash.root); });

function splitBlock(root, blk) {
  const sel = getSelection();
  if (!sel.isCollapsed) { sel.deleteFromDocument(); normalizeRoot(root); blk = currentBlock(root) || blk; }
  const text = blockText(blk), off = caretOffset(blk), type = blk.dataset.type;
  if (type === "ul" && !text) { blk.dataset.type = "p"; setCaret(blk, 0); return; }
  if (off === 0 && text) { blk.before(makeBlock({ type: type === "ul" ? "ul" : "p" })); setCaret(blk, 0); return; }
  blk.textContent = text.slice(0, off);
  const nb = makeBlock({ type: type === "ul" ? "ul" : "p", text: text.slice(off) });
  blk.after(nb);
  setCaret(nb, 0);
  nb.scrollIntoView({ block: "nearest" });
}

function backspaceAtStart(blk) {
  if (blk.dataset.type !== "p") { blk.dataset.type = "p"; return; }
  const prev = blk.previousElementSibling;
  if (!prev) return;
  const len = blockText(prev).length;
  prev.textContent = blockText(prev) + blockText(blk);
  blk.remove();
  setCaret(prev, len);
}

function mountEditor(root, blocks, onChange = () => {}) {
  root.innerHTML = "";
  (blocks.length ? blocks : [{ type: "p", text: "" }]).forEach((b) => root.appendChild(makeBlock(b)));
  refreshEmpty(root);
  const changed = () => { refreshEmpty(root); onChange(); };

  root.addEventListener("beforeinput", (e) => {
    const t = e.inputType;
    const blk = currentBlock(root);
    if (!blk) return;
    if (t === "insertParagraph" || t === "insertLineBreak") {
      e.preventDefault();
      if (slash.open && slash.root === root) applySlash(slash.index);
      else { splitBlock(root, blk); changed(); }
    } else if (t === "deleteContentBackward" && getSelection().isCollapsed && caretOffset(blk) === 0) {
      e.preventDefault();
      backspaceAtStart(blk);
      changed();
    }
  });
  root.addEventListener("input", () => { normalizeRoot(root); checkSlash(root); changed(); });
  root.addEventListener("keydown", (e) => {
    if (!slash.open || slash.root !== root) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = slash.items.length;
      slash.index = (slash.index + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      checkSlash(root);
    } else if (e.key === "Escape") { e.preventDefault(); closeSlash(); }
  });
  root.addEventListener("blur", closeSlash);
  root.addEventListener("paste", (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\r/g, "");
    if (!txt || !currentBlock(root)) return;
    const sel = getSelection();
    if (!sel.isCollapsed) { sel.deleteFromDocument(); normalizeRoot(root); }
    const blk = currentBlock(root);
    if (!blk) return;
    const lines = txt.split("\n"), text = blockText(blk), off = caretOffset(blk);
    if (lines.length === 1) {
      blk.textContent = text.slice(0, off) + lines[0] + text.slice(off);
      setCaret(blk, off + lines[0].length);
    } else {
      const after = text.slice(off);
      blk.textContent = text.slice(0, off) + lines[0];
      let last = blk;
      lines.slice(1).forEach((l, i) => {
        const nb = makeBlock({ type: "p", text: l + (i === lines.length - 2 ? after : "") });
        last.after(nb);
        last = nb;
      });
      setCaret(last, lines[lines.length - 1].length);
    }
    changed();
  });
}

/* ---------- Página de notas de una tarea (editor con comandos "/") ---------- */
let notesTimer = null;

function saveNotes() {
  const task = state.tasks.find((t) => t.id === state.notesTask);
  if (!task) return;
  task.doc = trimDoc(readDoc($("#notes-editor")));
  commitTasks();
}

function openNotes(task) {
  state.notesTask = task.id;
  $("#notes-title").textContent = task.text;
  const label = PRIORITIES.find((p) => p.key === task.priority)?.label ?? "";
  $("#notes-meta").innerHTML = `
    <span class="chip"><span class="dot" style="--prio:var(--${task.priority})"></span>Prioridad ${label.toLowerCase()}</span>
    ${task.due ? `<span class="chip">📅 ${dueLabel(task.due)}</span>` : ""}`;
  const editor = $("#notes-editor");
  mountEditor(editor, task.doc || [], () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(saveNotes, 250);
  });
  $("#notes-page").classList.remove("hidden");
  $("#notes-page").scrollTop = 0;
  document.body.classList.add("no-scroll");
  if (!(task.doc || []).length) { editor.focus(); setCaret(editor.firstElementChild, 0); }
}

function closeNotes() {
  clearTimeout(notesTimer);
  saveNotes();
  closeSlash();
  $("#notes-page").classList.add("hidden");
  document.body.classList.remove("no-scroll");
  state.notesTask = null;
  renderTasks();
  scheduleSync(500);
}
$("#notes-back").addEventListener("click", closeNotes);

/* ---------- Resúmenes de libros ---------- */
const SECTIONS = [
  { key: "ideas", cls: "ideas", label: "💡 Ideas clave", hint: "Una idea por línea…" },
  { key: "notes", cls: "notes", label: "📝 Notas / Resumen por capítulos", hint: "Capítulo 1: …" },
  { key: "quotes", cls: "quotes", label: "❝ Citas destacadas", hint: "“Cita” — página" },
  { key: "conclusion", cls: "conclusion", label: "🧭 Conclusión personal", hint: "¿Qué te llevas de este libro?" },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

function freeViewHTML(b) {
  const doc = (b.doc || []).filter((x) => x.text.trim());
  if (!doc.length) return `<p class="muted">Sin contenido todavía. Toca ✎ para escribir; usa “/” para dar formato.</p>`;
  const titles = doc.filter((x) => x.type === "h1");
  const rail = titles.length ? `
    <nav class="dot-rail" aria-label="Secciones del resumen">
      ${titles.map((t) => `<button data-action="goto" data-target="${esc(t.id)}" title="${esc(t.text)}" aria-label="Ir a ${esc(t.text)}"></button>`).join("")}
    </nav>` : "";
  return `<div class="free-body">${docViewHTML(doc)}${rail}</div>`;
}

function bookPageViewHTML(b) {
  const boxes = SECTIONS.map((s) => `
    <div class="box ${s.cls}">
      <h3>${s.label}</h3>
      ${b[s.key] ? `<p>${esc(b[s.key])}</p>` : `<p class="empty">Sin contenido</p>`}
    </div>`).join("");
  return `
    <h2 class="page-title">${esc(b.title) || "Sin título"}</h2>
    <p class="muted book-page-author">${esc(b.author) || "Autor desconocido"}</p>
    ${b.template === "free" ? freeViewHTML(b) : `<div class="grid-gap">${boxes}</div>`}`;
}

function bookEditHTML(d) {
  const free = d.template === "free";
  const editor = free
    ? `<div class="editor-box"><div class="editor doc" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Contenido del resumen"></div></div>`
    : SECTIONS.map((s) => `
    <label class="box ${s.cls} block">
      <h3>${s.label}</h3>
      <textarea class="field" rows="4" data-field="${s.key}" placeholder="${esc(s.hint)}">${esc(d[s.key])}</textarea>
    </label>`).join("");
  return `
    <div class="grid-gap">
      <input class="field" data-field="title" value="${esc(d.title)}" placeholder="Título del libro" aria-label="Título">
      <input class="field" data-field="author" value="${esc(d.author)}" placeholder="Autor" aria-label="Autor">
      <div>
        <p class="setting-label">Plantilla</p>
        <div class="seg" role="radiogroup" aria-label="Plantilla del resumen">
          <button data-action="template" data-value="blocks" class="${free ? "" : "active"}">Por bloques</button>
          <button data-action="template" data-value="free" class="${free ? "active" : ""}">Libre</button>
        </div>
      </div>
      ${editor}
      <div class="flex gap-2">
        <button data-action="cancel" class="btn-secondary flex-1 py-3">Cancelar</button>
        <button data-action="save" class="btn-primary flex-1 py-3">Guardar</button>
      </div>
    </div>`;
}

function renderBooks() {
  closeSlash();
  renderBookList();
  renderBookPage();
}

function renderBookList() {
  $("#book-list").innerHTML = state.books.map((b) => `
    <article class="book-card" data-book="${b.id}">
      <button class="book-open" data-action="open">
        <span class="book-row-title">${esc(b.title) || "Sin título"}</span>
        <span class="book-row-author">${esc(b.author)}</span>
      </button>
    </article>`).join("");
  $("#book-empty").classList.toggle("hidden", state.books.length > 0);
}

function renderBookPage() {
  const page = $("#book-page");
  const book = state.books.find((b) => b.id === state.openBook);
  if (!book) { page.classList.add("hidden"); document.body.classList.remove("no-scroll"); return; }
  const editing = state.editing.has(book.id);
  page.dataset.book = book.id;
  page.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  $("#book-back").classList.toggle("hidden", editing);
  $("#book-bar-actions").classList.toggle("hidden", editing);
  $("#book-bar-label").textContent = editing ? "Editando" : "";
  $("#book-detail").innerHTML = editing ? bookEditHTML(state.drafts.get(book.id)) : bookPageViewHTML(book);
  const ed = $("#book-detail .editor");
  if (ed) mountEditor(ed, state.drafts.get(book.id).doc);
  updateActiveDots();
}

function openBook(id) {
  state.openBook = id;
  renderBooks();
  $("#book-page").scrollTop = 0;
}
function closeBook() {
  state.openBook = null;
  renderBooks();
}
$("#book-back").addEventListener("click", closeBook);

function persistBooks() { commitBooks(); renderBooks(); }

/* Punto activo del carril: el último título que ya pasó por la parte alta de la pantalla */
function updateActiveDots() {
  $$(".free-body").forEach((body) => {
    const heads = [...body.querySelectorAll('.blk[data-type="h1"]')];
    if (!heads.length) return;
    let current = heads[0].dataset.id;
    heads.forEach((h) => { if (h.getBoundingClientRect().top <= 120) current = h.dataset.id; });
    const scroller = body.closest(".page");
    const atBottom = scroller ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      : innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom && scroller && scroller.scrollTop > 0) current = heads[heads.length - 1].dataset.id;
    body.querySelectorAll(".dot-rail button").forEach((b) => b.classList.toggle("active", b.dataset.target === current));
  });
}
window.addEventListener("scroll", updateActiveDots, { passive: true });
$("#book-page").addEventListener("scroll", updateActiveDots, { passive: true });

function beginEdit(book) {
  state.drafts.set(book.id, { template: "blocks", doc: [], ...clone(book) });
  state.editing.add(book.id);
}

function endEdit(id) { state.editing.delete(id); state.drafts.delete(id); scheduleSync(500); }

/* Vuelca lo escrito en pantalla al borrador (antes de re-renderizar) */
function syncDraft(card, d) {
  card.querySelectorAll("[data-field]").forEach((el) => { d[el.dataset.field] = el.value; });
  const ed = card.querySelector(".editor");
  if (ed) d.doc = readDoc(ed);
}

$("#new-book").addEventListener("click", () => {
  const book = {
    id: uid(), title: "", author: "", template: state.settings.lastTemplate || "blocks",
    ideas: "", notes: "", quotes: "", conclusion: "", doc: [], collapsed: false, isNew: true,
  };
  state.books.unshift(book);
  beginEdit(book);
  openBook(book.id);
  $('#book-detail [data-field="title"]')?.focus();
});

function onBookClick(e) {
  const card = e.target.closest("[data-book]");
  const btn = e.target.closest("[data-action]");
  if (!card || !btn) return;
  const book = state.books.find((b) => b.id === card.dataset.book);
  if (!book) return;
  const d = state.drafts.get(book.id);
  const action = btn.dataset.action;

  if (d && action === "template") {
    syncDraft(card, d);
    d.template = btn.dataset.value;
    renderBooks();
    return;
  }

  switch (action) {
    case "open":
      openBook(book.id);
      break;
    case "goto": {
      const target = card.querySelector(`.blk[data-type="h1"][data-id="${btn.dataset.target}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "edit":
      beginEdit(book);
      renderBooks();
      break;
    case "delete":
      askConfirm(`¿Eliminar el resumen "${book.title || "Sin título"}"?`).then((ok) => {
        if (!ok) return;
        state.books = state.books.filter((b) => b.id !== book.id);
        endEdit(book.id);
        state.openBook = null;
        persistBooks();
      });
      break;
    case "cancel":
      endEdit(book.id);
      if (book.isNew) { state.books = state.books.filter((b) => b.id !== book.id); state.openBook = null; }
      renderBooks();
      break;
    case "save": {
      syncDraft(card, d);
      ["title", "author", ...SECTIONS.map((s) => s.key)].forEach((k) => { d[k] = d[k].trim(); });
      d.doc = trimDoc(d.doc);
      delete d.isNew;
      delete book.isNew;
      Object.assign(book, d);
      state.settings.lastTemplate = d.template;
      save(KEYS.settings, state.settings);
      endEdit(book.id);
      persistBooks();
      break;
    }
  }
}
$("#book-list").addEventListener("click", onBookClick);
$("#book-page").addEventListener("click", onBookClick);

/* ---------- Instalación y modo sin conexión ---------- */
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ---------- Inicio ---------- */
if (!TITLES[state.tab]) state.tab = "tasks";
if (!["all", "pending", "done"].includes(state.filter)) state.filter = "all";
// Un borrador nuevo sin guardar no sobrevive a una recarga
state.books = state.books.filter((b) => !b.isNew);
initTheme();
applyTheme();
showTab(state.tab);
renderTasks();
renderBooks();
renderSettings();
// migración de datos: registra el estado actual y guarda (sellos de sincronización, estado de avisos)
Sync.prime("tasks", state.tasks, tracker, Date.now());
Sync.prime("books", state.books, tracker, Date.now());
save(KEYS.tasks, state.tasks);
save(KEYS.books, state.books);
save(KEYS.settings, state.settings);
runReminders();
schedulePushSync();
handleLinkHash();
handleTaskHash();
window.addEventListener("hashchange", () => { handleLinkHash(); handleTaskHash(); });
scheduleSync(300);
setInterval(() => { if (!document.hidden) scheduleSync(0); }, 60000);
setInterval(() => { runReminders(); if (state.editingTask === null) renderTasks(); }, 30000);
