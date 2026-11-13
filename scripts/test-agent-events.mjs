import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/agentEvents.harness.ts','src/services/skillRuns.harness.ts','src/services/activityDeck.harness.ts'],bundle:true,format:'esm',platform:'node',outdir:'output/tests',logLevel:'warning'});
const {runAgentEventsHarness}=await import('../output/tests/agentEvents.harness.js');
const {runSkillRunsHarness}=await import('../output/tests/skillRuns.harness.js');
const {runActivityDeckHarness}=await import('../output/tests/activityDeck.harness.js');
console.log(`PASS ${runAgentEventsHarness().passed} agent event feed checks, ${runSkillRunsHarness().passed} skill run checks and ${runActivityDeckHarness().passed} activity deck checks`);
