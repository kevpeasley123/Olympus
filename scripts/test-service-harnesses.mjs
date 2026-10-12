// Service harnesses for shipped modules that no other script ran: the first
// four had silently dropped out of the release gate, and the last three ran only
// inside the retired pre-flagship Command harness check.
import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
const harnesses=[['typedVoice','runTypedVoiceHarness'],['voicePreferences','runVoicePreferencesHarness'],['pantheonRecord','runPantheonRecordHarness'],['commandConsole','runCommandConsoleHarness'],['glyphState','runGlyphStateHarness'],['ambientMotion','runAmbientMotionHarness'],['projectRing','runProjectRingHarness']];
// Vite's `?raw` import, which glyphState's harness uses to read styles.css.
const raw={name:'raw',setup(b){
  b.onResolve({filter:/\?raw$/},a=>({path:resolve(dirname(a.importer),a.path.replace(/\?raw$/,'')),namespace:'raw'}));
  b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));
}};
const results=[];
for(const [file,run] of harnesses){
  await build({entryPoints:[`src/services/${file}.harness.ts`],bundle:true,format:'esm',platform:'neutral',outfile:`output/tests/${file}.harness.mjs`,logLevel:'warning',external:['@tauri-apps/*'],plugins:[raw]});
  const result=await (await import(`../output/tests/${file}.harness.mjs`))[run]();
  assert(result.passed,`${file} harness failed: ${JSON.stringify(result)}`);
  results.push(typeof result.passed==='number'?`${file} ${result.passed}`:file);
}
console.log(`PASS service harnesses: ${results.join(', ')}`);
