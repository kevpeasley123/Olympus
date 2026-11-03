import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/email-learning',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(process.argv[2]??'http://127.0.0.1:31429/');
 await page.evaluate(async()=>{
  const {React,createRoot,EmailAttentionBrief}=await import('/src/email-review-harness.ts');
  document.body.innerHTML='<main style="width:340px;padding:20px;background:#07121a"><div id="fixture"></div></main>';
  const item={threadId:'thread',signature:'sig',timestamp:Date.now(),subject:'Enrollment',suggestion:{title:'Review enrollment',why:'The email asks for review.',action:'Check your selections.',deadline:'',messageId:'msg',quote:'Please review your enrollment.'}};
  window.requests=[];window.failLearning=false;window.failRefresh=false;
  const originalInterval=window.setInterval.bind(window);window.setInterval=(callback,delay,...args)=>{if(delay===15000)window.refreshLearning=callback;return originalInterval(callback,delay,...args);};let history=[];let learning=[];
  const snapshot=()=>({accountId:'a',enabled:true,attention:learning[0]?.action==='forgotten'||learning[0]?.action==='handled'?[]:[{...item,operatorCorrection:learning[0]?.action==='corrected'?learning[0].correction:undefined,learningRevision:learning[0]?.revision}],learning});
  const client={native:()=>true,status:async()=>({account:{id:'a',enabled:true,status:'connected'}}),snapshot:async()=>{if(window.failRefresh)throw Error("poll failed");return snapshot();},decide:async()=>{},learn:async request=>{
   window.requests.push(request);if(window.failLearning)throw Error('fixture failure');
   const old=learning[0];if(request.expectedRevision!==(old?.revision??0))throw Error('conflict');
   if(request.action==='forget'){history=[];learning=[{...old,revision:old.revision+1,action:'forgotten',correction:'',original:null,canUndo:false}];return;}
   if(request.action==='undo'){learning=[{...history.pop(),revision:old.revision+1,canUndo:history.length>0}];return;}
   history.push(old??{threadId:'thread',signature:'sig',action:'restored',correction:'',original:item.suggestion,current:true});
   learning=[{threadId:'thread',signature:'sig',revision:(old?.revision??0)+1,action:request.action,correction:request.text??'',original:item.suggestion,current:true,canUndo:true,updatedAt:new Date().toISOString(),until:null}];
  }};
  createRoot(document.querySelector('#fixture')).render(React.createElement(EmailAttentionBrief,{client}));
 });
 await page.getByRole('button',{name:'Correct suggestion',exact:true}).click();
 await page.getByLabel('Your correction').fill('I submitted this. Wait for confirmation.');
 await page.evaluate(async()=>{window.failRefresh=true;await window.refreshLearning();});
 await page.getByRole('alert').waitFor();
 assert.equal(await page.getByLabel('Your correction').count(),1,'Transient polling failure must not discard the correction draft');
 assert.equal(await page.getByLabel('Your correction').inputValue(),'I submitted this. Wait for confirmation.');
 await page.evaluate(async()=>{window.failRefresh=false;await window.refreshLearning();});
 await page.getByRole('button',{name:'Save correction',exact:true}).click();
 await page.getByText('I submitted this. Wait for confirmation.',{exact:true}).first().waitFor();
 assert.equal((await page.evaluate(()=>window.requests))[0].expectedRevision,0);
 await page.getByText(/What Olympus learned/).click();
 await page.getByRole('button',{name:'Edit correction',exact:true}).click();
 await page.getByLabel('Your correction').fill('This is my revised context.');
 await page.evaluate(()=>window.failLearning=true);
 await page.getByRole('button',{name:'Save correction',exact:true}).click();
 await page.getByRole('alert').waitFor();
 assert.equal(await page.getByLabel('Your correction').inputValue(),'This is my revised context.','Failed save retains typed correction');
 await page.evaluate(()=>window.failLearning=false);
 await page.getByRole('button',{name:'Save correction',exact:true}).click();
 await page.getByText('This is my revised context.',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Undo last change',exact:true}).click();
 await page.getByText('I submitted this. Wait for confirmation.',{exact:true}).first().waitFor();
 await page.locator('.email-attention').evaluate(element=>element.scrollTop=0);
 await page.screenshot({path:'output/email-learning/correction-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Edit correction',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'output/email-learning/learning-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Forget feedback',exact:true}).click();
 await page.getByText(/cannot be undone/).waitFor();
 const before=(await page.evaluate(()=>window.requests)).length;
 await page.getByRole('button',{name:'Keep feedback',exact:true}).click();
 assert.equal((await page.evaluate(()=>window.requests)).length,before,'Cancel forgetting does not mutate');
 await page.getByRole('button',{name:'Forget feedback',exact:true}).click();
 await page.getByRole('button',{name:'Forget permanently',exact:true}).click();
 await page.getByText('Feedback forgotten for this source.',{exact:true}).waitFor();
 assert.equal(await page.locator('.email-attention-card').count(),0);
 assert.equal(await page.getByText('I submitted this. Wait for confirmation.',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Undo last change',exact:true}).count(),0);
 await page.setViewportSize({width:390,height:800});
 await page.screenshot({path:'output/email-learning/learning-narrow.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS correction, revision, edit, failed-save retention, undo, forget confirmation and narrow layout');
} finally {await browser.close();}
