import { RealtimeVoice, type VoiceDependencies } from "./realtimeVoice";
import { DEFAULT_VOICE_PREFERENCES as defaults } from "./voicePreferences";
import type { VoiceAnswer, VoiceDepth, VoiceMessageMetadata } from "./voiceContract";

export async function runTypedVoiceHarness() {
  let passed=0;
  const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);passed++;};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  const answer:VoiceAnswer={spokenResponse:"Your typed message reached Olympus.",visualResponse:"Full written detail stays in the conversation.",proposedActions:[],requiresConfirmation:false,conversationState:"awaiting_input",messageId:"typed-answer"};
  function fixture({delayed=false,failSecret=false,failPlay=false}={}) {
    let captures=0,stops=0;
    const sent:any[]=[],secrets:any[]=[],transceivers:any[]=[],calls:Array<{text:string;depth?:VoiceDepth;id?:string}>=[];
    const updates:Array<{id:string;metadata:Partial<VoiceMessageMetadata>}>=[];
    let dc:RTCDataChannel;
    const audio={muted:true,pause:()=>{},play:async()=>{if(failPlay)throw Error("blocked");}} as unknown as HTMLAudioElement;
    const deps:VoiceDependencies={
      secret:async(settings,preview)=>{secrets.push({settings,preview});if(failSecret)throw Error("Voice unavailable for this test");return {value:"fixture-only",expires_at:Date.now()/1000+60};},
      microphone:async()=>{captures++;return {getTracks:()=>[{stop:()=>stops++,enabled:true}]} as unknown as MediaStream;},
      audio:()=>audio,exchange:async()=>"answer",
      peer:()=>{
        dc={readyState:"connecting",onopen:null,send:(raw:string)=>sent.push(JSON.parse(raw)),close:()=>{}} as unknown as RTCDataChannel;
        return {addTrack:()=>{},addTransceiver:(_:string,options:unknown)=>transceivers.push(options),createDataChannel:()=>dc,createOffer:async()=>({sdp:"fixture"}),setLocalDescription:async()=>{},setRemoteDescription:async()=>{if(!delayed)open();},close:()=>{},connectionState:"connected"} as unknown as RTCPeerConnection;
      }
    };
    function open(){Object.defineProperty(dc,"readyState",{value:"open",configurable:true});dc.onopen?.({} as Event);}
    const voice=new RealtimeVoice(deps);
    let resolveAnswer:((value:VoiceAnswer)=>void)|undefined;
    voice.configure({answer:async(text,depth,id)=>{calls.push({text,depth,id});if(text==="slow")return new Promise(resolve=>{resolveAnswer=resolve;});return answer;},update:(id,metadata)=>updates.push({id,metadata}),navigate:()=>{throw Error("No navigation requested");}});
    function beginOutput(){
      const responses=sent.filter(e=>e.type==="response.create");
      const response=responses[responses.length-1];
      voice.handleEvent({type:"response.created",response:{id:"audio",metadata:response.response.metadata}});
      voice.handleEvent({type:"output_audio_buffer.started",response_id:"audio"});
    }
    return {voice,sent,secrets,transceivers,calls,updates,audio,open,beginOutput,captures:()=>captures,stops:()=>stops,resolve:()=>resolveAnswer!(answer)};
  }
  const f=fixture({delayed:true});
  await f.voice.applyPreferences({...defaults,selectedVoice:"cedar"});
  const sending=f.voice.sendText("Say hello to my typed message");
  await tick();
  check(f.calls.length===1&&f.calls[0].depth==="ANSWER"&&f.calls[0].id===undefined,"Typed input uses one shared reasoning call and has no transcription ID");
  check(f.captures()===0&&f.transceivers[0].direction==="recvonly"&&f.secrets[0].preview,"Typed speech is receive-only and disables VAD without microphone permission");
  check(f.secrets[0].settings.selectedVoice==="cedar","Typed speech respects selected voice");
  check(f.voice.getSnapshot().connecting&&!f.voice.getSnapshot().microphoneOn&&!f.sent.some(e=>e.type==="response.create"),"Wait for data channel readiness instead of dropping first reply");
  f.open();await sending;
  const payload=f.sent.find(e=>e.type==="response.create").response;
  check(payload.conversation==="none"&&payload.input[0].content[0].text===JSON.stringify({spokenResponse:answer.spokenResponse}),"Only the real reply's spoken summary reaches audio; no preview sample or second reasoning answer");
  check(f.voice.getSnapshot().phase==="PROCESSING","Audio generation alone is not labelled speaking");
  f.beginOutput();check(f.voice.getSnapshot().phase==="SPEAKING","Output buffer starts the speaking instrument state");
  f.voice.handleEvent({type:"response.done",response:{id:"audio",status:"completed"}});
  check(!f.updates.some(u=>u.metadata.playback==="completed"),"Generation completion is not a playback receipt");
  f.voice.handleEvent({type:"response.output_audio_transcript.delta",response_id:"audio",delta:answer.spokenResponse});
  f.voice.handleEvent({type:"output_audio_buffer.stopped",response_id:"audio"});
  check(f.updates.some(u=>u.id===answer.messageId&&u.metadata.playback==="completed"&&u.metadata.audioTranscript===answer.spokenResponse),"Actual completed playback attaches to the saved reply");
  check(!f.voice.getSnapshot().active&&f.captures()===0,"Typed audio closes after playback without arming a microphone");
  const before=f.sent.length;f.voice.handleEvent({type:"conversation.item.input_audio_transcription.completed",item_id:"unexpected",transcript:"injected"});await tick();
  check(f.calls.length===1&&f.sent.length===before,"Audio-only sessions ignore input transcription events");
  f.voice.stop();

  const silent=fixture();await silent.voice.applyPreferences({...defaults,autoSpeak:false});await silent.voice.sendText("Keep this silent");
  check(silent.secrets.length===0&&silent.calls[0].depth===undefined,"Auto Speak off sends normal text without opening an audio connection");
  await silent.voice.replay(answer.spokenResponse,answer.messageId);
  check(silent.captures()===0&&silent.calls.length===1&&silent.sent.some(e=>e.type==="response.create"),"Explicit Replay works with Auto Speak off and no microphone or new reasoning turn");silent.voice.stop();

  const preview=fixture();await preview.voice.sendText("Browser-only preview",false);
  check(preview.secrets.length===0&&preview.calls[0].depth===undefined,"Browser preview stays on its available text route");preview.voice.stop();
  const switched=fixture();await switched.voice.start();await switched.voice.sendText("Typed follow-up");
  check(switched.captures()===1&&switched.stops()===1&&!switched.voice.getSnapshot().microphoneOn,"Typing releases a previously armed microphone and receives audio only");switched.voice.stop();

  const stopped=fixture({delayed:true});const waiting=stopped.voice.sendText("status");await tick();stopped.voice.stop();await waiting;stopped.open();
  check(!stopped.sent.some(e=>e.type==="response.create")&&stopped.updates.some(u=>u.metadata.playback==="interrupted"),"Stopping during connection prevents late audio and records interruption");stopped.voice.stop();
  const late=fixture();const pending=late.voice.sendText("slow");await tick();late.voice.interrupt();late.resolve();await pending;
  check(!late.sent.some(e=>e.type==="response.create")&&late.updates.some(u=>u.metadata.playback==="interrupted"),"Interrupting reasoning suppresses late audio while preserving the answer");late.voice.stop();
  const toggled=fixture();const togglePending=toggled.voice.sendText("slow");await tick();await toggled.voice.applyPreferences({...defaults,autoSpeak:false});toggled.resolve();await togglePending;
  check(!toggled.sent.some(e=>e.type==="response.create")&&!toggled.voice.getSnapshot().active,"Disabling Auto Speak cancels pending typed audio");toggled.voice.stop();
  const changed=fixture();const changing=changed.voice.sendText("slow");await tick();await changed.voice.applyPreferences({...defaults,selectedVoice:"cedar"});changed.resolve();await changing;
  check(changed.captures()===0&&!changed.sent.some(e=>e.type==="response.create"),"Voice preference reconnect preserves output-only mode and rejects the stale answer");changed.voice.stop();
  const failed=fixture({failSecret:true});await failed.voice.sendText("status");
  check(failed.calls.length===1&&failed.voice.getSnapshot().phase==="ERROR"&&failed.updates.some(u=>u.metadata.playback==="unavailable"),"Audio connection failure preserves the written answer with unavailable status");failed.voice.stop();
  const blocked=fixture({failPlay:true});await blocked.voice.sendText("status");blocked.beginOutput();await tick();
  check(blocked.voice.getSnapshot().phase==="ERROR"&&blocked.updates.some(u=>u.metadata.playback==="unavailable"),"Playback device/autoplay failure is unavailable, not played or user-interrupted");blocked.voice.stop();
  return {passed};
}
