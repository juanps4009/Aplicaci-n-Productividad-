// Texto con formato en el navegador: tareas, notas, resúmenes (negrita, color, resaltado, subrayado, tamaño)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const bar = '#format-bar:not(.hidden)';
  const act = async (a) => { await p.click(`#format-bar .fb-row [data-act=${a}]`); };
  const pick = async (kind, val) => { await p.click(`#format-bar .fb-sub [data-kind=${kind}][data-val="${val}"]`); };
  const stored = (key) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);

  // ---- la barra sale al poner el cursor en un campo; sin selección, cada botón cambia lo próximo que se escriba (como en Word)
  await p.click('#task-input'); await p.waitForSelector(bar); ok('la barra de formato sale al escribir en un campo');
  await p.keyboard.type('normal '); await act('bold'); assert(await p.locator('#format-bar [data-act=bold].on').count() === 1);
  await p.keyboard.type('fuerte'); await act('bold'); await p.keyboard.type(' y ');
  await act('ul'); await pick('ul', '#2563eb'); await p.keyboard.type('subrayado');
  await act('ul'); const none = p.locator('#format-bar .fb-sub button').first(); // el primer círculo de la paleta deja de subrayar
  assert.strictEqual(await none.getAttribute('aria-label'), 'Sin subrayado'); assert(await none.evaluate((e) => e.classList.contains('fb-none'))); await none.click();
  await p.keyboard.type(' libre');
  const typed = await p.evaluate(() => RT.fromDOM(document.querySelector('#task-input')));
  assert.strictEqual(typed.text, 'normal fuerte y subrayado libre'); assert.deepStrictEqual(typed.marks, [{ s: 7, e: 13, b: 1 }, { s: 16, e: 25, u: '#2563eb' }]);
  ok('sin seleccionar: negrita y subrayado se activan y se apagan para lo que se escribe después (se puede seguir escribiendo sin subrayado)');
  await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); await p.keyboard.type('Comprar leche fresca');
  assert.deepStrictEqual((await p.evaluate(() => RT.fromDOM(document.querySelector('#task-input')))).marks, []);
  // ---- tarea nueva con formato sobre una selección
  await p.keyboard.press('Control+A'); await p.waitForSelector(bar);
  await act('bold'); await act('color'); await pick('color', '#dc2626');
  assert.strictEqual(await p.locator('#format-bar .fb-sub').evaluate((e) => e.classList.contains('hidden')), true); // el submenú se cierra al elegir
  assert.strictEqual(await p.locator('#task-input .rt[data-b][data-c="#dc2626"]').count(), 1);
  // solo «fresca» (últimas 6 letras): subrayado azul y tamaño grande
  await p.keyboard.press('End'); for (let i = 0; i < 6; i++) await p.keyboard.press('Shift+ArrowLeft');
  await act('ul'); await pick('ul', '#2563eb'); await act('size'); await p.click('#format-bar .fb-sub [data-kind=size][data-val="1"]');
  const html = await p.locator('#task-input').innerHTML();
  assert(html.includes('data-u="#2563eb"') && html.includes('data-z="1"')); ok('negrita, color de letra, subrayado de color y tamaño sobre la selección');
  await p.keyboard.press('Enter'); // Enter añade la tarea
  await p.waitForSelector('.task-item .task-text .rt');
  let t = (await stored('prod.tasks'))[0];
  assert.strictEqual(t.text, 'Comprar leche fresca'); assert(Array.isArray(t.marks) && t.marks.length >= 2); assert.strictEqual(await p.locator('#task-input').innerText(), '');
  assert(t.marks.some((m) => m.s === 0 && m.e === 14 && m.b === 1 && m.c === '#dc2626') && t.marks.some((m) => m.s === 14 && m.e === 20 && m.u === '#2563eb' && m.z === 1));
  ok('Enter añade la tarea con su formato guardado (texto + tramos)');
  await p.reload(); assert.strictEqual(await p.locator('.task-item .task-text .rt[data-u="#2563eb"]').count(), 1); ok('el formato sigue tras recargar');

  // ---- editar el título de la tarea
  await p.click('.task-item [data-action=menu-task]'); await p.click('#menu-edit');
  assert.strictEqual(await p.locator('.task-item.editing .rt-line .rt').count() > 0, true); ok('al editar se ve el formato');
  await p.click('.task-item.editing .rt-line'); await p.keyboard.press('Control+A'); await p.waitForSelector(bar);
  await act('clear'); assert.strictEqual(await p.locator('.task-item.editing .rt-line .rt').count(), 0); ok('quitar formato');
  await p.keyboard.press('Home'); await p.keyboard.press('Shift+ArrowRight'); await p.keyboard.press('Shift+ArrowRight'); await act('hl'); await pick('hl', '#ca8a04');
  await p.keyboard.press('Control+B'); // Control+B alterna negrita
  await act('align'); await p.click('#format-bar .fb-sub [data-kind=align][data-val=center]'); // centrar el título
  await p.click('[data-action=save-task]');
  t = (await stored('prod.tasks'))[0]; assert(t.marks.some((m) => m.s === 0 && m.e === 2 && m.h === '#ca8a04' && m.b === 1)); assert(!t.marks.some((m) => m.e > 2)); ok('guardar la edición conserva solo el formato nuevo');
  assert.strictEqual(t.align, 'center'); assert.strictEqual(await p.locator('.task-item .task-text[data-align=center]').count(), 1); ok('título de tarea centrado');

  // ---- notas: formato, Enter parte el bloque sin perder el formato, "/" sigue funcionando
  await p.click('.task-item [data-action=notes-task]'); await p.click('#notes-editor');
  await p.keyboard.type('uno dos tres');
  await p.keyboard.press('Home'); await p.keyboard.press('Control+ArrowRight'); await p.keyboard.down('Shift'); await p.keyboard.press('Control+ArrowRight'); await p.keyboard.up('Shift');
  await p.waitForSelector(bar); await act('hl'); await pick('hl', '#16a34a'); await act('bold');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await p.keyboard.type('nueva línea'); await p.waitForTimeout(400);
  const blocks = await p.$$eval('#notes-editor .blk', (els) => els.map((e) => ({ t: e.textContent, spans: e.querySelectorAll('.rt').length })));
  assert.strictEqual(blocks.length, 2); assert(blocks[0].spans >= 1); ok('en notas: formato por palabra y Enter sin perderlo');
  await p.click('#notes-editor .blk:last-child'); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.keyboard.type('/titulo'); await p.keyboard.press('Enter'); await p.keyboard.type('Gran título');
  // alinear como en Word: centrar el párrafo donde está el cursor; el siguiente lo hereda y luego se pasa a la derecha
  await act('align'); await p.click('#format-bar .fb-sub [data-kind=align][data-val=center]');
  await p.keyboard.press('Enter'); await p.keyboard.type('firma'); assert.strictEqual(await p.locator('#notes-editor .blk[data-align=center]').count(), 2);
  await act('align'); await p.click('#format-bar .fb-sub [data-kind=align][data-val=right]');
  await p.waitForTimeout(400); await p.click('#notes-back'); await p.reload(); await p.click('.task-item [data-action=notes-task]');
  const doc = (await stored('prod.tasks'))[0].doc;
  assert(doc[0].marks && doc[0].marks.some((m) => m.h === '#16a34a' && m.b === 1)); assert(doc.some((d) => d.type === 'h1' && d.text === 'Gran título')); ok('las notas guardan texto, tipo y formato');
  assert.strictEqual(doc.find((d) => d.text === 'Gran título').align, 'center'); assert.strictEqual(doc.find((d) => d.text === 'firma').align, 'right'); assert(doc[0].align === undefined);
  assert.strictEqual(await p.locator('#notes-editor .blk[data-align=center]').count(), 1); assert.strictEqual(await p.locator('#notes-editor .blk[data-align=right]').count(), 1);
  assert.strictEqual(await p.locator('#notes-editor .blk[data-align=right]').evaluate((e) => getComputedStyle(e).textAlign), 'right'); ok('alineación por párrafo: centro y derecha, se hereda con Enter y se guarda');
  // Retroceso al inicio une los bloques conservando el formato
  await p.click('#notes-editor .blk:nth-child(2)'); await p.keyboard.press('Home'); await p.keyboard.press('Backspace'); await p.waitForTimeout(400);
  assert((await p.$$eval('#notes-editor .blk', (e) => e.length)) === doc.length - 1); assert(await p.locator('#notes-editor .blk:first-child .rt').count() >= 1); ok('Retroceso une bloques y conserva el formato');
  await p.click('#notes-back');

  // ---- resumen por bloques: cuadros con formato, una línea = un bloque
  await p.click('.nav-btn[data-tab=books]'); await p.click('#new-book');
  await p.click('[data-field=title]'); await p.keyboard.type('Libro rico'); await p.keyboard.press('Control+A'); await act('bold');
  await act('align'); await p.click('#format-bar .fb-sub [data-kind=align][data-val=right]');
  await p.keyboard.press('Enter'); await p.keyboard.type('Autora');
  await p.click('.sec-editor[data-section=ideas] .blk'); await p.keyboard.type('primera idea'); await p.keyboard.press('Enter'); await p.keyboard.type('segunda idea');
  await act('align'); await p.click('#format-bar .fb-sub [data-kind=align][data-val=center]'); // solo la segunda línea
  await p.keyboard.press('Control+A'); await act('color'); await pick('color', '#9333ea');
  await p.keyboard.press('ArrowRight'); assert.strictEqual(await p.locator(bar).count(), 1); // la barra sigue a la vista y no impide pulsar «Listo»
  await p.click('[data-action=done]');
  const bk = (await stored('prod.books'))[0];
  assert.strictEqual(bk.titleAlign, 'right'); assert.deepStrictEqual(bk.ideasAligns, ['', 'center']); assert(bk.authorAlign === undefined && bk.notesAligns === undefined);
  assert.strictEqual(await p.locator('#book-detail .page-title[data-align=right]').count(), 1); assert.strictEqual(await p.locator('#book-detail .box.ideas .ln[data-align=center]').innerText(), 'segunda idea'); ok('resumen: título a la derecha y una línea del cuadro centrada');
  assert.strictEqual(bk.ideas, 'primera idea\nsegunda idea'); assert(bk.ideasMarks && bk.ideasMarks.length === 2 && bk.ideasMarks[0].s === 0 && bk.ideasMarks[0].e === 12 && bk.ideasMarks[1].s === 13 && bk.ideasMarks[1].e === 25 && bk.ideasMarks.every((m) => m.c === '#9333ea'));
  assert(bk.titleMarks && bk.titleMarks[0].b === 1 && bk.author === 'Autora' && !bk.authorMarks); ok('resumen por bloques: título, autor y cuadros guardan su formato');
  assert.strictEqual(await p.locator('#book-detail .page-title .rt[data-b]').count(), 1); assert.strictEqual(await p.locator('#book-detail .box.ideas p .rt[data-c="#9333ea"]').count(), 2);
  assert((await p.locator('#book-detail .box.ideas p').innerText()).includes('primera idea\nsegunda idea')); ok('la vista del resumen muestra el formato y los saltos de línea');
  await p.click('#book-back'); assert.strictEqual(await p.locator('#book-list .book-row-title .rt[data-b]').count(), 1); ok('la lista de resúmenes también');
  await p.click('.book-open'); await p.click('[data-action=edit]'); assert.strictEqual(await p.locator('.sec-editor[data-section=ideas] .blk').count(), 2); assert.strictEqual(await p.locator('.sec-editor[data-section=ideas] .rt').count() >= 2, true); assert.strictEqual(await p.locator('.sec-editor[data-section=ideas] .blk[data-align=center]').count(), 1); ok('al editar de nuevo, cada línea es un bloque con su formato y su alineación');
  await p.click('[data-action=done]');

  // ---- datos de otro dispositivo: solo se aceptan colores #rrggbb y tamaños conocidos (nada de HTML ni CSS)
  await p.evaluate(() => {
    const tasks = JSON.parse(localStorage.getItem('prod.tasks'));
    tasks[0].text = 'texto <img src=x onerror=window.__pwned=1> peligroso';
    tasks[0].marks = [{ s: 0, e: 9, c: 'red;background:url(javascript:1)', h: '#12', z: '9;x', b: 1 }, { s: 10, e: 40, u: '#00ff00', onclick: 'x' }];
    localStorage.setItem('prod.tasks', JSON.stringify(tasks));
  });
  await p.reload();
  assert.strictEqual(await p.evaluate(() => window.__pwned), undefined); assert.strictEqual(await p.locator('.task-text img').count(), 0);
  const ev = await p.locator('.task-text').first().innerHTML(); assert(!ev.includes('javascript') && !ev.includes('onclick') && ev.includes('&lt;im') && !ev.includes('<img')); ok('datos con formato malicioso se limpian');

  console.log('errores:', errs); assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.log('FALLO', e.message); process.exit(1); });
