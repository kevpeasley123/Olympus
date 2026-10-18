import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
assert(existsSync('scripts/claude-quota-collector.mjs'),'Passive quota collector must exist');
const {collectQuota}=await import('./claude-quota-collector.mjs');
const now=1800000000000;
const payload={rate_limits:{five_hour:{used_percentage:10.125,resets_at:1800001000},seven_day:{used_percentage:0,resets_at:1800600000}},transcript_path:'SECRET',session_id:'SECRET',prompt:'SECRET',api_key:'SECRET'};
const first=collectQuota(payload,null,now);
assert.deepEqual(Object.keys(first).sort(),['observedAt','version','windows']);
assert.equal(first.windows.five_hour.usedPercentage,10.125);
assert.equal(first.windows.seven_day.usedPercentage,0);
assert(!JSON.stringify(first).includes('SECRET'));
assert.deepEqual(collectQuota(payload,first,now+600000),first,'Repeated payload cannot freshen evidence');
const changed=structuredClone(payload);changed.rate_limits.five_hour.used_percentage=12;
const next=collectQuota(changed,first,now+60000);
assert.equal(next.windows.seven_day.observedAt,first.windows.seven_day.observedAt);
assert.notEqual(next.windows.five_hour.observedAt,first.windows.five_hour.observedAt);
assert.deepEqual(collectQuota({},first,now+1).windows,{},'Absent quota stays unknown');
assert.equal(collectQuota(payload,first,1800001000000).windows.five_hour,undefined,'Expired window removed');
for(const bad of [NaN,Infinity,-1,101,'5',null]) {const p=structuredClone(payload);p.rate_limits.five_hour.used_percentage=bad;assert.equal(collectQuota(p,null,now).windows.five_hour,undefined);}
const reset=structuredClone(payload);reset.rate_limits.five_hour.resets_at+=18000;reset.rate_limits.five_hour.used_percentage=0;
assert.equal(collectQuota(reset,first,now+1).windows.five_hour.usedPercentage,0);
console.log('PASS passive collector allowlist, missing/expired/reset windows and unchanged observation timestamps');

const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');const {storeQuota}=await import('./claude-quota-collector.mjs');
const dir=await mkdtemp(join(tmpdir(),'olympus-quota-test-'));
try {const file=join(dir,'reading.json');await storeQuota(payload,file,now);const saved=await readFile(file,'utf8');assert(!saved.includes('SECRET'));await storeQuota(payload,file,now+1);assert.equal(await readFile(file,'utf8'),saved);await storeQuota({},file,now+2);assert.deepEqual(JSON.parse(await readFile(file,'utf8')).windows,{});}finally{await rm(dir,{recursive:true,force:true})}
console.log('PASS quota-only atomic persistence and missing-data replacement');

const {mkdir,writeFile}=await import('node:fs/promises');
const lockDir=await mkdtemp(join(tmpdir(),'olympus-quota-lock-test-'));
try {
 const file=join(lockDir,'reading.json');
 await Promise.all([storeQuota(payload,file,now),storeQuota(changed,file,now+1000)]);
 assert.equal(JSON.parse(await readFile(file,'utf8')).windows.five_hour.usedPercentage,12);
 await storeQuota(payload,file,now);
 assert.equal(JSON.parse(await readFile(file,'utf8')).windows.five_hour.usedPercentage,12,'Older invocation cannot replace newer observation');
 const saved=await readFile(file,'utf8');
 await mkdir(file+'.lock');await writeFile(join(file+'.lock','owner'),'abandoned-fixture');
 await Promise.all([storeQuota(payload,file,now+2000),storeQuota({},file,now+3000)]);
 assert.equal(await readFile(file,'utf8'),saved,'Contenders fail closed without reclaiming an existing lock');
 assert.equal(await readFile(join(file+'.lock','owner'),'utf8'),'abandoned-fixture');
}finally{await rm(lockDir,{recursive:true,force:true});}
console.log('PASS concurrent writers, older invocation and abandoned lock retain honest evidence');
