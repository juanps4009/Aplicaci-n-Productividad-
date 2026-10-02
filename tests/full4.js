const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await b.newContext({ viewport:{width:390,height:800}, colorScheme:'dark', hasTouch:true });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.addInitScript(() => { if(!localStorage.getItem('prod.tasks')) {
    localStorage.setItem('prod.tasks', JSON.stringify([{id:'t1',text:'Estudiar C3',done:false,priority:'high',due:'',notified:false,doc:[{id:'a',type:'p',text:'Ver diapositivas'},{id:'b',type:'p',text:'Hacer ejercicios'}]}]));
    localStorage.setItem('prod.books', JSON.stringify([{id:'b1',title:'Viejo',author:'Autor A',template:'free',doc:[{id:'e1',type:'h1',text:'Cap 1'},{id:'e2',type:'p',text:'hola'},{id:'e3',type:'h1',text:'Cap 2'}],collapsed:false}]));
  }});
  await p.goto('http://localhost:8123/');
  const ok = (n)=>console.log('OK', n);
  // tareas: nada de notas afuera
  assert(await p.locator('.note-preview').count()===0);
  assert(!(await p.locator('#task-groups').innerText()).includes('Ver diapositivas')); ok('el texto de la nota no se ve afuera');
  assert(await p.locator('.task-item .has-notes').count()===1); ok('icono de libreta marcado');
  await p.click('.task-item [data-action=notes-task]');
  assert((await p.locator('#notes-editor .blk').count())===2); ok('notas cargadas');
  await p.click('#notes-editor .blk:last-child'); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await p.keyboard.type('/titulo');
  assert(await p.locator('#slash-menu:not(.hidden)').count()===1); ok('comando "/" disponible en notas'); await p.keyboard.press('Enter'); await p.keyboard.type('Mi título');
  await p.waitForTimeout(400); await p.click('#notes-back');
  await p.reload(); await p.click('.task-item [data-action=notes-task]');
  assert((await p.$$eval('#notes-editor .blk',e=>e.map(x=>x.dataset.type+':'+x.textContent))).includes('h1:Mi título')); ok('título persiste'); await p.click('#notes-back');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v5-tasks.png'});

  // libros: lista compacta
  await p.click('.nav-btn[data-tab=books]');
  assert(await p.locator('.dot-rail').count()===0); assert(await p.locator('#book-list .blk').count()===0); ok('lista no muestra contenido');
  assert((await p.locator('.book-row-author').innerText())==='Autor A'); ok('autor pequeño en la esquina');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v5-list.png'});
  await p.click('.book-open');
  assert(await p.locator('#book-page:not(.hidden)').count()===1);
  assert(await p.locator('#book-page .dot-rail button').count()===2); ok('al entrar: resumen completo con puntos');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v5-page.png'});
  await p.click('#book-back'); assert(await p.locator('#book-page.hidden').count()===1); ok('volver');

  // crear libro nuevo
  await p.click('#new-book');
  assert(await p.locator('#book-page:not(.hidden) [data-field=title]').count()===1); ok('nuevo libro abre página en edición');
  await p.fill('[data-field=title]','Hábitos atómicos'); await p.fill('[data-field=author]','James Clear');
  await p.click('[data-action=template][data-value=free]'); await p.click('#book-detail .editor .blk');
  await p.keyboard.type('/titulo'); await p.keyboard.press('Enter'); await p.keyboard.type('Introducción'); await p.keyboard.press('Enter');
  for (let i=0;i<10;i++){ await p.keyboard.type('Las pequeñas mejoras se acumulan con el tiempo. '.repeat(4)); await p.keyboard.press('Enter'); }
  await p.keyboard.type('/titulo'); await p.keyboard.press('Enter'); await p.keyboard.type('Conclusión'); await p.keyboard.press('Enter'); await p.keyboard.type('Sistemas sobre metas.');
  await p.click('[data-action=save]');
  assert(await p.locator('#book-page:not(.hidden) .dot-rail button').count()===2); ok('guardar deja la página en vista');
  await p.click('#book-page .dot-rail button:nth-child(2)'); await p.waitForTimeout(1200);
  console.log('activo:', await p.$eval('#book-page .dot-rail button.active', e=>e.getAttribute('aria-label')));
  assert(await p.evaluate(()=>document.querySelector('#book-page').scrollTop)>200); ok('punto hace scroll dentro de la página');
  await p.screenshot({path:'' + require('os').tmpdir() + '/v5-page2.png'});
  // editar y cancelar
  await p.evaluate(()=>document.querySelector('#book-page').scrollTop=0);
  await p.click('#book-bar-actions [data-action=edit]');
  assert(await p.locator('#book-back.hidden').count()===1);
  await p.click('[data-action=cancel]');
  assert(await p.locator('#book-page:not(.hidden) .page-title').count()===1); ok('cancelar edición vuelve a la vista');
  await p.click('#book-back');
  assert(await p.locator('.book-card').count()===2); ok('lista con 2 libros');
  // eliminar
  await p.click('.book-card:has-text("Hábitos") .book-open');
  await p.click('#book-bar-actions [data-action=delete]'); 
  assert(await p.locator('#confirm:not(.hidden)').count()===1);
  await p.click('#confirm-ok');
  assert(await p.locator('.book-card').count()===1 && await p.locator('#book-page.hidden').count()===1); ok('eliminar desde la página');
  // nuevo + cancelar
  await p.click('#new-book'); await p.click('[data-action=cancel]');
  assert(await p.locator('.book-card').count()===1 && await p.locator('#book-page.hidden').count()===1); ok('cancelar nuevo');
  await p.reload();
  assert(await p.locator('.book-card').count()===1); ok('persiste');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); ok('sin scroll horizontal');
  console.log('errores:', errs);
  await b.close();
})().catch(e=>{console.error('FALLO',e.message);process.exit(1)});
