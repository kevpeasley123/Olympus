import {build} from 'esbuild';
import assert from 'node:assert/strict';
await build({entryPoints:['src/services/engines.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/engines.mjs'});
const engines=await import('../output/tests/engines.mjs');
assert.equal(typeof engines.describeBilling,'function','Billing must be distinct from subscription sign-in');
assert.match(engines.describeBilling({state:'unknown',detail:'Overage is unverified'}),/blocked/i);
assert.doesNotThrow(()=>engines.describeSignIn({engine:'claude-code',signIn:{state:'subscription',plan:''}}));
await build({entryPoints:['src/services/usage.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/usage.mjs'});
const {formatUsagePercentage,formatUsageMetric,usageFreshness,unavailableUsage}=await import('../output/tests/usage.mjs');
assert.equal(formatUsageMetric(null),'Unavailable');
assert.equal(formatUsageMetric({value:NaN,unit:'credits',period:'2026 YTD'}),'Unavailable');
assert.equal(formatUsageMetric({value:-1,unit:'credits',period:'2026 YTD'}),'Unavailable');
assert.equal(formatUsageMetric({value:0,unit:'credits',period:'2026 YTD'}),'0 credits · 2026 YTD');
assert.equal(formatUsageMetric({value:120,unit:'tokens',period:'This app run'}),'120 tokens · This app run');
assert.equal(formatUsageMetric({value:8,unit:'USD',period:'2026 YTD'}),'8 USD · 2026 YTD');
assert.equal(usageFreshness(null,Date.parse('2026-01-02T00:00:00Z')),'Not checked');
assert.equal(usageFreshness('invalid',Date.now()),'Not checked');
assert.equal(usageFreshness('2026-01-01T00:00:00Z',Date.parse('2026-01-02T00:00:00Z')),'Stale');
assert.equal(usageFreshness('2026-01-02T00:00:00Z',Date.parse('2026-01-02T00:01:00Z')),'Recent');
assert.equal(usageFreshness('2027-01-02T00:00:00Z',Date.parse('2026-01-02T00:00:00Z')),'Not checked');
assert.equal(unavailableUsage.length,3);
for(const snapshot of unavailableUsage){
  assert.equal(snapshot.observedAt,null);
  assert.equal(snapshot.balance,null);
  assert.equal(snapshot.ytdConsumption,null);
  assert.equal(snapshot.ytdSpend,null);
  assert.deepEqual(snapshot.windows,[]);
  assert.equal(snapshot.scope,'Account');
}
console.log('PASS engine billing disclosure, empty plan, usage units/periods, unknown values and freshness');

for (const [value, expected] of [[95.8923154701719,'95.9'],[0,'0.0'],[100,'100.0'],[null,'-'],[NaN,'-'],[-1,'-'],[101,'-']]) assert.equal(formatUsagePercentage(value),expected);
assert.equal(formatUsageMetric({value:95.8923154701719,unit:'%',period:'Billing period'}),'95.9 % · Billing period');
assert.equal(formatUsageMetric({value:22761,unit:'characters',period:'Remaining'}),'22,761 characters · Remaining');
