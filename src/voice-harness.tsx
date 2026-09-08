import {createRoot} from "react-dom/client";
import {useState} from "react";
import {ChatPanel} from "./components/panels/ChatPanel";
import type {ConversationMessage} from "./types";
import {runRealtimeVoiceHarness} from "./services/realtimeVoice.harness";
import "./styles.css";
import {realtimeVoice} from "./services/realtimeVoice";
let appendFixture:(message:ConversationMessage)=>void;
const seed:ConversationMessage[]=[{id:"typed",role:"user",content:"What needs me?",timestamp:"12:00"},{id:"voice",role:"assistant",content:"The project board has no confirmed operator checkpoints. Seven projects have unconfirmed operational state. The details remain here in your shared conversation.",timestamp:"12:01",voice:{kind:"output",spokenResponse:"No operator checkpoints are confirmed. Seven projects still need their operational state recorded.",playback:"interrupted",requiresConfirmation:true}}];
function Fixture(){const [messages,setMessages]=useState(seed);appendFixture=message=>setMessages(current=>[...current,message]);return <><output id="results" style={{position:"fixed",top:20,left:20,color:"white",maxWidth:650}}>Ready</output><div style={{position:"fixed",right:20,bottom:20,width:380,height:"calc(100vh - 60px)",display:"flex",alignItems:"flex-end"}}><ChatPanel messages={messages} onSendMessage={text=>setMessages(current=>[...current,{id:"follow-up",role:"user",content:text,timestamp:"12:02"}])} onRecordObservation={async()=>({tone:"success",message:"Fixture only"})}/></div></>;}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
async function run(){const protocol=await runRealtimeVoiceHarness();await wait();const input=document.querySelector<HTMLTextAreaElement>('[aria-label="Command to Olympus"]')!;input.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,"Keep my typed follow-up");input.dispatchEvent(new Event("input",{bubbles:true}));await wait();document.querySelector<HTMLButtonElement>('[aria-label="Start voice conversation"]')!.click();await wait();if(input.value!=="Keep my typed follow-up")throw Error("Draft lost on voice failure");if(!document.body.textContent?.includes("desktop app"))throw Error("Missing graceful fallback");document.querySelector<HTMLButtonElement>('[aria-label="Send command"]')!.click();await wait();if(!document.body.textContent?.includes("Keep my typed follow-up"))throw Error("Text disabled after failure");if(!document.body.textContent?.includes("Playback interrupted"))throw Error("Missing interruption disclosure");if(!document.body.textContent?.includes("Authorization required"))throw Error("Missing confirmation boundary");const user=document.querySelector<HTMLElement>('.conversation-bubble.user')!;
const assistant=document.querySelector<HTMLElement>('.conversation-bubble.assistant')!;
if(user.getBoundingClientRect().left<=assistant.getBoundingClientRect().left)throw Error("Speaker alignment lost");
const details=assistant.querySelector<HTMLDetailsElement>('.console-response-details')!;
if(details.open)throw Error("Full visual response expanded by default");
details.open=true;await wait();if(!assistant.textContent?.includes("The details remain here"))throw Error("Full response missing");details.open=false;
// Inject display state only: no microphone, credentials or network in this fixture.
Object.assign(realtimeVoice.getSnapshot(),{active:true,error:null});
realtimeVoice.handleEvent({type:"input_audio_buffer.speech_started",item_id:"layout-test"});
realtimeVoice.handleEvent({type:"conversation.item.input_audio_transcription.delta",item_id:"layout-test",delta:"A live question"});await wait();
const live=document.querySelector('[data-message-id="voice-user-layout-test"]');
if(!live?.textContent?.includes("A live question"))throw Error("Live transcript missing");
appendFixture({id:"voice-user-layout-test",role:"user",content:"A live question finalized",timestamp:"12:03",voice:{kind:"input"}});await wait();
if(document.querySelectorAll('[data-message-id="voice-user-layout-test"]').length!==1)throw Error("Duplicate finalized transcript");
if(document.querySelector('[data-message-id="voice-user-layout-test"]')!==live)throw Error("Live bubble was replaced instead of finalized");
if(document.querySelector('.console-voice-status')?.textContent?.includes('A live question'))throw Error("Control bar repeats conversation");
realtimeVoice.stop();await wait();
document.getElementById("results")!.textContent=`PASS: ${protocol.passed} simulated protocol checks; draft preserved on voice failure; text send remains available; interruption and authorization visible; role alignment, response disclosure, live bubble identity and control-bar deduplication passed.`;}
if(location.search.includes("run"))void run().catch(error=>{document.getElementById("results")!.textContent=`FAIL ${String(error)}`;});
