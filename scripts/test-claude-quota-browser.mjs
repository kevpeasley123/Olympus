import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({cacheDir:'node_modules/.vite-claude-quota-test',server:{host:'127.0.0.1',port:0}});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:960}});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.clock.install();
 await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html?populated&passive');
 await page.getByRole('button',{name:'Expand usage'}).click();
 const card=page.locator('.usage-card').filter({has:page.getByRole('heading',{name:'Claude',exact:true})});
 assert.equal(await card.getByRole('progressbar').getAttribute('aria-valuenow'),'89.875');
 await mkdir('output/claude-quota',{recursive:true});
 await page.screenshot({path:'output/claude-quota/before-expiry.png',fullPage:true});
 await page.clock.fastForward(3500);
 assert.equal(await card.getByRole('progressbar').getAttribute('aria-valuenow'),'90');
 assert((await card.innerText()).includes('No reading'));
 await page.clock.fastForward(7000);
 assert.equal(await card.getByRole('progressbar').count(),0);
 await page.screenshot({path:'output/claude-quota/after-expiry.png',fullPage:true});
 assert.deepEqual(await page.evaluate(()=>window.telemetryCalls),[],'Expiry makes no account requests');
 console.log('PASS passive window expiry in mounted UI without account requests');
}finally{await browser?.close();await server.close();}
