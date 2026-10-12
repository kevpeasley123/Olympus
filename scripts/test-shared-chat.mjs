import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/shared-chat',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('olympus.commandChatLayout','expanded'));
 await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:31420/');
 for(const width of [1440,980,1920]) {
  await page.setViewportSize({width,height:960});
  for(const mode of ['Command','Project','Research','Communications']) {
   await page.getByRole('button',{name:mode,exact:true}).click();
   const dock=page.getByRole('button',{name:'Ask Olympus',exact:true});if(await dock.isVisible())await dock.click();
   const panel=page.locator('.command-console');await panel.waitFor({state:'visible'});
   await panel.getByRole('button',{name:'Overview',exact:true}).click();assert.equal(await panel.getAttribute('data-panel-view'),'overview');
   assert(await panel.locator('.console-idle').isVisible());
   const briefStyle=await panel.locator('.console-idle').evaluate(el=>({flex:getComputedStyle(el).flexGrow,justify:getComputedStyle(el).justifyContent}));
   assert.equal(briefStyle.flex,'0');assert.equal(briefStyle.justify,'flex-start');
   assert(await panel.getByRole('button',{name:'Start voice conversation',exact:true}).isVisible());
   await page.waitForTimeout(300);await page.screenshot({path:`output/shared-chat/${mode.toLowerCase()}-overview-${width}.png`});
   await panel.getByRole('button',{name:'Conversation',exact:true}).click();assert.equal(await panel.getAttribute('data-panel-view'),'conversation');
   assert.equal(await panel.locator('.active-mission-list').count(),0);
   const input=panel.getByRole('textbox',{name:'Command to Olympus',exact:true});
   if(width===1440&&mode==='Command')await input.fill('Keep this draft across every mode');
   assert.equal(await input.inputValue(),'Keep this draft across every mode');
   const bounds=await panel.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Console stays within viewport');
   assert(await input.isVisible());
   await page.waitForTimeout(300);await page.screenshot({path:`output/shared-chat/${mode.toLowerCase()}-conversation-${width}.png`});
   if(mode!=='Command') {
    await panel.getByRole('button',{name:mode==='Project'?'Back to projects':'Close console',exact:true}).click();
    await dock.waitFor({state:'visible'});await dock.click();assert.equal(await input.inputValue(),'Keep this draft across every mode');
   }
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS shared tabs, draft continuity, dock restoration and viewport bounds across four modes at three sizes');
} finally {await browser.close()}
