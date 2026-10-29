// Trabajo → Ingresos en el navegador: añadir, total del mes con desglose, cambiar de mes, editar, borrar, datos ajenos
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-07T10:00:00') });
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.routine') || '[]'));
  const total = () => p.locator('#inc-total').innerText();
  const add = async ({ client, amount, date, type }) => {
    await p.click('[data-action=inc-add]'); await p.fill('#inc-client', client); await p.fill('#inc-amount', amount);
    if (date) await p.fill('#inc-date', date); if (type) await p.selectOption('#inc-type', type);
    await p.click('[data-action=inc-save]');
  };

  // ---- Trabajo tiene dos vistas; Ingresos empieza en el mes actual y vacío
  await p.click('.nav-btn[data-tab=work]'); assert.deepStrictEqual(await p.locator('#work-view button').allInnerTexts(), ['Oportunidades', 'Ingresos']);
  assert((await p.locator('#work-body').innerText()).includes('Aún no hay oportunidades'));
  await p.click('#work-view [data-view=income]'); assert.strictEqual(await p.locator('#inc-month').innerText(), 'Octubre 2026'); assert.strictEqual(await total(), '$ 0');
  assert((await p.locator('#work-body').innerText()).includes('No hay ingresos en octubre 2026')); assert(await p.locator('[data-action=inc-next]').isDisabled());
  ok('vista Ingresos: mes actual, total en cero');

  // ---- añadir: valida cliente y monto; la fecha propone hoy
  await p.click('[data-action=inc-add]'); assert.strictEqual(await p.inputValue('#inc-date'), '2026-10-07'); await p.click('[data-action=inc-save]'); assert((await p.locator('#wk-error').innerText()).includes('cliente'));
  await p.fill('#inc-client', 'Ana Pérez'); await p.fill('#inc-amount', '150.000,50'); await p.click('[data-action=inc-save]'); assert((await p.locator('#wk-error').innerText()).includes('sin centavos'));
  await p.fill('#inc-amount', '150.000'); await p.selectOption('#inc-type', 'presencial'); await p.click('[data-action=inc-save]');
  await add({ client: 'Tienda Luna', amount: '80000', date: '2026-10-02' });
  await add({ client: 'Septiembre SA', amount: '$ 1.000.000', date: '2026-09-15' });
  assert.strictEqual(await p.locator('#inc-month').innerText(), 'Septiembre 2026'); assert.strictEqual(await total(), '$ 1.000.000'); // guardar lleva al mes del ingreso
  await p.click('[data-action=inc-next]'); assert.strictEqual(await total(), '$ 230.000'); assert.strictEqual(await p.locator('#inc-split').innerText(), 'Con Claude $ 80.000 · Presencial $ 150.000');
  assert.deepStrictEqual(await p.locator('.inc-client').allInnerTexts(), ['Ana Pérez', 'Tienda Luna']); assert.deepStrictEqual(await p.locator('.inc-row .inc-amount').allInnerTexts(), ['$ 150.000', '$ 80.000']);
  assert((await p.locator('.inc-row').first().innerText()).includes('Presencial'));
  let data = await stored(); assert(data.filter((r) => r.kind === 'income').every((r) => r.id.startsWith('m:') && Number.isInteger(r.amount) && r.updatedAt > 0)); assert.strictEqual(data.find((r) => r.client === 'Ana Pérez').amount, 150000);
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('añadir ingresos (cliente y monto obligatorios, sin centavos); total del mes con desglose; meses separados');

  // ---- editar y eliminar; sigue tras recargar
  await p.locator('.inc-row', { hasText: 'Tienda Luna' }).click(); assert.strictEqual(await p.inputValue('#inc-amount'), '80.000'); await p.fill('#inc-amount', '120.000'); await p.click('[data-action=inc-save]');
  assert.strictEqual(await total(), '$ 270.000');
  await p.locator('.inc-row', { hasText: 'Ana' }).click(); await p.click('[data-action=inc-delete]'); await p.click('#confirm-ok'); assert.strictEqual(await total(), '$ 120.000');
  await p.click('#work-view [data-view=opps]'); assert((await p.locator('#work-body').innerText()).includes('Aún no hay oportunidades')); // los ingresos no son oportunidades
  await p.reload(); await p.click('.nav-btn[data-tab=work]'); await p.click('#work-view [data-view=income]'); assert.strictEqual(await total(), '$ 120.000');
  await p.click('[data-action=inc-add]'); await p.keyboard.press('Escape'); assert.strictEqual(await p.locator('#work-sheet.hidden').count(), 1); assert.strictEqual(await total(), '$ 120.000');
  ok('editar y eliminar; Escape cierra sin guardar; no se mezcla con oportunidades');

  // ---- datos de otro dispositivo: el texto nunca es HTML; los registros dañados no suman
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('prod.routine')); l.push({ id: 'm:evil', kind: 'income', client: '<img src=x onerror=window.__pwned=1>', amount: 5, date: '2026-10-03', type: 'claude' }, { id: 'm:bad', client: 'x', amount: 'mucho', date: '2026-10-03' }); localStorage.setItem('prod.routine', JSON.stringify(l)); });
  await p.reload(); await p.click('#work-view [data-view=income]'); assert.strictEqual(await total(), '$ 120.005'); assert.strictEqual(await p.locator('.inc-list img').count(), 0); assert.strictEqual(await p.evaluate(() => window.__pwned), undefined);
  assert((await stored()).some((r) => r.id === 'm:bad')); // lo que no entiende se conserva sin tocar
  ok('datos maliciosos o dañados: texto plano, no suman, se conservan');

  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.log('FALLO', e.message); process.exit(1); });
