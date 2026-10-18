import {build} from 'esbuild';
import assert from 'node:assert/strict';
await build({entryPoints:['src/components/panels/UsageSummary.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},outfile:'output/tests/usage-render.mjs'});
const {UsageSummary}=await import('../output/tests/usage-render.mjs');
const {createElement}=await import('react');
const {renderToStaticMarkup}=await import('react-dom/server');
const html=renderToStaticMarkup(createElement(UsageSummary));
assert(!html.includes('<details'),'Usage must always be visible, never a disclosure');
assert(html.includes('Expand usage'),'Details must be accessible');
assert(!html.includes('role="progressbar"'),'Unknown allowances must not expose a numeric progress value');
assert(html.includes('not connected'));
console.log('PASS always-visible Usage and honest unknown allowances');
const fixture = {provider:'Test',capabilityCategory:'models-subscriptions',scope:'Account',source:'Synthetic fixture',observedAt:null,windows:[{label:'Weekly',remaining:{value:65,unit:'%',period:'Week'},resetsAt:null},{label:'Short',remaining:null,resetsAt:null}],balance:{value:12,unit:'USD',period:'Balance'},ytdConsumption:null,ytdSpend:null};
const sample=renderToStaticMarkup(createElement(UsageSummary,{snapshots:[fixture]}));
assert(sample.includes('aria-valuenow="65"'));
assert.equal((sample.match(/role="progressbar"/g)||[]).length,1,'Unknown second window stays nonnumeric');
assert(!sample.includes('aria-valuenow="12"'),'Money is not treated as quota');
assert(!sample.includes('aria-valuenow="12"'),'Money is never divided by a fabricated maximum');
for(const value of [-1,101,NaN]) {
  const invalid=renderToStaticMarkup(createElement(UsageSummary,{snapshots:[{...fixture,windows:[{label:'Weekly',remaining:{value,unit:'%',period:'Week'},resetsAt:null}]}]}));
  assert(!invalid.includes('role="progressbar"'),'Invalid percentages remain unknown');
}
console.log('PASS independent windows, invalid percentages, and currency without invented denominator');
assert(html.includes('Models &amp; subscriptions'),'Capability groups must be explicit');
assert(html.includes('APIs &amp; services'),'Services have their own group');

const regrouped=renderToStaticMarkup(createElement(UsageSummary,{snapshots:[{...fixture,provider:'Future engine',capabilityCategory:'apis-services'}]}));
assert(regrouped.indexOf('Future engine')>regrouped.indexOf('APIs &amp; services'),'Explicit category controls future provider placement');
