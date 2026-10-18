import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
try {const p=await b.newPage();await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
for(const [label,query,width,height] of [['fresh','&usage-fixture=fresh',1440,960],['unknown','',1440,960],['stale','&usage-fixture=stale',1280,800],['fresh-narrow','&usage-fixture=fresh',900,900]]){
await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:31426/command-agent-harness.html?flagship&scenario=idle'+query);await p.waitForSelector('html[data-visual-ready="idle"]');
assert((await p.locator('.usage-summary h3').first().evaluate(e=>getComputedStyle(e).fontFamily)).includes('Inter'));
assert.equal(await p.locator('.command-console .usage-summary').count(),0);
await p.screenshot({path:`output/usage-redesign/final-command-${label}-compact.png`,fullPage:true});
await p.locator('.usage-summary').screenshot({path:`output/usage-redesign/final-${label}-compact-crop.png`});
await p.getByRole('button',{name:'Expand usage'}).click();
if(label==='fresh'){const t=await p.getByRole('dialog').innerText();assert(t.includes('Recent')&&!t.includes('Not checked')&&!t.includes('Stale'));}
if(label==='unknown')for(const card of await p.locator('.usage-card').all())assert.equal((await card.innerText()).split('Telemetry not connected').length-1,1);
await p.screenshot({path:`output/usage-redesign/final-command-${label}-expanded.png`,fullPage:true});
await p.keyboard.press('Escape');assert(await p.getByRole('button',{name:'Expand usage'}).evaluate(e=>e===document.activeElement));
console.log('PASS actual Command '+label+' '+width+'x'+height);
}
}finally{await b.close();}
