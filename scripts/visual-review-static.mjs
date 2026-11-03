// Bounded static-bundle fallback for development-server stalls.
import {build} from 'esbuild';
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {spawn} from 'node:child_process';
const root=resolve('output/static-visual');await mkdir(root,{recursive:true});await cp('public',root,{recursive:true});
for(const [html,entry] of [['index','main'],['command-agent-harness','command-agent-harness'],['organizer-harness','organizer-harness']]){
await build({entryPoints:[`src/${entry}.tsx`],bundle:true,format:'esm',outfile:resolve(root,entry+'.js'),loader:{'.woff2':'file','.woff':'file','.png':'file','.svg':'file'},jsx:'automatic',define:{'import.meta.env.DEV':'true','import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"'},logLevel:'warning'});
await writeFile(resolve(root,html+'.html'),`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${entry}.css"></head><body><div id="root"></div><script type="module" src="/${entry}.js"></script></body></html>`);
}
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(p)]||'application/octet-stream');res.end(await readFile(p))}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const child=spawn(process.execPath,['scripts/visual-review.mjs','--url',`http://127.0.0.1:${server.address().port}`,...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
const timeout=setTimeout(()=>child.kill(),600000);
try{process.exitCode=await new Promise(r=>child.on('exit',code=>r(code??1)));}finally{clearTimeout(timeout);server.closeAllConnections();await new Promise(r=>server.close(r));}
