#!/usr/bin/env node
/* Llamadas y mensajes entre Claude y el celular del dueño (lo usa Claude en la nube y en sus tareas programadas).
   Claude crea la llamada; el servidor hace sonar el celular (widget de Android 2.0) aunque esté bloqueado; al contestar,
   una IA de voz (Gemini Live) le explica el motivo y conversa; al colgar, la transcripción vuelve aquí.
   Idea tomada de agentring (github.com/mutonby/agentring, Apache-2.0).

   El código de sincronización se toma de PENDIENTES_CODIGO (o del archivo local, igual que rutina.mjs) y nunca se imprime.
   Todo lo que viaja (motivo, contexto, transcripción, mensajes) va cifrado con la clave de ese código.

   Uso:  node herramientas/llamar.mjs <orden> [opciones]
     estado                                          ¿hay celular conectado? ¿están listos los avisos y la voz?
     llamar "motivo" [--contexto "…" | --contexto-archivo f.md] [--urgente] [--esperar SEGUNDOS] [--json]
                                                     hace sonar el celular y espera a que termine (por defecto 15 min);
                                                     muestra la transcripción, o dice que no contestó (queda como mensaje)
     llamada <id> [--json]                           estado y transcripción de una llamada
     mensaje "texto"                                 le deja un mensaje (le llega un aviso al celular)
     respuestas [--esperar SEGUNDOS] [--dias N] [--json]
                                                     lo que el dueño escribió o pidió (por defecto, últimos 7 días);
                                                     con --esperar, espera hasta que llegue algo nuevo
     encargos [--todos] [--json]                     lo que el dueño pidió para Claude y falta atender
     encargo hecho <id> | encargo abrir <id>         marcar un encargo como atendido (o volver a abrirlo)
     hilo [--json]                                   los últimos 30 mensajes, de los dos lados */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Fallo, readServer, readCode, parseArgs } from "./rutina.mjs";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const Sync = require(join(ROOT, "sync.js"));
const fail = (msg) => { throw new Fallo(msg); };

/* Formato (igual en la app y el widget):
   invitación  aad "inv|<id llamada>"  {v:1, reason, context, from:"Claude", at}
   resultado   aad "res|<id llamada>"  {v:1, turns:[{who:"yo"|"ia", text}], seconds, summary?}
   mensaje     aad "msg|<id>"          {v:1, text}
   perdida     (kind "missed")         la invitación de la llamada `ref` */
export const AAD = { invite: (id) => `inv|${id}`, result: (id) => `res|${id}`, msg: (id) => `msg|${id}` };
const TERMINAL = new Set(["ended", "declined", "missed"]);
const newId = (prefix) => prefix + Sync.b64u.enc(crypto.getRandomValues(new Uint8Array(12)));

const ERRORS = {
  sin_celular: "No hay ningún celular conectado para llamadas. En el celular: widget de Pendientes → Ajustes → «Activar llamadas».",
  llamadas_no_configuradas: "El servidor todavía no tiene Firebase configurado (secreto FCM_SERVICE_ACCOUNT del Worker; ver worker/README.md).",
  voz_no_configurada: "El servidor todavía no tiene la clave de Gemini (secreto GEMINI_API_KEY del Worker).",
  limite_diario: "Se llegó al límite diario de llamadas o mensajes de este código. Prueba mañana.",
};

