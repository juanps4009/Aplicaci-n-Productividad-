#!/usr/bin/env node
/* Programa de escritorio para leer y cambiar la RUTINA, las OPORTUNIDADES y las TAREAS de la app
   (lo usa Claude en el computador del dueño, también en sus resúmenes programados).
   Habla con el mismo servidor de sincronización que la app y cifra igual (sync.js); la lógica es routine.js y work.js.

   El código de sincronización se toma de la variable de entorno PENDIENTES_CODIGO o, si no existe, de un archivo
   local que el dueño guarda una sola vez:  %USERPROFILE%\.pendientes\codigo.txt  (o la ruta de PENDIENTES_CODIGO_ARCHIVO).
   Este programa NUNCA lo imprime ni lo guarda en otro sitio, y no está en el repositorio.

   Uso:  node herramientas/rutina.mjs <orden> [opciones]
     hoy [--json]                                   tareas pendientes, rutina del día, semana y oportunidades
     ver [--semana 2026-W41] [--json]               rutina y cumplimiento de la semana

     agregar "texto" [--frecuencia diaria|semanal|mensual] [--dias lunes,miércoles]      (pendiente de la rutina)
     editar <id o texto> [--texto "…"] [--frecuencia …] [--dias …]
     quitar <id o texto>
     marcar <id o texto> [--fecha AAAA-MM-DD]       desmarcar <id o texto> [--fecha …]
     comentario [--semana 2026-W41] (--archivo comentario.md | --texto "…")     (texto vacío = quitarlo)
     importar <archivo.json> [--reemplazar]         carga una lista de rutina (formato en RUTINA-GUIA.md)
     exportar                                       imprime la rutina en ese mismo formato

     tarea agregar "texto" [--prioridad alta|media|baja] [--vence AAAA-MM-DD]             (pestaña Pendientes)

     oportunidades [--todas] [--json]
     oportunidad agregar "título" [--enlace URL] [--cierra AAAA-MM-DD] [--estado …] [--nota "…"] [--fuente "…"]
     oportunidad estado <id, texto o enlace> <por revisar|apliqué|me respondieron|descartada>
     oportunidad editar <id, texto o enlace> [--titulo] [--enlace] [--cierra] [--nota] [--fuente]
     oportunidad quitar <id, texto o enlace>

     revisar                                        comprueba el código y la conexión */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const Sync = require(join(ROOT, "sync.js"));
const Routine = require(join(ROOT, "routine.js"));
const Work = require(join(ROOT, "work.js"));

const PREFIX = "rt:"; // la rutina y las oportunidades viajan por el servidor como «books» con este prefijo (ver app.js)
export const CODE_FILE = process.env.PENDIENTES_CODIGO_ARCHIVO || join(homedir(), ".pendientes", "codigo.txt");

class Fallo extends Error {}
const fail = (msg) => { throw new Fallo(msg); };

/* ---------- configuración ---------- */
function readServer() {
  if (process.env.PENDIENTES_SERVIDOR) return process.env.PENDIENTES_SERVIDOR.replace(/\/+$/, "");
  const m = /server:\s*"([^"]*)"/.exec(readFileSync(join(ROOT, "config.js"), "utf8"));
  if (!m || !m[1]) fail("No encuentro la dirección del servidor en config.js.");
  return m[1].replace(/\/+$/, "");
}

/* El código: primero la variable de entorno PENDIENTES_CODIGO; si no, el archivo local */
function readCode(env) {
  const fromEnv = env.envCode !== undefined ? env.envCode : process.env.PENDIENTES_CODIGO;
  if (fromEnv) {
    const code = Sync.normalizeCode(fromEnv);
    if (!Sync.isValidCode(code)) fail("La variable de entorno PENDIENTES_CODIGO no contiene un código válido (deben ser 20 letras y números).");
    return code;
  }
  const file = env.codeFile || CODE_FILE;
  if (!existsSync(file)) fail(`Falta tu código de sincronización. Ponlo en la variable de entorno PENDIENTES_CODIGO o en el archivo:\n  ${file}\n(en la app: Ajustes → Sincronizar mis dispositivos → Copiar).`);
  const code = Sync.normalizeCode(readFileSync(file, "utf8"));
  if (!Sync.isValidCode(code)) fail(`El archivo ${file} no contiene un código válido (deben ser 20 letras y números, como K7QM-2XPD-9RVA-4HNT-B3WE).`);
  return code;
}

