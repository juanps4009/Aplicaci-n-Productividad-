// Programa de escritorio (herramientas/rutina.mjs) contra el código real del servidor sobre una base simulada.
// Comprueba que Claude puede leer y cambiar la rutina y que todo viaja cifrado como registros «books» con id "rt:…".
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import worker from '../worker/index.js';
import { run } from '../herramientas/rutina.mjs';

const require = createRequire(import.meta.url);
const Sync = require('../sync.js'), Routine = require('../routine.js');
const ok = (m) => console.log('OK', m);

function mockD1() { const db = new DatabaseSync(':memory:');
  const mk = (sql) => { let args = []; const o = { bind(...a){args=a;return o;}, async run(){db.prepare(sql).run(...args);return {success:true};}, async all(){return {results:db.prepare(sql).all(...args)};}, async first(){return db.prepare(sql).get(...args)??null;}, _run(){db.prepare(sql).run(...args);} }; return o; };
  return { prepare: mk, async batch(list){ for (const s of list) s._run(); return []; }, raw: db }; }
const env = { DB: mockD1() };
const SERVER = 'https://avisos.test';
const code = Sync.makeCode(crypto.getRandomValues(new Uint8Array(20)));
let clock = new Date(2026, 9, 7, 10, 0, 0).getTime(); // miércoles 7 de octubre de 2026
const base = { code, server: SERVER, now: () => clock, fetch: (url, init) => { worker._test.resetRate(); return worker.fetch(new Request(url, init), env); } };
const cli = (...argv) => run(argv, base);
const rows = () => env.DB.raw.prepare('SELECT id, col, deleted, data FROM records ORDER BY id').all();
const tmp = mkdtempSync(join(tmpdir(), 'rutina-'));

// ---- añadir y ver
assert((await cli('ver')).includes('_Sin pendientes diarios._'));
let out = await cli('agregar', 'Hacer', 'resumen', 'del', 'libro'); assert(/Añadido i:\w+: Hacer resumen del libro \(diaria\)/.test(out) && out.includes('Guardado en el servidor'));
out = await cli('agregar', 'Revisar oportunidades', '--frecuencia', 'diaria', '--dias', 'lunes, miércoles y viernes'); assert(out.includes('lunes, miércoles, viernes'));
await cli('agregar', 'Planear la semana', '--frecuencia', 'semanal'); await cli('agregar', 'Pagar cuentas', '--frecuencia', 'mensual');
out = await cli('ver'); assert(out.includes('semana 2026-W41 (5–11 oct)') && out.includes('| Hacer resumen del libro |') && out.includes('- [ ] Planear la semana') && out.includes('- [ ] Pagar cuentas'));
assert.strictEqual(rows().length, 4); assert(rows().every((r) => r.col === 'books' && r.id.startsWith('rt:i:') && r.data.startsWith('e1:')));
assert(!/resumen|oportunidades|Planear|Pagar/.test(rows().map((r) => r.data).join('|'))); ok('agregar y ver; el servidor solo guarda registros «books» cifrados con id rt:…');

// ---- marcar por texto o por id, hoy u otra fecha
clock += 1000; out = await cli('marcar', 'resumen'); assert(out.includes('Marcado «Hacer resumen del libro» (2026-10-07)'));
clock += 1000; await cli('marcar', 'oportunidades', '--fecha', '2026-10-05'); clock += 1000; await cli('marcar', 'Planear');
out = await cli('ver'); assert(out.includes('| Hacer resumen del libro | – | – | ✓ |') && out.includes('- [x] Planear la semana'));
assert(/\| Revisar oportunidades _\(lunes, miércoles, viernes\)_ \| – \| – \| · \|/.test(out)); // el lunes aún no existía el pendiente; hoy sigue sin marcar
clock += 1000; await cli('desmarcar', 'Planear'); assert((await cli('ver')).includes('- [ ] Planear la semana'));
const json = JSON.parse(await cli('ver', '--json')); assert.strictEqual(json.hoy, '2026-10-07'); assert.strictEqual(json.items.length, 4); assert.strictEqual(json.daily[0].cells[2], 'done');
ok('marcar y desmarcar (por texto o id, con fecha); salida en Markdown y en JSON');

