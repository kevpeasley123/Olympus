import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/email-feedback',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(process.argv[2]??'http://127.0.0.1:31429/');
 await page.evaluate(async()=>{
  const {React,createRoot,EmailAttentionBrief}=await import('/src/email-review-harness.ts');
  document.body.innerHTML='<main style="width:340px;padding:20px;background:#07121a"><div id="fixture"></div></main>';
  const item={threadId:'thread',signature:'sig',timestamp:Date.now(),subject:'Enrollment',suggestion:{title:'Review enrollment',why:'The email asks for review.',action:'Check your selections.',deadline:'',messageId:'msg',quote:'Please review your enrollment.'}};
  window.feedbackRequests=[];window.failFeedback=true;window.switchAccount=false;let hidden=false;
  const client={native:()=>true,status:async()=>({account:{id:window.switchAccount?'other':'a',enabled:true,status:'connected'}}),snapshot:async()=>({accountId:'a',enabled:true,attention:hidden?[]:[item],learning:[{threadId:'thread',signature:'sig',revision:7,action:'restored',current:true,canUndo:true}]}),decide:async()=>{throw Error('legacy route must not run')},learn:async request=>{window.feedbackRequests.push(request);if(window.failFeedback)throw Error('stale revision');hidden=true;}};
  createRoot(document.querySelector('#fixture')).render(React.createElement(EmailAttentionBrief,{client}));
 });
 await page.getByText('Review enrollment',{exact:true}).waitFor();
 for(const name of ['Correct suggestion','Edit correction','Undo last change','Forget feedback'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,'No manual learning workflow: '+name);
 assert.equal(await page.getByText(/What Olympus learned/).count(),0);
 await page.getByRole('button',{name:'Review source',exact:true}).click();
 await page.getByText('Please review your enrollment.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Snooze 1 day',exact:true}).click();
 await page.getByRole('alert').waitFor();
 assert.equal(await page.locator('.email-attention-card').count(),1,'Rejected feedback does not hide source');
 assert.deepEqual((await page.evaluate(()=>window.feedbackRequests))[0],{accountId:'a',threadId:'thread',signature:'sig',expectedRevision:7,action:'snoozed'});
 await page.screenshot({path:'output/email-feedback/attention-desktop.png',fullPage:true});
 await page.evaluate(()=>{window.failFeedback=false;window.switchAccount=true;});
 await page.getByRole('button',{name:'Handled',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.email-attention-card'));
 assert.equal(await page.getByText('Please review your enrollment.',{exact:true}).count(),0,'Account switch clears prior source');
 await page.setViewportSize({width:390,height:800});
 await page.screenshot({path:'output/email-feedback/attention-narrow.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS source review, revisioned actions, failed-action retention, account switch and no manual learning panel');
} finally {await browser.close();}
