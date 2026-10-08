import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1672,height:941}});
await page.goto('http://127.0.0.1:31430/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
await page.waitForSelector('[data-scene-ready="true"]');
for(const [name,event] of [['shoulder',1],['foot',2]]){
 await page.waitForFunction(n=>{const t=Number(document.querySelector('.hybrid-core canvas').dataset.galaxyTime);return t>=n*3.4+.2},event);
 await page.screenshot({path:`output/mission-review/electric-burst-${name}.png`});
}
await browser.close();
