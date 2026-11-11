import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const fixture='http://127.0.0.1:31430/harness/command-agent-harness.html?flagship&scenario=';
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
 await page.evaluate(()=>{
   const api=window.__TAURI_INTERNALS__;
   const previous=api.invoke;
   api.invoke=(cmd,args,...rest)=>cmd==="run_project_review" ? Promise.resolve({
     id:42,project:args.project,source:"fixture",outcome:"changed",detail:"Review ready",
     revision:"b".repeat(40),previous:"a".repeat(40),observedAt:new Date().toISOString(),
   }) : previous(cmd,args,...rest);
 });
 await page.getByRole('button',{name:/^Skills\s*\d/}).first().click();
 const panel=page.getByRole('dialog');
 await panel.getByText('Project Change Review',{exact:true}).first().click();
 await panel.getByLabel('Project folder name').fill('Fixture');
 await panel.getByRole('button',{name:'Run review'}).click();
 await panel.getByText(/Fixture · changed/).click();
 assert(await panel.getByText(/Review ready/).isVisible());
 await panel.getByRole('button',{name:'Review daily while Olympus is open'}).click();
 assert(await panel.getByRole('button',{name:'Disable daily review of Fixture'}).isVisible());
 await panel.getByRole('button',{name:'Disable daily review of Fixture'}).click();
 await panel.getByRole('button',{name:'Close Armory'}).click();
 await page.locator('.instrument-activity summary').click();
 await page.getByRole('list',{name:'Source access history'}).getByText(/Fixture · Git HEAD/).waitFor();
 await mkdir('output/skill-backbone',{recursive:true});
 await page.screenshot({path:'output/skill-backbone/flagship.png'});
 await page.evaluate(async()=>{
   const loaded=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/services/sourceActivity.ts');
   const {missionCitationObserver}=await import(loaded?.name??'/src/services/sourceActivity.ts');
   const observe=missionCitationObserver(Date.now()-1000);
   const mission={id:'fixture-research',citations:[{child:'research-1',actor:'research',file:'note-3.md',at:new Date().toISOString(),fingerprint:'fixture'}]};
   observe([mission]);observe([mission]);
 });
 await page.waitForFunction(()=>Number(document.querySelector('.hybrid-core canvas')?.dataset.sourcePulses)>0);
 const citation=page.getByRole('list',{name:'Source access history'}).getByText(/Athena.*note-3.md.*cited source/);
 await page.waitForFunction(()=>document.querySelector('.instrument-activity ol')?.textContent.includes('note-3.md'));
 assert.equal(await citation.count(),1,'Polling the same source record twice does not duplicate it');
 await page.waitForTimeout(450);
 await page.screenshot({path:'output/skill-backbone/pulse.png'});
 await toggle.getByRole('button',{name:'Codex',exact:true}).click();
 await page.waitForTimeout(550);
 await page.screenshot({path:'output/skill-backbone/codex.png'});
 await page.goto(fixture+'reduced-motion&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');
 const stopped=await canvas.getAttribute('data-galaxy-yaw');
 await page.waitForTimeout(600);
 assert.equal(await canvas.getAttribute('data-galaxy-yaw'),stopped);
 assert.deepEqual(errors,[]);
 console.log('PASS flagship engine switch, stable renderer, rotation, assets, access history and reduced motion');
} finally {await browser.close();}
