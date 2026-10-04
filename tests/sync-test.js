const ROOT = require('path').join(__dirname, '..');
const S=require(ROOT + '/sync.js'); const assert=require('assert');
const { webcrypto } = require('node:crypto'); globalThis.crypto ??= webcrypto;
// códigos
const code=S.makeCode(webcrypto.getRandomValues(new Uint8Array(20))); assert(S.isValidCode(code)); assert.strictEqual(S.formatCode(code).length,24);
assert.strictEqual(S.normalizeCode('k7qm-2xpd 9rva_4hnt-0o1i'.toLowerCase()),'K7QM2XPD9RVA4HNT001'+'1'); assert.strictEqual(S.isValidCode(S.normalizeCode(S.formatCode(code).toLowerCase())),true);
(async()=>{ const a=await S.spaceId(code), b=await S.spaceId(S.formatCode(code).toLowerCase()); assert.strictEqual(a,b); assert.strictEqual(a.length,64); assert.notStrictEqual(a,await S.spaceId(S.makeCode(webcrypto.getRandomValues(new Uint8Array(20)))));
// --- dispositivos A y B
const dev=()=>({tasks:[],books:[],tombs:[],tr:S.newTracker()});
const A=dev(), B=dev();
const edit=(d,now)=>{ S.stampChanges('tasks',d.tasks,d.tr,d.tombs,now); S.stampChanges('books',d.books,d.tr,d.tombs,now); };
// A crea tarea
A.tasks.push({id:'t1',text:'Hola',done:false}); edit(A,1000);
assert.strictEqual(A.tasks[0].updatedAt,1000);
let push=S.collectPush(A.tasks,A.books,A.tombs,0); assert.strictEqual(push.length,1);
// sin cambios no se re-estampa
edit(A,2000); assert.strictEqual(A.tasks[0].updatedAt,1000);
// B recibe
let r=S.mergeIncoming('tasks',B.tasks,push,B.tr,B.tombs,new Set()); assert(r.changed); assert.strictEqual(B.tasks[0].text,'Hola'); assert.strictEqual(B.tasks[0].updatedAt,1000);
edit(B,3000); assert.strictEqual(B.tasks[0].updatedAt,1000); // lo recibido no cuenta como cambio propio
assert.strictEqual(S.collectPush(B.tasks,B.books,B.tombs,1000).length,0);
// LWW: ambos editan; B después
A.tasks[0].text='Hola A'; edit(A,4000); B.tasks[0].text='Hola B'; edit(B,5000);
S.mergeIncoming('tasks',A.tasks,S.collectPush(B.tasks,[],B.tombs,1000),A.tr,A.tombs,new Set()); assert.strictEqual(A.tasks[0].text,'Hola B');
S.mergeIncoming('tasks',B.tasks,S.collectPush(A.tasks,[],A.tombs,0).map(x=>({...x,updatedAt:4000,data:JSON.stringify({id:'t1',text:'Hola A',updatedAt:4000})})),B.tr,B.tombs,new Set()); assert.strictEqual(B.tasks[0].text,'Hola B'); // más viejo no gana
// borrado en A se propaga; tombstone
A.tasks=[]; edit(A,6000); assert.deepStrictEqual(A.tombs.map(t=>[t.id,t.updatedAt]),[['t1',6000]]);
push=S.collectPush(A.tasks,A.books,A.tombs,5500); assert(push[0].deleted===1);
r=S.mergeIncoming('tasks',B.tasks,push,B.tr,B.tombs,new Set()); assert(r.changed); assert.strictEqual(B.tasks.length,0);
// un registro viejo no resucita lo borrado
S.mergeIncoming('tasks',B.tasks,[{id:'t1',col:'tasks',updatedAt:5000,deleted:0,data:JSON.stringify({id:'t1',text:'zombi'})}],B.tr,B.tombs,new Set()); assert.strictEqual(B.tasks.length,0);
// pero uno más nuevo que el borrado sí (se volvió a editar después)
S.mergeIncoming('tasks',B.tasks,[{id:'t1',col:'tasks',updatedAt:7000,deleted:0,data:JSON.stringify({id:'t1',text:'vuelve'})}],B.tr,B.tombs,new Set()); assert.strictEqual(B.tasks[0].text,'vuelve'); assert.strictEqual(B.tombs.length,0);
// en edición: se difiere
const busy=new Set(['t1']); r=S.mergeIncoming('tasks',B.tasks,[{id:'t1',col:'tasks',updatedAt:9000,deleted:0,data:JSON.stringify({id:'t1',text:'nuevo'})}],B.tr,B.tombs,busy);
assert.strictEqual(r.deferred.length,1); assert.strictEqual(B.tasks[0].text,'vuelve');
// unión de datos previos (ids distintos)
const C=dev(); C.tasks.push({id:'c1',text:'de C'}); edit(C,100);
S.mergeIncoming('tasks',C.tasks,[{id:'t9',col:'tasks',updatedAt:50,deleted:0,data:JSON.stringify({id:'t9',text:'de B'})}],C.tr,C.tombs,new Set()); assert.strictEqual(C.tasks.length,2);
// borradores isNew no se sincronizan
const D=dev(); D.books.push({id:'b1',title:'x',isNew:true}); edit(D,1); assert.strictEqual(S.collectPush([],D.books,D.tombs,0).length,0); assert.strictEqual(D.tombs.length,0);
delete D.books[0].isNew; edit(D,2); assert.strictEqual(S.collectPush([],D.books,D.tombs,0).length,1);
// prime: legado sin updatedAt
const E=dev(); E.tasks.push({id:'l1',text:'legado'}); S.prime('tasks',E.tasks,E.tr,777); assert.strictEqual(E.tasks[0].updatedAt,777); edit(E,900); assert.strictEqual(E.tasks[0].updatedAt,777);
// purga
assert.strictEqual(S.purgeTombs([{updatedAt:0},{updatedAt:Date.now()}],Date.now(),60).length,1);
// --- pendientes de subir (dirty): no dependen del reloj
const F=dev(); F.tasks.push({id:'f1',text:'uno'}); F.books.push({id:'fb',title:'libro'}); edit(F,10000);
assert.deepStrictEqual(Object.keys(F.tr.dirty).sort(),['books:fb','tasks:f1']);
// el reloj retrocede (lastPushAt quedó en el "futuro"): antes no se subía, ahora sí
F.tasks[0].text='dos'; edit(F,500); assert.strictEqual(F.tasks[0].updatedAt,10001);
let up=S.collectPush(F.tasks,F.books,F.tombs,99999,F.tr); assert.deepStrictEqual(up.map(x=>x.id).sort(),['f1','fb']);
// subida correcta: se limpia; lo que cambió mientras se subía sigue pendiente
F.books[0].title='libro 2'; edit(F,600); assert.strictEqual(F.tr.dirty['books:fb'],10001);
S.clearPushed(F.tr,up); assert.deepStrictEqual(Object.keys(F.tr.dirty),['books:fb']);
up=S.collectPush(F.tasks,F.books,F.tombs,99999,F.tr); assert.deepStrictEqual(up.map(x=>x.id),['fb']); S.clearPushed(F.tr,up); assert.deepStrictEqual(F.tr.dirty,{});
assert.strictEqual(S.collectPush(F.tasks,F.books,F.tombs,99999,F.tr).length,0);
// borrado: queda pendiente hasta subirlo
F.tasks=[]; edit(F,700); up=S.collectPush(F.tasks,F.books,F.tombs,99999,F.tr); assert(up.length===1&&up[0].deleted===1&&up[0].id==='f1'); S.clearPushed(F.tr,up); assert.deepStrictEqual(F.tr.dirty,{});
// lo que llega y reemplaza lo local deja de estar pendiente
F.books[0].title='libro 3'; edit(F,800); assert(F.tr.dirty['books:fb']!==undefined);
S.mergeIncoming('books',F.books,[{id:'fb',col:'books',updatedAt:50000,deleted:0,data:JSON.stringify({id:'fb',title:'de otro'})}],F.tr,F.tombs,new Set()); assert.strictEqual(F.books[0].title,'de otro'); assert.deepStrictEqual(F.tr.dirty,{});
// compatibilidad: sin lista de pendientes sigue valiendo «modificado después de la última subida»
assert.strictEqual(S.collectPush(F.tasks,F.books,F.tombs,0).length,2); assert.strictEqual(S.collectPush(F.tasks,F.books,F.tombs,0,S.newTracker()).length,2);
console.log('OK pendientes de subir: reloj que retrocede, cambios durante la subida, borrados, reemplazo por lo que llega');
console.log('todas las pruebas de sync.js pasan');})();
