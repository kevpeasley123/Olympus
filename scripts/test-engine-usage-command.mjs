import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('output/engine-usage',{recursive:true});await mkdir('output/usage-dock',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},clearScreen:false});await server.listen();
const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage();
await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
for(const [width,height] of [[1440,960],[1280,800],[900,900]]) {
await page.setViewportSize({width,height});
await page.goto(base+'command-agent-harness.html?flagship&scenario=idle&usage-fixture=historical');
await page.waitForSelector('html[data-visual-ready="idle"]');
const geometry=await page.evaluate(()=>{
const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
return {usage:rect('.usage-summary'),console:rect('.command-console'),center:rect('.center-stack'),armory:rect('.olympus-armory'),width:document.documentElement.scrollWidth};
});
assert.equal(await page.locator('.command-console .usage-summary').count(),0,'Meters are outside chat');
await page.screenshot({path:`output/engine-usage/layout-${width}.png`,fullPage:true});
assert.equal(await page.locator('.right-stack .usage-summary').count(),0,'Usage must release the chat column');
if(width>1050){assert(geometry.usage.right<=geometry.console.left,'Dock stays beside chat');assert(geometry.usage.height<=130,'Dock stays shallow');assert(geometry.console.height>=height-180,'Expanded chat reclaims vertical space');}
assert(geometry.width<=width,'No horizontal overflow');
if(width<=1050) assert(geometry.console.top>=Math.max(geometry.center.bottom,geometry.armory.bottom)-1,'Narrow console does not overlap scene');
await page.screenshot({path:`output/engine-usage/command-${width}.png`,fullPage:true});
await page.getByRole('button',{name:'Expand usage'}).click();
await page.screenshot({path:`output/usage-redesign/command-expanded-${width}.png`,fullPage:true});
await page.keyboard.press('Escape');
assert(await page.getByRole('button',{name:'Expand usage'}).evaluate(e=>e===document.activeElement));
await page.getByRole('button',{name:'Conversation',exact:true}).click();
await page.screenshot({path:`output/usage-dock/conversation-${width}.png`,fullPage:true});
await page.getByRole('button',{name:'Compact console',exact:true}).click();
assert.equal(await page.locator('.usage-summary--dock').count(),1);
await page.screenshot({path:`output/usage-dock/compact-chat-${width}.png`,fullPage:true});
await page.getByRole('button',{name:'Expand conversation',exact:true}).click();
console.log(JSON.stringify({width,height,chatHeight:geometry.console.height,dockHeight:geometry.usage.height}));
}
} finally {await browser.close();await server.close();}
