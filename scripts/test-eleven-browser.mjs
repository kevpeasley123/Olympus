import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31448';
const output='output/elevenlabs-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
let passed=0;const check=(ok,label)=>{assert(ok,label);passed++;};
try{
 for(const [width,height] of [[1440,960],[1280,800],[1920,1080]]){
  const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByRole('button',{name:'Open preferences',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Olympus Preferences'});
  await dialog.getByLabel('Speech provider',{exact:true}).selectOption('elevenlabs');
  check(await dialog.getByLabel('ElevenLabs voice ID').inputValue()==='NOpBlnGInO9m6vDvFkFC','Chosen voice visible');
  check(await dialog.getByLabel('ElevenLabs speech model').inputValue()==='eleven_v4','Explicit model visible');
  check((await dialog.getByLabel('ElevenLabs voice ID').boundingBox()).width>=240,'Voice ID field has room to read the full ID');
  await dialog.getByText('Manage API connection',{exact:true}).click();
  check(await dialog.getByRole('button',{name:'Connect API key',exact:true}).isDisabled(),'Browser cannot access credentials');
  await dialog.getByText('Manage API connection',{exact:true}).click();
  check(await dialog.getByRole('button',{name:'Preview voice',exact:true}).isDisabled(),'Browser cannot spend speech credits');
  await dialog.getByLabel('ElevenLabs voice ID').fill('ChangedVoice123');await dialog.getByRole('button',{name:'Save voice settings'}).click();
  await page.reload();await page.getByRole('button',{name:'Open preferences',exact:true}).click();
  check(await dialog.getByLabel('ElevenLabs voice ID').inputValue()==='ChangedVoice123','Provider settings survive reload');
  await dialog.getByLabel('ElevenLabs voice ID').fill('NOpBlnGInO9m6vDvFkFC');await dialog.getByRole('button',{name:'Save voice settings'}).click();
  await dialog.getByLabel('ElevenLabs voice ID').scrollIntoViewIfNeeded();
  const overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+2);check(!overflow,'Settings have no horizontal clipping');
  await page.screenshot({path:`${output}/settings-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');check(await dialog.count()===0,'Escape closes Preferences');check(errors.length===0,errors.join('\n'));
  await context.close();
 }
 console.log(`PASS ${passed} ElevenLabs browser settings checks; screenshots: ${output}`);
}finally{await browser.close();}
