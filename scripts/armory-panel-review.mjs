import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.argv[2]??'http://127.0.0.1:31430';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=mission-research&missions=2`);
 await page.waitForSelector('[data-scene-ready="true"]');
 const panel=page.getByRole('complementary',{name:'Olympus Armory'});
 assert.deepEqual(await panel.locator('.armory-roster [data-agent-emblem]').evaluateAll(nodes=>nodes.map(n=>n.dataset.agentEmblem)),['olympus','coding-delegate','research','dionysus','verification']);
 await panel.getByRole('button',{name:'Active 1',exact:true}).click();
 assert.equal(await panel.locator('.armory-roster-row').count(),2);
 assert.equal(await panel.locator('.armory-roster [data-agent-emblem]').last().getAttribute('data-agent-emblem'),'verification');
 await panel.getByRole('button',{name:'Idle 1',exact:true}).click();
 assert.equal(await panel.locator('.armory-roster-row').count(),2);
 assert.equal(await panel.locator('.armory-roster [data-agent-emblem]').last().getAttribute('data-agent-emblem'),'research');
 await panel.getByRole('button',{name:'All 5',exact:true}).click();
 for(const [id,name] of [['olympus','Zeus'],['coding-delegate','Hephaestus'],['research','Athena'],['dionysus','Dionysus'],['verification','Themis']]){
  await panel.getByRole('button',{name:`Inspect ${name} loadout`}).click();
  assert.equal(await page.locator('.loadout-title [data-agent-emblem]').getAttribute('data-agent-emblem'),id);
  await page.keyboard.press('Escape');
 }
 await panel.getByRole('button',{name:'Deploy agent',exact:true}).click();
 assert.equal(await page.locator('.armory-agent-entry [data-agent-emblem]').count(),5);
 await page.keyboard.press('Escape');
 await panel.getByText('Add resources & skills',{exact:true}).click();
 await panel.getByRole('button',{name:'Add skill',exact:true}).click();
 assert(await page.getByRole('textbox',{name:'Skill name',exact:true}).isVisible());
 await page.keyboard.press('Escape');
 await panel.getByText('Add resources & skills',{exact:true}).click();
 await mkdir('output/armory-panel-review',{recursive:true});
 await page.screenshot({path:'output/armory-panel-review/command-1672.png'});
 console.log('PASS Armory filters, persistent agent emblems, deployment chooser and skill intake');
}finally{await browser.close()}
