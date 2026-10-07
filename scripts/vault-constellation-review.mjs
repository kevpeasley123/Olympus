import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:960}});
await mkdir('output/vault-constellation',{recursive:true});
const base='http://127.0.0.1:31426/command-agent-harness.html?flagship&scenario=idle';
try {
 for(const dense of [false,true]){
  await page.goto(base+(dense?'&dense-vault':''));
  await page.waitForSelector('html[data-visual-ready="idle"]');
  const stars=page.locator('.vault-star'), count=await stars.count();
  assert.equal(count,dense?120:40);
  const peer=stars.nth(1).locator('.vault-star__light');
  const before=await peer.evaluate(e=>getComputedStyle(e).opacity);
  await stars.first().hover(); await page.waitForTimeout(220);
  assert(+await peer.evaluate(e=>getComputedStyle(e).opacity)>+before);
  assert.equal(await peer.evaluate(e=>getComputedStyle(e).width),'2px');
  await page.screenshot({path:`output/vault-constellation/${dense?'dense':'normal'}-hover.png`});
  await page.mouse.move(0,0);await stars.first().focus();await page.waitForTimeout(220);
  assert.equal(await peer.evaluate(e=>getComputedStyle(e).opacity),'1');
  await stars.first().blur();
  const plugins=page.locator('.armory-star'),light=plugins.nth(1).locator('.armory-star__light');
  const original=await light.evaluate(e=>getComputedStyle(e).filter);
  await page.locator('.armory-constellation').hover();await plugins.first().hover();await page.waitForTimeout(220);
  assert.notEqual(await light.evaluate(e=>getComputedStyle(e).filter),original);
  assert.equal(await light.evaluate(e=>getComputedStyle(e).width),'4px');
  await page.mouse.move(0,0);
  for(const width of [1280,1920]){
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`output/vault-constellation/${dense?'dense':'normal'}-${width}.png`});
  }
 }
 console.log('PASS real graph counts, peer hover/focus highlight, unchanged star sizes and viewport bounds');
}finally{await browser.close()}
