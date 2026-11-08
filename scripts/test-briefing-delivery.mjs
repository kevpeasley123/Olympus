import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingDelivery.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingDelivery.mjs',logLevel:'warning'});
const {prepareFactualBrief:prepare,prepareStableBrief,waitForBriefMail}=await import('../output/tests/briefingDelivery.mjs');
const prepareFactualBrief=(input,mode,now,client,current)=>prepare(input,mode,now,client,current,{temporary:false,conversationId:'fixture'});
let reads=0, deliveries=0;
const gmail={configured:true,busy:false,cachedMessages:0,account:null,candidates:[],lastRun:null};
let delivered=[];
const client={gmail:async()=>{reads++;return gmail},situations:async()=>null,receipts:async()=>({}),deliver:async items=>{deliveries++;delivered=items;}};
const input={projects:[],board:[],projectsError:null};
const brief=await prepareFactualBrief(input,'opening',Date.now(),client);
assert.match(brief.text,/Gmail is not connected/);
assert.equal(deliveries,0,'Preparing does not acknowledge delivery');
assert.equal(await brief.current(),true);
assert.ok(reads>=2,'Publication rechecks account/source state');
await brief.acknowledge();assert.equal(deliveries,1);
assert.ok(delivered.every(i=>/^[a-f0-9]{64}$/.test(i.revision)),'Persisted revisions are digests, not source text');
let attempts=0;
const stable=await prepareStableBrief(async()=>({...brief,text:'revision '+(++attempts),current:async()=>attempts>1}),()=>true);
assert.equal(attempts,2,'Source invalidation causes a fresh preparation');
assert.equal(stable.text,'revision 2');
await assert.rejects(prepareStableBrief(async()=>({...brief,current:async()=>false}),()=>true),/changed/);
let projectRevision=1;
const checkpoint=await prepareFactualBrief(input,'requested',Date.now(),client,()=>projectRevision===1);
projectRevision=2;
assert.equal(await checkpoint.current(),false,'Resolved project checkpoints invalidate the draft');
const changed=await prepareFactualBrief(input,'opening',Date.now(),client);
gmail.account={id:'changed',enabled:true};
assert.equal(await changed.current(),false,'Account changes invalidate a prepared brief');
const partial=await prepareFactualBrief(input,'requested',Date.now(),{...client,gmail:async()=>{throw Error('offline')}});
assert.match(partial.text,/could not be checked/);
const fail=await prepareFactualBrief(input,'requested',Date.now(),{...client,deliver:async()=>{throw Error('save failed')}});
await assert.rejects(fail.acknowledge(),/save failed/);
console.log('PASS preparation, read-only collection, account revision guard, partial failure and delivery acknowledgment');

let learningSnapshot={accountId:'a',revision:'before-correction',learning:[]};
const learningClient={...client,situations:async()=>learningSnapshot};
const pendingFeedback=await prepareFactualBrief(input,'requested',Date.now(),learningClient);
learningSnapshot={...learningSnapshot,revision:'after-forget'};
assert.equal(await pendingFeedback.current(),false,'Forget invalidates prepared briefing before display');
const pendingUndo=await prepareFactualBrief(input,'requested',Date.now(),learningClient);
learningSnapshot={...learningSnapshot,revision:'after-undo'};
assert.equal(await pendingUndo.current(),false,'Undo invalidates prepared briefing before display');

const syncing={...gmail,busy:true,account:{id:"a",enabled:true,status:"syncing",lastError:null}};
const startup=await prepare(input,"opening",Date.now(),{...client,gmail:async()=>syncing});
assert.equal(startup.text,null,"An in-progress mailbox sync alone must not become a spoken opening brief");
const needsConsent=await prepare(input,"opening",Date.now(),{...client,gmail:async()=>({...syncing,busy:false,account:{...syncing.account,status:"authentication_required",lastError:"gmail_refresh_grant_rejected"}})});
assert.match(needsConsent.text,/Gmail needs reconnection|Reconnect Gmail/);
console.log("PASS omit a transient startup status and retain actionable reconnect instructions");

// Startup used to reserve a native synthesis ticket before the due mail sync.
assert.equal(typeof waitForBriefMail,'function','Both briefing routes need the same bounded startup barrier');
let clock=0, statusReads=0;
const due={...syncing,busy:false,account:{...syncing.account,status:'connected',nextSync:null}};
const fresh={...due,account:{...due.account,nextSync:new Date(60_000).toISOString()}};
const states=[due,syncing,fresh];
const ready=await waitForBriefMail(()=>true,async()=>states[Math.min(statusReads++,2)],{now:()=>clock,sleep:async ms=>{clock+=ms;}});
assert.equal(ready.account.nextSync,fresh.account.nextSync,'Wait through the due and syncing phases before selecting mail');
assert.equal(statusReads,3);
for(const retryState of [
 {...due,account:{...due.account,status:'sync_error',lastError:'gmail_connection_failed'}},
 {...syncing,account:{...syncing.account,lastError:'gmail_connection_failed'}},
 {...due,account:{...due.account,status:'authentication_required',lastError:'gmail_authentication_required'}},
 {...due,account:{...due.account,nextSync:'invalid'}},
]){
 clock=0;let reads=0;
 const recovered=await waitForBriefMail(()=>true,async()=>reads++===0?retryState:fresh,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(recovered,fresh,'A recoverable connection state must get its scheduled retry before synthesis');
}
clock=0;
await waitForBriefMail(()=>true,async()=>syncing,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
assert.ok(clock>=12_000 && clock<=12_600,'A stalled sync cannot block the opening indefinitely');
let active=true;
await assert.rejects(waitForBriefMail(()=>active,async()=>due,{now:()=>0,sleep:async()=>{active=false;}}),/context changed/i);
const auth={...due,account:{...due.account,status:'authentication_required',lastError:'grant_revoked'}};
assert.equal(await waitForBriefMail(()=>true,async()=>auth,{now:()=>0,sleep:async()=>{throw Error('must not wait on consent');}}),auth);
console.log('PASS startup sync barrier, bounded wait, cancellation and revoked consent');
