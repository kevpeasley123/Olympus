import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingDelivery.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingSynthesis.mjs',logLevel:'warning'});
const {prepareFactualBrief:prepare}=await import('../output/tests/briefingSynthesis.mjs');
const now=Date.parse('2026-11-04T17:00:00Z'),scope={temporary:false,conversationId:'fixture'};
const input={projects:[],board:[],projectsError:null};
const gmail={busy:false,account:{id:'a',enabled:true,status:'connected',lastSuccess:new Date(now).toISOString()},analysis:{state:'blocked'},briefMail:[
 {messageId:'s',threadId:'ship',fingerprint:'h1',subject:'Your order has shipped!',sender:'Fixture Store',timestamp:now-1000},
 {messageId:'p',threadId:'pay',fingerprint:'h2',subject:'Payment due',sender:'Other Store',timestamp:now-1000},
]};
let delivered=[],calls=0;
const client={gmail:async()=>gmail,situations:async()=>null,receipts:async()=>({}),deliver:async items=>{delivered=items}};
const baseline=await prepare(input,'requested',now,client,()=>true,scope);
const blocked=await prepare(input,'requested',now,{...client,synthesize:async()=>{calls++;throw Error('analysis_waiting:generation_protection')}},()=>true,scope);
assert.equal(blocked.briefing.kind,'deterministic_fallback');assert.equal(blocked.briefing.sources.length,blocked.items.length);
assert.equal(blocked.text,baseline.text);assert.equal(blocked.provenance,undefined);assert.equal(calls,1,'Closed route does not fall through to another provider');
const answer=packet=>({revision:packet.revision,preparedAt:packet.preparedAt,items:[{text:'Review the payment request first.',whyItMatters:'',action:'',uncertainty:'',sourceIds:[packet.evidence.find(e=>!e.contextOnly).id]}],provenance:{kind:'model_synthesis',provider:'fixture-only',model:'synthetic-model',requestId:'fixture-request'}});
const model=await prepare(input,'requested',now,{...client,synthesize:async packet=>answer(packet)},()=>true,scope);
assert.equal(model.briefing.kind,'model_synthesis');assert.equal(model.briefing.requestId,'fixture-request');assert.equal(model.briefing.sources.length,1);
assert.equal(model.text,'Review the payment request first.');assert.equal(model.provenance.provider,'fixture-only');
assert.equal(model.items.length,1,'Only source items actually represented are consumed');
await model.acknowledge();assert.equal(delivered.length,1);assert.match(delivered[0].id,/pay/);
for(const mutate of [r=>({...r,revision:'0'.repeat(64)}),r=>({...r,preparedAt:r.preparedAt-1}),r=>({...r,provenance:{...r.provenance,model:''}}),r=>({...r,items:[{...r.items[0],sourceIds:['invented-source']}]})]){
 const invalid=await prepare(input,'requested',now,{...client,synthesize:async packet=>mutate(answer(packet))},()=>true,scope);
 assert.equal(invalid.text,baseline.text);assert.equal(invalid.provenance,undefined);
}
const qualified=await prepare(input,'requested',now,{...client,synthesize:async packet=>{const r=answer(packet);r.items[0].uncertainty='The connection to the scheduled expense is unverified.';return r;}},()=>true,scope);
assert.match(qualified.text,/connection.*unverified/,'Material uncertainty is never silently dropped');
const resolved=await prepare(input,'opening',now,{...client,synthesize:async packet=>({...answer(packet),items:[]})},()=>true,scope);
assert.equal(resolved.text,'');assert.equal(resolved.items.length,0,'A qualified empty synthesis does not repeat rejected fallback concerns');
const snapshot={accountId:'a',enabled:true,attention:[{threadId:'resolved',signature:'sig',subject:'Prior account notice',operatorCorrection:'I made the change; it is unrelated to the studio dues.',learningRevision:1,suggestion:{messageId:'r',quote:'Instruction changed'}}],observations:[{current:true,threadId:'resolved',evidenceRefs:[{messageId:'r',threadId:'resolved',fingerprint:'rhash',timestamp:now-1000}]}]};
const correctionClient={...client,situations:async()=>snapshot};
const first=await prepare(input,'opening',now,correctionClient,()=>true,scope);
const correction=first.items.find(i=>i.text.startsWith('Your correction for '));assert.ok(correction);
let sawResolution=false;
await prepare(input,'opening',now,{...correctionClient,receipts:async()=>({[correction.id]:{revision:correction.revision,deliveredAt:now}}),synthesize:async packet=>{
 const context=packet.evidence.find(e=>e.id===correction.id);sawResolution=context?.authority==='operator_statement'&&context.contextOnly===true;
 return {...answer(packet),items:[]};
}},()=>true,scope);
assert.equal(sawResolution,true,'An acknowledged operator resolution remains protected context rather than repeated news');
snapshot.attention[0].subject='Studio review';
let protectedAuthority=false;
const withProject=await prepare({...input,projects:[{id:'p',name:'Studio',status:'active',sinceSessionCommits:[{subject:'Inspection notes refreshed',at:now}],linkedWorktrees:[]}]},'requested',now,{...correctionClient,synthesize:async packet=>{
 const correction=packet.evidence.find(e=>e.id==='mail:a:resolved');protectedAuthority=correction?.authority==='operator_statement'&&correction.contextOnly===true;
 return answer(packet);
}},()=>true,scope);
assert.equal(protectedAuthority,true);assert.match(withProject.text,/Your correction for Studio review: I made the change; it is unrelated to the studio dues\./,'Project composition never makes an operator correction rewriteable');
const combinedSnapshot=structuredClone(snapshot);
combinedSnapshot.attention[0].operatorCorrection=undefined;
combinedSnapshot.understanding={lastSuccessAt:new Date(now).toISOString()};
combinedSnapshot.attention[0].suggestion={...combinedSnapshot.attention[0].suggestion,title:'Review Studio appointment',why:'A confirmation is needed',action:'Check the time'};
let combinedProtected=false;
const combined=await prepare({...input,projects:[{id:'p',name:'Studio',status:'active',sinceSessionCommits:[{subject:'Inspection notes refreshed',at:now}],linkedWorktrees:[]}]},'requested',now,{...client,gmail:async()=>({...gmail,analysis:{state:'ready'}}),situations:async()=>combinedSnapshot,synthesize:async packet=>{
 const group=packet.evidence.find(e=>e.id.endsWith(':combined'));
 combinedProtected=group?.contextOnly===true;
 return answer(packet);
}},()=>true,scope);
assert.equal(combinedProtected,true,'Combined evidence cannot be partially rewritten while consuming every constituent');
assert.match(combined.text,/Inspection notes refreshed/,'A consumed project component stays visible');
snapshot.attention[0].subject='Long subject '.repeat(40);
snapshot.attention[0].operatorCorrection='The change was mine. '.repeat(18)+'It is unrelated to the studio dues.';
const longCorrection=await prepare(input,'requested',now,correctionClient,()=>true,scope);
assert.ok(longCorrection.text.includes(snapshot.attention[0].operatorCorrection),'The complete operator resolution must survive a long subject');
await build({entryPoints:['src/services/briefingSynthesis.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingSynthesisBounds.mjs',logLevel:'warning'});
const {boundedSynthesis}=await import('../output/tests/briefingSynthesisBounds.mjs');
await assert.rejects(boundedSynthesis(new Promise(()=>{}),5),/expired/,'A stalled model cannot hold the opening indefinitely');
gmail.account.lastSuccess=new Date(now+1000).toISOString();
assert.equal(await model.current(),false,'Model synthesis remains bound to current source snapshot');
console.log('PASS gated synthesis fallback, actual provenance requirement, source binding, selective receipts and stale-source rejection');

await build({entryPoints:['src/services/conversationHistory.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingHistory.mjs',logLevel:'warning'});
const {briefingTurnContent}=await import('../output/tests/briefingHistory.mjs');
const history={id:'conversation-briefing-fixture',content:'Fixture brief'};
assert.match(briefingTurnContent({...history,briefing:blocked.briefing}),/deterministic fallback/);
assert.match(briefingTurnContent({...history,briefing:model.briefing}),/model synthesis/);
assert.match(briefingTurnContent(history),/origin was not recorded/);

const {briefingCoverage}=await import('../output/tests/briefingSynthesisBounds.mjs');
assert.equal(briefingCoverage(model.briefing),null,'Historical origins have no invented coverage');
const withCoverage={...model.briefing,coverage:{mail:true,projects:false}};
assert.match(briefingCoverage(withCoverage),/selected recent email/);
assert.match(briefingCoverage(withCoverage),/doesn't cover project code changes, tasks or agent runs/);
assert.match(briefingTurnContent({...history,briefing:withCoverage}),/selected recent email/,'Later conversation retains the coverage boundary');
assert.equal(briefingCoverage({...withCoverage,coverage:{mail:'true',projects:false}}),null);
console.log('PASS native coverage disclosure and historical-origin compatibility');
