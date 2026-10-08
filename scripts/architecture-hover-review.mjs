import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();
 for(const [width,height] of [[1672,941],[1280,800]]){
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
  await page.waitForSelector('[data-scene-ready="true"]');
  for(const [group,star] of [['.skills-constellation','.armory-star'],['.vault-constellation','.vault-star']]){
   const lines=page.locator(`${group} svg`),target=page.locator(`${group} ${star}`).last();
   const opacity=()=>lines.evaluate(el=>Number(getComputedStyle(el).opacity));
   assert.equal(await opacity(),0,'Links hidden at rest');
   await target.hover();await page.waitForTimeout(240);assert((await opacity())>.2,'Links visible on star hover');
   await page.mouse.move(5,5);await page.waitForTimeout(240);assert.equal(await opacity(),0,'Links hidden on leave');
   await target.focus();await page.waitForTimeout(240);assert((await opacity())>.2,'Links visible on keyboard focus');
   await target.evaluate(el=>el.blur());await page.waitForTimeout(240);
  }
  const vault=await page.locator('.vault-constellation').boundingBox();
  assert(vault.y+vault.height<height*.69,'Obsidian clears foreground platform');
  await page.screenshot({path:`output/mission-review/canyon-architecture-${width}.png`});
 }
 console.log('PASS: hover, leave, keyboard focus, and platform clearance at both widths');
}finally{await browser.close()}
