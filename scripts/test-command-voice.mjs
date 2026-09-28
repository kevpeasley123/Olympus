import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/commandVoice.harness.ts'],bundle:true,format:'esm',platform:'neutral',outfile:'output/tests/commandVoice.harness.mjs',logLevel:'warning'});
const {runCommandVoiceHarness}=await import('../output/tests/commandVoice.harness.mjs');
const {passed}=runCommandVoiceHarness();
console.log(`PASS ${passed} command console history, route and voice-failure checks`);
