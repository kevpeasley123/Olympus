import {build} from 'esbuild';
import assert from 'node:assert/strict';
await build({entryPoints:['src/services/briefingOutcome.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingOutcome.mjs'});
const {briefingOutcome,briefingFailure}=await import('../output/tests/briefingOutcome.mjs');
const message={id:'saved-brief',role:'assistant',content:'Your delivery is delayed.',timestamp:'Today'};
assert.equal(briefingOutcome({outcome:'completed',message}).message.content,message.content);
assert.equal(briefingOutcome({outcome:'shadow',message:null}).outcome,'shadow');
assert.equal(briefingOutcome({outcome:'empty',message:null}).outcome,'empty');
for(const invalid of [null,message,{outcome:'empty',message},{outcome:'completed',message:null},{outcome:'shadow',message},{outcome:'completed',message:{...message,role:'user'}},{outcome:'unknown',message:null}]){
 assert.throws(()=>briefingOutcome(invalid),/briefing_result_invalid/,'Malformed or old IPC results cannot masquerade as no changes');
}
console.log('PASS completed, empty and shadow outcomes remain distinct; malformed or stale IPC fails closed');
for(const code of ['briefing_no_verified_sources','briefing_no_current_sources']) {
 assert.match(briefingFailure(code),/could not review enough current evidence/);
 assert.doesNotMatch(briefingFailure(code),/nothing.*attention|no changes/i);
}
assert.match(briefingFailure('provider_unavailable'),/could not finish/);
