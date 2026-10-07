"use strict";
/* Rutina: pendientes que se repiten cada día, cada semana o cada mes, y su resumen semanal.
   Lógica pura (sin DOM ni red): la usan la app y el programa de escritorio (herramientas/rutina.mjs), y se prueba con Node.

   Todo vive en una lista de registros (un registro por cosa, para que marcar desde el celular y escribir desde el
   computador no se pisen: al sincronizar gana el cambio más reciente POR REGISTRO):
     Ítem       { id:"i:<x>", kind:"item", text, freq:"daily"|"weekly"|"monthly", days:[1..7], order, createdAt }
                days solo aplica a los diarios (1 = lunes … 7 = domingo); vacío = todos los días.
     Periodo    { id:"p:<clave>", kind:"period", done:{ "<id del ítem>": marcaDeTiempo } }
                clave = "2026-10-07" (día), "2026-W41" (semana ISO, de lunes a domingo) o "2026-10" (mes).
     Comentario { id:"r:<semana>", kind:"review", week:"2026-W41", text, by, at } */
(function (root) {
  const FREQS = ["daily", "weekly", "monthly"];
  const FREQ_LABEL = { daily: "Cada día", weekly: "Cada semana", monthly: "Cada mes" };
  const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
  const DAY_NAME = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const MAX_TEXT = 200, MAX_REVIEW = 6000;

  /* ---------- fechas (siempre en hora local, como texto "AAAA-MM-DD") ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isDateKey = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(parseDate(s)) === s;
  function parseDate(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(s, n) {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }
  const dow = (s) => ((parseDate(s).getDay() + 6) % 7) + 1; // 1 = lunes … 7 = domingo
  const monthKey = (s) => s.slice(0, 7);

  /* Semana ISO 8601: la semana 1 es la que tiene el primer jueves del año */
  function weekKey(s) {
    const thursday = parseDate(addDays(s, 4 - dow(s)));
    const jan1 = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.floor(Math.round((thursday - jan1) / 86400000) / 7) + 1;
    return `${thursday.getFullYear()}-W${pad(week)}`;
  }
  const isWeekKey = (s) => typeof s === "string" && /^\d{4}-W\d{2}$/.test(s) && weekKey(weekStart(s)) === s;
  /* Lunes de una semana "AAAA-Wnn" */
  function weekStart(wk) {
    const [y, w] = wk.split("-W").map(Number);
    const jan4 = dateKey(new Date(y, 0, 4)); // el 4 de enero siempre cae en la semana 1
    return addDays(jan4, 1 - dow(jan4) + (w - 1) * 7);
  }
  const weekDates = (wk) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(wk), i));
  const shiftWeek = (wk, n) => weekKey(addDays(weekStart(wk), n * 7));
  const periodKey = (freq, s) => (freq === "weekly" ? weekKey(s) : freq === "monthly" ? monthKey(s) : s);

  /* "5–11 oct" o "28 sep – 4 oct" */
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function weekLabel(wk) {
    const a = parseDate(weekStart(wk)), b = parseDate(addDays(weekStart(wk), 6));
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
      : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  }

  /* ---------- registros válidos (lo que llega de otro dispositivo o del programa se limpia) ---------- */
  const text = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  function cleanDays(v) {
    if (!Array.isArray(v)) return [];
    const set = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
    return set.length === 7 ? [] : set; // los siete días = todos los días
  }

  /* Devuelve el registro saneado o null si no es de la rutina */
  function clean(rec) {
    if (!rec || typeof rec !== "object" || typeof rec.id !== "string" || rec.id.length > 80) return null;
    const base = { id: rec.id };
    if (rec.updatedAt) base.updatedAt = rec.updatedAt;
    if (rec.id.startsWith("i:") && rec.id.length > 2) {
      const t = text(rec.text, MAX_TEXT);
      if (!t) return null;
      const freq = FREQS.includes(rec.freq) ? rec.freq : "daily";
      return { ...base, kind: "item", text: t, freq, days: freq === "daily" ? cleanDays(rec.days) : [],
        order: Number.isFinite(rec.order) ? rec.order : 0, createdAt: Number.isFinite(rec.createdAt) ? rec.createdAt : 0 };
    }
    if (rec.id.startsWith("p:")) {
      const key = rec.id.slice(2);
      if (!isDateKey(key) && !isWeekKey(key) && !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return null;
      const done = {};
      if (rec.done && typeof rec.done === "object") {
        Object.keys(rec.done).slice(0, 500).forEach((k) => {
          if (typeof k === "string" && k.startsWith("i:") && k.length <= 80 && rec.done[k]) done[k] = Number(rec.done[k]) || 1;
        });
      }
      return { ...base, kind: "period", done };
    }
    if (rec.id.startsWith("r:")) {
      const week = rec.id.slice(2);
      if (!isWeekKey(week)) return null;
      const t = String(rec.text ?? "").replace(/\r/g, "").trim().slice(0, MAX_REVIEW);
      if (!t) return null;
      return { ...base, kind: "review", week, text: t, by: text(rec.by, 40) || "Claude", at: Number.isFinite(rec.at) ? rec.at : 0 };
    }
    return null;
  }
  const cleanList = (list) => (Array.isArray(list) ? list : []).map(clean).filter(Boolean);

  /* ---------- ítems ---------- */
  const items = (list, freq) => list.filter((r) => r.kind === "item" && (!freq || r.freq === freq))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));

  function addItem(list, data, now, uid) {
    const all = items(list);
    const rec = clean({ id: "i:" + uid, text: data.text, freq: data.freq, days: data.days,
      order: all.length ? Math.max(...all.map((x) => x.order)) + 1 : 0, createdAt: now });
    if (rec) list.push(rec);
    return rec;
  }

  function updateItem(list, id, data) {
    const i = list.findIndex((r) => r.id === id && r.kind === "item");
    if (i < 0) return null;
    const next = clean({ ...list[i], ...data, id });
    if (!next) return null;
    list[i] = next;
    return next;
  }

  /* Quita un ítem (sus marcas antiguas se quedan en los periodos; ya no se muestran) */
  function removeItem(list, id) {
    const i = list.findIndex((r) => r.id === id && r.kind === "item");
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }

  /* Sube (-1) o baja (+1) un ítem dentro de los de su misma frecuencia */
  function moveItem(list, id, dir) {
    const me = list.find((r) => r.id === id && r.kind === "item");
    if (!me) return false;
    const group = items(list, me.freq);
    const i = group.indexOf(me), j = i + dir;
    if (j < 0 || j >= group.length) return false;
    group.forEach((it, n) => { it.order = n; }); // normaliza por si había empates
    [group[i].order, group[j].order] = [group[j].order, group[i].order];
    return true;
  }

  /* ---------- marcar ---------- */
  /* ¿Este ítem diario toca ese día? (los semanales y mensuales tocan siempre) */
  const dueOn = (item, date) => item.freq !== "daily" || !item.days.length || item.days.includes(dow(date));
  /* Un ítem solo cuenta desde el día en que se creó (para no aparecer como "fallado" en el pasado) */
  const existedOn = (item, date) => !item.createdAt || dateKey(new Date(item.createdAt)) <= date;

  const period = (list, key) => list.find((r) => r.id === "p:" + key && r.kind === "period");
  function isDone(list, item, date) {
    const p = period(list, periodKey(item.freq, date));
    return !!(p && p.done[item.id]);
  }

  function setDone(list, item, date, value, now) {
    const key = periodKey(item.freq, date);
    let p = period(list, key);
    if (!p) {
      if (!value) return false;
      p = { id: "p:" + key, kind: "period", done: {} };
      list.push(p);
    }
    if (value) p.done[item.id] = now || 1; else delete p.done[item.id];
    return !!value;
  }
  const toggle = (list, item, date, now) => setDone(list, item, date, !isDone(list, item, date), now);

  /* Lo de hoy: { daily, weekly, monthly } con { item, done } y el total hecho */
  function today(list, date) {
    const out = { date, week: weekKey(date), month: monthKey(date), done: 0, total: 0 };
    FREQS.forEach((f) => {
      out[f] = items(list, f).filter((it) => dueOn(it, date)).map((item) => ({ item, done: isDone(list, item, date) }));
      out.total += out[f].length;
      out.done += out[f].filter((x) => x.done).length;
    });
    return out;
  }

  /* Días seguidos cumpliendo un ítem diario (hoy sin marcar todavía no rompe la racha) */
  function streak(list, item, date) {
    let n = 0, d = date;
    if (dueOn(item, d) && existedOn(item, d) && !isDone(list, item, d)) d = addDays(d, -1);
    for (let i = 0; i < 400; i++) {
      if (!existedOn(item, d)) break;
      if (dueOn(item, d)) { if (isDone(list, item, d)) n++; else break; }
      d = addDays(d, -1);
    }
    return n;
  }

  /* ---------- resumen de una semana ----------
     celdas de un ítem diario: "done" hecho · "miss" no se hizo · "pending" hoy, aún sin marcar ·
     "future" día que no ha llegado · "na" no tocaba (o el ítem aún no existía) */
  function weekStats(list, wk, todayDate) {
    const dates = weekDates(wk);
    let done = 0, due = 0;
    const daily = items(list, "daily").map((item) => {
      let d = 0, t = 0;
      const cells = dates.map((date) => {
        if (!dueOn(item, date) || !existedOn(item, date)) return "na";
        if (date > todayDate) return "future";
        const ok = isDone(list, item, date);
        if (ok) { d++; t++; return "done"; }
        if (date === todayDate) return "pending";
        t++;
        return "miss";
      });
      done += d; due += t;
      return { item, cells, done: d, due: t, pct: t ? Math.round((d / t) * 100) : null, streak: streak(list, item, todayDate) };
    });
    const last = dates[6] < todayDate ? dates[6] : todayDate; // hasta dónde se puede evaluar la semana
    const started = dates[0] <= todayDate;
    const one = (freq) => items(list, freq).filter((item) => existedOn(item, dates[6])).map((item) => {
      const ok = started && isDone(list, item, freq === "weekly" ? dates[0] : last);
      return { item, done: ok, closed: dates[6] < todayDate };
    });
    const weekly = one("weekly"), monthly = started ? one("monthly") : [];
    weekly.forEach((x) => { if (x.done || x.closed) { due++; if (x.done) done++; } });
    // Un resumen por día (para la tarjeta «Tu semana»): "full" todo hecho · "partial" algo · "miss" nada ·
    // "today" hoy, aún sin terminar · "future" no ha llegado · "empty" ese día no tocaba nada
    const days = dates.map((date, i) => {
      const cells = daily.map((r) => r.cells[i]).filter((c) => c !== "na");
      const d = cells.filter((c) => c === "done").length, total = cells.length;
      const state = !total ? (date > todayDate ? "future" : "empty") : date > todayDate ? "future"
        : d === total ? "full" : date === todayDate ? "today" : d ? "partial" : "miss";
      return { date, done: d, total, state };
    });
    return {
      week: wk, label: weekLabel(wk), dates, started, current: wk === weekKey(todayDate),
      daily, weekly, monthly, days, month: monthKey(last),
      done, due, pct: due ? Math.round((done / due) * 100) : null,
      review: list.find((r) => r.id === "r:" + wk && r.kind === "review") || null,
    };
  }

  /* ---------- comentario de la semana ---------- */
  function setReview(list, wk, body, by, now) {
    const rec = clean({ id: "r:" + wk, text: body, by, at: now });
    const i = list.findIndex((r) => r.id === "r:" + wk);
    if (!rec) { if (i >= 0) list.splice(i, 1); return null; } // texto vacío = quitar el comentario
    if (i >= 0) list[i] = { ...rec, updatedAt: list[i].updatedAt }; else list.push(rec);
    return rec;
  }

  /* ---------- texto para leer (lo usa el programa de escritorio) ---------- */
  function describeDays(item) {
    if (item.freq !== "daily" || !item.days.length) return "";
    if (item.days.join() === "1,2,3,4,5") return "lunes a viernes";
    if (item.days.join() === "6,7") return "fines de semana";
    return item.days.map((d) => DAY_NAME[d - 1]).join(", ");
  }

  function toMarkdown(list, todayDate, wk) {
    const s = weekStats(list, wk || weekKey(todayDate), todayDate);
    const mark = { done: "✓", miss: "✗", pending: "·", future: " ", na: "–" };
    const L = [`# Rutina — semana ${s.week} (${s.label})`, "", `Hoy es ${todayDate} (${DAY_NAME[dow(todayDate) - 1]}).`
      + (s.pct === null ? "" : ` Cumplimiento de la semana: ${s.done} de ${s.due} (${s.pct} %).`), ""];
    L.push("## Cada día", "");
    if (!s.daily.length) L.push("_Sin pendientes diarios._");
    else {
      L.push(`| Pendiente | ${DAY_SHORT.join(" | ")} | Hecho | Racha |`, `|---|${"---|".repeat(7)}---|---|`);
      s.daily.forEach((r) => L.push(`| ${r.item.text}${describeDays(r.item) ? ` _(${describeDays(r.item)})_` : ""} | ${r.cells.map((c) => mark[c]).join(" | ")} | ${r.done}/${r.due} | ${r.streak} |`));
      L.push("", "✓ hecho · ✗ no se hizo · · hoy sin marcar · – no tocaba");
    }
    L.push("", "## Cada semana", "");
    L.push(...(s.weekly.length ? s.weekly.map((r) => `- [${r.done ? "x" : " "}] ${r.item.text}`) : ["_Sin pendientes semanales._"]));
    L.push("", `## Cada mes (${s.month})`, "");
    L.push(...(s.monthly.length ? s.monthly.map((r) => `- [${r.done ? "x" : " "}] ${r.item.text}`) : ["_Sin pendientes mensuales._"]));
    L.push("", "## Comentario de la semana", "", s.review ? s.review.text : "_Sin comentario todavía._", "");
    L.push("## Identificadores (para marcar, editar o quitar)", "");
    items(list).forEach((it) => L.push(`- \`${it.id}\` — ${it.text} (${FREQ_LABEL[it.freq].toLowerCase()})`));
    return L.join("\n");
  }

  const api = {
    FREQS, FREQ_LABEL, DAY_SHORT, DAY_NAME, MAX_TEXT,
    dateKey, parseDate, addDays, dow, weekKey, weekStart, weekDates, shiftWeek, weekLabel, monthKey, periodKey, isDateKey, isWeekKey,
    clean, cleanList, cleanDays, items, addItem, updateItem, removeItem, moveItem,
    dueOn, isDone, setDone, toggle, today, streak, weekStats, setReview, describeDays, toMarkdown,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Routine = api;
})(typeof self !== "undefined" ? self : this);
