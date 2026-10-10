import { nextOrganizerTask,canPrepareTask,organizerMessage,type OrganizerTask,type OrganizerOverview } from "./organizer";
import type {DelegationRun} from "./delegation";
export function runOrganizerHarness(){
 let passed=0;const check=(x:boolean,m:string)=>{if(!x)throw Error(m);passed++};
 const task={id:"a",projectId:"p",intent:"committed",state:"open",priority:"normal",position:0} as OrganizerTask;
 const row=(task:OrganizerTask):OrganizerOverview=>({task,displayStatus:"Planned",needsAttention:false});
 check(nextOrganizerTask([row(task)],"p")?.task.id==="a","select the committed task");
 check(nextOrganizerTask([row({...task,intent:"proposed"})],"p")===undefined,"suggestion is not a commitment");
 check(nextOrganizerTask([row({...task,state:"completed"}),row({...task,id:"b",position:1})],"p")?.task.id==="b","advance after completion");
 check(nextOrganizerTask([row({...task,projectId:"other"})],"p")===undefined,"scope to project");
 check(nextOrganizerTask([row(task),row({...task,id:"high",priority:"high",position:2})],"p")?.task.id==="high","priority precedes manual order");
 check(canPrepareTask(task,[],null),"committed task can prepare when executor available");
 check(!canPrepareTask({...task,intent:"proposed"},[],null),"cannot delegate proposed task");
 check(!canPrepareTask(task,[{projectId:"p",phase:"awaiting_review"} as DelegationRun],null),"review blocks second project run");
 check(!canPrepareTask(task,[],"Unavailable"),"executor unavailable remains unavailable");
 check(organizerMessage({code:"conflict",message:"Newer revision"})==="Newer revision","structured errors remain readable");
 return {passed};
}