// ---- editar, quitar y errores claros
clock += 1000; out = await cli('editar', 'Pagar', '--texto', 'Pagar servicios', '--frecuencia', 'semanal'); assert(out.includes('Pagar servicios (semanal)'));
clock += 1000; out = await cli('quitar', 'Pagar servicios'); assert(out.includes('Quitado')); assert.strictEqual(rows().filter((r) => r.deleted).length, 1); assert.strictEqual(JSON.parse(await cli('ver', '--json')).items.length, 3);
await assert.rejects(cli('marcar', 'no existe'), /No hay ningún pendiente/); await assert.rejects(cli('marcar', 'r'), /coincide con varios/); await assert.rejects(cli('agregar', 'x', '--frecuencia', 'anual'), /Frecuencia desconocida/);
await assert.rejects(cli('agregar', 'x', '--dias', 'lunes,festivo'), /Día desconocido/); await assert.rejects(cli('marcar', 'resumen', '--fecha', 'ayer'), /Fecha inválida/); await assert.rejects(cli('bailar'), /Orden desconocida/);
ok('editar y quitar; los errores se explican en español');

// ---- comentario semanal
writeFileSync(join(tmp, 'c.md'), 'Vas bien con los resúmenes.\r\nFalta constancia en oportunidades.\n');
clock += 1000; out = await cli('comentario', '--archivo', join(tmp, 'c.md')); assert(out.includes('Comentario de la semana 2026-W41 guardado'));
assert((await cli('ver')).includes('Vas bien con los resúmenes.\nFalta constancia en oportunidades.'));
clock += 1000; await cli('comentario', '--semana', '2026-W40', '--texto', 'Semana anterior.'); assert((await cli('ver', '--semana', '2026-W40')).includes('Semana anterior.'));
clock += 1000; await cli('comentario', '--semana', '2026-W40', '--texto', ''); assert((await cli('ver', '--semana', '2026-W40')).includes('_Sin comentario todavía._'));
await assert.rejects(cli('comentario'), /Falta --archivo o --texto/); await assert.rejects(cli('comentario', '--semana', '41', '--texto', 'x'), /Semana inválida/);
ok('comentario de la semana: desde archivo o texto, otra semana, y quitarlo');

