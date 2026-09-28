import {transform} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests/details',{recursive:true});
for(const name of ['dossierDetails','relationshipDossierFixture','documentSituationFixture','contextualActors']){let source=await readFile(`src/services/${name}.ts`,'utf8');source=source.replace("'./documentSituationFixture'","'./documentSituationFixture.mjs'");await writeFile(`output/tests/details/${name}.mjs`,(await transform(source,{loader:'ts',format:'esm'})).code);}
const {dossierDetails:p}=await import('../output/tests/details/dossierDetails.mjs');
const {dossierFixture}=await import('../output/tests/details/relationshipDossierFixture.mjs');
const {projectContextualActors}=await import('../output/tests/details/contextualActors.mjs');
const c=dossierFixture(),actor=projectContextualActors('s',c).find(a=>a.primary==='Example Renovations'),before=JSON.stringify(c),d=p(c,'w0',actor);
let n=0;function check(name,fn){fn();n++;console.log('PASS '+name)}
check('scoped files',()=>assert.equal(d.documents.length,5));
check('operator authorship',()=>assert.equal(d.documents.find(s=>s.id==='contract-draft').origin,'operator-created'));
check('received artifact origin',()=>assert.equal(d.documents.find(s=>s.id==='design').origin,'received'));
check('extension is presentation only',()=>assert.equal(d.documents.find(s=>s.id==='design').type,'ZIP'));
check('no inferred date',()=>assert.equal(p({...c,sources:c.sources.map(s=>({...s,document:undefined}))},'w0',actor).documents[0].document,undefined));
check('related names resolved',()=>assert.ok(d.related.some(r=>r.people.some(p=>p.name==='Casey Rivers'))));
check('uncertainty preserved',()=>assert.ok(d.related.some(r=>r.certainty==='Unconfirmed')));
check('milestones chronological',()=>assert.deepEqual(d.timeline.map(e=>e.date),[...d.timeline.map(e=>e.date)].sort()));
check('planned not completed',()=>assert.equal(d.timeline.find(e=>e.id==='completion').state,'planned'));
check('no history invented',()=>assert.equal(p({...c,milestones:undefined},'w0',actor).timeline.length,0));
check('other workstream excluded',()=>assert.equal(p(c,'w1').timeline.length,0));
check('missing references not timeline evidence',()=>assert.equal(p({...c,milestones:c.milestones.map(e=>({...e,refs:[]}))},'w0').timeline.length,0));
check('invalid calendar dates excluded',()=>assert.equal(p({...c,milestones:c.milestones.map(e=>({...e,date:'2026-02-31'}))},'w0').timeline.length,0));
check('canonical data untouched',()=>assert.equal(JSON.stringify(c),before));
console.log(`PASS ${n} dossier detail checks`);
