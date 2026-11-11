import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/agentEvents.harness.ts'],bundle:true,format:'esm',platform:'node',outdir:'output/tests',logLevel:'warning'});
const {runAgentEventsHarness}=await import('../output/tests/agentEvents.harness.js');
console.log(`PASS ${runAgentEventsHarness().passed} agent event feed checks`);
