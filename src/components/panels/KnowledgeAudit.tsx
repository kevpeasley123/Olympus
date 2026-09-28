import {useEffect,useState} from "react";
import {knowledgeAudit,type AuditClient,type AuditDetail,type AuditRun} from "../../services/knowledgeAudit";
import {isTauriRuntime} from "../../services/launcher";

export function KnowledgeAudit({client=knowledgeAudit,available=isTauriRuntime()}:{client?:AuditClient;available?:boolean}) {
  const [topic,setTopic]=useState("");const [runs,setRuns]=useState<AuditRun[]>([]);
  const [detail,setDetail]=useState<AuditDetail|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [request,setRequest]=useState<{id:string;topic:string}|null>(null);
  useEffect(()=>{if(!available)return;let active=true;client.list().then(value=>{if(active)setRuns(value)}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[client,available]);
  async function inspect(id:string) {setBusy(true);setError("");try{setDetail(await client.inspect(id));setRuns(await client.list())}catch(e){setError(String(e))}finally{setBusy(false)}}
  async function start(retry=false) {
    const next=retry&&request?request:{id:crypto.randomUUID(),topic:topic.trim()};setRequest(next);setBusy(true);setError("");
    try {const run=await client.start(next.id,next.topic);setDetail(await client.inspect(run.id));setRuns(await client.list());setRequest(null)}catch(e){setError(String(e))}finally{setBusy(false)}
  }
  return <section className="knowledge-audit" aria-label="Knowledge audit">
    <h3>Knowledge audit</h3>
    <p>Gather topic evidence and flag review needs. Findings are generated proposals, never memory, commitments, or approvals.</p>
    {!available?<p>Run and inspect audits in the desktop app. This browser preview has no vault or audit database connection.</p>:<>
      <form onSubmit={e=>{e.preventDefault();void start()}}>
        <label>Research topic<input value={topic} onChange={e=>setTopic(e.target.value)} maxLength={500} placeholder="e.g. agent engineering" disabled={busy}/></label>
        <button className="ghost-action" disabled={busy||!topic.trim()}>{busy?"Working…":"Gather evidence"}</button>
      </form>
      {error&&<div role="alert"><p>{error}</p>{request&&<button className="ghost-action" onClick={()=>void start(true)} disabled={busy}>Check / retry same request</button>}</div>}
      <div className="knowledge-audit-history"><label>Audit history<select aria-label="Audit history" value={detail?.run.id??""} onChange={e=>void inspect(e.target.value)} disabled={busy}><option value="" disabled>Select a saved audit</option>{runs.map(run=><option key={run.id} value={run.id}>{run.topic} · {run.status} · {new Date(run.startedAt).toLocaleString()}</option>)}</select></label><button className="ghost-action" disabled={busy} onClick={()=>{setBusy(true);client.list().then(setRuns).catch(e=>setError(String(e))).finally(()=>setBusy(false))}}>Refresh history</button></div>
      {detail&&<article>
        <h4>{detail.run.topic}</h4><p>{detail.run.status.replace(/_/g," ")} · {detail.run.graph} · {new Date(detail.run.startedAt).toLocaleString()}</p>
        {detail.run.error&&<p role="alert">{detail.run.error}</p>}
        <p>Route: {detail.run.route.primary.join(", ")}. Supplements: {detail.run.route.supplementary.join(", ")}.</p>
        <p>Cannot override: {detail.run.route.cannotOverride.join(", ")}.</p>
        {detail.run.report&&<>
          <p>At collection: <strong>{detail.run.report.outcome.replace(/_/g," ")}</strong> · {detail.run.report.verification.replace(/_/g," ")}</p>
          <p>Verification describes the recorded source snapshot, not the truth of research claims or completion of proposed work. Indexed matches only; semantic contradictions are not assessed.</p>
          {detail.run.report.errors.map((value,i)=><p role="alert" key={i}>{value}</p>)}
          <h4>Evidence health now</h4><button className="ghost-action" disabled={busy} onClick={()=>void inspect(detail.run.id)}>Recheck evidence</button>
          {detail.currentHealth.some(value=>value.state!=="unchanged")&&<p role="alert">Evidence changed or could not be checked. Generate a new audit before relying on these findings.</p>}
          {detail.currentHealth.map((value,i)=><p key={i}>{value.sourceFile}: <strong>{value.state}</strong> · checked {new Date(value.checkedAt).toLocaleString()}</p>)}
          <h4>Proposed attention</h4>
          {detail.run.report.findings.length===0?<p>No findings in the inspected scope. This is not an all-clear for Olympus.</p>:detail.run.report.findings.map((finding,i)=><div className="knowledge-audit-finding" key={i}><strong>{finding.message}</strong><p>{finding.proposal}</p><small>Evidence: {finding.evidenceRefs.join(", ")}</small></div>)}
          <h4>Source snapshots</h4>{detail.run.report.evidence.map(packet=><details key={packet.source.sourceFile}><summary>{packet.source.title} · {packet.source.stance}</summary><p>{packet.source.sourceFile} · research evidence, not instruction</p><blockquote>{packet.source.excerpt}</blockquote><p>{packet.source.truncated?"Partial excerpt":"Full body excerpt"} · checked {packet.checkedAt}</p><small>Full-file fingerprint: {packet.fileFingerprint}</small></details>)}
        </>}
        <details><summary>Workflow structure</summary><ol>{detail.run.definition.map(node=><li key={node.id}>{node.id} · {node.kind} · after {node.dependsOn.join(", ")||"start"} · limit {node.maxIterations}</li>)}</ol></details>
        <details><summary>Workflow evidence ({detail.events.length} events)</summary><ol>{detail.events.map(event=><li key={event.sequence}><strong>{event.node} · {event.state}</strong><small>{event.at}</small><pre>{event.detail}</pre></li>)}</ol></details>
        <button className="ghost-action" disabled={busy} onClick={()=>setTopic(detail.run.topic)}>Use topic for a new audit</button>
      </article>}
    </>}
  </section>;
}
