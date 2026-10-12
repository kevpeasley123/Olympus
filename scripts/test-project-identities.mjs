import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/components/panels/ProjectEcosystem.tsx'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/project-identities.mjs',logLevel:'silent'});
const {projectIdentity,projectColor}=await import('../output/tests/project-identities.mjs');
const cases=[['Pokédex','pokeball'],['AI Learning Course','graduation'],['Olympus','mountain'],['Agentic AI Scaffolder','blocks'],['Obsidian Visual Project','network'],['Health app','heartbeat'],['Fruit Organizer','apple'],['Fidelity Agentic AI Development','agent'],['Research Library','book'],['Home Studio','camera'],['Personal Website','monitor'],['Automation Toolkit','settings'],['Unclassified venture','folder']];
for(const [name,symbol] of cases){assert.equal(projectIdentity('opaque-id',name).symbol,symbol,name);assert.equal(projectColor('first',name),projectColor('second',name),'Names preserve colors across source IDs');}
assert.equal(projectIdentity('pokedex').symbol,'pokeball');
assert.equal(projectIdentity('pokedex','Health app').symbol,'heartbeat','Visible name takes priority over obsolete ID');
console.log('PASS 28 semantic project identity checks');
