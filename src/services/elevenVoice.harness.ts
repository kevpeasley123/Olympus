import { RealtimeVoice, type VoiceDependencies } from "./realtimeVoice";
import { DEFAULT_VOICE_PREFERENCES, normalizeVoicePreferences } from "./voicePreferences";

export async function runElevenVoiceHarness() {
  let passed=0;
  const check=(value:unknown,label:string)=>{if(!value)throw Error(label);passed++;};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  const migrated=normalizeVoicePreferences({selectedVoice:"cedar"});
  check(migrated.speechProvider==="openai" && migrated.elevenVoiceId==="NOpBlnGInO9m6vDvFkFC", "Old preferences retain OpenAI and initialize the chosen ElevenLabs voice");
  check(normalizeVoicePreferences({elevenVoiceId:"../bad",elevenModelId:""}).elevenModelId==="eleven_v4", "Invalid provider settings normalize safely");
  function fixture(stall=false) {
    let secrets=0, microphones=0, plays=0, pauses=0;
    const requests:any[]=[], cancels:string[]=[], updates:any[]=[];
    let resolve!:(data:{audioBase64:string})=>void, reject!:(error:Error)=>void;
    const audio={muted:false,src:"",onended:null,onerror:null,pause:()=>pauses++,play:async()=>{plays++;if(stall)await new Promise(()=>{});},removeAttribute:()=>{},load:()=>{}} as unknown as HTMLAudioElement;
    const deps:VoiceDependencies={secret:async()=>{secrets++;throw Error("No OpenAI request allowed");},microphone:async()=>{microphones++;throw Error("No mic allowed");},peer:()=>{throw Error("No peer allowed");},exchange:async()=>"",audio:()=>audio,
      elevenSynthesize:async request=>{requests.push(request);return new Promise((yes,no)=>{resolve=yes;reject=no;});},elevenCancel:async id=>{cancels.push(id);}};
    const voice=new RealtimeVoice(deps);
    voice.configure({answer:async()=>({spokenResponse:"Hello Kevin.",visualResponse:"Written detail.",messageId:"reply",proposedActions:[],requiresConfirmation:false,conversationState:"awaiting_input"}),update:(_,metadata)=>updates.push(metadata),navigate:()=>{}});
    return {voice,audio,requests,cancels,updates,resolve:()=>resolve({audioBase64:"SUQz"}),reject:()=>reject(Error("ElevenLabs quota unavailable")),secrets:()=>secrets,microphones:()=>microphones,plays:()=>plays,pauses:()=>pauses};
  }
  const prefs={...DEFAULT_VOICE_PREFERENCES,speechProvider:"elevenlabs" as const,autoSpeak:true};
  const toggle=fixture();
  await toggle.voice.applyPreferences({...DEFAULT_VOICE_PREFERENCES,speechProvider:'openai',autoSpeak:false});
  toggle.voice.mute();
  const enabled=toggle.voice.setSpokenReplies(true);
  check(enabled.autoSpeak&&enabled.speechProvider==='elevenlabs','Spoken reply switch chooses ElevenLabs even from OpenAI preferences');
  check(!toggle.voice.getSnapshot().muted&&!toggle.voice.getSnapshot().microphoneOn,'Enabling spoken replies unmutes output without enabling input');
  check(toggle.secrets()===0&&toggle.microphones()===0&&toggle.requests.length===0,'Toggle alone never requests credentials, microphone or paid synthesis');
  await toggle.voice.sendText('Read my typed reply');
  check(toggle.requests.length===1&&toggle.secrets()===0&&toggle.microphones()===0,'Typed reply after toggle uses ElevenLabs only');
  const disabled=toggle.voice.setSpokenReplies(false);toggle.resolve();await tick();
  check(!disabled.autoSpeak&&toggle.plays()===0&&toggle.cancels.length===1,'Turning spoken replies off cancels pending speech and ignores late audio');
  await toggle.voice.sendText('Stay silent');
  check(toggle.requests.length===1,'Later typed replies stay silent after toggling off');toggle.voice.stop();
  const f=fixture();await f.voice.applyPreferences(prefs);await f.voice.sendText("hello");
  check(f.requests.length===1&&f.requests[0].voiceId===prefs.elevenVoiceId&&f.requests[0].modelId==="eleven_v4","Selected voice and model reach one native synthesis request");
  check(f.secrets()===0&&f.microphones()===0,"Typed ElevenLabs speech never opens OpenAI audio or microphone");
  f.resolve();await tick();check(f.plays()===1&&f.voice.getSnapshot().phase==="SPEAKING","Playback starts after audio arrives");
  check(!f.updates.some(x=>x.playback==="completed"),"Synthesis is not playback completion");
  f.audio.onended?.({} as Event);check(f.updates.some(x=>x.playback==="completed")&&!f.voice.getSnapshot().active,"Only ended audio marks completion and closes output-only session");f.voice.stop();
  const late=fixture();await late.voice.applyPreferences(prefs);await late.voice.sendText("hello");late.voice.interrupt();late.resolve();await tick();
  check(late.plays()===0&&late.cancels.length===1&&late.updates.some(x=>x.playback==="interrupted"),"Interrupt cancels native synthesis and rejects late playback");late.voice.stop();
  const fail=fixture();await fail.voice.applyPreferences(prefs);await fail.voice.sendText("hello");fail.reject();await tick();
  check(fail.requests.length===1&&fail.secrets()===0&&fail.voice.getSnapshot().phase==="ERROR"&&fail.updates.some(x=>x.playback==="unavailable"),"Provider failure preserves text without retry or fallback");fail.voice.stop();
  const silent=fixture();await silent.voice.applyPreferences({...prefs,autoSpeak:false});await silent.voice.sendText("hello");
  check(silent.requests.length===0,"Auto Speak off suppresses paid synthesis");await silent.voice.replay("Replay this","reply");check(silent.requests.length===1,"Explicit replay works with Auto Speak off");silent.voice.stop();silent.resolve();await tick();
  const changed=fixture();await changed.voice.applyPreferences(prefs);await changed.voice.sendText("hello");await changed.voice.applyPreferences({...prefs,elevenVoiceId:"OtherVoice"});changed.resolve();await tick();check(changed.plays()===0,"Changing voice suppresses stale playback");changed.voice.stop();
  const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
  const timers=new Map<number,{fn:()=>void;delay:number}>();let next=1;
  globalThis.setTimeout=((fn:()=>void,delay:number)=>{const id=next++;timers.set(id,{fn,delay});return id;}) as unknown as typeof setTimeout;
  globalThis.clearTimeout=((id:number)=>{timers.delete(id);}) as unknown as typeof clearTimeout;
  try{
    const long=fixture();await long.voice.applyPreferences(prefs);await long.voice.sendText("hello");long.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    check(![...timers.values()].some(t=>t.delay===120000),"Active synthesis/playback has no idle cutoff");long.voice.stop();timers.clear();
    const stall=fixture(true);await stall.voice.applyPreferences(prefs);await stall.voice.sendText("hello");stall.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    const watchdog=[...timers.values()].find(t=>t.delay===180000);check(!!watchdog,"Playback watchdog is armed even when play never settles");watchdog!.fn();
    check(stall.voice.getSnapshot().phase==="ERROR"&&stall.updates.some(x=>x.playback==="unavailable"),"Stalled playback fails visibly and releases output");stall.voice.stop();
  }finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
  return {passed};
}
