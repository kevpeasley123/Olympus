import {useEffect,useRef,useState} from "react";
import {nativePlanClient,type PlanClient,type PlanConnection} from "../../services/chatgptPlan";
export function ChatGPTPlanConnection({client=nativePlanClient}:{client?:PlanClient}) {
  const [state,setState]=useState<PlanConnection>({available:false,phase:"disabled",message:"Checking connection availability.",generationEnabled:false});
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  const synthetic=state.synthetic!==false;
  useEffect(()=>{if(state.phase!=="awaitingBrowser")return;let active=true;const timer=setInterval(()=>{client("status").then(s=>{if(active)setState(s)},()=>{});},500);return()=>{active=false;clearInterval(timer)}},[client,state.phase]);
  useEffect(()=>{let active=true;client("status").then(s=>{if(active)setState(s)},()=>{if(active)setState({available:false,phase:"disabled",message:"Connection is unavailable in this build.",generationEnabled:false})});return()=>{active=false}},[client]);
  async function act(action:string){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{setState(await client(action))}catch{setState(s=>({...s,phase:"error",message:"Connection action failed. No model request was sent."}))}finally{inFlight.current=false;setBusy(false)}}
  return <fieldset className="claude-subscription-confirmation">
    <legend>ChatGPT plan connection</legend>
    <p>Connect Olympus to your ChatGPT plan. Your conversations and memory stay in Olympus; this connection does not import your ChatGPT history.</p>
    {state.available&&synthetic?<p><strong>Isolated test profile - synthetic account only.</strong> No browser, real credentials or provider requests.</p>:null}
    <p role="status" aria-live="polite">{state.message}</p>
    {state.phase==="awaitingBrowser"?<button className="ghost-action" onClick={()=>void act("cancel")}>Cancel connection</button>:state.phase==="awaitingConsent"?<div role="group" aria-label="Synthetic consent">
      <button className="ghost-action" disabled={busy} onClick={()=>void act("approve")}>Approve synthetic connection</button>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("cancel")}>Back / cancel</button>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("expired")}>Simulate expiry</button>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("mismatch")}>Simulate account mismatch</button>
    </div>:<button className="ghost-action" disabled={busy||!state.available} onClick={()=>void act("connect")}>Continue with ChatGPT</button>}
    {state.available&&!["awaitingConsent","awaitingBrowser"].includes(state.phase)?<div>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("disconnect")}>{synthetic?"Disconnect test account":"Disconnect account"}</button>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("renew")}>{synthetic?"Test renewal":"Renew connection"}</button>
      {synthetic?<>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("renewFail")}>Simulate renewal failure</button>
      <button className="ghost-action" disabled={busy} onClick={()=>void act("revokeFail")}>Simulate revocation failure</button>
      </>:null}
    </div>:null}
    <p>Generation remains blocked.</p>
    <p>Before the first reply, verify Olympus in ChatGPT Settings &gt; Usage &gt; App limits and confirm that other apps cannot use credits after reaching your usage limit. Connecting alone will not start a conversation.</p>
  </fieldset>;
}
