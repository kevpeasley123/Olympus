import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

// Native replies captured from synthetic SQLite tests, rendered through the real ChatPanel.
const fixture=JSON.parse(await readFile('scripts/fixtures/conversation-feedback.json','utf8'));
const root=resolve('output/conversation-feedback-browser');
await mkdir(root,{recursive:true});
await build({stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ChatPanel} from './src/components/panels/ChatPanel';
import {resolveConversationTurn} from './src/services/conversationFeedback';
import './src/styles.css';import '@fontsource/inter/400.css';import '@fontsource/inter/500.css';import '@fontsource/cinzel/400.css';
const replies=${JSON.stringify(fixture)};
window.providerCalls=0;window.saved=[];
function App(){
 const [messages,setMessages]=useState([{id:'brief',role:'assistant',content:'Email: enrollment needs review. Project: Helios release checks are ready.',timestamp:'Now',kind:'briefing'}]);
 const [pending,setPending]=useState(false);let step=messages.filter(m=>m.role==='user').length;
 async function send(content){
  const id='user-'+step;setPending(true);
  setMessages(m=>[...m,{id,role:'user',content,timestamp:'Now'}]);
  const reply=await resolveConversationTurn(Promise.resolve(true),{id:'chat',temporary:false},id,async()=>{window.providerCalls++;throw Error('Unexpected provider call')},async(command,args)=>{
    window.saved.push(args.messageId);return step===0?replies.question:replies.acknowledgment;
  });
  setMessages(m=>[...m,{...reply,id:'reply-'+step,role:'assistant',timestamp:'Now'}]);setPending(false);
 }
 return <main className="app-shell" style={{height:'100dvh',padding:16,maxWidth:760,margin:'auto',display:'flex',flexDirection:'column'}}><ChatPanel companion layout="expanded" messages={messages} pending={pending} onSendMessage={send}/></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
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
  await page.getByRole('button',{name:'Conversation',exact:true}).click();
  await page.getByRole('textbox',{name:'Command to Olympus'}).fill('I already handled that.');
  await page.getByRole('button',{name:'Send command',exact:true}).click();
  await page.getByText(fixture.question.content,{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Command to Olympus'}).fill('Yes.');
  await page.getByRole('button',{name:'Send command',exact:true}).click();
  await page.getByText(fixture.acknowledgment.content,{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.providerCalls),0);
  assert.deepEqual(await page.evaluate(()=>window.saved),['user-0','user-1']);
  assert.equal(await page.getByRole('button',{name:/^(Edit|Undo|Forget)$/}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(root,'correction-'+width+'.png'),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS real ChatPanel: ordinary correction, conversational clarification, native acknowledgment, no management controls, wide/narrow rendering');
} finally {await browser.close();await new Promise(r=>server.close(r));}
