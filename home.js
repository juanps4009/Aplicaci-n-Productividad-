"use strict";
/* Inicio v3: saludo encima del titular con fecha en es-CO, pulso de 4 px, una sola caja «Lo importante hoy»
   y «Tus áreas» sin tarjeta ni chevrons. Usa el estado y las funciones de app.js (se carga después). */

const HOME_ICON = {
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  routine: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  money: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  idea: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const homeSvg = (name, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOME_ICON[name]}</svg>`;

const homeKeep = new Set(); // tareas marcadas desde el Inicio: siguen a la vista hasta salir de la pestaña
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function greeting(h) { return h < 5 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; }

function formatHomeDate(d) {
  const weekday = d.toLocaleDateString("es-CO", { weekday: "long" });
  const month = d.toLocaleDateString("es-CO", { month: "short" }).replace(/\.$/, "");
  return `${capital(weekday)} ${d.getDate()} ${month}`;
}

/* Tareas de hoy: las que vencen hoy (hechas o no) y las vencidas sin hacer */
function dayTasks(now) {
  const list = state.tasks.filter((t) => t.due === now || (t.due && t.due < now && !t.done));
  return { list, done: list.filter((t) => t.done).length, overdue: list.filter((t) => !t.done && t.due < now).length };
}

/* Lo importante hoy: hasta 3 sin hacer (vencidas, de hoy y luego las de prioridad alta) */
function focusTasks(now) {
  const rank = (t) => (t.due && t.due < now ? 0 : t.due === now ? 1 : t.priority === "high" ? 2 : 9);
  const pick = sortTasks(state.tasks.filter((t) => (!t.done || homeKeep.has(t.id)) && rank(t) < 9))
    .sort((a, b) => rank(a) - rank(b) || (PRIO_RANK[a.priority] ?? 9) - (PRIO_RANK[b.priority] ?? 9));
  return pick.slice(0, 3);
}

/* Racha de la rutina: días seguidos con todos los diarios hechos (hoy sin terminar no la rompe) */
function routineStreak(now) {
  if (!Routine.items(state.routine, "daily").length) return 0;
  let n = 0, d = now;
  for (let i = 0; i < 400; i++) {
    const t = Routine.today(state.routine, d), rows = t.daily;
    if (rows.length) {
      const full = rows.every((r) => r.done);
      if (full) n++;
      else if (d !== now) break;
    } else if (i > 60 && !n) break;
    d = shiftDay(d, -1);
  }
  return n;
}
function shiftDay(s, k) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + k); return dateStr(d); }

function homeTaskHTML(t, now) {
  const late = t.due && t.due < now && !t.done;
  const meta = late ? `Vencida · ${dueLabel(t.due)}` : t.due === now ? "Hoy" : t.due ? dueLabel(t.due) : "Sin fecha";
  const prio = PRIORITIES.find((p) => p.key === t.priority);
  return `
    <li class="home-task ${t.done ? "done" : ""}" data-id="${esc(t.id)}" data-prio="${esc(t.priority || "")}">
      <button type="button" class="home-chk-btn" data-action="home-toggle" role="checkbox" aria-checked="${!!t.done}" aria-label="${esc(t.text)}">
        <span class="chk">${homeSvg("check", 3)}</span>
      </button>
      <div class="home-task-body">
        <span class="home-task-title">${RT.toHTML(t.text, t.marks)}</span>
        <span class="home-task-meta ${late ? "late" : ""}">${esc(meta)}</span>
      </div>
      <span class="dot" ${prio ? `role="img" aria-label="Prioridad ${esc(prio.label.toLowerCase())}"` : 'aria-hidden="true"'}></span>
    </li>`;
}

function renderHome() {
  const el = $("#tab-home");
  if (!el || state.tab !== "home") return;
  const now = today(), d = new Date();
  const eyebrow = $("#page-eyebrow");
  if (eyebrow) {
    eyebrow.textContent = greeting(d.getHours());
    eyebrow.classList.remove("hidden");
  }
  $("#page-title").textContent = formatHomeDate(d);

  const tk = dayTasks(now), rt = Routine.today(state.routine, now);
  const total = tk.list.length + rt.total, doneAll = tk.done + rt.done;
  const ratio = total ? doneAll / total : 0;

  const focus = focusTasks(now);
  const streak = routineStreak(now);
  const wkKey = Routine.weekKey(now), wk = Routine.weekStats(state.routine, wkKey, now);
  const hasRoutine = Routine.items(state.routine).length > 0;
  const c = Work.counts(state.work), active = c.review + c.applied + c.replied;
  const soon = Work.closingSoon(state.work, now, 3).length;
  const income = Work.monthTotal(state.work, now.slice(0, 7));
  const booksReal = state.books.filter((x) => !x.isNew);
  const readingBook = Reading.reading(booksReal).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];
  const lastBook = readingBook || [...booksReal].sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];

  const pendingAll = state.tasks.filter((t) => !t.done).length, todayLeft = tk.list.length - tk.done;
  const area = (go, cls, icon, name, info, view = "") => `<button type="button" class="area ${cls}" data-go="${go}"${view ? ` data-view="${view}"` : ""}>
      <span class="area-ico" aria-hidden="true">${homeSvg(icon)}</span>
      <span class="area-name">${name}</span>
      <span class="area-info">${info}</span>
    </button>`;
  const hot = (txt) => `<em class="hot">${txt}</em>`;
  const pendInfo = (todayLeft > 0 || tk.overdue > 0)
    ? [todayLeft ? `${todayLeft} hoy` : "", tk.overdue ? hot(plural(tk.overdue, "vencida", "vencidas")) : ""].filter(Boolean).join(" · ")
    : (pendingAll ? plural(pendingAll, "pendiente", "pendientes") : "Nada para hoy");
  const rutInfo = hasRoutine
    ? (rt.total ? `${rt.done} de ${rt.total}${streak ? ` · racha ${streak} d` : ""}` : "Sin hábitos hoy")
    : "Sin hábitos hoy";
  const tiles = [
    area("tasks", "t-tasks", "tasks", "Pendientes", pendInfo),
    area("routine", "t-routine", "routine", "Rutina", rutInfo),
    income.count
      ? area("work", "t-work", "work", "Ingresos", Work.money(income.total), "income")
      : area("work", "t-work", "work", "Trabajo",
        active ? (soon ? hot(`${plural(soon, "oferta cierra", "ofertas cierran")} pronto`) : plural(active, "oferta activa", "ofertas activas")) : "Sin ofertas", "opps"),
    area("books", "t-books", "book", "Resúmenes",
      lastBook ? `<span class="area-book">${RT.toHTML(lastBook.title, lastBook.titleMarks) || "Sin título"}</span>` : "Sin resúmenes"),
  ];

  const bars = wk.days.map((x, i) => {
    const v = x.total ? x.done / x.total : 0;
    const isToday = wk.dates && wk.dates[i] === now;
    const barRatio = x.state === "future" || !x.total ? 0.05 : Math.max(0.06, v);
    const label = isToday ? "hoy" : (Routine.DAY_NAME[i] || "").slice(0, 3);
    return `<div class="${isToday ? "today" : x.state === "future" ? "future" : ""}">
      <i style="--v:${barRatio}" role="img" aria-label="${esc(isToday ? "Hoy" : Routine.DAY_NAME[i])}: ${x.done} de ${x.total}"></i>
      <small>${esc(label)}</small>
    </div>`;
  }).join("");

  const allFocusDone = focus.length > 0 && focus.every((t) => t.done);

  el.innerHTML = `
    <div class="home">
      ${typeof claudeHomeStrip === "function" ? claudeHomeStrip() : ""}
      ${total ? `
      <div class="home-pulse">
        <p class="home-pulse-text" aria-live="polite">${doneAll} de ${total} hecho${total === 1 ? "" : "s"} hoy</p>
        <div class="home-pulse-bar" role="progressbar" aria-label="Avance de hoy" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${doneAll}">
          <span style="--p:${ratio}"></span>
        </div>
      </div>` : ""}
      <div class="home-main-col">
        <section class="home-day" aria-label="Lo importante hoy">
          <h2 class="home-day-title">Lo importante hoy</h2>
          ${focus.length
            ? `<ul class="home-focus">${focus.map((t) => homeTaskHTML(t, now)).join("")}</ul>${allFocusDone ? `<p class="home-done-msg">Listo por hoy.</p>` : ""}`
            : `<p class="home-empty"><span>Nada pendiente para hoy.</span><span aria-hidden="true">·</span><button type="button" class="link-accent" data-action="home-qc">Anotar algo</button></p>`}
        </section>
        <nav class="home-areas" aria-label="Tus áreas">
          <h2 class="home-areas-title">Tus áreas</h2>
          ${tiles.join("")}
        </nav>
      </div>
      ${hasRoutine ? `
      <aside class="home-week" aria-label="Tu semana">
        <h2>Tu semana</h2>
        <div class="week-bars" role="img" aria-label="Cumplimiento de la rutina cada día de esta semana">${bars}</div>
      </aside>` : ""}
    </div>`;
}

/* El avance vive en Inicio; en Pendientes se mantiene vacío sin romper referencias */
function renderTaskProgress() {
  const box = $("#task-progress");
  if (!box) return;
  box.innerHTML = "";
  box.className = "";
}

$("#tab-home").addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) {
    if (go.dataset.view) state.workView = go.dataset.view;
    showTab(go.dataset.go);
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "home-toggle") {
    const row = btn.closest("[data-id]");
    const id = btn.dataset.id || row?.dataset.id;
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    if (t.done && state.settings.estilo === "vivo" && navigator.vibrate) navigator.vibrate(8);
    homeKeep.add(t.id);
    commitTasks();
    renderTasks();
    renderHome();
  } else if (btn.dataset.action === "home-qc") {
    if (window.QuickCapture) QuickCapture.open();
    else { showTab("tasks"); setTimeout(() => $("#task-input")?.focus(), 50); }
  } else if (btn.dataset.action === "home-add") {
    openSheet("#home-add");
  }
});

$("#home-add").addEventListener("click", (e) => {
  if (e.target.id === "home-add") { closeSheet("#home-add"); return; }
  const b = e.target.closest("[data-add]");
  if (!b) return;
  closeSheet("#home-add");
  const kind = b.dataset.add;
  if (kind === "task") { showTab("tasks"); setTimeout(() => $("#task-input").focus(), 50); }
  if (kind === "routine") { showTab("routine"); openRoutineSheet(null); }
  if (kind === "work") { state.workView = "opps"; showTab("work"); openWorkSheet(null); }
  if (kind === "income") { state.workView = "income"; showTab("work"); $("#work-body [data-action=inc-add]")?.click(); }
  if (kind === "book") { showTab("books"); $("#new-book").click(); }
});

$("#home-add .add-grid").innerHTML = [
  ["task", "t-tasks", "tasks", "Tarea"], ["routine", "t-routine", "routine", "Hábito"],
  ["work", "t-work", "work", "Oportunidad"], ["income", "t-work", "money", "Ingreso"], ["book", "t-books", "idea", "Resumen de libro"],
].map(([k, cls, ico, label]) => `<button class="${cls}" data-add="${k}">${homeSvg(ico)}${label}</button>`).join("");

renderTaskProgress();
if (state.tab === "home") renderHome();
if (state.tab === "routine") renderRoutine(); // se dibujó antes de cargar este archivo: falta la racha
