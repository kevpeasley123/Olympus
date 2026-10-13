import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31420';
await mkdir('output/voice-control-review',{recursive:true});const browser=await chromium.launch({channel:'msedge'});let passed=0;const check=(ok,label)=>{assert(ok,label);passed++;};
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto(base+'/voice-control-harness.html');const toggle=page.getByRole('switch',{name:'Voice conversation'});
 check(await toggle.getAttribute('aria-checked')==='false','Off initially');await toggle.focus();await page.keyboard.press('Space');check(await toggle.getAttribute('aria-checked')==='true','Keyboard starts connecting');check(await toggle.innerText().then(s=>s.includes('Connecting')),'No premature listening claim');await page.keyboard.press('Enter');check(await toggle.getAttribute('aria-checked')==='false','Keyboard cancels connecting');
 await page.getByRole('button',{name:'Simulate connected',exact:true}).click();check((await toggle.innerText()).includes('Listening · Mic on'),'Real capture represented');await page.screenshot({path:'output/voice-control-review/simulated-listening.png'});
 await toggle.click();check((await toggle.innerText()).includes('Voice off'),'Click stops');
 await page.getByRole('button',{name:'Simulate paused microphone'}).click();check((await toggle.innerText()).includes('Mic paused'),'Paused capture distinguished');
 await page.getByRole('button',{name:'Simulate failure'}).click();check(await toggle.getAttribute('aria-checked')==='false'&&(await toggle.innerText()).includes('Mic off'),'Failure releases switch state');
 const spoken=page.getByRole('switch',{name:'Spoken replies',exact:true});
 await spoken.focus();await page.keyboard.press('Space');check(await spoken.getAttribute('aria-checked')==='true','Keyboard enables spoken reply preference');check(await toggle.getAttribute('aria-checked')==='false','Spoken reply toggle leaves microphone switch off');await page.keyboard.press('Enter');check(await spoken.getAttribute('aria-checked')==='false','Keyboard disables spoken replies');
 for(const [width,height] of [[1440,960],[1280,800],[1920,1080]]){
  await page.setViewportSize({width,height});await page.goto(base);await page.getByRole('button',{name:'Command',exact:true}).click();await page.locator('[data-flagship][data-scene-ready="true"]').waitFor();
  check(await page.getByRole('switch',{name:'Spoken replies',exact:true}).count()===1,'One primary voice switch');check(await page.locator('.voice-mic-button').count()===1,'One separate microphone button in the shared console');check(await page.locator('.console-spoken-replies').count()===0,'No redundant composer spoken replies control');
  const box=await page.getByRole('switch',{name:'Spoken replies',exact:true}).boundingBox();check(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Voice switch within viewport');
  check(await page.getByRole('switch',{name:'Spoken replies',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Primary toggle receives pointer input');
  await page.screenshot({path:`output/voice-control-review/command-${width}.png`});
 }
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.olympus-voice-toggle__track>span').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s','Reduced motion respected');
 console.log(`PASS ${passed} voice-control browser checks (synthetic only)`);
}finally{await browser.close();}
