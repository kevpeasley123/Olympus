import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const fixture='http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=';
 await page.goto(fixture+'mission-research&missions=2');
 const canvas=page.locator('.hybrid-core canvas');
 await page.waitForSelector('[data-scene-ready="true"]');
 await page.waitForFunction(()=>Number(document.querySelector('.hybrid-core canvas')?.dataset.assetNodes)>0);
 const identity=await canvas.elementHandle();
 const yaw=await canvas.getAttribute('data-galaxy-yaw');
 const toggle=page.getByRole('group',{name:'Conversation engine'});
 for(const name of ['Codex','Claude Code']){
   await toggle.getByRole('button',{name,exact:true}).click();
   assert.equal(await toggle.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
   assert(await identity.evaluate(el=>el.isConnected));
 }
 await page.waitForFunction(old=>document.querySelector('.hybrid-core canvas')?.dataset.galaxyYaw!==old,yaw);
 await page.evaluate(async()=>{
   const {recordSourceAccess}=await import('/src/services/sourceActivity.ts');
   recordSourceAccess('Repository inspection','Fixture/src/main.ts',true,'Fixture run');
 });
 await page.locator('.instrument-activity summary').click();
 await page.getByRole('list',{name:'Source access history'}).getByText(/Fixture\/src\/main.ts/).waitFor();
 await mkdir('output/skill-backbone',{recursive:true});
 await page.screenshot({path:'output/skill-backbone/flagship.png'});
 await page.goto(fixture+'reduced-motion&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const stopped=await canvas.getAttribute('data-galaxy-yaw');
 await page.waitForTimeout(600);
 assert.equal(await canvas.getAttribute('data-galaxy-yaw'),stopped);
 assert.deepEqual(errors,[]);
 console.log('PASS flagship engine switch, stable renderer, rotation, assets, access history and reduced motion');
} finally {await browser.close();}
