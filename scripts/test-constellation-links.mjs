import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/constellationLinks.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/constellation-links.mjs'});
const {constellationLinks}=await import('../output/tests/constellation-links.mjs');
assert.deepEqual(constellationLinks([]),[]);
assert.deepEqual(constellationLinks([{x:50,y:50}]),[]);
// Every node must belong to one connected group, including coincident points
// and the collection node outside the central skill cluster.
for (const points of [
  [{x:50,y:50},{x:50,y:50},{x:100,y:100}],
  [...Array.from({length:24},(_,i)=>({x:50+Math.cos(i)*25,y:50+Math.sin(i)*25})),{x:100,y:100}],
]) {
  const edges=constellationLinks(points);
  assert.equal(edges.length,points.length-1);
  const reached=new Set([points[0]]);
  for (let i=0;i<points.length;i++) for (const {a,b} of edges) {
    assert(points.includes(a)&&points.includes(b));
    if(reached.has(a)||reached.has(b)){reached.add(a);reached.add(b);}
  }
  assert.equal(reached.size,points.length);
  assert.deepEqual(constellationLinks(points),edges);
}
console.log('PASS constellation connectivity, empty/single groups, coincident points and collection inclusion');
