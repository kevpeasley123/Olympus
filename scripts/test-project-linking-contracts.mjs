import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/project-linking',{recursive:true});
await build({entryPoints:['src/services/projectLinking.harness.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/project-linking/contracts.mjs',logLevel:'warning'});
globalThis.window={crypto:globalThis.crypto};
const {runProjectLinkingContracts}=await import('../output/project-linking/contracts.mjs');
await runProjectLinkingContracts();
