const { chromium } = require('playwright'); const assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const ctx=await b.newContext({viewport:{width:390,height:800}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const many=Array.from({length:14},(_,i)=>({id:'t'+i,text:'Tarea '+i,done:i===13,priority:'medium',due:'',reminders:[],doc:[]}));
await p.addInitScript((m)=>{ if(localStorage.getItem('x'))return; localStorage.setItem('x','1'); localStorage.setItem('prod.tasks',JSON.stringify(m)); localStorage.setItem('prod.tab','books'); localStorage.setItem('prod.filter','done'); },many);
await p.goto('http://localhost:8123/#task=t9'); await p.waitForTimeout(700);
assert.strictEqual(await p.locator('.nav-btn.active').getAttribute('data-tab'),'tasks'); assert.strictEqual(await p.evaluate(()=>location.hash),'');
const vis=await p.evaluate(()=>{const e=document.querySelector('li[data-id="t9"]');const r=e.getBoundingClientRect();return {flash:e.classList.contains('flash'),inView:r.top>0&&r.bottom<innerHeight}}); assert(vis.flash&&vis.inView); console.log('OK abre Pendientes (venía de Resúmenes con filtro "completadas"), muestra y resalta la tarea');
// tarea completada en grupo plegado
await p.evaluate(()=>{location.hash='#task=t13'}); await p.waitForTimeout(700);
assert(await p.evaluate(()=>document.querySelector('li[data-id="t13"]')?.classList.contains('flash'))); console.log('OK hashchange con la app abierta: abre el grupo "Completadas" plegado y resalta');
// id inexistente: no rompe
await p.evaluate(()=>{location.hash='#task=nope'}); await p.waitForTimeout(300); console.log('OK id inexistente ignorado, errores:',errs);
await b.close();})();
