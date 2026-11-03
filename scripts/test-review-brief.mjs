import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingDelivery.ts','src/services/displayedBrief.ts','src/services/briefProjectWindow.ts'],bundle:true,platform:'node',format:'esm',outdir:'output/tests/review',outExtension:{'.js':'.mjs'}});
const {prepareFactualBrief}=await import('../output/tests/review/briefingDelivery.mjs');

const now=Date.now(), at=new Date(now-100).toISOString();
const project={id:'fixture',path:'C:\\projects\\Fixture',name:'Fixture',status:'active',sinceSessionCommits:[],linkedWorktrees:[]};
const input={projects:[project],board:[],projectsError:null};
const review={id:3,source:'\\\\?\\C:\\projects\\Fixture',project:'Fixture',outcome:'changed',revision:'b'.repeat(40),detail:'Review ready',observedAt:at};
const gmail={account:{id:'a',enabled:true,status:'connected',lastSuccess:at,horizonDays:7},analysis:{state:'ready'}};
const situations={accountId:'a',enabled:true,revision:'1',understanding:{lastSuccessAt:at},attention:[{subject:'Fixture review date',threadId:'t',signature:'s',suggestion:{messageId:'m',quote:'Review Friday',title:'Review Friday',why:'A review was requested.',action:'Confirm availability.'}}],observations:[{threadId:'t',current:true,evidenceRefs:[{threadId:'t',messageId:'m',fingerprint:'f',timestamp:now}]}]};
const client={gmail:async()=>gmail,situations:async()=>situations,reviews:async()=>[review],receipts:async()=>({}),deliver:async()=>{}};
const prep=scope=>prepareFactualBrief(input,'opening',now,client,()=>true,scope);
const combined=await prep({temporary:false,conversationId:'c'});
assert.match(combined.text,/Project Change Review #3/);assert.match(combined.text,/Confirm availability/);
assert.equal(await combined.current(),true);review.revision='c'.repeat(40);assert.equal(await combined.current(),false);
const privateBrief=await prep({temporary:true,conversationId:'private'});assert.doesNotMatch(privateBrief.text,/Project Change Review/);
situations.attention[0].subject='Unrelated project';
const independent=await prep({temporary:false,conversationId:'c'});
assert(independent.items.some(i=>i.id==='project-review:fixture'));
assert(!independent.text.includes('Correspondence naming the same project'));
console.log('PASS review/mail attribution, independent topics, temporary scope, revision invalidation and displayed-only receipts');

const {displayedCursors}=await import('../output/tests/review/briefProjectWindow.mjs');
const observed={...project,sinceSessionCommits:[{at,subject:'Feature ready',oid:'a'.repeat(40)}]};
assert.deepEqual(displayedCursors([observed],new Set()),[]);
const [cursor]=displayedCursors([observed],new Set(['project:fixture:progress']));
assert.equal(cursor.at,Date.parse(at));assert.deepEqual(cursor.oids,['a'.repeat(40)]);
const correlatedClient={...client,memory:async()=>({enabled:true,revision:'1',items:[{
 id:'m',title:'Fixture workflow',summary:'I need the release review before Friday.',learnedAt:at,revision:'f'.repeat(64),sourceMessageIds:['statement'],
}]})};
situations.attention[0].subject='Fixture review date';
const personal=await prepareFactualBrief(input,'opening',now,correlatedClient,()=>true,{temporary:false,conversationId:'c'});
const synthesis=personal.items.find(item=>item.id==='mail:a:t:combined');
assert.match(synthesis.text,/Remembered from/);assert.equal(synthesis.source.conversationId,'m');
console.log('PASS per-project displayed cursor and explicitly attributed three-source synthesis');

const withoutSkill={...correlatedClient,reviews:async()=>[]};
const fromGit=await prepareFactualBrief({...input,projects:[observed]},'opening',now,withoutSkill,()=>true,{temporary:false,conversationId:'c'});
assert.match(fromGit.text,/Feature ready/);assert.match(fromGit.text,/Confirm availability/);
assert.match(fromGit.text,/release review before Friday/);
assert(fromGit.delivery.items.some(i=>i.id==='project:fixture:progress'));
assert(fromGit.delivery.items.some(i=>i.id==='mail:a:t'));
assert(fromGit.delivery.items.some(i=>i.id==='memory:chat:m'));
console.log('PASS ordinary Git progress joins without running a skill, preserving each source receipt');

const {readProjectWindow}=await import('../output/tests/review/briefProjectWindow.mjs');
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
globalThis.window={__TAURI_INTERNALS__:{invoke:async(_cmd,args)=>{
 if(args.projectId==='bad')throw Error('Repository moved');
 return [{at,subject:'Healthy change'}];
}}};
const isolated=await readProjectWindow('fixture-root',[observed,{...observed,id:'bad',name:'Moved repo'}],now);
assert.deepEqual(isolated.gaps,['Moved repo']);
assert.equal(isolated.projects[0].sinceSessionCommits[0].subject,'Healthy change');
assert.deepEqual(isolated.projects[1].sinceSessionCommits,[]);
console.log('PASS failed Git repository preserves healthy project evidence');

const extra={...situations.attention[0],threadId:'extra',signature:'s2',suggestion:{...situations.attention[0].suggestion,title:'Second thread',messageId:'m2'}};
situations.attention.push(extra);
situations.observations.push({threadId:'extra',current:true,evidenceRefs:[{threadId:'extra',messageId:'m2',fingerprint:'second',timestamp:now}]});
const multi=await prepareFactualBrief({...input,projects:[observed]},'opening',now,withoutSkill,()=>true,{temporary:false,conversationId:'c'});
assert.equal(multi.items.filter(i=>i.emailSource).length,2);
assert(multi.delivery.items.some(i=>i.id==='project:fixture:progress'));
assert(multi.items.some(i=>i.emailSource?.threadId==='extra' && !i.text.includes('Feature ready')));
const moved={...correlatedClient,reviews:async()=>[{...review,id:4,source:'C:/old-location/Fixture'},review]};
const restored=await prepareFactualBrief(input,'requested',now,moved,()=>true,{temporary:false,conversationId:'c'});
assert.match(restored.text,/Project Change Review #3/);
console.log('PASS independent mail threads retain source bindings and old folders cannot shadow current findings');
