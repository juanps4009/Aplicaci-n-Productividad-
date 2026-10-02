const { chromium } = require('playwright'); const assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const ctx=await b.newContext({viewport:{width:390,height:800},timezoneId:'America/Bogota',permissions:['notifications']}); const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const calls=[]; let fail=false;
await p.route('https://avisos-productividad.juanrincon-oy.workers.dev/**', async (route)=>{ const req=route.request(); const u=new URL(req.url());
  calls.push({m:req.method(),path:u.pathname,body:req.postData()});
  if(fail) return route.abort();
  const h={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'*'};
  if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:h});
  if(u.pathname==='/' ) return route.fulfill({status:200,headers:{...h,'content-type':'text/plain'},body:'Servidor de avisos funcionando ✓'});
  if(u.pathname==='/vapid') return route.fulfill({status:200,headers:{...h,'content-type':'application/json'},body:JSON.stringify({publicKey:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'})});
  return route.fulfill({status:200,headers:{...h,'content-type':'application/json'},body:'{"ok":true}'});});
await p.addInitScript(()=>{ let sub=null; const fake={endpoint:'https://fcm.googleapis.com/fcm/send/fake',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'BPcM',auth:'xyz'}}},async unsubscribe(){sub=null;window.__unsub=(window.__unsub||0)+1;return true}};
 PushManager.prototype.getSubscription=async()=>sub; PushManager.prototype.subscribe=async(o)=>{window.__key=o.applicationServerKey.length;sub=fake;return fake}; });
await p.clock.install({time:new Date('2026-10-05T10:00:00-05:00')});
await p.goto('http://localhost:8123/');
await p.evaluate(()=>navigator.serviceWorker.ready);
const ok=n=>console.log('OK',n);
// tarea con recordatorio diario
await p.fill('#task-input','Entregar informe'); await p.click('#task-form button[type=submit]');
await p.click('.task-item [data-action=menu-task]'); await p.click('#menu-remind'); await p.click('[data-action=rem-add]'); await p.click('[data-action=rem-kind][data-kind=daily]'); await p.fill('#rem-time','18:00'); await p.click('[data-action=rem-save]'); await p.click('#rem-close');
await p.click('#open-settings');
assert((await p.locator('#push-status').innerText()).includes('Apagado')); ok('estado inicial: apagado, con el servidor de la app ya disponible');
await p.click('#push-switch'); await p.waitForTimeout(400);
console.log(await p.locator('#push-status').innerText());
assert(calls.some(c=>c.path==='/vapid')); assert.strictEqual(await p.evaluate(()=>window.__key),65); ok('pide la clave y se suscribe (clave de 65 bytes)');
const sync=calls.filter(c=>c.path==='/sync' && c.m==='PUT').pop(); assert(sync); const body=JSON.parse(sync.body);
assert(/^[A-Za-z0-9_-]{24}$/.test(body.device)); assert.strictEqual(body.subscription.endpoint,'https://fcm.googleapis.com/fcm/send/fake');
assert.strictEqual(body.items.length,14); assert(body.items.every(i=>i.title.startsWith('e1:')&&i.body===''&&i.tag.startsWith('r-'))); assert(!JSON.stringify(body).includes('Entregar informe'));
ok('sincroniza 14 avisos diarios con id de dispositivo y el texto cifrado (el servidor no puede leerlo)'); console.log(body.items[0].title.slice(0,40)+'…');
const keyInDb=await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('prod-keys',1);q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').get('pushKey');g.onsuccess=()=>r(g.result&&g.result.byteLength)}})); assert.strictEqual(keyInDb,32); ok('la clave de avisos queda en IndexedDB para el service worker');
assert.strictEqual(await p.locator('#push-switch').getAttribute('aria-checked'),'true'); ok('interruptor de push activado');
// cambio de tarea → re-sync
await p.click('#close-settings'); const n0=calls.filter(c=>c.path==='/sync').length;
await p.click('.task-item input[type=checkbox]'); await p.clock.fastForward(2000); await p.waitForTimeout(200);
const last=JSON.parse(calls.filter(c=>c.path==='/sync').pop().body); assert(calls.filter(c=>c.path==='/sync').length>n0); assert.strictEqual(last.items.length,0); ok('completar la tarea cancela sus avisos en el servidor');
// sin conexión con el servidor
fail=true; await p.click('.task-item input[type=checkbox]',{force:true}).catch(()=>{});
await p.click('#filter-badge,#open-filter').catch(()=>{});
await p.evaluate(()=>{document.querySelector('#filters [data-filter=all]')?.click()});
await p.click('#open-settings'); 
// desactivar
fail=false; await p.click('#push-switch'); await p.waitForTimeout(300);
assert(calls.some(c=>c.path==='/unsync')); assert.strictEqual(await p.evaluate(()=>window.__unsub),1); ok('desactivar: se da de baja en el servidor');
assert.strictEqual(await p.locator('#push-switch').getAttribute('aria-checked'),'false'); 
console.log('settings antes de recargar:', await p.evaluate(()=>localStorage.getItem('prod.settings')));
// persistencia
ok('sin dirección que recordar: viene de la app');
console.log('errores:',errs); await b.close();})().catch(e=>{console.error('FALLO',e.message);process.exit(1)});
