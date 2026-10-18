import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['src/services/usage.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/usage-expiry.mjs'});
const usage=await import('../output/tests/usage-expiry.mjs');
assert.equal(typeof usage.expireUsageWindows,'function','Expired meter readings must become unknown without a refresh');
const base={...usage.unavailableUsage[1],status:'ready',source:'Claude Code statusline (passive local)',observedAt:'2026-01-01T00:00:00Z',windows:[{label:'5-hour',remaining:{value:100,unit:'%',period:'5 hours'},resetsAt:'2026-01-01T01:00:00Z'},{label:'Weekly',remaining:{value:90,unit:'%',period:'7 days'},resetsAt:'2026-01-08T00:00:00Z'}]};
const expired=usage.expireUsageWindows(base,Date.parse('2026-01-01T01:00:00Z'));
assert.equal(expired.windows[0].remaining,null);assert.equal(expired.windows[1].remaining.value,90);assert.equal(base.windows[0].remaining.value,100);
assert.equal(expired.observedAt,base.observedAt);assert.equal(usage.usageFreshness(expired.observedAt,Date.parse('2026-01-01T01:00:00Z')),'Stale');
console.log('PASS meter expiry clears only expired windows, preserves raw input and stale timestamps');

for(const provider of ['ElevenLabs','Codex']){const s={...base,provider};assert.equal(usage.expireUsageWindows(s,Date.parse('2026-01-09T00:00:00Z')),s);}

const historical={...base,evidence:'historical',observedAt:'2026-01-01T01:00:00Z'};
assert.equal(usage.snapshotFreshness(historical,Date.parse('2026-01-01T01:00:01Z')),'Stale','Historical evidence never becomes recent');
assert.equal(usage.snapshotFreshness({...historical,evidence:undefined},Date.parse('2026-01-01T01:00:01Z')),'Recent');
