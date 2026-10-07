// Pestaña Rutina en el navegador: crear, tachar con un clic, periodos, semana, editar, borrar, separación de las tareas
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'light', timezoneId: 'America/Bogota', locale: 'es-CO', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-07T08:00:00-05:00') }); // miércoles
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const items = (sel = '#routine-groups') => p.$$eval(sel + ' .routine-item .task-text', e => e.map(x => x.textContent));
  const add = async (text, freq) => { await p.click(`#routine-freq [data-freq=${freq}]`); await p.fill('#routine-input', text); await p.click('#routine-form button[type=submit]'); };

  await p.click('.nav-btn[data-tab=routine]');
  assert.strictEqual(await p.textContent('#page-title'), 'Rutina');
  assert(await p.locator('#routine-empty').isVisible()); assert(await p.locator('#routine-week').isHidden());
  assert(await p.locator('#open-filter').isHidden()); ok('pestaña Rutina vacía con explicación');

  await add('Revisar correo UIS', 'daily'); await add('Buscar oportunidades', 'weekdays'); await add('Resumen semanal', 'weekly'); await add('Revisar gastos', 'monthly');
  assert.deepStrictEqual(await p.$$eval('#routine-groups .group-head span:first-child', e => e.map(x => x.textContent)), ['Hoy', 'Esta semana', 'Este mes']);
  assert.deepStrictEqual(await items(), ['Revisar correo UIS', 'Buscar oportunidades', 'Resumen semanal', 'Revisar gastos']);
  ok('cuatro frecuencias en sus secciones');

  await p.click('.nav-btn[data-tab=tasks]');
  await p.fill('#task-input', 'Parcial de cálculo'); await p.click('#task-form button[type=submit]');
  assert.deepStrictEqual(await p.$$eval('#task-groups .task-text', e => e.map(x => x.textContent)), ['Parcial de cálculo']);
  assert.strictEqual(await p.textContent('#task-counter'), '1 pendiente de 1'); ok('la rutina no aparece entre las tareas');

  await p.click('.nav-btn[data-tab=routine]');
  await p.check('.routine-item:has-text("Revisar correo UIS") input');
  await p.check('.routine-item:has-text("Resumen semanal") input');
  assert.strictEqual(await p.locator('.routine-item.done').count(), 2);
  assert.strictEqual(await p.textContent('[data-group=r-day] .count'), '1/2'); ok('tachar con un clic');
  assert((await p.textContent('#routine-week .week-head span')).includes('2 de 3')); ok('tarjeta de la semana: 2 de 3');
  await p.screenshot({ path: require('os').tmpdir() + '/rutina-1.png' });

  await p.reload(); await p.click('.nav-btn[data-tab=routine]');
  assert.strictEqual(await p.locator('.routine-item.done').count(), 2); ok('persiste al recargar');

  // jueves: el diario vuelve sin tachar, el semanal sigue hecho
  await p.clock.fastForward(24 * 3600 * 1000); await p.waitForTimeout(100);
  assert.strictEqual(await p.locator('.routine-item:has-text("Revisar correo UIS").done').count(), 0);
  assert.strictEqual(await p.locator('.routine-item:has-text("Resumen semanal").done').count(), 1); ok('a medianoche lo diario vuelve a salir sin tachar; lo semanal sigue');
  assert.strictEqual(await p.locator('.wd.full').count(), 0); assert.strictEqual(await p.locator('.wd.part').count(), 1); assert.strictEqual(await p.locator('.wd.today small').textContent(), 'J');
  ok('puntos de la semana: miércoles a medias, hoy jueves');

  // editar: texto y frecuencia
  await p.click('.routine-item:has-text("Buscar oportunidades") [data-action=menu-task]'); await p.click('#menu-edit');
  await p.fill('[data-edit=rtext]', 'Buscar oportunidades de práctica'); await p.click('[data-edit=freq] [data-freq=weekly]'); await p.click('[data-action=save-routine]');
  assert.deepStrictEqual(await items('[data-group=r-week]'), ['Buscar oportunidades de práctica', 'Resumen semanal']); ok('editar texto y frecuencia');
  // borrar
  await p.click('.routine-item:has-text("Revisar gastos") [data-action=menu-task]'); await p.click('#menu-delete');
  assert.strictEqual(await p.locator('[data-group=r-month]').count(), 0); ok('borrar');

  // datos guardados: kind routine en la lista de tareas, done siempre false, log por periodo
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('prod.tasks')));
  const r = saved.filter(t => t.kind === 'routine');
  assert.strictEqual(r.length, 3); assert(r.every(t => t.done === false && t.updatedAt));
  assert.deepStrictEqual(Object.keys(r.find(t => t.text === 'Revisar correo UIS').log), ['2026-10-07']);
  assert.deepStrictEqual(Object.keys(r.find(t => t.text === 'Resumen semanal').log), ['2026-W41']); ok('se guarda en la lista sincronizada con su historial');

  // enlace #task= a un pendiente de rutina abre la pestaña Rutina
  await p.click('.nav-btn[data-tab=tasks]');
  await p.evaluate((id) => { location.hash = 'task=' + id; }, r[0].id); await p.waitForTimeout(100);
  assert.strictEqual(await p.textContent('#page-title'), 'Rutina'); ok('#task= de un pendiente de rutina abre la Rutina');

  await p.screenshot({ path: require('os').tmpdir() + '/rutina-2.png' });
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.click('#open-settings'); await p.click('#theme-switch'); await p.click('#close-settings');
  await p.screenshot({ path: require('os').tmpdir() + '/rutina-dark.png' });
  assert.deepStrictEqual(errs, []); ok('sin errores en la consola');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
