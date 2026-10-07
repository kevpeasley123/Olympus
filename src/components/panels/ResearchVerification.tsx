import {useEffect,useRef,useState} from "react";
import {isTauriRuntime} from "../../services/launcher";
import {researchVerification,type ResearchClient,type AgentCatalog,type AgentDefinition,type RunSummary,type ResearchRun,type Citation,type ResearchOutput,type Source,type VerificationOutput} from "../../services/researchVerification";
import {runStatusLabel,verdictLabel,humanize} from "../../services/researchLabels";
import {formatWhen} from "../../services/time";
import {Counts,Facts,FlowStructure,Internals,JsonBlock,isFlowNodeList,when} from "./library/InspectorParts";
import "./researchVerification.css";

export interface InspectorEntryTarget {sourceFile:string;excerpt?:string;fingerprint?:string;title?:string}

function Definition({value,label}:{value:AgentDefinition;label:string}) {const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus()},[value]);return <section aria-label={label} className="inspector-card">
  <h4 ref={heading} tabIndex={-1}>{value.name} @{value.version} · {label}</h4><p>{value.purpose}</p>
  <p><strong>Access:</strong> {value.allowedSources.join("; ")}</p><p><strong>Capabilities:</strong> {value.capabilities.join(", ")}</p>
  <p><strong>Cannot:</strong> {value.prohibitedEffects.join(", ")}</p><p>Model strategy: {value.modelStrategy.requestedModel} · {value.modelStrategy.reasoningEffort}. Actual returned model is recorded per request.</p>
  <p>Skills: {value.skills.join(", ")}. Communication peers: {value.peers.join(", ")}, only within declared workflow edges. Maximum clarification rounds: {value.maxClarifications}.</p>
  <p>{value.evidenceRequirements}</p><details><summary>Input/output contract</summary><JsonBlock value={{input:value.inputSchema,output:value.outputSchema,handler:value.handler}}/></details>
</section>}

/**
 * Verified questions (review D4): the question, the Olympus brief with its
 * counts, claims whose citations open their saved excerpt, the excerpts as
 * evidence cards, a small structure view, and receipts and JSON under
 * Internals. Reading history never reruns anything.
 */
