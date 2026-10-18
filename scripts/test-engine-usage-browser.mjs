import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server = await createServer({server:{host:'127.0.0.1',port:0},clearScreen:false});
await server.listen();
const url=server.resolvedUrls.local[0];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  await mkdir('output/engine-usage',{recursive:true});
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1' ? route.continue() : route.abort());
  for(const width of [1280,420]) {
    await page.setViewportSize({width,height:960});
    await page.goto(`${url}engine-usage-harness.html`);
    assert.equal(await page.locator('details.usage-summary').count(),0);
    assert.equal(await page.locator('.usage-summary [role=progressbar]').count(),0);
    assert.equal(await page.locator('.usage-summary').getByText('0 credits',{exact:false}).count(),0);
    await page.getByText('Subscription engines',{exact:true}).click();
    await page.getByText('Generation blocked.',{exact:false}).waitFor();
    await page.getByText('C:/Synthetic/Claude/claude.exe',{exact:true}).waitFor();
    assert(await page.locator('.engine-settings').innerText().then(t=>t.includes('Claude Max subscription.')));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    await page.screenshot({path:`output/engine-usage/unavailable-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Check again'}).click();
    await page.getByRole('status').filter({hasText:'Synthetic inspection failure'}).waitFor();
    assert.equal(await page.getByText('C:/Synthetic/Claude/claude.exe',{exact:true}).count(),0,'Failed refresh clears old status');
    await page.goto(`${url}engine-usage-harness.html?populated`);
    assert.equal(await page.locator('details.usage-summary').count(),0);
    await page.getByRole('button',{name:'Expand usage'}).click();
    const text=await page.getByRole('dialog').innerText();
    for(const value of ['100','65','12.5 credits','2026 YTD','Stale','Synthetic fixture']) assert(text.includes(value),value);
    await page.screenshot({path:`output/engine-usage/populated-${width}.png`,fullPage:true});
  }
  console.log('PASS browser: unavailable/stale snapshots, separate units, billing block, failed refresh, narrow/wide layout');
} finally { await browser.close(); await server.close(); }