async function api(ctx, path, body) {
  let res;
  try {
    res = await ctx.fetch(`${ctx.server}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: ctx.space, ...body }) });
  } catch { fail("Sin conexión con el servidor."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(ERRORS[data.error] || `El servidor respondió ${res.status}${data.error ? ` (${data.error})` : ""}.`);
  return data;
}

const seal = async (ctx, obj, aad) => Sync.encryptText(ctx.key, JSON.stringify({ v: 1, ...obj }), aad);
async function open(ctx, data, aad) {
  if (!data) return null;
  const plain = await Sync.decryptText(ctx.key, data, aad);
  if (plain === null) return null;
  try { return JSON.parse(plain); } catch { return null; }
}

/* Todos los mensajes, el último estado de cada uno */
async function thread(ctx) {
  const byId = new Map();
  let after = 0, more = true;
  while (more) {
    const page = await api(ctx, "/msg/list", { after });
    for (const m of page.messages) byId.set(m.id, m);
    after = page.seq; more = page.more;
  }
  const out = [];
  for (const m of [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)) {
    const body = await open(ctx, m.data, m.kind === "missed" ? AAD.invite(m.ref) : AAD.msg(m.id));
    if (!body) continue;
    out.push({ id: m.id, sender: m.sender, kind: m.kind, done: m.done, at: m.createdAt, seq: m.seq,
      text: m.kind === "missed" ? `Llamada perdida: ${body.reason || ""}`.trim() : String(body.text || "") });
  }
  return out;
}

const when = (ms) => new Date(ms).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const who = { yo: "Tú", claude: "Claude" };
const lineOf = (m) => `- ${when(m.at)} · **${who[m.sender] || m.sender}**${m.kind === "encargo" ? ` (encargo${m.done ? ", atendido" : ""}, ${m.id})` : ""}: ${m.text}`;

async function describeCall(ctx, c) {
  const result = await open(ctx, c.result, AAD.result(c.id));
  const invite = await open(ctx, c.invite, AAD.invite(c.id));
  return { id: c.id, estado: c.state, motivo: invite && invite.reason || "", segundos: result && result.seconds || 0,
    resumen: result && result.summary || "", turnos: result && Array.isArray(result.turns) ? result.turns : [] };
}

function callText(d) {
  const head = {
    ended: d.turnos.length ? `Contestó y hablaron ${Math.max(1, Math.round(d.segundos / 60))} min.` : "Contestó, pero no quedó transcripción.",
    declined: "Rechazó la llamada.",
    missed: "No contestó. El motivo le quedó como mensaje en la app.",
    active: "La llamada sigue en curso.", ringing: "El celular está sonando.", invited: "Llamando…",
  }[d.estado] || d.estado;
  const out = [`${head} (llamada ${d.id})`];
  if (d.resumen) out.push("", `Resumen: ${d.resumen}`);
  if (d.turnos.length) out.push("", "Transcripción:", ...d.turnos.map((t) => `- ${t.who === "yo" ? "Dueño" : "IA de voz"}: ${t.text}`));
  return out.join("\n");
}

export async function run(argv, env = {}) {
  const { pos, opt } = parseArgs(argv);
  const cmd = pos[0];
  if (!cmd || cmd === "ayuda" || opt.help) return readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].split("\n").slice(1).join("\n").trim();

  const code = env.code || readCode(env);
  const ctx = { fetch: env.fetch || fetch, server: env.server || readServer(), now: env.now || (() => Date.now()),
    sleep: env.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    space: await Sync.spaceId(code), key: await Sync.deriveKey(code) };
  const asJson = !!opt.json;

  if (cmd === "estado") {
    const s = await api(ctx, "/call/status", {});
    if (asJson) return JSON.stringify(s);
    return [
      `Celular para llamadas: ${s.devices ? `sí (${s.devices})` : "ninguno — en el widget de Android: Ajustes → «Activar llamadas»"}`,
      `Avisos (Firebase): ${s.push ? "listos" : "falta el secreto FCM_SERVICE_ACCOUNT en el Worker"}`,
      `Voz (Gemini Live): ${s.voice ? "lista" : "falta el secreto GEMINI_API_KEY en el Worker"}`,
    ].join("\n");
  }

  if (cmd === "llamar") {
    const reason = pos.slice(1).join(" ").trim();
    if (!reason) fail('Falta el motivo: llamar "¿apruebo el despliegue?"');
    let context = typeof opt.contexto === "string" ? opt.contexto : "";
    if (typeof opt["contexto-archivo"] === "string") {
      try { context = readFileSync(opt["contexto-archivo"], "utf8"); } catch (e) { fail(`No pude leer ${opt["contexto-archivo"]}: ${e.message}`); }
    }
    if (context.length > 12000) fail("El contexto es muy largo (máximo 12 000 caracteres). Resúmelo.");
    const id = newId("c");
    const invite = await seal(ctx, { reason, context, from: "Claude", at: ctx.now() }, AAD.invite(id));
    const created = await api(ctx, "/call/new", { id, dir: "out", invite, urgent: !!opt.urgente });
    let c = { id, state: created.state };
    const waitMs = (opt.esperar === undefined ? 900 : Number(opt.esperar)) * 1000;
    if (!Number.isFinite(waitMs) || waitMs < 0) fail("--esperar debe ser un número de segundos.");
    const until = ctx.now() + waitMs;
    while (!TERMINAL.has(c.state) && ctx.now() < until) {
      await ctx.sleep(3000);
      c = await api(ctx, "/call/get", { id });
    }
    if (!TERMINAL.has(c.state) || !c.invite) c = await api(ctx, "/call/get", { id });
    const d = await describeCall(ctx, c);
    if (asJson) return JSON.stringify(d);
    return TERMINAL.has(d.estado) ? callText(d) : `${callText(d)}\nVuelve a mirar con: node herramientas/llamar.mjs llamada ${id}`;
  }

  if (cmd === "llamada") {
    if (!pos[1]) fail("Falta el id de la llamada.");
    const d = await describeCall(ctx, await api(ctx, "/call/get", { id: pos[1] }));
    return asJson ? JSON.stringify(d) : callText(d);
  }

  if (cmd === "mensaje") {
    const text = pos.slice(1).join(" ").trim();
    if (!text) fail('Falta el texto: mensaje "Ya terminé el resumen semanal."');
    if (text.length > 8000) fail("El mensaje es muy largo (máximo 8000 caracteres).");
    const id = newId("m");
    const r = await api(ctx, "/msg/send", { id, sender: "claude", kind: "msg", data: await seal(ctx, { text }, AAD.msg(id)) });
    return r.sent ? "Mensaje enviado; le llegó un aviso al celular." : "Mensaje guardado; lo verá en la app (no hay celular con avisos conectado).";
  }

  if (cmd === "respuestas") {
    const since = ctx.now() - (Number(opt.dias) || 7) * 86400000;
    const mine = (all) => all.filter((m) => m.sender === "yo" && m.at >= since);
    let list = mine(await thread(ctx));
    if (opt.esperar !== undefined) {
      const known = new Set(list.map((m) => m.id));
      const until = ctx.now() + Number(opt.esperar) * 1000;
      let fresh = [];
      while (!fresh.length && ctx.now() < until) {
        await ctx.sleep(5000);
        fresh = mine(await thread(ctx)).filter((m) => !known.has(m.id));
      }
      list = fresh;
      if (!list.length && !asJson) return "No llegó nada nuevo mientras esperaba.";
    }
    if (asJson) return JSON.stringify(list);
    return list.length ? list.map(lineOf).join("\n") : "El dueño no ha escrito nada en estos días.";
  }

  if (cmd === "encargos") {
    const list = (await thread(ctx)).filter((m) => m.kind === "encargo" && (opt.todos || !m.done));
    if (asJson) return JSON.stringify(list);
    return list.length ? list.map(lineOf).join("\n") : "No hay encargos pendientes.";
  }

  if (cmd === "encargo") {
    const action = pos[1], id = pos[2];
    if ((action !== "hecho" && action !== "abrir") || !id) fail("Uso: encargo hecho <id>  |  encargo abrir <id>");
    const found = (await thread(ctx)).find((m) => m.id === id && m.kind === "encargo");
    if (!found) fail(`No hay ningún encargo con id ${id}. Míralos con: llamar.mjs encargos --todos`);
    await api(ctx, "/msg/done", { id, done: action === "hecho" ? 1 : 0 });
    return action === "hecho" ? `Encargo marcado como atendido: ${found.text}` : `Encargo abierto otra vez: ${found.text}`;
  }

  if (cmd === "hilo") {
    const list = (await thread(ctx)).slice(-30);
    if (asJson) return JSON.stringify(list);
    return list.length ? list.map(lineOf).join("\n") : "Todavía no hay mensajes.";
  }

  fail(`Orden desconocida: ${cmd}. Escribe «node herramientas/llamar.mjs ayuda».`);
}

/* ---------- uso desde la terminal ---------- */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run(process.argv.slice(2)).then((text) => console.log(text)).catch((err) => {
    console.error(err instanceof Fallo ? err.message : String(err && err.stack || err));
    process.exit(1);
  });
}
