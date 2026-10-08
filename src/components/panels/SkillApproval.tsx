import {useEffect,useState,useSyncExternalStore} from "react";
import {Modal} from "../Modal";
import {resolveSkillReview,skillReviewSnapshot,subscribeSkillReview} from "../../services/skillRecommendations";
import "./resourceIntake.css";

export function SkillApproval(){
 const review=useSyncExternalStore(subscribeSkillReview,skillReviewSnapshot);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!review)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[review]);
 return <Modal open={!!review} title="Use a suggested skill?" onClose={()=>resolveSkillReview(undefined)} className="resource-dialog">
  {review&&<div className="resource-form">
   <p className="resource-notice">Olympus matched this task to locally reviewed skill metadata. The full instructions have not been sent to the assistant.</p>
   <details><summary>Current task</summary><pre>{review.task}</pre></details>
   {review.recommendations.map(r=><section key={r.proposalId}>
    <h3>{r.name}</h3><p>{r.description}</p><p>{r.reason}</p>
    <p className="resource-notice">{r.byteCount.toLocaleString()} bytes · {r.provider} / {r.model} · this request only</p>
    <details><summary>Version and source</summary><p className="resource-guidance">{r.version}<br/>{r.source}<br/>SHA256: {r.contentHash}</p></details>
    <button disabled={r.expiresAt*1000<=now} onClick={()=>resolveSkillReview(r.proposalId)}>{r.expiresAt*1000<=now?"Review expired; cancel and retry":`Use ${r.name} for this request`}</button>
   </section>)}
   <p className="resource-notice">Approval sends the complete selected instructions with your task to the displayed model provider. It grants no tools, dependency installation, redesign, or deployment authority. Other assistant context follows the existing chat settings.</p>
   <footer><button onClick={()=>resolveSkillReview(undefined)}>Cancel request</button><button onClick={()=>resolveSkillReview(null)}>Continue without a skill</button></footer>
  </div>}
 </Modal>;
}
