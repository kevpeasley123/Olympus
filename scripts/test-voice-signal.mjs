import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Pure analysis and state checks, then the dock in a browser against the
// running dev server (`npm run dev`). Every audio source is synthetic.
await mkdir('output/tests',{recursive:true});
await mkdir('output/voice-signal-review',{recursive:true});
await build({entryPoints:['src/services/voiceSignal.harness.ts'],bundle:true,format:'esm',platform:'neutral',outfile:'output/tests/voiceSignal.harness.mjs',logLevel:'warning'});
const {runVoiceSignalHarness}=await import('../output/tests/voiceSignal.harness.mjs');
const unit=runVoiceSignalHarness().passed;

const base=process.argv[2]??'http://127.0.0.1:31420';
const browser=await chromium.launch({...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--autoplay-policy=no-user-gesture-required']});
let passed=0;const check=(ok,label)=>{assert(ok,label);passed++;};
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 page.on('pageerror',error=>errors.push(String(error)));
 const signal=page.locator('.olympus-signal');
 /** Bar peaks (px) and sources sampled over about three seconds. */
 const observe=async query=>{
  await page.goto(`${base}/voice-signal-harness.html?${query}`);
  await page.waitForSelector('.olympus-signal[data-signal-state]');
  await page.waitForTimeout(900);
  return signal.evaluate(async canvas=>{const peaks=[],sources=new Set();for(let i=0;i<14;i++){await new Promise(r=>setTimeout(r,220));peaks.push(Number(canvas.dataset.signalPeak));sources.add(canvas.dataset.signalSource);}return {peaks,sources:[...sources],cost:Number(canvas.dataset.signalCost),state:canvas.dataset.signalState};});
 };

 const speaking=await observe('state=speaking&source=clip');
 check(speaking.state==='speaking'&&speaking.sources.includes('live'),'Speaking reads a decoded reply clip');
 check(Math.max(...speaking.peaks)>=40,`Speech lifts the waveform (peak ${Math.max(...speaking.peaks)}px)`);
 check(Math.max(...speaking.peaks)-Math.min(...speaking.peaks)>=15,'The waveform follows syllables and pauses, not a fixed shape');
 check(await page.locator('.olympus-voice-dock__status').innerText().then(t=>/speaking/i.test(t)),'Speaking is named');
 check(await page.getByRole('img',{name:'Voice speaking',exact:true}).count()===1,'The signal has an accessible state name');
 check(speaking.cost<4,`Frame cost stays small (${speaking.cost} ms)`);
 await page.screenshot({path:'output/voice-signal-review/speaking.png'});

 const ambient=await observe('state=speaking&source=none');
 check(ambient.sources.every(s=>s==='none'),'Without analysable audio nothing claims to be live');
 check(Math.max(...ambient.peaks)<=24,'Without audio the waveform stays a presence, not speech');

 const listening=await observe('state=listening&source=stream');
 check(listening.sources.includes('live')&&Math.max(...listening.peaks)>=30,'Listening reads the input stream');
 check(await page.getByRole('img',{name:'Microphone on',exact:true}).count()===1,'The microphone shows its own status mark while on');

 const idle=await observe('state=idle');
 check(Math.max(...idle.peaks)<=16&&Math.min(...idle.peaks)>=2,'Idle breathes low but never vanishes');
 check(await page.locator('.olympus-voice-dock__status').innerText()==='','Idle shows no status text');
 check(await page.getByRole('img',{name:'Microphone on'}).count()===0,'No microphone mark while it is off');
 await page.screenshot({path:'output/voice-signal-review/idle.png'});

 const thinking=await observe('state=thinking');
 check(Math.max(...thinking.peaks)<=12,'Thinking keeps the waveform quiet');
 const off=await observe('state=off');
 check(Math.max(...off.peaks)<=8,'Off dims the waveform to a resting line');

 // The switch: one spoken-replies control, by keyboard, independent of the microphone.
 await page.goto(`${base}/voice-signal-harness.html?state=idle`);
 const toggle=page.getByRole('switch',{name:'Spoken replies',exact:true});
 check(await toggle.count()===1&&await toggle.getAttribute('aria-checked')==='true','One spoken replies switch, on');
 check((await toggle.getAttribute('title'))?.includes('microphone'),'Its tooltip separates it from the microphone');
 await toggle.focus();await page.keyboard.press('Space');
 check(await toggle.getAttribute('aria-checked')==='false','Keyboard turns spoken replies off');
 await page.waitForTimeout(700);
 check(await signal.getAttribute('data-signal-state')==='off','The signal dims when spoken replies are off');
 const box=await toggle.boundingBox();
 check(box&&box.width<=60&&box.height<=32,`The switch is compact (${box?.width}x${box?.height})`);

 // Switching away from speech releases the audio source.
 await page.goto(`${base}/voice-signal-harness.html?state=speaking&source=clip`);
 await page.waitForTimeout(900);
 await page.getByRole('button',{name:'idle',exact:true}).click();
 await page.waitForTimeout(700);
 check(await signal.getAttribute('data-signal-source')==='none','Leaving speech detaches the reply audio');

 // Reduced motion: one composed frame, no loop.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`${base}/voice-signal-harness.html?state=speaking&source=clip`);
 await page.waitForSelector('.olympus-signal[data-signal-state]');
 await page.waitForTimeout(400);
 check(await signal.getAttribute('data-animated')===null,'Reduced motion runs no animation loop');
 const a=await signal.screenshot();await page.waitForTimeout(500);const b=await signal.screenshot();
 check(Buffer.compare(a,b)===0,'Reduced motion holds a still frame');
 check(Number(await signal.getAttribute('data-signal-peak'))>=12,'The still frame still shows the waveform');
 await page.emulateMedia({reducedMotion:'no-preference'});

 // In Command: the heading is gone and the dock sits beneath the Omega.
 await page.setViewportSize({width:1448,height:1000});
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=idle&voice=speaking&level=0.8`);
 await page.waitForSelector('.olympus-voice-dock');
 check(await page.locator('.command-instrument').getByText('Pantheon',{exact:true}).count()===0,'The Pantheon heading is removed');
 const dial=await page.locator('.command-instrument__dial').boundingBox();
 const dock=await page.locator('.olympus-signal').boundingBox();
 check(dock&&dial&&Math.abs(dock.x+dock.width/2-(dial.x+dial.width/2))<2,'The signal is centred beneath the Omega');
 check(dock.y+dock.height/2>dial.y+dial.height*0.85,'The signal line sits below the Omega and its constellations');
 const vault=await page.locator('.vault-constellation__label').boundingBox();
 check(!vault||dock.y+dock.height/2-46>vault.y+vault.height,'The waveform halo clears the memory label');
 await page.screenshot({path:'output/voice-signal-review/command.png'});
 check(errors.length===0,`No page errors: ${errors.join('; ')}`);
}finally{await browser.close();}
console.log(`PASS ${unit} voice analysis checks and ${passed} voice signal browser checks (synthetic audio only)`);