/* ---------- servidor ---------- */
async function post(ctx, since, records) {
  const res = await ctx.fetch(`${ctx.server}/space/sync`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ space: ctx.space, since, records }),
  });
  if (!res.ok) fail(`El servidor respondió ${res.status}${res.status === 429 ? " (demasiadas peticiones; espera un minuto)" : ""}.`);
  return res.json();
}

/* Baja todo: { list (rutina), work (oportunidades), tasks (tareas, tal cual), stamps ("col|id" → updatedAt) } */
async function pull(ctx) {
  const latest = new Map();
  let since = 0, more = true;
  while (more) {
    const data = await post(ctx, since, []);
    for (const r of data.records) {
      const k = r.col + "|" + r.id, prev = latest.get(k);
      if (!prev || r.updatedAt >= prev.updatedAt) latest.set(k, r);
    }
    since = data.seq;
    more = data.more;
  }
  const list = [], work = [], tasks = [], stamps = new Map();
  for (const [k, r] of latest) {
    stamps.set(k, r.updatedAt);
    if (r.deleted) continue;
    const mine = r.col === "books" && r.id.startsWith(PREFIX);
    if (!mine && r.col !== "tasks") continue; // los resúmenes de libros no se tocan
    const plain = await Sync.decryptText(ctx.key, r.data, `${r.id}|${r.col}`);
    if (plain === null) continue; // cifrado con otro código
    let obj;
    try { obj = JSON.parse(plain); } catch { continue; }
    if (!obj || typeof obj !== "object") continue;
    if (r.col === "tasks") { tasks.push({ ...obj, id: r.id }); continue; }
    const id = r.id.slice(PREFIX.length);
    const rec = Routine.clean({ ...obj, id }), opp = rec ? null : Work.clean({ ...obj, id });
    if (rec) list.push(rec); else if (opp) work.push(opp);
  }
  return { list, work, tasks, stamps };
}

const sig = (rec) => { const { updatedAt, ...rest } = rec; return JSON.stringify(rest); };

/* Sube lo que cambió respecto a `before` ("col|id" → firma) y los borrados. entries: [{ col, id, rec }] */
async function pushChanges(ctx, entries, before, stamps) {
  const now = ctx.now();
  const out = [];
  const stamp = (k) => Math.max(now, (stamps.get(k) || 0) + 1); // siempre más nuevo que lo que hay en el servidor
  const present = new Set();
  for (const { col, id, rec } of entries) {
    const k = col + "|" + id;
    present.add(k);
    if (before.get(k) === sig(rec)) continue;
    const updatedAt = stamp(k);
    out.push({ id, col, updatedAt, deleted: 0, data: await Sync.encryptText(ctx.key, JSON.stringify({ ...rec, updatedAt }), `${id}|${col}`) });
  }
  for (const k of before.keys()) {
    if (present.has(k)) continue;
    const [col, ...rest] = k.split("|");
    out.push({ id: rest.join("|"), col, updatedAt: stamp(k), deleted: 1, data: "" });
  }
  for (let i = 0; i < out.length; i += 100) await post(ctx, 0, out.slice(i, i + 100));
  return out.length;
}

/* ---------- argumentos ---------- */
function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) opt[k] = argv[++i]; else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

const plain = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FREQ = { diaria: "daily", diario: "daily", dia: "daily", daily: "daily", semanal: "weekly", semana: "weekly", weekly: "weekly", mensual: "monthly", mes: "monthly", monthly: "monthly" };
function parseFreq(v) {
  const f = FREQ[plain(v)];
  if (!f) fail(`Frecuencia desconocida: «${v}». Usa diaria, semanal o mensual.`);
  return f;
}
const DAYS = { lunes: 1, lun: 1, martes: 2, mar: 2, miercoles: 3, mie: 3, jueves: 4, jue: 4, viernes: 5, vie: 5, sabado: 6, sab: 6, domingo: 7, dom: 7 };
function parseDays(v) {
  if (Array.isArray(v)) v = v.join(",");
  const t = plain(v);
  if (!t || t === "todos" || t === "todos los dias") return [];
  if (t === "lunes a viernes" || t === "laborales" || t === "entre semana") return [1, 2, 3, 4, 5];
  if (t === "fines de semana" || t === "fin de semana") return [6, 7];
  return Routine.cleanDays(t.split(/[\s,;]+|\by\b/).filter(Boolean).map((d) => {
    const n = DAYS[d] || Number(d);
    if (!(n >= 1 && n <= 7)) fail(`Día desconocido: «${d}». Usa lunes…domingo o números del 1 (lunes) al 7 (domingo).`);
    return n;
  }));
}
const PRIO = { alta: "high", high: "high", media: "medium", medium: "medium", normal: "medium", baja: "low", low: "low" };
const PRIO_OUT = { high: "alta", medium: "media", low: "baja" };
function parsePrio(v) {
  const p = PRIO[plain(v)];
  if (!p) fail(`Prioridad desconocida: «${v}». Usa alta, media o baja.`);
  return p;
}
const STATUS = { "por revisar": "review", revisar: "review", pendiente: "review", review: "review", aplique: "applied", aplicada: "applied", applied: "applied",
  "me respondieron": "replied", respondieron: "replied", respuesta: "replied", replied: "replied", descartada: "discarded", descartar: "discarded", discarded: "discarded" };
