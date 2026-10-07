// Rutina en el navegador: añadir, marcar con un toque, reinicio diario, editar, resumen semanal y comentario
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-07T10:00:00') }); // miércoles
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.routine') || '[]'));
  const add = async (text, freq, offDays = []) => {
    await p.click('[data-action=rt-add]'); await p.fill('#rt-text', text);
    if (freq !== 'daily') await p.click(`#rt-freq [data-freq=${freq}]`);
    for (const d of offDays) await p.click(`#rt-days [data-day="${d}"]`);
    await p.click('[data-action=rt-save]');
  };
  const row = (text) => p.locator('.rt-item', { hasText: text });

  // ---- pestaña nueva, vacía al principio
  assert.strictEqual(await p.locator('.nav-btn').count(), 4); await p.click('.nav-btn[data-tab=routine]');
  assert.strictEqual(await p.locator('#page-title').innerText(), 'Rutina'); assert((await p.locator('#routine-body').innerText()).includes('Tu rutina está vacía')); ok('pestaña Rutina con estado vacío');
  await p.click('[data-action=rt-add]'); await p.click('[data-action=rt-save]'); assert((await p.locator('#rt-error').innerText()).includes('Escribe')); await p.click('#routine-sheet-close');

  // ---- añadir pendientes de cada frecuencia
  await add('Hacer resumen del libro', 'daily');
  await p.click('[data-action=rt-edit]'); // el resto se añade desde «Editar»
  await add('Revisar oportunidades', 'daily', [2, 4, 6, 7]); // quita martes, jueves, sábado y domingo → lunes, miércoles, viernes
  await add('Ir al gimnasio', 'daily', [3]);                 // todos menos miércoles: hoy no toca
  await add('Planear la semana', 'weekly'); await add('Pagar cuentas', 'monthly');
  assert.strictEqual(await p.locator('.rt-item.editing').count(), 5); assert((await row('Revisar oportunidades').innerText()).includes('lunes, miércoles, viernes'));
  await p.click('[data-action=rt-edit]');
  assert.strictEqual(await p.locator('.rt-item').count(), 4); assert.strictEqual(await row('Ir al gimnasio').count(), 0); // hoy (miércoles) no toca
  assert.strictEqual(await p.locator('#routine-count').innerText(), '0 de 4 hechos');
  assert.deepStrictEqual(await p.locator('.rt-group-head span:first-child').allInnerTexts(), ['HOY', 'ESTA SEMANA', 'ESTE MES']);
  ok('añadir pendientes diarios (con días), semanales y mensuales; hoy solo se ve lo que toca');

  // ---- un toque marca, otro desmarca
  await row('Hacer resumen del libro').locator('[data-action=rt-toggle]').click();
  assert.strictEqual(await row('Hacer resumen del libro').evaluate((e) => e.classList.contains('done')), true); assert.strictEqual(await p.locator('#routine-count').innerText(), '1 de 4 hechos');
  assert.strictEqual(await row('Hacer resumen del libro').locator('[role=checkbox]').getAttribute('aria-checked'), 'true');
  await row('Hacer resumen del libro').locator('[data-action=rt-toggle]').click(); assert.strictEqual(await p.locator('#routine-count').innerText(), '0 de 4 hechos');
  await row('Hacer resumen del libro').locator('[data-action=rt-toggle]').click(); await row('Planear la semana').locator('[data-action=rt-toggle]').click(); await row('Pagar cuentas').locator('[data-action=rt-toggle]').click();
  assert.strictEqual(await p.locator('#routine-count').innerText(), '3 de 4 hechos'); assert.strictEqual(await p.locator('.rt-bar span').evaluate((e) => e.style.width), '75%');
  let data = await stored(); assert.deepStrictEqual(data.filter((r) => r.kind === 'period').map((r) => r.id).sort(), ['p:2026-10', 'p:2026-10-07', 'p:2026-W41']);
  await p.reload(); await p.clock.resume?.(); assert.strictEqual(await p.locator('#page-title').innerText(), 'Rutina'); assert.strictEqual(await p.locator('.rt-item.done').count(), 3);
  ok('marcar con un toque (y desmarcar); se guarda y sigue tras recargar');

  // ---- tarjeta «Tu semana»: porcentaje y un punto por día
  const dots = () => p.locator('.rt-week-card .rt-dot').evaluateAll((els) => els.map((e) => e.className.replace('rt-dot d-', '')));
  assert.strictEqual(await p.locator('#routine-week-pct').innerText(), '100 %'); assert.deepStrictEqual(await dots(), ['empty', 'empty', 'today', 'future', 'future', 'future', 'future']);
  assert.deepStrictEqual(await p.locator('.rt-week-card .rt-dot small').allInnerTexts(), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  await row('Revisar oportunidades').locator('[data-action=rt-toggle]').click(); assert.deepStrictEqual((await dots())[2], 'full'); await row('Revisar oportunidades').locator('[data-action=rt-toggle]').click(); assert.deepStrictEqual((await dots())[2], 'today');
  await p.click('[data-action=rt-edit]'); assert.strictEqual(await p.locator('.rt-week-card').count(), 0); await p.click('[data-action=rt-edit]');
  ok('tarjeta «Tu semana»: porcentaje, un punto por día (hoy se llena al completar todo)');

  // ---- al día siguiente lo diario empieza de nuevo; lo semanal y mensual siguen hechos
  await p.clock.fastForward(24 * 3600 * 1000 + 40000); await p.waitForTimeout(200);
  assert.strictEqual(await row('Hacer resumen del libro').evaluate((e) => e.classList.contains('done')), false); assert.strictEqual(await row('Ir al gimnasio').count(), 1); assert.strictEqual(await row('Revisar oportunidades').count(), 0);
  assert.strictEqual(await row('Planear la semana').evaluate((e) => e.classList.contains('done')), true); assert.strictEqual(await p.locator('#routine-count').innerText(), '2 de 4 hechos');
  ok('jueves: lo diario se reinicia solo y cambian los que tocan; semana y mes siguen marcados');
  assert.strictEqual(await p.locator('#routine-week-pct').innerText(), '67 %'); assert.deepStrictEqual(await dots(), ['empty', 'empty', 'partial', 'today', 'future', 'future', 'future']);
  await p.click('.rt-week-card'); assert.strictEqual(await p.locator('#routine-view button.active').innerText(), 'Resumen semanal'); assert.strictEqual(await p.locator('#routine-week-label').innerText(), '5–11 oct');
  await p.click('#routine-view [data-view=today]'); ok('la tarjeta refleja el día anterior a medias y abre el resumen semanal');

  // ---- resumen semanal
  await p.click('#routine-view [data-view=week]');
  assert.strictEqual(await p.locator('#routine-week-label').innerText(), '5–11 oct'); assert.strictEqual(await p.locator('.rt-grid-row:not(.head)').count(), 3);
  const cells = (text) => p.locator('.rt-grid-row', { hasText: text }).locator('i').evaluateAll((els) => els.map((e) => e.className.slice(2)));
  assert.deepStrictEqual(await cells('Hacer resumen del libro'), ['na', 'na', 'done', 'pending', 'future', 'future', 'future']); // se creó el miércoles
  assert.deepStrictEqual(await cells('Revisar oportunidades'), ['na', 'na', 'miss', 'na', 'future', 'na', 'na']);
  assert.deepStrictEqual(await cells('Ir al gimnasio'), ['na', 'na', 'na', 'pending', 'future', 'future', 'future']);
  assert.strictEqual(await p.locator('.rt-pct').innerText(), '67 %'); assert.strictEqual(await p.locator('.rt-sum-list li.ok').count(), 2);
  assert((await p.locator('.rt-review').innerText()).includes('Aún no hay comentario')); assert(await p.locator('[data-action=rt-week-next]').isDisabled());
  await p.click('[data-action=rt-week-prev]'); assert.strictEqual(await p.locator('#routine-week-label').innerText(), '28 sep – 4 oct'); assert.strictEqual(await p.locator('.rt-pct').innerText(), '—');
  await p.click('[data-action=rt-week-next]'); assert.strictEqual(await p.locator('#routine-week-label').innerText(), '5–11 oct');
  ok('resumen semanal: cuadrícula por día, porcentaje, semanales/mensuales y navegación entre semanas');

  // ---- comentario de la semana (lo escribe Claude con el programa de escritorio): se muestra como texto, nunca como HTML
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('prod.routine')); l.push({ id: 'r:2026-W41', kind: 'review', week: '2026-W41', text: 'Buen ritmo con los resúmenes.\nFaltó <b>revisar</b> oportunidades <img src=x onerror=window.__pwned=1>', by: 'Claude', at: 1 }); localStorage.setItem('prod.routine', JSON.stringify(l)); });
  await p.reload(); await p.clock.resume?.(); await p.click('#routine-view [data-view=week]');
  const rev = await p.locator('.rt-review-text').innerText(); assert(rev.includes('Buen ritmo con los resúmenes.\nFaltó <b>revisar</b>')); assert.strictEqual(await p.locator('.rt-review img, .rt-review b').count(), 0); assert.strictEqual(await p.evaluate(() => window.__pwned), undefined);
  assert((await p.locator('.rt-review').innerText()).includes('— Claude')); ok('comentario semanal visible y seguro');

  // ---- editar: renombrar, cambiar frecuencia, reordenar y eliminar
  await p.click('#routine-view [data-view=today]'); await p.click('[data-action=rt-edit]');
  assert.deepStrictEqual(await p.locator('.rt-group[data-freq=daily] .rt-text').evaluateAll((e) => e.map((x) => x.firstChild.textContent)), ['Hacer resumen del libro', 'Revisar oportunidades', 'Ir al gimnasio']);
  await row('Ir al gimnasio').locator('[data-action=rt-up]').click(); await row('Ir al gimnasio').locator('[data-action=rt-up]').click();
  assert.deepStrictEqual(await p.locator('.rt-group[data-freq=daily] .rt-text').evaluateAll((e) => e.map((x) => x.firstChild.textContent)), ['Ir al gimnasio', 'Hacer resumen del libro', 'Revisar oportunidades']);
  assert(await row('Ir al gimnasio').locator('[data-action=rt-up]').isDisabled());
  await row('Pagar cuentas').locator('[data-action=rt-item-edit]').click(); await p.fill('#rt-text', 'Pagar servicios'); await p.click('#rt-freq [data-freq=weekly]'); await p.click('[data-action=rt-save]');
  assert.strictEqual(await p.locator('.rt-group[data-freq=weekly] .rt-item').count(), 2); assert.strictEqual(await p.locator('.rt-group[data-freq=monthly]').count(), 0);
  await row('Planear la semana').locator('[data-action=rt-item-edit]').click(); await p.click('[data-action=rt-delete]'); await p.click('#confirm-ok');
  assert.strictEqual(await row('Planear la semana').count(), 0); await p.click('[data-action=rt-edit]');
  data = await stored(); assert.strictEqual(data.filter((r) => r.kind === 'item').length, 4); assert(data.every((r) => r.updatedAt > 0));
  const tombs = await p.evaluate(() => JSON.parse(localStorage.getItem('prod.tomb')).filter((t) => t.col === 'routine'));
  assert.strictEqual(tombs.length, 1); assert(tombs[0].id.startsWith('i:') && !data.some((r) => r.id === tombs[0].id));
  ok('editar la rutina: orden, nombre, frecuencia y eliminar (el borrado queda listo para sincronizar)');

  // ---- las otras pestañas siguen igual y no hay desbordes
  await p.click('.nav-btn[data-tab=books]'); assert.strictEqual(await p.locator('.book-card').count(), 0); await p.click('.nav-btn[data-tab=tasks]'); assert.strictEqual(await p.locator('#page-title').innerText(), 'Pendientes');
  await p.click('.nav-btn[data-tab=routine]'); await p.click('#routine-view [data-view=week]'); assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); ok('la rutina no aparece entre los resúmenes; sin scroll horizontal');

  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.log('FALLO', e.message); process.exit(1); });
