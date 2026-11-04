import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingScope.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingScope.mjs',logLevel:'warning'});
const {createBriefingScopeBarrier:create}=await import('../output/tests/briefingScope.mjs');
let calls=0,finish;
const barrier=create(()=>{calls++;return new Promise(resolve=>finish=resolve)});
assert.equal(await barrier.settled(),false,'Uninitialized scope must not be treated as revoked');
const first=barrier.invalidate();assert.equal(calls,1,'Transition must request native revocation');
const waiting=barrier.settled();finish();assert.equal(await first,true);assert.equal(await waiting,true);
let resolvers=[];const racing=create(()=>new Promise(resolve=>resolvers.push(resolve)));
const old=racing.invalidate();const oldWait=racing.settled();const latest=racing.invalidate();
resolvers[0]();assert.equal(await old,false);assert.equal(await oldWait,false,'Old acknowledgment cannot satisfy a new transition');
resolvers[1]();assert.equal(await latest,true);assert.equal(await racing.settled(),true);
const failed=create(async()=>{throw Error('offline')});assert.equal(await failed.invalidate(),false);assert.equal(await failed.settled(),false);
console.log('PASS native revocation barrier, ordering, missing acknowledgment and failure');

const returning=create(async()=>{});await returning.invalidate();const original=returning.capture();await returning.invalidate();await returning.invalidate();assert.equal(original(),false,'A to B to A cannot revive an old lease');
