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

// ---- ingresos: validar y limpiar
const I = [];
const i1 = W.addIncome(I, { date: '2026-10-03', client: '  Ana   Pérez ', amount: '1.250.000', type: 'onsite', note: ' Clase de refuerzo\r\n2 horas ' }, 5000, uid());
assert.deepStrictEqual(i1, { id: 'm:x4', kind: 'inc', date: '2026-10-03', client: 'Ana Pérez', amount: 1250000, type: 'onsite', note: 'Clase de refuerzo\n2 horas', createdAt: 5000 });
const i2 = W.addIncome(I, { date: '2026-10-15', client: 'Tienda Luna', amount: 85000, type: 'inventado' }, 6000, uid()); assert.strictEqual(i2.type, 'claude');
const i3 = W.addIncome(I, { date: '2026-10-15', client: 'Otra', amount: 40000 }, 7000, uid());
const i4 = W.addIncome(I, { date: '2026-09-28', client: '', amount: '$ 300,000', type: 'claude' }, 8000, uid()); assert.strictEqual(i4.amount, 300000); assert.strictEqual(i4.client, '');
assert.strictEqual(W.addIncome(I, { date: '2026-13-40', client: 'x', amount: 5 }, 1, 'mala'), null); assert.strictEqual(W.addIncome(I, { date: '', client: 'x', amount: 5 }, 1, 'mala'), null);
['', 'abc', '-5', '12.5', '1e3', null, -1, NaN, Infinity, 1e11, {}].forEach((a) => assert.strictEqual(W.addIncome(I, { date: '2026-10-01', amount: a }, 1, 'mala'), null, String(a)));
assert.strictEqual(I.length, 4); assert.strictEqual(W.cleanAmount(0), 0); assert.strictEqual(W.cleanAmount('85000'), 85000); assert.strictEqual(W.cleanAmount(99.6), 100);
ok('ingresos: fecha y monto válidos (acepta «1.250.000» y «$ 300,000»); tipo y texto saneados');

// ---- ingresos y oportunidades conviven en la misma lista, sin pisarse
const M = [...L, ...I];
assert.strictEqual(W.clean({ id: 'm:z', date: '2026-10-01', amount: 5, extra: 1, updatedAt: 9 }).extra, undefined); assert.strictEqual(W.clean({ id: 'm:z', date: '2026-10-01', amount: 5, updatedAt: 9 }).updatedAt, 9);
assert.strictEqual(W.cleanList([...L, ...I, { id: 'm:mal', date: 'x', amount: 1 }, { id: 'i:a', text: 'rutina' }]).length, L.length + I.length);
assert.deepStrictEqual(W.counts(M), W.counts(L)); assert.strictEqual(W.opps(M, { all: true }).length, L.length); assert.strictEqual(W.findByUrl(M, 'https://x.example.com/v').id, 'o:x3');
assert.strictEqual(W.update(M, 'm:x4', { title: 'x' }), null); assert(!W.remove(M, 'm:x4')); assert.strictEqual(M.length, L.length + I.length);
assert.strictEqual(W.updateIncome(M, 'o:x1', { amount: 1 }), null); assert(!W.removeIncome(M, 'o:x1'));
assert(!W.toMarkdown(M, '2026-10-07').includes('Ana')); ok('ingresos y oportunidades conviven en la misma lista sin mezclarse');

// ---- meses, totales y orden
assert.strictEqual(W.monthKey('2026-10-15'), '2026-10'); assert.strictEqual(W.monthKey('mal'), ''); assert(W.isMonth('2026-10')); assert(!W.isMonth('2026-13')); assert(!W.isMonth('2026-1'));
assert.strictEqual(W.shiftMonth('2026-10', 1), '2026-11'); assert.strictEqual(W.shiftMonth('2026-12', 1), '2027-01'); assert.strictEqual(W.shiftMonth('2026-01', -1), '2025-12'); assert.strictEqual(W.shiftMonth('2026-03', -14), '2025-01');
assert.strictEqual(W.monthLabel('2026-10'), 'octubre 2026'); assert.strictEqual(W.monthLabel('2027-01'), 'enero 2027');
assert.strictEqual(W.money(1250000), '$1.250.000'); assert.strictEqual(W.money(85000), '$85.000'); assert.strictEqual(W.money(0), '$0'); assert.strictEqual(W.money(999), '$999'); assert.strictEqual(W.money('x'), '$0');
assert.deepStrictEqual(W.monthTotals(M, '2026-10'), { total: 1375000, count: 3, claude: 125000, onsite: 1250000 });
assert.deepStrictEqual(W.monthTotals(M, '2026-09'), { total: 300000, count: 1, claude: 300000, onsite: 0 }); assert.deepStrictEqual(W.monthTotals(M, '2026-08'), { total: 0, count: 0, claude: 0, onsite: 0 });
assert.deepStrictEqual(W.incomes(M, '2026-10').map((r) => r.id), ['m:x6', 'm:x5', 'm:x4']); // más reciente primero; a igual fecha, el último que se añadió
assert.deepStrictEqual(W.monthsWithIncome(M), ['2026-10', '2026-09']); assert.deepStrictEqual(W.monthsWithIncome(L), []); ok('meses, totales por tipo y orden');

// ---- editar y borrar ingresos
assert.strictEqual(W.updateIncome(M, 'm:x4', { amount: '1.300.000', client: 'Ana P.' }).amount, 1300000); assert.strictEqual(W.updateIncome(M, 'm:x4', { amount: 'mucho' }), null); assert.strictEqual(M.find((r) => r.id === 'm:x4').amount, 1300000);
assert.strictEqual(W.updateIncome(M, 'm:x4', { date: '' }), null); assert.strictEqual(W.updateIncome(M, 'm:nope', { amount: 1 }), null);
assert(W.removeIncome(M, 'm:x7')); assert(!W.removeIncome(M, 'm:x7')); assert.strictEqual(W.monthTotals(M, '2026-09').total, 0); ok('editar y borrar ingresos');

// ---- texto para Claude
const imd = W.incomeToMarkdown(M, '2026-10');
assert(imd.includes('# Ingresos — octubre 2026') && imd.includes('Total: $1.425.000 · 3 trabajos · Con Claude $125.000 · Presencial $1.300.000') && imd.includes('- 2026-10-03 — **Ana P.** — $1.300.000 — Presencial — Clase de refuerzo 2 horas') && imd.includes('`m:x4`'));
assert(W.incomeToMarkdown([], '2026-10').includes('_No hay ingresos en este mes._')); ok('resumen de ingresos en Markdown');

console.log('todas las pruebas de work.js pasan');
