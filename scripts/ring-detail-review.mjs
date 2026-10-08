import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
try {
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const canvas=page.locator('.hybrid-core canvas');
 await page.waitForFunction(()=>document.querySelector('.hybrid-core canvas')?.dataset.ringOrientation);
 const before=await canvas.getAttribute('data-ring-orientation'); const starYaw=await canvas.getAttribute('data-galaxy-yaw');
 await page.waitForTimeout(1400);
 assert.notEqual(await canvas.getAttribute('data-ring-orientation'),before,'Inner rings must rotate');
 assert.equal(await canvas.getAttribute('data-rings'),'2'); assert.notEqual(await canvas.getAttribute('data-galaxy-yaw'),starYaw,'Small stars rotate in 3D'); assert.equal(await canvas.getAttribute('data-galaxy-dust'),'680');
 await page.screenshot({path:'output/mission-review/sanctuary-final.png'});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=reduced-motion&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const frozen=await canvas.getAttribute('data-ring-orientation');
 await page.waitForTimeout(1400);
 assert.equal(await canvas.getAttribute('data-ring-orientation'),frozen,'Reduced motion must freeze inner rings');
 assert.deepEqual(errors,[]);
 console.log('PASS: two rotating inner rings, reduced-motion freeze, no browser or shader errors');
}finally{await browser.close()}
