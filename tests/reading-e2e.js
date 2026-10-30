// Lectura dentro de Resúmenes: estado, capítulo, «Leyendo ahora», resumir capítulo y filtros de la lista
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-10-30T10:00:00') });
  await p.goto('http://localhost:8123/');
  const ok = (n) => console.log('OK', n);
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('prod.books') || '[]'));
  const newBook = async (title, author) => {
    await p.click('#new-book'); await p.fill('[data-field=title]', title); await p.fill('[data-field=author]', author);
    await p.click('[data-action=done]');
  };

  await p.click('.nav-btn[data-tab=books]');
  await newBook('Hábitos atómicos', 'James Clear');
  await p.click('#book-back'); await newBook('Céntrate', 'Cal Newport'); await p.click('#book-back');
  assert.strictEqual(await p.locator('.book-card').count(), 2);
  assert.strictEqual(await p.locator('#reading-now').innerText(), ''); assert.strictEqual(await p.locator('#book-filter button').count(), 0);
  assert((await p.locator('.book-card:has-text("Céntrate")').getAttribute('style')).includes('--cover')); ok('sin lecturas: lista de portadas de color, sin filtros');

  // ---- empezar a leer, capítulo y total
  await p.click('.book-card:has-text("Hábitos") .book-open');
  assert.strictEqual(await p.locator('.read-seg [aria-checked=true]').innerText(), 'Sin empezar');
  await p.click('.read-seg [data-value=reading]');
  assert.strictEqual(await p.locator('.chap-now b').innerText(), '1'); assert(await p.locator('[data-action=chap-dec]').isDisabled());
  await p.fill('#book-chapters', '20'); await p.locator('#book-chapters').dispatchEvent('change');
  for (let i = 0; i < 6; i++) await p.click('.chap-row [data-action=chap-inc]');
  assert.strictEqual(await p.locator('.chap-now b').innerText(), '7');
  assert.strictEqual(await p.locator('.read-panel .read-bar').getAttribute('aria-valuenow'), '30');
  let bk = (await stored()).find((x) => x.title === 'Hábitos atómicos');
  assert.strictEqual(bk.reading, 'reading'); assert.strictEqual(bk.chapter, 7); assert.strictEqual(bk.chapters, 20); assert(bk.updatedAt); ok('leyendo: capítulo 7 de 20, guardado y listo para sincronizar');

  // ---- resumir el capítulo: va a «Notas / Resumen por capítulos» y pasa al siguiente
  await p.click('.read-panel [data-action=chap-note]');
  assert.strictEqual(await p.locator('#chapter-sheet-title').innerText(), 'Resumir el capítulo 7');
  await p.fill('#chapter-note', 'Quitar la tentación de la vista.'); await p.click('#chapter-save');
  assert(await p.locator('#chapter-sheet.hidden').count() === 1);
  assert.strictEqual(await p.locator('.chap-now b').innerText(), '8');
  assert((await p.locator('#book-detail .box.notes p').innerText()).includes('Capítulo 7: Quitar la tentación de la vista.'));
  await p.click('.read-panel [data-action=chap-note]'); await p.keyboard.press('Escape');
  assert(await p.locator('#chapter-sheet.hidden').count() === 1 && await p.locator('#book-page:not(.hidden)').count() === 1); ok('resumir capítulo: se añade a Notas, avanza; Escape cierra solo la hoja');

  // ---- lista: «Leyendo ahora», avance y filtros
  await p.click('#book-back');
  assert((await p.locator('#reading-now').innerText()).includes('Capítulo 8 de 20'));
  await p.click('#reading-now [data-action=chap-inc]'); assert((await p.locator('#reading-now').innerText()).includes('Capítulo 9 de 20'));
  assert.strictEqual(await p.locator('.book-card:has-text("Hábitos") .book-row-prog').innerText(), 'Capítulo 9 de 20');
  assert.deepStrictEqual(await p.locator('#book-filter button').allInnerTexts(), ['Todos 2', 'Leyendo 1', 'Terminados 0']);
  await p.click('#book-filter [data-filter=reading]'); assert.strictEqual(await p.locator('.book-card').count(), 1);
  await p.click('#book-filter [data-filter=done]'); assert.strictEqual(await p.locator('.book-card').count(), 0); assert((await p.locator('#book-list').innerText()).includes('Ningún libro'));
  await p.click('#book-filter [data-filter=all]'); assert.strictEqual(await p.locator('.book-card').count(), 2); ok('Leyendo ahora con +1 capítulo, y filtros Todos / Leyendo / Terminados');

  // ---- terminar
  await p.click('.book-card:has-text("Céntrate") .book-open'); await p.click('.read-seg [data-value=done]');
  assert.strictEqual(await p.locator('.read-done').innerText(), '✓ Terminado · oct 2026'); await p.click('#book-back');
  assert.strictEqual(await p.locator('.book-card:has-text("Céntrate") .book-row-prog').innerText(), 'Terminado · oct 2026');
  assert.strictEqual(await p.locator('#reading-now .reading-card').count(), 1); ok('terminado: con mes, fuera de «Leyendo ahora»');

  // ---- recarga: todo persiste; datos de lectura dañados no rompen la app
  await p.reload(); await p.click('.nav-btn[data-tab=books]');
  assert((await p.locator('#reading-now').innerText()).includes('Capítulo 9 de 20'));
  await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('prod.books')); L[0].chapter = 'x'; L[0].reading = 'raro'; L[0].chapters = -3; localStorage.setItem('prod.books', JSON.stringify(L)); });
  await p.reload(); await p.click('.nav-btn[data-tab=books]'); assert.strictEqual(await p.locator('.book-card').count(), 2);
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); ok('persiste al recargar; datos dañados se ignoran; no hay desplazamiento lateral');

  assert.deepStrictEqual(errs, []); ok('sin errores en la consola');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
