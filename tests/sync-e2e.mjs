import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import worker from '../worker/index.js';

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }
const env = { DB: mockD1() };
const SERVER = 'https://avisos.test';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errs = [];
async function device(name, scheme = 'light') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, colorScheme: scheme, permissions: ['notifications'], serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  await p.route(SERVER + '/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = await worker.fetch(new Request(req.url(), { method: req.method(), body: req.postData() || undefined }), env);
    return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': r.headers.get('content-type') || 'text/plain' }, body: await r.text() });
  });
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG = { server: "' + SERVER + '", widgetDownload: "https://github.com/x/y/releases/download/widget-latest/pendientes-widget.apk", widgetScheme: "pendientes", widgetPackage: "app.productividad.widget" };' }));
  await p.goto('http://localhost:8123/');
  return p;
}
const ok = (n) => console.log('OK', n);
const tasks = (p) => p.$$eval('.task-item .task-text', e => e.map(x => x.textContent));
const openSyncCard = (p) => p.evaluate(() => { document.querySelector('#sync-card').open = true; });
const openSettings = async (p) => { if (await p.locator('#settings.hidden').count()) await p.click('#open-settings'); await openSyncCard(p); };
const addTask = async (p, text) => { await p.fill('#task-input', text); await p.click('#task-form button[type=submit]'); };
const syncNow = async (p) => { await p.click('[data-action=sync-now]'); await p.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText), null, { timeout: 5000 }); await p.waitForTimeout(150); };

const A = await device('A-celular'), B = await device('B-pc', 'dark');
// ---- tema con interruptor
assert.strictEqual(await A.evaluate(() => document.documentElement.dataset.theme), 'light'); // primera vez: toma el del sistema
assert.strictEqual(await B.evaluate(() => document.documentElement.dataset.theme), 'dark');
await openSettings(A); assert.strictEqual(await A.locator('.seg[data-setting=theme]').count(), 0); assert.strictEqual(await A.locator('#theme-switch').getAttribute('aria-checked'), 'false');
await A.click('#theme-switch'); assert.strictEqual(await A.evaluate(() => document.documentElement.dataset.theme), 'dark'); assert.strictEqual(await A.locator('#theme-switch').getAttribute('aria-checked'), 'true');
await A.reload(); assert.strictEqual(await A.evaluate(() => document.documentElement.dataset.theme), 'dark'); await A.click('#open-settings'); await A.click('#theme-switch'); assert.strictEqual(await A.evaluate(() => document.documentElement.dataset.theme), 'light');
ok('interruptor de tema (sin "Automático", persiste, toma el tema del sistema la 1ª vez)');
await A.click('#close-settings');

// ---- Ajustes: primero las opciones (modo oscuro...), luego la tarjeta de sincronizacion plegable, luego el widget; hay un atajo en la cabecera
assert.strictEqual(await A.locator('#open-sync:visible').count(), 1);
await A.click('#open-settings');
assert.strictEqual(await A.locator('#sync-card').evaluate(e => e.open), false); assert.strictEqual(await A.locator('#sync-card [data-action=sync-create]').isVisible(), false);
const ys = await A.evaluate(() => ['#theme-switch', '#sync-card', '#widget-block'].map((s) => document.querySelector(s).getBoundingClientRect().top));
assert(ys[0] < ys[1] && ys[1] < ys[2]); await A.click('#sync-card > summary'); assert(await A.locator('#sync-card [data-action=sync-create]').isVisible()); await A.click('#sync-card > summary'); assert.strictEqual(await A.locator('#sync-card').evaluate(e => e.open), false);
await A.click('#close-settings'); await A.click('#open-sync');
assert(await A.locator('#sync-card [data-action=sync-create]').isVisible()); ok('Ajustes: modo oscuro arriba, sincronizacion plegable con flecha antes del widget; el icono de nube la abre con crear codigo visible');await A.screenshot({ path: '/tmp/v13-sync-card.png' }); await A.click('#close-settings');
assert.strictEqual(await A.locator('#sync-badge.hidden').count(), 1);
// ---- A crea datos previos y se conecta
await addTask(A, 'Tarea A1'); await addTask(A, 'Tarea A2');
await A.click('.nav-btn[data-tab=books]'); await A.click('#new-book'); await A.fill('[data-field=title]', 'Libro de A'); await A.fill('[data-field=author]', 'Autor A'); await A.click('[data-action=done]'); await A.click('#book-back');
await A.click('.nav-btn[data-tab=tasks]'); await openSettings(A);
await openSettings(A); await A.waitForTimeout(500); await A.waitForSelector('[data-action=sync-create]'); assert.strictEqual(await A.locator('#server-adv').evaluate(e=>e.open), false); ok('con servidor de la app: se puede crear código sin configurar nada (servidor propio plegado)');
await A.click('[data-action=sync-create]'); await A.waitForSelector('.code-box'); await A.click('#close-settings'); assert.strictEqual(await A.locator('#sync-badge:not(.hidden)').count(), 1); await A.click('#open-sync');
const code = (await A.locator('.code-box').innerText()).trim();
assert(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/.test(code)); await A.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText));
console.log('  código:', code); ok('A crea código y sube sus datos');
assert.strictEqual(env.DB.raw.prepare("SELECT COUNT(*) c FROM records WHERE deleted=0").get().c, 3);
const stored = env.DB.raw.prepare('SELECT data FROM records').all().map(r => r.data).join('|'); assert(!/Tarea A1|Libro de A|Autor A/.test(stored) && stored.split('|').every(x => x.startsWith('e1:'))); ok('el servidor solo guarda datos cifrados (no se lee ningún título)');

