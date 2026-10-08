import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const planet=page.locator('.mission-planet-target').first(),other=page.locator('.mission-planet-target').last();
 const angle=p=>p.getAttribute('data-orbit-angle');
 const start=await angle(planet);await page.waitForTimeout(600);assert.notEqual(await angle(planet),start);
 const rect=await planet.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.waitForFunction(()=>document.querySelector('.mission-planet-target')?.dataset.orbitPaused==='true');
 const held=await angle(planet),otherStart=await angle(other);await page.waitForTimeout(800);
 assert.equal(await angle(planet),held,'Hover freezes orbit'); assert(Number(await planet.evaluate(el=>getComputedStyle(el,'::after').opacity))>.8,'Inspection reticle visible'); await page.screenshot({path:'output/mission-review/planet-inspection.png'});assert.notEqual(await angle(other),otherStart,'Other mission keeps orbiting');
 await page.mouse.move(5,5);await page.waitForTimeout(400);assert.notEqual(await angle(planet),held,'Leave resumes');
 await planet.focus();await page.waitForTimeout(100);const focused=await angle(planet);await page.waitForTimeout(500);assert.equal(await angle(planet),focused,'Keyboard focus freezes orbit');
 await planet.evaluate(el=>el.blur());await page.waitForTimeout(300);assert.notEqual(await angle(planet),focused,'Blur resumes');
 console.log('PASS: orbit, hover pause, independent motion, leave resume, keyboard pause and resume');
}finally{await browser.close()}
