"use strict";
/* Inicio: un tablero con tu día (tareas + rutina), lo importante hoy y una tarjeta por pestaña.
   Usa el estado y las funciones de app.js (se carga después). */

const HOME_ICON = {
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  routine: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  money: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  idea: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const homeSvg = (name, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOME_ICON[name]}</svg>`;

const homeKeep = new Set(); // tareas marcadas desde el Inicio: siguen a la vista hasta salir de la pestaña
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function greeting(h) { return h < 5 ? "Buenas noches" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; }

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
  const meta = [late ? `Vencida · ${dueLabel(t.due)}` : t.due ? dueLabel(t.due) : "", PRIORITIES.find((p) => p.key === t.priority)?.label].filter(Boolean).join(" · ");
  return `
    <button class="home-task ${t.done ? "done" : ""}" data-action="home-toggle" data-id="${esc(t.id)}" data-prio="${esc(t.priority || "")}" role="checkbox" aria-checked="${!!t.done}">
      <span class="chk">${homeSvg("check", 3)}</span>
      <span class="t"><b>${RT.toHTML(t.text, t.marks)}</b><small class="${late ? "late" : ""}">${esc(meta)}</small></span>
    </button>`;
}

function renderHome() {
  const el = $("#tab-home");
  if (!el || state.tab !== "home") return;
  const now = today(), d = new Date();
  $("#page-title").textContent = greeting(d.getHours());

  const tk = dayTasks(now), rt = Routine.today(state.routine, now);
  const total = tk.list.length + rt.total, doneAll = tk.done + rt.done;
  const pct = total ? Math.round((doneAll / total) * 100) : 0;
  const a = total ? (tk.done / total) * 100 : 0, b = total ? (doneAll / total) * 100 : 0;
  const left = total - doneAll;
  const msg = !total ? "No tienes nada con fecha para hoy. Buen momento para adelantar algo."
    : !left ? "Día completo. Puedes descansar tranquilo."
      : left <= 2 ? `Ya casi: te ${left === 1 ? "falta 1" : `faltan ${left}`}.`
        : `Te faltan ${plural(tk.list.length - tk.done, "tarea", "tareas")} y ${plural(rt.total - rt.done, "hábito", "hábitos")}.`;

  const focus = focusTasks(now);
  const streak = routineStreak(now);
  const wkKey = Routine.weekKey(now), wk = Routine.weekStats(state.routine, wkKey, now);
  const hasRoutine = Routine.items(state.routine).length > 0;
  const c = Work.counts(state.work), active = c.review + c.applied + c.replied;
  const soon = Work.closingSoon(state.work, now, 3).length;
  const income = Work.monthTotal(state.work, now.slice(0, 7));
  const lastBook = [...state.books].filter((x) => !x.isNew).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0))[0];

  const tiles = [
    `<button class="tile t-tasks" data-go="tasks">
      <span class="tile-top"><span class="tile-ico">${homeSvg("tasks")}</span><span class="tile-name">Pendientes</span></span>
      <span class="home-big">${tk.list.length - tk.done ? plural(tk.list.length - tk.done, "para hoy", "para hoy") : "Al día"}</span>
      <p class="${tk.overdue ? "hot" : ""}">${tk.overdue ? plural(tk.overdue, "vencida", "vencidas") : `${plural(state.tasks.filter((t) => !t.done).length, "pendiente", "pendientes")} en total`}</p>
      <span class="bar" role="img" aria-label="${tk.done} de ${tk.list.length} tareas de hoy"><span style="width:${tk.list.length ? Math.round((tk.done / tk.list.length) * 100) : 0}%"></span></span>
    </button>`,
    `<button class="tile t-routine" data-go="routine">
      <span class="tile-top"><span class="tile-ico">${homeSvg("flame")}</span><span class="tile-name">Rutina</span></span>
      <span class="home-big">${hasRoutine ? plural(streak, "día", "días") : "Sin rutina"}</span>
      <p>${hasRoutine ? `de racha · hoy ${rt.done} de ${rt.total}` : "Crea tus hábitos de cada día"}</p>
      ${hasRoutine ? `<span class="mini-week" aria-label="Tu semana">${wk.days.map((x, i) => `<span class="d-${x.state}"><i></i>${Routine.DAY_SHORT[i]}</span>`).join("")}</span>` : ""}
    </button>`,
    income.count
      ? `<button class="tile t-work" data-go="work" data-view="income">
      <span class="tile-top"><span class="tile-ico">${homeSvg("money")}</span><span class="tile-name">Ingresos del mes</span></span>
      <span class="home-big">${Work.money(income.total)}</span>
      <p class="${soon ? "hot" : ""}">${soon ? `${plural(soon, "oferta cierra", "ofertas cierran")} pronto` : `${plural(income.count, "pago", "pagos")} · ${active ? plural(active, "oferta activa", "ofertas activas") : "sin ofertas activas"}`}</p>
      ${income.total ? `<span class="wk-stack" role="img" aria-label="Con Claude ${Work.money(income.byType.claude)}, presencial ${Work.money(income.byType.presencial)}"><span style="flex:${income.byType.claude || 0.01};background:var(--amb-mid)"></span><span style="flex:${income.byType.presencial || 0.01};background:var(--amb-bg);box-shadow:inset 0 0 0 1.5px var(--amb-mid)"></span></span>` : ""}
    </button>`
      : `<button class="tile t-work" data-go="work" data-view="opps">
      <span class="tile-top"><span class="tile-ico">${homeSvg("work")}</span><span class="tile-name">Oportunidades</span></span>
      <span class="home-big">${active ? plural(active, "activa", "activas") : "Ninguna"}</span>
      <p class="${soon ? "hot" : ""}">${soon ? `${plural(soon, "cierra", "cierran")} pronto` : c.review ? `${c.review} por revisar` : "Añade ofertas para seguirlas"}</p>
      ${c.total ? `<span class="wk-stack" aria-hidden="true"><span style="flex:${c.review || 0.01};background:var(--track)"></span><span style="flex:${c.applied || 0.01};background:var(--ind-mid)"></span><span style="flex:${c.replied || 0.01};background:var(--grn-mid)"></span></span>` : ""}
    </button>`,
    `<button class="tile t-books" data-go="books">
      <span class="tile-top"><span class="tile-ico">${homeSvg("book")}</span><span class="tile-name">Resúmenes</span></span>
      <span class="home-big sm">${lastBook ? RT.toHTML(lastBook.title, lastBook.titleMarks) || "Sin título" : "Tu primer libro"}</span>
      <p>${state.books.length ? `${plural(state.books.length, "resumen", "resúmenes")} · el último que tocaste` : "Guarda las ideas de lo que lees"}</p>
    </button>`,
  ];

  // Tu semana: porcentaje de cada día de la rutina y comparación con la semana anterior
  const prev = Routine.weekStats(state.routine, Routine.shiftWeek ? Routine.shiftWeek(wkKey, -1) : wkKey, now);
  const diff = wk.pct !== null && prev.pct !== null && Routine.shiftWeek ? wk.pct - prev.pct : null;
  const bars = wk.days.map((x, i) => {
    const v = x.total ? x.done / x.total : 0;
    const cls = wk.dates && wk.dates[i] === now ? "today" : x.state === "future" ? "future" : "";
    return `<div class="${cls}"><i style="height:${x.state === "future" || !x.total ? 6 : Math.max(6, Math.round(v * 72))}px"></i><small>${Routine.DAY_SHORT[i]}</small></div>`;
  }).join("");

  el.innerHTML = `
    <div class="home">
      <p class="home-date">${esc(capital(d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })))}</p>
      <section class="card home-day" aria-label="Tu día">
        <div class="home-day-top">
          <div class="ring" style="--day-ring: conic-gradient(var(--ind-mid) 0 ${a}%, var(--grn-mid) ${a}% ${b}%, var(--track) ${b}% 100%)" role="img" aria-label="${pct} por ciento del día hecho">
            <span><b class="num">${pct}%</b><small>del día</small></span>
          </div>
          <div class="home-day-text">
            <span class="home-label">Tu día</span>
            <strong class="num">${total ? `${doneAll} de ${total} hechos` : "Día libre"}</strong>
            <p>${msg}</p>
            <div class="home-legend"><span style="--c:var(--ind-mid)"><i></i>Tareas ${tk.done}/${tk.list.length}</span><span style="--c:var(--grn-mid)"><i></i>Hábitos ${rt.done}/${rt.total}</span></div>
          </div>
        </div>
        <div>
          <div class="home-focus-head"><h2>Lo importante hoy</h2><small>máximo 3</small></div>
          <div class="home-focus">${focus.length ? focus.map((t) => homeTaskHTML(t, now)).join("") : `<p class="home-empty">Nada urgente. Las tareas vencidas, las de hoy y las de prioridad alta aparecen aquí.</p>`}</div>
        </div>
      </section>
      <div class="home-tiles">${tiles.join("")}</div>
      ${hasRoutine ? `
      <section class="card home-week" aria-label="Tu semana">
        <div class="home-week-head">
          <div><h2>Tu semana</h2><p>${diff === null ? "Así va tu rutina día a día" : diff >= 0 ? "Vas mejor que la semana pasada" : "Un poco por debajo de la semana pasada"}</p></div>
          <span class="trend ${diff !== null && diff < 0 ? "down" : ""}">${diff !== null && diff >= 0 ? homeSvg("up", 2.5) : ""}${wk.pct === null ? "—" : `${wk.pct} %`}${diff !== null ? ` · ${diff >= 0 ? "+" : ""}${diff}` : ""}</span>
        </div>
        <div class="week-bars" role="img" aria-label="Cumplimiento de la rutina cada día de esta semana">${bars}</div>
      </section>` : ""}
    </div>
    <button class="home-fab" data-action="home-add" aria-label="Añadir algo rápido">${homeSvg("plus", 2.5)}</button>`;
}

/* Avance del día en la pestaña Pendientes */
function renderTaskProgress() {
  const box = $("#task-progress");
  if (!box) return;
  const tk = dayTasks(today()), n = tk.list.length;
  if (!n) { box.innerHTML = ""; box.className = ""; return; }
  const all = tk.done === n, pct = Math.round((tk.done / n) * 100);
  box.className = `card day-progress ${all ? "all-done" : ""}`;
  box.innerHTML = `
    <div class="flex-1 min-w-0"><b class="num">Hoy: ${tk.done} de ${n}</b>
      <small>${all ? "Día despejado. Buen trabajo." : tk.overdue ? plural(tk.overdue, "vencida por resolver", "vencidas por resolver") : pct >= 50 ? "Vas bien, sigue así." : "Empieza por la más importante."}</small></div>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance de hoy"><span style="width:${pct}%;--fill:${all ? "var(--grn-mid)" : "var(--accent)"}"></span></div>`;
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
    const t = state.tasks.find((x) => x.id === btn.dataset.id);
    if (!t) return;
    t.done = !t.done;
    homeKeep.add(t.id);
    commitTasks();
    renderTasks();
    renderHome();
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
