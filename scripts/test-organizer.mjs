import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/organizer.harness.ts'],bundle:true,format:'esm',platform:'node',outfile:'output/tests/organizer.harness.js',logLevel:'warning'});
const {runOrganizerHarness}=await import('../output/tests/organizer.harness.js');
console.log(`PASS ${runOrganizerHarness().passed} Organizer contract checks`);
if(!process.argv.includes('--unit')){
 const {createServer}=await import('vite');
 const {chromium}=await import('playwright');
 const {checkOrganizer}=await import('./organizer-browser.mjs');
 const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
 let browser;
 try{
  await server.listen();
  try{browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});}
  catch{browser=await chromium.launch();}
  await checkOrganizer(browser,server.resolvedUrls.local[0].replace(/\/$/,''),'output/tests/organizer-browser');
 }finally{await browser?.close();await server.close()}
}
