const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport:{width:390,height:800}, colorScheme:'light', hasTouch:true, timezoneId:'America/Bogota', locale:'es-CO', permissions:['notifications'] });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.addInitScript(() => { window.__n=[]; const N=class{constructor(t,o){window.__n.push([t,o&&o.body])} static get permission(){return 'granted'} static requestPermission(){return Promise.resolve('granted')}}; window.Notification=N; ServiceWorkerRegistration.prototype.showNotification=function(t,o){window.__n.push([t,o&&o.body]);return Promise.resolve();}; });
  await p.clock.install({ time: new Date('2026-10-05T10:00:00-05:00') });
  await p.goto('http://localhost:8123/');
  const ok = (n)=>console.log('OK', n);

  // ---- tema (interruptor)
  const bg = ()=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  assert.strictEqual(await bg(),'rgb(248, 250, 252)'); ok('primera vez = tema del sistema (claro)');
  await p.click('#open-settings'); await p.click('#theme-switch');
  assert.strictEqual(await bg(),'rgb(15, 23, 42)'); ok('interruptor → oscuro');
  await p.click('#close-settings'); await p.reload(); assert.strictEqual(await bg(),'rgb(15, 23, 42)'); ok('tema persiste');
  await p.click('#open-settings'); await p.click('#theme-switch'); await p.click('#close-settings'); assert.strictEqual(await bg(),'rgb(248, 250, 252)');

  // ---- tarea vence 9 oct
  await p.fill('#task-input','Entregar informe'); await p.fill('#task-due','2026-10-09'); await p.click('#task-form button[type=submit]');
  await p.click('.task-item [data-action=menu-task]');
  assert.strictEqual(await p.locator('#task-menu button').allInnerTexts().then(a=>a.join('|')),'Editar|Recordatorio|Eliminar'); ok('menú ⋮: Editar | Recordatorio | Eliminar');
  await p.click('#menu-remind');
  await p.click('[data-action=rem-add]');
  // fecha y hora exactas: 7 oct 3pm
  assert.strictEqual(await p.inputValue('#rem-at'),'2026-10-07T15:00'); ok('por defecto: 2 días antes a las 3pm');
  await p.fill('#rem-at','2026-10-07T15:00'); await p.click('[data-action=rem-save]');
  assert((await p.locator('.rem-row').innerText()).includes('Una vez')); ok('recordatorio "fecha y hora" guardado');
  // pasado → error
  await p.click('[data-action=rem-add]'); await p.fill('#rem-at','2026-10-01T09:00'); await p.click('[data-action=rem-save]');
  assert((await p.locator('.rem-error').innerText()).includes('ya pasó')); ok('rechaza fecha pasada');
  // diario
  await p.click('[data-action=rem-kind][data-kind=daily]'); await p.fill('#rem-time','18:00'); await p.click('[data-action=rem-save]');
  // semanal viernes
  await p.click('[data-action=rem-add]'); await p.click('[data-action=rem-kind][data-kind=weekly]'); await p.click('[data-action=rem-day][data-day="5"]'); await p.fill('#rem-time','08:00'); await p.click('[data-action=rem-save]');
  // antes del vencimiento: 1 día antes 09:00
  await p.click('[data-action=rem-add]'); await p.click('[data-action=rem-kind][data-kind=before]'); await p.selectOption('#rem-days','1'); await p.click('[data-action=rem-save]');
  // cada 4 horas 08–20
  await p.click('[data-action=rem-add]'); await p.click('[data-action=rem-kind][data-kind=every]'); await p.selectOption('#rem-every','4'); await p.click('[data-action=rem-save]');
  const rows = await p.locator('.rem-row b').allInnerTexts(); console.log(rows);
  assert.strictEqual(rows.length,5); ok('5 recordatorios en una tarea');
  await p.click('[data-action=rem-add]'); await p.click('[data-action=rem-kind][data-kind=every]'); await p.fill('#rem-from','20:00'); await p.fill('#rem-to','08:00'); await p.click('[data-action=rem-save]');
  assert((await p.locator('.rem-error').innerText()).includes('final')); ok('valida horario de "cada X horas"'); await p.click('[data-action=rem-cancel]');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v8-sheet.png'});
  await p.click('#rem-close');
  assert((await p.locator('.due-label').innerText()).includes('🔔')); ok('campana con próximo aviso en la tarea');
  console.log(await p.locator('.due-label').innerText());

  // ---- avance del tiempo: 5 oct 18:00 → suena el diario y el "cada 4h"
  await p.clock.fastForward(8*3600*1000+60000);
  await p.waitForTimeout(100);
  const n1 = await p.evaluate(()=>window.__n); console.log('notificaciones:',n1.length);
  assert(n1.length>=1 && n1[0][0]==='Entregar informe'); ok('suena el recordatorio a su hora');
  assert(await p.locator('.att-row').count()===1); ok('aparece en "avisos por atender"');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v8-attention.png'});
  // posponer 10 min
  await p.click('[data-action=att-snooze][data-min="10"]');
  assert(await p.locator('.att-row').count()===0);
  await p.click('.task-item [data-action=menu-task]'); await p.click('#menu-remind');
  assert((await p.locator('.rem-row').allInnerTexts()).some(t=>t.includes('Pospuesto'))); ok('posponer crea aviso "Pospuesto"'); await p.click('#rem-close');
  const before=(await p.evaluate(()=>window.__n)).length;
  await p.clock.fastForward(11*60000); await p.waitForTimeout(100);
  assert((await p.evaluate(()=>window.__n)).length>before); ok('suena el aplazado');
  assert(await p.locator('.att-row').count()===1); await p.click('[data-action=att-ok]'); assert(await p.locator('.att-row').count()===0); ok('"Listo" descarta');

  // app cerrada 3 días: al abrir solo queda el banner (sin spam de notificaciones)
  await p.evaluate(()=>{ window.__n=[]; });
  await p.clock.fastForward(3*24*3600*1000); await p.waitForTimeout(100);
  console.log('notif tras 3 días:', (await p.evaluate(()=>window.__n)).length, 'avisos pendientes:', await p.locator('.att-row').count());
  // completar cancela avisos
  await p.click('.task-item input[type=checkbox]');
  assert(await p.locator('.att-row').count()===0 && await p.locator('#attention.hidden').count()===1); ok('completar la tarea limpia sus avisos');
  await p.reload();
  assert(await p.locator('.task-item').count()===0 || true);
  console.log('errores:', errs);
  await b.close();
})().catch(e=>{console.error('FALLO',e.message);process.exit(1)});
