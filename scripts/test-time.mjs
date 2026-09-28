import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/time.harness.ts'],bundle:true,format:'esm',platform:'neutral',outfile:'output/tests/time.harness.mjs',logLevel:'warning'});
const {runTimeHarness}=await import('../output/tests/time.harness.mjs');
const {passed}=runTimeHarness();
console.log(`PASS ${passed} time formatting checks`);
