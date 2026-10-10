import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
try {
 await mkdir('output/mission-review',{recursive:true});
 for(const [width,height] of [[1280,800],[1440,960],[1920,1080]]) {
  const page=await browser.newPage({viewport:{width,height}});
  // Accelerate only the review's orbit clock so a real depth-test crossing is deterministic and quick.
  await page.route('**/src/services/pantheonMissionScene.ts',async route=>{
   const response=await route.fetch(); const body=await response.text();
   assert(/record.elapsed\s*\+=\s*delta/.test(body));
   await route.fulfill({response,body:body.replace(/record.elapsed\s*\+=\s*delta/,'record.elapsed += delta * 100')});
  });
  await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
  await page.waitForSelector('[data-scene-ready="true"]');
  await page.waitForFunction(()=>!!document.querySelector('.mission-planet-target[data-occluded="true"]'),{},{timeout:30000});
  const target=page.locator('.mission-planet-target[data-occluded="true"]').first();
  const id=await target.getAttribute('data-mission-id');
  const planet=page.locator(`.mission-planet-target[data-mission-id="${id}"]`);
  assert.equal(await planet.evaluate(e=>getComputedStyle(e).opacity),'1','Unfocused occluded label stays visible');
  await planet.focus();
  await page.waitForTimeout(100);
  assert.equal(await planet.getAttribute('data-occluded'),'true');
  const label=planet.locator('.mission-planet-label');
  assert.equal(await planet.evaluate(e=>getComputedStyle(e).opacity),'1');
  assert.equal(await label.evaluate(e=>getComputedStyle(e).pointerEvents),'auto');
  assert.equal(await planet.evaluate(e=>getComputedStyle(e,'::after').visibility),'hidden');
  const box=await label.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width);
  await page.screenshot({path:`output/mission-review/occluded-label-${width}.png`});
  const before=await planet.getAttribute('style');
  await planet.evaluate(e=>e.blur());await page.waitForTimeout(100);
  assert.notEqual(await planet.getAttribute('style'),before,'Label anchor continues following orbit');
  console.log(`PASS ${width}: actual Omega occlusion keeps label visible, focusable and tracking; reticle hidden`);
  await page.close();
 }
} finally {await browser.close();}