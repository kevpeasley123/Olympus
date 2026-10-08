import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=idle');
 await page.waitForSelector('[data-scene-ready="true"]');
 const groups=page.locator('.armory-constellation,.skills-constellation,.vault-constellation,.agents-constellation');
 const read=()=>groups.evaluateAll(els=>els.map(el=>({nest:el.classList.contains('agents-constellation'),visible:getComputedStyle(el).visibility,phase:el.dataset.orbitPhase,transform:el.style.transform,width:el.offsetWidth,height:el.offsetHeight,color:getComputedStyle(el).color})));
 const a=await read();await page.waitForTimeout(1400);const b=await read();assert.equal(b.length,4);
 for(let i=0;i<4;i++){assert.equal(b[i].visible,'visible');if(b[i].nest){assert.equal(b[i].transform,'none');assert.equal(b[i].phase,'0');}else{assert.notEqual(a[i].transform,b[i].transform);assert.equal(b[i].phase,b[0].phase);}assert.deepEqual([a[i].width,a[i].height,a[i].color],[b[i].width,b[i].height,b[i].color]);}
 await page.screenshot({path:'output/mission-review/rotating-systems.png'});
 // Exercise a full cycle without waiting two minutes or speeding up the live scene.
 const cycle=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {architectureOrbits}=await import('/src/services/architectureOrbits.ts');
  const dial=document.createElement('div');dial.className='command-instrument__dial';dial.style.cssText='position:fixed;left:0;top:0;width:600px;height:600px';
  const host=document.createElement('div');host.style.cssText='position:absolute;inset:0';dial.append(host);
  const item=document.createElement('div');item.className='armory-constellation';item.style.cssText='position:absolute;left:420px;top:200px;width:100px;height:80px';dial.append(item);document.body.append(dial);
  const camera=new T.PerspectiveCamera(43,1,1,1200);camera.position.set(0,0,700);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const orbit=architectureOrbits(host,camera,new T.Scene());orbit.update(0);const start=item.style.transform;orbit.update(30);const quarter=item.style.transform;orbit.update(120);const end=item.style.transform;orbit.dispose();dial.remove();return {start,quarter,end};
 });
 assert.notEqual(cycle.start,cycle.quarter);assert.equal(cycle.start.replaceAll('-0.00','0.00'),cycle.end.replaceAll('-0.00','0.00'));
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=reduced-motion');await page.waitForSelector('[data-scene-ready="true"]');
 const frozen=await read();await page.waitForTimeout(800);assert.deepEqual(await read(),frozen);
 console.log('PASS: three systems rotate together with a stationary agent nest, preserve size/color, complete 360 degrees and honor reduced motion');
}finally{await browser.close()}
