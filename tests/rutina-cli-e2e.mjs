// scripts/rutina.mjs contra el código real del servidor (D1 simulada) y la app en el navegador:
// lo que agrega Claude aparece en la app, lo que tachas en la app lo ve Claude, y nada viaja sin cifrar.
import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert';
import worker from '../worker/index.js';

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }
const env = { DB: mockD1() };
const SERVER = 'https://avisos.test';
const ok = (n) => console.log('OK', n);

// el mismo Worker servido por HTTP local para la herramienta de línea de comandos
const http = createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const r = await worker.fetch(new Request('http://x' + req.url, { method: req.method, body: body || undefined }), env);
  res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'text/plain' }); res.end(await r.text());
});
await new Promise((r) => http.listen(0, '127.0.0.1', r));
const LOCAL = `http://127.0.0.1:${http.address().port}`;
const run = async (code, ...args) => {
  const { stdout } = await promisify(execFile)('node', ['../scripts/rutina.mjs', ...args], { env: { ...process.env, PENDIENTES_CODIGO: code, PENDIENTES_SERVIDOR: LOCAL } });
  return stdout;
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'America/Bogota' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.route(SERVER + '/**', async (route) => {
  const req = route.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const r = await worker.fetch(new Request(req.url(), { method: req.method(), body: req.postData() || undefined }), env);
  return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': r.headers.get('content-type') || 'text/plain' }, body: await r.text() });
});
await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG = { server: "' + SERVER + '" };' }));
await p.goto('http://localhost:8123/');
const syncNow = async () => {
  await p.click('#open-sync');
  await p.click('[data-action=sync-now]'); await p.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText), null, { timeout: 5000 });
  await p.waitForTimeout(200); await p.click('#close-settings');
};

// la app: una tarea con fecha de hoy, un pendiente de rutina, y crea su código
const today = await p.evaluate(() => Routine.dayKey(new Date()));
await p.fill('#task-input', 'Entregar taller de física'); await p.fill('#task-due', today); await p.click('#task-form button[type=submit]');
await p.click('.nav-btn[data-tab=routine]'); await p.fill('#routine-input', 'Revisar correo UIS'); await p.click('#routine-form button[type=submit]');
await p.click('#open-sync'); await p.click('[data-action=sync-create]'); await p.waitForSelector('.code-box');
const code = (await p.locator('.code-box').innerText()).trim();
await p.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText)); await p.click('#close-settings');

// Claude lee
let out = await run(code, 'hoy');
assert(out.includes('[ ] Revisar correo UIS') && out.includes('Entregar taller de física — hoy')); ok('Claude ve la Rutina y las tareas de hoy');
await assert.rejects(run('AAAAAAAAAAAAAAAAAAAA'.slice(0, 5), 'hoy'), /PENDIENTES_CODIGO/); ok('sin código válido no hace nada');

// Claude agrega y tacha; la app lo recibe
out = await run(code, 'agregar-rutina', 'Buscar oportunidades', '--frecuencia', 'semanal'); assert(out.includes('semanal'));
out = await run(code, 'agregar-rutina', 'buscar oportunidades'); assert(out.includes('Ya existe')); ok('no duplica pendientes de rutina');
out = await run(code, 'agregar-tarea', 'Pagar matrícula', '--fecha', '2026-12-01', '--prioridad', 'alta'); assert(out.includes('Tarea agregada'));
out = await run(code, 'agregar-tarea', 'pagar matrícula'); assert(out.includes('Ya está pendiente')); ok('no duplica tareas pendientes');
out = await run(code, 'tachar', 'correo'); assert(out.includes('Tachado'));
await syncNow();
assert.strictEqual(await p.locator('.routine-item:has-text("Revisar correo UIS").done').count(), 1);
assert.deepStrictEqual(await p.$$eval('#routine-groups .task-text', e => e.map(x => x.textContent)), ['Revisar correo UIS', 'Buscar oportunidades']);
await p.click('.nav-btn[data-tab=tasks]');
assert((await p.$$eval('#task-groups .task-text', e => e.map(x => x.textContent))).includes('Pagar matrícula')); ok('lo que agrega y tacha Claude aparece en la app (en orden de creación)');

// tú tachas en la app; Claude lo ve en el resumen semanal
await p.click('.nav-btn[data-tab=routine]'); await p.check('.routine-item:has-text("Buscar oportunidades") input');
await syncNow();
out = await run(code, 'semana');
assert(/1\/1\s+Buscar oportunidades \[semanal\]/.test(out) && /1\/1\s+Revisar correo UIS \[diaria\]/.test(out) && out.includes('2 de 2 (100%)')); ok('Claude ve tu cumplimiento semanal');

// completar una tarea, editar y borrar
out = await run(code, 'tachar', 'taller'); assert(out.includes('Completada'));
out = await run(code, 'editar', 'Buscar oportunidades', '--frecuencia', 'entre-semana', '--texto', 'Buscar prácticas'); assert(out.includes('Editado'));
out = await run(code, 'borrar', 'matrícula'); assert(out.includes('Borrado'));
out = await run(code, 'borrar', 'no-existe').catch(e => e.stderr); assert(out.includes('no encontré'));
out = await run(code, 'agregar-tarea', 'Simulada', '--simular'); assert(out.includes('simulación'));
await syncNow();
await p.click('.nav-btn[data-tab=tasks]');
const tasks = await p.evaluate(() => JSON.parse(localStorage.getItem('prod.tasks')).filter(t => !t.kind).map(t => t.text + (t.done ? ' ✓' : '')));
assert.deepStrictEqual(tasks, ['Entregar taller de física ✓']); ok('completar, borrar y --simular');
await p.click('.nav-btn[data-tab=routine]');
assert((await p.$$eval('#routine-groups .task-text', e => e.map(x => x.textContent))).includes('Buscar prácticas')); ok('editar texto y frecuencia');

const stored = env.DB.raw.prepare('SELECT data FROM records WHERE deleted=0').all().map(r => r.data);
assert(stored.every(x => x.startsWith('e1:')) && !/correo|matr|pr[aá]ctica/i.test(stored.join('|'))); ok('todo viaja y se guarda cifrado');
assert.deepStrictEqual(errs, []); ok('sin errores en la consola');
await b.close(); http.close();
