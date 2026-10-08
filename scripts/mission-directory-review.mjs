import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const card=page.locator('.active-mission-card').first();
 const style=()=>card.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderColor,transform:s.transform,shadow:s.boxShadow}});
 const idle=await style();await card.hover();await page.waitForTimeout(220);const hovered=await style();
 assert.notEqual(hovered.border,idle.border);assert.notEqual(hovered.transform,'none');assert.notEqual(hovered.shadow,'none');
 await page.screenshot({path:'output/mission-review/directory-highlight.png'});
 await page.mouse.move(5,5);await page.waitForTimeout(220);assert.equal((await style()).border,idle.border);
 await card.focus();await page.waitForTimeout(220);assert.notEqual((await style()).border,idle.border);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(220);assert.equal((await style()).transform,'none');
 await page.keyboard.press('Enter');assert.equal(await card.getAttribute('aria-pressed'),'true');
 console.log('PASS: directory hover, leave, focus, reduced motion and mission selection');
}finally{await browser.close()}
