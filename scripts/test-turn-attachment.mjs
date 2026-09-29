import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/turnAttachment.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/turnAttachment.harness.mjs',logLevel:'warning'});
const {runTurnAttachmentHarness}=await import('../output/tests/turnAttachment.harness.mjs');
const {passed}=runTurnAttachmentHarness();
console.log(`PASS ${passed} attached-context turn checks`);
