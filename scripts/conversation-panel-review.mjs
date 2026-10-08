import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31430';const out='output/conversation-panel-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});const checks=[],errors=[];const check=(v,label)=>{assert(v,label);checks.push(label);};
try{
const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
for(const [width,height] of [[1440,960],[1920,1080],[1280,800],[900,900]]){
 await p.setViewportSize({width,height});await p.goto(base+'/command-agent-harness.html?flagship&scenario=mission-research&missions=2&conversation-test');await p.waitForSelector('html[data-visual-ready]');
 const panel=p.locator('.command-console');const overview=panel.getByRole('button',{name:'Overview',exact:true}),conversation=panel.getByRole('button',{name:'Conversation',exact:true});const input=panel.getByPlaceholder('Ask Olympus anything…');const viewport=panel.locator('.console-viewport');
 check(await overview.getAttribute('aria-pressed')==='true','Overview initially '+width);check(await panel.locator('.active-mission-list').isVisible(),'Mission cards initially '+width);
 await panel.screenshot({path:`${out}/overview-${width}.png`});
 await input.fill('Keep this unsent draft');check(await conversation.getAttribute('aria-pressed')==='true','Typing opens conversation '+width);
 check(await panel.locator('.active-mission-list').count()===0,'No mission cards under transcript '+width);check(await panel.locator('.conversation-mission-strip').count()===0,'No overview status in conversation '+width);
 check(await viewport.isVisible(),'Transcript visible '+width);await p.waitForTimeout(150);
 const geometry=await panel.evaluate(e=>{const rect=s=>e.querySelector(s).getBoundingClientRect().toJSON();return {panel:e.getBoundingClientRect().toJSON(),log:rect('.console-viewport'),composer:rect('.console-command-bar'),strip:rect('.conversation-view-switch')}});
 check(geometry.log.height>150&&geometry.log.bottom<=geometry.composer.top+1&&geometry.log.top>=geometry.strip.bottom-1,'Transcript has clear reading area '+width);
 check(geometry.composer.bottom<=geometry.panel.bottom+1,'Composer stays inside panel '+width);
 await viewport.evaluate(e=>{e.scrollTop=150;e.dispatchEvent(new Event('scroll',{bubbles:true}));});await p.waitForTimeout(100);const position=await viewport.evaluate(e=>e.scrollTop);
 await p.locator('.armory-heading').click();check(await conversation.getAttribute('aria-pressed')==='true','Outside click keeps conversation '+width);
 await overview.click();await overview.click();check(await viewport.isVisible()===false,'Overview hides transcript '+width);check(await input.inputValue()==='Keep this unsent draft','Draft retained in overview '+width);
 await conversation.click();await p.waitForTimeout(100);check(Math.abs(await viewport.evaluate(e=>e.scrollTop)-position)<2,'Reading position restored '+width);
 await p.evaluate(()=>dispatchEvent(new Event('fixture:conversation-reply')));await p.waitForTimeout(100);check(Math.abs(await viewport.evaluate(e=>e.scrollTop)-position)<2,'Incoming reply preserves reading position '+width);
 await panel.getByRole('button',{name:'↓ Latest reply',exact:true}).click();await p.waitForTimeout(1200);check(await viewport.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight<4),'Latest jumps to bottom '+width);
 await p.evaluate(()=>dispatchEvent(new Event('fixture:conversation-reply')));await p.waitForTimeout(100);check(await viewport.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight<4),'At bottom follows new reply '+width);
 await panel.screenshot({path:`${out}/conversation-${width}.png`});
 await overview.click();check(await overview.getAttribute('aria-pressed')==='true','Overview button returns to missions '+width);
 await conversation.focus();await p.keyboard.press('Enter');check(await conversation.getAttribute('aria-pressed')==='true','Keyboard opens conversation '+width);await p.keyboard.press('Escape');check(await conversation.getAttribute('aria-pressed')==='true','Escape does not dismiss dedicated conversation '+width);
}
check(errors.length===0,'No browser errors');await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} conversation checks`);
}finally{await browser.close();}
