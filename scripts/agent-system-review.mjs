import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();
 for(const [width,height] of [[1672,941],[1280,800]]){
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=idle');
  await page.waitForSelector('[data-scene-ready="true"]');
  const group=page.getByRole('group',{name:'Agents constellation: 5 roles'});
  assert.equal(await group.locator('button').count(),5);
  assert.equal(await group.locator('svg.agent-architecture-lines').evaluate(el=>getComputedStyle(el).opacity),'0');
  const zeus=await group.getByRole('button',{name:/Inspect Zeus:/}).boundingBox();await page.mouse.move(zeus.x+zeus.width/2,zeus.y+zeus.height/2);await page.waitForTimeout(220);
  assert(Number(await group.locator('svg.agent-architecture-lines').evaluate(el=>getComputedStyle(el).opacity))>.2);
  await page.mouse.move(5,5);
  for(const name of ['Zeus','Hephaestus','Athena','Dionysus','Themis']){
   const target=await group.getByRole('button',{name:new RegExp('Inspect '+name+':')}).boundingBox();await page.mouse.click(target.x+target.width/2,target.y+target.height/2);
   assert(await page.getByRole('heading',{name,exact:true}).isVisible());
   if(name==='Dionysus')assert(await page.getByText('Placeholder only. No executor, tools, write permissions or launch action.',{exact:true}).isVisible());
   await page.keyboard.press('Escape');
  }
  await page.mouse.move(5,5);await page.screenshot({path:`output/mission-review/agent-system-${width}.png`});
  const box=await group.boundingBox();assert(box.y+box.height<height*.72);
 }
 console.log('PASS: permanent five-role cluster, hover-only links, all named loadouts, placeholder disclosure and canyon placement');
}finally{await browser.close()}
