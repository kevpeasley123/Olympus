import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
await build({entryPoints:['src/services/resourceIntake.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/resource-intake.mjs'});
const {outlineResource,resourceBody,saveResourceSkill,resourceSkills,skillDescriptor,MAX_SKILL_INSTRUCTION_BYTES}=await import('../output/tests/resource-intake.mjs');
const source='# Evidence\n\nEvidence from the first experiment remains provisional. Additional evidence should be gathered before committing resources.\n\n# Limitations\n\nThe experiment did not include customers outside the original cohort.';
const outline=outlineResource(source);
assert.deepEqual(outline.headings,['Evidence','Limitations']);
assert(outline.passages.length>0&&outline.passages.every(p=>source.includes(p)));
assert.throws(()=>outlineResource(' '));assert.throws(()=>outlineResource('a'.repeat(180001)));
const body=resourceBody(source,outline,{name:'Review',instructions:'Look for gaps'},'My observation');
assert(body.includes('not an AI summary'));assert(body.endsWith(source));assert(body.includes('Look for gaps'));assert(body.includes('My observation'));
console.log('PASS 8 resource outline and preservation checks');

// Isolated browser-preview store: never touches native data or a real browser profile.
const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
globalThis.window=new EventTarget();
assert.equal(MAX_SKILL_INSTRUCTION_BYTES,131072);
const full=readFileSync(new URL('./fixtures/taste-skill-v2.txt',import.meta.url),'utf8');
assert.equal(Buffer.byteLength(full),87253);
assert.equal(createHash('sha256').update(full).digest('hex'),'aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89');
for(const [name,text] of [['Full Taste',full],['Whitespace',' \r\nFull text stays intact.\r\n\t'],['Below limit','a'.repeat(131071)],['At limit','a'.repeat(131072)],['Unicode limit','🙂'.repeat(32768)]]){
 const saved=await saveResourceSkill(name,text);
 assert.equal(saved.instructions,text);
 const stored=(await resourceSkills()).find(s=>s.id===saved.id);
 assert.equal(stored.instructions,text);
 assert.deepEqual(skillDescriptor(stored).allowedTools,[]);
 assert.match(skillDescriptor(stored).effects,/no execution or tool authority/);
}
for(const text of ['a'.repeat(131073),'🙂'.repeat(32768)+'a',' \r\n\t']){
 await assert.rejects(saveResourceSkill('Rejected',text),/131,072 UTF-8 bytes/);
}
await assert.rejects(saveResourceSkill('é'.repeat(81),'valid'),/160 UTF-8 bytes/);
await assert.rejects(saveResourceSkill('full taste','different'),/already exists/);
assert.equal((await resourceSkills()).length,5);
// Mock only the native transport boundary; Rust tests cover the real SQLite path.
let ipc;
window.__TAURI_INTERNALS__={invoke:async(command,args)=>{ipc={command,args};return {id:'test-ipc',...args,createdAt:'test'};}};
await saveResourceSkill('Full Taste native',full);
assert.equal(ipc.command,'add_resource_skill');
assert.equal(ipc.args.instructions,full);
delete window.__TAURI_INTERNALS__;
console.log('PASS full 87,253-byte skill, exact text/JSON preservation, UTF-8 limits, duplicate rejection, no tool grants and mocked native IPC');
