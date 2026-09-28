import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Navigator order/filter/search (review F4), reply recipients (U3), map fit and density (U8), saved-context dates (D3).
await mkdir('output/tests',{recursive:true});
for(const [entry,out] of [['src/services/situationNavigator.ts','situationNavigator'],['src/services/recipients.ts','recipients'],['src/services/situationGraph.ts','situationGraphFit'],['src/services/commsTime.ts','commsTime']])
 await build({entryPoints:[entry],bundle:true,format:'esm',platform:'neutral',outfile:`output/tests/${out}.mjs`,logLevel:'warning'});
const {navigatorEntries,sortEntries,filterEntries,LEVEL_LABEL}=await import('../output/tests/situationNavigator.mjs');
const {parseRecipients,splitRecipients}=await import('../output/tests/recipients.mjs');
const {mapFitScale,mapDensity,MAP_MAX_SCALE,MAP_MIN_SCALE}=await import('../output/tests/situationGraphFit.mjs');
const {contextDate}=await import('../output/tests/commsTime.mjs');
let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name)};

const ref={sourceId:'s',locator:'p. 1'};
const context=(facts,entities=[])=>({version:1,asOf:'2026-09-13',summary:'Saved',phase:'',coverage:'',sources:[{id:'s',title:'S',path:'',sha256:'',category:''}],workstreams:[{id:'a',title:'Payments',summary:'',nextStep:'',refs:[]}],entities,relationships:[],facts});
const question=label=>({label,text:label,status:'needs confirmation',workstream:'a',refs:[ref]});
const situation=(id,state,updatedAt,localContext)=>({id,title:id,state,stale:false,updatedAt,briefing:{},localContext});
const list=[
 situation('email-new','active','2026-09-20T10:00:00Z'),
 situation('review','emerging','2026-09-10T10:00:00Z',context([question('Inspection repairs completed')])),
 situation('attention-old','active','2026-09-01T10:00:00Z',context([question('Current servicer and payment portal')])),
 situation('stable','active','2026-09-25T10:00:00Z',context([],[{id:'e',name:'E',kind:'organization',role:'',status:'stable',workstream:'a',notes:'',contacts:[],refs:[ref]}])),
 situation('attention-new','active','2026-09-05T10:00:00Z',context([question('Payee for closing costs')])),
];
const entries=navigatorEntries(list);
check('policy levels per situation',()=>assert.deepEqual(entries.map(e=>e.level),['not-assessed','review-soon','needs-attention','stable','needs-attention']));
check('correspondence-only situations are not assessed, not guessed',()=>assert.equal(LEVEL_LABEL[entries[0].level],'Not assessed'));
check('needs attention, then review soon, then others; recency within each band',()=>assert.deepEqual(sortEntries(entries).map(e=>e.id),['attention-new','attention-old','review','stable','email-new']));
check('sort is deterministic and does not mutate input',()=>{const before=entries.map(e=>e.id);assert.deepEqual(sortEntries(entries),sortEntries(structuredClone(entries)));assert.deepEqual(entries.map(e=>e.id),before)});
check('filters: active, emerging, open questions',()=>{assert.deepEqual(filterEntries(entries,'emerging','').map(e=>e.id),['review']);assert.equal(filterEntries(entries,'active','').length,4);assert.deepEqual(filterEntries(entries,'questions','').map(e=>e.id).sort(),['attention-new','attention-old','review'])});
check('title search matches every word, case-insensitively',()=>{assert.deepEqual(filterEntries(entries,'all','ATTENTION new').map(e=>e.id),['attention-new']);assert.equal(filterEntries(entries,'all','   ').length,5)});

check('recipient display names kept apart from addresses',()=>assert.deepEqual(parseRecipients('Morgan Ellis <Morgan@Example.invalid>, alex@example.invalid'),{emails:['morgan@example.invalid','alex@example.invalid'],invalid:[]}));
check('quoted commas do not split a recipient',()=>assert.deepEqual(splitRecipients('"Ellis, Morgan" <m@example.invalid>; a@example.invalid'),['"Ellis, Morgan" <m@example.invalid>','a@example.invalid']));
check('entries without a usable address are reported verbatim',()=>assert.deepEqual(parseRecipients('Morgan, x@nodot, ok@example.invalid').invalid,['Morgan','x@nodot']));
check('duplicate addresses collapse',()=>assert.deepEqual(parseRecipients('a@example.invalid, A@Example.invalid').emails,['a@example.invalid']));

check('map fit caps node scale at 1.1',()=>assert.equal(mapFitScale({width:4000,height:3000},{width:1000,height:700}),MAP_MAX_SCALE));
check('map fit floors scale; the canvas scrolls rather than shrinking text',()=>assert.equal(mapFitScale({width:200,height:100},{width:1000,height:700}),MAP_MIN_SCALE));
check('map fit uses the tighter axis',()=>assert.equal(mapFitScale({width:600,height:700},{width:1000,height:700}),.6));
check('density drops lines as scale falls',()=>{assert.equal(mapDensity(null),'full');assert.equal(mapDensity(1),'full');assert.equal(mapDensity(.7),'compact');assert.equal(mapDensity(.5),'tight')});

check('saved-context calendar dates are not shifted by time zone',()=>assert.equal(contextDate('2026-09-13'),'Sep 13, 2026'));
console.log(`${count} navigator, recipient and map fit checks passed`);
