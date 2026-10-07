#!/usr/bin/env node
/* Herramienta de línea de comandos para que Claude (o tú) lea y edite tus pendientes y tu Rutina
   usando la misma sincronización cifrada que la app. Necesita Node 22 o más reciente.

   Variables de entorno:
     PENDIENTES_CODIGO    tu código de sincronización (Ajustes → Tus dispositivos). Nunca lo escribas en un archivo del repositorio.
     PENDIENTES_SERVIDOR  (opcional) dirección del servidor; por defecto la de config.js.

   Comandos:
     hoy [--fecha AAAA-MM-DD]             la Rutina del día y las tareas vencidas, de hoy y de los próximos 3 días
     semana [--fecha AAAA-MM-DD]          cumplimiento de la semana (lunes a domingo) por pendiente y por día
     listar [--json]                      todo: tareas pendientes y Rutina, con sus ids
     agregar-rutina "texto" [--frecuencia diaria|entre-semana|semanal|mensual]
     agregar-tarea "texto" [--fecha AAAA-MM-DD] [--prioridad alta|media|baja]   (no duplica una tarea pendiente igual)
     tachar <id o texto> [--fecha AAAA-MM-DD]      en la Rutina tacha el periodo de esa fecha; en una tarea la completa
     destachar <id o texto> [--fecha AAAA-MM-DD]
     editar <id o texto> [--texto "..."] [--frecuencia ...] [--fecha ...] [--prioridad ...]
     borrar <id o texto>
   Opción global: --simular (muestra lo que cambiaría sin subir nada). */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Sync = require(path.join(ROOT, "sync.js"));
const Routine = require(path.join(ROOT, "routine.js"));

