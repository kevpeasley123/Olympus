import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
const output='output/zeus-lightning';
await mkdir(output,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const star=page.locator('.agent-architecture-star[data-agent-id="olympus"]');
 const card=page.locator('.armory-roster-row[data-agent-id="olympus"]');
 assert.equal(await page.locator('.zeus-lightning').count(),2);
 assert.equal(await star.evaluate(e=>getComputedStyle(e,'::before').content),'none');
 assert.equal(await star.evaluate(e=>getComputedStyle(e).boxShadow),'none');
 const channel=star.locator('.zeus-lightning__channel').first();
 const initial=await channel.evaluate(e=>getComputedStyle(e).strokeDashoffset);
 await page.waitForTimeout(450);
 assert.notEqual(await channel.evaluate(e=>getComputedStyle(e).strokeDashoffset),initial);
 for(const width of [1280,1920]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(350);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/scene-${width}.png`});
 }
 for(let frame=0;frame<3;frame++){
  await page.waitForTimeout(500);
  const a=await star.boundingBox();
  await page.screenshot({path:`${output}/arcs-${frame}.png`,clip:{x:a.x-15,y:a.y-15,width:a.width+30,height:a.height+30},scale:'css'});
 }
 await card.screenshot({path:`${output}/card.png`});
 await star.focus();
 assert.equal(await star.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 assert.equal(await card.getAttribute('data-inspecting'),'true');
 await star.press('Enter');
 await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert(await page.locator('.zeus-lightning').evaluateAll(elements=>elements.every(el=>[...el.querySelectorAll('*')].every(child=>getComputedStyle(child).animationName==='none'))));
 await page.screenshot({path:`${output}/reduced-motion.png`});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.agents-constellation').evaluate(el=>el.dataset.motionPaused='true');
 assert.equal(await channel.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 console.log('PASS: moving arcs in both locations; no Zeus halo; viewport fit; linked keyboard focus/inspection; reduced motion and paused-state styling.');
} finally {await browser.close();}
