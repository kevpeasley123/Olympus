import {chromium} from 'playwright';import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
try{const p=await b.newPage({viewport:{width:1440,height:960}});await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
await p.goto('http://127.0.0.1:31426/command-agent-harness.html?flagship&usage-fixture=fresh&management-harness');await p.waitForSelector('html[data-visual-ready="idle"]');
await p.getByRole('button',{name:'Expand usage'}).click();await p.screenshot({path:'output/usage-redesign/managed-usage-expanded.png'});
await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',ctrlKey:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'\\',ctrlKey:true}));});assert.equal(await p.evaluate(()=>document.documentElement.dataset.fixtureRefresh),undefined);assert.equal(await p.evaluate(()=>document.documentElement.dataset.fixtureCycle),undefined);
await p.getByRole('button',{name:'Manage subscriptions',exact:true}).click();await p.screenshot({path:'output/usage-redesign/command-management-subscriptions.png'});await p.getByRole('button',{name:'Back to usage'}).click();
await p.getByRole('button',{name:'Manage APIs',exact:true}).click();await p.screenshot({path:'output/usage-redesign/command-management-apis.png'});
for(const [service,setup,selector] of [['ElevenLabs','Open existing voice settings','.voice-settings'],['Gmail','Open existing Gmail settings','.gmail-settings'],['API model routes','Open existing model settings','.model-diagnostics']]){
 await p.getByRole('button',{name:service,exact:true}).click();if(service==='ElevenLabs'){await p.getByRole('button',{name:'Check local configuration'}).click();await p.screenshot({path:'output/usage-redesign/command-management-elevenlabs.png'});}await p.getByRole('button',{name:setup,exact:true}).click();
 await p.getByRole('dialog',{name:'Olympus Preferences'}).waitFor();
 assert.equal(await p.locator('dialog.usage-dialog').count(),0);
 assert.equal(await p.getByRole('dialog',{name:'Olympus Preferences'}).locator(selector).count(),1);
 await p.screenshot({path:`output/usage-redesign/management-handoff-${service.replaceAll(' ','-')}.png`});
 await p.keyboard.press('Escape');await p.getByRole('heading',{name:service,exact:true}).waitFor();
 if(service==='ElevenLabs')assert.match(await p.locator('.usage-management__reading').innerText(),/Key saved on this device/);
 await p.getByRole('button',{name:'Back to services'}).click();
}
await p.getByRole('button',{name:'Add service',exact:true}).click();await p.getByRole('button',{name:'Continue in Armory intake'}).click();
await p.getByRole('button',{name:'Back to API management',exact:true}).waitFor();
assert(await p.locator('.armory-resource-drawer').evaluate(e=>e.open));
await p.getByRole('button',{name:'Add resource',exact:true}).click();await p.getByRole('dialog',{name:'Add resource',exact:true}).waitFor();
await p.getByRole('textbox',{name:'Title',exact:true}).fill('Synthetic integration idea');await p.keyboard.press('Escape');
await p.getByRole('button',{name:'Back to API management',exact:true}).click();await p.getByRole('heading',{name:'Add a service',exact:true}).waitFor();
await p.getByRole('button',{name:'Continue in Armory intake'}).click();await p.getByRole('button',{name:'Add resource',exact:true}).click();
assert.equal(await p.getByRole('textbox',{name:'Title',exact:true}).inputValue(),'Synthetic integration idea');
await p.keyboard.press('Escape');await p.getByRole('button',{name:'Back to API management',exact:true}).click();await p.getByRole('button',{name:'Close usage',exact:true}).click();
assert(await p.getByRole('button',{name:'Expand usage'}).evaluate(e=>e===document.activeElement));
assert.deepEqual(await p.evaluate(()=>window.__usageManagementCalls),['elevenlabs'],'Handoffs do not inspect engines/services');
console.log('PASS real Preferences destinations, Escape returns, Armory intake re-use, draft preservation, focus and no automatic management calls');
}finally{await b.close();}
