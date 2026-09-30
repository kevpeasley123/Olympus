import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/capabilities.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/capabilities.harness.mjs',logLevel:'warning',external:['@tauri-apps/api/*']});
const {runCapabilitiesHarness}=await import('../output/tests/capabilities.harness.mjs');
const {passed}=runCapabilitiesHarness();
console.log(`PASS ${passed} capability armory checks`);
