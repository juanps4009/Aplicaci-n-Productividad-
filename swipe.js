"use strict";
/* Deslizar para actuar, siempre con «Deshacer»:
   Pendientes: a la derecha la marca hecha (o la devuelve), a la izquierda la pasa a mañana.
   Trabajo: a la derecha avanza el estado de la oferta, a la izquierda la descarta.
   Cargar después de app.js y capture.js. No empieza a menos de 24 px del borde (ahí va el gesto «atrás» del celular). */
(function () {
  const ROWS = "#task-groups li.task-item[data-id]:not(.editing), .wk-card[data-id]";
  const NEXT = { review: "applied", applied: "replied", replied: "replied", discarded: "review" };
  const has = (name) => { try { return typeof eval(name) !== "undefined"; } catch { return false; } }; // eslint-disable-line no-eval
  const notify = (msg, undo) => (window.QuickCapture ? QuickCapture.toast(msg, "Deshacer", undo) : null);
  let drag = null, suppress = false;

  const label = (row, dir) => row.matches(".wk-card") ? (dir > 0 ? "Avanzar" : "Descartar")
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
    if (!drag.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) start(e);
      else if (Math.abs(dy) > 10) drag = null;
      return;
    }
    const w = drag.row.offsetWidth, lim = w * 0.55;
    const d = Math.abs(dx) > lim ? Math.sign(dx) * (lim + (Math.abs(dx) - lim) * 0.25) : dx; // frena después del límite
    drag.dx = dx;
    drag.row.style.transform = `translateX(${d}px)`;
    const dir = dx > 0 ? 1 : -1, u = drag.under;
    u.dataset.dir = dir > 0 ? "right" : "left";
    u.dataset.kind = drag.row.matches(".wk-card") ? "opp" : "task";
    u.firstChild.textContent = label(drag.row, dir);
    u.classList.toggle("armed", Math.abs(dx) > w * 0.33);
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
      const o = has("state") && state.work.find((x) => x.id === id);
      if (!o) return;
      const before = o.status, to = dir > 0 ? NEXT[o.status] : "discarded";
      if (to === before) return;
      Work.setStatus(state.work, id, to); commitRoutine(); renderWork();
      notify(dir > 0 ? `Estado: ${Work.STATUS_LABEL[to].toLowerCase()}` : "Oferta descartada", () => { Work.setStatus(state.work, id, before); commitRoutine(); renderWork(); });
      return;
    }
    const t = has("state") && state.tasks.find((x) => x.id === id);
    if (!t) return;
    const before = { done: t.done, due: t.due };
    const undo = () => { const x = state.tasks.find((y) => y.id === id); if (x) { Object.assign(x, before); persistTasks(); } };
    if (dir > 0) {
      t.done = !t.done; persistTasks();
      notify(t.done ? "Marcada como hecha" : "Vuelve a pendientes", undo);
    } else {
      if (typeof postponeTask === "function") postponeTask(t, 1);
      else { const d = new Date(); d.setDate(d.getDate() + 1); t.due = QuickParse.dateKey(d); persistTasks(); }
      notify("Pasada a mañana", undo);
    }
  }
})();
