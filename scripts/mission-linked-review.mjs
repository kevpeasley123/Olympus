import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const cards=page.locator('.active-mission-card'),planets=page.locator('.mission-planet-target');
 await cards.first().hover();await page.waitForTimeout(250);
 assert.equal(await planets.first().getAttribute('data-inspecting'),'true');assert.equal(await planets.last().getAttribute('data-inspecting'),'false');
 assert.equal(await planets.first().getAttribute('data-orbit-paused'),'true');
 assert(Number(await planets.first().evaluate(el=>getComputedStyle(el,'::after').opacity))>.8);
 await page.screenshot({path:'output/mission-review/linked-inspection.png'});
 await page.mouse.move(5,5);await page.waitForTimeout(250);assert.equal(await planets.first().getAttribute('data-inspecting'),'false');
 const box=await planets.first().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(250);
 assert.equal(await cards.first().getAttribute('data-inspecting'),'true');assert.equal(await cards.last().getAttribute('data-inspecting'),'false');
 await page.mouse.move(5,5);await cards.last().focus();await page.waitForTimeout(100);
 assert.equal(await planets.last().getAttribute('data-inspecting'),'true');
 await cards.last().evaluate(el=>el.blur());await page.waitForTimeout(100);assert.equal(await planets.last().getAttribute('data-inspecting'),'false');
 assert.equal(await page.locator('.active-mission-card[aria-pressed="true"]').count(),0,'Hover never selects a mission');
 console.log('PASS: bidirectional ID-matched hover, keyboard focus, clearing, planet pause, no unintended selection');
}finally{await browser.close()}
