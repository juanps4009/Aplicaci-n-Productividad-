// Pestaña «Trabajo» en el navegador: oportunidades (añadir, estado con un toque, filtro, cierre, enlace seguro)
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
  const card = (text) => p.locator('.wk-card', { hasText: text });
  const add = async ({ title, url, closes, status, note }) => {
    await p.click('[data-action=wk-add]'); await p.fill('#wk-title', title);
    if (url) await p.fill('#wk-url', url); if (closes) await p.fill('#wk-closes', closes);
    if (status) await p.selectOption('#wk-state', status); if (note) await p.fill('#wk-note', note);
    await p.click('[data-action=wk-save]');
  };

  // ---- cuatro pestañas; Trabajo empieza vacía
  assert.deepStrictEqual(await p.locator('.nav-btn span').allInnerTexts(), ['Pendientes', 'Rutina', 'Trabajo', 'Resúmenes']);
  await p.click('.nav-btn[data-tab=work]'); assert.strictEqual(await p.locator('#page-title').innerText(), 'Trabajo'); assert((await p.locator('#work-body').innerText()).includes('Aún no hay oportunidades'));
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); ok('pestaña Trabajo (cuatro pestañas caben en el celular)');

  // ---- añadir: valida título y enlace
  await p.click('[data-action=wk-add]'); await p.click('[data-action=wk-save]'); assert((await p.locator('#wk-error').innerText()).includes('Escribe el nombre'));
  await p.fill('#wk-title', 'Redactor remoto de fin de semana'); await p.fill('#wk-url', 'javascript:alert(1)'); await p.click('[data-action=wk-save]'); assert((await p.locator('#wk-error').innerText()).includes('https://'));
  await p.fill('#wk-url', 'https://empleos.example.com/oferta/1'); await p.fill('#wk-closes', '2026-10-09'); await p.fill('#wk-note', 'Pago por artículo.\nEscribir a RR. HH.'); await p.click('[data-action=wk-save]');
  await add({ title: 'Asistente virtual', closes: '2026-10-20' }); await add({ title: 'Editor de video', url: 'https://x.example.com/v', closes: '2026-10-05', status: 'applied' }); await add({ title: 'Clases de fin de semana' });
  assert.deepStrictEqual(await p.locator('.wk-title').allInnerTexts(), ['Editor de video', 'Redactor remoto de fin de semana', 'Asistente virtual', 'Clases de fin de semana']); // por fecha de cierre; sin fecha al final
  assert.strictEqual(await p.locator('#work-count').innerText(), '3 por revisar · 1 aplicada · 0 con respuesta');
  ok('añadir oportunidades (título obligatorio, enlace solo https); orden por fecha de cierre');

  // ---- cierre, enlace y nota
  assert.strictEqual(await card('Redactor').locator('.wk-close').innerText(), 'Cierra en 2 días · 9 oct'); assert(await card('Redactor').locator('.wk-close').evaluate((e) => e.classList.contains('soon')));
  assert.strictEqual(await card('Editor de video').locator('.wk-close').innerText(), 'Cerró hace 2 días · 5 oct'); assert(await card('Editor de video').locator('.wk-close').evaluate((e) => e.classList.contains('late')));
  assert(!(await card('Asistente').locator('.wk-close').evaluate((e) => e.classList.contains('soon') || e.classList.contains('late')))); assert.strictEqual(await card('Clases').locator('.wk-close').count(), 0);
  const link = card('Redactor').locator('a.wk-link'); assert.strictEqual(await link.getAttribute('href'), 'https://empleos.example.com/oferta/1'); assert.strictEqual(await link.getAttribute('target'), '_blank'); assert.strictEqual(await link.getAttribute('rel'), 'noopener noreferrer');
  assert.strictEqual(await card('Asistente').locator('a').count(), 0); assert((await card('Redactor').locator('.wk-note').innerText()).includes('Pago por artículo.\nEscribir a RR. HH.'));
  ok('fecha de cierre con aviso (pronto / ya cerró), enlace que abre en otra pestaña, nota');

  // ---- cambiar el estado con un toque
  await card('Redactor').locator('[data-action=wk-status]').click(); assert.strictEqual(await p.locator('#work-status-list button').count(), 4); assert.strictEqual(await p.locator('#work-status-list button.active').innerText(), 'Por revisar ✓');
  await p.click('#work-status-list [data-status=applied]'); assert.strictEqual(await p.locator('#work-status.hidden').count(), 1); assert((await card('Redactor').locator('.wk-status').innerText()).startsWith('Apliqué'));
  await card('Redactor').locator('[data-action=wk-status]').click(); await p.click('#work-status-list [data-status=replied]'); assert.strictEqual(await p.locator('#work-count').innerText(), '2 por revisar · 1 aplicada · 1 con respuesta');
  assert(!(await card('Redactor').locator('.wk-close').evaluate((e) => e.classList.contains('soon')))); // ya respondieron: la fecha deja de avisar
  let data = await stored(); assert.strictEqual(data.find((r) => r.title === 'Redactor remoto de fin de semana').status, 'replied'); assert(data.filter((r) => r.kind === 'opp').every((r) => r.id.startsWith('o:') && r.updatedAt > 0));
  ok('estado con un toque: por revisar → apliqué → me respondieron');

  // ---- descartar y filtro Activas / Todas
  await card('Clases').locator('[data-action=wk-status]').click(); await p.click('#work-status-list [data-status=discarded]');
  assert.strictEqual(await card('Clases').count(), 0); assert.deepStrictEqual(await p.locator('#work-filter button').allInnerTexts(), ['Activas (3)', 'Todas (4)']);
  await p.click('#work-filter [data-all="1"]'); assert.strictEqual(await p.locator('.wk-card').count(), 4); assert(await card('Clases').evaluate((e) => e.classList.contains('s-discarded'))); assert.strictEqual(await p.locator('.wk-card').last().locator('.wk-title').innerText(), 'Clases de fin de semana');
  await p.click('#work-filter [data-all="0"]'); assert.strictEqual(await p.locator('.wk-card').count(), 3); ok('las descartadas se ocultan; «Todas» las muestra al final');

  // ---- editar y eliminar; sigue tras recargar
  await card('Asistente').locator('[data-action=wk-edit]').click(); assert.strictEqual(await p.inputValue('#wk-title'), 'Asistente virtual'); assert.strictEqual(await p.inputValue('#wk-closes'), '2026-10-20');
  await p.fill('#wk-title', 'Asistente virtual bilingüe'); await p.fill('#wk-url', 'https://x.example.com/a'); await p.click('[data-action=wk-save]'); assert.strictEqual(await card('bilingüe').locator('a.wk-link').count(), 1);
  await card('Editor de video').locator('[data-action=wk-edit]').click(); await p.click('[data-action=wk-delete]'); await p.click('#confirm-ok'); assert.strictEqual(await card('Editor de video').count(), 0);
  await p.reload(); assert.strictEqual(await p.locator('#page-title').innerText(), 'Trabajo'); assert.deepStrictEqual(await p.locator('.wk-title').allInnerTexts(), ['Redactor remoto de fin de semana', 'Asistente virtual bilingüe']);
  const tombs = await p.evaluate(() => JSON.parse(localStorage.getItem('prod.tomb')).filter((t) => t.col === 'routine')); assert.strictEqual(tombs.length, 1); assert(tombs[0].id.startsWith('o:'));
  ok('editar, eliminar (queda listo para sincronizar) y persistencia');

  // ---- datos de otro dispositivo: el texto nunca es HTML y un enlace raro no se convierte en enlace
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('prod.routine')); l.push({ id: 'o:evil', kind: 'opp', title: '<img src=x onerror=window.__pwned=1> oferta', url: 'javascript:window.__pwned=2', note: '<script>window.__pwned=3</script>', source: '<b>radar</b>', status: 'review', closes: '2026-10-08', createdAt: 5 }); localStorage.setItem('prod.routine', JSON.stringify(l)); });
  await p.reload(); assert.strictEqual(await card('onerror').count(), 1); assert.strictEqual(await card('onerror').locator('img, script, b, a').count(), 0); assert((await card('onerror').innerText()).includes('Sin enlace')); assert.strictEqual(await p.evaluate(() => window.__pwned), undefined);
  ok('datos maliciosos: se muestran como texto y sin enlace');

  // ---- las otras pestañas no cambian: las oportunidades no salen en la rutina ni en los resúmenes
  await p.click('.nav-btn[data-tab=routine]'); assert((await p.locator('#routine-body').innerText()).includes('Tu rutina está vacía')); await p.click('.nav-btn[data-tab=books]'); assert.strictEqual(await p.locator('.book-card').count(), 0);
  await p.click('.nav-btn[data-tab=tasks]'); assert.strictEqual(await p.locator('.task-item').count(), 0); ok('las oportunidades no aparecen en Rutina, Resúmenes ni Pendientes');

  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.log('FALLO', e.message); process.exit(1); });
