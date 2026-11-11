import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=(process.argv[2]??'http://127.0.0.1:31430').replace(/\/$/,'');
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});
 await page.goto(`${base}/harness/engine-usage-harness.html?routing`,{waitUntil:'domcontentloaded'});
 await page.getByText('Subscription engines',{exact:true}).click();
 await page.getByLabel('Reasoning engine',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Reasoning engine',{exact:true}).inputValue(),'codex');
 await page.getByLabel('Reasoning engine',{exact:true}).selectOption('claude-code');
 await page.getByLabel('Memory updates',{exact:true}).selectOption('ollama');
 await page.getByLabel('Briefing workflow',{exact:true}).selectOption('shadow');
 const settings=await page.evaluate(()=>window.routeSettings);
 assert.equal(settings['briefing.provider.v1'],'claude-code');
 assert.equal(settings['chatMemory.provider.v1'],'ollama');
 assert.equal(settings['briefing.workflow.v1'],'shadow');
 const writes=await page.evaluate(()=>window.routeWrites);
 assert.ok(writes.length===3,'Each deliberate choice writes once');
 assert.equal(await page.getByRole('button',{name:'Continue with ChatGPT',exact:true}).count(),0,'Obsolete blocked OAuth controller is not exposed beside the working adapter');
 await mkdir('output/task-routing',{recursive:true});
 await page.screenshot({path:'output/task-routing/settings.png',fullPage:true});
 console.log('PASS explicit independent task engines, persistent workflow choice, no competing connection controller');
}finally{await browser.close()}
