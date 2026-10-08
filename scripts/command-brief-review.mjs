import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[1672,941],[1280,800]]){
  await page.setViewportSize({width,height});
  for(const count of [0,1,2]){
   await page.goto(`http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=${count?'mission-research':'idle'}&missions=${count}`);
   await page.waitForSelector('[data-scene-ready="true"]');await page.mouse.move(5,5);await page.waitForTimeout(300);
   assert.equal(await page.locator('.console-idle__title').count(),0);
   assert.equal(await page.locator('.command-brief-metrics dd').first().innerText(),String(count));
   assert.equal(await page.locator('.active-mission-card').count(),count);
   const panels=[page.locator('.olympus-armory'),page.locator('.command-console[data-layout="expanded"]')];
   const bg=el=>el.evaluate(n=>getComputedStyle(n).backgroundColor);
   for(const panel of panels){
    const resting=await bg(panel);assert(resting.includes('0.64'),resting);
    await panel.hover();await page.waitForTimeout(300);await page.waitForFunction(n=>getComputedStyle(n).backgroundColor.includes('0.92'),await panel.elementHandle());
    await page.mouse.move(5,5);await page.waitForTimeout(300);await page.waitForFunction(n=>getComputedStyle(n).backgroundColor.includes('0.64'),await panel.elementHandle());
    const button=panel.locator('button').first();await button.focus();await page.waitForTimeout(300);await page.waitForFunction(n=>getComputedStyle(n).backgroundColor.includes('0.92'),await panel.elementHandle());
    await button.evaluate(n=>n.blur());await page.waitForFunction(n=>getComputedStyle(n).backgroundColor.includes('0.64'),await panel.elementHandle());
   }
   await page.screenshot({path:`output/mission-review/command-brief-${count}-${width}.png`});
   if(count===2){
    assert.deepEqual(await page.locator('.command-brief-metrics dd').allTextContents(),['2','1','1']);
    await page.getByRole('button',{name:/Review approval/}).click();assert(await page.locator('.selected-mission-context').isVisible());
    await page.getByRole('button',{name:/Review approval/}).click();assert(await page.locator('.selected-mission-context').isVisible());
    await page.locator('.active-mission-card[aria-expanded="true"]').click();assert.equal(await page.locator('.selected-mission-context').count(),0);
   }
   assert(await page.locator('.console-command-bar').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight));
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.olympus-armory').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: real zero/one/two mission summaries, approval review actions, no accidental collapse, idle/hover/focus surfaces, small-screen composer, reduced motion.');
}finally{await browser.close()}
