import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/organizer.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/organizer.harness.js',logLevel:'warning'});
const {runOrganizerHarness}=await import('../output/tests/organizer.harness.js');
console.log(`PASS ${runOrganizerHarness().passed} Organizer contract checks`);
