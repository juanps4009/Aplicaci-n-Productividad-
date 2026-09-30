"use strict";

/* ---------- Almacenamiento ---------- */
const KEYS = { tasks: "prod.tasks", books: "prod.books", filter: "prod.filter", tab: "prod.tab" };

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
  tasks: load(KEYS.tasks, []),
  books: load(KEYS.books, []),
  filter: load(KEYS.filter, "all"),
  tab: load(KEYS.tab, "tasks"),
  editing: new Set(), // ids de resúmenes en modo edición
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
function renderTasks() {
  $$(".filter-btn").forEach((b) => b.classList.toggle("active", b.dataset.filter === state.filter));

  const visible = state.tasks.filter((t) =>
    state.filter === "all" ? true : state.filter === "done" ? t.done : !t.done);

  $("#task-list").innerHTML = visible.map((t) => `
    <li class="task-item ${t.done ? "done" : ""}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Completada">
      <span class="task-text">${esc(t.text)}</span>
      <button class="icon-btn danger" data-action="delete" aria-label="Eliminar tarea">✕</button>
    </li>`).join("");

  $("#task-empty").classList.toggle("hidden", visible.length > 0);
  const left = state.tasks.filter((t) => !t.done).length;
  $("#task-counter").textContent = state.tasks.length
    ? `${left} pendiente${left === 1 ? "" : "s"} de ${state.tasks.length}` : "";
}

function persistTasks() { save(KEYS.tasks, state.tasks); renderTasks(); }

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#task-input");
  const text = input.value.trim();
  if (!text) return;
  state.tasks.unshift({ id: uid(), text, done: false });
  input.value = "";
  persistTasks();
});

$("#filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  save(KEYS.filter, state.filter);
  renderTasks();
});

$("#task-list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  if (e.target.closest("[data-action='delete']")) {
    state.tasks = state.tasks.filter((t) => t.id !== li.dataset.id);
    persistTasks();
  }
});

$("#task-list").addEventListener("change", (e) => {
  const li = e.target.closest("li[data-id]");
  const task = li && state.tasks.find((t) => t.id === li.dataset.id);
  if (!task) return;
  task.done = e.target.checked;
  persistTasks();
});

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
          <span class="chevron text-slate-400">▾</span>
          <div class="min-w-0">
            <h2 class="truncate text-lg font-bold">${esc(b.title) || "Sin título"}</h2>
            <p class="truncate text-sm text-slate-500">${esc(b.author) || "Autor desconocido"}</p>
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
        <button data-action="cancel" class="flex-1 rounded-xl bg-slate-200 py-3 font-medium text-slate-700">Cancelar</button>
        <button data-action="save" class="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white">Guardar</button>
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
      if (confirm(`¿Eliminar el resumen "${book.title || "Sin título"}"?`)) {
        state.books = state.books.filter((b) => b.id !== book.id);
        state.editing.delete(book.id);
        persistBooks();
      }
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
