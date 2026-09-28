import {prioritizeSituation} from '../../services/situationPriority';
import {DossierTabs} from './DossierTabs';
import type {SituationDocumentsClient} from '../../services/situationDocuments';
import {BriefingText} from './BriefingText';
import {useEffect,useRef} from 'react';
import type {SituationContext,ContextRef} from '../../services/situations';
import type {ContextualActor} from '../../services/contextualActors';
import {relationshipDossier} from '../../services/relationshipDossier';

export function RelationshipDossier({context,actor,onBack,situationId,documentsApi}:{context:SituationContext;actor:ContextualActor;onBack:()=>void;situationId?:string;documentsApi?:SituationDocumentsClient}){
 const guidance=prioritizeSituation(context).workstreams.find(w=>w.workstreamId===actor.workstream&&['needs-attention','review-soon'].includes(w.level));
 const d=relationshipDossier(context,actor),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const inspector=root.current?.closest('.contextual-inspector');if(inspector)inspector.scrollTop=0},[actor.id]);
 const sources=(refs:ContextRef[])=><ul className="dossier-citations">{refs.map((ref,i)=>{const source=context.sources.find(s=>s.id===ref.sourceId);return <li key={i}><strong>{source?.title??ref.sourceId}</strong><span>{ref.locator}</span><small>{source?.category}</small><code>{source?.path}</code></li>})}</ul>;
 return <div className="relationship-dossier" ref={root}>
  <button className="dossier-back" onClick={onBack}>← {d.stream?.title??'Situation'}</button>
  <header className="dossier-identity"><h4>{actor.primary}</h4><p>{[...actor.representatives,actor.role].filter(Boolean).join(' · ')}</p>
   {d.members.length===1&&d.members[0].kind==='person'&&<small>Organization unconfirmed</small>}
   {d.contacts.length>0&&<div className="dossier-contacts" aria-label="Contact details">{d.contacts.map(contact=><span key={contact}>{contact}</span>)}</div>}
  </header>
  <DossierTabs context={context} workstream={actor.workstream} actor={actor} situationId={situationId} documentsApi={documentsApi} provenance={<><p>Local saved context dated {context.asOf}. This profile does not generate new understanding or establish live status.</p>{d.members.map(member=><div key={member.id}><strong>{member.name}</strong><p>{member.kind} · {member.role} · {member.status}</p><code>{member.id}</code>{member.contacts.map(c=><p key={c}>{c}</p>)}{sources(member.refs)}</div>)}<p>{context.coverage}</p><small>Projection state: {actor.state}</small>{sources(actor.relationshipRefs)}</>} documentContext={<>{d.notes.map((note,i)=><p key={i}>{note}</p>)}{sources(actor.refs)}{d.records.length>0&&<p>Supporting workstream records; shared sources alone do not establish actor-specific attribution.</p>}{d.records.map((fact,i)=><div key={i}><h5>{fact.label}</h5><small>{fact.status}</small><p>{fact.text}</p>{sources(fact.refs)}</div>)}</>}>
  <section><h5>Profile</h5><p>{d.profile}</p></section>
  <section><h5>{d.labels[0]}</h5><p>{d.origin}</p></section>
  <section><h5>{d.labels[1]}</h5>{d.business.length?<dl>{d.business.map((row,i)=><div key={i}><dt>{row.label} <small>{row.basis}</small></dt><dd>{row.text}</dd></div>)}</dl>:<p>Details of the engagement are not recorded.</p>}</section>
  <section><h5>{d.labels[2]}</h5><p>{d.status}</p><small>Saved context · {context.asOf}.</small></section>
  <section className="dossier-next"><h5>Useful next step</h5><BriefingText text={guidance?.guidance??d.nextStep}/>{guidance&&<small>Reason: {guidance.reason}</small>}<small>{d.nextStepScope} · guidance, not a commitment</small></section>
  </DossierTabs>
 </div>;
}
