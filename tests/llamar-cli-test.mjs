// herramientas/llamar.mjs contra el código real del servidor sobre una base simulada, con Firebase/Gemini simulados
// y un «celular» simulado que contesta, habla y cuelga. Comprueba que todo viaja cifrado.
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import worker from '../worker/index.js';
import { run, AAD } from '../herramientas/llamar.mjs';

const require = createRequire(import.meta.url);
const Sync = require('../sync.js');
const ok = (m) => console.log('OK', m);

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }

// Firebase y Gemini simulados (la firma del token de Firebase se prueba en calls-worker-test.mjs)
const { webcrypto: wc } = await import('node:crypto');
const rsa = await wc.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
const SA = { project_id: 'p', client_email: 'x@p.iam.gserviceaccount.com', private_key: Buffer.from(await wc.subtle.exportKey('pkcs8', rsa.privateKey)).toString('base64') };
const pushes = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
  if (String(url).includes('fcm.googleapis.com')) { pushes.push(JSON.parse(init.body).message.data); return new Response('{}'); }
  if (String(url).includes('auth_tokens')) return new Response(JSON.stringify({ name: 'auth_tokens/x' }));
  throw new Error('red no simulada ' + url);
};

const env = { DB: mockD1(), FCM_SERVICE_ACCOUNT: JSON.stringify(SA), GEMINI_API_KEY: 'k' };
const SERVER = 'https://avisos.test';
const code = Sync.makeCode(crypto.getRandomValues(new Uint8Array(20)));
const key = await Sync.deriveKey(code), space = await Sync.spaceId(code);
let clock = Date.now();
const serverFetch = (url, init) => { worker._test.resetRate(); return worker.fetch(new Request(url, init), env); };
let onSleep = async () => {};
const base = { code, server: SERVER, now: () => clock, fetch: serverFetch, sleep: async (ms) => { clock += ms; await onSleep(); } };
const cli = (...argv) => run(argv, base);

// «el celular»: lo mismo que hará el widget de Android
const phone = async (path, body) => (await serverFetch(SERVER + path, { method: 'POST', body: JSON.stringify({ space, ...body }) })).json();
const seal = (obj, aad) => Sync.encryptText(key, JSON.stringify({ v: 1, ...obj }), aad);

// ---- estado y errores claros
let out = await cli('estado'); assert(out.includes('ninguno') && out.includes('Avisos (Firebase): listos') && out.includes('Voz (Gemini Live): lista'));
await assert.rejects(cli('llamar', 'prueba'), /No hay ningún celular conectado/);
await assert.rejects(cli('llamar'), /Falta el motivo/);
await assert.rejects(cli('bailar'), /Orden desconocida/);
assert((await cli('ayuda')).includes('llamar "motivo"'));
await phone('/call/device', { device: 'celular-prueba-1', fcm: 'token-fcm-del-celular-123' });
assert((await cli('estado')).includes('Celular para llamadas: sí (1)'));
ok('estado del servicio y errores en español');

// ---- Claude llama; el celular contesta, habla y cuelga
onSleep = async () => {
  const id = pushes.at(-1).id;
  const c = await phone('/call/get', { id });
  if (c.state !== 'invited') return;
  const inv = JSON.parse(await Sync.decryptText(key, c.invite, AAD.invite(id)));
  assert.strictEqual(inv.reason, '¿Apruebo el despliegue?'); assert.strictEqual(inv.context, 'Las pruebas pasaron.'); assert.strictEqual(inv.from, 'Claude');
  await phone('/call/update', { id, state: 'ringing' }); await phone('/call/update', { id, state: 'active' });
  assert.strictEqual((await phone('/voice/token', { id })).token, 'auth_tokens/x');
  await phone('/call/update', { id, state: 'ended', result: await seal({ seconds: 95, summary: 'Aprobó el despliegue.', turns: [{ who: 'ia', text: 'Hola, Claude quiere saber si despliega.' }, { who: 'yo', text: 'Sí, dale.' }] }, AAD.result(id)) });
};
out = await cli('llamar', '¿Apruebo', 'el', 'despliegue?', '--contexto', 'Las pruebas pasaron.', '--urgente');
assert.deepStrictEqual(pushes.at(-1).urgent, '1');
assert(out.startsWith('Contestó y hablaron 2 min.'), out); assert(out.includes('Resumen: Aprobó el despliegue.') && out.includes('- Dueño: Sí, dale.') && out.includes('- IA de voz: Hola'));
const callId = pushes.at(-1).id;
const stored = env.DB.raw.prepare('SELECT invite, result FROM calls WHERE id = ?').get(callId);
assert(stored.invite.startsWith('e1:') && stored.result.startsWith('e1:') && !/despliegue|dale/.test(stored.invite + stored.result));
const j = JSON.parse(await cli('llamada', callId, '--json')); assert.strictEqual(j.estado, 'ended'); assert.strictEqual(j.turnos.length, 2);
ok('llamar: suena, contesta, habla con la IA de voz y la transcripción vuelve; en el servidor todo va cifrado');