// ---- B se une con el código (escrito en minúsculas y sin guiones)
await addTask(B, 'Tarea B0 (previa)');
await openSettings(B); await B.waitForSelector('[data-action=sync-join]');
await B.fill('#sync-code-in', 'abc'); await B.click('[data-action=sync-join]'); assert((await B.locator('#sync-body').innerText()).includes('20 letras')); ok('rechaza códigos inválidos');
await B.fill('#sync-code-in', code.replace(/-/g, '').toLowerCase()); await B.click('[data-action=sync-join]'); await B.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText));
await B.click('#close-settings');
assert.deepStrictEqual((await tasks(B)).sort(), ['Tarea A1', 'Tarea A2', 'Tarea B0 (previa)']); ok('B recibe lo de A y conserva lo suyo (unión)');
await B.click('.nav-btn[data-tab=books]'); assert((await B.locator('.book-row-title').allInnerTexts()).includes('Libro de A')); ok('B recibe el resumen de A');
await B.click('.nav-btn[data-tab=tasks]');

// ---- A recibe lo de B
await syncA(); async function syncA() { await openSettings(A); await syncNow(A); await A.click('#close-settings'); }
assert((await tasks(A)).includes('Tarea B0 (previa)')); ok('A recibe la tarea de B');

// ---- edición y borrado
await B.click('.task-item:has-text("Tarea A1") [data-action=menu-task]'); await B.click('#menu-edit'); await B.fill('[data-edit=text]', 'Tarea A1 editada en PC'); await B.click('[data-action=save-task]');
await B.waitForTimeout(2600); // sincronización automática tras el cambio
await syncA(); assert((await tasks(A)).includes('Tarea A1 editada en PC')); ok('edición en B llega a A (sincronización automática de B + "ahora" en A)');
await A.click('.task-item:has-text("Tarea A2") [data-action=menu-task]'); await A.click('#menu-delete'); await A.waitForTimeout(2600);
await openSettings(B); await syncNow(B); await B.click('#close-settings');
assert(!(await tasks(B)).includes('Tarea A2')); ok('borrado en A se propaga a B');
// completar
await A.click('.task-item:has-text("Tarea B0") input[type=checkbox]'); await A.waitForTimeout(2600);
await openSettings(B); await syncNow(B); await B.click('#close-settings');
assert.strictEqual(await B.locator('.task-item:has-text("Tarea B0")').count(), 0); assert.strictEqual(await B.locator('.group[data-group=done] .group-head .count').innerText(), '1'); ok('tarea completada en A aparece completada en B');

// ---- recordatorios y dispositivos
await B.click('.task-item:has-text("Tarea A1") [data-action=menu-task]'); await B.click('#menu-remind'); await B.click('[data-action=rem-add]'); await B.click('[data-action=rem-kind][data-kind=daily]'); await B.fill('#rem-time', '18:00'); await B.click('[data-action=rem-save]'); await B.click('#rem-close');
await B.waitForTimeout(2600); await syncA();
assert((await A.locator('.task-item:has-text("Tarea A1") .due-label').innerText()).includes('🔔')); assert.strictEqual(await A.locator('.att-row').count(), 0); ok('el recordatorio llega a A sin avisos atrasados');
const remA = await A.evaluate(() => JSON.parse(localStorage.getItem('prod.tasks')).flatMap(t => t.reminders)); assert(remA.every(r => r.lastFired === undefined && r.acked === undefined)); ok('el estado de "ya sonó" no viaja en los datos sincronizados');
await openSettings(A); await A.click('#notify-switch'); assert.strictEqual(await A.locator('#notify-switch').getAttribute('aria-checked'), 'false'); await A.click('#notify-switch'); await A.click('#close-settings'); ok('interruptor de avisos por dispositivo');

