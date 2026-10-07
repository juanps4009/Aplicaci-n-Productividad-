// Pestaña «Trabajo» → Ingresos en el navegador: añadir, total por mes, cambiar de mes, editar, eliminar, sincronización
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
  const card = (text) => p.locator('.inc-card', { hasText: text });
  const add = async ({ client, amount, date, type, note }) => {
    await p.click('[data-action=inc-add]'); await p.fill('#inc-client', client); await p.fill('#inc-amount', amount);
    if (date) await p.fill('#inc-date', date); if (type) await p.selectOption('#inc-type', type); if (note) await p.fill('#inc-note', note);
    await p.click('[data-action=inc-save]');
  };

  // ---- dos vistas dentro de Trabajo; Oportunidades sigue siendo la de siempre
  await p.click('.nav-btn[data-tab=work]');
  assert.deepStrictEqual(await p.locator('#work-view button').allInnerTexts(), ['Oportunidades', 'Ingresos']); assert(await p.locator('#work-view [data-view=opps]').evaluate((e) => e.classList.contains('active')));
  assert((await p.locator('#work-body').innerText()).includes('Aún no hay oportunidades'));
  await p.click('#work-view [data-view=income]'); assert((await p.locator('#work-body').innerText()).includes('Aún no hay ingresos'));
  assert.strictEqual(await p.locator('#inc-month-label').innerText(), 'Octubre 2026'); assert.strictEqual(await p.locator('#inc-total').innerText(), '$0'); assert(await p.locator('[data-action=inc-next]').isDisabled());
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); ok('Trabajo tiene dos vistas; Ingresos empieza vacía en el mes actual');

  // ---- añadir: valida cliente, monto y fecha
  await p.click('[data-action=inc-add]'); assert.strictEqual(await p.inputValue('#inc-date'), '2026-10-07'); assert.strictEqual(await p.inputValue('#inc-type'), 'claude');
  await p.click('[data-action=inc-save]'); assert((await p.locator('#inc-error').innerText()).includes('nombre del cliente'));
  await p.fill('#inc-client', 'Tienda Luna'); await p.click('[data-action=inc-save]'); assert((await p.locator('#inc-error').innerText()).includes('monto'));
  await p.fill('#inc-amount', '85 mil'); await p.click('[data-action=inc-save]'); assert((await p.locator('#inc-error').innerText()).includes('monto'));
  await p.fill('#inc-amount', '85.000'); await p.fill('#inc-date', ''); await p.click('[data-action=inc-save]'); assert((await p.locator('#inc-error').innerText()).includes('fecha'));
  await p.fill('#inc-date', '2026-10-05'); await p.fill('#inc-note', 'Textos para redes'); await p.click('[data-action=inc-save]'); assert.strictEqual(await p.locator('#income-sheet.hidden').count(), 1);
  await add({ client: 'Ana Pérez', amount: '1250000', date: '2026-10-03', type: 'onsite', note: 'Clase de refuerzo' }); await add({ client: 'Café Norte', amount: '40000', date: '2026-10-05' });
  assert.deepStrictEqual(await p.locator('.inc-card .wk-title').allInnerTexts(), ['Café Norte', 'Tienda Luna', 'Ana Pérez']); // la más reciente primero; a igual fecha, la última añadida
  assert.strictEqual(await p.locator('#inc-total').innerText(), '$1.375.000'); assert.strictEqual(await p.locator('#inc-split').innerText(), '3 trabajos · Con Claude $125.000 · Presencial $1.250.000');
  assert.strictEqual(await card('Tienda').locator('.inc-amount').innerText(), '$85.000'); assert((await card('Tienda').innerText()).includes('Textos para redes')); assert((await card('Ana').locator('.inc-type').innerText()) === 'Presencial');
  ok('añadir ingresos (cliente, monto y fecha obligatorios); total del mes y reparto por tipo');

  // ---- se guarda como registro «m:…», listo para sincronizar
  let data = (await stored()).filter((r) => r.kind === 'inc'); assert.strictEqual(data.length, 3);
  assert(data.every((r) => r.id.startsWith('m:') && r.updatedAt > 0)); assert.deepStrictEqual(data.find((r) => r.client === 'Ana Pérez'), { ...data.find((r) => r.client === 'Ana Pérez'), kind: 'inc', date: '2026-10-03', amount: 1250000, type: 'onsite', note: 'Clase de refuerzo' });
  ok('se guardan como registros «m:…» con sello de cambio');

  // ---- cambiar de mes; un ingreso de otro mes lleva a ese mes
  await add({ client: 'Cliente de septiembre', amount: '$ 300,000', date: '2026-09-28' });
  assert.strictEqual(await p.locator('#inc-month-label').innerText(), 'Septiembre 2026'); assert.strictEqual(await p.locator('#inc-total').innerText(), '$300.000'); assert.strictEqual(await p.locator('.inc-card').count(), 1); assert(!(await p.locator('[data-action=inc-next]').isDisabled()));
  await p.click('[data-action=inc-prev]'); assert.strictEqual(await p.locator('#inc-month-label').innerText(), 'Agosto 2026'); assert((await p.locator('#work-body').innerText()).includes('No hay ingresos en este mes')); assert.strictEqual(await p.locator('#inc-total').innerText(), '$0');
  await p.click('[data-action=inc-next]'); await p.click('[data-action=inc-next]'); assert.strictEqual(await p.locator('#inc-month-label').innerText(), 'Octubre 2026'); assert.strictEqual(await p.locator('#inc-total').innerText(), '$1.375.000'); assert(await p.locator('[data-action=inc-next]').isDisabled());
  ok('cambiar de mes (no se pasa del mes actual) y total de cada mes');

  // ---- editar y eliminar
  await card('Tienda').locator('[data-action=inc-edit]').click(); assert.strictEqual(await p.inputValue('#inc-client'), 'Tienda Luna'); assert.strictEqual(await p.inputValue('#inc-amount'), '85.000'); assert.strictEqual(await p.inputValue('#inc-date'), '2026-10-05');
  await p.fill('#inc-amount', '95000'); await p.selectOption('#inc-type', 'onsite'); await p.click('[data-action=inc-save]');
  assert.strictEqual(await card('Tienda').locator('.inc-amount').innerText(), '$95.000'); assert.strictEqual(await p.locator('#inc-split').innerText(), '3 trabajos · Con Claude $40.000 · Presencial $1.345.000');
  await card('Café').locator('[data-action=inc-edit]').click(); await p.click('[data-action=inc-delete]'); await p.click('#confirm-ok'); assert.strictEqual(await card('Café').count(), 0); assert.strictEqual(await p.locator('#inc-total').innerText(), '$1.345.000');
  const tombs = await p.evaluate(() => JSON.parse(localStorage.getItem('prod.tomb')).filter((t) => t.col === 'routine')); assert.strictEqual(tombs.length, 1); assert(tombs[0].id.startsWith('m:'));
  ok('editar y eliminar (queda listo para sincronizar)');

  // ---- persiste al recargar; las oportunidades no se mezclan
  await p.reload(); assert.strictEqual(await p.locator('#page-title').innerText(), 'Trabajo'); assert.strictEqual(await p.locator('#work-view [data-view=opps]').evaluate((e) => e.classList.contains('active')), true);
  await p.click('#work-view [data-view=income]'); assert.strictEqual(await p.locator('#inc-total').innerText(), '$1.345.000');
  await p.click('#work-view [data-view=opps]'); await p.click('[data-action=wk-add]'); await p.fill('#wk-title', 'Redactor remoto'); await p.click('[data-action=wk-save]');
  assert.strictEqual(await p.locator('.wk-card').count(), 1); assert.strictEqual(await p.locator('#work-count').innerText(), '1 por revisar · 0 aplicadas · 0 con respuesta'); assert.strictEqual(await p.locator('.inc-card').count(), 0);
  await p.click('#work-view [data-view=income]'); assert.strictEqual(await p.locator('.inc-card').count(), 2); assert.strictEqual(await p.locator('.wk-card').count(), 0); ok('persisten al recargar y no se mezclan con las oportunidades');

  // ---- datos de otro dispositivo: texto sin HTML; registros dañados se conservan sin romper nada
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('prod.routine')); l.push({ id: 'm:evil', kind: 'inc', date: '2026-10-06', client: '<img src=x onerror=window.__pwned=1>', amount: 1000, type: 'claude', note: '<script>window.__pwned=2</script>', createdAt: 9 }, { id: 'm:mal', kind: 'inc', date: 'ayer', amount: 'mucho' }); localStorage.setItem('prod.routine', JSON.stringify(l)); });
  await p.reload(); await p.click('#work-view [data-view=income]');
  assert.strictEqual(await card('onerror').count(), 1); assert.strictEqual(await card('onerror').locator('img, script').count(), 0); assert.strictEqual(await p.evaluate(() => window.__pwned), undefined); assert.strictEqual(await p.locator('.inc-card').count(), 3);
  assert((await stored()).some((r) => r.id === 'm:mal')); ok('datos ajenos: se muestran como texto; lo que no se entiende se conserva sin tocar');

  // ---- no aparecen en Rutina, Resúmenes ni Pendientes
  await p.click('.nav-btn[data-tab=routine]'); assert((await p.locator('#routine-body').innerText()).includes('Tu rutina está vacía')); await p.click('.nav-btn[data-tab=books]'); assert.strictEqual(await p.locator('.book-card').count(), 0);
  await p.click('.nav-btn[data-tab=tasks]'); assert.strictEqual(await p.locator('.task-item').count(), 0); ok('los ingresos no aparecen en Rutina, Resúmenes ni Pendientes');

  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.log('FALLO', e.message); process.exit(1); });
