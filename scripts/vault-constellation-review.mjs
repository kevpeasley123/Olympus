import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
await mkdir('output/vault-constellation',{recursive:true});
const base=(process.argv[2]??'http://127.0.0.1:31430')+'/command-agent-harness.html?flagship&scenario=idle';
try {
 for(const dense of [false,true]){
  await page.goto(base+(dense?'&dense-vault':''));
  await page.waitForSelector('html[data-visual-ready="idle"]');
  assert.equal(await page.locator('.vault-constellation').count(),0);
  await page.locator('.instrument-activity summary').click();
  const picker=page.getByLabel('Inspect asset');
  assert.equal(await picker.locator('option[value^="note:"]').count(),dense?120:40);
  await picker.selectOption('note:note-3.md');
  await page.getByRole('button',{name:'Open note',exact:true}).waitFor();
  assert.match(await page.locator('.asset-inspection').innerText(),/note:note-3.md/);
  for(const width of [1280,1920]){
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`output/vault-constellation/${dense?'dense':'normal'}-${width}.png`});
  }
 }
 console.log('PASS real graph counts, central note inspection, no floating cluster and viewport bounds');
}finally{await browser.close()}
