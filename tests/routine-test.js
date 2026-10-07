// routine.js: periodos (día, semana ISO, mes), tachar/destachar, secciones y cumplimiento semanal
const assert = require('assert');
const R = require('../routine.js');
const d = (s) => R.parseDay(s);
const ok = (n) => console.log('OK', n);

assert.strictEqual(R.weekKey(d('2026-10-07')), '2026-W41');
assert.strictEqual(R.weekKey(d('2026-01-01')), '2026-W01');
assert.strictEqual(R.weekKey(d('2027-01-01')), '2026-W53'); // viernes: aún es la última semana de 2026
assert.strictEqual(R.weekKey(d('2026-10-11')), '2026-W41'); // domingo cierra la semana
assert.strictEqual(R.weekKey(d('2026-10-12')), '2026-W42');
assert.strictEqual(R.periodKey('monthly', d('2026-10-31')), '2026-10');
ok('periodos: día, semana ISO (lunes a domingo) y mes');

const created = d('2026-10-05').getTime(); // lunes
const daily = R.make('  Revisar correo ', 'daily', 'a', created);
const weekdays = R.make('Buscar oportunidades', 'weekdays', 'b', created);
const weekly = R.make('Resumen de la semana', 'weekly', 'c', created);
const monthly = R.make('Revisar presupuesto', 'monthly', 'm', created);
const bogus = R.make('X', 'yearly', 'x', created);
assert.strictEqual(daily.text, 'Revisar correo'); assert.strictEqual(bogus.freq, 'daily'); assert.strictEqual(daily.done, false);
assert(R.isRoutine(daily) && !R.isRoutine({ id: 'z', text: 'tarea' }));
ok('crear: limpia el texto, frecuencia desconocida → diaria, nunca "done"');

R.setDone(daily, d('2026-10-07'), true, 1);
assert(R.isDone(daily, d('2026-10-07')) && !R.isDone(daily, d('2026-10-08')));
R.setDone(weekly, d('2026-10-06'), true, 1);
assert(R.isDone(weekly, d('2026-10-11')) && !R.isDone(weekly, d('2026-10-12')));
R.setDone(monthly, d('2026-10-02'), true, 1);
assert(R.isDone(monthly, d('2026-10-31')) && !R.isDone(monthly, d('2026-11-01')));
R.setDone(daily, d('2026-10-07'), false); assert(!R.isDone(daily, d('2026-10-07')));
ok('tachar vale para su periodo; al empezar el siguiente vuelve a salir sin tachar; destachar');

const list = [daily, weekdays, weekly, monthly, { id: 't', text: 'tarea normal', done: false }];
const sat = R.sections(list, d('2026-10-10'));
assert.deepStrictEqual(sat.map((s) => s.items.map((t) => t.id)), [['a'], ['c'], ['m']]);
const wed = R.sections(list, d('2026-10-07'));
assert.deepStrictEqual(wed.map((s) => s.items.length), [2, 1, 1]); assert.strictEqual(wed[1].done, 1);
ok('secciones Hoy / Esta semana / Este mes; "entre semana" no sale el sábado; las tareas normales no entran');

// semana: lun 5 a mié 7; diario hecho lun y mié, entre semana hecho lun
R.setDone(daily, d('2026-10-05'), true, 1); R.setDone(daily, d('2026-10-07'), true, 1); R.setDone(weekdays, d('2026-10-05'), true, 1);
const w = R.weekStats(list, d('2026-10-07'));
assert.strictEqual(w.week, '2026-W41'); assert.strictEqual(w.from, '2026-10-05'); assert.strictEqual(w.to, '2026-10-11');
assert.deepStrictEqual(w.days.slice(0, 4).map((x) => [x.done, x.total, x.future]), [[2, 2, false], [0, 2, false], [1, 2, false], [0, 2, true]]);
assert.deepStrictEqual(w.days.slice(5).map((x) => x.total), [1, 1]); // fin de semana solo el diario
// diario 2/3 + entre semana 1/3 + semanal 1/1 = 4/7 (el mensual no cuenta en la semana)
assert.strictEqual(w.done, 4); assert.strictEqual(w.total, 7); assert.strictEqual(w.pct, 57);
const late = R.make('Nuevo', 'daily', 'n', d('2026-10-07').getTime());
const w2 = R.weekStats([late], d('2026-10-07'));
assert.strictEqual(w2.total, 1); assert.strictEqual(w2.days[0].total, 0);
ok('cumplimiento semanal: solo hasta hoy, desde que se creó cada pendiente, sin contar el mensual');

const big = R.make('Mucho', 'daily', 'g', 0);
for (let i = 0; i < 450; i++) R.setDone(big, new Date(2025, 0, 1 + i, 12), true, i);
assert.strictEqual(Object.keys(big.log).length, 400); assert(!big.log['2025-01-01']);
ok('el historial guarda como máximo 400 periodos (borra los más viejos)');
