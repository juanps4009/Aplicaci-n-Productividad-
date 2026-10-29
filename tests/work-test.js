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

// ---- ingresos: fecha, cliente, monto en pesos y tipo; total del mes
const I = [{ id: 'o:x', kind: 'opp', title: 'Oferta', url: '', closes: '', status: 'review', source: '', note: '', createdAt: 1 }];
const i1 = W.addIncome(I, { date: '2026-10-05', client: '  Ana   Pérez ', amount: '$ 150.000', type: 'presencial' }, 10, 'a');
assert.deepStrictEqual(i1, { id: 'm:a', kind: 'income', date: '2026-10-05', client: 'Ana Pérez', amount: 150000, type: 'presencial', createdAt: 10 });
W.addIncome(I, { date: '2026-10-20', client: 'Luis', amount: 80000 }, 20, 'b'); W.addIncome(I, { date: '2026-09-30', client: 'Sep', amount: '1.000.000', type: 'claude' }, 30, 'c');
assert.strictEqual(I.find((r) => r.id === 'm:b').type, 'claude');
[['', '2026-10-01', 5], ['x', '2026-02-30', 5], ['x', '2026-10-01', 0], ['x', '2026-10-01', '-5'], ['x', '2026-10-01', '150.000,50'], ['x', '2026-10-01', '1,5'], ['x', '2026-10-01', 'mil'], ['x', '2026-10-01', 1.5]]
  .forEach(([client, date, amount]) => assert.strictEqual(W.addIncome(I, { client, date, amount }, 1, 'z'), null, String(amount)));
assert.strictEqual(I.length, 4); ok('ingresos: monto en pesos sin centavos, fecha y cliente obligatorios');

assert.deepStrictEqual(W.incomes(I, '2026-10').map((r) => r.id), ['m:b', 'm:a']); assert.deepStrictEqual(W.monthTotal(I, '2026-10'), { total: 230000, count: 2, byType: { claude: 80000, presencial: 150000 } });
assert.deepStrictEqual(W.monthTotal(I, '2026-11'), { total: 0, count: 0, byType: { claude: 0, presencial: 0 } });
assert.strictEqual(W.money(1234567), '$ 1.234.567'); assert.strictEqual(W.money(0), '$ 0'); assert.strictEqual(W.monthLabel('2026-10'), 'Octubre 2026');
assert.strictEqual(W.shiftMonth('2026-01', -1), '2025-12'); assert.strictEqual(W.shiftMonth('2026-12', 1), '2027-01'); ok('total del mes con desglose por tipo; meses y montos legibles');

assert.strictEqual(W.update(I, 'm:a', { amount: '200.000', type: 'claude' }).amount, 200000); assert.strictEqual(W.update(I, 'm:a', { client: ' ' }), null); assert.strictEqual(I.find((r) => r.id === 'm:a').client, 'Ana Pérez');
assert.strictEqual(W.setStatus(I, 'm:a', 'applied'), null); assert.deepStrictEqual(W.counts(I), { review: 1, applied: 0, replied: 0, discarded: 0, total: 1 }); assert.deepStrictEqual(W.opps(I).map((o) => o.id), ['o:x']);
assert(W.remove(I, 'm:c')); assert.strictEqual(W.monthTotal(I, '2026-09').count, 0);
const dirty = W.clean({ id: 'm:q', date: '2026-10-01', client: '<b>x</b>', amount: 5, type: 'otro', extra: 1, updatedAt: 9 });
assert.deepStrictEqual(dirty, { id: 'm:q', updatedAt: 9, kind: 'income', date: '2026-10-01', client: '<b>x</b>', amount: 5, type: 'claude', createdAt: 0 });
assert.strictEqual(W.cleanList([{ id: 'm:1', date: '2026-10-01', client: 'a', amount: 1 }, { id: 'm:', client: 'a' }, { id: 'o:1', title: 'b' }]).length, 2);
ok('editar, borrar y limpiar ingresos; no se mezclan con las oportunidades');

console.log('todas las pruebas de work.js pasan');