// ---- resúmenes: se guardan y sincronizan solos (sin pulsar «Guardar»), y el que está abierto en el otro dispositivo se actualiza
await B.click('.nav-btn[data-tab=books]'); await B.click('.book-open'); await B.click('#book-bar-actions [data-action=edit]'); // B lo tiene abierto en edición, sin escribir
assert.strictEqual(await B.locator('#book-bar-label').innerText(), 'Se guarda automáticamente'); assert.strictEqual(await B.locator('[data-action=done]').count(), 1);
await A.click('.nav-btn[data-tab=books]'); await A.click('.book-open'); await A.click('#book-bar-actions [data-action=edit]');
await A.click('.sec-editor[data-section=ideas]'); await A.keyboard.type('idea escrita sin guardar');
await A.waitForTimeout(2200); // guardado automático (0,5 s) + subida (0,8 s)
assert.strictEqual((await A.evaluate(() => JSON.parse(localStorage.getItem('prod.books'))))[0].ideas, 'idea escrita sin guardar'); ok('el resumen se guarda solo mientras se escribe');
assert.strictEqual(await A.locator('#open-sync').getAttribute('aria-label'), 'Sincronizado'); assert.deepStrictEqual(await A.evaluate(() => JSON.parse(localStorage.getItem('prod.sync')).dirty), {}); ok('…y se sube solo (nada pendiente; la nube de la cabecera dice «Sincronizado»)');
await B.evaluate(() => window.dispatchEvent(new Event('online'))); // B consulta (lo hace solo cada 20 s, al volver a la ventana o al recuperar conexión)
await B.waitForFunction(() => document.querySelector('.sec-editor[data-section=ideas]')?.innerText.includes('idea escrita sin guardar'), null, { timeout: 5000 }); ok('B, con ese resumen abierto en edición, lo ve actualizarse sin cerrar nada');
await B.click('[data-field=title]'); await B.keyboard.press('End'); await B.keyboard.type(' (visto en PC)'); await B.waitForTimeout(2200);
await A.evaluate(() => window.dispatchEvent(new Event('online')));
await A.waitForFunction(() => document.querySelector('#book-detail [data-field=title]')?.innerText === 'Libro de A (visto en PC)', null, { timeout: 5000 });
assert.strictEqual(await A.locator('.sec-editor[data-section=ideas]').innerText(), 'idea escrita sin guardar'); ok('y lo que B cambia vuelve a A (título), conservando lo demás');
await A.click('.sec-editor[data-section=notes]'); await A.keyboard.type('a medio escribir'); await A.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
assert.strictEqual((await A.evaluate(() => JSON.parse(localStorage.getItem('prod.books'))))[0].notes, 'a medio escribir'); await A.reload();
await A.click('.book-open'); assert((await A.locator('#book-detail .box.notes p').innerText()).includes('a medio escribir')); ok('cerrar o recargar a mitad de edición no pierde lo escrito');
await A.click('#book-back'); await A.click('.nav-btn[data-tab=tasks]'); await B.click('[data-action=done]'); await B.click('#book-back'); await B.click('.nav-btn[data-tab=tasks]');