function parseStatus(v) {
  const s = STATUS[plain(v)];
  if (!s) fail(`Estado desconocido: «${v}». Usa: por revisar, apliqué, me respondieron o descartada.`);
  return s;
}
function parseDate(v, what) {
  if (!Routine.isDateKey(String(v))) fail(`${what} inválida: «${v}». Usa AAAA-MM-DD.`);
  return String(v);
}

/* Un ítem de la rutina por su id ("i:…") o por un trozo de su texto (si solo uno coincide) */
function findItem(list, ref) {
  if (!ref) fail("Falta decir qué pendiente (su id o parte de su texto).");
  const items = Routine.items(list);
  const byId = items.find((it) => it.id === ref);
  if (byId) return byId;
  const hits = items.filter((it) => plain(it.text).includes(plain(ref)));
  if (hits.length === 1) return hits[0];
  fail(hits.length ? `«${ref}» coincide con varios pendientes: ${hits.map((h) => `${h.id} (${h.text})`).join("; ")}. Usa el id.` : `No hay ningún pendiente que coincida con «${ref}».`);
}

/* Una oportunidad por su id ("o:…"), su enlace o un trozo de su título */
function findOpp(work, ref) {
  if (!ref) fail("Falta decir qué oportunidad (su id, su enlace o parte de su título).");
  const all = Work.opps(work, { all: true });
  const exact = all.find((o) => o.id === ref) || Work.findByUrl(work, ref);
  if (exact) return exact;
  const hits = all.filter((o) => plain(o.title).includes(plain(ref)));
  if (hits.length === 1) return hits[0];
  fail(hits.length ? `«${ref}» coincide con varias oportunidades: ${hits.map((h) => `${h.id} (${h.title})`).join("; ")}. Usa el id.` : `No hay ninguna oportunidad que coincida con «${ref}».`);
}

const FREQ_OUT = { daily: "diaria", weekly: "semanal", monthly: "mensual" };
const exportData = (list) => ({ rutina: Routine.items(list).map((it) => ({
  texto: it.text, frecuencia: FREQ_OUT[it.freq], ...(it.days.length ? { dias: it.days.map((d) => Routine.DAY_NAME[d - 1]) } : {}),
})) });

/* Tareas sin completar: primero las vencidas y las de fecha más cercana; luego por prioridad */
const RANK = { high: 0, medium: 1, low: 2 };
const pendingTasks = (tasks) => tasks.filter((t) => !t.done && String(t.text || "").trim())
  .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1));

function todayMarkdown(d) {
  const L = [`# Hoy — ${Routine.DAY_NAME[Routine.dow(d.hoy) - 1]} ${d.hoy}`, ""];
  L.push(`## Tareas pendientes (${d.tareas.length})`, "");
  L.push(...(d.tareas.length ? d.tareas.map((t) => `- [${PRIO_OUT[t.prioridad] || "media"}] ${t.texto}${t.vence ? ` — vence ${t.vence}${t.vencida ? " (VENCIDA)" : ""}` : ""}`) : ["_Ninguna._"]));
  L.push("", `## Rutina de hoy (${d.rutina.hechos} de ${d.rutina.total})`, "");
  const row = (x) => `- [${x.hecho ? "x" : " "}] ${x.texto}`;
  L.push(...(d.rutina.total ? [...d.rutina.diarios.map(row), ...d.rutina.semanales.map((x) => row(x) + " _(semanal)_"), ...d.rutina.mensuales.map((x) => row(x) + " _(mensual)_")] : ["_Hoy no toca nada._"]));
  L.push("", `## Semana ${d.semana.semana} (${d.semana.etiqueta})`, "", d.semana.porcentaje === null ? "_Sin datos todavía._" : `Cumplimiento: ${d.semana.hechos} de ${d.semana.tocaban} (${d.semana.porcentaje} %).`);
  const c = d.oportunidades.cuenta;
  L.push("", "## Oportunidades", "", `${c.review} por revisar · ${c.applied} aplicadas · ${c.replied} con respuesta`);
  if (d.oportunidades.cierranPronto.length) L.push("", "Cierran pronto y siguen sin revisar:", ...d.oportunidades.cierranPronto.map((o) => `- ${o.titulo} — ${o.cierre}${o.enlace ? ` — ${o.enlace}` : ""}`));
  return L.join("\n");
}

