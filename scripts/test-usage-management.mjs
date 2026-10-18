import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
try {const p=await b.newPage();await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
for(const width of [1440,420]){
await p.setViewportSize({width,height:960});await p.goto('http://127.0.0.1:31426/engine-usage-harness.html?populated&fresh');
await p.getByRole('button',{name:'Expand usage'}).click();
await p.getByRole('button',{name:'Manage subscriptions',exact:true}).click({timeout:5000});
await p.getByRole('heading',{name:'Manage subscriptions',exact:true}).waitFor();
assert.equal(await p.locator('dialog .engine-settings').count(),1);
await p.getByRole('dialog').getByText('Subscription engines',{exact:true}).click();
assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),[],'Opening views and disclosure never inspects');
await p.getByRole('dialog').getByRole('button',{name:'Check again'}).click();
await p.getByText('C:/Synthetic/codex.exe',{exact:true}).waitFor();
assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),['engines']);
await p.screenshot({path:`output/usage-redesign/management-subscriptions-${width}.png`});
await p.getByRole('button',{name:'Back to usage'}).click();
await p.waitForFunction(()=>document.activeElement?.getAttribute('data-manage')==='subscriptions');
await p.getByRole('button',{name:'Manage APIs',exact:true}).click();
await p.getByRole('button',{name:'ElevenLabs',exact:true}).click();
assert((await p.getByRole('dialog').innerText()).includes('Windows Credential Manager'));
assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),['engines']);
await p.getByRole('button',{name:'Check local configuration'}).click();
await p.getByText('Key saved on this device; provider connection not verified.',{exact:true}).waitFor();
assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),['engines','elevenlabs']);
await p.screenshot({path:`output/usage-redesign/management-elevenlabs-${width}.png`});
await p.getByRole('button',{name:'Back to services'}).click();
await p.getByRole('button',{name:'Add service',exact:true}).click();
assert((await p.getByRole('dialog').innerText()).includes('does not install'));
await p.getByRole('button',{name:'Back to services'}).click();
await p.screenshot({path:`output/usage-redesign/management-services-${width}.png`});
await p.keyboard.press('Escape');assert.equal(await p.locator('dialog').count(),0);
assert(await p.getByRole('button',{name:'Expand usage'}).evaluate(e=>e===document.activeElement));
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
for(const state of ['inspection-fails','inspection-unsupported']){
 await p.goto(`http://127.0.0.1:31426/engine-usage-harness.html?${state}`);await p.getByRole('button',{name:'Expand usage'}).click();await p.getByRole('button',{name:'Manage APIs',exact:true}).click();await p.getByRole('button',{name:'ElevenLabs',exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),[]);
 if(state==='inspection-fails'){await p.getByRole('button',{name:'Check local configuration'}).click();await p.getByRole('alert').filter({hasText:'Synthetic inspection unavailable'}).waitFor();await p.getByRole('button',{name:'Back to services'}).click();await p.getByRole('alert').filter({hasText:'Synthetic inspection unavailable'}).waitFor({state:'hidden'});}else assert(await p.getByRole('button',{name:'Check local configuration'}).isDisabled());
}
console.log('PASS management destinations, reuse, disclosure, Back/Close/Escape/focus and narrow layout');
}finally{await b.close();}