// ---- importar la lista que arme el Proyecto (formato de RUTINA-GUIA.md) y exportar
writeFileSync(join(tmp, 'rutina.json'), '\uFEFF' + JSON.stringify({ rutina: [
  { texto: 'Hacer resumen del libro', frecuencia: 'diaria', dias: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'] },
  { texto: 'Leer 20 páginas', frecuencia: 'diaria' }, { texto: 'Revisar finanzas', frecuencia: 'mensual' },
] }));
clock += 1000; out = await cli('importar', join(tmp, 'rutina.json')); assert(out.includes('2 añadido(s), 1 cambiado(s)') && out.includes('5 pendiente(s)'));
const exp = JSON.parse(await cli('exportar')); assert.strictEqual(exp.rutina.length, 5); assert.deepStrictEqual(exp.rutina.find((x) => x.texto === 'Hacer resumen del libro').dias, ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']);
assert((await cli('ver')).includes('| Hacer resumen del libro _(lunes a viernes)_ | – | – | ✓ |')); // importar no borra lo ya marcado
clock += 1000; out = await cli('importar', join(tmp, 'rutina.json'), '--reemplazar'); assert(out.includes('0 añadido(s), 0 cambiado(s), 2 quitado(s)') && out.includes('3 pendiente(s)'));
writeFileSync(join(tmp, 'mal.json'), '{ "rutina": [ { "frecuencia": "diaria" } ] }'); await assert.rejects(cli('importar', join(tmp, 'mal.json')), /no tiene texto/);
assert((await cli('importar', join(tmp, 'rutina.json'))).includes('No había nada que cambiar'));
ok('importar (sin duplicar, conserva las marcas, --reemplazar) y exportar');

// ---- lo que hace la app también lo ve el programa: otro dispositivo marca un pendiente
const key = await Sync.deriveKey(code), space = await Sync.spaceId(code);
const pid = 'rt:p:2026-10-07', item = JSON.parse(await cli('ver', '--json')).items.find((x) => x.text === 'Leer 20 páginas');
const prev = JSON.parse(await Sync.decryptText(key, rows().find((r) => r.id === pid).data, pid + '|books'));
const rec = { ...prev, done: { ...prev.done, [item.id]: clock }, updatedAt: clock + 5000 };
await base.fetch(SERVER + '/space/sync', { method: 'POST', body: JSON.stringify({ space, since: 0, records: [{ id: pid, col: 'books', updatedAt: rec.updatedAt, deleted: 0, data: await Sync.encryptText(key, JSON.stringify(rec), pid + '|books') }] }) });
assert((await cli('ver')).includes('| Leer 20 páginas | – | – | ✓ |'));
// …y lo que el programa escribe después gana aunque su reloj vaya atrasado (sello siempre mayor que el del servidor)
out = await cli('desmarcar', 'Leer'); assert(out.includes('Desmarcado')); assert((await cli('ver')).includes('| Leer 20 páginas | – | – | · |'));
ok('convive con la app: ve lo marcado en otro dispositivo y sus cambios no se pierden por el reloj');

// ---- tareas: Claude puede añadir a «Pendientes»; se guardan como registros «tasks» con la forma que usa la app
clock += 1000; out = await cli('tarea', 'agregar', 'Enviar', 'hoja', 'de', 'vida', '--prioridad', 'alta', '--vence', '2026-10-09'); assert(out.includes('Tarea añadida: Enviar hoja de vida (prioridad alta, vence 2026-10-09)') && out.includes('Guardado en el servidor'));
const trows = rows().filter((r) => r.col === 'tasks'); assert.strictEqual(trows.length, 1); assert(trows[0].data.startsWith('e1:') && !trows[0].id.startsWith('rt:'));
const task = JSON.parse(await Sync.decryptText(key, trows[0].data, trows[0].id + '|tasks'));
assert.deepStrictEqual({ id: task.id, text: task.text, done: task.done, priority: task.priority, due: task.due, reminders: task.reminders, doc: task.doc }, { id: trows[0].id, text: 'Enviar hoja de vida', done: false, priority: 'high', due: '2026-10-09', reminders: [], doc: [] });
await assert.rejects(cli('tarea', 'agregar'), /Falta el texto/); await assert.rejects(cli('tarea', 'agregar', 'x', '--prioridad', 'urgente'), /Prioridad desconocida/); await assert.rejects(cli('tarea', 'agregar', 'x', '--vence', 'mañana'), /vencimiento inválida/); await assert.rejects(cli('tarea', 'borrar', 'x'), /solo se puede/);
clock += 1000; await cli('marcar', 'resumen'); assert.strictEqual(rows().filter((r) => r.col === 'tasks').length, 1); // cambiar la rutina no toca ni duplica las tareas
ok('tarea agregar: crea una tarea cifrada con la misma forma que la app');

// ---- oportunidades: agregar sin duplicar, cambiar estado, editar, quitar
clock += 1000; out = await cli('oportunidad', 'agregar', 'Redactor remoto de fin de semana', '--enlace', 'https://empleos.example.com/oferta/1', '--cierra', '2026-10-09', '--fuente', 'Radar', '--nota', 'Pago por artículo');
assert(/Oportunidad añadida o:\w+: Redactor remoto de fin de semana \(por revisar, cierra 2026-10-09\)/.test(out));
clock += 1000; out = await cli('oportunidad', 'agregar', 'La misma oferta otra vez', '--enlace', 'https://EMPLEOS.example.com/oferta/1/'); assert(out.includes('Ya estaba') && out.includes('No había nada que cambiar'));
clock += 1000; await cli('oportunidad', 'agregar', 'Asistente virtual', '--estado', 'apliqué');
out = await cli('oportunidades'); assert(out.includes('1 por revisar · 1 aplicadas') && out.includes('**Redactor remoto de fin de semana** — Por revisar — Cierra en 2 días · 9 oct') && out.includes('Origen: Radar') && out.includes('Nota: Pago por artículo'));
clock += 1000; out = await cli('oportunidad', 'estado', 'Redactor', 'me', 'respondieron'); assert(out.includes('(me respondieron, cierra 2026-10-09)'));
clock += 1000; await cli('oportunidad', 'estado', 'https://empleos.example.com/oferta/1', 'descartada');
assert(!(await cli('oportunidades')).includes('Redactor')); assert((await cli('oportunidades', '--todas')).includes('**Redactor remoto de fin de semana** — Descartada'));
clock += 1000; out = await cli('oportunidad', 'editar', 'Asistente', '--cierra', '2026-10-08', '--estado', 'por revisar', '--enlace', 'https://x.example.com/a'); assert(out.includes('(por revisar, cierra 2026-10-08)'));
await assert.rejects(cli('oportunidad', 'agregar', 'x', '--enlace', 'javascript:alert(1)'), /Enlace inválido/); await assert.rejects(cli('oportunidad', 'estado', 'Asistente', 'contratado'), /Estado desconocido/);
await assert.rejects(cli('oportunidad', 'estado', 'nadie', 'apliqué'), /No hay ninguna oportunidad/); await assert.rejects(cli('oportunidad', 'agregar'), /Falta el título/); await assert.rejects(cli('oportunidad', 'archivar', 'x'), /agregar, estado, editar o quitar/);
const orow = rows().filter((r) => r.id.startsWith('rt:o:')); assert.strictEqual(orow.length, 2); assert(orow.every((r) => r.col === 'books' && r.data.startsWith('e1:'))); assert(!/Redactor|Asistente|empleos\.example/.test(rows().map((r) => r.data).join('|')));
ok('oportunidades: agregar (sin duplicar por enlace), estados, editar; viajan cifradas como «books» rt:o:…');

// ---- «hoy»: lo que Claude lee en sus resúmenes programados
const hoy = JSON.parse(await cli('hoy', '--json'));
assert.strictEqual(hoy.hoy, '2026-10-07'); assert.deepStrictEqual(hoy.tareas.map((t) => [t.texto, t.prioridad, t.vence, t.vencida]), [['Enviar hoja de vida', 'high', '2026-10-09', false]]);
assert.deepStrictEqual([hoy.rutina.hechos, hoy.rutina.total, hoy.rutina.diarios.length, hoy.rutina.mensuales.length], [1, 3, 2, 1]); assert.strictEqual(hoy.semana.semana, '2026-W41'); assert.strictEqual(hoy.semana.dias.length, 7); assert.strictEqual(hoy.semana.dias[2].estado, 'today');
assert.deepStrictEqual(hoy.oportunidades.cuenta, { review: 1, applied: 0, replied: 0, discarded: 1, total: 2 }); assert.deepStrictEqual(hoy.oportunidades.cierranPronto.map((o) => [o.titulo, o.enlace, o.cierre]), [['Asistente virtual', 'https://x.example.com/a', 'Cierra mañana · 8 oct']]);
out = await cli('hoy'); assert(out.includes('# Hoy — miércoles 2026-10-07') && out.includes('## Tareas pendientes (1)') && out.includes('- [alta] Enviar hoja de vida — vence 2026-10-09') && out.includes('## Rutina de hoy (1 de 3)') && out.includes('- [x] Hacer resumen del libro') && out.includes('- Asistente virtual — Cierra mañana · 8 oct — https://x.example.com/a'));
clock += 3 * 86400000; assert((await cli('hoy')).includes('vence 2026-10-09 (VENCIDA)')); clock -= 3 * 86400000;
clock += 1000; out = await cli('oportunidad', 'quitar', 'Asistente'); assert(out.includes('Oportunidad quitada: Asistente virtual')); assert.strictEqual(JSON.parse(await cli('oportunidades', '--todas', '--json')).oportunidades.length, 1);
ok('hoy: tareas pendientes, rutina del día, semana y oportunidades que cierran pronto (Markdown y JSON)');

// ---- ingresos: agregar, ver por mes, editar, quitar; viajan cifrados como «books» rt:m:…
clock += 1000; out = await cli('ingreso', 'agregar', 'Ana Pérez', '--monto', '1.250.000', '--fecha', '2026-10-03', '--tipo', 'presencial', '--nota', 'Clase de refuerzo');
assert(/Ingreso añadido m:\w+: Ana Pérez, 2026-10-03, \$1\.250\.000 \(presencial\)/.test(out) && out.includes('Guardado en el servidor'));
clock += 1000; out = await cli('ingreso', 'agregar', 'Tienda Luna', '--monto', '85000'); assert(out.includes('Tienda Luna, 2026-10-07, $85.000 (con claude)'));
clock += 1000; await cli('ingreso', 'agregar', 'Cliente de septiembre', '--monto', '300000', '--fecha', '2026-09-28', '--tipo', 'claude');
out = await cli('ingresos'); assert(out.includes('# Ingresos — octubre 2026') && out.includes('Total: $1.335.000 · 2 trabajos · Con Claude $85.000 · Presencial $1.250.000') && out.includes('**Tienda Luna** — $85.000 — Con Claude') && out.includes('Clase de refuerzo') && !out.includes('septiembre', 30));
assert((await cli('ingresos', '--mes', '2026-09')).includes('Total: $300.000 · 1 trabajo ·')); assert((await cli('ingresos', '--mes', '2026-08')).includes('_No hay ingresos en este mes._'));
const inc = JSON.parse(await cli('ingresos', '--json')); assert.strictEqual(inc.mes, '2026-10'); assert.strictEqual(inc.total, 1335000); assert.strictEqual(inc.ingresos.length, 2); assert.strictEqual(inc.ingresos[1].amount, 1250000);
assert(!/Ana|Luna|1250000|Clase/.test(rows().map((r) => r.id + r.data).join('|'))); assert(rows().some((r) => /^rt:m:/.test(r.id) && r.col === 'books'));
clock += 1000; out = await cli('ingreso', 'editar', 'Luna', '--monto', '95000', '--tipo', 'presencial'); assert(out.includes('Tienda Luna, 2026-10-07, $95.000 (presencial)'));
assert((await cli('ingresos')).includes('Total: $1.345.000 · 2 trabajos · Con Claude $0 · Presencial $1.345.000'));
await assert.rejects(cli('ingreso', 'agregar', 'X'), /Monto inválido/); await assert.rejects(cli('ingreso', 'agregar', 'X', '--monto', 'mucho'), /Monto inválido/); await assert.rejects(cli('ingreso', 'agregar', '--monto', '5'), /Falta el nombre del cliente/);
await assert.rejects(cli('ingreso', 'agregar', 'X', '--monto', '5', '--tipo', 'volando'), /Tipo desconocido/); await assert.rejects(cli('ingreso', 'agregar', 'X', '--monto', '5', '--fecha', '2026-13-01'), /Fecha inválida/);
await assert.rejects(cli('ingresos', '--mes', 'octubre'), /Mes inválido/); await assert.rejects(cli('ingreso', 'editar', 'nadie', '--monto', '5'), /No hay ningún ingreso/); await assert.rejects(cli('ingreso', 'editar', 'Luna'), /Di qué cambiar/); await assert.rejects(cli('ingreso', 'archivar', 'x'), /agregar, editar o quitar/);
await cli('ingreso', 'agregar', 'Ana López', '--monto', '10000'); await assert.rejects(cli('ingreso', 'quitar', 'Ana'), /coincide con varios ingresos/);
const hoy2 = JSON.parse(await cli('hoy', '--json')); assert.deepStrictEqual(hoy2.ingresos, { mes: '2026-10', total: 1355000, trabajos: 3, conClaude: 10000, presencial: 1345000 }); assert((await cli('hoy')).includes('## Ingresos de octubre 2026\n\n$1.355.000 · 3 trabajos'));
clock += 1000; out = await cli('ingreso', 'quitar', 'Ana López'); assert(out.includes('Ingreso quitado: Ana López')); assert((await cli('ingresos')).includes('Total: $1.345.000 · 2 trabajos'));
assert.strictEqual((await cli('oportunidades', '--todas')).includes('Ana'), false); assert((await cli('ver')).includes('Hacer resumen del libro')); // no se mezclan con la rutina ni con las oportunidades
ok('ingresos: agregar, ver por mes (Markdown y JSON), editar y quitar; cifrados como «books» rt:m:…; entran en «hoy»');

// ---- el código: variable de entorno PENDIENTES_CODIGO o archivo local; nunca se imprime; con otro código no se ve nada
const sinCodigo = { ...base, code: undefined, envCode: '' };
await assert.rejects(run(['ver'], { ...sinCodigo, codeFile: join(tmp, 'no-existe.txt') }), /Falta tu código de sincronización[\s\S]*PENDIENTES_CODIGO/);
writeFileSync(join(tmp, 'malo.txt'), 'hola'); await assert.rejects(run(['ver'], { ...sinCodigo, codeFile: join(tmp, 'malo.txt') }), /no contiene un código válido/);
writeFileSync(join(tmp, 'bueno.txt'), '  ' + Sync.formatCode(code).toLowerCase() + '\r\n'); assert((await run(['revisar'], { ...sinCodigo, codeFile: join(tmp, 'bueno.txt') })).includes('3 pendiente(s) y hay 1 oportunidad(es) y 3 ingreso(s).'));
assert((await run(['revisar'], { ...sinCodigo, envCode: Sync.formatCode(code), codeFile: join(tmp, 'malo.txt') })).includes('3 pendiente(s)')); // la variable de entorno manda sobre el archivo
await assert.rejects(run(['ver'], { ...sinCodigo, envCode: 'no-es-un-codigo', codeFile: join(tmp, 'bueno.txt') }), /PENDIENTES_CODIGO no contiene un código válido/);
const otro = Sync.makeCode(crypto.getRandomValues(new Uint8Array(20))); assert((await run(['ver'], { ...base, code: otro })).includes('_Sin pendientes diarios._')); assert((await run(['oportunidades', '--todas'], { ...base, code: otro })).includes('_No hay oportunidades._'));
for (const a of [['ver'], ['revisar'], ['exportar'], ['hoy'], ['oportunidades']]) assert(!(await cli(...a)).includes(code) && !(await cli(...a)).includes(Sync.formatCode(code)));
assert((await run(['ayuda'], {})).includes('node herramientas/rutina.mjs') && (await run(['ayuda'], {})).includes('PENDIENTES_CODIGO'));
ok('el código se toma de PENDIENTES_CODIGO o del archivo local, se valida y nunca se imprime; con otro código no se ve nada');

rmSync(tmp, { recursive: true, force: true });
console.log('todas las pruebas del programa de escritorio pasan');
