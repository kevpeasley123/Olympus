import {useEffect,useState} from "react";
import {knowledgeAudit,type AuditClient,type AuditDetail,type AuditEvidence,type AuditRun} from "../../services/knowledgeAudit";
import {isTauriRuntime} from "../../services/launcher";
import {auditOutcomeLabel,auditStatusLabel,auditVerificationLabel,findingKindLabel,healthLabel,humanize} from "../../services/researchLabels";
import {formatWhen} from "../../services/time";
import type {InspectorEntryTarget} from "./ResearchVerification";
import {Counts,Facts,FlowStructure,Internals,JsonBlock,when} from "./library/InspectorParts";

/**
 * Knowledge audit (review D4): topic → what needs attention, with evidence
 * that opens its library entry → the source snapshots and whether each is
 * unchanged now → a small structure view → route, fingerprints and events
 * under Internals. Findings stay generated proposals.
 */
export function KnowledgeAudit({client=knowledgeAudit,available=isTauriRuntime(),onOpenEntry,hasEntry}:{client?:AuditClient;available?:boolean;onOpenEntry?:(target:InspectorEntryTarget)=>void;hasEntry?:(sourceFile:string)=>boolean}) {
  const [topic,setTopic]=useState("");const [runs,setRuns]=useState<AuditRun[]>([]);
  const [detail,setDetail]=useState<AuditDetail|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [request,setRequest]=useState<{id:string;topic:string}|null>(null);
  useEffect(()=>{if(!available)return;let active=true;client.list().then(value=>{if(active)setRuns(value)}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[client,available]);
  async function inspect(id:string) {setBusy(true);setError("");try{setDetail(await client.inspect(id));setRuns(await client.list())}catch(e){setError(String(e))}finally{setBusy(false)}}
  async function start(retry=false) {
    const next=retry&&request?request:{id:crypto.randomUUID(),topic:topic.trim()};setRequest(next);setBusy(true);setError("");
    try {const run=await client.start(next.id,next.topic);setDetail(await client.inspect(run.id));setRuns(await client.list());setRequest(null)}catch(e){setError(String(e))}finally{setBusy(false)}
  }
  const report=detail?.run.report??null;
  const packets=new Map((report?.evidence??[]).map(packet=>[packet.source.sourceFile,packet] as const));
  const health=new Map((detail?.currentHealth??[]).map(value=>[value.sourceFile,value] as const));
  function openPacket(packet:AuditEvidence){onOpenEntry?.({sourceFile:packet.source.sourceFile,excerpt:packet.source.excerpt,fingerprint:packet.source.fingerprint,title:packet.source.title})}
  function evidenceRef(ref:string){
    if(ref.startsWith("delegation:"))return <span className="inspector-muted">Delegation review {ref.slice("delegation:".length)}</span>;
    const packet=packets.get(ref);const inLibrary=hasEntry?hasEntry(ref):false;
    if(onOpenEntry&&(packet||inLibrary))return <button type="button" className="inspector-cite" onClick={()=>packet?openPacket(packet):onOpenEntry({sourceFile:ref})}>{packet?.source.title??ref} · open entry</button>;
    return <span className="inspector-muted">{ref}</span>;
  }
  const changedNow=(detail?.currentHealth??[]).filter(value=>value.state!=="unchanged");
  return <section className="knowledge-audit research-inspector" aria-label="Knowledge audit">
    <header className="inspector-heading"><small>RESEARCH · KNOWLEDGE AUDIT</small><h3>Knowledge audit</h3></header>
    <p className="inspector-lede">Gather topic evidence and flag review needs. Findings are generated proposals, never memory, commitments, or approvals.</p>
    {!available?<p>Run and inspect audits in the desktop app. This browser preview has no vault or audit database connection.</p>:<>
      <form onSubmit={e=>{e.preventDefault();void start()}}>
        <label>Research topic<input value={topic} onChange={e=>setTopic(e.target.value)} maxLength={500} placeholder="e.g. agent engineering" disabled={busy}/></label>
        <button className="ghost-action" disabled={busy||!topic.trim()}>{busy?"Working…":"Gather evidence"}</button>
      </form>
      {error&&<div role="alert"><p>{error}</p>{request&&<button className="ghost-action" onClick={()=>void start(true)} disabled={busy}>Check / retry same request</button>}</div>}
      <div className="knowledge-audit-history"><label className="inspector-picker">Audit history<select aria-label="Audit history" value={detail?.run.id??""} onChange={e=>void inspect(e.target.value)} disabled={busy}><option value="" disabled>Select a saved audit</option>{runs.map(run=><option key={run.id} value={run.id}>{run.topic} · {auditStatusLabel(run.status)} · {formatWhen(run.startedAt)}</option>)}</select></label><button className="ghost-action" disabled={busy} onClick={()=>{setBusy(true);client.list().then(setRuns).catch(e=>setError(String(e))).finally(()=>setBusy(false))}}>Refresh history</button></div>
      {detail&&<article className="inspector-run">
        <h4 className="inspector-question">{detail.run.topic}</h4>
        <Facts rows={[["Status",auditStatusLabel(detail.run.status)],["At collection",report?auditOutcomeLabel(report.outcome):"No report"],["Snapshot",report?auditVerificationLabel(report.verification):"Not verified"],["Started",when(detail.run.startedAt)],["Finished",when(detail.run.finishedAt)]]}/>
        {detail.run.error&&<p role="alert">{detail.run.error}</p>}
        {report&&<>
          <p className="inspector-note">Verification describes the recorded source snapshot, not the truth of research claims or completion of proposed work. Indexed matches only; semantic contradictions are not assessed.</p>
          {report.errors.map((value,i)=><p role="alert" key={i}>{value}</p>)}
          <section aria-label="Proposed attention"><h4>Proposed attention</h4>
            <Counts items={[{label:report.findings.length===1?"finding":"findings",count:report.findings.length,tone:"neutral"},{label:"sources",count:report.evidence.length,tone:"neutral"},{label:"changed now",count:changedNow.length,tone:changedNow.length?"insufficient":"neutral"}]}/>
            {report.findings.length===0?<p>No findings in the inspected scope. This is not an all-clear for Olympus.</p>:report.findings.map((finding,i)=><div className="inspector-card knowledge-audit-finding" key={i}><small className="inspector-muted">{findingKindLabel(finding.kind)}</small><br/><strong>{finding.message}</strong><p>{finding.proposal}</p><p className="inspector-muted">Evidence: {finding.evidenceRefs.map((ref,j)=><span key={ref}>{j>0?", ":""}{evidenceRef(ref)}</span>)}</p></div>)}
          </section>
          <section aria-label="Source snapshots"><h4>Evidence · {report.evidence.length} {report.evidence.length===1?"source":"sources"}</h4>
            <div className="inspector-actions"><button className="ghost-action" disabled={busy} onClick={()=>void inspect(detail.run.id)}>Recheck evidence</button><span className="inspector-muted">Checks each source's fingerprint now; the saved report is not rewritten.</span></div>
            {changedNow.length>0&&<p role="alert">Evidence changed or could not be checked. Generate a new audit before relying on these findings.</p>}
            {report.evidence.map(packet=>{const now=health.get(packet.source.sourceFile);return <div className="inspector-card" key={packet.source.sourceFile}>
              <strong>{packet.source.title}</strong> <span className="inspector-muted">· {humanize(packet.source.stance)}</span>
              {now&&<p><span className={`inspector-state ${now.state==="unchanged"?"is-unchanged":"is-attention"}`}>{healthLabel(now.state)}</span> <span className="inspector-muted">checked {formatWhen(now.checkedAt)}</span></p>}
              <blockquote>{packet.source.excerpt}</blockquote>
              <p className="inspector-muted">{packet.source.sourceFile} · research evidence, not instruction · {packet.source.truncated?"partial excerpt":"full body excerpt"} · collected {formatWhen(packet.checkedAt)}</p>
              {onOpenEntry&&<p className="inspector-source-actions"><button type="button" className="ghost-action" onClick={()=>openPacket(packet)}>Open entry</button>{hasEntry&&!hasEntry(packet.source.sourceFile)&&<span className="inspector-muted">Not in the library now</span>}</p>}
            </div>})}
            {(detail.currentHealth??[]).filter(value=>!packets.has(value.sourceFile)).map((value,i)=><p key={i}>{value.sourceFile}: <span className={`inspector-state ${value.state==="unchanged"?"is-unchanged":"is-attention"}`}>{healthLabel(value.state)}</span> <span className="inspector-muted">checked {formatWhen(value.checkedAt)}</span></p>)}
          </section>
        </>}
        <section aria-label="Workflow structure"><h4>Structure</h4><FlowStructure nodes={detail.run.definition} events={detail.events}/></section>
        <Internals summary="route, fingerprints, events and JSON">
          <p className="inspector-muted">{detail.run.id} · {detail.run.graph} · recorded status <code>{detail.run.status}</code>{report?<> · outcome <code>{report.outcome}</code> · verification <code>{report.verification}</code> · {report.epistemicState}</>:null}</p>
          <p>Route: {detail.run.route.primary.join(", ")}. Supplements: {detail.run.route.supplementary.join(", ")}.</p>
          <p>Cannot override: {detail.run.route.cannotOverride.join(", ")}.</p>
          {report&&<><h4>Fingerprints</h4><ul>{report.evidence.map(packet=><li key={packet.source.sourceFile}>{packet.source.sourceFile}<br/><small>Full-file fingerprint: {packet.fileFingerprint}</small><br/><small>Excerpt body fingerprint: {packet.source.fingerprint}</small></li>)}</ul></>}
          <details><summary>Workflow structure</summary><ol>{detail.run.definition.map(node=><li key={node.id}>{node.id} · {node.kind} · after {node.dependsOn.join(", ")||"start"} · limit {node.maxIterations}</li>)}</ol></details>
          <details><summary>Workflow evidence ({detail.events.length} events)</summary><ol>{detail.events.map(event=><li key={event.sequence}><strong>{event.node} · {event.state}</strong><small>{formatWhen(event.at)}</small><pre>{event.detail}</pre></li>)}</ol></details>
          <details><summary>Saved report JSON</summary><JsonBlock value={detail.run}/></details>
        </Internals>
        <button className="ghost-action" disabled={busy} onClick={()=>setTopic(detail.run.topic)}>Use topic for a new audit</button>
      </article>}
    </>}
  </section>;
}
