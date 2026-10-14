import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/pantheonFigureState.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/pantheon-figures.mjs'});
await build({entryPoints:['src/services/pantheonRig.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/pantheon-rig.mjs',logLevel:'error'});
await build({entryPoints:['src/services/pantheonSkins.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/pantheon-skins.mjs',logLevel:'error',define:{'import.meta.env.DEV':'false','import.meta.env.VITE_PANTHEON_SKIN_PICKER':'undefined'}});
const {PANTHEON_FIGURES,MANIFESTED_FIGURES,agentSessions,nextFigureState,sessionClock,ASSIGNED_SECONDS,COMPLETED_SECONDS}=await import('../output/tests/pantheon-figures.mjs');
const {CLIP_NAMES,RIG_GROUPS,WORK_BEAT,boneSegments,buildSkeleton,figureClips}=await import('../output/tests/pantheon-rig.mjs');
const {SKINS,DEFAULT_SKIN,SKIN_PICKER,finishFor,pantheonSkin,setPantheonSkin,subscribePantheonSkin}=await import('../output/tests/pantheon-skins.mjs');

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

// Every god has the full clip contract on the shared skeleton, and its beat lands inside its work loop.
const {bones}=buildSkeleton(), segments=boneSegments();
assert.equal(bones.size,20);
for(const [group,list] of Object.entries(RIG_GROUPS))for(const b of list)assert.ok(bones.has(b),`group ${group} names unknown bone ${b}`);
for(const f of PANTHEON_FIGURES){
  const clips=figureClips(f.id);
  assert.deepEqual(clips.map(c=>c.name).sort(),[...CLIP_NAMES].sort(),`${f.id} clips`);
  for(const c of clips)for(const t of c.tracks)assert.ok(bones.has(t.name.split('.')[0]),`${f.id} ${c.name} animates unknown ${t.name}`);
  for(const c of clips)assert.ok(!c.tracks.some(t=>/^(Neck|Head)\./.test(t.name)),`${f.id} ${c.name} keys the head, which the gaze owns`);
  const work=clips.find(c=>c.name==='work');assert.ok(WORK_BEAT[f.id]>0&&WORK_BEAT[f.id]<work.duration,`${f.id} beat inside work`);
}
for(const [name,[start,end]] of segments)assert.ok(start.distanceTo(end)>.01,`${name} has a segment`);

// The shipped statues: one per god, and every part binds to known bones.
const manifest=JSON.parse(await readFile('public/pantheon/manifest.json','utf8'));
assert.deepEqual(Object.keys(manifest).sort(),PANTHEON_FIGURES.map(f=>f.id).sort(),'manifest names all five');
for(const [id,file] of Object.entries(manifest)){
  const glb=await readFile(`public/pantheon/${file}`), length=glb.readUInt32LE(12), json=JSON.parse(glb.subarray(20,20+length).toString('utf8'));
  assert.equal(glb.readUInt32LE(0),0x46546c67,`${file} is binary glTF`);
  let tool=0;
  for(const node of json.nodes){
    const [label,binding]=node.name.split('@');
    assert.ok(binding,`${id}: ${node.name} carries a binding`);
    const [names,power]=binding.split('~');
    if(power)assert.ok(/^\d+$/.test(power),`${id}: ${node.name} falloff is a whole number`);
    if(names!=='root')for(const b of RIG_GROUPS[names]??names.split('+'))assert.ok(bones.has(b),`${id}: ${node.name} binds unknown bone ${b}`);
    if(/^Tool/.test(label))tool++;
  }
  assert.equal(tool,1,`${id} has one Tool`);
  // Every part carries its baked occlusion, and every material is one the skins dress.
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
    assert.ok('COLOR_0' in primitive.attributes,`${id}: ${mesh.name} has baked occlusion`);
    const material=json.materials[primitive.material].name;
    for(const skin of SKINS)assert.ok(finishFor(skin,id,material),`${id}: ${skin.name} dresses ${material}`);
  }
}

// Skins: four presets, Aged Bronze by default, the picker shipped while Kevin chooses.
assert.deepEqual(SKINS.map(s=>s.id),['aged-bronze','obsidian-gold','mythic','celestial']);
assert.equal(DEFAULT_SKIN,'aged-bronze');
assert.equal(SKIN_PICKER,true,'the installed build shows the skin picker until a skin is chosen');
assert.equal(pantheonSkin(),'aged-bronze');
for(const skin of SKINS)for(const god of PANTHEON_FIGURES){
  for(const slot of ['marble','cloth']){
    const f=finishFor(skin,god.id,slot);
    // Never pure white: the togas are a crisp white that still leaves room for shading.
    const c=f.color, max=Math.max(c>>16,(c>>8)&255,c&255);
    assert.ok(max<=0xf0,`${skin.name} ${god.id} ${slot} stays below pure white`);
  }
  assert.ok(skin.lighting.backShadow>0&&skin.lighting.backShadow<.7,`${skin.name} shadow stays soft`);
}
const shown=[];const stop=subscribePantheonSkin(()=>shown.push(pantheonSkin()));
setPantheonSkin('mythic');setPantheonSkin('mythic');setPantheonSkin('nonsense');stop();
assert.deepEqual(shown,['mythic'],'a skin change notifies once, and unknown skins are ignored');
console.log('PASS Pantheon figure states, rig and statues');
