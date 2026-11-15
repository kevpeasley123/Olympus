import {chromium} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:500}});const p=await ctx.newPage();
await p.goto(`http://127.0.0.1:5199/harness/engine-usage-harness.html?dock&populated`,{waitUntil:'networkidle'});await p.waitForTimeout(1500);
await p.locator('.usage-summary').first().screenshot({path:'/tmp/usage-dock.png'});
console.log(await p.locator('.usage-tile__reading').allInnerTexts());
await b.close();