/* ---------- órdenes ---------- */
export async function run(argv, env = {}) {
  const { pos, opt } = parseArgs(argv);
  const cmd = pos[0];
  const out = [];
  const say = (s) => out.push(s);
  if (!cmd || cmd === "ayuda" || opt.help) {
    say(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].split("\n").slice(1).join("\n").trim());
    return out.join("\n");
  }

  const now = env.now || (() => Date.now());
  const code = env.code || readCode(env);
  const ctx = { fetch: env.fetch || fetch, server: env.server || readServer(), now,
    space: await Sync.spaceId(code), key: await Sync.deriveKey(code) };
  const today = Routine.dateKey(new Date(now()));

  const { list, work, tasks, stamps } = await pull(ctx);
  if (cmd === "revisar") {
    say(`Todo bien: el código es válido y el servidor responde. La rutina tiene ${Routine.items(list).length} pendiente(s) y hay ${Work.counts(work).total} oportunidad(es).`);
    return out.join("\n");
  }

  // estado de partida de lo que este programa puede cambiar (rutina y oportunidades); las tareas solo se añaden
  const wire = (rec) => ({ col: "books", id: PREFIX + rec.id, rec });
  const before = new Map([...list, ...work].map((r) => ["books|" + PREFIX + r.id, sig(r)]));
  const newTasks = [];
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dateOpt = () => (opt.fecha ? parseDate(opt.fecha, "Fecha") : today);
  const weekOpt = () => {
    if (!opt.semana) return Routine.weekKey(today);
    if (!Routine.isWeekKey(opt.semana)) fail(`Semana inválida: «${opt.semana}». Usa el formato 2026-W41.`);
    return opt.semana;
  };
  const oppLine = (o) => `${o.id}: ${o.title} (${Work.STATUS_LABEL[o.status].toLowerCase()}${o.closes ? `, cierra ${o.closes}` : ""})`;

  switch (cmd) {
    case "hoy": {
      const t = Routine.today(list, today), s = Routine.weekStats(list, Routine.weekKey(today), today);
      const rows = (xs) => xs.map((x) => ({ id: x.item.id, texto: x.item.text, hecho: x.done }));
      const data = {
        hoy: today,
        tareas: pendingTasks(tasks).map((x) => ({ id: x.id, texto: String(x.text), prioridad: x.priority || "medium", vence: x.due || "", vencida: !!x.due && x.due < today })),
        rutina: { hechos: t.done, total: t.total, diarios: rows(t.daily), semanales: rows(t.weekly), mensuales: rows(t.monthly) },
        semana: { semana: s.week, etiqueta: s.label, hechos: s.done, tocaban: s.due, porcentaje: s.pct, dias: s.days.map((d) => ({ fecha: d.date, hechos: d.done, total: d.total, estado: d.state })) },
        oportunidades: { cuenta: Work.counts(work), cierranPronto: Work.closingSoon(work, today, 3).map((o) => ({ id: o.id, titulo: o.title, enlace: o.url, cierre: Work.closeInfo(o, today).text })) },
      };
      say(opt.json ? JSON.stringify(data, null, 2) : todayMarkdown(data));
      return out.join("\n");
    }
    case "ver":
      if (opt.json) say(JSON.stringify({ hoy: today, ...Routine.weekStats(list, weekOpt(), today), items: Routine.items(list) }, null, 2));
      else say(Routine.toMarkdown(list, today, weekOpt()));
      return out.join("\n");
    case "exportar":
      say(JSON.stringify(exportData(list), null, 2));
      return out.join("\n");
    case "oportunidades":
      say(opt.json ? JSON.stringify({ hoy: today, cuenta: Work.counts(work), oportunidades: Work.opps(work, { all: !!opt.todas }) }, null, 2) : Work.toMarkdown(work, today, { all: !!opt.todas }));
      return out.join("\n");
    case "agregar": {
      const rec = Routine.addItem(list, { text: pos.slice(1).join(" "), freq: parseFreq(opt.frecuencia || "diaria"), days: opt.dias ? parseDays(opt.dias) : [] }, now(), uid());
      if (!rec) fail("Falta el texto del pendiente.");
      say(`Añadido ${rec.id}: ${rec.text} (${FREQ_OUT[rec.freq]}${Routine.describeDays(rec) ? ", " + Routine.describeDays(rec) : ""}).`);
      break;
    }
    case "editar": {
      const it = findItem(list, pos[1]);
      const data = {};
      if (opt.texto !== undefined) data.text = String(opt.texto);
      if (opt.frecuencia) data.freq = parseFreq(opt.frecuencia);
      if (opt.dias !== undefined) data.days = parseDays(opt.dias);
      if (!Object.keys(data).length) fail("Di qué cambiar: --texto, --frecuencia o --dias.");
      const rec = Routine.updateItem(list, it.id, data) || fail("El texto no puede quedar vacío.");
      say(`Cambiado ${rec.id}: ${rec.text} (${FREQ_OUT[rec.freq]}${Routine.describeDays(rec) ? ", " + Routine.describeDays(rec) : ""}).`);
      break;
    }
    case "quitar": {
      const it = findItem(list, pos[1]);
      Routine.removeItem(list, it.id);
      say(`Quitado ${it.id}: ${it.text}.`);
      break;
    }
    case "marcar": case "desmarcar": {
      const it = findItem(list, pos[1]), date = dateOpt();
      Routine.setDone(list, it, date, cmd === "marcar", now());
      say(`${cmd === "marcar" ? "Marcado" : "Desmarcado"} «${it.text}» (${Routine.periodKey(it.freq, date)}).`);
      break;
    }
    case "comentario": {
      const wk = weekOpt();
      const body = opt.archivo ? readFileSync(String(opt.archivo), "utf8") : opt.texto === true || opt.texto === undefined ? fail("Falta --archivo o --texto.") : String(opt.texto);
      const rec = Routine.setReview(list, wk, body, opt.autor ? String(opt.autor) : "Claude", now());
      say(rec ? `Comentario de la semana ${wk} guardado (${rec.text.length} caracteres).` : `Comentario de la semana ${wk} quitado.`);
      break;
    }
    case "importar": {
      if (!pos[1]) fail("Falta el archivo .json a importar.");
      let data;
      try { data = JSON.parse(readFileSync(pos[1], "utf8").replace(/^﻿/, "")); } catch (e) { fail(`No pude leer ${pos[1]} como JSON: ${e.message}`); }
      const rows = Array.isArray(data) ? data : data && data.rutina;
      if (!Array.isArray(rows)) fail('El archivo debe tener la forma { "rutina": [ { "texto": "…", "frecuencia": "diaria" } ] }.');
      const wanted = rows.map((r, i) => {
        const text = r && (r.texto ?? r.text);
        if (!text || !String(text).trim()) fail(`El pendiente n.º ${i + 1} no tiene texto.`);
        const freq = parseFreq(r.frecuencia ?? r.freq ?? "diaria");
        return { text: String(text), freq, days: freq === "daily" && (r.dias ?? r.days) ? parseDays(r.dias ?? r.days) : [] };
      });
      const keyOf = (t, f) => plain(t).replace(/\s+/g, " ") + "|" + f;
      let added = 0, changed = 0, removed = 0;
      const keep = new Set();
      wanted.forEach((w) => {
        const found = Routine.items(list).find((it) => keyOf(it.text, it.freq) === keyOf(w.text, w.freq));
        if (found) {
          keep.add(found.id);
          if (found.days.join() !== w.days.join()) { Routine.updateItem(list, found.id, { days: w.days }); changed++; }
        } else { keep.add(Routine.addItem(list, w, now(), uid()).id); added++; }
      });
      if (opt.reemplazar) Routine.items(list).filter((it) => !keep.has(it.id)).forEach((it) => { Routine.removeItem(list, it.id); removed++; });
      say(`Importado: ${added} añadido(s), ${changed} cambiado(s)${opt.reemplazar ? `, ${removed} quitado(s)` : ""}. La rutina tiene ahora ${Routine.items(list).length} pendiente(s).`);
      break;
    }
    case "tarea": {
      if (pos[1] !== "agregar") fail("Con las tareas solo se puede: tarea agregar \"texto\" [--prioridad …] [--vence …].");
      const text = pos.slice(2).join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!text) fail("Falta el texto de la tarea.");
      // misma forma que crea la app (ver el formulario de tareas y migrateTask en app.js)
      const task = { id: uid(), text, done: false, priority: parsePrio(opt.prioridad || "media"), due: opt.vence ? parseDate(opt.vence, "Fecha de vencimiento") : "", reminders: [], doc: [] };
      newTasks.push(task);
      say(`Tarea añadida: ${task.text} (prioridad ${PRIO_OUT[task.priority]}${task.due ? `, vence ${task.due}` : ""}).`);
      break;
    }
    case "oportunidad": {
      const sub = pos[1];
      if (sub === "agregar") {
        const title = pos.slice(2).join(" ");
        if (!title.trim()) fail("Falta el título de la oportunidad.");
        if (opt.enlace && opt.enlace !== true && !Work.cleanUrl(opt.enlace)) fail(`Enlace inválido: «${opt.enlace}». Debe empezar con http:// o https://.`);
        const url = opt.enlace && opt.enlace !== true ? String(opt.enlace) : "";
        const dup = Work.findByUrl(work, url);
        if (dup) { say(`Ya estaba: ${oppLine(dup)}. No se duplica.`); break; }
        const rec = Work.add(work, { title, url, closes: opt.cierra ? parseDate(opt.cierra, "Fecha de cierre") : "", status: opt.estado ? parseStatus(opt.estado) : "review",
          note: opt.nota && opt.nota !== true ? String(opt.nota) : "", source: opt.fuente && opt.fuente !== true ? String(opt.fuente) : "" }, now(), uid());
        say(`Oportunidad añadida ${oppLine(rec)}.`);
      } else if (sub === "estado") {
        const o = findOpp(work, pos[2]);
        const rec = Work.setStatus(work, o.id, parseStatus(pos.slice(3).join(" ") || fail("Falta el estado nuevo.")));
        say(`Estado cambiado ${oppLine(rec)}.`);
      } else if (sub === "editar") {
        const o = findOpp(work, pos[2]), data = {};
        if (opt.titulo !== undefined) data.title = String(opt.titulo);
        if (opt.enlace !== undefined) { if (opt.enlace !== true && opt.enlace && !Work.cleanUrl(opt.enlace)) fail(`Enlace inválido: «${opt.enlace}».`); data.url = opt.enlace === true ? "" : String(opt.enlace); }
        if (opt.cierra !== undefined) data.closes = opt.cierra === true || !opt.cierra ? "" : parseDate(opt.cierra, "Fecha de cierre");
        if (opt.nota !== undefined) data.note = opt.nota === true ? "" : String(opt.nota);
        if (opt.fuente !== undefined) data.source = opt.fuente === true ? "" : String(opt.fuente);
        if (opt.estado) data.status = parseStatus(opt.estado);
        if (!Object.keys(data).length) fail("Di qué cambiar: --titulo, --enlace, --cierra, --nota, --fuente o --estado.");
        const rec = Work.update(work, o.id, data) || fail("El título no puede quedar vacío.");
        say(`Oportunidad cambiada ${oppLine(rec)}.`);
      } else if (sub === "quitar") {
        const o = findOpp(work, pos[2]);
        Work.remove(work, o.id);
        say(`Oportunidad quitada: ${o.title}.`);
      } else fail("Con las oportunidades se puede: agregar, estado, editar o quitar (y «oportunidades» para verlas).");
      break;
    }
    default:
      fail(`Orden desconocida: «${cmd}». Usa «ayuda» para ver las órdenes.`);
  }

  const entries = [...list.map(wire), ...work.map(wire), ...newTasks.map((rec) => ({ col: "tasks", id: rec.id, rec }))];
  const n = await pushChanges(ctx, entries, before, stamps);
  say(n ? "Guardado en el servidor: aparecerá en la app en unos segundos." : "No había nada que cambiar.");
  return out.join("\n");
}

/* ---------- uso desde la terminal ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run(process.argv.slice(2)).then((text) => console.log(text)).catch((err) => {
    console.error(err instanceof Fallo ? err.message : err && err.name === "TypeError" ? "Sin conexión con el servidor." : String(err && err.stack || err));
    process.exit(1);
  });
}
