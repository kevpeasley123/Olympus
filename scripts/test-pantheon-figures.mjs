import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/pantheonFigureState.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/pantheon-figures.mjs'});
const {PANTHEON_FIGURES,MANIFESTED_FIGURES,agentSessions,nextFigureState,sessionClock,ASSIGNED_SECONDS,COMPLETED_SECONDS}=await import('../output/tests/pantheon-figures.mjs');

const spec=id=>PANTHEON_FIGURES.find(f=>f.id===id);
const heph=spec('hephaestus'),themis=spec('themis'),dionysus=spec('dionysus'),zeus=spec('zeus');
const step=(id,agent,state)=>({id,label:`Step ${id}`,agent,state,recorded:null,tools:[],skills:[]});
const mission=(status,steps,extra={})=>({id:'m1',title:'Project delegation',status,startedAt:'2026-10-13T05:00:00Z',steps,approval:null,...extra});
const run=(spec,missions,memory,now,catalog=null)=>nextFigureState(spec,missions,catalog,memory,now);

// Roster follows the reference render and keeps runtime IDs.
assert.deepEqual(PANTHEON_FIGURES.map(f=>f.id),['zeus','athena','hephaestus','dionysus','themis']);
assert.equal(zeus.station[1]>Math.max(...PANTHEON_FIGURES.filter(f=>f!==zeus).map(f=>f.station[1])),true,'Zeus stands above the others');
assert.equal(heph.agent,'coding-delegate');assert.equal(themis.agent,'verification');
assert.ok(MANIFESTED_FIGURES.every(id=>spec(id)));

// No recorded step, no work.
let m=run(heph,[],null,0);assert.equal(m.state,'idle');
assert.equal(run(heph,[mission('running',[step('a','research','active')])],m,1).state,'idle','another agent\'s step never animates this one');
assert.equal(run(heph,[mission('completed',[step('a','coding-delegate','active')])],m,1).state,'idle','terminal runs are history');

// Assigned is brief, then working; the same step keeps working.
const live=[mission('running',[step('plan','coding-delegate','completed'),step('edit','coding-delegate','active')])];
m=run(heph,live,m,10);assert.equal(m.state,'assigned');assert.equal(m.stepKey,'m1/edit');
assert.equal(run(heph,live,m,10+ASSIGNED_SECONDS/2).state,'assigned');
m=run(heph,live,m,10+ASSIGNED_SECONDS+.01);assert.equal(m.state,'working');
assert.equal(run(heph,live,m,99).since,m.since,'steady state keeps its start');

// Waiting on approval, failed steps, and verification as reviewing.
const waiting=[mission('waiting',[step('edit','coding-delegate','active')],{approval:{required:true,detail:'x'}})];
assert.equal(run(heph,waiting,m,30).state,'waiting');
assert.equal(agentSessions(waiting).get('coding-delegate').approval,true);
assert.equal(run(heph,[mission('waiting',[step('edit','coding-delegate','failed')])],m,30).state,'blocked');
let t=run(themis,[mission('running',[step('v','verification','active')])],null,0);assert.equal(t.state,'assigned');
t=run(themis,[mission('running',[step('v','verification','active')])],t,5);assert.equal(t.state,'reviewing');

// Completed only when the step it worked is recorded completed; a vanished run is not a success.
const handed=[mission('running',[step('edit','coding-delegate','completed'),step('v','verification','active')])];
let c=run(heph,handed,m,40);assert.equal(c.state,'completed');
assert.equal(run(heph,handed,c,40+COMPLETED_SECONDS/2).state,'completed');
assert.equal(run(heph,handed,c,40+COMPLETED_SECONDS+.01).state,'idle');
assert.equal(run(heph,[],m,40).state,'idle');

// Placeholders and unavailable roles are distinct.
assert.equal(run(dionysus,live,null,0).state,'dormant');
const catalog={orchestrator:{id:'olympus',status:'READY',tone:'ready'},agents:[{id:'coding-delegate',status:'UNAVAILABLE',tone:'unavailable'}]};
assert.equal(run(heph,live,null,0,catalog).state,'unavailable');

// Zeus coordinates while any run is live.
assert.equal(run(zeus,[],null,0).state,'idle');
assert.equal(run(zeus,live,null,0).state,'assigned');

// The session indicator only reports a recorded start.
assert.equal(sessionClock('2026-10-13T05:00:00Z',Date.parse('2026-10-13T05:02:14Z')),'02:14');
assert.equal(sessionClock('2026-10-13T05:00:00Z',Date.parse('2026-10-13T06:03:05Z')),'1:03:05');
assert.equal(sessionClock(null,0),null);assert.equal(sessionClock('not a date',0),null);
// An active step outranks a waiting one for the same agent.
const two=[mission('waiting',[step('a','research','waiting')],{id:'w'}),mission('running',[step('b','research','active')],{id:'r'})];
assert.equal(agentSessions(two).get('research').missionId,'r');
console.log('PASS Pantheon figure states');
