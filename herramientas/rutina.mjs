#!/usr/bin/env node
/* Programa de escritorio para leer y cambiar la RUTINA de la app (lo usa Claude en el computador del dueño).
   Habla con el mismo servidor de sincronización que la app y cifra igual (sync.js); la lógica es routine.js.

   El código de sincronización se lee de un archivo local que el dueño guarda una sola vez:
       %USERPROFILE%\.pendientes\codigo.txt        (o la ruta de PENDIENTES_CODIGO_ARCHIVO)
   Este programa NUNCA lo imprime ni lo guarda en otro sitio.

   Uso:  node herramientas/rutina.mjs <orden> [opciones]
     ver [--semana 2026-W41] [--json]              rutina y cumplimiento de la semana
     agregar "texto" [--frecuencia diaria|semanal|mensual] [--dias lunes,miércoles]
     editar <id o texto> [--texto "…"] [--frecuencia …] [--dias …]
     quitar <id o texto>
     marcar <id o texto> [--fecha AAAA-MM-DD]       desmarcar <id o texto> [--fecha …]
     comentario [--semana 2026-W41] (--archivo comentario.md | --texto "…")     (texto vacío = quitarlo)
     importar <archivo.json> [--reemplazar]         carga una lista (formato en RUTINA-GUIA.md)
     exportar                                       imprime la lista en ese mismo formato
     revisar                                        comprueba el archivo del código y la conexión */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const Sync = require(join(ROOT, "sync.js"));
const Routine = require(join(ROOT, "routine.js"));

const PREFIX = "rt:"; // la rutina viaja por el servidor como «books» con este prefijo (ver app.js)
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

function readCode(file) {
  if (!existsSync(file)) fail(`Falta el archivo con tu código de sincronización:\n  ${file}\nCrea ese archivo y pega dentro el código (en la app: Ajustes → Sincronizar mis dispositivos → Copiar).`);
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

/* Baja todo y devuelve la rutina: { list (registros válidos), stamps (id → updatedAt), others (ids que no entiendo) } */
async function pull(ctx) {
  const latest = new Map();
  let since = 0, more = true;
  while (more) {
    const data = await post(ctx, since, []);
    for (const r of data.records) {
      if (r.col !== "books" || !r.id.startsWith(PREFIX)) continue;
      const prev = latest.get(r.id);
      if (!prev || r.updatedAt >= prev.updatedAt) latest.set(r.id, r);
    }
    since = data.seq;
    more = data.more;
  }
  const list = [], stamps = new Map();
  for (const r of latest.values()) {
    const id = r.id.slice(PREFIX.length);
    stamps.set(id, r.updatedAt);
    if (r.deleted) continue;
    const plain = await Sync.decryptText(ctx.key, r.data, `${r.id}|books`);
    if (plain === null) continue; // cifrado con otro código
    let obj;
    try { obj = JSON.parse(plain); } catch { continue; }
    const rec = Routine.clean({ ...obj, id });
    if (rec) list.push(rec);
  }
  return { list, stamps };
}

/* Sube lo que cambió respecto a `before` (un JSON por id) y los borrados */
async function pushChanges(ctx, list, before, stamps) {
  const now = ctx.now();
  const out = [];
  const stamp = (id) => Math.max(now, (stamps.get(id) || 0) + 1); // siempre más nuevo que lo que hay en el servidor
  const sig = (rec) => { const { updatedAt, ...rest } = rec; return JSON.stringify(rest); };
  for (const rec of list) {
    if (before.get(rec.id) === sig(rec)) continue;
    const updatedAt = stamp(rec.id);
    const wire = PREFIX + rec.id;
    out.push({ id: wire, col: "books", updatedAt, deleted: 0,
      data: await Sync.encryptText(ctx.key, JSON.stringify({ ...rec, updatedAt }), `${wire}|books`) });
  }
  const present = new Set(list.map((r) => r.id));
  for (const id of before.keys()) {
    if (!present.has(id)) out.push({ id: PREFIX + id, col: "books", updatedAt: stamp(id), deleted: 1, data: "" });
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

const plain = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

/* Un ítem por su id ("i:…") o por un trozo de su texto (si solo uno coincide) */
function findItem(list, ref) {
  if (!ref) fail("Falta decir qué pendiente (su id o parte de su texto).");
  const items = Routine.items(list);
  const byId = items.find((it) => it.id === ref);
  if (byId) return byId;
  const hits = items.filter((it) => plain(it.text).includes(plain(ref)));
  if (hits.length === 1) return hits[0];
  fail(hits.length ? `«${ref}» coincide con varios pendientes: ${hits.map((h) => `${h.id} (${h.text})`).join("; ")}. Usa el id.` : `No hay ningún pendiente que coincida con «${ref}».`);
}

const FREQ_OUT = { daily: "diaria", weekly: "semanal", monthly: "mensual" };
const exportData = (list) => ({ rutina: Routine.items(list).map((it) => ({
  texto: it.text, frecuencia: FREQ_OUT[it.freq], ...(it.days.length ? { dias: it.days.map((d) => Routine.DAY_NAME[d - 1]) } : {}),
})) });

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
  const code = env.code || readCode(env.codeFile || CODE_FILE);
  const ctx = { fetch: env.fetch || fetch, server: env.server || readServer(), now,
    space: await Sync.spaceId(code), key: await Sync.deriveKey(code) };
  const today = Routine.dateKey(new Date(now()));

  if (cmd === "revisar") {
    const { list } = await pull(ctx);
    say(`Todo bien: el código es válido y el servidor responde. La rutina tiene ${Routine.items(list).length} pendiente(s).`);
    return out.join("\n");
  }

  const { list, stamps } = await pull(ctx);
  const sig = (rec) => { const { updatedAt, ...rest } = rec; return JSON.stringify(rest); };
  const before = new Map(list.map((r) => [r.id, sig(r)]));
  const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
  const dateOpt = () => {
    if (!opt.fecha) return today;
    if (!Routine.isDateKey(opt.fecha)) fail(`Fecha inválida: «${opt.fecha}». Usa AAAA-MM-DD.`);
    return opt.fecha;
  };
  const weekOpt = () => {
    if (!opt.semana) return Routine.weekKey(today);
    if (!Routine.isWeekKey(opt.semana)) fail(`Semana inválida: «${opt.semana}». Usa el formato 2026-W41.`);
    return opt.semana;
  };

  switch (cmd) {
    case "ver":
      if (opt.json) say(JSON.stringify({ hoy: today, ...Routine.weekStats(list, weekOpt(), today), items: Routine.items(list) }, null, 2));
      else say(Routine.toMarkdown(list, today, weekOpt()));
      return out.join("\n");
    case "exportar":
      say(JSON.stringify(exportData(list), null, 2));
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
      try { data = JSON.parse(readFileSync(pos[1], "utf8").replace(/^\uFEFF/, "")); } catch (e) { fail(`No pude leer ${pos[1]} como JSON: ${e.message}`); }
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
    default:
      fail(`Orden desconocida: «${cmd}». Usa «ayuda» para ver las órdenes.`);
  }

  const n = await pushChanges(ctx, list, before, stamps);
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
