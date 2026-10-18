import {selectConversationProvider} from "./conversationProvider";
import {mockIPC} from "@tauri-apps/api/mocks";
import {requestAssistantReply} from "./assistant";
import {seedState} from "../data/seed";
import {applyProjectMember,subscribeProjectMembers,publishProjectMember,type ProjectMember} from "./projectMembership";
export async function runProjectLinkingContracts(){
 let payload:any;mockIPC((command,args)=>{if(command==="recommend_resource_skills")return [];if(command==="send_assistant_message"){payload=args;return {content:"Fixture",model:"Fixture",research:[]}}throw Error(command)});
 selectConversationProvider("legacy-api"); // Explicit route in this synthetic IPC contract.
 const a={...seedState.projects[0],id:"a",name:"Selected"},b={...seedState.projects[0],id:"b",name:"Unrelated",vision:"PRIVATE OTHER PROJECT"};
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label)};
 await requestAssistantReply([{id:"u",role:"user",timestamp:"now",content:"Evaluate",attachment:{kind:"project-snapshot",label:a.name,heading:"Project assessment",context:"Selected source",projectId:"a"}}],seedState.settings,[a,b],undefined,{commandBoard:[{project:a},{project:b}]});
 check(payload.context.projects.length===1&&payload.context.projects[0].name==="Selected","Assessment request excludes other projects");
 check(!JSON.stringify(payload.context.commandBoard??null).includes("PRIVATE OTHER PROJECT"),"Assessment request excludes other project work state");
 let projects=[a,b];const unsubscribe=subscribeProjectMembers(m=>{projects=applyProjectMember(projects,m)});
 publishProjectMember({project:a,visibility:"removed",revision:1,intake:{},sources:[]} satisfies ProjectMember);unsubscribe();
 check(projects.length===1&&projects[0].id==="b","Successful removal updates shared state without a successful scan");
 console.log("PASS 3 project membership and actual assistant request contracts");
}
