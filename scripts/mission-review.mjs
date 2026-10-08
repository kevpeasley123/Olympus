import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31430';
const out='output/mission-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'}),errors=[],checks=[];
const check=(value,message)=>{assert(value,message);checks.push(message)};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[1672,941],[1440,960],[1280,800],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const [scenario,count,extra] of [['idle',0,''],['mission-research',1,''],['mission-research',2,'&missions=2'],['mission-complete',0,'']]){
   await page.goto(`${base}/command-agent-harness.html?flagship&scenario=${scenario}${extra}`);
   await page.waitForSelector('[data-scene-ready="true"]');await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(n=>document.querySelector('.hybrid-core canvas')?.dataset.missionPlanets===String(n),count);
   check(await page.locator('.mission-planet-target').count()===count,`${width} ${scenario} ${count} planets`);
   check(await page.locator('.active-mission-card').count()===count,`${width} ${scenario} synchronized list`);
   check(await page.getByRole('group',{name:/Skills constellation/}).count()===1,'Permanent Skills');
   check(await page.getByRole('group',{name:/Plugins constellation/}).count()===1,'Permanent Plugins');
   check(await page.getByRole('group',{name:/Obsidian constellation/}).count()===1,'Permanent Obsidian');
   await page.screenshot({path:`${out}/${scenario}-${count}-${width}.png`});
   if(count===2){
    await page.locator('.active-mission-card').last().click();
    check(await page.locator('.mission-planet-target[aria-pressed="true"]').count()===1,'Panel selects one planet');
    await page.locator('.mission-planet-target').first().focus();await page.keyboard.press('Enter');
    check(await page.locator('.active-mission-card').first().getAttribute('aria-pressed')==='true','Planet selects corresponding panel card');
    check(await page.locator('.selected-mission-context').isVisible(),'Mission context opens');
    await page.screenshot({path:`${out}/selected-${width}.png`});
   }
   const fit=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,composer:document.querySelector('.console-command-bar').getBoundingClientRect().bottom<=innerHeight}));
   check(!fit.overflow&&fit.composer,`${width} layout and composer fit`);
  }
 }
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=reduced-motion&missions=2`);await page.waitForSelector('[data-scene-ready="true"]');
 const time=await page.locator('.hybrid-core canvas').getAttribute('data-galaxy-time');await page.waitForTimeout(1100);
 check(time===await page.locator('.hybrid-core canvas').getAttribute('data-galaxy-time'),'Reduced motion freezes scene');
 await page.evaluate(()=>document.querySelector('.hybrid-core canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await page.waitForSelector('.mission-targets[data-fallback="true"]');check(await page.locator('.mission-planet-target').count()===2,'Fallback preserves mission controls');
 check(!errors.length,'No browser errors');
 await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} mission checks`);
}finally{await browser.close()}
