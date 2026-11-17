const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport:{width:390,height:800}, hasTouch:true, timezoneId:'America/Bogota', locale:'es-CO' });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.clock.install({ time: new Date('2026-10-05T10:00:00-05:00') });
  await p.goto('http://localhost:8123/');
  const ok = (n)=>console.log('OK', n);
  const addInline = async (t) => { await p.fill('#task-input', t); await p.click('#task-form button[type=submit]'); };
  const addMob = async (t) => { await p.click('#qc-fab'); await p.fill('#qc-input', t); await p.click('#qc-save'); };
  const task = (t) => p.locator(`.task-item:has-text("${t}")`);
  const due = (t) => p.evaluate((t) => JSON.parse(localStorage.getItem('prod.tasks')).find((x) => x.text === t)?.due, t);

  // celular (<1024 px): oculta formulario superior y deja solo + Anotar
  assert(!(await p.isVisible('#task-form')));
  assert(await p.isVisible('#qc-fab')); ok('celular oculta formulario superior y deja + Anotar');

  // fechas rápidas en computador (>=1024 px: conserva formulario compacto hasta escribir)
  await p.setViewportSize({ width: 1280, height: 800 });
  assert(!(await p.isVisible('#quick-due'))); ok('formulario compacto hasta tocarlo');
  await p.fill('#task-input', 'Pagar luz');
  assert(await p.isVisible('#quick-due')); ok('al escribir aparecen prioridad y fecha');
  await p.click('#quick-due [data-quick="1"]');
  assert.strictEqual(await p.inputValue('#task-due'), '2026-10-06'); ok('«Mañana» pone la fecha');
  assert(await p.locator('#quick-due [data-quick="1"]').evaluate((e) => e.classList.contains('active')));
  await p.click('#quick-due [data-quick="1"]');
  assert.strictEqual(await p.inputValue('#task-due'), ''); ok('tocar otra vez la quita');
  await p.click('#quick-due [data-quick="0"]'); await addInline('Pagar luz');
  assert.strictEqual(await due('Pagar luz'), '2026-10-05'); ok('«Hoy» al crear');
  assert.strictEqual(await p.inputValue('#task-due'), '');
  assert(!(await p.locator('#quick-due .active').count())); ok('el campo queda limpio');

  // vuelta a celular para captura rápida, posponer, eliminar y borrar completadas
  await p.setViewportSize({ width: 390, height: 800 });

  // posponer con deshacer
  await task('Pagar luz').locator('[data-action=menu-task]').click();
  await p.click('#menu-postpone [data-postpone="1"]');
  assert.strictEqual(await due('Pagar luz'), '2026-10-06');
  assert.strictEqual(await p.innerText('#undo-msg'), 'Pasada a mañana'); ok('posponer a mañana');
  await p.click('#undo-btn');
  assert.strictEqual(await due('Pagar luz'), '2026-10-05'); assert(await p.locator('#undo-toast').isHidden()); ok('deshacer posponer');
  await task('Pagar luz').locator('[data-action=menu-task]').click(); await p.click('#menu-postpone [data-postpone="7"]');
  assert.strictEqual(await due('Pagar luz'), '2026-10-12'); ok('posponer una semana');
  await task('Pagar luz').locator('[data-action=menu-task]').click(); await p.click('#menu-postpone [data-postpone=""]');
  assert.strictEqual(await due('Pagar luz'), ''); assert.strictEqual(await p.innerText('#undo-msg'), 'Sin fecha'); ok('quitar fecha');
  await p.clock.runFor(6000); assert(await p.locator('#undo-toast').isHidden()); ok('el aviso se va solo');

  // eliminar con deshacer, en su sitio
  await addMob('Tres'); await addMob('Dos'); await addMob('Uno');
  const order = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.tasks')).map((x) => x.text).join(','));
  const start = await order();
  await task('Dos').locator('[data-action=menu-task]').click(); await p.click('#menu-delete');
  assert(!(await task('Dos').count())); assert.strictEqual(await p.innerText('#undo-msg'), 'Tarea eliminada');
  await p.click('#undo-btn');
  assert.strictEqual(await order(), start); ok('deshacer eliminar la deja en su sitio');

  // borrar completadas con deshacer
  await task('Uno').locator('input[type=checkbox]').click(); await task('Tres').locator('input[type=checkbox]').click();
  await p.click('[data-group=done] [data-action=toggle-group]'); await p.click('[data-action=clear-done]'); await p.click('#confirm-ok');
  assert.strictEqual(await order(), 'Dos,Pagar luz'); assert.strictEqual(await p.innerText('#undo-msg'), '2 tareas borradas');
  await p.click('#undo-btn');
  assert.strictEqual(await order(), start); ok('deshacer borrar completadas');
  assert.strictEqual(await task('Uno').locator('input[type=checkbox]').isChecked(), true);

  assert.deepStrictEqual(errs, []); ok('sin errores en consola');
  await b.close();
  console.log('pendientes-e2e: todo OK');
})().catch((e) => { console.error(e); process.exit(1); });
