// Pruebas de reading.js (lectura: libro actual y capítulo): lógica pura, sin navegador
const assert = require('assert');
const R = require('../reading.js');
const ok = (m) => console.log('OK', m);
const NOW = new Date(2026, 9, 30, 21, 0).getTime();

// ---- datos viejos o dañados nunca fallan
assert.deepStrictEqual(R.info({}), { status: '', chapter: 1, chapters: 0, doneAt: '', pct: null });
assert.deepStrictEqual(R.info(null), { status: '', chapter: 1, chapters: 0, doneAt: '', pct: null });
assert.deepStrictEqual(R.info({ reading: 'otro', chapter: 'x', chapters: -4, doneAt: '2026-13' }), { status: '', chapter: 1, chapters: 0, doneAt: '', pct: null });
assert.deepStrictEqual(R.info({ reading: 'reading', chapter: 50, chapters: 20 }), { status: 'reading', chapter: 20, chapters: 20, doneAt: '', pct: 95 });
assert.strictEqual(R.info({ reading: 'reading', chapter: 7.9, chapters: 20 }).chapter, 7);
assert.strictEqual(R.info({ reading: 'reading', chapter: 7, chapters: 20 }).pct, 30);
assert.strictEqual(R.info({ reading: 'done', chapters: 20 }).pct, 100);
assert.strictEqual(R.info({ chapter: 5000 }).chapter, 999);
ok('info: saneado y porcentaje de capítulos leídos');

// ---- textos
assert.strictEqual(R.progressText({}), '');
assert.strictEqual(R.progressText({ reading: 'reading', chapter: 7, chapters: 20 }), 'Capítulo 7 de 20');
assert.strictEqual(R.progressText({ reading: 'reading', chapter: 3 }), 'Capítulo 3');
assert.strictEqual(R.progressText({ reading: 'done', doneAt: '2026-09' }), 'Terminado · sep 2026');
assert.strictEqual(R.progressText({ reading: 'done' }), 'Terminado');
ok('textos de avance');

// ---- cambios: devuelven solo los campos a aplicar
assert.deepStrictEqual(R.setStatus({}, 'reading', NOW), { reading: 'reading', doneAt: '' });
assert.deepStrictEqual(R.setStatus({}, 'done', NOW), { reading: 'done', doneAt: '2026-10' });
assert.deepStrictEqual(R.setStatus({ reading: 'done', doneAt: '2026-08' }, 'done', NOW), { reading: 'done', doneAt: '2026-08' });
assert.strictEqual(R.setStatus({}, 'leído', NOW), null);
assert.deepStrictEqual(R.step({ chapter: 7, chapters: 20 }, 1), { chapter: 8, reading: 'reading' });
assert.deepStrictEqual(R.step({ chapter: 1 }, -1), { chapter: 1, reading: 'reading' });
assert.deepStrictEqual(R.step({ chapter: 20, chapters: 20, reading: 'reading' }, 1), { chapter: 20, reading: 'reading' });
assert.deepStrictEqual(R.setTotal({ chapter: 12 }, 10), { chapters: 10, chapter: 10 });
assert.deepStrictEqual(R.setTotal({ chapter: 12, chapters: 20 }, ''), { chapters: 0, chapter: 12 });
ok('estado, +1/-1 capítulo y total');

// ---- resumir capítulo: se guarda dentro del resumen y pasa al siguiente
const blocks = { template: 'blocks', notes: 'Capítulo 1: sistemas, no metas\n', reading: 'reading', chapter: 2, chapters: 3 };
assert.deepStrictEqual(R.addChapterNote(blocks, '  identidad   primero ', NOW, 'u1'), { notes: 'Capítulo 1: sistemas, no metas\nCapítulo 2: identidad primero', chapter: 3, reading: 'reading' });
assert.deepStrictEqual(R.addChapterNote({ template: 'blocks', chapter: 1 }, 'uno', NOW, 'u1'), { notes: 'Capítulo 1: uno', chapter: 2, reading: 'reading' });
assert.deepStrictEqual(R.addChapterNote({ template: 'blocks', chapter: 3, chapters: 3, reading: 'reading' }, '', NOW, 'u1'), { reading: 'done', doneAt: '2026-10' });
const free = R.addChapterNote({ template: 'free', doc: [{ id: 'a', type: 'h1', text: 'Ideas' }], chapter: 4 }, 'el entorno manda', NOW, 'u9');
assert.deepStrictEqual(free.doc, [{ id: 'a', type: 'h1', text: 'Ideas' }, { id: 'u9', type: 'p', text: 'Capítulo 4: el entorno manda' }]);
assert.strictEqual(free.chapter, 5);
assert.strictEqual(R.addChapterNote({ chapter: 1 }, 'x'.repeat(900), NOW, 'u').notes.length, 'Capítulo 1: '.length + 600);
ok('resumir capítulo: en Notas (por bloques) o como párrafo (libre), y termina el libro en el último');

// ---- lista
const L = [{ id: 'a', reading: 'reading' }, { id: 'b', reading: 'done' }, { id: 'c' }, { id: 'd', reading: 'reading' }];
assert.deepStrictEqual(R.counts(L), { reading: 2, done: 1 });
assert.deepStrictEqual(R.filter(L, 'reading').map((b) => b.id), ['a', 'd']);
assert.deepStrictEqual(R.filter(L, 'done').map((b) => b.id), ['b']);
assert.strictEqual(R.filter(L, 'all').length, 4);
ok('conteos y filtros de la lista');
