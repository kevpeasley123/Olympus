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
async function run(){await wait();const select=document.querySelector<HTMLSelectElement>('select')!;if(select.options.length!==3)throw Error("Backend catalog not rendered");select.value="DEEP_REASONING";select.dispatchEvent(new Event("change",{bubbles:true}));await wait();if(consumeNextModel()!=="DEEP_REASONING"||consumeNextModel()!=="PRIMARY")throw Error("Escalation not one-shot");await wait();if(select.value!=="PRIMARY")throw Error("UI did not reset");document.querySelector<HTMLDetailsElement>('.model-diagnostics')!.open=true;await wait();if(!document.body.textContent?.includes("actual-fixture-snapshot"))throw Error("Actual model missing");document.getElementById("result")!.textContent="PASS: backend catalog, explicit one-shot escalation, UI reset and actual-model diagnostics";}
void run().catch(e=>{document.getElementById("result")!.textContent=`FAIL: ${e}`;});
