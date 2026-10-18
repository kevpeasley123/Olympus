import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({cacheDir:'node_modules/.vite-telemetry-test',server:{host:'127.0.0.1',port:0},clearScreen:false});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(server.resolvedUrls.local[0]+'engine-usage-harness.html',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:'Refresh usage',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.telemetryCalls),[],'No account reads on mount');
 await page.getByRole('button',{name:'Refresh usage',exact:true}).click();
 await page.waitForFunction(()=>window.telemetryCalls.length===3);
 await page.getByRole('button',{name:'Refresh usage',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelectorAll('.usage-summary [role=progressbar]').length===2);
 await page.getByRole('button',{name:'Expand usage'}).click();
 await page.getByRole('link',{name:'View Claude account usage'}).waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByText('Synthetic connection failure',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('dialog').locator('[role=progressbar]').count(),2,'Retain last readings after failure');
 assert.equal(await page.getByText(/Check failed .* showing last known reading/).count(),2);
 await mkdir('output/usage-telemetry',{recursive:true});
 await page.screenshot({path:'output/usage-telemetry/refresh-failed.png',fullPage:true});
 await page.setViewportSize({width:420,height:900});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'output/usage-telemetry/refresh-mobile.png',fullPage:true});
 console.log('PASS explicit refresh, provider independence, retained values, account link and narrow viewport');
}finally{await browser.close();await server.close();}