// ---- rutina: lo que se añade y se marca en un dispositivo aparece en el otro; viaja como «books» cifrados y no se mezcla con los resúmenes
await A.click('.nav-btn[data-tab=routine]'); await A.click('[data-action=rt-add]'); await A.fill('#rt-text', 'Revisar oportunidades'); await A.click('[data-action=rt-save]');
await A.locator('.rt-item [data-action=rt-toggle]').click(); await A.waitForTimeout(1800);
const rtRows = env.DB.raw.prepare("SELECT id, col, data FROM records WHERE id LIKE 'rt:%'").all();
assert.strictEqual(rtRows.length, 2); assert(rtRows.every((r) => r.col === 'books' && r.data.startsWith('e1:'))); assert(!rtRows.some((r) => /oportunidades/.test(r.data)));
await B.click('.nav-btn[data-tab=routine]'); await B.evaluate(() => window.dispatchEvent(new Event('online')));
await B.waitForFunction(() => document.querySelector('.rt-item.done .rt-text')?.textContent === 'Revisar oportunidades', null, { timeout: 5000 }); ok('rutina: el pendiente añadido y marcado en A aparece marcado en B (el servidor solo ve «books» cifrados)');
await B.locator('.rt-item [data-action=rt-toggle]').click(); await B.waitForTimeout(1800); await A.evaluate(() => window.dispatchEvent(new Event('online')));
await A.waitForFunction(() => document.querySelectorAll('.rt-item').length === 1 && !document.querySelector('.rt-item.done'), null, { timeout: 5000 }); ok('B lo desmarca y A lo ve');
await B.click('.nav-btn[data-tab=books]'); assert.strictEqual(await B.locator('.book-card').count(), 1); assert.strictEqual((await B.evaluate(() => JSON.parse(localStorage.getItem('prod.books')))).length, 1); ok('la rutina no aparece entre los resúmenes');
// ---- oportunidades (pestaña Trabajo): mismo canal cifrado; el estado que cambia B vuelve a A
await A.click('.nav-btn[data-tab=work]'); await A.click('[data-action=wk-add]'); await A.fill('#wk-title', 'Redactor remoto'); await A.fill('#wk-url', 'https://empleos.example.com/oferta/1'); await A.click('[data-action=wk-save]'); await A.waitForTimeout(1800);
const opRows = env.DB.raw.prepare("SELECT col, data FROM records WHERE id LIKE 'rt:o:%'").all(); assert.strictEqual(opRows.length, 1); assert(opRows[0].col === 'books' && opRows[0].data.startsWith('e1:') && !/Redactor|empleos/.test(opRows[0].data));
await B.click('.nav-btn[data-tab=work]'); await B.evaluate(() => window.dispatchEvent(new Event('online')));
await B.waitForFunction(() => document.querySelector('.wk-card .wk-title')?.textContent === 'Redactor remoto', null, { timeout: 5000 }); assert.strictEqual(await B.locator('.wk-card a.wk-link').getAttribute('href'), 'https://empleos.example.com/oferta/1');
await B.click('.wk-card [data-action=wk-status]'); await B.click('#work-status-list [data-status=applied]'); await B.waitForTimeout(1800); await A.evaluate(() => window.dispatchEvent(new Event('online')));
await A.waitForFunction(() => document.querySelector('.wk-card .wk-status')?.textContent.startsWith('Apliqué'), null, { timeout: 5000 }); ok('oportunidades: creada en A, aparece en B; B la marca «apliqué» y A lo ve');
assert.strictEqual((await B.evaluate(() => JSON.parse(localStorage.getItem('prod.books')))).length, 1); assert.strictEqual((await A.evaluate(() => JSON.parse(localStorage.getItem('prod.routine')).filter((r) => r.kind === 'item'))).length, 1); ok('no se mezclan con los resúmenes ni con la rutina');
// ---- ingresos (Trabajo → Ingresos): mismo canal cifrado; el cambio que hace B vuelve a A
await A.click('#work-view [data-view=income]'); await A.click('[data-action=inc-add]'); await A.fill('#inc-client', 'Tienda Luna'); await A.fill('#inc-amount', '85000'); await A.click('[data-action=inc-save]'); await A.waitForTimeout(1800);
const inRows = env.DB.raw.prepare("SELECT col, data FROM records WHERE id LIKE 'rt:m:%'").all(); assert.strictEqual(inRows.length, 1); assert(inRows[0].col === 'books' && inRows[0].data.startsWith('e1:') && !/Luna|85000/.test(inRows[0].data));
await B.click('#work-view [data-view=income]'); await B.evaluate(() => window.dispatchEvent(new Event('online')));
await B.waitForFunction(() => document.querySelector('.inc-card .wk-title')?.textContent === 'Tienda Luna', null, { timeout: 5000 }); assert.strictEqual(await B.locator('#inc-total').innerText(), '$85.000');
await B.click('.inc-card [data-action=inc-edit]'); await B.fill('#inc-amount', '120000'); await B.click('[data-action=inc-save]'); await B.waitForTimeout(1800); await A.evaluate(() => window.dispatchEvent(new Event('online')));
await A.waitForFunction(() => document.querySelector('#inc-total')?.textContent === '$120.000', null, { timeout: 5000 }); ok('ingresos: creado en A, aparece en B; B cambia el monto y A lo ve (el servidor solo ve cifrado)');
await A.click('#work-view [data-view=opps]'); await B.click('#work-view [data-view=opps]');
await A.click('.nav-btn[data-tab=tasks]'); await B.click('.nav-btn[data-tab=tasks]');

