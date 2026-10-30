const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 340, height: 480 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const tasks = [
    { id: 'a', text: 'Sin fecha', done: false, priority: 'low', due: '', reminders: [], doc: [] },
    { id: 'b', text: 'Vencida', done: false, priority: 'high', due: '2020-01-01', reminders: [], doc: [] },
    { id: 'c', text: 'Hecha', done: true, priority: 'medium', due: '', reminders: [], doc: [] },
  ];
  await p.addInitScript((m) => { if (localStorage.getItem('x')) return; localStorage.setItem('x', '1'); localStorage.setItem('prod.tasks', JSON.stringify(m)); }, tasks);
  await p.goto('http://localhost:8123/#widget'); await p.waitForTimeout(700);
  assert(!(await p.locator('.app-header').isVisible()) && !(await p.locator('.bottom-nav').isVisible()) && !(await p.locator('#task-form').isVisible()));
  const items = await p.locator('.widget-item .task-text').allTextContents();
  assert.deepStrictEqual(items, ['Vencida', 'Sin fecha']); console.log('OK solo pendientes, la vencida primero');
  assert.strictEqual((await p.locator('.widget-head').innerText()).replace(/\s+/g, ' ').trim().startsWith('Pendientes · 2'), true); console.log('OK contador');
  // cambio hecho por otra ventana: aparece sin recargar
  const p2 = await ctx.newPage(); await p2.goto('http://localhost:8123/'); await p2.waitForTimeout(500);
  await p2.evaluate(() => { const t = JSON.parse(localStorage.getItem('prod.tasks')); t.push({ id: 'd', text: 'Nueva', done: false, priority: 'medium', due: '', reminders: [], doc: [] }); localStorage.setItem('prod.tasks', JSON.stringify(t)); });
  await p.waitForTimeout(500);
  assert((await p.locator('.widget-item .task-text').allTextContents()).includes('Nueva')); console.log('OK se actualiza al cambiar la app principal');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), p.locator('.widget-item[data-id="b"]').click()]);
  await pop.waitForTimeout(700); assert(await pop.evaluate(() => !document.body.classList.contains('widget-mode') && document.querySelector('li[data-id="b"]')?.classList.contains('flash'))); console.log('OK tocar una tarea abre la app en esa tarea');
  // dentro de la ventana sin marco de Windows (WebView2) existe window.chrome.webview: el encabezado arrastra la ventana
  const f = await ctx.newPage(); const msgs = [];
  await f.exposeFunction('__msg', (m) => msgs.push(m));
  await f.addInitScript(() => { window.chrome = { webview: { postMessage: (m) => window.__msg(m) } }; });
  await f.goto('http://localhost:8123/#widget'); await f.waitForTimeout(700);
  assert(await f.evaluate(() => document.body.classList.contains('widget-frameless')));
  const hb = await f.locator('.widget-head strong').boundingBox();
  await f.mouse.move(hb.x + 5, hb.y + 5); await f.mouse.down(); await f.mouse.move(hb.x + 40, hb.y + 30); await f.mouse.up(); await f.mouse.move(hb.x + 80, hb.y + 60); await f.waitForTimeout(200);
  assert(msgs.some((m) => m.startsWith('drag:start:')) && msgs.some((m) => m.startsWith('drag:move:')), 'sin mensajes de arrastre: ' + msgs);
  const total = msgs.length; await f.mouse.move(hb.x + 90, hb.y + 70); await f.waitForTimeout(100);
  assert.strictEqual(msgs.length, total); console.log('OK sin marco: el encabezado arrastra y al soltar deja de avisar');
  await f.locator('[data-widget=open]').click(); await f.waitForTimeout(200);
  assert(!msgs.some((m) => m.startsWith('drag:start:') && m !== msgs.find((x) => x.startsWith('drag:start:'))), 'el boton de abrir no debe arrastrar'); console.log('OK el boton de abrir no arrastra');
  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})();
