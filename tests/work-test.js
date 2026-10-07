// Pruebas de work.js (oportunidades de trabajo): lógica pura, sin navegador
const assert = require('assert');
const W = require('../work.js');
const ok = (m) => console.log('OK', m);
let n = 0; const uid = () => 'x' + (++n);

// ---- añadir y validar
const L = [];
const a = W.add(L, { title: '  Redactor   remoto de fin de semana ', url: 'https://empleos.example.com/oferta/1', closes: '2026-10-12', note: ' Pago por artículo.\r\nEscribir a RR. HH. ' }, 1000, uid());
assert.deepStrictEqual(a, { id: 'o:x1', kind: 'opp', title: 'Redactor remoto de fin de semana', url: 'https://empleos.example.com/oferta/1', closes: '2026-10-12', status: 'review', source: '', note: 'Pago por artículo.\nEscribir a RR. HH.', createdAt: 1000 });
assert.strictEqual(W.add(L, { title: '   ' }, 1, 'vacia'), null); assert.strictEqual(L.length, 1);
const b = W.add(L, { title: 'Asistente virtual', status: 'applied', source: 'Radar', closes: '2026-13-40' }, 2000, uid()); assert.strictEqual(b.closes, ''); assert.strictEqual(b.status, 'applied'); assert.strictEqual(b.source, 'Radar');
const c = W.add(L, { title: 'Editor de video', url: 'https://x.example.com/v', closes: '2026-10-08', status: 'inventado' }, 3000, uid()); assert.strictEqual(c.status, 'review');
ok('añadir: texto limpio, fecha y estado válidos');

// ---- enlaces: solo http(s); lo demás se descarta
['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://x.com/a', 'https://x.com/a b', 'https://x.com/"onmouseover="x', 'https://x.com/<script>', 'www.x.com', 'https://' + 'a'.repeat(700), '', null, 5]
  .forEach((u) => assert.strictEqual(W.cleanUrl(u), '', String(u).slice(0, 30)));
assert.strictEqual(W.cleanUrl('  HTTPS://Empleos.example.com/a?b=1&c=2#x  '), 'HTTPS://Empleos.example.com/a?b=1&c=2#x'); assert.strictEqual(W.cleanUrl('http://localhost:8123/x'), 'http://localhost:8123/x');
assert.strictEqual(W.clean({ id: 'o:z', title: 't', url: 'javascript:alert(1)' }).url, ''); ok('enlaces: solo http y https, sin espacios ni comillas');

// ---- registros ajenos o dañados
assert.strictEqual(W.clean({ id: 'i:a', text: 'rutina' }), null); assert.strictEqual(W.clean({ id: 'o:', title: 'x' }), null); assert.strictEqual(W.clean({ id: 'o:a' }), null); assert.strictEqual(W.clean(null), null);
const d = W.clean({ id: 'o:q', title: '<img src=x onerror=1>', note: 'n'.repeat(900), source: 's'.repeat(99), createdAt: 'x', extra: 1, updatedAt: 7 });
assert.strictEqual(d.title, '<img src=x onerror=1>'); assert.strictEqual(d.note.length, 500); assert.strictEqual(d.source.length, 60); assert.strictEqual(d.createdAt, 0); assert.strictEqual(d.updatedAt, 7); assert.strictEqual(d.extra, undefined);
assert.strictEqual(W.cleanList([{ id: 'o:1', title: 'a' }, { id: 'b1', title: 'libro' }, 3]).length, 1); ok('lo que no es una oportunidad se descarta; lo demás se recorta');

// ---- estados, edición, borrado
assert.strictEqual(W.setStatus(L, 'o:x1', 'applied').status, 'applied'); assert.strictEqual(W.setStatus(L, 'o:x1', 'contratado'), null); assert.strictEqual(W.setStatus(L, 'o:nope', 'applied'), null);
assert.strictEqual(W.update(L, 'o:x1', { title: '' }), null); assert.strictEqual(W.update(L, 'o:x1', { note: '' }).note, ''); assert.strictEqual(L.find((r) => r.id === 'o:x1').url, 'https://empleos.example.com/oferta/1');
W.setStatus(L, 'o:x1', 'review');
assert.deepStrictEqual(W.counts(L), { review: 2, applied: 1, replied: 0, discarded: 0, total: 3 }); ok('cambiar estado y editar');

// ---- orden y filtro: activas por fecha de cierre (sin fecha al final); descartadas solo con «todas», al final
W.setStatus(L, 'o:x3', 'discarded');
assert.deepStrictEqual(W.opps(L).map((o) => o.id), ['o:x1', 'o:x2']); assert.deepStrictEqual(W.opps(L, { all: true }).map((o) => o.id), ['o:x1', 'o:x2', 'o:x3']);
W.setStatus(L, 'o:x3', 'review'); assert.deepStrictEqual(W.opps(L).map((o) => o.id), ['o:x3', 'o:x1', 'o:x2']); ok('orden por fecha de cierre; las descartadas se ocultan');

// ---- días al cierre y avisos
assert.strictEqual(W.daysLeft('2026-10-12', '2026-10-07'), 5); assert.strictEqual(W.daysLeft('2026-10-07', '2026-10-07'), 0); assert.strictEqual(W.daysLeft('2026-10-01', '2026-10-07'), -6); assert.strictEqual(W.daysLeft('', '2026-10-07'), null);
assert.strictEqual(W.daysLeft('2026-11-01', '2026-10-25'), 7); // cambio de hora no altera la cuenta
const info = (cl) => W.closeInfo({ closes: cl }, '2026-10-07');
assert.deepStrictEqual(info('2026-10-12'), { text: 'Cierra en 5 días · 12 oct', days: 5, level: '' }); assert.strictEqual(info('2026-10-10').level, 'soon'); assert.strictEqual(info('2026-10-08').text, 'Cierra mañana · 8 oct');
assert.strictEqual(info('2026-10-07').text, 'Cierra hoy · 7 oct'); assert.deepStrictEqual(info('2026-10-06'), { text: 'Cerró hace 1 día · 6 oct', days: -1, level: 'late' }); assert.strictEqual(info(''), null);
assert.deepStrictEqual(W.closingSoon(L, '2026-10-07', 3).map((o) => o.id), ['o:x3']); W.setStatus(L, 'o:x3', 'applied'); assert.strictEqual(W.closingSoon(L, '2026-10-07', 3).length, 0); // ya aplicada: no hace falta avisar
ok('días que faltan, texto del cierre y «cierran pronto»');

// ---- no duplicar por enlace
assert.strictEqual(W.findByUrl(L, 'https://EMPLEOS.example.com/oferta/1/#detalle').id, 'o:x1'); assert.strictEqual(W.findByUrl(L, 'https://empleos.example.com/oferta/2'), null); assert.strictEqual(W.findByUrl(L, ''), null); assert.strictEqual(W.findByUrl(L, 'no es enlace'), null);
ok('una misma oferta se reconoce por su enlace');

// ---- borrar y texto para Claude
assert(W.remove(L, 'o:x2')); assert(!W.remove(L, 'o:x2')); assert.strictEqual(L.length, 2);
const md = W.toMarkdown(L, '2026-10-07');
assert(md.includes('1 por revisar · 1 aplicadas') && md.includes('- **Editor de video** — Apliqué — Cierra mañana · 8 oct') && md.includes('https://empleos.example.com/oferta/1') && md.includes('`o:x1`'));
assert(W.toMarkdown([], '2026-10-07').includes('_No hay oportunidades activas._')); ok('borrar y resumen en Markdown');

console.log('todas las pruebas de work.js pasan');
