import {createRoot} from "react-dom/client";
import {useEffect,useState} from "react";
import {VoiceSettings} from "./components/panels/VoiceSettings";
import {loadState,persistPreferences} from "./services/storage";
import {seedState} from "./data/seed";
import {normalizeVoicePreferences} from "./services/voicePreferences";
import "./styles.css";
function Fixture(){
  const [state,setState]=useState(seedState);const [ready,setReady]=useState(false);
  useEffect(()=>{void loadState().then(value=>{setState(value);setReady(true);});},[]);
  useEffect(()=>{if(ready)void persistPreferences(state);},[state,ready]);
  return <><output id="results">{ready ? "Ready" : "Loading"}</output><section className="settings-panel floating-preferences-panel" style={{right:30,bottom:30}}>
    <h2>Olympus Voice</h2><VoiceSettings ready={ready} preferences={state.settings} onChange={patch=>setState(current=>({...current,settings:{...current.settings,...normalizeVoicePreferences({...current.settings,...patch})}}))}/>
  </section></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,500));
const result=()=>document.getElementById("results")!;
async function run(){
  await wait();await wait();
  if(location.search.includes("restored")){
    const saved=await loadState();
    if(saved.settings.selectedVoice!=="verse" || saved.settings.speechStyle!=="concise" || saved.settings.responseDepth!=="detailed" || saved.settings.autoSpeak || saved.settings.captionsEnabled || saved.settings.bargeInEnabled)throw Error("Reload lost preferences");
    result().textContent="PASS: all six preferences restored after actual page reload.";return;
  }
  const before=await loadState();
  document.querySelector<HTMLButtonElement>('[aria-label="Use verse as Olympus voice"]')!.click();await wait();
  if(document.querySelectorAll('.voice-catalog > div').length!==10)throw Error("Missing voices");
  for(const [label,value] of [["Speaking Style","concise"],["Response Depth","detailed"]]){
    const select=document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;select.value=value;select.dispatchEvent(new Event("change",{bubbles:true}));await wait();
  }
  for(const input of document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')){if(input.checked)input.click();await wait();}
  [...document.querySelectorAll('button')].find(button=>button.textContent==="Preview")!.click();await wait();
  if(!document.body.textContent?.includes("desktop app"))throw Error("Preview failure not surfaced");
  const after=await loadState();
  if(JSON.stringify(before.conversation)!==JSON.stringify(after.conversation)||JSON.stringify(before.projects)!==JSON.stringify(after.projects))throw Error("Preferences changed conversation or projects");
  result().textContent="PASS: ten voices, controls, preview failure and context preservation. Reloading to verify persistence…";
  location.search="?restored";
}
if(location.search)void run().catch(error=>{result().textContent=`FAIL: ${String(error)}`;});
