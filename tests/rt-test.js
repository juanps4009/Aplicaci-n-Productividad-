// Pruebas de richtext.js (texto con formato): lógica pura, sin navegador
const assert = require('assert');
const RT = require('../richtext.js');
const ok = (m) => console.log('OK', m);
const M = (text, marks = []) => ({ text, marks });

// limpiar: solo colores #rrggbb y tamaños conocidos; tramos fuera de rango se recortan; se juntan vecinos
assert.deepStrictEqual(RT.clean('hola', [{ s: 0, e: 2, b: 1 }, { s: 2, e: 4, b: 1 }]), [{ s: 0, e: 4, b: 1 }]);
assert.deepStrictEqual(RT.clean('hola', [{ s: 0, e: 99, c: '#FF0000' }]), [{ s: 0, e: 4, c: '#ff0000' }]);
assert.deepStrictEqual(RT.clean('hola', [{ s: 0, e: 4, c: 'red', h: 'url(x)', u: '#12', z: 7, b: 0 }]), []);
assert.deepStrictEqual(RT.clean('hola', 'basura'), []); assert.deepStrictEqual(RT.clean('hola', [null, 5, { s: 3, e: 1, b: 1 }]), []);
ok('clean: solo se aceptan colores #rrggbb y tamaños conocidos, recorta y junta tramos');

// formato sobre un rango
let m = RT.format(M('Hola mundo'), 5, 10, { b: true });
assert.deepStrictEqual(m.marks, [{ s: 5, e: 10, b: 1 }]);
m = RT.format(m, 0, 4, { c: '#dc2626', z: 2 }); assert.strictEqual(m.marks.length, 2);
m = RT.format(m, 2, 7, { u: '#2563eb', h: '#ca8a04' });
assert.deepStrictEqual(RT.clean(m.text, m.marks).map((x) => [x.s, x.e]), [[0, 2], [2, 4], [4, 5], [5, 7], [7, 10]]);
assert(RT.every(RT.format(M('abc'), 0, 3, { b: true }), 0, 3, 'b')); assert(!RT.every(RT.format(M('abc'), 0, 2, { b: true }), 0, 3, 'b'));
assert(RT.every(RT.format(M('abc'), 0, 3, { z: 1 }), 0, 3, 'z', 1)); assert(!RT.every(M('abc'), 0, 3, 'b'));
m = RT.format(RT.format(M('abc'), 0, 3, { b: true, c: '#dc2626' }), 1, 2, { b: false, c: null }); assert.deepStrictEqual(m.marks, [{ s: 0, e: 1, b: 1, c: '#dc2626' }, { s: 2, e: 3, b: 1, c: '#dc2626' }]);
m = RT.format(RT.format(M('abc'), 0, 3, { z: 2 }), 0, 3, { z: 0 }); assert.deepStrictEqual(m.marks, []);
ok('format: negrita, color, resaltado, subrayado y tamaño por tramos; quitar formato');

// cortar y unir (Enter y Retroceso en el editor)
const base = RT.format(M('Hola mundo'), 5, 10, { b: true, c: '#16a34a' });
const left = RT.slice(base, 0, 7), right = RT.slice(base, 7, 10);
assert.deepStrictEqual(left, { text: 'Hola mu', marks: [{ s: 5, e: 7, b: 1, c: '#16a34a' }] });
assert.deepStrictEqual(right, { text: 'ndo', marks: [{ s: 0, e: 3, b: 1, c: '#16a34a' }] });
assert.deepStrictEqual(RT.concat(left, right), base); ok('slice/concat: dividir y volver a unir un bloque conserva el formato');

// reemplazar: escribir dentro de un tramo lo hereda, en el borde no
m = RT.replace(base, 7, 7, 'XX'); assert.strictEqual(m.text, 'Hola muXXndo'); assert.deepStrictEqual(m.marks, [{ s: 5, e: 12, b: 1, c: '#16a34a' }]);
m = RT.replace(base, 5, 5, 'XX'); assert.deepStrictEqual(m.marks, [{ s: 7, e: 12, b: 1, c: '#16a34a' }]);
m = RT.replace(base, 10, 10, '!'); assert.deepStrictEqual(m.marks, [{ s: 5, e: 10, b: 1, c: '#16a34a' }]);
m = RT.replace(base, 3, 8, ''); assert.strictEqual(m.text, 'Holdo'); assert.deepStrictEqual(m.marks, [{ s: 3, e: 5, b: 1, c: '#16a34a' }]);
m = RT.replace(M('abc'), 1, 2, 'xyz'); assert.strictEqual(m.text, 'axyzc'); ok('replace: insertar, borrar y heredar formato dentro de un tramo');

// recortar espacios
m = RT.trim(RT.format(M('  hola  '), 2, 6, { b: true })); assert.deepStrictEqual(m, { text: 'hola', marks: [{ s: 0, e: 4, b: 1 }] });
assert.deepStrictEqual(RT.trim(M('   ')), { text: '', marks: [] }); ok('trim ajusta los tramos');

// palabra bajo el cursor
assert.deepStrictEqual(RT.wordAt('Hola mundo', 2), [0, 4]); assert.deepStrictEqual(RT.wordAt('Hola mundo', 4), [0, 4]); assert.deepStrictEqual(RT.wordAt('Hola mundo', 5), [5, 10]);
assert.deepStrictEqual(RT.wordAt('canción', 3), [0, 7]); assert.strictEqual(RT.wordAt('a  b', 2), null); assert.strictEqual(RT.wordAt('', 0), null); ok('wordAt: palabra bajo el cursor (con acentos)');

// HTML: escapado y solo estilos válidos
const h = RT.toHTML('a<b>&"', [{ s: 0, e: 6, b: 1, c: '#dc2626' }]);
assert(h.includes('&lt;b&gt;&amp;&quot;')); assert(!h.includes('<b>')); assert(h.includes('color:#dc2626') && h.includes('font-weight:700') && h.includes('data-c="#dc2626"'));
assert.strictEqual(RT.toHTML('hola', []), 'hola'); assert.strictEqual(RT.toHTML('', [{ s: 0, e: 3, b: 1 }]), '');
const evil = RT.toHTML('x', [{ s: 0, e: 1, c: '#fff;background:url(javascript:alert(1))', z: '2;x' }]); assert(!evil.includes('<span'));
assert(RT.toHTML('a\nb', [], { nl: true }).includes('<br>')); assert(RT.toHTML('hola', [{ s: 0, e: 4, h: '#2563eb' }]).includes('rgba(37,99,235,.32)'));
assert(RT.toHTML('hola', [{ s: 0, e: 4, u: '#2563eb', z: -1 }]).includes('text-decoration-color:#2563eb') && RT.toHTML('hola', [{ s: 0, e: 4, z: -1 }]).includes('font-size:0.85em'));
ok('toHTML: escapa el texto, solo escribe estilos válidos y descarta los trucos');

console.log('todas las pruebas de richtext.js pasan');
