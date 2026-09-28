import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/openingBriefing.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/openingBriefing.harness.mjs',logLevel:'warning'});
const {runOpeningBriefingHarness}=await import('../output/tests/openingBriefing.harness.mjs');
const {passed}=runOpeningBriefingHarness();
console.log(`PASS ${passed} opening briefing checks`);