export function ResearchVerification({client=researchVerification,available=isTauriRuntime(),requestedRunId,inspectionOnly=false,onReturn,onOpenEntry,hasEntry}:{client?:ResearchClient;available?:boolean;requestedRunId?:string;inspectionOnly?:boolean;onReturn?:()=>void;onOpenEntry?:(target:InspectorEntryTarget)=>void;hasEntry?:(sourceFile:string)=>boolean}) {
  const [catalog,setCatalog]=useState<AgentCatalog|null>(null),[runs,setRuns]=useState<RunSummary[]>([]),[run,setRun]=useState<ResearchRun|null>(null);
  const [question,setQuestion]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[cancelPending,setCancelPending]=useState(false);
  const [agent,setAgent]=useState<AgentDefinition|null>(null),[historical,setHistorical]=useState(false),[showCatalog,setShowCatalog]=useState(false);
  const [openSources,setOpenSources]=useState<Set<string>>(()=>new Set());const [reveal,setReveal]=useState<{id:string;n:number}|null>(null);
  const agentOrigin=useRef<HTMLButtonElement|null>(null);const generation=useRef(0);const mounted=useRef(true);const [pending,setPending]=useState<{id:string;question:string}|null>(null);
  const inspectionHeading=useRef<HTMLHeadingElement|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++}},[]);
  useEffect(()=>{if(!available)return;let active=true;Promise.all([client.catalog(),client.list()]).then(([c,r])=>{if(active){setCatalog(c);setRuns(r)}}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[available,client]);
  useEffect(()=>{if(available&&requestedRunId)void inspect(requestedRunId)},[available,client,requestedRunId]);
  useEffect(()=>{if(inspectionOnly)inspectionHeading.current?.focus()},[inspectionOnly,requestedRunId]);
  useEffect(()=>{
    if(!run||run.status!=="running")return;
    let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const value=await client.inspect(run!.id);if(active){setRun(value);if(value.status==="running")timer=setTimeout(()=>void poll(),1000);else{setCancelPending(false);setRuns(await client.list())}}}catch(e){if(active){setError(String(e));timer=setTimeout(()=>void poll(),3000)}}}
    timer=setTimeout(()=>void poll(),500);return()=>{active=false;clearTimeout(timer)};
  },[client,run?.id,run?.status]);
  // A citation opens its saved excerpt, brings it into view and moves focus there.
  useEffect(()=>{if(!reveal)return;const node=document.getElementById(`rv-${reveal.id}`);if(!node)return;node.scrollIntoView({block:"start"});node.querySelector<HTMLElement>("summary")?.focus({preventScroll:true})},[reveal]);
  async function inspect(id:string){const current=++generation.current;setBusy(true);setError("");try{const value=await client.inspect(id);if(mounted.current&&current===generation.current){setRun(value);setAgent(null);setCancelPending(false);setOpenSources(new Set())}}catch(e){if(mounted.current&&current===generation.current)setError(String(e))}finally{if(mounted.current&&current===generation.current)setBusy(false)}}
  async function refresh(){setError("");try{const [c,r]=await Promise.all([client.catalog(),client.list()]);if(mounted.current){setCatalog(c);setRuns(r)}}catch(e){if(mounted.current)setError(String(e))}}
  async function start(retry=false){const request=retry&&pending?pending:{id:crypto.randomUUID(),question:question.trim()};setPending(request);const current=++generation.current;setBusy(true);setError("");try{const value=await client.start(request.id,request.question);if(mounted.current&&current===generation.current){setRun(value);setPending(null);setAgent(null);setCancelPending(false);await refresh()}}catch(e){if(mounted.current&&current===generation.current)setError(String(e))}finally{if(mounted.current&&current===generation.current)setBusy(false)}}
  async function cancel(){if(!run)return;setCancelPending(true);try{await client.cancel(run.id)}catch(e){setError(String(e));setCancelPending(false)}}
  function revealSource(id:string){setOpenSources(previous=>new Set(previous).add(id));setReveal(previous=>({id,n:(previous?.n??0)+1}))}
  const running=run?.status==="running"||runs.some(r=>r.status==="running");
  const sourceById=new Map((run?.sources??[]).map(s=>[s.id,s] as const));
  function cite(citations:Citation[]) {return citations.length?<ul className="inspector-citations">{citations.map((ref,i)=>{const source=sourceById.get(ref.sourceId);return <li key={i}><button type="button" className="inspector-cite" onClick={()=>revealSource(ref.sourceId)}>{source?.source.title??"Saved source"} · excerpt</button><blockquote>{ref.quote}</blockquote></li>})}</ul>:<p className="inspector-muted">No citation.</p>}
  function openEntry(s:Source){onOpenEntry?.({sourceFile:s.source.sourceFile,excerpt:s.source.excerpt,fingerprint:s.fingerprint,title:s.source.title})}
  const graph=run&&typeof run.definition==="object"&&run.definition?(run.definition as {graph?:unknown}).graph:undefined;
  return <section className="research-verification research-inspector" aria-label="Research and verification">
    {onReturn&&<button onClick={onReturn}>← Return to Command catalog</button>}
    <header className="inspector-heading"><small>RESEARCH · VERIFIED QUESTIONS</small><h3 ref={inspectionHeading} tabIndex={-1}>{inspectionOnly?"Research Verification · inspection":"Research with verification"}</h3></header>
    {/* With a run open, its brief notice carries the same boundary. */}
    {!run&&<p className="inspector-lede">Investigate a question, then have a separate agent check each claim against its evidence. Results remain research, not memory, commitments, or permission to act.</p>}
    {!available?<p>Available in the desktop app. This browser preview has no vault or run database connection.</p>:<>
      <div className="inspector-actions"><label className="inspector-picker">Saved research runs<select aria-label="Saved research runs" value={run?.id??""} disabled={busy} onChange={e=>void inspect(e.target.value)}><option value="" disabled>Select a run</option>{runs.map(r=><option key={r.id} value={r.id}>{r.question} · {runStatusLabel(r.status)} · {formatWhen(r.startedAt)}</option>)}</select></label></div>
      {!inspectionOnly&&<details className="rv-ask" open={!run}><summary>Ask a new question</summary><form id="rv-workflow" onSubmit={e=>{e.preventDefault();void start()}}><label>Research question<input value={question} maxLength={500} onChange={e=>setQuestion(e.target.value)} disabled={busy||running} placeholder="What does our Research say about…?"/></label>
        <p className="inspector-note">Starting sends selected Research excerpts to OpenAI and saves the question, excerpts, and agent responses locally. Sources are limited to Pantheon Research; no web search or source writes. At most one clarification, six saved excerpts, five claims, four model requests, and four minutes. No automatic retries.</p>
        <button disabled={busy||running||!question.trim()||!catalog?.availability.readyToAttempt}>{busy?"Starting…":"Research and verify"}</button></form></details>}
      {catalog&&!catalog.availability.readyToAttempt&&<div className="research-recovery" role="status"><strong>Research cannot start yet</strong><p>{catalog.availability.reason ?? catalog.availability.providerAccess}</p><p>Saved runs remain available. Recheck after resolving the access issue; rechecking does not start an agent or contact the provider.</p><button type="button" onClick={()=>void refresh()}>Recheck availability</button></div>}
      {error&&<div className="research-recovery" role="alert"><strong>Research request failed</strong><p>{error}</p><button type="button" onClick={()=>void refresh()}>Reload availability & saved runs</button></div>}{!inspectionOnly&&pending&&error&&<button disabled={busy} onClick={()=>void start(true)}>Check / retry same request</button>}
      {agent&&<><Definition value={agent} label={historical?"Saved definition snapshot":"Current compiled definition"}/>{!historical&&<><p>Recent runs using this role:</p><ul>{runs.filter(r=>r.agentIds.includes(agent.id)).map(r=><li key={r.id}><button onClick={()=>void inspect(r.id)}>{r.question} · {runStatusLabel(r.status)}</button></li>)}</ul></>}<button onClick={()=>{setAgent(null);agentOrigin.current?.focus()}}>Back to workflow inspection</button></>}
      {run&&<article className="inspector-run" aria-label="Research run inspection">
        <h4 className="inspector-question">{run.question}</h4>
        <Facts rows={[["Outcome",runStatusLabel(run.status)],["Started",when(run.startedAt)],["Finished",run.finishedAt?formatWhen(run.finishedAt):"No execution end time recorded"],["Saved excerpts",String(run.sources.length)],["Agent executions",String(run.agents.length)]]}/>
        {!inspectionOnly&&run.status==="running"&&<button disabled={cancelPending} onClick={()=>void cancel()}>{cancelPending?"Cancellation requested…":"Cancel this run"}</button>}
        {run.error&&<p role="alert">{humanize(run.error)}</p>}
        <section aria-label="Olympus brief"><h4>Olympus brief</h4>{run.brief?<>
          <Counts items={[{label:"supported",count:run.brief.supported.length,tone:"supported"},{label:"contradicted",count:run.brief.contradicted.length,tone:"contradicted"},{label:"insufficient",count:run.brief.insufficient.length,tone:"insufficient"}]}/>
          <p className="inspector-note">{run.brief.notice}</p>
          {(["supported","contradicted","insufficient"] as const).map(kind=><section key={kind} aria-label={`${kind} claims`}><h5>{verdictLabel(kind.toUpperCase())} · {run.brief![kind].length}</h5>{run.brief![kind].map(({claim,verification})=><div className="inspector-card" key={claim.id}><strong>{claim.text}</strong><p>{verification.explanation}</p>{cite(verification.evidence)}</div>)}</section>)}
        </>:<p>No brief generated.{run.status==="insufficient"?" No matching evidence was available.":""}</p>}
        <p className="inspector-note">Saved evidence describes this run. Reading history does not recheck today's source contents or reinterpret old agent versions.</p></section>
        <section aria-label="Saved source excerpts"><h4>Saved source excerpts · {run.sources.length}</h4>{run.sources.map(s=>{const inLibrary=hasEntry?hasEntry(s.source.sourceFile):true;return <details key={s.id} id={`rv-${s.id}`} className="inspector-source" open={openSources.has(s.id)} onToggle={e=>{const open=(e.currentTarget as HTMLDetailsElement).open;setOpenSources(previous=>{if(previous.has(s.id)===open)return previous;const next=new Set(previous);if(open)next.add(s.id);else next.delete(s.id);return next})}}>
          <summary>{s.source.title} · {humanize(s.source.stance)}</summary>
          <p className="inspector-muted">{s.source.sourceFile} · {s.source.origin?humanize(s.source.origin):"Origin unrecorded"} · {s.source.sourceDate??"Date unrecorded"}</p>
          <blockquote>{s.source.excerpt}</blockquote>
          <p className="inspector-muted">{s.source.truncated?"Partial excerpt":"Full body excerpt"} · saved {formatWhen(s.checkedAt)}</p>
          {onOpenEntry&&<p className="inspector-source-actions"><button type="button" onClick={()=>openEntry(s)}>Open entry</button>{!inLibrary&&<span className="inspector-muted">Not in the library now</span>}</p>}
        </details>})}</section>
        {isFlowNodeList(graph)&&<section aria-label="Workflow structure"><h4>Structure</h4><FlowStructure nodes={graph} events={run.events.filter(e=>e.node!=="message"&&e.node!=="parent")}/></section>}
        <Internals summary="executions, messages, receipts and JSON">
          <p className="inspector-muted">{run.id} · {run.graph} · deadline {when(run.deadline)}</p>
          <h4>Agent executions · {run.agents.length}</h4><ol className="rv-executions">{run.agents.map(a=><li key={a.id}><button onClick={e=>{agentOrigin.current=e.currentTarget;setAgent(a.definition);setHistorical(true)}}>{a.definition.name} @{a.definition.version}</button><p>{runStatusLabel(a.status)} · {a.round===0?"initial pass":"clarification pass"} · {a.id}</p>
            <p>Started {a.startedAt?formatWhen(a.startedAt):"not dispatched"} · finished {a.finishedAt?formatWhen(a.finishedAt):"not recorded"}.</p>{a.error&&<p role="alert">{a.error}</p>}
            {a.request&&<details><summary>Model request receipt · {humanize(a.request.status)}</summary><p>Requested: {a.request.requestedModel}. Returned: {a.request.actualModel??"unreported"}. Latency: {a.request.latencyMs===null?"unreported":`${a.request.latencyMs} ms`}.</p><p>Usage: {a.request.usage===null?"unreported (not zero)":"provider-reported"}</p><JsonBlock value={a.request}/></details>}
            {a.output&&<details><summary>{a.definition.id==="research"?"Original Research findings":"Independent verification result"}</summary>{a.status!=="completed"?<JsonBlock value={a.output}/>:"claims" in a.output?<>{(a.output as ResearchOutput).claims.map(c=><div key={c.id}><strong>{c.id}: {c.text}</strong>{cite(c.evidence)}</div>)}<p>Reported contradictions: {(a.output as ResearchOutput).contradictions.join("; ")||"none reported"}</p><p>Unanswered: {(a.output as ResearchOutput).unanswered.join("; ")||"none reported"}</p></>:"findings" in a.output?<>{(a.output as VerificationOutput).findings.map(f=><div key={f.claimId}><strong>{f.claimId} · {verdictLabel(f.status)}</strong><p>{f.explanation}</p>{cite(f.evidence)}</div>)}{(a.output as VerificationOutput).clarification&&<p>Clarification requested: {(a.output as VerificationOutput).clarification!.question}</p>}</>:<JsonBlock value={a.output}/>}</details>}
            <details><summary>Saved input and identity binding</summary><p>Definition fingerprint: {a.definitionFingerprint}</p><JsonBlock value={a.input}/></details>
          </li>)}</ol>
          <h4>Evidence exchanged · {run.messages.length}</h4><ol>{run.messages.map(m=><li key={m.id}><details><summary>{m.sender.agent} → {m.recipient.agent} · {m.packet.type} · round {m.round}</summary><p>{formatWhen(m.at)} · {m.requestedAction} · expected {m.expectedResponse}</p><JsonBlock value={m}/></details></li>)}</ol>
          <h4>Saved excerpt fingerprints</h4><ul>{run.sources.map(s=><li key={s.id}>{s.source.title}: <code>{s.fingerprint}</code></li>)}</ul>
          <details><summary>Recorded workflow events</summary><ol>{run.events.map(e=><li key={e.sequence}>{e.sequence}. {e.node} · {e.state} · {formatWhen(e.at)}<p>{e.detail}</p></li>)}</ol></details>
          <details><summary>Evaluation facts and unknowns</summary><JsonBlock value={run.evaluation}/></details>
          <details><summary>Original graph, agent and skill snapshots</summary><JsonBlock value={run.definition}/></details>
        </Internals>
      </article>}
      <section aria-label="Agents and workflow" className="rv-agents">
        <h4>Agents and workflow</h4>
        <p className="inspector-note">Research Verification Workflow: Scope → Research → Verification → optional Research clarification → Verification → Olympus brief.</p>
        <div className="rv-actions"><button type="button" onClick={()=>setShowCatalog(!showCatalog)}>{showCatalog?"Hide agent catalog":"Agent catalog"}</button><button type="button" onClick={()=>void refresh()}>Refresh availability & history</button></div>
        {showCatalog&&catalog&&<section aria-label="Agent catalog"><h4>Executable roles</h4><p>{catalog.availability.readyToAttempt?"Research pair ready to attempt":"Research pair unavailable"}: {catalog.availability.reason??catalog.availability.providerAccess}</p><p>{catalog.evaluation.quality}</p>
          <div className="rv-actions">{catalog.executable.map(a=><button key={a.id} onClick={e=>{agentOrigin.current=e.currentTarget;setAgent(a);setHistorical(false)}}>{a.name} @{a.version}</button>)}</div>
          <p>Used by: Research Verification Workflow. Recorded parent runs: {catalog.evaluation.recordedParentRuns}.</p>
          <details><summary>Coding Delegate · {catalog.codingDelegate.operationalStatus}</summary><p>{catalog.codingDelegate.implementation}. {catalog.codingDelegate.availability}</p><p>{catalog.codingDelegate.versionNote}</p><p>Model: {catalog.codingDelegate.model}. Access: {catalog.codingDelegate.sources}. {catalog.codingDelegate.capabilities}. {catalog.codingDelegate.prohibitedEffects}</p><p>{catalog.codingDelegate.recordedRuns} recorded runs · {catalog.codingDelegate.completedRuns} completed. Inspect through the {catalog.codingDelegate.location}.</p></details>
          <h4>Orchestrator</h4><p>{catalog.orchestrator.name} · {catalog.orchestrator.role}</p>
          <details><summary>Documented candidates and external roles</summary><p>{catalog.documentationNote}</p><p>Candidates: {catalog.documentedCandidates.join(", ")}.</p><p>External roles: {catalog.externalRoles.join(", ")}.</p></details>
        </section>}
        {catalog&&<details><summary>Current composed skills ({catalog.skills.length})</summary>{catalog.skills.map(s=><details key={s.id}><summary>{s.id} @{s.version} · {s.purpose}</summary><JsonBlock value={s}/></details>)}</details>}
      </section>
    </>}
  </section>
}
