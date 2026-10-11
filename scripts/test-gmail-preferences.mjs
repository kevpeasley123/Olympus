import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
await mkdir('output/preferences-review',{recursive:true});const b=await chromium.launch({channel:'msedge'});
try{const p=await b.newPage({viewport:{width:1280,height:800}});await p.goto('http://127.0.0.1:31420/');
await p.evaluate(async()=>{const React=await import('/node_modules/.vite/deps/react.js');const dom=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=dom.createRoot||dom.default.createRoot;const {GmailSettings}=await import('/src/components/panels/GmailSettings.tsx');document.body.innerHTML='<div id="test" style="width:500px;margin:20px"></div>';window.calls=[];const state={configured:true,busy:false,cachedMessages:42,account:{id:'test',email:'example@example.com',enabled:true,status:'authentication_required',horizonDays:90,lastSuccess:null,lastError:null},lastRun:null,candidates:[]};createRoot(document.querySelector('#test')).render((React.createElement||React.default.createElement)(GmailSettings,{api:{native:()=>true,status:async()=>state,action:async a=>window.calls.push(a),horizon:async()=>{},counts:async()=>({olderThan:{messages:5}}),search:async()=>[],thread:async()=>[],removeCache:async()=>{}}}));});
await p.getByText('Gmail connection',{exact:true}).click();await p.getByText('Reconnect required',{exact:true}).waitFor();assert(await p.getByRole('button',{name:'Sync now',exact:true}).isDisabled());
for(const title of ['How your email is used','Sync details','Manage connection & saved data','Browse saved email']){assert(await p.getByText(title,{exact:true}).evaluate(el=>!el.parentElement.open));}
await p.getByLabel('Gmail history range').selectOption('7');await p.getByRole('alertdialog',{name:'Confirm narrower history range'}).waitFor();assert.deepEqual(await p.evaluate(()=>window.calls),[]);await p.getByRole('button',{name:'Keep 90 days'}).click();
await p.screenshot({path:'output/preferences-review/gmail-browser.png'});console.log('PASS Gmail status, disabled sync, collapsed details, narrowing confirmation and no provider actions');
}finally{await b.close()}