// ---- no contesta → perdida y mensaje
onSleep = async () => { env.DB.raw.prepare('UPDATE calls SET created_at = created_at - 3000 WHERE id = ?').run(pushes.at(-1).id); }; // el reloj del servidor avanza
out = await cli('llamar', 'Recordatorio de la reunión', '--esperar', '60');
assert(out.startsWith('No contestó.'), out);
out = await cli('hilo'); assert(out.includes('**Claude**: Llamada perdida: Recordatorio de la reunión'));
// rechaza
onSleep = async () => { const id = pushes.at(-1).id; const c = await phone('/call/get', { id }); if (c.state === 'invited') await phone('/call/update', { id, state: 'declined' }); };
assert((await cli('llamar', 'Otra cosa')).startsWith('Rechazó la llamada.'));
// sigue abierta al acabarse la espera
onSleep = async () => { const id = pushes.at(-1).id; const c = await phone('/call/get', { id }); if (c.state === 'invited') { await phone('/call/update', { id, state: 'active' }); } };
out = await cli('llamar', 'Larga', '--esperar', '5'); assert(out.includes('La llamada sigue en curso.') && out.includes('Vuelve a mirar con: node herramientas/llamar.mjs llamada c'));
ok('sin contestar queda como mensaje; rechazar; si sigue abierta se puede volver a mirar');

// ---- mensajes y respuestas
onSleep = async () => {};
out = await cli('mensaje', 'Ya', 'quedó', 'el', 'resumen', 'semanal.'); assert.strictEqual(out, 'Mensaje enviado; le llegó un aviso al celular.'); assert.strictEqual(pushes.at(-1).t, 'msg');
assert.strictEqual(await cli('respuestas'), 'El dueño no ha escrito nada en estos días.');
const yoMsg = async (id, kind, text) => phone('/msg/send', { id, sender: 'yo', kind, data: await seal({ text }, AAD.msg(id)) });
await yoMsg('respuesta001', 'msg', 'Gracias, lo leo esta noche.');
out = await cli('respuestas'); assert(out.includes('**Tú**: Gracias, lo leo esta noche.'));
let n = 0; onSleep = async () => { if (++n === 2) await yoMsg('respuesta002', 'msg', 'Otra cosa: llámame mañana.'); };
out = await cli('respuestas', '--esperar', '60'); assert(out.includes('llámame mañana') && !out.includes('esta noche'));
onSleep = async () => {}; assert.strictEqual(await cli('respuestas', '--esperar', '10'), 'No llegó nada nuevo mientras esperaba.');
ok('mensaje con aviso al celular; respuestas del dueño; esperar a que conteste');

// ---- encargos (lo que el dueño pide por voz o por escrito)
await yoMsg('encargo00001', 'encargo', 'Busca 3 ofertas de traducción en Workana.');
out = await cli('encargos'); assert(out.includes('(encargo, encargo00001): Busca 3 ofertas'));
assert((await cli('encargo', 'hecho', 'encargo00001')).includes('marcado como atendido'));
assert.strictEqual(await cli('encargos'), 'No hay encargos pendientes.');
assert((await cli('encargos', '--todos')).includes('encargo, atendido'));
await assert.rejects(cli('encargo', 'hecho', 'noexiste123'), /No hay ningún encargo/);
assert.strictEqual(JSON.parse(await cli('hilo', '--json')).length, 5);
ok('encargos: listar, marcar atendidos y volver a ver todos');

// ---- con otro código no se ve nada, y el código nunca se imprime
const other = { ...base, code: Sync.makeCode(crypto.getRandomValues(new Uint8Array(20))) };
assert.strictEqual(await run(['hilo'], other), 'Todavía no hay mensajes.');
const everything = [await cli('hilo'), await cli('estado'), await cli('encargos', '--todos')].join('\n');
assert(!everything.includes(code) && !everything.includes(Sync.formatCode(code)));
ok('otro código no ve nada; el código nunca aparece en la salida');
console.log('todas las pruebas de llamar.mjs pasan');
