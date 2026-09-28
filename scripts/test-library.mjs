import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/components/panels/library/libraryModel.harness.ts'],bundle:true,format:'esm',platform:'neutral',outfile:'output/tests/libraryModel.harness.mjs',logLevel:'warning'});
const {runLibraryModelHarness}=await import('../output/tests/libraryModel.harness.mjs');
const {passed,checks}=runLibraryModelHarness();
for(const name of checks)console.log(`PASS ${name}`);
console.log(`${passed} library model checks passed`);
