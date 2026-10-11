import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/voice-lab-review',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:600,height:1100}});
 await page.addInitScript(()=>{
  window.labRequests=[];window.labPlays=0;
  Object.defineProperty(HTMLMediaElement.prototype,'src',{set(){},get(){return ''},configurable:true});
  HTMLMediaElement.prototype.play=async function(){window.labPlays++;};HTMLMediaElement.prototype.pause=function(){};HTMLMediaElement.prototype.load=function(){};
  navigator.mediaDevices.getUserMedia=async()=>{throw Error('Microphone must never be requested');};
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   if(command==='elevenlabs_status')return {configured:true};
   if(command==='voice_usage')return {credits:42,confirmed:2,unconfirmed:1,notSubmitted:1,transcriptionRequests:1,transcriptionTokens:12,transcriptionUnconfirmed:0,openaiSpeechRequests:0};
   if(command==='elevenlabs_synthesize'){window.labRequests.push(args);return {audioBase64:'AA=='};}
   if(command==='elevenlabs_cancel')return;
   throw Error('Unexpected native call '+command);
  }};
 });
 await page.goto('http://127.0.0.1:31420/voice-lab-harness.html');
 const generate=page.getByRole('button',{name:'Generate',exact:true});await generate.waitFor();
 await generate.click();assert.equal(await page.evaluate(()=>window.labRequests.length),1);
 assert.equal(await page.evaluate(()=>window.labRequests[0].lab),true);
 await page.getByRole('button',{name:'Stop',exact:true}).click();await page.getByRole('button',{name:'Replay',exact:true}).click();assert.equal(await page.evaluate(()=>window.labRequests.length),1);assert.equal(await page.evaluate(()=>window.labPlays),2);
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.getByLabel('Voice Lab test script').fill('one two three four five six');assert(await generate.isDisabled());assert(await page.getByRole('button',{name:'Replay',exact:true}).isDisabled());
 await page.getByLabel('Voice Lab test script').fill('Olympus, tell me something useful.');
 await page.getByLabel('USD per 1000 voice credits').fill('1');assert(await page.getByText('Estimated ElevenLabs value:',{exact:false}).innerText().then(s=>s.includes('$0.0420')));
 assert(await page.getByText('Voice session · 42 credits + unconfirmed',{exact:true}).isVisible());
 await page.screenshot({path:'output/voice-lab-review/lab.png',fullPage:true});
 await page.setViewportSize({width:380,height:850});assert(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth));await page.screenshot({path:'output/voice-lab-review/lab-narrow.png',fullPage:true});
 console.log('PASS Voice Lab browser: explicit generation, cached replay, limits, invalidation, cost estimate and narrow layout (synthetic only)');
}finally{await browser.close();}
