import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({cacheDir:'node_modules/.vite-usage-dock-test',server:{host:'127.0.0.1',port:0}});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1000,height:1000},reducedMotion:'reduce'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await mkdir('output/usage-dock',{recursive:true});
 await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html?dock&populated&historical&many');
 const rail=page.getByRole('region',{name:'Models & subscriptions',exact:true});
 const items=rail.locator('.usage-rail__items');
 const next=rail.getByRole('button',{name:'Next models & subscriptions'});
 await next.waitFor();assert(await next.isEnabled());await next.click();
 await page.waitForFunction(()=>document.querySelector('.usage-rail__items').scrollLeft>0);
 assert(await rail.getByRole('button',{name:'Previous models & subscriptions'}).isEnabled());
 await items.evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'}));
 await page.waitForFunction(()=>{const el=document.querySelector('.usage-rail__items');return el.scrollLeft+el.clientWidth>=el.scrollWidth-2});
 await page.waitForFunction(()=>{const text=document.querySelector('.usage-rail__count').textContent;const [current,total]=text.split(' / ');return current===total});
 assert(await next.isDisabled());
 for(const bounds of await page.locator('.usage-rail__body>button:visible').evaluateAll(nodes=>nodes.map(el=>({button:el.getBoundingClientRect().toJSON(),rail:el.closest('.usage-rail').getBoundingClientRect().toJSON()})))) {
  assert(bounds.button.x>=bounds.rail.x-1&&bounds.button.right<=bounds.rail.right+1,'Paging controls stay inside their service rail');
 }
 await items.focus();await page.keyboard.press('Home');
 await page.screenshot({path:'output/usage-dock/many-services.png',fullPage:true});
 const expand=page.getByRole('button',{name:'Expand usage'});await expand.click();
 const dialog=page.getByRole('dialog',{name:'Usage & credits'});await dialog.waitFor();
 const claude=dialog.locator('.usage-card').filter({has:page.getByRole('heading',{name:'Claude',exact:true})});
 assert((await claude.innerText()).includes('Historical · stale'));assert((await claude.innerText()).includes('Reset unknown'));
 assert.equal(await claude.getByRole('progressbar').getAttribute('aria-valuenow'),'90');
 await page.keyboard.press('Tab');assert(await dialog.evaluate(d=>d.contains(document.activeElement)));
 await page.keyboard.press('Escape');assert(await expand.evaluate(e=>e===document.activeElement));
 for(const width of [900,420]) {
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`output/usage-dock/modular-${width}.png`,fullPage:true});
 }
 assert.deepEqual(await page.evaluate(()=>window.telemetryCalls),[]);
 console.log('PASS dock paging, keyboard/focus, responsive overflow and historical snapshot without provider calls');
} finally {await browser?.close();await server.close();}
