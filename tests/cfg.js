const { chromium } = require('playwright'); const assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const p=await (await b.newContext({viewport:{width:390,height:800}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.route('https://avisos-productividad.juanrincon-oy.workers.dev/**', r=>r.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({records:[],seq:0,more:false})}));
await p.goto('http://localhost:8123/'); await p.click('#open-settings'); await p.waitForSelector('[data-action=sync-create]');
assert.strictEqual(await p.locator('#server-adv').evaluate(e=>e.open),false); assert((await p.locator('#server-status').textContent()).includes('servidor de la app'));
await p.click('[data-action=sync-create]'); await p.waitForSelector('.code-box'); await p.waitForFunction(()=>/Sincronizado/.test(document.querySelector('#sync-body').innerText));
console.log('OK con tu dirección en config.js: «Crear código nuevo» funciona sin configurar nada, errores:',errs); await b.close();})();
