import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/memoryOrbit.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/memory-orbit.mjs'});
const {memoryOrbit}=await import('../output/tests/memory-orbit.mjs');
const front=memoryOrbit(0),back=memoryOrbit(60);
assert(front.z>0&&back.z<0);
assert(front.scale>back.scale&&front.opacity>back.opacity);
assert(front.y<back.y&&back.y<0);
let min=Infinity,max=-Infinity;
for(let t=0;t<=120;t+=.5){const p=memoryOrbit(t);min=Math.min(min,p.x);max=Math.max(max,p.x);assert(p.y<0);assert(p.scale>=.7&&p.scale<=1.14+1e-6);}
assert(max-min>=280);
for(const key of ['x','y','z','scale','opacity'])assert(Math.abs(memoryOrbit(0)[key]-memoryOrbit(120)[key])<1e-6);
assert(Math.abs(memoryOrbit(59.99).x-memoryOrbit(60).x)<.1);
console.log('PASS memory orbit: lower hemisphere, wide path, depth, continuous loop');
