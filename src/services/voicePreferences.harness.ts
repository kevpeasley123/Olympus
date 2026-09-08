import { RealtimeVoice, type VoiceDependencies } from "./realtimeVoice";
import { DEFAULT_VOICE_PREFERENCES as defaults, OLYMPUS_VOICES, normalizeVoicePreferences, preferredDepth, readVoicePreferences, VOICE_PREVIEW_PHRASE } from "./voicePreferences";
export async function runVoicePreferencesHarness() {
  let passed=0;const check=(value:unknown,label:string)=>{if(!value)throw Error(label);passed++;};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  let captures=0,closed=0,trackStops=0;const sent:any[]=[];const secrets:any[]=[];const history:string[]=[];const projectContext={id:"olympus",status:"UNKNOWN"};
  const tracks:Array<{enabled:boolean;stop:()=>void;onended:null}>=[];
  const deps:VoiceDependencies={
    secret:async(settings,preview)=>{secrets.push({settings:{...settings},preview});return {value:"test-only",expires_at:Date.now()/1000+60};},
    microphone:async()=>{captures++;const track={enabled:true,stop:()=>{trackStops++;},onended:null};tracks.push(track);return {getTracks:()=>[track]} as unknown as MediaStream;},
    audio:()=>({play:async()=>{},pause:()=>{},muted:false} as unknown as HTMLAudioElement),
    exchange:async()=>"answer",
    peer:()=>{const dc={readyState:"open",onopen:null,send:(raw:string)=>sent.push(JSON.parse(raw)),close:()=>{}} as unknown as RTCDataChannel;
      return {addTrack:()=>{},addTransceiver:()=>{},createDataChannel:()=>dc,createOffer:async()=>({sdp:"fixture"}),setLocalDescription:async()=>{},setRemoteDescription:async()=>dc.onopen?.({} as Event),close:()=>{closed++;},connectionState:"connected"} as unknown as RTCPeerConnection;}
  };
  const session=new RealtimeVoice(deps);
  session.configure({answer:async(text,depth,id)=>{history.push(`${id}:${text}:${depth}:${projectContext.id}`);return {spokenResponse:"Ready for review.",visualResponse:"The complete project detail.",proposedActions:[],requiresConfirmation:false,conversationState:"awaiting_input",messageId:"reply"};},update:()=>{},navigate:()=>{throw Error("Unexpected project mutation");}});
  const utterance=async(id:string)=>{session.handleEvent({type:"input_audio_buffer.speech_started",item_id:id});session.handleEvent({type:"conversation.item.input_audio_transcription.completed",item_id:id,transcript:"status"});await tick();};
  await session.applyPreferences({...defaults,selectedVoice:"cedar"});
  check(captures===0,"Changing an idle preference must not activate microphone");
  await session.start();check(secrets[secrets.length-1].settings.selectedVoice==="cedar","Voice used at session creation");
  await session.applyPreferences({...defaults,selectedVoice:"ash"});
  check(captures===2 && closed===1 && trackStops===1,"Voice switch before speech reconnects and releases old capture");
  await utterance("first");session.handleEvent({type:"response.created",response:{id:"r1",metadata:sent[sent.length-1].response.metadata}});session.handleEvent({type:"output_audio_buffer.started",response_id:"r1"});
  check(session.getSnapshot().phase==="SPEAKING","Fixture reaches actual speaking state");
  const saved=[...history];await session.applyPreferences({...defaults,selectedVoice:"coral"});
  check(session.getSnapshot().active && captures===3 && trackStops===2,"Switch while speaking reconnects microphone");
  check(JSON.stringify(history)===JSON.stringify(saved) && projectContext.id==="olympus","Switch preserves transcript and project context without new turn");
  session.handleEvent({type:"output_audio_buffer.started",response_id:"r1"});check(session.getSnapshot().phase!=="SPEAKING","Old-session audio cannot resume");
  await utterance("second");session.handleEvent({type:"response.created",response:{id:"r2",metadata:sent[sent.length-1].response.metadata}});session.handleEvent({type:"output_audio_buffer.started",response_id:"r2"});session.handleEvent({type:"output_audio_buffer.stopped",response_id:"r2"});
  await session.applyPreferences({...defaults,selectedVoice:"echo"});check(captures===4 && session.getSnapshot().active,"Switch after completed audio recreates session");
  await utterance("third");session.handleEvent({type:"response.created",response:{id:"r3",metadata:sent[sent.length-1].response.metadata}});session.handleEvent({type:"output_audio_buffer.started",response_id:"r3"});session.handleEvent({type:"input_audio_buffer.speech_started",item_id:"barge"});
  check(sent.some(event=>event.type==="response.cancel" && event.response_id==="r3"),"Barge-in works after voice changes");
  await session.applyPreferences({...defaults,bargeInEnabled:false});await utterance("no-barge");
  check(tracks[tracks.length-1]?.enabled===false,"Interruption off pauses microphone during output");
  const count=history.length;await utterance("ignored");check(history.length===count,"Speech during protected playback is not a new turn");
  session.interrupt();check(tracks[tracks.length-1]?.enabled===true,"Manual interrupt restores capture");
  await session.applyPreferences({...defaults,autoSpeak:false,captionsEnabled:false});const responses=sent.filter(e=>e.type==="response.create").length;await utterance("silent");
  check(sent.filter(e=>e.type==="response.create").length===responses && history.length===count+1,"Auto Speak off keeps visual answer without generating speech");
  check(!session.getSnapshot().captionsEnabled,"Live captions setting reaches renderer");
  session.stop();const beforePreview=history.length, capturesBefore=captures;
  await session.startPreview({...defaults,selectedVoice:"sage"});
  check(captures===capturesBefore && secrets[secrets.length-1].preview,"Preview is receive-only without microphone");
  check(sent[sent.length-1].response.input[0].content[0].text===JSON.stringify({spokenResponse:VOICE_PREVIEW_PHRASE}),"Preview uses centralized fixed phrase");
  session.handleEvent({type:"input_audio_buffer.speech_started",item_id:"preview-no-input"});check(history.length===beforePreview,"Preview bypasses conversation and reasoning");
  session.handleEvent({type:"response.created",response:{id:"preview",metadata:sent[sent.length-1].response.metadata}});session.handleEvent({type:"output_audio_buffer.stopped",response_id:"preview"});check(!session.getSnapshot().active,"Preview closes connection on completion");
  const custom={...defaults,selectedVoice:"verse",speechStyle:"concise" as const,responseDepth:"detailed" as const,autoSpeak:false,captionsEnabled:false,bargeInEnabled:false};
  check(JSON.stringify(readVoicePreferences(JSON.stringify(custom)))===JSON.stringify(custom),"All six preferences survive serialization");
  check(normalizeVoicePreferences({selectedVoice:"invalid"}).selectedVoice===defaults.selectedVoice,"Unknown voice falls back safely");
  check(OLYMPUS_VOICES.length===10 && new Set(OLYMPUS_VOICES).size===10,"Catalog contains current ten unique voices");
  check(preferredDepth("status",{...defaults,responseDepth:"brief"})==="SHORT" && preferredDepth("status",defaults)==="ANSWER" && preferredDepth("status",custom)==="DEEP_DIVE","Depth settings preserve bounded voice contract");
  return {passed};
}
