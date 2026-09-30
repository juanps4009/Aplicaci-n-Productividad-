"use strict";

/* ---------- Almacenamiento ---------- */
const APP_VERSION = "0.2.0-beta";

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
  tasks: load(KEYS.tasks, []).map((t) => ({ priority: "medium", due: "", notified: false, ...t })),
  books: load(KEYS.books, []),
  filter: load(KEYS.filter, "all"),
  tab: load(KEYS.tab, "tasks"),
  settings: { priorityStyle: "dot", groupBy: "date", ...load(KEYS.settings, {}) },
  collapsed: { done: true, ...load(KEYS.collapsed, {}) },
  newPriority: "medium",
  editing: new Set(),      // ids de resúmenes en edición
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
  return `
    <li class="task-item ${t.done ? "done" : ""}" data-id="${t.id}" data-prio="${t.priority}">
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Completada">
      <span class="dot" aria-label="Prioridad ${PRIORITIES.find((p) => p.key === t.priority)?.label ?? ""}"></span>
      <div class="task-main">
        <div class="task-text">${esc(t.text)}</div>
        ${t.due ? `<div class="due-label ${overdue ? "overdue" : ""}">📅 ${dueLabel(t.due)}</div>` : ""}
      </div>
      <button class="icon-btn" data-action="edit-task" aria-label="Editar tarea">✎</button>
      <button class="icon-btn danger" data-action="delete-task" aria-label="Eliminar tarea">✕</button>
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
  $$(".filter-btn").forEach((b) => b.classList.toggle("active", b.dataset.filter === state.filter));

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

$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  save(KEYS.filter, state.filter);
  renderTasks();
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
    case "delete-task":
      if (task) { state.tasks = state.tasks.filter((t) => t !== task); persistTasks(); }
      break;
    case "edit-task":
      if (task) { state.editingTask = task.id; renderTasks(); }
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
  $$(".seg").forEach((seg) => {
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

$$(".seg").forEach((seg) => seg.addEventListener("click", (e) => {
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

function bookViewHTML(b) {
  const boxes = SECTIONS.map((s) => `
    <div class="box ${s.cls}">
      <h3>${s.label}</h3>
      ${b[s.key] ? `<p>${esc(b[s.key])}</p>` : `<p class="empty">Sin contenido</p>`}
    </div>`).join("");
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
    ${b.collapsed ? "" : `<div class="book-body">${boxes}</div>`}`;
}

function bookEditHTML(b) {
  const fields = SECTIONS.map((s) => `
    <label class="box ${s.cls} block">
      <h3>${s.label}</h3>
      <textarea class="field" rows="4" data-field="${s.key}" placeholder="${esc(s.hint)}">${esc(b[s.key])}</textarea>
    </label>`).join("");
  return `
    <div class="book-body" style="padding-top:1rem">
      <input class="field" data-field="title" value="${esc(b.title)}" placeholder="Título del libro" aria-label="Título">
      <input class="field" data-field="author" value="${esc(b.author)}" placeholder="Autor" aria-label="Autor">
      ${fields}
      <div class="flex gap-2">
        <button data-action="cancel" class="btn-secondary flex-1 py-3">Cancelar</button>
        <button data-action="save" class="btn-primary flex-1 py-3">Guardar</button>
      </div>
    </div>`;
}

function renderBooks() {
  $("#book-list").innerHTML = state.books.map((b) => `
    <article class="book-card ${b.collapsed ? "collapsed" : ""}" data-id="${b.id}">
      ${state.editing.has(b.id) ? bookEditHTML(b) : bookViewHTML(b)}
    </article>`).join("");
  $("#book-empty").classList.toggle("hidden", state.books.length > 0);
}

function persistBooks() { save(KEYS.books, state.books); renderBooks(); }

$("#new-book").addEventListener("click", () => {
  const book = { id: uid(), title: "", author: "", ideas: "", notes: "", quotes: "", conclusion: "", collapsed: false, isNew: true };
  state.books.unshift(book);
  state.editing.add(book.id);
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

  switch (btn.dataset.action) {
    case "collapse":
      book.collapsed = !book.collapsed;
      persistBooks();
      break;
    case "edit":
      state.editing.add(book.id);
      renderBooks();
      break;
    case "delete":
      askConfirm(`¿Eliminar el resumen "${book.title || "Sin título"}"?`).then((ok) => {
        if (!ok) return;
        state.books = state.books.filter((b) => b.id !== book.id);
        state.editing.delete(book.id);
        persistBooks();
      });
      break;
    case "cancel":
      state.editing.delete(book.id);
      if (book.isNew) state.books = state.books.filter((b) => b.id !== book.id);
      renderBooks();
      break;
    case "save":
      card.querySelectorAll("[data-field]").forEach((el) => { book[el.dataset.field] = el.value.trim(); });
      delete book.isNew;
      state.editing.delete(book.id);
      persistBooks();
      break;
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
