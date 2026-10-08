import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const star=page.locator('.agent-architecture-star[data-agent-id="verification"]');
 assert.equal(await star.getAttribute('data-active'),'true');
 const before=await star.boundingBox();await page.waitForTimeout(1500);{const after=await star.boundingBox();assert(Math.abs(after.x-before.x)<1&&Math.abs(after.y-before.y)<1);assert.equal(after.width,before.width);assert.equal(await star.evaluate(el=>el.style.transform),'');}
 await page.locator('.armory-roster-row[data-agent-id="verification"]').hover();assert.equal(await star.getAttribute('data-inspecting'),'true');
 await page.mouse.move(5,5);
 await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/src/services/agentConstellation.ts')));m.publishWorkingAgents([])});
 await page.waitForFunction(()=>document.querySelector('.agent-architecture-star[data-agent-id="verification"]').dataset.active==='false');
 {const after=await star.boundingBox();assert(Math.abs(after.x-before.x)<1&&Math.abs(after.y-before.y)<1);assert.equal(after.width,before.width);assert.equal(await star.evaluate(el=>el.style.transform),'');}
 await page.screenshot({path:'output/mission-review/stationary-agent-nest.png'});
 console.log('PASS: active and idle agents stay in nest; linked inspection retained.');
}finally{await browser.close()}
