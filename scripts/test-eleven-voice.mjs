import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/elevenVoice.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/elevenVoice.mjs',logLevel:'warning'});
const {runElevenVoiceHarness}=await import('../output/tests/elevenVoice.mjs');
console.log(`PASS ${(await runElevenVoiceHarness()).passed} ElevenLabs lifecycle checks`);
