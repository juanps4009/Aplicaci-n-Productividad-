"use strict";
/* Deslizar para actuar, siempre con «Deshacer»:
   Inicio (.home-task): a la derecha la marca hecha (o la devuelve).
   Pendientes: a la derecha la marca hecha (o la devuelve), a la izquierda la pasa a mañana.
   Rutina (.rt-item): a la derecha marca el hábito como hecho (o lo devuelve).
   Trabajo (.wk-card): a la derecha avanza el estado de la oferta, a la izquierda la descarta.
   Cargar después de app.js y capture.js. No empieza a menos de 24 px del borde (ahí va el gesto «atrás» del celular). */
(function () {
  const ROWS = "#task-groups li.task-item[data-id]:not(.editing), .home-task[data-id], .rt-item[data-id]:not(.editing), .wk-card[data-id]";
  const NEXT = { review: "applied", applied: "replied", replied: "replied", discarded: "review" };
  const hasState = () => typeof state !== "undefined"; // «state» lo declara app.js
  const notify = (msg, undo) => (window.QuickCapture ? QuickCapture.toast(msg, "Deshacer", undo) : null);
  let drag = null, suppress = false;

  const label = (row, dir) => row.matches(".wk-card")
    ? (dir > 0 ? (row.classList.contains("s-discarded") ? "Restaurar" : "Avanzar") : "Descartar")
    : dir > 0 ? (row.classList.contains("done") ? "Pendiente" : "Hecha") : "Mañana";

  document.addEventListener("pointerdown", (e) => {
    if (drag || e.button) return;
    const row = e.target.closest(ROWS);
    if (!row || e.target.closest("input, [contenteditable='true'], a")) return;
    if (e.clientX < 24 || e.clientX > innerWidth - 24) return;
    drag = { row, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, on: false, pid: e.pointerId, under: null };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    const rightOnly = drag.row.matches(".home-task, .rt-item") || (drag.row.matches(".wk-card") && drag.row.classList.contains("s-discarded"));
    const leftOnly = drag.row.matches(".wk-card") && drag.row.classList.contains("s-replied");
    if (!drag.on) {
      if (rightOnly && dx < 0) return;
      if (leftOnly && dx > 0) return;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) start(e);
      else if (Math.abs(dy) > 10) drag = null;
      return;
    }
    const clampedDx = rightOnly ? Math.max(0, dx) : leftOnly ? Math.min(0, dx) : dx;
    const w = drag.row.offsetWidth, lim = w * 0.55;
    const d = Math.abs(clampedDx) > lim ? Math.sign(clampedDx) * (lim + (Math.abs(clampedDx) - lim) * 0.25) : clampedDx; // frena después del límite
    drag.dx = clampedDx;
    drag.row.style.transform = `translateX(${d}px)`;
    const dir = clampedDx >= 0 ? 1 : -1, u = drag.under;
    u.dataset.dir = dir > 0 ? "right" : "left";
    u.dataset.kind = drag.row.matches(".wk-card") ? "opp" : "task";
    u.firstChild.textContent = label(drag.row, dir);
    u.classList.toggle("armed", Math.abs(clampedDx) > w * 0.33);
  });
  function start(e) {
    drag.on = true;
    try { drag.row.setPointerCapture(e.pointerId); } catch { /* el puntero ya no existe */ }
    const r = drag.row.getBoundingClientRect(), u = document.createElement("div");
    u.className = "qc-under"; u.setAttribute("aria-hidden", "true");
    u.innerHTML = "<span></span>";
    Object.assign(u.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px", borderRadius: getComputedStyle(drag.row).borderRadius });
    document.body.append(u);
    drag.under = u;
    drag.row.classList.add("qc-dragging");
  }
  function end(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const { row, dx, t0, on, under } = drag;
    drag = null;
    if (!on) return;
    suppress = true; setTimeout(() => (suppress = false), 60);
    row.classList.remove("qc-dragging");
    const w = row.offsetWidth, v = Math.abs(dx) / (performance.now() - t0);
    const done = e.type !== "pointercancel" && (Math.abs(dx) > w * 0.33 || (v > 0.6 && Math.abs(dx) > 48));
    row.style.transition = "transform .22s cubic-bezier(.23,1,.32,1)";
    row.style.transform = done ? `translateX(${Math.sign(dx) * w}px)` : "";
    setTimeout(() => {
      under.remove(); row.style.transition = ""; row.style.transform = "";
      if (done) commit(row, dx > 0 ? 1 : -1);
    }, 220);
  }
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("click", (e) => { if (suppress && e.target.closest(ROWS)) { e.preventDefault(); e.stopPropagation(); suppress = false; } }, true);

  function commit(row, dir) {
    const id = row.dataset.id;
    if (row.matches(".wk-card")) {
      const o = hasState() && state.work.find((x) => x.id === id);
      if (!o) return;
      const before = o.status, to = dir > 0 ? NEXT[o.status] : "discarded";
      if (to === before) return;
      Work.setStatus(state.work, id, to); commitRoutine(); renderWork();
      notify(dir > 0 ? `Estado: ${Work.STATUS_LABEL[to].toLowerCase()}` : "Oferta descartada", () => { Work.setStatus(state.work, id, before); commitRoutine(); renderWork(); });
      return;
    }
    if (row.matches(".rt-item")) {
      if (dir < 0) return;
      const item = hasState() && state.routine.find((r) => r.id === id && r.kind === "item");
      if (!item) return;
      const now = today();
      const prev = Routine.isDone(state.routine, item, now);
      Routine.setDone(state.routine, item, now, !prev, Date.now());
      if (!prev && state.settings?.estilo === "vivo" && navigator.vibrate) navigator.vibrate(8);
      if (!prev && typeof markRoutineJustChecked === "function") markRoutineJustChecked(id);
      commitRoutine(); renderRoutine();
      notify(!prev ? "Marcado como hecho" : "Vuelve a pendientes", () => {
        const it = state.routine.find((r) => r.id === id && r.kind === "item");
        if (it) { Routine.setDone(state.routine, it, now, prev, Date.now()); commitRoutine(); renderRoutine(); }
      });
      return;
    }
    if (row.matches(".home-task") && dir < 0) return;
    const t = hasState() && state.tasks.find((x) => x.id === id);
    if (!t) return;
    const before = { done: t.done, due: t.due };
    const undo = () => { const x = state.tasks.find((y) => y.id === id); if (x) { Object.assign(x, before); persistTasks(); } };
    if (dir > 0) {
      t.done = !t.done;
      if (row.matches(".home-task") && typeof homeKeep !== "undefined") homeKeep.add(t.id);
      if (t.done && state.settings?.estilo === "vivo" && navigator.vibrate) navigator.vibrate(8);
      persistTasks();
      notify(t.done ? "Marcada como hecha" : "Vuelve a pendientes", undo);
    } else {
      if (typeof postponeTask === "function") { postponeTask(t, 1); return; } // ya muestra su propio «Deshacer»
      const d = new Date(); d.setDate(d.getDate() + 1); t.due = QuickParse.dateKey(d); persistTasks();
      notify("Pasada a mañana", undo);
    }
  }
})();
