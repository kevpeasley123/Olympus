const base=process.argv[2]??"http://127.0.0.1:31420";
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
await mkdir('output/preferences-review',{recursive:true});const browser=await chromium.launch({channel:'msedge'});let checks=0;const check=(value,label)=>{assert(value,label);checks++;};
try{const page=await browser.newPage();
for(const [width,height] of [[1440,960],[1280,800]]){
 await page.setViewportSize({width,height});await page.goto(base+'/');await page.getByRole('button',{name:'Command',exact:true}).click();
 check(await page.locator('.command-console').getByRole('switch',{name:'Spoken replies',exact:true}).count()===0,'Composer pill removed');
 check(await page.getByRole('switch',{name:'Spoken replies',exact:true}).count()===1,'One dedicated spoken replies control remains below Omega');
 const opener=page.getByRole('button',{name:'Open preferences',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'Olympus Preferences',exact:true});await dialog.waitFor();
 await page.getByLabel('Speech provider',{exact:true}).selectOption('elevenlabs');
 const fields=await page.locator('.preferences-dialog .voice-setting-row input:not([type=checkbox]), .preferences-dialog select[aria-label="Speech provider"]').evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width})));
 check(fields.length===3&&fields.every(field=>Math.abs(field.x-fields[0].x)<1&&Math.abs(field.width-fields[0].width)<1),'Aligned voice/model fields');
 check(await page.locator('.preferences-dialog .eleven-lab').getAttribute('open')===null,'Voice Lab closed initially');
 check(await page.locator('.preferences-dialog .voice-usage').getAttribute('open')===null,'Usage closed initially');
 const box=await dialog.boundingBox();check(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Dialog within viewport');
 await page.screenshot({path:`output/preferences-review/preferences-${width}.png`});
 await page.getByText('Voice Lab · short speech tests',{exact:true}).click();await page.getByLabel('Voice Lab test script').scrollIntoViewIfNeeded();
 check(await page.getByRole('button',{name:'Close preferences',exact:true}).isVisible(),'Close remains visible after scroll');
 await page.keyboard.press('Escape');check(await dialog.count()===0,'Escape dismisses');check(await opener.evaluate(el=>el===document.activeElement),'Focus returns to preferences button');
}
console.log(`PASS ${checks} preferences alignment, disclosure, viewport and keyboard checks`);
}finally{await browser.close();}
