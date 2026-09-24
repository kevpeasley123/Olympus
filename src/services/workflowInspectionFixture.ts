import type {InspectionPage,RunEvent,WorkflowDescriptor} from './communicationIntelligence';

const prohibitions=['gmail_write','task_create','project_write','memory_promotion','skill_rewrite'];
export const workflowFixture:WorkflowDescriptor={
 id:'communication-intelligence/v4',name:'Communication Intelligence',version:4,
 purpose:'Synthetic fixture: interpret selected cached correspondence.',trigger:'Explicit Analyze / Refresh intelligence',
 completion:'Bounded findings were validated and published; no obligation was approved or completed.',
 recovery:'Retry creates a new run. No automatic provider switch.',execution:'Sequential fixed runner; no parallel agents.',
 loop:'Up to three batch passes, with conditional cached-thread expansion.',
 allowedCapabilities:['read supplied cached evidence','invoke PRIMARY','record operational evidence'],prohibitedEffects:prohibitions,
 definition:[{id:'snapshot',kind:'cache_read',dependsOn:[],maxIterations:1},{id:'select',kind:'candidate_selection',dependsOn:['snapshot'],maxIterations:1},{id:'assess',kind:'communication-assess@2',dependsOn:['select'],maxIterations:3},{id:'project',kind:'project-relevance@2',dependsOn:['assess'],maxIterations:1},{id:'synthesize',kind:'validated_join_and_policy',dependsOn:['project'],maxIterations:1}],
 nodeSkills:{assess:['communication-assess@2','project-relevance@2'],project:['project-relevance@2']},
 skills:[{id:'communication-assess',version:2,purpose:'Interpret bounded communication evidence.',inputSchema:{type:'object'},outputSchema:{type:'object'},allowedCapabilities:['read_supplied_thread','bounded_model_interpretation'],prohibitedEffects:prohibitions,evidenceRequirements:'Source IDs and fingerprints must match.',successCriteria:'Validated grounded output; uncertainty remains explicit.',loopBudget:3,implementation:'Model-assisted; runner-owned batch budget'},
 {id:'project-relevance',version:2,purpose:'Match supplied artifacts against declared project names and aliases.',inputSchema:{type:'object'},outputSchema:{type:'object'},allowedCapabilities:['read_supplied_artifact'],prohibitedEffects:prohibitions,evidenceRequirements:'Supplied evidence and project fingerprints.',successCriteria:'Ambiguity remains explicit.',loopBudget:0,implementation:'Deterministic literal matcher'}]
};
const epoch=Date.UTC(2026,8,23,12);
export function inspectionFixture(scenario='completed'):{run:InspectionPage['run'];events:RunEvent[]}{
 const definition=structuredClone(workflowFixture),events:RunEvent[]=[];
 let ms=0;
 const add=(node:string,state:string,data:unknown)=>{ms+=10;events.push({sequence:events.length+1,node,state,at:new Date(epoch+ms).toISOString(),result:{traceVersion:1,attempt:1,elapsedMs:ms,data}})};
 const receipt=(pass:number,status='completed')=>({id:`request-${pass}`,requestedModel:'synthetic-model',actualModel:status==='started'?null:'synthetic-snapshot',reasoningEffort:'medium',status,latencyMs:status==='started'?null:10,usage:status==='started'?null:{input_tokens:50,output_tokens:12}});
 for(const n of definition.definition){
  add(n.id,'running',{});
  if(n.id==='select')add(n.id,'catalog_snapshot',{sources:[{name:'Atlas',source:'synthetic/Atlas.md',fingerprint:'fixture-project'}]});
  if(n.id==='assess'&&scenario!=='empty'){
   for(let pass=1;pass<=2;pass++){
    add(n.id,'pass_started',{pass,requestId:`request-${pass}`,request:receipt(pass,'started'),assessedThreads:1,evidenceRefs:[[{messageId:'m1',threadId:'t1',fingerprint:'fixture-mail',timestamp:epoch}]]});
    if(scenario==='interrupted'||scenario==='running')break;
    add(n.id,'model_result',{pass,request:receipt(pass)});
    add(n.id,'iteration',{pass,threadId:'t1',assessment:{operatorImpact:'Synthetic delivery update.'},stopReason:pass===1?'expanded':'evidence_sufficient',nextEvidenceRefs:[{messageId:'m1',fingerprint:'fixture-mail'}]});
   }
   if(scenario==='interrupted'||scenario==='running')break;
   if(scenario==='failed'){add(n.id,'failed',{error:'assessment_contract_rejected'});add('project','stopped',{stopReason:'upstream_failure'});add('synthesize','stopped',{stopReason:'upstream_failure'});break;}
  }
  add(n.id,'completed',n.id==='assess'?{passes:scenario==='empty'?0:2,assessedThreads:scenario==='empty'?0:1}:{});
 }
 const run:InspectionPage['run']={id:scenario,graph:definition.id,definition:definition.definition,skills:definition.skills,workflow:definition,traceVersion:1,definitionFingerprint:'synthetic-definition',buildVersion:'fixture',model:'synthetic-model',status:['failed','interrupted','running'].includes(scenario)?scenario:'completed',startedAt:new Date(epoch).toISOString(),finishedAt:scenario==='running'?null:new Date(epoch+ms).toISOString(),durationMs:scenario==='running'?null:ms,days:7,stale:false,error:scenario==='failed'?'assessment_contract_rejected':null,items:[],usage:[],loop:{passes:scenario==='empty'?0:2,maxPasses:3}};
 if(scenario==='legacy'||scenario==='missing-contract'){
  run.graph='communication-intelligence/v2';delete run.workflow;delete run.traceVersion;
  run.definition=definition.definition.map(n=>n.id==='assess'?{...n,kind:'communication-assess@1'}:n);
  run.skills=scenario==='missing-contract'?[]:[{...recordSkill(definition.skills[0]),version:1,purpose:'Historical deterministic assessment',implementation:'Historical local policy'},definition.skills[1]];
  for(const e of events)e.result=(e.result as {data:unknown}).data;
 }
 if(scenario==='paged')for(let i=0;i<110;i++)add('feedback','recorded',{event:'opened',threadId:'t1'});
 return {run,events};
}
function recordSkill(value:unknown){return value as Record<string,unknown>}
