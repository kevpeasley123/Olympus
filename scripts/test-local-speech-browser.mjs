// Development acceptance with synthetic audio and the same offline worker used by Tauri.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const python=process.env.OLYMPUS_VOICE_PYTHON??resolve('.local-voice/runtime/Scripts/python.exe');
const models=process.env.OLYMPUS_VOICE_MODELS??resolve('.local-voice/models');
function worker(kind,value){
  return new Promise((done,fail)=>{
    const child=spawn(python,['-I','-X','utf8','src-tauri/src/commands/local_speech.py'],{
      windowsHide:true,env:{...process.env,OLYMPUS_VOICE_MODELS:models,HF_HUB_OFFLINE:'1'},
      stdio:['pipe','pipe','pipe'],timeout:120000,
    });
    const chunks=[];child.stdout.on('data',chunk=>chunks.push(chunk));
    child.on('error',fail);
    child.on('close',()=>{
      try {const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!result.value)throw Error(result.error??'No speech');done(result.value);}
      catch(e){fail(e);}
    });
    child.stdin.end(JSON.stringify({kind,value}));
  });
}
const wav=resolve('output/skill-backbone/microphone-fixture.wav');
await mkdir('output/skill-backbone',{recursive:true});
await writeFile(wav,Buffer.from(await worker('speak','Olympus project review is ready.'),'base64'));
const browser=await chromium.launch({channel:'msedge',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+wav,'--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({permissions:['microphone'],viewport:{width:1672,height:941}});
  await page.exposeFunction('localSpeechFixture',worker);
  await page.goto('http://127.0.0.1:31430/harness/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
  await page.waitForSelector('[data-scene-ready="true"]');
  await page.evaluate(()=>{
    const api=window.__TAURI_INTERNALS__, prior=api.invoke;
    api.invoke=(cmd,args,...rest)=>cmd==='local_speech'?window.localSpeechFixture(args.kind,args.value):cmd==='cancel_local_speech'?Promise.resolve():prior(cmd,args,...rest);
  });
  const control=page.locator('.local-speech');
  await control.locator('summary').click();
  await control.getByRole('button',{name:'Dictate'}).click();
  await control.getByText('Listening locally',{exact:true}).waitFor();
  await page.waitForTimeout(3000);
  await control.getByRole('button',{name:'Finish dictation'}).click();
  await control.getByText('Transcript ready to review',{exact:true}).waitFor({timeout:120000});
  const draft=await page.getByLabel('Command to Olympus').inputValue();
  assert.match(draft,/project review/i);
  assert.match(draft,/ready/i);
  console.log('PASS synthetic microphone → browser PCM → offline Whisper → editable composer, with rotating flagship active.');
}finally{await browser.close();}
