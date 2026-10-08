import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 for(const id of ['olympus','coding-delegate','research','dionysus','verification']){
  const row=page.locator(`.armory-roster-row[data-agent-id="${id}"]`);
  const star=page.locator(`.agent-architecture-star[data-agent-id="${id}"]`);
  for(const target of [row,star]){
   const box=await target.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
   assert.equal(await row.getAttribute('data-inspecting'),'true');
   assert.equal(await star.getAttribute('data-inspecting'),'true');
   assert.equal(await page.locator('.agent-architecture-star[data-inspecting="true"]').count(),1);
   if(id==='research'&&target===row)await page.screenshot({path:'output/mission-review/agent-linked-highlight.png'});
   await page.mouse.move(5,5);
   assert.equal(await star.getAttribute('data-inspecting'),'false');
   await target.focus();
   assert.equal(await row.getAttribute('data-inspecting'),'true');
   assert.equal(await star.getAttribute('data-inspecting'),'true');
   await target.evaluate(el=>el.blur());
   assert.equal(await row.getAttribute('data-inspecting'),'false');
  }
 }
 assert.equal(await page.getByRole('dialog').count(),0);
 console.log('PASS: all five agents link both ways on hover and focus, clear on exit, isolate the matching identity, and never open inspection automatically.');
}finally{await browser.close()}
