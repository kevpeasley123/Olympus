import {chromium} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});const p=await ctx.newPage();p.setDefaultTimeout(90000);
for(const d of ['done','handoff','failed']){
 await p.goto(`http://127.0.0.1:5199/harness/command-agent-harness.html?flagship&scenario=idle&deck=${d}`,{waitUntil:'networkidle'});await p.waitForTimeout(2500);
 const deck=p.locator('.activity-deck');await deck.screenshot({path:`/tmp/deck-${d}.png`});
 console.log(d, (await deck.locator('.deck-status').allTextContents()).join(','), '|', await deck.locator('.deck-delegations').textContent());
}
await p.goto(`http://127.0.0.1:5199/harness/engine-usage-harness.html`,{waitUntil:'networkidle'});await p.waitForTimeout(1500);
await p.screenshot({path:'/tmp/usage.png',fullPage:false});
await b.close();
