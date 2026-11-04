import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/displayedBrief.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/displayedBrief.mjs',plugins:[{name:'synthetic-native',setup(b){
 b.onResolve({filter:/^@tauri-apps\/api\/core$/},()=>({path:'native',namespace:'fixture'}));
 b.onResolve({filter:/^\.\/launcher$/},()=>({path:'runtime',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='runtime'?'export const isTauriRuntime=()=>true;':'export const invoke=(name,args)=>globalThis.syntheticInvoke(name,args);',loader:'js'}));
}}]});
const pending=new Set(),confirmed=new Set();let fail=false,calls=0;
globalThis.syntheticInvoke=async(name,{messageId})=>{assert.equal(name,'briefing_confirm_display');calls++;if(fail)throw Error('synthetic unavailable');if(!pending.delete(messageId))return false;confirmed.add(messageId);return true;};
const {briefDisplayed,briefSaved}=await import('../output/tests/displayedBrief.mjs');
briefDisplayed('early');assert.equal(confirmed.size,0);pending.add('early');briefSaved('early');assert.ok(confirmed.has('early'));
pending.add('later');briefSaved('later');assert.ok(!confirmed.has('later'));briefDisplayed('later');assert.ok(confirmed.has('later'));
pending.add('retry');fail=true;briefDisplayed('retry');await Promise.resolve();assert.ok(pending.has('retry'));fail=false;briefDisplayed('retry');assert.ok(confirmed.has('retry'));
briefDisplayed('early');briefSaved('early');assert.equal(confirmed.size,3);assert.equal(pending.size,0);assert.ok(calls>=6);
delete globalThis.syntheticInvoke;
console.log('PASS actual UI acknowledgment service: either event order, delayed save, failure retry and repeat display; synthetic native adapter only');
