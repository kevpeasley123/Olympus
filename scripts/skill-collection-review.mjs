import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/skill-collection-review',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
 for(const width of [1672,1280]){
  const page=await browser.newPage({viewport:{width,height:941},reducedMotion:"reduce"});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
  await page.getByRole('button',{name:'Inspect collection: Superpowers',exact:true}).click();
  const detail=page.getByRole('region',{name:'Superpowers collection',exact:true});await detail.waitFor();
  assert.match(await detail.textContent(),/not assigned/);assert.match(await detail.textContent(),/execution not connected/);
  assert.equal(await detail.locator('details').count(),6);
  await detail.locator('summary').filter({hasText:'Systematic debugging'}).click();
  assert.match(await detail.locator('details[open]').textContent(),/root causes/);
  assert.match(await detail.locator('a').first().getAttribute('href'),/8ca22dba9a94f28898bbce59f2537ff4d87c747d/);
  await page.screenshot({path:`output/skill-collection-review/collection-${width}.png`});
  assert.equal(await detail.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  await page.getByRole('button',{name:'Close Armory',exact:true}).click();
  await page.getByRole('button',{name:'Inspect Hephaestus loadout',exact:true}).click();
  await page.locator('.agent-loadout .collection-launch').click();await detail.waitFor();
  assert.equal(await page.locator('.mission-planet-target').count(),2);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: collection star, detail, source, skill expansion, Hephaestus reference, responsive layout and mission semantics');
}finally{await browser.close();}
