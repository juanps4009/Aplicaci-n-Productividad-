"use strict";

/* ---------- Almacenamiento ---------- */
const APP_VERSION = "0.3.0-beta";

const KEYS = {
  tasks: "prod.tasks", books: "prod.books", filter: "prod.filter", tab: "prod.tab",
  settings: "prod.settings", collapsed: "prod.collapsed",
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

const state = {
  // Migración: tareas de la v1 no tenían prioridad, fecha ni aviso
  tasks: load(KEYS.tasks, []).map((t) => ({ priority: "medium", due: "", notified: false, notes: "", ...t })),
  books: load(KEYS.books, []),
  filter: load(KEYS.filter, "all"),
  tab: load(KEYS.tab, "tasks"),
  settings: { priorityStyle: "dot", groupBy: "date", ...load(KEYS.settings, {}) },
  collapsed: { done: true, ...load(KEYS.collapsed, {}) },
  newPriority: "medium",
  editing: new Set(),      // ids de resúmenes en edición
  drafts: new Map(),       // copias de trabajo de los resúmenes en edición
  menuTask: null,          // tarea del menú ⋮
  notesTask: null,         // tarea abierta en notas
  editingTask: null,       // id de tarea en edición
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  const notePreview = (t.notes || "").trim().split("\n")[0];
  return `
    <li class="task-item ${t.done ? "done" : ""}" data-id="${t.id}" data-prio="${t.priority}">
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Completada">
      <span class="dot" aria-label="Prioridad ${PRIORITIES.find((p) => p.key === t.priority)?.label ?? ""}"></span>
      <div class="task-main">
        <div class="task-text">${esc(t.text)}</div>
        ${t.due ? `<div class="due-label ${overdue ? "overdue" : ""}">📅 ${dueLabel(t.due)}</div>` : ""}
        ${notePreview ? `<div class="note-preview">${esc(notePreview)}</div>` : ""}
      </div>
      <button class="icon-btn ${notePreview ? "has-notes" : ""}" data-action="notes-task" aria-label="Notas de la tarea">${NOTEBOOK_ICON}</button>
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
}

function persistTasks() { save(KEYS.tasks, state.tasks); renderTasks(); }

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#task-input");
  const text = input.value.trim();
  if (!text) return;
  state.tasks.unshift({
    id: uid(), text, done: false, priority: state.newPriority,
    due: $("#task-due").value, notified: false,
  });
  input.value = "";
  $("#task-due").value = "";
  persistTasks();
  checkDue();
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
["#filter-sheet", "#task-menu", "#notes-sheet"].forEach((id) =>
  $(id).addEventListener("click", (e) => { if (e.target === $(id)) { closeSheet(id); if (id === "#notes-sheet") renderTasks(); } }));

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

$("#notes-text").addEventListener("input", (e) => {
  const task = state.tasks.find((t) => t.id === state.notesTask);
  if (task) { task.notes = e.target.value; save(KEYS.tasks, state.tasks); }
});
$("#notes-close").addEventListener("click", () => { closeSheet("#notes-sheet"); renderTasks(); });

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
      if (task) {
        state.notesTask = task.id;
        $("#notes-title").textContent = task.text;
        $("#notes-text").value = task.notes || "";
        openSheet("#notes-sheet");
        $("#notes-text").focus();
      }
      break;
    case "cancel-task":
      state.editingTask = null;
      renderTasks();
      break;
    case "save-task": {
      if (!task) break;
      const text = li.querySelector("[data-edit='text']").value.trim();
      if (!text) break;
      const due = li.querySelector("[data-edit='due']").value;
      if (due !== task.due) task.notified = false;
      task.text = text;
      task.due = due;
      task.priority = li.querySelector("[data-edit='prio']").dataset.value;
      state.editingTask = null;
      persistTasks();
      checkDue();
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
  const btn = $("#enable-notif");
  if (!("Notification" in window)) {
    btn.textContent = "Notificaciones no disponibles"; btn.disabled = true;
  } else if (Notification.permission === "granted") {
    btn.textContent = "🔔 Notificaciones activadas"; btn.disabled = true;
  } else if (Notification.permission === "denied") {
    btn.textContent = "Bloqueadas en el navegador"; btn.disabled = true;
  } else {
    btn.textContent = "Activar notificaciones"; btn.disabled = false;
  }
}

$("#open-settings").addEventListener("click", () => { renderSettings(); $("#settings").classList.remove("hidden"); });
$("#close-settings").addEventListener("click", () => $("#settings").classList.add("hidden"));
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") e.currentTarget.classList.add("hidden"); });

$$(".seg[data-setting]").forEach((seg) => seg.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  state.settings[seg.dataset.setting] = b.dataset.value;
  save(KEYS.settings, state.settings);
  renderSettings();
  renderTasks();
}));

$("#enable-notif").addEventListener("click", async () => {
  try { await Notification.requestPermission(); } catch { /* navegador sin soporte */ }
  renderSettings();
  checkDue();
});

/* ---------- Recordatorios ---------- */
function checkDue() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = today();
  const due = state.tasks.filter((t) => !t.done && t.due && t.due <= now && !t.notified);
  if (!due.length) return;
  due.forEach((t) => {
    try {
      new Notification(t.due < now ? "Tarea vencida" : "Tarea para hoy", { body: t.text, tag: t.id });
    } catch { /* algunos móviles exigen service worker */ }
    t.notified = true;
  });
  save(KEYS.tasks, state.tasks);
}

/* ---------- Resúmenes de libros ---------- */
const SECTIONS = [
  { key: "ideas", cls: "ideas", label: "💡 Ideas clave", hint: "Una idea por línea…" },
  { key: "notes", cls: "notes", label: "📝 Notas / Resumen por capítulos", hint: "Capítulo 1: …" },
  { key: "quotes", cls: "quotes", label: "❝ Citas destacadas", hint: "“Cita” — página" },
  { key: "conclusion", cls: "conclusion", label: "🧭 Conclusión personal", hint: "¿Qué te llevas de este libro?" },
];

const ENTRY_KINDS = {
  title: { label: "Título", hint: "Título de sección" },
  subtitle: { label: "Subtítulo", hint: "Subtítulo" },
  text: { label: "Texto", hint: "Escribe aquí…" },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function freeViewHTML(b) {
  const entries = (b.entries || []).filter((en) => en.text);
  if (!entries.length) {
    return `<div class="book-body"><p class="muted">Sin contenido todavía. Toca ✎ para añadir títulos, subtítulos y texto.</p></div>`;
  }
  const content = entries.map((en) =>
    en.type === "title" ? `<h3 class="entry-title" data-entry="${en.id}">${esc(en.text)}</h3>`
      : en.type === "subtitle" ? `<h4 class="entry-subtitle">${esc(en.text)}</h4>`
        : `<p class="entry-text">${esc(en.text)}</p>`).join("");
  const titles = entries.filter((en) => en.type === "title");
  const rail = titles.length ? `
    <nav class="dot-rail" aria-label="Secciones del resumen">
      ${titles.map((t) => `<button data-action="goto" data-target="${t.id}" title="${esc(t.text)}" aria-label="Ir a ${esc(t.text)}"></button>`).join("")}
    </nav>` : "";
  return `<div class="free-body"><div class="free-content">${content}</div>${rail}</div>`;
}

function bookViewHTML(b) {
  const boxes = SECTIONS.map((s) => `
    <div class="box ${s.cls}">
      <h3>${s.label}</h3>
      ${b[s.key] ? `<p>${esc(b[s.key])}</p>` : `<p class="empty">Sin contenido</p>`}
    </div>`).join("");
  const body = b.template === "free" ? freeViewHTML(b) : `<div class="book-body">${boxes}</div>`;
  return `
    <div class="book-head">
      <button class="titles" data-action="collapse" aria-expanded="${!b.collapsed}">
        <div class="flex items-center gap-2">
          <span class="chevron">▾</span>
          <div class="min-w-0">
            <h2 class="truncate text-lg font-bold">${esc(b.title) || "Sin título"}</h2>
            <p class="truncate text-sm muted">${esc(b.author) || "Autor desconocido"}</p>
          </div>
        </div>
      </button>
      <button class="icon-btn" data-action="edit" aria-label="Editar">✎</button>
      <button class="icon-btn danger" data-action="delete" aria-label="Eliminar">🗑</button>
    </div>
    ${b.collapsed ? "" : body}`;
}

function entryEditHTML(en, i, total) {
  const kind = ENTRY_KINDS[en.type];
  const control = en.type === "text"
    ? `<textarea class="field" rows="5" data-entry="${en.id}" placeholder="${kind.hint}" aria-label="${kind.label}">${esc(en.text)}</textarea>`
    : `<input class="field ${en.type === "title" ? "font-bold" : ""}" data-entry="${en.id}" value="${esc(en.text)}" placeholder="${kind.hint}" aria-label="${kind.label}">`;
  return `
    <div class="entry-edit" data-entry-id="${en.id}">
      <div class="entry-bar">
        <span class="entry-kind">${kind.label}</span>
        <button class="icon-btn" data-action="entry-up" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-action="entry-down" aria-label="Bajar" ${i === total - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn danger" data-action="entry-del" aria-label="Quitar">✕</button>
      </div>
      ${control}
    </div>`;
}

function bookEditHTML(d) {
  const free = d.template === "free";
  const editor = free ? `
      <div class="grid gap-2" style="display:grid;gap:0.6rem">
        ${d.entries.map((en, i) => entryEditHTML(en, i, d.entries.length)).join("")}
      </div>
      <div class="add-row">
        <button data-action="add-title">+ Título</button>
        <button data-action="add-subtitle">+ Subtítulo</button>
        <button data-action="add-text">+ Texto</button>
      </div>` : SECTIONS.map((s) => `
    <label class="box ${s.cls} block">
      <h3>${s.label}</h3>
      <textarea class="field" rows="4" data-field="${s.key}" placeholder="${esc(s.hint)}">${esc(d[s.key])}</textarea>
    </label>`).join("");
  return `
    <div class="book-body" style="padding-top:1rem">
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
  $("#book-list").innerHTML = state.books.map((b) => `
    <article class="book-card ${b.collapsed ? "collapsed" : ""}" data-id="${b.id}">
      ${state.editing.has(b.id) ? bookEditHTML(state.drafts.get(b.id)) : bookViewHTML(b)}
    </article>`).join("");
  $("#book-empty").classList.toggle("hidden", state.books.length > 0);
  updateActiveDots();
}

function persistBooks() { save(KEYS.books, state.books); renderBooks(); }

/* Punto activo del carril: el último título que ya pasó por la parte alta de la pantalla */
function updateActiveDots() {
  $$(".free-body").forEach((body) => {
    const heads = [...body.querySelectorAll(".entry-title")];
    if (!heads.length) return;
    let current = heads[0].dataset.entry;
    heads.forEach((h) => { if (h.getBoundingClientRect().top <= 120) current = h.dataset.entry; });
    body.querySelectorAll(".dot-rail button").forEach((b) => b.classList.toggle("active", b.dataset.target === current));
  });
}
window.addEventListener("scroll", updateActiveDots, { passive: true });

function beginEdit(book) {
  state.drafts.set(book.id, { template: "blocks", entries: [], ...clone(book) });
  state.editing.add(book.id);
}

function endEdit(id) { state.editing.delete(id); state.drafts.delete(id); }

/* Vuelca lo escrito en pantalla al borrador (antes de re-renderizar) */
function syncDraft(card, d) {
  card.querySelectorAll("[data-field]").forEach((el) => { d[el.dataset.field] = el.value; });
  card.querySelectorAll("[data-entry]").forEach((el) => {
    const en = d.entries.find((x) => x.id === el.dataset.entry);
    if (en) en.text = el.value;
  });
}

$("#new-book").addEventListener("click", () => {
  const book = {
    id: uid(), title: "", author: "", template: state.settings.lastTemplate || "blocks",
    ideas: "", notes: "", quotes: "", conclusion: "", entries: [], collapsed: false, isNew: true,
  };
  state.books.unshift(book);
  beginEdit(book);
  renderBooks();
  const first = document.querySelector(`[data-id="${book.id}"] [data-field="title"]`);
  if (first) first.focus();
});

$("#book-list").addEventListener("click", (e) => {
  const card = e.target.closest("[data-id]");
  const btn = e.target.closest("[data-action]");
  if (!card || !btn) return;
  const book = state.books.find((b) => b.id === card.dataset.id);
  if (!book) return;
  const d = state.drafts.get(book.id);
  const action = btn.dataset.action;

  // Acciones del editor: sincronizar → cambiar borrador → re-renderizar
  if (d && ["template", "add-title", "add-subtitle", "add-text", "entry-up", "entry-down", "entry-del"].includes(action)) {
    syncDraft(card, d);
    let focusId = null;
    if (action === "template") d.template = btn.dataset.value;
    else if (action.startsWith("add-")) {
      focusId = uid();
      d.entries.push({ id: focusId, type: action.slice(4), text: "" });
    } else {
      const id = btn.closest("[data-entry-id]").dataset.entryId;
      const i = d.entries.findIndex((x) => x.id === id);
      if (action === "entry-del") d.entries.splice(i, 1);
      else {
        const j = action === "entry-up" ? i - 1 : i + 1;
        if (j >= 0 && j < d.entries.length) [d.entries[i], d.entries[j]] = [d.entries[j], d.entries[i]];
      }
    }
    renderBooks();
    if (focusId) document.querySelector(`[data-entry="${focusId}"]`)?.focus();
    return;
  }

  switch (action) {
    case "collapse":
      book.collapsed = !book.collapsed;
      persistBooks();
      break;
    case "goto": {
      const target = card.querySelector(`.entry-title[data-entry="${btn.dataset.target}"]`);
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
        persistBooks();
      });
      break;
    case "cancel":
      endEdit(book.id);
      if (book.isNew) state.books = state.books.filter((b) => b.id !== book.id);
      renderBooks();
      break;
    case "save": {
      syncDraft(card, d);
      ["title", "author", ...SECTIONS.map((s) => s.key)].forEach((k) => { d[k] = d[k].trim(); });
      d.entries = d.entries.map((en) => ({ ...en, text: en.text.trim() })).filter((en) => en.text);
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
});

/* ---------- Inicio ---------- */
if (!TITLES[state.tab]) state.tab = "tasks";
if (!["all", "pending", "done"].includes(state.filter)) state.filter = "all";
// Un borrador nuevo sin guardar no sobrevive a una recarga
state.books = state.books.filter((b) => !b.isNew);
showTab(state.tab);
renderTasks();
renderBooks();
renderSettings();
checkDue();
setInterval(() => { checkDue(); if (state.editingTask === null) renderTasks(); }, 60000);