const FREQ_IN = { diaria: "daily", "entre-semana": "weekdays", semanal: "weekly", mensual: "monthly", daily: "daily", weekdays: "weekdays", weekly: "weekly", monthly: "monthly" };
const PRIO_IN = { alta: "high", media: "medium", baja: "low", high: "high", medium: "medium", low: "low" };
const PRIO_OUT = { high: "alta", medium: "media", low: "baja" };
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fail(msg) { console.error("Error: " + msg); process.exit(1); }

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out.flags[key] = true; else { out.flags[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function defaultServer() {
  try {
    const cfg = readFileSync(path.join(ROOT, "config.js"), "utf8");
    return (cfg.match(/server:\s*"([^"]+)"/) || [])[1] || "";
  } catch { return ""; }
}

const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
function dateFlag(flags) {
  if (flags.fecha === undefined) return new Date();
  if (!isDay(flags.fecha)) fail("la fecha debe ser AAAA-MM-DD");
  return Routine.parseDay(flags.fecha);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Conexión con el servidor ---------- */
async function connect() {
  const code = Sync.normalizeCode(process.env.PENDIENTES_CODIGO || "");
  if (!Sync.isValidCode(code)) fail("falta PENDIENTES_CODIGO (20 letras y números, el código de sincronización de la app).");
  const server = (process.env.PENDIENTES_SERVIDOR || defaultServer()).replace(/\/+$/, "");
  if (!server) fail("no hay dirección de servidor (PENDIENTES_SERVIDOR o config.js).");
  return { server, space: await Sync.spaceId(code), key: await Sync.deriveKey(code) };
}

async function post(conn, records, since) {
  let res;
  try {
    res = await fetch(`${conn.server}/space/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: conn.space, since, records }) });
  } catch (e) { fail(`no se pudo conectar con ${conn.server} (${e.cause?.code || e.message}).`); }
  if (!res.ok) fail(`el servidor respondió ${res.status}.`);
  return res.json();
}

/* Baja todo y lo descifra: devuelve { tasks: [...], books: n } */
async function pull(conn) {
  const recs = new Map();
  let since = 0, more = false;
  do {
    const data = await post(conn, [], since);
    for (const r of data.records) recs.set(r.id, r);
    since = data.seq; more = data.more;
  } while (more);
  const tasks = [];
  let books = 0, unreadable = 0;
  for (const r of recs.values()) {
    if (r.deleted) continue;
    if (r.col === "books") { books++; continue; }
    if (r.col !== "tasks") continue;
    const plain = await Sync.decryptText(conn.key, r.data, `${r.id}|${r.col}`);
    if (plain === null) { unreadable++; continue; }
    try { tasks.push({ ...JSON.parse(plain), id: r.id, updatedAt: r.updatedAt }); } catch { unreadable++; }
  }
  return { tasks, books, unreadable };
}

async function push(conn, changed, removed, simulate) {
  const now = Date.now();
  const records = [];
  for (const rec of changed) {
    rec.updatedAt = now;
    records.push({ id: rec.id, col: "tasks", updatedAt: now, deleted: 0, data: await Sync.encryptText(conn.key, JSON.stringify(rec), `${rec.id}|tasks`) });
  }
  for (const id of removed) records.push({ id, col: "tasks", updatedAt: now, deleted: 1, data: "" });
  if (!records.length) return;
  if (simulate) { console.log(`(simulación: no se subieron ${records.length} cambio(s))`); return; }
  await post(conn, records, Number.MAX_SAFE_INTEGER);
}

/* ---------- Presentación ---------- */
const plainText = (t) => String(t.text || "").replace(/​/g, "").trim();
const freqLabel = (t) => Routine.LABELS[Routine.cleanFreq(t.freq)].toLowerCase();
function dueText(due, today) {
  if (!due) return "";
  if (due < today) return `vencida ${due}`;
  if (due === today) return "hoy";
  return `${WEEKDAYS[Routine.parseDay(due).getDay()]} ${due}`;
}
const regular = (tasks) => tasks.filter((t) => !Routine.isRoutine(t));
const pendingRegular = (tasks) => regular(tasks).filter((t) => !t.done && plainText(t));
const sortByDue = (list) => [...list].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority));

function find(tasks, ref) {
  if (!ref) fail("indica el id o parte del texto.");
  const byId = tasks.find((t) => t.id === ref);
  if (byId) return byId;
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hits = tasks.filter((t) => norm(plainText(t)).includes(norm(ref)));
  const open = hits.filter((t) => Routine.isRoutine(t) || !t.done);
  const pick = open.length === 1 ? open : hits;
  if (pick.length === 1) return pick[0];
  if (!pick.length) fail(`no encontré «${ref}».`);
  fail(`«${ref}» coincide con varios:\n` + pick.map((t) => `  ${t.id}  ${plainText(t)}`).join("\n"));
}

function showToday(tasks, d) {
  const today = Routine.dayKey(d);
  console.log(`Rutina del ${WEEKDAYS[d.getDay()]} ${today}`);
  const secs = Routine.sections(tasks, d).filter((s) => s.items.length);
  if (!secs.length) console.log("  (sin pendientes de rutina)");
  for (const s of secs) {
    console.log(`  ${s.label} (${s.done}/${s.items.length})`);
    for (const t of s.items) console.log(`    [${Routine.isDone(t, d) ? "x" : " "}] ${plainText(t)}  · ${t.id}`);
  }
  const limit = Routine.dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3, 12));
  const due = sortByDue(pendingRegular(tasks).filter((t) => t.due && t.due <= limit));
  console.log(`Tareas vencidas, de hoy y de los próximos 3 días (${due.length})`);
  for (const t of due) console.log(`    [ ] ${plainText(t)} — ${dueText(t.due, today)}, prioridad ${PRIO_OUT[t.priority] || "media"}  · ${t.id}`);
  const nodate = pendingRegular(tasks).filter((t) => !t.due || t.due > limit).length;
  console.log(`Otras tareas pendientes: ${nodate}`);
}

function showWeek(tasks, d) {
  const w = Routine.weekStats(tasks, d);
  console.log(`Semana ${w.week} (${w.from} a ${w.to}), contado hasta el ${Routine.dayKey(d)}`);
  console.log(`Cumplimiento: ${w.done} de ${w.total} (${w.pct}%)`);
  console.log("Por día: " + w.days.filter((x) => !x.future).map((x) => `${WEEKDAYS[Routine.parseDay(x.date).getDay()]} ${x.done}/${x.total}`).join(" · "));
  for (const p of w.perItem) {
    const extra = p.item.freq === "monthly" ? " (este mes)" : "";
    console.log(`  ${p.done}/${p.total}${extra}  ${plainText(p.item)} [${freqLabel(p.item)}]`);
  }
  const doneThisWeek = regular(tasks).filter((t) => t.done && t.updatedAt >= Routine.parseDay(w.from).getTime() - 12 * 3600000).length;
  const overdue = pendingRegular(tasks).filter((t) => t.due && t.due < Routine.dayKey(d)).length;
  console.log(`Tareas completadas (cambiadas esta semana): ${doneThisWeek} · Tareas vencidas sin hacer: ${overdue}`);
}

/* ---------- Principal ---------- */
const { _: [cmd, ...rest], flags } = parseArgs(process.argv.slice(2));
if (!cmd || cmd === "ayuda" || flags.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\* ?/, ""));
  process.exit(0);
}
const conn = await connect();
const { tasks, unreadable } = await pull(conn);
if (unreadable) console.error(`Aviso: ${unreadable} registro(s) no se pudieron descifrar (¿otro código?).`);
const simulate = !!flags.simular;
const changed = [], removed = [];

switch (cmd) {
  case "hoy": showToday(tasks, dateFlag(flags)); break;
  case "semana": showWeek(tasks, dateFlag(flags)); break;
  case "listar": {
    if (flags.json) { console.log(JSON.stringify(tasks, null, 2)); break; }
    console.log("Rutina:");
    for (const t of tasks.filter(Routine.isRoutine)) console.log(`  ${t.id}  [${freqLabel(t)}] ${plainText(t)}`);
    console.log("Tareas pendientes:");
    for (const t of sortByDue(pendingRegular(tasks))) console.log(`  ${t.id}  ${plainText(t)}${t.due ? " — " + t.due : ""} (${PRIO_OUT[t.priority] || "media"})`);
    break;
  }
  case "agregar-rutina": {
    const text = rest.join(" ").trim();
    if (!text) fail("escribe el texto del pendiente.");
    const freq = FREQ_IN[flags.frecuencia || "diaria"];
    if (!freq) fail("frecuencia: diaria, entre-semana, semanal o mensual.");
    const dup = tasks.find((t) => Routine.isRoutine(t) && plainText(t).toLowerCase() === text.toLowerCase());
    if (dup) { console.log(`Ya existe en la Rutina: ${plainText(dup)} · ${dup.id}`); break; }
    const item = Routine.make(text.slice(0, 200), freq, uid(), Date.now());
    changed.push(item);
    console.log(`Agregado a la Rutina (${freqLabel(item)}): ${item.text} · ${item.id}`);
    break;
  }
  case "agregar-tarea": {
    const text = rest.join(" ").trim();
    if (!text) fail("escribe el texto de la tarea.");
    const due = flags.fecha === undefined ? "" : flags.fecha;
    if (due && !isDay(due)) fail("la fecha debe ser AAAA-MM-DD");
    const priority = PRIO_IN[flags.prioridad || "media"];
    if (!priority) fail("prioridad: alta, media o baja.");
    const dup = pendingRegular(tasks).find((t) => plainText(t).toLowerCase() === text.toLowerCase());
    if (dup) { console.log(`Ya está pendiente: ${plainText(dup)} · ${dup.id}`); break; }
    const task = { id: uid(), text: text.slice(0, 200), done: false, priority, due, reminders: [], doc: [] };
    changed.push(task);
    console.log(`Tarea agregada: ${task.text}${due ? " — " + due : ""} · ${task.id}`);
    break;
  }
  case "tachar":
  case "destachar": {
    const t = find(tasks, rest.join(" ").trim());
    const done = cmd === "tachar";
    if (Routine.isRoutine(t)) {
      const d = dateFlag(flags);
      if (Routine.isDone(t, d) === done) { console.log(`Sin cambios: ${plainText(t)} ya estaba ${done ? "tachado" : "sin tachar"}.`); break; }
      Routine.setDone(t, d, done, Date.now());
      console.log(`${done ? "Tachado" : "Destachado"} (${Routine.periodKey(Routine.cleanFreq(t.freq), d)}): ${plainText(t)}`);
    } else {
      if (!!t.done === done) { console.log(`Sin cambios: ${plainText(t)}.`); break; }
      t.done = done;
      console.log(`${done ? "Completada" : "Pendiente de nuevo"}: ${plainText(t)}`);
    }
    changed.push(t);
    break;
  }
  case "editar": {
    const t = find(tasks, rest.join(" ").trim());
    if (typeof flags.texto === "string" && flags.texto.trim()) { t.text = flags.texto.trim().slice(0, 200); delete t.marks; }
    if (flags.frecuencia !== undefined) {
      if (!Routine.isRoutine(t)) fail("solo los pendientes de la Rutina tienen frecuencia.");
      if (!FREQ_IN[flags.frecuencia]) fail("frecuencia: diaria, entre-semana, semanal o mensual.");
      t.freq = FREQ_IN[flags.frecuencia];
    }
    if (flags.fecha !== undefined) { if (flags.fecha !== "" && !isDay(flags.fecha)) fail("la fecha debe ser AAAA-MM-DD"); t.due = flags.fecha; }
    if (flags.prioridad !== undefined) { if (!PRIO_IN[flags.prioridad]) fail("prioridad: alta, media o baja."); t.priority = PRIO_IN[flags.prioridad]; }
    changed.push(t);
    console.log(`Editado: ${plainText(t)} · ${t.id}`);
    break;
  }
  case "borrar": {
    const t = find(tasks, rest.join(" ").trim());
    removed.push(t.id);
    console.log(`Borrado: ${plainText(t)}`);
    break;
  }
  default: fail(`comando desconocido «${cmd}». Usa «ayuda».`);
}
await push(conn, changed, removed, simulate);
