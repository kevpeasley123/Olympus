import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const star=page.locator('.agent-architecture-star[data-agent-id="verification"]');
 assert.equal(await page.locator('.agent-architecture-star[data-orbiting="true"]').count(),1);
 assert.equal(await star.getAttribute('data-orbiting'),'true');
 const phase=()=>star.getAttribute('data-agent-orbit-phase').then(Number);
 const depth=await star.getAttribute('data-agent-depth');const start=await phase();await page.waitForTimeout(600);assert(await phase()>start+.1);assert.notEqual(await star.getAttribute('data-agent-depth'),depth);assert.equal(await star.evaluate(el=>getComputedStyle(el).visibility),'visible');
 const row=page.locator('.armory-roster-row[data-agent-id="verification"]');
 await row.hover();const paused=await phase();await page.waitForTimeout(400);assert.equal(await phase(),paused);
 await page.screenshot({path:'output/mission-review/active-agent-orbit.png'});
 await page.mouse.move(5,5);await page.waitForTimeout(300);assert(await phase()>paused);
 // Exercise observed activity updates without starting real workflows.
 await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/src/services/agentConstellation.ts')));m.publishWorkingAgents([])});
 await page.waitForFunction(()=>document.querySelector('.agent-architecture-star[data-agent-id="verification"]').style.transform==='',{},{timeout:15000});
 await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/src/services/agentConstellation.ts')));m.publishWorkingAgents(['verification','research'])});
 await page.waitForTimeout(500);assert.equal(await page.locator('.agent-architecture-star[data-orbiting="true"]').count(),2);
 assert.notEqual(await star.evaluate(el=>el.style.transform),'');
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=idle');
 await page.waitForSelector('[data-scene-ready="true"]');assert.equal(await page.locator('.agent-architecture-star[data-orbiting="true"]').count(),0);
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=reduced-motion');
 await page.waitForSelector('[data-scene-ready="true"]');
 await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/src/services/agentConstellation.ts')));m.publishWorkingAgents(['verification'])});
 await page.waitForTimeout(500);const frozen=await phase();await page.waitForTimeout(500);assert.equal(await phase(),frozen);
 await page.evaluate(async()=>{const m=await import(performance.getEntriesByType('resource').map(r=>r.name).find(n=>n.includes('/src/services/agentConstellation.ts')));m.publishWorkingAgents([])});
 await page.waitForFunction(()=>document.querySelector('.agent-architecture-star[data-agent-id="verification"]').style.transform==='');
 console.log('PASS: observed active role only, fast orbit, inspection pause/resume, return to nest, multiple active agents, idle state, reduced-motion freeze and instant return.');
}finally{await browser.close()}
