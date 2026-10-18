import assert from 'node:assert/strict';

import {createServer} from 'vite';

import {chromium} from 'playwright';

import {mkdir} from 'node:fs/promises';

const server=await createServer({server:{host:'127.0.0.1',port:0}}); await server.listen();

const browser=await chromium.launch({channel:'msedge',headless:true});

try{

 const page=await browser.newPage(); await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());

 await mkdir('output/usage-redesign',{recursive:true});

 for(const width of [1440,1280,420]){

 await page.setViewportSize({width,height:width===1280?800:1000}); await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html');

 const expand=page.getByRole('button',{name:'Expand usage'}); await expand.waitFor({timeout:5000});

 assert.equal(await page.locator('.usage-summary [role=progressbar]').count(),0);

 assert((await page.locator('.usage-summary h3').first().evaluate(e=>getComputedStyle(e).fontFamily)).includes('Inter'),'Explicit sans-serif');
 assert.equal(await page.locator('.usage-summary__track').count(),0,'Unknown must not look like empty bars');

 assert((await page.locator('.usage-summary').boundingBox()).width<=340);

 await expand.click(); await page.getByRole('dialog',{name:'Usage & credits'}).waitFor();
 await page.screenshot({path:`output/usage-redesign/unknown-expanded-${width}.png`,fullPage:true});

 await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(),0);

 assert(await expand.evaluate(e=>document.activeElement===e));

 await page.screenshot({path:`output/usage-redesign/unknown-${width}.png`,fullPage:true});

 await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html?populated');

 assert.equal(await page.locator('.usage-summary [aria-valuenow="65"]').count(),1);

 await page.screenshot({path:`output/usage-redesign/compact-${width}.png`,fullPage:true});

 await page.getByRole('button',{name:'Expand usage'}).click();

 assert(await page.getByRole('dialog').innerText().then(t=>t.includes('Stale')&&t.includes('Synthetic fixture')));

 assert.equal(await page.locator('.usage-ring[aria-valuenow="65"]').count(),1);

 assert(await page.getByRole('dialog').innerText().then(t=>t.includes('$2.50')));

 await page.keyboard.press('Tab');

 assert(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null),'Focus remains inside modal');

 await page.keyboard.press('Shift+Tab');

 assert(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null),'Reverse focus remains inside modal');

 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

 await page.screenshot({path:`output/usage-redesign/expanded-${width}.png`,fullPage:true});

 await page.getByRole('button',{name:'Close usage'}).click();

 }

 await page.emulateMedia({reducedMotion:'reduce'});

 for(const status of ['loading','failed','unsupported','disconnected']){

 await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html?populated&state='+status);

 await page.getByRole('button',{name:'Expand usage'}).click();

 const compact=await page.locator('.usage-summary').innerText();
 assert(!/[\u00e2\u00c2]/.test(compact),'No malformed UTF-8 text');
 assert(compact.toLowerCase().includes({loading:'checking',failed:'failed',unsupported:'not supported',disconnected:'not connected'}[status]));
 const text=await page.getByRole('dialog').innerText();

 assert(text.includes({loading:'Checking',failed:'Check failed',unsupported:'Not supported',disconnected:'Telemetry not connected'}[status]));

 if(status==='failed') assert(text.includes('showing last known reading')&&text.includes('$2.50'));

 else assert.equal(await page.locator('dialog [role=progressbar]').count(),0);

 assert(await page.locator('dialog').evaluate(e=>getComputedStyle(e).animationName==='none'));

 await page.screenshot({path:`output/usage-redesign/state-${status}.png`,fullPage:true});

 }

 for (const width of [1440, 360]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html?populated&fractional');
  await page.locator('.usage-row > strong').first().waitFor();
  assert((await page.locator('.usage-row > strong').allTextContents()).includes('95.9%'));
  assert(await page.locator('.usage-row > strong').evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth)), 'Compact percentage fits its column');
  await page.screenshot({path:`output/usage-redesign/fractional-compact-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Expand usage'}).click();
  assert((await page.locator('.usage-ring strong').allTextContents()).every(t=>t==='95.9%'));
  assert.equal(await page.locator('.usage-ring').first().getAttribute('aria-valuenow'),'95.8923154701719','Raw percentage retained');
  assert(await page.locator('.usage-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),'Expanded narrow layout fits');
  await page.screenshot({path:`output/usage-redesign/fractional-expanded-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');
 }

 for (const value of [0,100]) {
  await page.goto(server.resolvedUrls.local[0]+`engine-usage-harness.html?populated&fractional&edge=${value}`);
  await page.locator('.usage-row > strong').first().waitFor();
  assert((await page.locator('.usage-row > strong').allTextContents()).every(t=>t===`${value.toFixed(1)}%`));
  assert(await page.locator('.usage-row > strong').evaluateAll(nodes=>nodes.every(e=>e.scrollWidth<=e.clientWidth)));
  await page.getByRole('button',{name:'Expand usage'}).click();
  assert((await page.locator('.usage-ring strong').allTextContents()).every(t=>t===`${value.toFixed(1)}%`));
  await page.keyboard.press('Escape');
 }
 console.log('PASS compact width, neutral unknown, expanded rings, Escape/close/focus, fixture/stale evidence, responsive screenshots');

}finally{await browser.close();await server.close();}
