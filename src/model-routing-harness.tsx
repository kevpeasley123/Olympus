import {mockIPC} from "@tauri-apps/api/mocks";
import {createRoot} from "react-dom/client";
import {ModelRouteControl,ModelDiagnostics} from "./components/panels/ModelSettings";
import {consumeNextModel} from "./services/modelRouting";
import "./styles.css";
mockIPC(command=>{
 if(command==="model_routes")return {routes:[{capability:"PRIMARY",label:"Primary fixture",model:"primary-fixture",provider:"openai",effort:"medium"},{capability:"DEEP_REASONING",label:"Deep fixture",model:"deep-fixture",provider:"openai",effort:"high"},{capability:"CLAUDE_COMPARISON",label:"Comparison fixture",model:"comparison-fixture",provider:"anthropic",effort:"medium"}],realtime:"voice-fixture",transcription:"transcribe-fixture",coding:"coding-fixture"};
 if(command==="model_diagnostics")return [{id:"fixture-record",provider:"openai",requestedModel:"primary-fixture",actualModel:"actual-fixture-snapshot",capability:"PRIMARY",purpose:"command",status:"completed",latencyMs:123,usage:{input_tokens:20,output_tokens:10}}];
 throw Error(`Unexpected command ${command}`);
});
createRoot(document.getElementById("root")!).render(<main className="settings-panel" style={{margin:40,maxWidth:440}}><output id="result">Waiting</output><ModelRouteControl/><ModelDiagnostics/></main>);
const wait=()=>new Promise(r=>setTimeout(r,600));
async function run(){
 await wait();
 const trigger=document.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
 trigger.click();await wait();
 const options=[...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
 if(options.length!==3)throw Error("Backend catalog not rendered");
 if(!options[0].textContent?.includes("SOL")||!options[1].textContent?.includes("ASTRA"))throw Error("Friendly route names missing");
 options[1].click();await wait();
 if(!trigger.textContent?.includes("ASTRA")||document.querySelector('[role="menu"]'))throw Error("Selection not reflected or menu stayed open");
 if(consumeNextModel()!=="DEEP_REASONING"||consumeNextModel()!=="PRIMARY")throw Error("Escalation not one-shot");
 await wait();if(!trigger.textContent?.includes("SOL"))throw Error("UI did not reset");
 trigger.click();await wait();
 document.querySelector<HTMLElement>('[role="menuitemradio"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
 await wait();if(document.querySelector('[role="menu"]')||document.activeElement!==trigger)throw Error("Escape did not close menu and restore focus");
 document.querySelector<HTMLDetailsElement>('.model-diagnostics')!.open=true;await wait();
 if(!document.body.textContent?.includes("actual-fixture-snapshot"))throw Error("Actual model missing");
 document.getElementById("result")!.textContent="PASS: backend catalog, friendly names, one-shot selection, UI reset, Escape focus and actual-model diagnostics";
}
void run().catch(e=>{document.getElementById("result")!.textContent=`FAIL: ${e}`;});
