import type {CommandCatalog,CommandRole} from './commandAgents';

/** Names are presentation identities; runtime IDs, scope and authority stay intact. */
export function pantheonAgents(catalog:CommandCatalog|null):CommandRole[]{
 if(!catalog)return [];
 const engineer=catalog.agents.find(a=>a.id==='coding-delegate');
 const analyst=catalog.agents.find(a=>a.id==='research');
 const creative:CommandRole={id:'dionysus',name:'Dionysus',version:null,kind:'agent',status:'PLACEHOLDER',tone:'muted',description:'Creative strategist',role:'Creative strategy, concept development and narrative direction.',authority:'Placeholder only. No executor, tools, write permissions or launch action.',sourceScope:'No sources connected.',availability:'Planned role; execution is not implemented.'};
 return [
  {...catalog.orchestrator,name:'Zeus',description:'Primary orchestrator'},
  ...(engineer?[{...engineer,name:'Hephaestus',description:'Systems engineer & architect'}]:[]),
  ...(analyst?[{...analyst,name:'Athena',description:'Research analyst'}]:[]),
  creative,
  ...catalog.agents.filter(a=>!['coding-delegate','research'].includes(a.id)).map(a=>a.id==='verification'?{...a,name:'Themis',description:'Verification analyst'}:a),
 ];
}
