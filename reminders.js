/* Motor de recordatorios (funciones puras, sin DOM). Se usa en la app y se prueba con Node.
   Un recordatorio es { id, kind, time:"HH:MM", ... } y se calcula siempre en hora local.
   kind: "once" (at:"YYYY-MM-DDTHH:MM" o atMs) · "before" (days antes de task.due) ·
         "daily" · "weekly" (weekday 0=domingo) · "every" (everyHours dentro de winFrom–winTo) */
(function (root) {
  const DAY = 86400000;
  const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  const minutesOf = (hm) => { const [h, m] = String(hm || "09:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const atMinutes = (day, min) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min).getTime();
  const localMs = (iso) => { // "YYYY-MM-DDTHH:MM"
    const [date, time] = iso.split("T");
    return atMinutes(parseDate(date), minutesOf(time));
  };

  /* Instantes (ms) de un recordatorio dentro del intervalo (from, to] */
  function occurrences(rem, task, from, to) {
    const out = [];
    if (to <= from) return out;
    if (rem.kind === "once") {
      const t = rem.atMs != null ? rem.atMs : (rem.at ? localMs(rem.at) : NaN);
      if (t > from && t <= to) out.push(t);
      return out;
    }
    if (rem.kind === "before") {
      if (!task.due) return out;
      const d = parseDate(task.due);
      d.setDate(d.getDate() - (rem.days || 0));
      const t = atMinutes(d, minutesOf(rem.time));
      if (t > from && t <= to) out.push(t);
      return out;
    }
    const start = new Date(Math.max(from, to - 120 * DAY));
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (; day.getTime() <= to; day.setDate(day.getDate() + 1)) {
      if (rem.kind === "weekly" && day.getDay() !== rem.weekday) continue;
      const times = [];
      if (rem.kind === "every") {
        const step = Math.max(1, rem.everyHours || 1) * 60;
        for (let m = minutesOf(rem.winFrom); m <= minutesOf(rem.winTo); m += step) times.push(m);
      } else times.push(minutesOf(rem.time));
      for (const m of times) {
        const t = atMinutes(day, m);
        if (t > from && t <= to) out.push(t);
      }
    }
    return out;
  }

  /* Próximos avisos de una tarea: [{ms, remId}] ordenados. Una tarea completada no avisa. */
  function nextFires(task, from, horizonDays, limit) {
    if (task.done || !task.reminders || !task.reminders.length) return [];
    const to = from + (horizonDays || 14) * DAY;
    const all = [];
    task.reminders.forEach((rem) => occurrences(rem, task, from, to).forEach((ms) => all.push({ ms, remId: rem.id })));
    all.sort((a, b) => a.ms - b.ms);
    return limit ? all.slice(0, limit) : all;
  }

  /* Avisos que ya tocaba disparar: por recordatorio, el último instante en (max(lastFired, created), now] */
  function dueFires(task, now) {
    if (task.done || !task.reminders) return [];
    const res = [];
    task.reminders.forEach((rem) => {
      const from = Math.max(rem.lastFired || 0, rem.created || 0);
      const list = occurrences(rem, task, from, now);
      if (list.length) res.push({ rem, ms: list[list.length - 1], count: list.length });
    });
    return res;
  }

  const fmtTime = (min) => new Date(2000, 0, 1, 0, min).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
  const fmtStamp = (ms) => new Date(ms).toLocaleString("es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  function describe(rem) {
    switch (rem.kind) {
      case "once": return `${rem.auto ? "Pospuesto" : "Una vez"} · ${fmtStamp(rem.atMs != null ? rem.atMs : localMs(rem.at))}`;
      case "before": {
        const n = rem.days || 0;
        return `${n === 0 ? "El día del vencimiento" : `${n} día${n === 1 ? "" : "s"} antes del vencimiento`} · ${fmtTime(minutesOf(rem.time))}`;
      }
      case "daily": return `Todos los días · ${fmtTime(minutesOf(rem.time))}`;
      case "weekly": return `Cada ${DAYS_ES[rem.weekday]} · ${fmtTime(minutesOf(rem.time))}`;
      case "every": return `Cada ${rem.everyHours} h · ${fmtTime(minutesOf(rem.winFrom))} a ${fmtTime(minutesOf(rem.winTo))}`;
      default: return "Recordatorio";
    }
  }

  const api = { occurrences, nextFires, dueFires, describe, fmtStamp, localMs, DAYS_ES, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Reminders = api;
})(typeof self !== "undefined" ? self : this);