// ---- QR y enlace de vinculación
await openSettings(A); await A.click('[data-action=sync-qr]'); assert.strictEqual(await A.locator('.qr-box svg').count(), 1); await A.screenshot({ path: '/tmp/v10-qr.png' }); await A.click('[data-action=sync-qr]'); await A.click('#close-settings');
const C = await device('C-nuevo');
await C.goto('http://localhost:8123/#sync=' + code.replace(/-/g, '') + '&server=' + encodeURIComponent(SERVER));
await C.waitForSelector('#confirm:not(.hidden)'); assert((await C.locator('#confirm-msg').innerText()).includes(code)); assert.strictEqual(await C.evaluate(() => location.hash), ''); ok('enlace/QR: pide confirmar y limpia el código de la barra');
await C.click('#confirm-ok'); await C.waitForFunction(() => /Sincronizado/.test(document.querySelector('#sync-body').innerText)); await C.click('#close-settings');
assert((await tasks(C)).includes('Tarea A1 editada en PC')); ok('C se une por enlace y recibe los datos');

// ---- widget de Android
const AND = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 800 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' }); const D = await AND.newPage();
await D.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG = { server: "' + SERVER + '", widgetDownload: "https://github.com/x/y/releases/download/widget-latest/pendientes-widget.apk", widgetScheme: "pendientes", widgetPackage: "app.productividad.widget" };' }));
await D.route(SERVER + '/**', async (route) => { const req = route.request(); const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); const r = await worker.fetch(new Request(req.url(), { method: req.method(), body: req.postData() || undefined }), env); return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': r.headers.get('content-type') || 'text/plain' }, body: await r.text() }); });
await D.goto('http://localhost:8123/'); await D.click('#open-settings'); await openSyncCard(D);
assert((await D.locator('#widget-block').innerText()).includes('Primero crea tu código')); ok('widget: antes de sincronizar pide crear el código');
await D.click('[data-action=sync-create]'); await D.waitForSelector('#widget-connect');
const href = await D.getAttribute('#widget-connect', 'href'); const codeD = (await D.locator('.code-box').innerText()).trim().replace(/-/g, '');
assert(href.startsWith('intent://link?') && href.includes('code=' + codeD) && href.includes('server=' + encodeURIComponent(SERVER)) && href.includes('#Intent;scheme=pendientes;package=app.productividad.widget;S.browser_fallback_url=' + encodeURIComponent('https://github.com/x/y/releases/download/widget-latest/pendientes-widget.apk') + ';end'));
console.log('  ', href.slice(0, 120) + '…'); ok('botón «Conectar el widget» (Android): enlace intent con código, servidor, app y descarga DIRECTA del APK como respaldo');
assert.strictEqual(await D.locator('.steps li').count(), 6); assert.strictEqual(await D.getAttribute('#widget-update', 'href'), 'https://github.com/x/y/releases/download/widget-latest/pendientes-widget.apk'); ok('pasos de instalación y de actualización visibles, y botón «Descargar la versión nueva» directo al archivo');
assert.strictEqual(await C.evaluate(() => /Android/i.test(navigator.userAgent)), false); await openSettings(C); assert((await C.locator('#widget-block').innerText()).includes('solo para Android')); await C.click('#close-settings'); ok('en un computador: explica que el widget es solo Android');

// ---- borrar mis datos del servidor
await openSettings(C); await C.click('[data-action=sync-erase]'); await C.click('#confirm-ok'); await C.waitForSelector('[data-action=sync-create]');
assert.strictEqual(env.DB.raw.prepare("SELECT COUNT(*) c FROM records WHERE space=?").get(await C.evaluate(() => JSON.parse(localStorage.getItem('prod.sync')).space || 'x')).c, 0);
await C.click('#close-settings'); assert((await tasks(C)).length > 0); ok('«Borrar mis datos del servidor»: se vacía el servidor y los datos locales se quedan');

// ---- desvincular
await openSettings(A); await A.click('[data-action=sync-unlink]'); await A.click('#confirm-ok'); await A.waitForSelector('[data-action=sync-create]'); await A.click('#close-settings'); assert((await tasks(A)).length > 0); ok('desvincular conserva los datos locales');
console.log('errores de página:', errs);
await b.close();
