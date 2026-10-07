// Pruebas de routine.js (rutina diaria/semanal/mensual y resumen semanal): lógica pura, sin navegador
const assert = require('assert');
const R = require('../routine.js');
const ok = (m) => console.log('OK', m);
const at = (s) => R.parseDate(s).getTime() + 12 * 3600000; // mediodía de ese día

// ---- fechas y semanas ISO (de lunes a domingo; la semana 1 tiene el primer jueves del año)
assert.strictEqual(R.dow('2026-10-07'), 3); assert.strictEqual(R.dow('2026-10-05'), 1); assert.strictEqual(R.dow('2026-10-11'), 7);
assert.strictEqual(R.weekKey('2026-10-07'), '2026-W41'); assert.strictEqual(R.weekKey('2026-10-05'), '2026-W41'); assert.strictEqual(R.weekKey('2026-10-11'), '2026-W41'); assert.strictEqual(R.weekKey('2026-10-12'), '2026-W42');
assert.strictEqual(R.weekKey('2026-01-01'), '2026-W01'); assert.strictEqual(R.weekKey('2027-01-01'), '2026-W53'); assert.strictEqual(R.weekKey('2024-12-30'), '2025-W01'); assert.strictEqual(R.weekKey('2021-01-03'), '2020-W53');
assert.strictEqual(R.weekStart('2026-W41'), '2026-10-05'); assert.strictEqual(R.weekStart('2025-W01'), '2024-12-30'); assert.strictEqual(R.weekStart('2026-W53'), '2026-12-28');
assert.deepStrictEqual(R.weekDates('2026-W41'), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
assert.strictEqual(R.shiftWeek('2026-W41', -1), '2026-W40'); assert.strictEqual(R.shiftWeek('2026-W53', 1), '2027-W01'); assert.strictEqual(R.shiftWeek('2026-W01', -1), '2025-W52');
assert.strictEqual(R.addDays('2026-02-28', 1), '2026-03-01'); assert.strictEqual(R.addDays('2026-01-01', -1), '2025-12-31');
assert.strictEqual(R.periodKey('daily', '2026-10-07'), '2026-10-07'); assert.strictEqual(R.periodKey('weekly', '2026-10-07'), '2026-W41'); assert.strictEqual(R.periodKey('monthly', '2026-10-07'), '2026-10');
assert.strictEqual(R.weekLabel('2026-W41'), '5–11 oct'); assert.strictEqual(R.weekLabel('2026-W40'), '28 sep – 4 oct');
assert(R.isWeekKey('2026-W41') && !R.isWeekKey('2026-W60') && !R.isWeekKey('2026-41') && R.isDateKey('2026-02-28') && !R.isDateKey('2026-02-30') && !R.isDateKey('hoy'));
ok('fechas: día de la semana, semana ISO (también en el cambio de año), lunes de la semana, periodos');

// ---- ítems: añadir, editar, ordenar, quitar
const L = [];
let n = 0; const uid = () => 'x' + (++n);
const res = R.addItem(L, { text: '  Hacer   resumen del libro ', freq: 'daily' }, at('2026-10-05'), uid());
const opp = R.addItem(L, { text: 'Revisar oportunidades', freq: 'daily', days: [5, 1, 3, 1, 9, 'x'] }, at('2026-10-05'), uid());
const plan = R.addItem(L, { text: 'Planear la semana', freq: 'weekly' }, at('2026-10-05'), uid());
const pay = R.addItem(L, { text: 'Pagar cuentas', freq: 'monthly', days: [1, 2] }, at('2026-10-05'), uid());
assert.strictEqual(res.text, 'Hacer resumen del libro'); assert.deepStrictEqual(opp.days, [1, 3, 5]); assert.deepStrictEqual(pay.days, []); assert.strictEqual(R.addItem(L, { text: '   ' }, 1, uid()), null);
assert.deepStrictEqual(R.items(L).map((x) => x.id), ['i:x1', 'i:x2', 'i:x3', 'i:x4']); assert.deepStrictEqual(R.items(L, 'daily').map((x) => x.text), ['Hacer resumen del libro', 'Revisar oportunidades']);
assert(R.moveItem(L, 'i:x2', -1)); assert.deepStrictEqual(R.items(L, 'daily').map((x) => x.id), ['i:x2', 'i:x1']); assert(!R.moveItem(L, 'i:x2', -1)); assert(R.moveItem(L, 'i:x2', 1));
assert.deepStrictEqual(R.updateItem(L, 'i:x2', { days: [1, 2, 3, 4, 5, 6, 7] }).days, []); R.updateItem(L, 'i:x2', { days: [1, 3, 5] }); assert.strictEqual(R.updateItem(L, 'i:x2', { text: '' }), null); assert.strictEqual(R.updateItem(L, 'i:nope', { text: 'a' }), null);
assert.strictEqual(R.describeDays(opp), 'lunes, miércoles, viernes'); assert.strictEqual(R.describeDays(R.clean({ id: 'i:a', text: 'a', days: [1, 2, 3, 4, 5] })), 'lunes a viernes'); assert.strictEqual(R.describeDays(res), '');
ok('ítems: texto limpio, días válidos (solo diarios), orden, mover y editar');

// ---- marcar con un clic: cada frecuencia tiene su periodo
const item = (id) => L.find((r) => r.id === id);
assert.strictEqual(R.toggle(L, item('i:x1'), '2026-10-05', 111), true); assert(R.isDone(L, item('i:x1'), '2026-10-05')); assert(!R.isDone(L, item('i:x1'), '2026-10-06'));
assert.strictEqual(R.toggle(L, item('i:x1'), '2026-10-05', 112), false); assert(!R.isDone(L, item('i:x1'), '2026-10-05')); R.toggle(L, item('i:x1'), '2026-10-05', 113);
R.toggle(L, item('i:x3'), '2026-10-07', 1); assert(R.isDone(L, item('i:x3'), '2026-10-05') && R.isDone(L, item('i:x3'), '2026-10-11') && !R.isDone(L, item('i:x3'), '2026-10-12')); // semanal: vale toda la semana
R.toggle(L, item('i:x4'), '2026-10-07', 1); assert(R.isDone(L, item('i:x4'), '2026-10-31') && !R.isDone(L, item('i:x4'), '2026-11-01')); // mensual: vale todo el mes
assert.deepStrictEqual(L.filter((r) => r.kind === 'period').map((r) => r.id).sort(), ['p:2026-10', 'p:2026-10-05', 'p:2026-W41']);
assert(!R.dueOn(item('i:x2'), '2026-10-06') && R.dueOn(item('i:x2'), '2026-10-07') && R.dueOn(item('i:x3'), '2026-10-06'));
let t = R.today(L, '2026-10-06'); assert.deepStrictEqual(t.daily.map((x) => x.item.id), ['i:x1']); assert.strictEqual(t.total, 3); assert.strictEqual(t.done, 2); // martes: «oportunidades» no toca
t = R.today(L, '2026-10-12'); assert.strictEqual(t.done, 1); assert.strictEqual(t.total, 4); ok('marcar y desmarcar; el día, la semana y el mes se reinician solos; «hoy» solo trae lo que toca');

// ---- resumen de la semana (miércoles 7 de octubre)
R.setDone(L, item('i:x1'), '2026-10-07', true, 1); R.setDone(L, item('i:x2'), '2026-10-05', true, 1);
let s = R.weekStats(L, '2026-W41', '2026-10-07');
assert.deepStrictEqual(s.daily[0].cells, ['done', 'miss', 'done', 'future', 'future', 'future', 'future']); assert.strictEqual(s.daily[0].done, 2); assert.strictEqual(s.daily[0].due, 3); assert.strictEqual(s.daily[0].pct, 67);
assert.deepStrictEqual(s.daily[1].cells, ['done', 'na', 'pending', 'na', 'future', 'na', 'na']); assert.strictEqual(s.daily[1].due, 1); assert.strictEqual(s.daily[1].pct, 100); // hoy sin marcar aún no cuenta como fallo
assert(s.weekly[0].done && s.monthly[0].done && s.current && s.started); assert.strictEqual(s.done, 4); assert.strictEqual(s.due, 5); assert.strictEqual(s.pct, 80); assert.strictEqual(s.label, '5–11 oct');
// un punto por día para la tarjeta «Tu semana»: lunes todo, martes nada, hoy a medias, el resto por llegar
assert.deepStrictEqual(s.days.map((d) => d.state), ['full', 'miss', 'today', 'future', 'future', 'future', 'future']); assert.deepStrictEqual([s.days[0].done, s.days[0].total, s.days[2].done, s.days[2].total, s.days[1].total], [2, 2, 1, 2, 1]);
assert.deepStrictEqual(R.weekStats(L, '2026-W42', '2026-10-25').days.map((d) => d.state), Array(7).fill('miss')); assert.deepStrictEqual(R.weekStats(L, '2026-W40', '2026-10-07').days.map((d) => d.state), Array(7).fill('empty'));
R.setDone(L, item('i:x2'), '2026-10-07', true, 1); assert.strictEqual(R.weekStats(L, '2026-W41', '2026-10-07').days[2].state, 'full'); R.setDone(L, item('i:x2'), '2026-10-07', false, 1);
assert.strictEqual(s.daily[0].streak, 1); R.setDone(L, item('i:x1'), '2026-10-06', true, 1); assert.strictEqual(R.streak(L, item('i:x1'), '2026-10-07'), 3); assert.strictEqual(R.streak(L, item('i:x1'), '2026-10-08'), 3); assert.strictEqual(R.streak(L, item('i:x1'), '2026-10-09'), 0);
assert.strictEqual(R.streak(L, item('i:x2'), '2026-10-06'), 1); // los días que no tocan no rompen la racha
// semana siguiente ya cerrada: lo no hecho cuenta como fallo; semana anterior: los ítems aún no existían
s = R.weekStats(L, '2026-W42', '2026-10-25'); assert.deepStrictEqual(s.daily[0].cells, Array(7).fill('miss')); assert(!s.weekly[0].done && s.weekly[0].closed && s.monthly[0].done && !s.current); assert.strictEqual(s.pct, 0); assert.strictEqual(s.due, 11);
s = R.weekStats(L, '2026-W40', '2026-10-07'); assert.deepStrictEqual(s.daily[0].cells, Array(7).fill('na')); assert.strictEqual(s.weekly.length, 0); assert.strictEqual(s.pct, null);
s = R.weekStats(L, '2026-W43', '2026-10-07'); assert(!s.started && s.daily[0].cells.every((c) => c === 'future') && s.monthly.length === 0);
ok('resumen semanal: cuadrícula por día, porcentaje, racha, semanas pasadas y futuras');

// ---- comentario de la semana
assert.strictEqual(R.setReview(L, '2026-W41', '  Buena semana.\r\nFaltó el martes. ', 'Claude', 5).text, 'Buena semana.\nFaltó el martes.');
assert.strictEqual(R.weekStats(L, '2026-W41', '2026-10-07').review.by, 'Claude'); R.setReview(L, '2026-W41', 'Otro', 'Claude', 6); assert.strictEqual(L.filter((r) => r.kind === 'review').length, 1);
assert.strictEqual(R.setReview(L, '2026-W41', '   ', 'Claude', 7), null); assert.strictEqual(L.filter((r) => r.kind === 'review').length, 0); R.setReview(L, '2026-W41', 'Vas bien.', 'Claude', 8);
ok('comentario semanal: uno por semana, se reemplaza y se puede quitar');

// ---- lo que llega de fuera se limpia; lo que no es de la rutina se descarta
assert.strictEqual(R.clean({ id: 'b1', title: 'un libro' }), null); assert.strictEqual(R.clean({ id: 'i:', text: 'x' }), null); assert.strictEqual(R.clean(null), null); assert.strictEqual(R.clean({ id: 'p:ayer', done: {} }), null); assert.strictEqual(R.clean({ id: 'r:2026-W99', text: 'x' }), null);
assert.deepStrictEqual(R.clean({ id: 'i:z', text: '<b>x</b>', freq: 'hourly', days: 'no', order: 'a', extra: 1, updatedAt: 9 }), { id: 'i:z', updatedAt: 9, kind: 'item', text: '<b>x</b>', freq: 'daily', days: [], order: 0, createdAt: 0 });
assert.deepStrictEqual(R.clean({ id: 'p:2026-10-07', done: { 'i:a': 5, 'b:x': 1, 'i:b': 0, 'i:c': 'x' } }).done, { 'i:a': 5, 'i:c': 1 });
assert.strictEqual(R.clean({ id: 'i:y', text: 'a'.repeat(500) }).text.length, 200); assert.strictEqual(R.cleanList([{ id: 'i:q', text: 'ok' }, { id: 'zz' }, 7, null]).length, 1); assert.deepStrictEqual(R.cleanList('basura'), []);
ok('datos de otros dispositivos: se validan y se recortan');

// ---- texto para el programa de escritorio
const md = R.toMarkdown(L, '2026-10-07');
assert(md.includes('semana 2026-W41 (5–11 oct)') && md.includes('| Hacer resumen del libro | ✓ | ✓ | ✓ |') && md.includes('- [x] Planear la semana') && md.includes('Vas bien.') && md.includes('`i:x2` — Revisar oportunidades') && md.includes('_(lunes, miércoles, viernes)_'));
ok('resumen en Markdown para Claude');

console.log('todas las pruebas de routine.js pasan');
