"use strict";

/* ---------- Almacenamiento ---------- */
const APP_VERSION = "0.5.0-beta";

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

const TYPE_FROM_ENTRY = { title: "h1", subtitle: "h2", text: "p" };
const migrateTask = (t) => {
  const task = { priority: "medium", due: "", notified: false, notes: "", ...t };
  if (task.doc) { // formato de la 0.4: bloques → texto plano
    if (!task.notes) task.notes = task.doc.map((b) => b.text).join("\n");
    delete task.doc;
  }
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
function uidSeed() { return Math.random().toString(36).slice(2, 7); }

const state = {
  // Migración: tareas de la v1 no tenían prioridad, fecha ni aviso
  tasks: load(KEYS.tasks, []).map(migrateTask),
  books: load(KEYS.books, []).map(migrateBook),
  filter: load(KEYS.filter, "all"),
  tab: load(KEYS.tab, "tasks"),
  settings: { priorityStyle: "dot", groupBy: "date", ...load(KEYS.settings, {}) },
  collapsed: { done: true, ...load(KEYS.collapsed, {}) },
  newPriority: "medium",
  editing: new Set(),      // ids de resúmenes en edición
  openBook: null,          // id del resumen abierto a página completa
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
  const hasNotes = !!(t.notes || "").trim();
  return `
    <li class="task-item ${t.done ? "done" : ""}" data-id="${t.id}" data-prio="${t.priority}">
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Completada">
      <span class="dot" aria-label="Prioridad ${PRIORITIES.find((p) => p.key === t.priority)?.label ?? ""}"></span>
      <div class="task-main">
        <div class="task-text">${esc(t.text)}</div>
        ${t.due ? `<div class="due-label ${overdue ? "overdue" : ""}">📅 ${dueLabel(t.due)}</div>` : ""}
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
const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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

/* ---------- Página de notas de una tarea (texto simple) ---------- */
let notesTimer = null;
const growNotes = () => { const t = $("#notes-text"); t.style.height = "auto"; t.style.height = `${Math.max(t.scrollHeight, 240)}px`; };

function saveNotes() {
  const task = state.tasks.find((t) => t.id === state.notesTask);
  if (!task) return;
  task.notes = $("#notes-text").value;
  save(KEYS.tasks, state.tasks);
}

function openNotes(task) {
  state.notesTask = task.id;
  $("#notes-title").textContent = task.text;
  const label = PRIORITIES.find((p) => p.key === task.priority)?.label ?? "";
  $("#notes-meta").innerHTML = `
    <span class="chip"><span class="dot" style="--prio:var(--${task.priority})"></span>Prioridad ${label.toLowerCase()}</span>
    ${task.due ? `<span class="chip">📅 ${dueLabel(task.due)}</span>` : ""}`;
  $("#notes-text").value = task.notes || "";
  $("#notes-page").classList.remove("hidden");
  $("#notes-page").scrollTop = 0;
  document.body.classList.add("no-scroll");
  growNotes();
  if (!task.notes) $("#notes-text").focus();
}

function closeNotes() {
  clearTimeout(notesTimer);
  saveNotes();
  $("#notes-page").classList.add("hidden");
  document.body.classList.remove("no-scroll");
  state.notesTask = null;
  renderTasks();
}
$("#notes-back").addEventListener("click", closeNotes);
$("#notes-text").addEventListener("input", () => {
  growNotes();
  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveNotes, 250);
});

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
  $("#book-list").innerHTML = state.books.map((b) => `
    <article class="book-card" data-book="${b.id}">
      <button class="book-open" data-action="open">
        <span class="book-row-title">${esc(b.title) || "Sin título"}</span>
        <span class="book-row-author">${esc(b.author)}</span>
      </button>
    </article>`).join("");
  $("#book-empty").classList.toggle("hidden", state.books.length > 0);
  renderBookPage();
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

function persistBooks() { save(KEYS.books, state.books); renderBooks(); }

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

function endEdit(id) { state.editing.delete(id); state.drafts.delete(id); }

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
