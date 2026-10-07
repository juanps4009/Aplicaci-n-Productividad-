/* Lógica pura de la Rutina (sin DOM ni red), usada por la app, por scripts/rutina.mjs y probada con Node.
   Un pendiente de rutina vive en la colección "tasks" (así se sincroniza sin cambiar el servidor) con:
     kind: "routine", freq: "daily" | "weekdays" | "weekly" | "monthly",
     log: { "<periodo>": msTachado }   ← un registro por día ("2026-10-07"), semana ("2026-W41") o mes ("2026-10").
   Al empezar un periodo nuevo el pendiente aparece sin tachar; el historial queda para el resumen semanal. */
(function (root) {
  const FREQS = ["daily", "weekdays", "weekly", "monthly"];
  const LABELS = { daily: "Diaria", weekdays: "Entre semana", weekly: "Semanal", monthly: "Mensual" };
  const LOG_MAX = 400;

  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* Semana ISO: empieza el lunes; la semana 1 es la que contiene el primer jueves del año */
  function weekKey(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dow = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dow);
    const y = t.getUTCFullYear();
    const week = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return `${y}-W${pad(week)}`;
  }
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12), -((d.getDay() + 6) % 7));

  const isRoutine = (t) => !!t && t.kind === "routine";
  const cleanFreq = (f) => (FREQS.includes(f) ? f : "daily");

  function periodKey(freq, d) {
    if (freq === "weekly") return weekKey(d);
    if (freq === "monthly") return monthKey(d);
    return dayKey(d);
  }
  /* ¿Toca este día? Los de "entre semana" no aparecen sábado ni domingo */
  const appliesOn = (item, d) => cleanFreq(item.freq) !== "weekdays" || (d.getDay() >= 1 && d.getDay() <= 5);
  const isDone = (item, d) => !!(item.log && item.log[periodKey(cleanFreq(item.freq), d)]);

  /* Tacha o destacha en el periodo de la fecha d. Devuelve el nuevo estado. */
  function setDone(item, d, done, now) {
    const key = periodKey(cleanFreq(item.freq), d);
    const log = { ...(item.log || {}) };
    if (done) log[key] = now || Date.now(); else delete log[key];
    const keys = Object.keys(log).sort();
    keys.slice(0, Math.max(0, keys.length - LOG_MAX)).forEach((k) => delete log[k]);
    item.log = log;
    return done;
  }

  function make(text, freq, id, now) {
    return { id, kind: "routine", text: String(text).trim(), freq: cleanFreq(freq), log: {}, done: false, priority: "medium", due: "", reminders: [], created: now || Date.now() };
  }

  /* Lo de hoy, la semana y el mes de la fecha d, en el orden de la lista */
  function sections(list, d) {
    const items = list.filter(isRoutine).sort((a, b) => (a.created || 0) - (b.created || 0)); // en el orden en que se crearon
    return [
      { key: "day", label: "Hoy", items: items.filter((t) => (t.freq === "daily" || t.freq === "weekdays") && appliesOn(t, d)) },
      { key: "week", label: "Esta semana", items: items.filter((t) => t.freq === "weekly") },
      { key: "month", label: "Este mes", items: items.filter((t) => t.freq === "monthly") },
    ].map((s) => ({ ...s, done: s.items.filter((t) => isDone(t, d)).length }));
  }

  /* Cumplimiento de la semana (lunes a domingo) que contiene d, contando solo hasta d.
     Un pendiente diario cuenta desde el día en que se creó. */
  function weekStats(list, d) {
    const items = list.filter(isRoutine);
    const mon = mondayOf(d), end = dayKey(d);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(mon, i), k = dayKey(day);
      const daily = items.filter((t) => (t.freq === "daily" || t.freq === "weekdays") && appliesOn(t, day) && (!t.created || dayKey(new Date(t.created)) <= k));
      days.push({ date: k, future: k > end, total: daily.length, done: daily.filter((t) => t.log && t.log[k]).length });
    }
    const perItem = items.map((t) => {
      if (t.freq === "weekly") return { item: t, done: isDone(t, d) ? 1 : 0, total: 1 };
      if (t.freq === "monthly") return { item: t, done: isDone(t, d) ? 1 : 0, total: 1 };
      const due = days.filter((x) => !x.future && appliesOn(t, parseDay(x.date)) && (!t.created || dayKey(new Date(t.created)) <= x.date));
      return { item: t, done: due.filter((x) => t.log && t.log[x.date]).length, total: due.length };
    });
    const counted = perItem.filter((p) => p.item.freq !== "monthly");
    const done = counted.reduce((a, p) => a + p.done, 0), total = counted.reduce((a, p) => a + p.total, 0);
    return { week: weekKey(d), from: dayKey(mon), to: dayKey(addDays(mon, 6)), days, perItem, done, total, pct: total ? Math.round((100 * done) / total) : 0 };
  }

  const api = { FREQS, LABELS, isRoutine, cleanFreq, periodKey, dayKey, weekKey, monthKey, parseDay, appliesOn, isDone, setDone, make, sections, weekStats };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Routine = api;
})(typeof self !== "undefined" ? self : this);
