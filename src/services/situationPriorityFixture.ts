import type {SituationContext} from './situations';
/** Synthetic variants of the existing Home fixture, never live account data. */
export function applyPriorityScenario(context:SituationContext,scenario:string){
 const refs=[{sourceId:'agreement',locator:'Synthetic review'}];
 context.entities.filter(e=>e.workstream==='w5').forEach(e=>{e.status='stable';e.refs=refs});
 if(scenario==='renovation')context.facts=context.facts.filter(f=>f.status!=='needs confirmation'||f.workstream==='w0');
 if(scenario==='tied')context.facts.push({label:'Payment recipient',text:'The payment recipient still needs confirmation.',status:'needs confirmation',workstream:'w0',refs});
 if(scenario==='none'){
  context.facts=context.facts.filter(f=>f.status!=='needs confirmation');
  context.entities=context.entities.filter(e=>e.kind!=='unknown');
  context.entities.forEach(e=>{e.status='stable';e.notes='A synthetic current review reports this relationship as stable.';e.refs=refs});
  context.summary='The current synthetic review reports stable relationships. No open questions are recorded in this snapshot.';
 }
 if(scenario==='many')for(let i=0;i<8;i++)context.facts.push({label:`Additional repair question ${i+1}`,text:'A separate synthetic follow-up record needs confirmation.',status:'needs confirmation',workstream:'w4',refs});
}
