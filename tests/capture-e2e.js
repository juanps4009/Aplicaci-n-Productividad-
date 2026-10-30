// Captura rápida y deslizar en el navegador: frases → Pendientes / Rutina / Trabajo, Deshacer, gestos, Ctrl+K
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-29T14:00:00') }); // jueves
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const tasks = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.tasks') || '[]'));
  const routine = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.routine') || '[]'));
  const capture = async (text) => { await p.click('#qc-fab'); await p.fill('#qc-input', text); };
  const undo = async () => { const u = p.locator('#undo-toast:not(.hidden) button, .qc-toast.show button').first(); await u.click(); };

  // ---- botón visible, hoja con ejemplos
  assert(await p.locator('#qc-fab').isVisible()); await p.click('#qc-fab');
  assert(await p.locator('#qc-sheet').isVisible()); assert.strictEqual(await p.locator('.qc-example').count(), 4);
  assert(await p.locator('#qc-save').isDisabled()); ok('botón Anotar y hoja con ejemplos');

  // ---- tarea con fecha, hora (aviso) y prioridad; resaltado
  await p.fill('#qc-input', 'mañana 9am llamar a Ana !');
  assert.strictEqual(await p.locator('.qc-mirror mark').count(), 3);
  assert((await p.locator('.qc-preview').innerText()).includes('Llamar a Ana'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  assert(await p.locator('#qc-sheet').isHidden());
  let t = (await tasks()).find((x) => x.text === 'Llamar a Ana');
  assert.deepStrictEqual([t.due, t.priority, t.reminders.length, t.reminders[0].kind, t.reminders[0].at], ['2026-10-30', 'high', 1, 'once', '2026-10-30T09:00']);
  assert((await p.locator('#task-groups').innerText()).includes('Llamar a Ana')); ok('tarea con fecha, aviso a las 9 y prioridad alta');

  // ---- deshacer la captura
  await capture('comprar pan'); await p.click('#qc-save');
  assert((await tasks()).some((x) => x.text === 'Comprar pan')); await undo();
  assert(!(await tasks()).some((x) => x.text === 'Comprar pan')); ok('Deshacer quita lo recién anotado');

  // ---- rutina y oferta: va a su pestaña
  await capture('cada lunes revisar ofertas en Workana'); assert((await p.locator('.qc-preview').innerText()).includes('Va a Rutina'.toUpperCase()) || (await p.locator('.qc-preview').innerText()).toLowerCase().includes('va a rutina'));
  await p.click('#qc-save'); await p.waitForTimeout(100);
  const it = (await routine()).find((r) => r.text === 'Revisar ofertas en Workana'); assert.deepStrictEqual([it.freq, it.days], ['daily', [1]]);
  assert.strictEqual(await p.evaluate(() => state.tab), 'routine'); ok('rutina «cada lunes» y salta a Rutina');
  await capture('oferta traductor remoto https://www.workana.com/job/x cierra el viernes'); await p.click('#qc-save'); await p.waitForTimeout(100);
  const o = (await routine()).find((r) => r.title === 'Traductor remoto'); assert.deepStrictEqual([o.kind, o.closes, o.url, o.status], ['opp', '2026-10-30', 'https://www.workana.com/job/x', 'review']);
  assert.strictEqual(await p.evaluate(() => state.tab), 'work'); assert(await p.locator('.wk-card', { hasText: 'Traductor remoto' }).isVisible()); ok('oferta con enlace y cierre, en Trabajo');

  // ---- cambiar destino a mano y quitar un chip
  await capture('mañana revisar Workana'); await p.click('.qc-chip[data-v=routine]');
  assert.strictEqual(await p.locator('.qc-chip[aria-checked=true]').innerText(), 'Rutina');
  await p.click('.qc-chip[data-qc=kind][data-v=task]'); await p.click('[data-qc=unspan]');
  assert.strictEqual(await p.inputValue('#qc-input'), 'revisar Workana'); await p.keyboard.press('Escape'); assert(await p.locator('#qc-sheet').isHidden()); ok('cambiar destino, quitar chip, Escape cierra');

  // ---- texto con HTML no se interpreta
  await capture('<img src=x onerror=alert(1)> mañana'); assert.strictEqual(await p.locator('.qc-mirror img').count(), 0); await p.click('#qc-save');
  assert((await tasks()).some((x) => x.text === '<img src=x onerror=alert(1)>')); ok('texto con HTML se guarda como texto');

  // ---- deslizar en Pendientes
  await p.click('.nav-btn[data-tab=tasks]');
  const swipe = async (sel, dx) => {
    const box = await p.locator(sel).first().boundingBox(); const y = box.y + box.height / 2, x = box.x + box.width / 2;
    await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(x + dx * i / 8, y + 1); await p.mouse.up(); await p.waitForTimeout(350);
  };
  const row = (txt) => `#task-groups li.task-item:has-text("${txt}")`;
  await swipe(row('Llamar a Ana'), 260); t = (await tasks()).find((x) => x.text === 'Llamar a Ana'); assert.strictEqual(t.done, true); ok('deslizar a la derecha: hecha');
  await undo(); t = (await tasks()).find((x) => x.text === 'Llamar a Ana'); assert.strictEqual(t.done, false); ok('Deshacer devuelve la tarea');
  await swipe(row('Llamar a Ana'), -260); t = (await tasks()).find((x) => x.text === 'Llamar a Ana'); assert.strictEqual(t.due, '2026-10-30'); ok('deslizar a la izquierda: a mañana');
  await swipe(row('<img'), 40); t = (await tasks()).find((x) => x.text.startsWith('<img')); assert.strictEqual(t.done, false); ok('un deslizamiento corto no hace nada');
  assert.strictEqual(await p.locator('.qc-under').count(), 0);

  // ---- deslizar ofertas
  await p.click('.nav-btn[data-tab=work]');
  await swipe('.wk-card:has-text("Traductor remoto")', 260);
  let o2 = (await routine()).find((r) => r.title === 'Traductor remoto'); assert.strictEqual(o2.status, 'applied');
  await swipe('.wk-card:has-text("Traductor remoto")', -260); o2 = (await routine()).find((r) => r.title === 'Traductor remoto'); assert.strictEqual(o2.status, 'discarded'); ok('ofertas: avanzar y descartar');

  // ---- teclado: Ctrl+K y «/»
  await p.keyboard.press('Control+k'); assert(await p.locator('#qc-sheet').isVisible()); await p.keyboard.press('Escape');
  await p.keyboard.press('/'); assert(await p.locator('#qc-sheet').isVisible()); await p.keyboard.press('Escape'); ok('Ctrl+K y / abren la captura');

  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); ok('nada se sale de la pantalla');
  assert.deepStrictEqual(errs, []); ok('sin errores en la consola');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
