import {createRoot} from "react-dom/client";
import {useEffect,useState} from "react";
import {ChatPanel} from "./components/panels/ChatPanel";
import {realtimeVoice, type VoiceDependencies} from "./services/realtimeVoice";
import {DEFAULT_VOICE_PREFERENCES} from "./services/voicePreferences";
import type {ConversationMessage} from "./types";
import "./styles.css";

// Browser-only fixture. No credentials, network, microphone, or actual playback.
let captures=0,requests=0;
const events:any[]=[];
const summary="I can answer your typed messages aloud while the microphone stays off.";
const deps:VoiceDependencies={
  secret:async()=>({value:"fixture-only",expires_at:Date.now()/1000+60}),
  microphone:async()=>{captures++;throw Error("This fixture must never open a microphone");},
  audio:()=>({muted:true,pause:()=>{},play:async()=>{}} as unknown as HTMLAudioElement),
  exchange:async()=>"fixture-answer",
  peer:()=>{
    const dc={readyState:"open",send:(raw:string)=>events.push(JSON.parse(raw)),close:()=>{},onopen:null} as unknown as RTCDataChannel;
    return {addTransceiver:()=>{},createDataChannel:()=>dc,createOffer:async()=>({sdp:"fixture"}),setLocalDescription:async()=>{},setRemoteDescription:async()=>{dc.onopen?.({} as Event);},connectionState:"connected",close:()=>{}} as unknown as RTCPeerConnection;
  }
};
// Keep production transport injection private; replace only in this test entry point.
Object.assign(realtimeVoice,{deps});
function Fixture(){
  const [messages,setMessages]=useState<ConversationMessage[]>([]),[pending,setPending]=useState(false);
  const [autoSpeak,setAutoSpeak]=useState(DEFAULT_VOICE_PREFERENCES.autoSpeak);
  useEffect(()=>{void realtimeVoice.applyPreferences({...DEFAULT_VOICE_PREFERENCES,autoSpeak});},[autoSpeak]);
  useEffect(()=>{
    realtimeVoice.configure({
      answer:async(text,depth,id)=>{
        requests++;setPending(true);
        setMessages(current=>[...current,{id:id??"typed-user",role:"user",content:text,timestamp:"12:00",voice:id?{kind:"input"}:undefined}]);
        await new Promise(resolve=>setTimeout(resolve,40));
        const answer={spokenResponse:summary,visualResponse:"The full written response is preserved. Auto Speak uses the selected Olympus voice for typed replies, with no microphone capture.",proposedActions:[],requiresConfirmation:false,conversationState:"awaiting_input",messageId:"typed-reply"};
        setMessages(current=>[...current,{id:answer.messageId,role:"assistant",content:answer.visualResponse,timestamp:"12:01",voice:depth?{kind:"output",spokenResponse:summary,playback:"pending"}:undefined}]);
        setPending(false);return answer;
      },
      update:(id,metadata)=>setMessages(current=>current.map(message=>message.id===id&&message.voice?{...message,voice:{...message.voice,...metadata}}:message)),
      navigate:()=>{throw Error("No navigation in this fixture");}
    });
    return ()=>realtimeVoice.stop();
  },[]);
  return <><output id="results" style={{position:"fixed",top:24,left:24,color:"white",maxWidth:500}}>Ready — simulated typed speech</output><div style={{position:"fixed",right:24,bottom:24,width:480,maxWidth:"calc(100vw - 48px)"}}><ChatPanel autoSpeak={autoSpeak} onAutoSpeakChange={setAutoSpeak} messages={messages} pending={pending} onSendMessage={text=>void realtimeVoice.sendText(text)} onRecordObservation={async()=>({tone:"success",message:"Fixture only"})}/></div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,120));
function check(ok:unknown,message:string){if(!ok)throw Error(message);}
async function run(){
  await wait();
  const input=document.querySelector<HTMLTextAreaElement>('[aria-label="Command to Olympus"]')!;
  input.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,"Please say something aloud.");input.dispatchEvent(new Event("input",{bubbles:true}));await wait();
  document.querySelector<HTMLButtonElement>('[aria-label="Send command"]')!.click();await wait();
  check(captures===0&&requests===1,"Typed reply must not activate capture or duplicate reasoning");
  check(document.querySelector('[data-message-id="typed-user"] [aria-label="Text"]'),"Typed input must retain its keyboard label");
  check(document.querySelector('[aria-label="Start voice conversation"]')?.getAttribute('aria-pressed')==="false","Microphone button must remain off during output");
  check(document.querySelector('.console-voice-status')?.textContent?.includes('microphone off'),"Show audio-only state accurately");
  check(document.body.textContent?.includes("Preparing audio"),"Do not claim playback during generation");
  let created=events.filter(event=>event.type==="response.create");
  realtimeVoice.handleEvent({type:"response.created",response:{id:"fixture-output",metadata:created[0].response.metadata}});
  realtimeVoice.handleEvent({type:"output_audio_buffer.started",response_id:"fixture-output"});await wait();
  check(document.body.textContent?.includes("Playing"),"Show actual playback state");
  realtimeVoice.handleEvent({type:"response.output_audio_transcript.delta",response_id:"fixture-output",delta:summary});
  realtimeVoice.handleEvent({type:"output_audio_buffer.stopped",response_id:"fixture-output"});await wait();
  check(document.body.textContent?.includes("Played")&&!realtimeVoice.getSnapshot().active,"Completed receipt closes audio session");
  const replay=[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==="Replay")!;
  check(!replay.disabled,"Replay available without microphone");replay.click();await wait();created=events.filter(event=>event.type==="response.create");
  check(created.length===2&&requests===1&&captures===0,"Replay reconnects audio without repeating the chat turn");
  realtimeVoice.handleEvent({type:"response.created",response:{id:"fixture-replay",metadata:created[1].response.metadata}});
  realtimeVoice.handleEvent({type:"error",error:{code:"fixture_playback_failure",message:"Simulated output failure"}});await wait();
  check(document.body.textContent?.includes("Audio unavailable · text preserved"),"Failed replay must not say played");
  check(document.body.textContent?.includes("The full written response is preserved"),"Audio failure preserves full written response");
  check(!replay.disabled,"A failed replay can be retried without activating microphone");
  replay.click();await wait();created=events.filter(event=>event.type==="response.create");
  realtimeVoice.handleEvent({type:"response.created",response:{id:"fixture-mode-switch",metadata:created[2].response.metadata}});
  realtimeVoice.handleEvent({type:"output_audio_buffer.started",response_id:"fixture-mode-switch"});await wait();
  document.querySelector<HTMLButtonElement>('[aria-label="Text-only replies"]')!.click();await wait();
  check(!realtimeVoice.getSnapshot().active&&document.body.textContent?.includes("Playback interrupted"),"Switching to Text stops current spoken output");
  check(document.querySelector('[aria-label="Text-only replies"]')?.getAttribute('aria-pressed')==="true","Text mode selected");
  document.querySelector<HTMLButtonElement>('[aria-label="Voice and text replies"]')!.click();await wait();
  check(!realtimeVoice.getSnapshot().active&&captures===0&&events.filter(event=>event.type==="response.create").length===3,"Selecting Voice must not activate capture or replay old audio");
  document.getElementById("results")!.textContent="PASS: typed speech, keyboard label, microphone off, playback receipts, Replay, audio failure fallback, and reply-mode switching during playback. All audio/network objects are simulated.";
}
if(location.search.includes("run"))void run().catch(error=>{document.getElementById("results")!.textContent=`FAIL: ${String(error)}`;});
