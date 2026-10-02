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
console.log('todas las pruebas de sync.js pasan');})();
