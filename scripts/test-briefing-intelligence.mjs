import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingIntelligence.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/briefingIntelligence.mjs',logLevel:'warning'});
const {run}=await import('../output/tests/briefingIntelligence.mjs');
console.log(`PASS ${run()} briefing intelligence checks`);
