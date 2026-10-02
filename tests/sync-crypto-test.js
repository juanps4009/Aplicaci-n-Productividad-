const ROOT = require('path').join(__dirname, '..');
const S=require(ROOT + '/sync.js'); const assert=require('assert');
const { webcrypto } = require('node:crypto'); globalThis.crypto ??= webcrypto;
(async()=>{
 const code='K7QM-2XPD-9RVA-4HNT-B3WE'; const key=await S.deriveKey(code);
 const c=await S.encryptText(key,'{"text":"Comprar leche ñ ✓"}','t1|tasks'); assert(c.startsWith('e1:'));
 assert.strictEqual(await S.decryptText(key,c,'t1|tasks'),'{"text":"Comprar leche ñ ✓"}');
 assert.strictEqual(await S.decryptText(key,c,'t2|tasks'),null,'AAD distinto → falla');
 assert.strictEqual(await S.decryptText(await S.deriveKey('AAAA-AAAA-AAAA-AAAA-AAAA'),c,'t1|tasks'),null,'otra clave → falla');
 assert.strictEqual(await S.decryptText(key,c.slice(0,-3)+'xxx','t1|tasks'),null,'alterado → falla');
 assert.strictEqual(await S.decryptText(key,'{"viejo":1}','x|y'),'{"viejo":1}','texto plano antiguo se acepta');
 assert.notStrictEqual(await S.encryptText(key,'a','x'),await S.encryptText(key,'a','x'),'IV aleatorio');
 assert.strictEqual(await S.deriveKey('k7qm2xpd9rva4hntb3we').then(k=>webcrypto.subtle.exportKey('raw',k)).then(b=>Buffer.from(b).toString('hex')), Buffer.from(await webcrypto.subtle.exportKey('raw',key)).toString('hex'),'mismo código en otro formato → misma clave');
 const raw=Buffer.from(await webcrypto.subtle.exportKey('raw',key)).toString('hex');
 // vector para la prueba cruzada con Java
 const fixed=await S.encryptText(key,'{"text":"Vector Java ñ","priority":"high"}','vec1|tasks');
 console.log(JSON.stringify({code,keyHex:raw,cipher:fixed,aad:'vec1|tasks',plain:'{"text":"Vector Java ñ","priority":"high"}'}));
 console.error('OK cifrado extremo a extremo (Node)');
})();
