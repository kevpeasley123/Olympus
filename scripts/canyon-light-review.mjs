import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const light=()=>page.locator('.background-image').evaluate(el=>Number(el.style.getPropertyValue('--omega-canyon-light')));
 const samples=[];for(let i=0;i<14;i++){const values=await page.locator('.hybrid-core canvas').evaluate(el=>({radiance:Number(el.dataset.omegaRadiance),light:Number(el.dataset.canyonLight)}));assert(Math.abs(values.light-(.08+(values.radiance-.82)*.62))<1e-8);samples.push(await light());await page.waitForTimeout(350)}
 assert(Math.max(...samples)-Math.min(...samples)>.30);
 assert(await page.locator('.background-image').evaluate(el=>getComputedStyle(el,'::after').maskImage!=='none'));
 assert.equal(await page.locator('.mission-planet-target').count(),2);
 await page.waitForFunction(()=>Number(document.querySelector('.hybrid-core canvas').dataset.omegaRadiance)<.91,{},{timeout:20000});
 await page.screenshot({path:'output/mission-review/canyon-light-low.png'});
 await page.waitForFunction(()=>Number(document.querySelector('.hybrid-core canvas').dataset.omegaRadiance)>1.78,{},{timeout:20000});
 await page.screenshot({path:'output/mission-review/canyon-light-peak.png'});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=reduced-motion');await page.waitForSelector('[data-scene-ready="true"]');
 const frozen=await light();await page.waitForTimeout(700);assert.equal(await light(),frozen);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: synchronized canyon light varies, landscape mask applied, two mission planets retained, reduced motion stable, no page/shader errors.');
}finally{await browser.close()}
