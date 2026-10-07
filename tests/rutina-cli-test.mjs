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

// ---- sin archivo de código, o con otro código, no hay acceso
await assert.rejects(run(['ver'], { ...base, code: undefined, codeFile: join(tmp, 'no-existe.txt') }), /Falta el archivo con tu código/);
writeFileSync(join(tmp, 'malo.txt'), 'hola'); await assert.rejects(run(['ver'], { ...base, code: undefined, codeFile: join(tmp, 'malo.txt') }), /no contiene un código válido/);
writeFileSync(join(tmp, 'bueno.txt'), '  ' + Sync.formatCode(code).toLowerCase() + '\r\n'); assert((await run(['revisar'], { ...base, code: undefined, codeFile: join(tmp, 'bueno.txt') })).includes('3 pendiente(s)'));
const otro = Sync.makeCode(crypto.getRandomValues(new Uint8Array(20))); assert((await run(['ver'], { ...base, code: otro })).includes('_Sin pendientes diarios._'));
for (const a of [['ver'], ['revisar'], ['exportar']]) assert(!(await cli(...a)).includes(code) && !(await cli(...a)).includes(Sync.formatCode(code)));
assert((await run(['ayuda'], {})).includes('node herramientas/rutina.mjs'));
ok('el código se lee de un archivo local, se valida y nunca se imprime; con otro código no se ve nada');

rmSync(tmp, { recursive: true, force: true });
console.log('todas las pruebas del programa de escritorio pasan');
