const ROOT = require('path').join(__dirname, '..');
const fs=require('fs'); const vm=require('vm'); const assert=require('assert'); const { webcrypto } = require('node:crypto');
const S=require(ROOT + '/sync.js'); globalThis.crypto ??= webcrypto;
(async()=>{
 const raw=webcrypto.getRandomValues(new Uint8Array(32)); const key=await S.importRawKey(raw); const tag='r-abc-123';
 const cipher=await S.encryptText(key,JSON.stringify({t:'Entregar informe ñ',b:'Vence Hoy'}),tag);
 async function run(payload, idbKey, visible){
   const listeners={}; const shown=[];
   const fakeIDB={ open(){ const req={}; setTimeout(()=>{ const db={ close(){}, transaction(){ return { objectStore(){ return { get(){ const g={}; setTimeout(()=>{ g.result=idbKey; g.onsuccess&&g.onsuccess(); },0); return g; } }; } }; } }; req.result=db; req.onsuccess&&req.onsuccess(); },0); return req; } };
   const sandbox={ self:{ addEventListener:(n,f)=>{listeners[n]=f}, clients:{ matchAll:async()=> visible?[{visibilityState:'visible'}]:[] , openWindow(){}}, registration:{ showNotification:async(t,o)=>{shown.push([t,o.body,o.tag])} }, Sync:S }, importScripts(){}, indexedDB:fakeIDB, caches:{}, fetch(){}, URL, location:{origin:'x'}, console, setTimeout, Promise };
   sandbox.self.skipWaiting=()=>{}; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(ROOT + '/sw.js','utf8').replace(/self\.Sync/g,'Sync'),Object.assign(sandbox,{Sync:S}));
   let p; listeners.push({ data:{ json:()=>payload }, waitUntil:(x)=>{p=x} }); await p; return shown;
 }
 assert.deepStrictEqual(await run({title:cipher,body:'',tag},raw,false),[['Entregar informe ñ','Vence Hoy',tag]]); console.log('OK el service worker descifra el aviso con la clave del dispositivo');
 assert.deepStrictEqual((await run({title:cipher,body:'',tag},webcrypto.getRandomValues(new Uint8Array(32)),false))[0].slice(0,2),['Tienes un recordatorio','Abre la app para verlo.']); console.log('OK clave incorrecta → aviso genérico, sin romper');
 assert.deepStrictEqual((await run({title:cipher,body:'',tag},undefined,false))[0][0],'Tienes un recordatorio'); console.log('OK sin clave guardada → aviso genérico');
 assert.deepStrictEqual(await run({title:'Aviso viejo',body:'texto',tag:'t'},raw,false),[['Aviso viejo','texto','t']]); console.log('OK formato antiguo (sin cifrar) sigue funcionando');
 assert.deepStrictEqual(await run({title:cipher,body:'',tag},raw,true),[]); console.log('OK con la app a la vista no duplica');
})().catch(e=>{console.error('FALLO',e);process.exit(1)});
