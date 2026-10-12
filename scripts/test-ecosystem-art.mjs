import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/ecosystem-art',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage();
 for(const width of [1440,1280]) {
  await page.setViewportSize({width,height:960});
  await page.goto('http://127.0.0.1:31420/');
  await page.getByRole('button',{name:'Project',exact:true}).click();
  await page.getByRole('button',{name:'Ecosystem',exact:true}).click();
  await page.locator('.ecosystem-node').first().waitFor();await page.waitForTimeout(700);
  assert.match(await page.locator('.background-image').evaluate(e=>getComputedStyle(e).backgroundImage),/ecosystem-night-sky/);
  const pokedex=page.locator('.ecosystem-node').filter({hasText:'Pokedex'});
  assert.equal(await pokedex.locator('[data-project-symbol="pokeball"]').count(),1);
  assert.equal(await page.locator('.ecosystem-beacon').count(),18);
  assert(await page.locator('.command-board-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:`output/ecosystem-art/sky-${width}.png`});
  await page.getByRole('button',{name:'Cards',exact:true}).click();
  assert.doesNotMatch(await page.locator('.background-image').evaluate(e=>getComputedStyle(e).backgroundImage),/ecosystem-night-sky/);
  assert.equal(await page.getByRole('article',{name:'Pokedex',exact:true}).locator('[data-project-symbol="pokeball"]').count(),1);
 }
 console.log('PASS ecosystem sky scoping, semantic symbols in both views, round constellation beacons and responsive overflow');
} finally {await browser.close()}
