import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Real ChatPanel and delivery service; isolated synthetic sources and no native runtime.
const root=resolve('output/briefing-memory-browser');
await mkdir(root,{recursive:true});
await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {ChatPanel} from './src/components/panels/ChatPanel';
import {prepareFactualBrief} from './src/services/briefingDelivery';
import './src/styles.css';import '@fontsource/inter/400.css';import '@fontsource/inter/500.css';import '@fontsource/cinzel/400.css';
const now=Date.now(),temporary=new URLSearchParams(location.search).has('temporary');
const memory={enabled:true,revision:'snapshot',items:[{id:'chat-a',title:'Helios launch priorities',summary:'Kevin reviewed the Helios accessibility plan, including keyboard navigation, visible focus, screen reader labels, contrast checks, and mobile reading before expanding the release scope. The original plan was to ship on Friday. After checking the remaining work, he corrected that plan: the launch is postponed and no release date is committed.',learnedAt:new Date(now).toISOString(),sourceMessageIds:['u2'],revision:'a'.repeat(64)}]};
window.memoryReads=0;window.deliveries=[];
const client={gmail:async()=>({configured:true,busy:false,cachedMessages:0,account:null,candidates:[],lastRun:null}),situations:async()=>null,receipts:async()=>({}),memory:async()=>{window.memoryReads++;return memory},deliver:async items=>{window.deliveries.push(...items.map(item=>item.id))}};
const project={id:'helios',name:'Helios',status:'active',repoState:'git-pending',lastCommit:'abc',linkedWorktrees:[],sinceSessionCommits:[{at:new Date(now).toISOString(),subject:'Add release checks'}],nextStep:''};
const brief=await prepareFactualBrief({projects:[project],board:[],projectsError:null},'requested',now,client,()=>true,{temporary,conversationId:'current'});
if(!await brief.current())throw Error('Fixture changed');
createRoot(document.getElementById('root')).render(<main className="app-shell" style={{height:'100dvh',padding:16,maxWidth:760,margin:'auto',display:'flex',flexDirection:'column'}}><ChatPanel companion layout="expanded" messages={[{id:'brief',role:'assistant',content:brief.text,timestamp:'Now',at:new Date(now).toISOString(),kind:'briefing'}]} briefing={{id:'brief',text:brief.text}} onSendMessage={()=>{}}/></main>);
await brief.acknowledge();document.documentElement.dataset.ready='true';
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:resolve(root,'app.js'),loader:{'.woff2':'file','.woff':'file','.png':'file'},jsx:'automatic',logLevel:'warning'});
await writeFile(resolve(root,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><style>.app-shell>.command-console{height:100%}</style></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 for(const width of [1280,420]) {
  await page.setViewportSize({width,height:960});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForSelector('html[data-ready="true"]');
  await page.getByRole('button',{name:'Conversation',exact:true}).click();
  await page.getByText(/Remembered from.*Helios launch priorities.*launch is postponed/).waitFor();
  const bubble=await page.locator('.conversation-bubble').boundingBox();
  const viewport=await page.locator('.console-viewport').boundingBox();
  assert.ok(bubble&&viewport&&viewport.height>100&&bubble.y>=viewport.y&&bubble.y+bubble.height<=viewport.y+viewport.height,'The whole brief is visible inside the reading area: '+JSON.stringify({bubble,viewport}));
  assert.match(await page.locator('main').innerText(),/no release date is committed/);
  assert.match(await page.locator('main').innerText(),/Add release checks/);
  assert.doesNotMatch(await page.locator('.console-briefing-label').innerText(),/from project state|no model/,'Attribution must allow remembered summaries and email evidence');
  const delivered=await page.evaluate(()=>window.deliveries); assert.ok(delivered.includes('memory:chat:chat-a') && delivered.includes('project:helios:progress')); assert.equal(delivered.length,new Set(delivered).size);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(root,'brief-'+width+'.png'),fullPage:true});
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/?temporary');
 await page.waitForSelector('html[data-ready="true"]');
 await page.getByRole('button',{name:'Conversation',exact:true}).click();
 assert.doesNotMatch(await page.locator('main').innerText(),/Remembered from|launch is postponed/);
 assert.equal(await page.evaluate(()=>window.memoryReads),0);
 assert.deepEqual(await page.evaluate(()=>window.deliveries),[]);
 assert.deepEqual(errors,[]);
 console.log('PASS real ChatPanel: remembered brief and project evidence, wide/narrow layout, private exclusion and no private receipts');
} finally {await browser.close();await new Promise(r=>server.close(r));}
