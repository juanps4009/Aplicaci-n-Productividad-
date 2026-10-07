"use strict";
/* Trabajo: oportunidades (ofertas y trabajos que el dueño elige seguir) e ingresos (trabajos pagados).
   Lógica pura (sin DOM ni red): la usan la app y el programa de escritorio (herramientas/rutina.mjs), y se prueba con Node.

   Cada oportunidad es un registro
     { id:"o:<x>", kind:"opp", title, url, closes:"AAAA-MM-DD"|"", status, source, note, createdAt }
   status: "review" (por revisar) · "applied" (apliqué) · "replied" (me respondieron) · "discarded" (descartada).
   Cada ingreso es un registro
     { id:"m:<x>", kind:"inc", date:"AAAA-MM-DD", client, amount (pesos enteros), type, note, createdAt }
   type: "claude" (trabajo hecho con Claude) · "onsite" (presencial).
   Ambos viajan por la sincronización junto a la rutina (mismo canal: ver ROUTINE_PREFIX en app.js). */
(function (root) {
  const STATUSES = ["review", "applied", "replied", "discarded"];
  const STATUS_LABEL = { review: "Por revisar", applied: "Apliqué", replied: "Me respondieron", discarded: "Descartada" };
  const MAX_TITLE = 200, MAX_NOTE = 500, MAX_URL = 600, MAX_SOURCE = 60;
  const INCOME_TYPES = ["claude", "onsite"];
  const INCOME_LABEL = { claude: "Con Claude", onsite: "Presencial" };
  const MAX_CLIENT = 100, MAX_INCOME_NOTE = 300, MAX_AMOUNT = 1e10;
  const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const line = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const pad = (n) => String(n).padStart(2, "0");
  function isDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = toDate(s);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === s;
  }

  /* Solo enlaces web normales: nada de javascript:, data:, ni texto con espacios o comillas */
  function cleanUrl(v) {
    const u = String(v ?? "").trim();
    return u.length <= MAX_URL && /^https?:\/\/[^\s<>"'`\\]+$/i.test(u) ? u : "";
  }

  /* Devuelve el registro saneado (oportunidad "o:…" o ingreso "m:…"), o null si no es uno válido */
  function clean(rec) {
    if (rec && typeof rec === "object" && typeof rec.id === "string" && rec.id.startsWith("m:")) return cleanIncome(rec);
    return cleanOpp(rec);
  }
  function cleanOpp(rec) {
    if (!rec || typeof rec !== "object" || typeof rec.id !== "string" || !rec.id.startsWith("o:") || rec.id.length < 3 || rec.id.length > 80) return null;
    const title = line(rec.title, MAX_TITLE);
    if (!title) return null;
    const out = { id: rec.id };
    if (rec.updatedAt) out.updatedAt = rec.updatedAt;
    return { ...out, kind: "opp", title, url: cleanUrl(rec.url), closes: isDate(rec.closes) ? rec.closes : "",
      status: STATUSES.includes(rec.status) ? rec.status : "review", source: line(rec.source, MAX_SOURCE),
      note: String(rec.note ?? "").replace(/\r/g, "").trim().slice(0, MAX_NOTE), createdAt: Number.isFinite(rec.createdAt) ? rec.createdAt : 0 };
  }

  /* Monto en pesos: entero, 0 o más. Acepta número o texto como «1.250.000», «$ 1,250,000» o «85000» */
  function cleanAmount(v) {
    let n = v;
    if (typeof v === "string") {
      const t = v.replace(/[\s$]/g, "");
      if (!/^\d{1,3}([.,]\d{3})+$|^\d+$/.test(t)) return null;
      n = Number(t.replace(/[.,]/g, ""));
    }
    return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT ? Math.round(n) : null;
  }

  /* Devuelve el ingreso saneado, o null si le falta una fecha o un monto válidos */
  function cleanIncome(rec) {
    if (!rec || typeof rec !== "object" || typeof rec.id !== "string" || !rec.id.startsWith("m:") || rec.id.length < 3 || rec.id.length > 80) return null;
    const amount = cleanAmount(rec.amount);
    if (!isDate(rec.date) || amount === null) return null;
    const out = { id: rec.id };
    if (rec.updatedAt) out.updatedAt = rec.updatedAt;
    return { ...out, kind: "inc", date: rec.date, client: line(rec.client, MAX_CLIENT), amount,
      type: INCOME_TYPES.includes(rec.type) ? rec.type : "claude",
      note: String(rec.note ?? "").replace(/\r/g, "").trim().slice(0, MAX_INCOME_NOTE), createdAt: Number.isFinite(rec.createdAt) ? rec.createdAt : 0 };
  }
  const cleanList = (list) => (Array.isArray(list) ? list : []).map(clean).filter(Boolean);

  /* Orden: primero las activas por fecha de cierre (sin fecha al final, las más nuevas antes); las descartadas al final */
  function opps(list, opts) {
    const all = list.filter((r) => r.kind === "opp");
    const rows = opts && opts.all ? all : all.filter((r) => r.status !== "discarded");
    return rows.sort((a, b) => (a.status === "discarded") - (b.status === "discarded")
      || (a.closes || "9999").localeCompare(b.closes || "9999") || b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
  }

  /* Para no repetir una oferta: compara los enlaces sin mayúsculas, sin "#…" y sin barra final */
  const urlKey = (u) => cleanUrl(u).toLowerCase().replace(/#.*$/, "").replace(/\/+$/, "");
  const findByUrl = (list, url) => (urlKey(url) ? list.find((r) => r.kind === "opp" && urlKey(r.url) === urlKey(url)) || null : null);

  function add(list, data, now, uid) {
    const rec = clean({ ...data, id: "o:" + uid, createdAt: now });
    if (rec) list.push(rec);
    return rec;
  }
  function update(list, id, data) {
    const i = list.findIndex((r) => r.id === id && r.kind === "opp");
    if (i < 0) return null;
    const next = clean({ ...list[i], ...data, id });
    if (!next) return null;
    list[i] = next;
    return next;
  }
  function remove(list, id) {
    const i = list.findIndex((r) => r.id === id && r.kind === "opp");
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }
  const setStatus = (list, id, status) => (STATUSES.includes(status) ? update(list, id, { status }) : null);

  /* Días que faltan para el cierre (negativo si ya pasó); null si no tiene fecha */
  function daysLeft(closes, today) {
    if (!isDate(closes) || !isDate(today)) return null;
    return Math.round((toDate(closes) - toDate(today)) / 86400000);
  }

  /* { text:"Cierra en 5 días · 12 oct", level:""|"soon"|"late" } o null si no tiene fecha */
  function closeInfo(opp, today) {
    const n = daysLeft(opp.closes, today);
    if (n === null) return null;
    const d = toDate(opp.closes), date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const text = n < 0 ? `Cerró hace ${-n} día${n === -1 ? "" : "s"} · ${date}` : n === 0 ? `Cierra hoy · ${date}` : n === 1 ? `Cierra mañana · ${date}` : `Cierra en ${n} días · ${date}`;
    return { text, days: n, level: n < 0 ? "late" : n <= 3 ? "soon" : "" };
  }

  /* Activas (por revisar o ya aplicadas) que cierran dentro de `days` días o ya cerraron sin resolverse */
  const closingSoon = (list, today, days) => opps(list).filter((o) => {
    const n = daysLeft(o.closes, today);
    return n !== null && n <= (days ?? 3) && o.status === "review";
  });

  /* ---------- Ingresos ---------- */
  const monthKey = (date) => (isDate(date) ? date.slice(0, 7) : "");
  const isMonth = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  function shiftMonth(m, n) {
    const [y, mo] = m.split("-").map(Number), d = new Date(y, mo - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  const monthLabel = (m) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

  /* $1.250.000 (puntos de mil, sin decimales) */
  const money = (n) => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  /* Ingresos de un mes (o todos), los más recientes primero */
  function incomes(list, month) {
    return list.filter((r) => r.kind === "inc" && (!month || monthKey(r.date) === month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
  }
  function monthTotals(list, month) {
    const t = { total: 0, count: 0, claude: 0, onsite: 0 };
    incomes(list, month).forEach((r) => { t.total += r.amount; t.count++; t[r.type] += r.amount; });
    return t;
  }
  /* Total de cada mes que tiene ingresos, del más reciente al más antiguo */
  function monthsWithIncome(list) {
    return [...new Set(incomes(list).map((r) => monthKey(r.date)))].sort().reverse();
  }

  function addIncome(list, data, now, uid) {
    const rec = cleanIncome({ ...data, id: "m:" + uid, createdAt: now });
    if (rec) list.push(rec);
    return rec;
  }
  function updateIncome(list, id, data) {
    const i = list.findIndex((r) => r.id === id && r.kind === "inc");
    if (i < 0) return null;
    const next = cleanIncome({ ...list[i], ...data, id });
    if (!next) return null;
    list[i] = next;
    return next;
  }
  function removeIncome(list, id) {
    const i = list.findIndex((r) => r.id === id && r.kind === "inc");
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }

  function incomeToMarkdown(list, month) {
    const rows = incomes(list, month), t = monthTotals(list, month);
    const L = [`# Ingresos — ${monthLabel(month)}`, "", `Total: ${money(t.total)} · ${t.count} trabajo${t.count === 1 ? "" : "s"} · Con Claude ${money(t.claude)} · Presencial ${money(t.onsite)}`, ""];
    if (!rows.length) L.push("_No hay ingresos en este mes._");
    rows.forEach((r) => {
      L.push(`- ${r.date} — **${r.client || "Sin cliente"}** — ${money(r.amount)} — ${INCOME_LABEL[r.type]}${r.note ? ` — ${r.note.replace(/\n/g, " ")}` : ""}`);
      L.push(`  \`${r.id}\``);
    });
    return L.join("\n");
  }

  function counts(list) {
    const c = { review: 0, applied: 0, replied: 0, discarded: 0, total: 0 };
    list.forEach((r) => { if (r.kind === "opp") { c[r.status]++; c.total++; } });
    return c;
  }

  /* Texto para leer (lo usa el programa de escritorio) */
  function toMarkdown(list, today, opts) {
    const rows = opps(list, opts), c = counts(list);
    const L = ["# Oportunidades", "", `${c.review} por revisar · ${c.applied} aplicadas · ${c.replied} con respuesta · ${c.discarded} descartadas`, ""];
    if (!rows.length) L.push(opts && opts.all ? "_No hay oportunidades._" : "_No hay oportunidades activas._");
    rows.forEach((o) => {
      const info = closeInfo(o, today);
      L.push(`- **${o.title}** — ${STATUS_LABEL[o.status]}${info ? ` — ${info.text}` : ""}`);
      if (o.url) L.push(`  ${o.url}`);
      if (o.source) L.push(`  Origen: ${o.source}`);
      if (o.note) L.push(`  Nota: ${o.note.replace(/\n/g, " ")}`);
      L.push(`  \`${o.id}\``);
    });
    return L.join("\n");
  }

  const api = { INCOME_TYPES, INCOME_LABEL, MAX_CLIENT, MAX_INCOME_NOTE, cleanAmount, cleanIncome, monthKey, isMonth, shiftMonth, monthLabel, money, incomes, monthTotals, monthsWithIncome, addIncome, updateIncome, removeIncome, incomeToMarkdown,
    STATUSES, STATUS_LABEL, MAX_TITLE, MAX_NOTE, MAX_URL, isDate, cleanUrl, clean, cleanList, opps, findByUrl, add, update, remove, setStatus, daysLeft, closeInfo, closingSoon, counts, toMarkdown };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Work = api;
})(typeof self !== "undefined" ? self : this);
