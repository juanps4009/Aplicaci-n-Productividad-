// Claude en la app (calls.js): mensajes de Claude (herramientas/llamar.mjs), respuestas y encargos del dueño,
// y una llamada de voz desde el navegador con un Gemini Live simulado. Servidor real sobre una base simulada.
import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import worker from '../worker/index.js';
import { run as llamar, AAD } from '../herramientas/llamar.mjs';

const require = createRequire(import.meta.url);
const Sync = require('../sync.js');
const ok = (m) => console.log('OK', m);

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => String(url).includes('auth_tokens') ? new Response(JSON.stringify({ name: 'auth_tokens/prueba' })) : realFetch(url, init);
const env = { DB: mockD1(), GEMINI_API_KEY: 'k' };
const SERVER = 'https://avisos.test';
const serverFetch = (url, init) => { worker._test.resetRate(); return worker.fetch(new Request(url, init), env); };

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, permissions: ['microphone', 'notifications'], serviceWorkers: 'block' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.route(SERVER + '/**', async (route) => {
  const req = route.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const r = await serverFetch(req.url(), { method: req.method(), body: req.postData() || undefined });
  return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': r.headers.get('content-type') || 'text/plain' }, body: await r.text() });
});
await p.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.APP_CONFIG = { server: "${SERVER}", widgetDownload: "", widgetScheme: "pendientes", widgetPackage: "app.productividad.widget" };` }));
// Gemini Live simulado: contesta el setup, saluda, guarda un encargo con la herramienta y cuelga
await p.addInitScript(() => {
  window.__ws = { sent: [], url: '' };
  class FakeWS {
    constructor(url) { this.url = url; window.__ws.url = url; this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 10); }
    emit(obj) { this.onmessage && this.onmessage({ data: JSON.stringify(obj) }); }
    send(data) {
      const m = JSON.parse(data); window.__ws.sent.push(m);
      if (m.setup) setTimeout(() => this.emit({ setupComplete: {} }), 10);
      else if (m.clientContent) setTimeout(() => {
        this.emit({ serverContent: { outputTranscription: { text: 'Hola, ¿en qué te ayudo?' }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: btoa(String.fromCharCode(...new Uint8Array(4800))) } }] }, turnComplete: true } });
        this.emit({ serverContent: { inputTranscription: { text: 'Dile a Claude que busque' } } });
        this.emit({ serverContent: { inputTranscription: { text: ' ofertas de traducción.' }, turnComplete: true } });
        this.emit({ toolCall: { functionCalls: [{ id: 't1', name: 'ver_pendientes', args: {} }] } });
        this.emit({ toolCall: { functionCalls: [{ id: 't2', name: 'dejar_encargo', args: { texto: 'Buscar 3 ofertas de traducción en Workana' } }] } });
      }, 20);
      else if (m.toolResponse && m.toolResponse.functionResponses[0].name === 'colgar' && window.__farewell) {
        const chunk = btoa(String.fromCharCode(...new Uint8Array(24000))); // 0,5 s de audio
        window.__farewell.start = Date.now();
        setTimeout(() => this.emit({ serverContent: { outputTranscription: { text: ' Hasta luego,' }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: chunk } }] } } }), 1800);
        setTimeout(() => this.emit({ serverContent: { outputTranscription: { text: ' que tengas buen día.' }, modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: chunk } }] }, turnComplete: true } }), 3600);
      }
      else if (m.toolResponse && m.toolResponse.functionResponses[0].name === 'dejar_encargo') setTimeout(() => {
        this.emit({ serverContent: { outputTranscription: { text: 'Listo, quedó guardado. ¡Chao!' }, turnComplete: true } });
        this.emit({ toolCall: { functionCalls: [{ id: 't3', name: 'colgar', args: {} }] } });
      }, 20);
    }
    close() { this.readyState = 3; }
  }
  window.WebSocket = FakeWS;
});
await p.goto('http://localhost:8123/');

// ---- sin código: la hoja explica qué hacer
await p.click('#open-claude');
assert((await p.textContent('#claude-setup')).includes('primero conecta tus dispositivos'));
assert(await p.locator('#claude-call').isHidden());
await p.click('#close-claude');
ok('sin código de sincronización: la hoja de Claude explica cómo empezar');

// ---- crear código y que Claude escriba con la herramienta
await p.click('#open-settings'); await p.evaluate(() => { document.querySelector('#sync-card').open = true; });
await p.click('[data-action=sync-create]');
await p.waitForFunction(() => /\w{4}-\w{4}/.test(document.querySelector('#sync-body').innerText));
await p.click('#close-settings');
const code = await p.evaluate(() => state.sync.code);
const tool = (...argv) => llamar(argv, { code, server: SERVER, fetch: serverFetch, sleep: async () => {} });
assert.strictEqual(await tool('mensaje', 'Ya', 'quedó', 'tu', 'resumen', 'semanal.'), 'Mensaje guardado; lo verá en la app (no hay celular con avisos conectado).');
await p.evaluate(() => refreshClaude());
await p.waitForSelector('#claude-badge:not(.hidden)');
assert.strictEqual(await p.getAttribute('#open-claude', 'aria-label'), 'Claude: 1 mensaje nuevo');
await p.evaluate(() => showTab('home'));
await p.waitForSelector('.claude-strip');
assert((await p.textContent('.claude-strip')).includes('Claude te escribió') && (await p.textContent('.claude-strip')).includes('Ya quedó tu resumen semanal.'));
ok('Claude escribe con llamar.mjs → aviso en la cabecera y tarjeta en el Inicio');

// ---- leer, contestar y dejar un encargo
await p.click('.claude-strip');
await p.waitForSelector('#claude-thread .msg.theirs');
assert((await p.textContent('#claude-thread')).includes('Ya quedó tu resumen semanal.'));
assert(await p.locator('#claude-badge').isHidden());
assert((await p.textContent('#claude-setup')).includes('activa las llamadas en el widget'));
await p.fill('#claude-input', 'Gracias, lo leo esta noche.');
await p.click('#claude-compose [data-kind=msg]');
await p.waitForSelector('#claude-thread .msg.mine');
await p.fill('#claude-input', 'Revisa si hay ofertas nuevas de redacción.');
await p.click('#claude-compose [data-kind=encargo]');
await p.waitForFunction(() => document.querySelectorAll('#claude-thread .msg.mine').length === 2);
assert((await p.textContent('#claude-thread .msg.encargo')).includes('Encargo · pendiente')); // (el CSS lo muestra en mayúsculas)
assert.strictEqual(await p.inputValue('#claude-input'), '');
let out = await tool('respuestas'); assert(out.includes('Gracias, lo leo esta noche.'));
out = await tool('encargos'); assert(out.includes('Revisa si hay ofertas nuevas de redacción.'));
const errandId = JSON.parse(await tool('encargos', '--json'))[0].id;
await tool('encargo', 'hecho', errandId);
await p.evaluate(() => refreshClaude());
await p.waitForFunction(() => document.querySelector('#claude-thread .msg.encargo').textContent.includes('atendido'));
assert(!/redacción|Gracias/.test(env.DB.raw.prepare('SELECT group_concat(data) d FROM messages').get().d)); // en el servidor, cifrado
ok('el dueño contesta y deja un encargo; Claude los lee y lo marca atendido; en el servidor todo va cifrado');

// ---- una llamada perdida aparece en el hilo
await tool('mensaje', 'Prueba'); // (sin celular, «llamar» no puede sonar: se simula una perdida con el formato real)
const space = await Sync.spaceId(code), key = await Sync.deriveKey(code);
const cid = 'cperdida0001';
env.DB.raw.prepare("INSERT INTO calls (id, space, dir, state, urgent, invite, result, created_at, updated_at) VALUES (?, ?, 'out', 'invited', 0, ?, '', ?, ?)")
  .run(cid, space, await Sync.encryptText(key, JSON.stringify({ v: 1, reason: '¿Apruebo el despliegue?' }), AAD.invite(cid)), Date.now() - 60000, Date.now() - 60000);
await p.evaluate(() => refreshClaude());
await p.waitForSelector('#claude-thread .msg.missed');
assert((await p.textContent('#claude-thread .msg.missed')).includes('¿Apruebo el despliegue?'));
ok('una llamada perdida de Claude aparece en el hilo con su motivo');

// ---- llamar a Claude desde el navegador (voz con Gemini Live simulado)
await p.evaluate(() => { state.tasks.unshift({ id: 'tv1', text: 'Pagar la luz', done: false, priority: 'high', due: '', createdAt: Date.now() }); });
await p.click('#claude-call');
await p.waitForFunction(() => window.__ws.sent.some((m) => m.toolResponse && m.toolResponse.functionResponses[0].name === 'colgar'), null, { timeout: 8000 });
await p.waitForSelector('#claude-live.hidden', { state: 'attached', timeout: 8000 });
const sent = await p.evaluate(() => window.__ws.sent);
const url = await p.evaluate(() => window.__ws.url);
assert(url.includes('BidiGenerateContentConstrained?access_token=auth_tokens%2Fprueba'), url);
assert.strictEqual(sent[0].setup.model, 'models/gemini-3.8-live');
assert(sent[0].setup.systemInstruction.parts[0].text.includes('El dueño te está llamando'));
assert(sent.some((m) => m.realtimeInput && m.realtimeInput.audio.mimeType === 'audio/pcm;rate=16000'), 'manda audio del micrófono');
const pend = sent.find((m) => m.toolResponse && m.toolResponse.functionResponses[0].name === 'ver_pendientes');
assert(pend.toolResponse.functionResponses[0].response.result.includes('Pagar la luz (prioridad alta)'));
await p.waitForFunction(() => [...document.querySelectorAll('#claude-thread .msg.encargo')].some((li) => li.innerText.includes('Workana')));
const call = env.DB.raw.prepare("SELECT id, state, result FROM calls WHERE dir = 'in'").get();
assert.strictEqual(call.state, 'ended');
const result = JSON.parse(await Sync.decryptText(key, call.result, AAD.result(call.id)));
assert.deepStrictEqual(result.turns.map((t) => t.who), ['ia', 'yo', 'ia']);
assert.strictEqual(result.turns[1].text, 'Dile a Claude que busque ofertas de traducción.');
out = await tool('encargos'); assert(out.includes('Buscar 3 ofertas de traducción en Workana'));
ok('llamar a Claude por voz: token temporal, setup en español, micrófono a 16 kHz, consulta de pendientes, encargo guardado, cuelga y la transcripción queda cifrada');

// ---- la despedida larga NO se corta (antes se colgaba a los 2,5 s fijos)
await p.evaluate(() => { window.__farewell = {}; window.__ws.sent.length = 0; });
if (await p.locator('#claude-sheet.hidden').count()) await p.evaluate(() => openClaude());
await p.click('#claude-call');
await p.waitForFunction(() => window.__ws.sent.some((m) => m.toolResponse && m.toolResponse.functionResponses[0].name === 'colgar'), null, { timeout: 8000 });
await p.waitForTimeout(3000); // pasó el viejo límite de 2,5 s y Claude aún se está despidiendo
assert.strictEqual(await p.evaluate(() => !!claude.live), true, 'la llamada sigue abierta mientras Claude se despide');
await p.waitForFunction(() => !claude.live, null, { timeout: 15000 });
const tail = await p.evaluate(() => Date.now() - window.__farewell.start);
assert(tail > 4000 && tail < 12000, 'colgó después de la despedida y sin esperar de más: ' + tail + ' ms');
await p.waitForFunction(() => document.querySelectorAll('#claude-thread .msg').length > 0);
const farewell = env.DB.raw.prepare("SELECT id, result FROM calls WHERE dir = 'in' AND state = 'ended' ORDER BY created_at DESC").all()[0];
const said = JSON.parse(await Sync.decryptText(key, farewell.result, AAD.result(farewell.id))).turns.map((t) => t.text).join(' ');
assert(said.includes('Hasta luego, que tengas buen día.'), 'la transcripción trae la despedida completa: ' + said);
await p.evaluate(() => { window.__farewell = null; });
ok('colgar espera a que Claude termine de despedirse (despedida de 3,6 s completa, sin cortarla a los 2,5 s)');

// ---- en Android, «Llamar a Claude» abre la pantalla de llamada nativa; sin el widget, llama en el navegador
await p.evaluate(() => { claudeNative.android = true; claudeNative.wait = 300; window.__native = []; window.__ws.sent.length = 0; window.__ws.url = ''; claudeNative.open = (u) => { window.__native.push(u); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); }; });
await p.evaluate(() => openClaude()); await p.click('#claude-call'); await p.waitForTimeout(700);
assert.deepStrictEqual(await p.evaluate(() => window.__native), ['intent://call#Intent;scheme=pendientes;package=app.productividad.widget;end']);
assert.strictEqual(await p.evaluate(() => !!claude.live), false, 'con la app nativa no se llama también en el navegador'); assert.strictEqual(await p.evaluate(() => window.__ws.url), '');
await p.evaluate(() => { delete document.hidden; window.__native = []; claudeNative.open = (u) => { window.__native.push(u); }; }); // sin widget instalado: la página sigue visible
await p.evaluate(() => openClaude()); await p.click('#claude-call');
await p.waitForFunction(() => !!window.__ws.url, null, { timeout: 8000 });
assert.strictEqual((await p.evaluate(() => window.__native)).length, 1);
await p.evaluate(() => endClaudeCall('')); await p.waitForFunction(() => !claude.live);
await p.evaluate(() => { claudeNative.android = false; });
ok('en Android la web abre la llamada nativa (intent pendientes://call); sin widget instalado llama en el navegador');

// ---- Atrás cierra la hoja; y #mensajes la abre (desde la notificación del widget)
await p.goBack(); await p.waitForSelector('#claude-sheet.hidden', { state: 'attached' });
await p.evaluate(() => { location.hash = '#mensajes'; });
await p.waitForSelector('#claude-sheet:not(.hidden)');
assert.strictEqual(await p.evaluate(() => location.hash), '');
ok('Atrás cierra la hoja; el enlace #mensajes la abre');

assert.deepStrictEqual(errs, []);
await b.close();
console.log('todas las pruebas de Claude en la app pasan');
