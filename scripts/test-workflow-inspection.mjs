import {transform} from 'esbuild';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'olympus-inspection-tests-'));
for(const name of ['workflowInspection','workflowInspectionFixture'])await writeFile(join(dir,`${name}.mjs`),(await transform(await readFile(`src/services/${name}.ts`,'utf8'),{loader:'ts',format:'esm'})).code);
const {nodeEvidence,savedSkill,requestReceipts,diagram,eventOutput}=await import(pathToFileURL(join(dir,'workflowInspection.mjs')));
const {inspectionFixture,workflowFixture}=await import(pathToFileURL(join(dir,'workflowInspectionFixture.mjs')));
let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name)};
const completed=inspectionFixture(),legacy=inspectionFixture('legacy');
check('measured duration requires a complete trace',()=>{assert.equal(nodeEvidence('assess',completed.events,false,'completed').durationMs,undefined);assert.ok(nodeEvidence('assess',completed.events,true,'completed').durationMs>=0)});
check('legacy wall time cannot imply monotonic node time or attempts',()=>{const n=nodeEvidence('assess',legacy.events,true,'completed');assert.equal(n.durationMs,undefined);assert.equal(n.attempt,undefined)});
check('intermediate events do not imply node completion',()=>{const n=nodeEvidence('assess',inspectionFixture('interrupted').events,true,'interrupted');assert.equal(n.state,'running at interrupted');assert.equal(n.durationMs,undefined);assert.equal(nodeEvidence('project',inspectionFixture('interrupted').events,true,'interrupted').state,'No recorded event')});
check('repeated starts do not fabricate an aggregate duration',()=>{const events=structuredClone(completed.events);events.push(events.find(e=>e.node==='assess'&&e.state==='running'));assert.equal(nodeEvidence('assess',events,true,'completed').durationMs,undefined)});
check('missing and mismatched attempt metadata cannot imply paired duration',()=>{for(const attempt of [undefined,0,2]){const events=structuredClone(completed.events);events.find(e=>e.node==='assess'&&e.state==='completed').result.attempt=attempt;assert.equal(nodeEvidence('assess',events,true,'completed').durationMs,undefined)}});
check('nonmonotonic boundaries cannot imply duration',()=>{const events=structuredClone(completed.events);events.find(e=>e.node==='assess'&&e.state==='completed').result.elapsedMs=0;assert.equal(nodeEvidence('assess',events,true,'completed').durationMs,undefined)});
check('historical contracts resolve exact versions only',()=>{assert.match(savedSkill(legacy.run.skills,'communication-assess@1').purpose,/Historical/);assert.equal(savedSkill(legacy.run.skills,'communication-assess@2'),undefined);assert.equal(savedSkill(inspectionFixture('missing-contract').run.skills,'communication-assess@1'),undefined)});
check('ambiguous contracts are unavailable',()=>assert.equal(savedSkill([...legacy.run.skills,...legacy.run.skills],'communication-assess@1'),undefined));
check('request start and result are one receipt per actual request',()=>{const r=requestReceipts(completed.events);assert.equal(r.length,2);assert.ok(r.every(r=>r.actualModel==='synthetic-snapshot'));assert.equal(requestReceipts(inspectionFixture('interrupted').events)[0].actualModel,null)});
check('empty selection has no inferred model request',()=>assert.equal(requestReceipts(inspectionFixture('empty').events).length,0));
check('array node results preserve shape',()=>assert.deepEqual(eventOutput({result:{traceVersion:1,data:[1,2]}}),[1,2]));
check('legacy branches stay within diagram bounds',()=>{const nodes=[workflowFixture.definition[0],...['a','b','c'].map(id=>({id,kind:'local',dependsOn:['snapshot'],maxIterations:1}))];const d=diagram(nodes);for(const p of d.points)assert.ok(p.x>=130&&p.x+130<=d.width)});
console.log(`${count} workflow inspection checks passed`);
// Explicit, read-only acceptance against the installed app's history. No content is printed or copied.
if(process.argv.includes('--local-history')){
 const {DatabaseSync}=await import('node:sqlite');
 const db=new DatabaseSync(join(process.env.APPDATA,'com.projectolympus.commandstation','olympus.sqlite'),{readOnly:true});
 try{
  const rows=db.prepare("SELECT payload_json FROM communication_runs WHERE json_extract(payload_json,'$.graph') LIKE 'communication-intelligence/%' ORDER BY rowid DESC").all();
  assert.ok(rows.length,'No saved communication runs available');
  for(const row of rows){
   const run=JSON.parse(row.payload_json);
   const events=db.prepare('SELECT sequence,node,state,at,result_json FROM communication_events WHERE run_id=? ORDER BY sequence').all(run.id).map(({result_json,...e})=>({...e,result:JSON.parse(result_json)}));
   const shape=diagram(run.definition);
   for(const node of run.definition){assert.ok(shape.points.some(p=>p.node.id===node.id));if(node.kind.includes('@'))assert.ok(savedSkill(run.skills,node.kind),'Exact saved contract missing');const evidence=nodeEvidence(node.id,events,true,run.status);if(run.traceVersion!==1)assert.equal(evidence.durationMs,undefined)}
   console.log(JSON.stringify({graph:run.graph,status:run.status,nodes:run.definition.length,savedContracts:run.skills.length,events:events.length,linkedRequests:requestReceipts(events).length,traceVersion:run.traceVersion??'legacy',projection:'passed'}));
  }
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n,0);
  console.log(`${rows.length} real saved run projections passed; read-only connection, no source content exported`);
 }finally{db.close()}
}
