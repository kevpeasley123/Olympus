import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.argv[2]??'http://127.0.0.1:31420';
await mkdir('output/portfolio-review',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});let checks=0;const check=(value,label)=>{assert(value,label);checks++};
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,1280,980,600]){
await page.setViewportSize({width,height:960});await page.goto(base+'/project-board-harness.html');await page.locator('.command-project-row').first().waitFor();if(width===600)await page.locator('#layout').evaluate(e=>{e.style.gridTemplateColumns='1fr';e.lastElementChild.style.display='none'});
check(await page.getByRole('button',{name:'Cards',exact:true}).getAttribute('aria-pressed')==='true','Cards initial');
check(await page.locator('.portfolio-demo').isVisible(),'Demo badge visible');
check(await page.locator('.command-board-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No horizontal card overflow');
await page.screenshot({path:`output/portfolio-review/cards-${width}.png`});
await page.getByRole('button',{name:'Ecosystem',exact:true}).focus();await page.keyboard.press('Enter');
check(await page.locator('.ecosystem-node').count()===3,'Olympus is represented only by the central hub');
check(await page.locator('.is-unmeasured').count()===4,'Unavailable tasks stay unknown');
const hub=page.getByRole('button',{name:'Open Olympus project, task count unknown',exact:true});
check(await hub.count()===1,'One interactive Olympus hub');
await hub.focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'At a glance',exact:true}).waitFor();
check(await page.locator('.command-detail-vision').count()===1,'Central hub opens the project detail');
await page.getByRole('button',{name:'← All projects',exact:true}).click();

check(await page.locator('.ecosystem-toolbar,.ecosystem-orbits,.command-portfolio-tools').count()===0,'Removed scene controls and tools stay absent');
check(await page.locator('.command-board-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No horizontal ecosystem overflow');
await page.screenshot({path:`output/portfolio-review/ecosystem-${width}.png`});
check(await page.locator('.command-board-controls').count()===0,'Portfolio toolbar removed');
await page.locator('.ecosystem-node').filter({hasText:'Pokedex'}).click();await page.getByRole('heading',{name:'At a glance',exact:true}).waitFor();
for(const name of ['Vision','Recent changes','Where it stands','Recommended next step'])check(await page.getByRole('heading',{name,exact:true}).isVisible(),`Visible detail section: ${name}`);
check(await page.locator('.command-board-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No horizontal detail overflow');
await page.screenshot({path:`output/portfolio-review/detail-${width}.png`});
await page.getByRole('button',{name:'← All projects',exact:true}).click();check(await page.getByRole('button',{name:'Ecosystem',exact:true}).getAttribute('aria-pressed')==='true','View retained across detail');
}
await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.ecosystem-planet').first().evaluate(e=>getComputedStyle(e).animationName)==='none','Reduced motion respected');
await page.goto(base+'/project-board-harness.html?ecosystem-metrics');
const fixture=page.locator('#metric-fixture');await fixture.locator('.ecosystem-node').first().waitFor();check(await fixture.locator('.ecosystem-node').count()===8,'Large portfolios paginated');
const sizes=await fixture.locator('.ecosystem-planet').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));check(sizes[0]<sizes[1]&&sizes[1]<sizes[2],'Narrow planet sizing preserves workload order');
check(await fixture.locator('.is-unmeasured').count()===1,'Unknown distinct from zero');await fixture.getByRole('button',{name:'Next',exact:true}).click();check(await fixture.locator('.ecosystem-node').count()===1,'Remaining projects accessible');
check(errors.length===0,'No browser errors');console.log(`PASS ${checks} portfolio checks`);
}finally{await browser.close()}
