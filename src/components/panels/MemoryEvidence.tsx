import {useEffect,useState} from "react";
import {loadMemoryEvidence,type MemoryPacket} from "../../services/memory";
import {openVaultNote} from "../../services/launcher";
import "./memoryEvidence.css";

/** Loaded only when response details open. A saved packet describes what the
 * backend prepared, not a claim that the model used every supplied passage. */
export function MemoryEvidence({requestId}:{requestId:string}) {
  const [packet,setPacket]=useState<MemoryPacket|null>(null);
  const [state,setState]=useState("Loading memory evidence…");
  const [openError,setOpenError]=useState("");
  useEffect(()=>{let current=true;setPacket(null);setState("Loading memory evidence…");
    void loadMemoryEvidence(requestId).then(value=>{if(current){setPacket(value);setState(value?"":"No indexed memory receipt for this response.");}},()=>{if(current)setState("Memory evidence could not be loaded.");});
    return()=>{current=false;};
  },[requestId]);
  return <section className="memory-evidence" aria-label="Memory evidence">
    <p>{state||`Memory: ${packet?.status.replace(/_/g," ")} · ${packet?.sources.length} ${packet?.sources.length===1?"passage":"passages"}`}</p>
    {packet&&<>
      <p>Prepared for this request. Source notes may have changed since this snapshot.</p>
      <p>Scope: {packet.scope.join(", ")||"No project scope"}</p>
      {openError&&<p role="status">{openError}</p>}
      {packet.warnings.length>0&&<ul>{packet.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
      {packet.sources.map((source,index)=><details key={`${source.record.id}-${index}`}>
        <summary>{source.record.title} · {source.record.kind}</summary>
        <p>{source.record.path}{source.heading?` · ${source.heading}`:""}</p>
        <button type="button" className="ghost-action" onClick={()=>{setOpenError("");void openVaultNote(source.record.path).then(result=>{if(result==="unsupported")setOpenError("Source notes open from the desktop app.");},()=>setOpenError("The source note could not be opened."));}}>Open source note</button>
        <p>{source.reason}. Recorded status: {source.record.status}; this is not execution approval.</p>
        <p>Source date: {source.record.sourceDate??"Unknown"} · Observed: {source.record.observedAt??"Unknown"} · Recorded: {source.record.recordedAt??"Unknown"}</p>
        <blockquote>{source.excerpt}</blockquote>
        <p>Revision: <code>{source.record.revision}</code> · Bytes {source.start}–{source.end}</p>
        {source.record.warnings.map((warning,i)=><p key={i}>{warning}</p>)}
      </details>)}
    </>}
  </section>;
}
