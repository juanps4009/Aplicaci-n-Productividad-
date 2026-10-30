const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(600);
  await p.click('#open-settings'); await p.waitForTimeout(200); assert(await p.locator('#settings').isVisible());
  await p.goBack(); await p.waitForTimeout(300); assert(!(await p.locator('#settings').isVisible())); assert(p.url().startsWith('http://localhost:8123/')); console.log('OK Atrás cierra Ajustes sin salir de la app');
  await p.click('#open-settings'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(300); assert(!(await p.locator('#settings').isVisible())); console.log('OK Escape cierra Ajustes');
  await p.click('#open-settings'); await p.waitForTimeout(200); await p.click('#close-settings'); await p.waitForTimeout(300); assert(!(await p.locator('#settings').isVisible()));
  await p.click('#open-settings'); await p.waitForTimeout(200); assert(await p.locator('#settings').isVisible()); console.log('OK cerrar con ✕ y volver a abrir funciona');
  console.log('errores:', errs); assert.deepStrictEqual(errs, []); await b.close();
})();
