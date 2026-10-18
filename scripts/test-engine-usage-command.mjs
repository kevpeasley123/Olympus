import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('output/engine-usage',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0},clearScreen:false});await server.listen();
const base=server.resolvedUrls.local[0];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage();
await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
for(const [width,height] of [[1440,960],[1280,800],[900,900]]) {
await page.setViewportSize({width,height});
await page.goto(base+'command-agent-harness.html?flagship&scenario=idle');
await page.waitForSelector('html[data-visual-ready="idle"]');
const geometry=await page.evaluate(()=>{
const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
return {usage:rect('.usage-summary'),console:rect('.command-console'),center:rect('.center-stack'),armory:rect('.olympus-armory'),width:document.documentElement.scrollWidth};
});
assert.equal(await page.locator('.command-console .usage-summary').count(),0,'Meters are outside chat');
assert(geometry.usage.bottom<=geometry.console.top,'Meters do not overlap chat');
assert(geometry.width<=width,'No horizontal overflow');
if(width<=1050) assert(geometry.usage.top>=Math.max(geometry.center.bottom,geometry.armory.bottom)-1,'Narrow console does not overlap scene');
await page.screenshot({path:`output/engine-usage/command-${width}.png`,fullPage:true});
await page.getByRole('button',{name:'Expand usage'}).click();
await page.screenshot({path:`output/usage-redesign/command-expanded-${width}.png`,fullPage:true});
await page.keyboard.press('Escape');
}
} finally {await browser.close();await server.close();}
