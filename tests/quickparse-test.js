// Pruebas de quickparse.js (captura rápida en lenguaje natural): lógica pura, sin navegador
const assert = require('assert');
const Q = require('../quickparse.js');
const ok = (m) => console.log('OK', m);
const NOW = new Date(2026, 9, 29, 14, 0); // jueves 29 oct 2026, 2:00 p. m.
const p = (t) => Q.parse(t, NOW);

let r = p('mañana 9am llamar a Ana por el pago !');
assert.deepStrictEqual([r.kind, r.title, r.due, r.time, r.priority], ['task', 'Llamar a Ana por el pago', '2026-10-30', '09:00', 'high']); ok('tarea con fecha, hora y prioridad');
r = p('viernes a las 4 entregar transcripción recuérdame');
assert.deepStrictEqual([r.title, r.due, r.time, r.remind], ['Entregar transcripción', '2026-10-30', '16:00', true]); ok('«a las 4» es en la tarde; aviso');
r = p('pasado mañana a las 9 y media revisar contrato !!');
assert.deepStrictEqual([r.due, r.time, r.priority, r.title], ['2026-10-31', '09:30', 'medium', 'Revisar contrato']); ok('pasado mañana, y media, prioridad media');
r = p('el jueves enviar factura'); assert.strictEqual(r.due, '2026-11-05'); r = p('este jueves enviar factura'); assert.strictEqual(r.due, '2026-10-29'); ok('día de la semana: el próximo, o este');
r = p('15 de noviembre renovar dominio'); assert.deepStrictEqual([r.due, r.title], ['2026-11-15', 'Renovar dominio']);
r = p('3/1 pagar impuesto'); assert.strictEqual(r.due, '2027-01-03'); r = p('el 2 de octubre algo'); assert.strictEqual(r.due, '2027-10-02'); ok('fechas con mes y con barra; si ya pasó, el año siguiente');
r = p('en 2 horas llamar'); assert.deepStrictEqual([r.due, r.time], ['2026-10-29', '16:00']); r = p('esta noche leer'); assert.deepStrictEqual([r.due, r.time], ['2026-10-29', '20:00']); ok('en N horas y esta noche');
r = p('cada lunes revisar ofertas en Workana'); assert.deepStrictEqual([r.kind, r.rec, r.title], ['routine', { freq: 'daily', days: [1] }, 'Revisar ofertas en Workana']);
r = p('caminar 20 min de lunes a viernes'); assert.deepStrictEqual([r.kind, r.rec.days, r.title], ['routine', [1, 2, 3, 4, 5], 'Caminar 20 min']);
r = p('cada mes enviar cuentas de cobro'); assert.deepStrictEqual([r.rec.freq, r.title], ['monthly', 'Enviar cuentas de cobro']);
r = p('regar las plantas cada semana'); assert.strictEqual(r.rec.freq, 'weekly'); ok('rutina: días, semanas, meses');
r = p('cobré $180.000 Tienda Luna con Claude'); assert.deepStrictEqual([r.kind, r.amount, r.itype, r.title], ['income', 180000, 'claude', 'Tienda Luna']);
r = p('me pagaron 150 mil Ana Pérez presencial'); assert.deepStrictEqual([r.kind, r.amount, r.itype, r.title], ['income', 150000, 'presencial', 'Ana Pérez']);
r = p('comprar 3 kilos de arroz'); assert.strictEqual(r.kind, 'task'); assert.strictEqual(r.amount, null); ok('ingresos con $ o «mil»; números sueltos no son dinero');
r = p('oferta traductor remoto cierra el viernes'); assert.deepStrictEqual([r.kind, r.closes, r.due, r.title], ['opp', '2026-10-30', '', 'Traductor remoto']);
r = p('redactor https://www.workana.com/job/abc cierra mañana'); assert.deepStrictEqual([r.kind, r.url, r.closes, r.title], ['opp', 'https://www.workana.com/job/abc', '2026-10-30', 'Redactor']);
r = p('ver javascript:alert(1)'); assert.strictEqual(r.url, ''); assert.strictEqual(r.kind, 'task'); ok('ofertas: cierre y enlace solo http(s)');
r = p('leyendo Hábitos atómicos cap 8'); assert.deepStrictEqual([r.kind, r.chapter, r.title], ['read', 8, 'Hábitos atómicos']); ok('lectura con capítulo');
r = p('comprar pan'); assert.deepStrictEqual([r.kind, r.title, r.due, r.time, r.priority, r.spans.length], ['task', 'Comprar pan', '', '', '', 0]);
r = p(''); assert.strictEqual(r.title, ''); r = p('   !  '); assert.strictEqual(r.priority, 'high'); assert.strictEqual(r.title, '');
r = p('reunión a las 25 con <b>x</b>'); assert.strictEqual(r.time, ''); assert.ok(r.title.includes('<b>x</b>'));
r = p('mañana mañana'); assert.strictEqual(r.due, '2026-10-30'); ok('frases simples, vacías, horas imposibles y texto raro');
r = p('mañana 9am llamar'); r.spans.forEach((s) => assert.ok(s.s >= 0 && s.e <= 'mañana 9am llamar'.length && s.s < s.e)); ok('posiciones para resaltar dentro del texto');
console.log('quickparse: todas las pruebas pasaron');
