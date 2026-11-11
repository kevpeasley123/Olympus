import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/memory-readiness',{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:900,height:850}});
 await page.goto(process.argv[2]??'http://127.0.0.1:31429/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main class="preferences-panel" style="max-width:700px;padding:24px"><div id="memory-fixture"></div></main>';
  const status={saveChats:true,learn:true,useMemory:true,savedChats:4,pendingChats:4,earlierWaiting:0,earlierQueued:2,stoppedChats:0,lastLearnedAt:null,lastError:null,memoryNote:'09 - System/Olympus Memory.md',chatsFolder:'10 - Conversations',analysis:{state:'blocked',code:'generation_protection',canAttempt:false,reason:'Analysis is waiting for spending protection.'}};
  window.memoryStatus=status;
  window.__TAURI_INTERNALS__={invoke:async command=>{if(command==='chat_memory_status')return window.memoryStatus;throw Error('Unexpected command '+command);}};
  const {React,createRoot}=await import('/src/harness/email-review-harness.ts');
  const {MemorySettings}=await import('/src/components/panels/MemorySettings.tsx');
  window.renderMemory=()=>{window.memoryRoot?.unmount();window.memoryRoot=createRoot(document.querySelector('#memory-fixture'));window.memoryRoot.render(React.createElement(MemorySettings));};
  window.renderMemory();
 });
 await page.getByText(/4 chats saved/).waitFor();
 assert.match(await page.locator('#memory-fixture').innerText(),/Analysis is waiting for spending protection/);
 assert.match(await page.locator('#memory-fixture').innerText(),/4 chats awaiting learning/);
 assert.doesNotMatch(await page.locator('#memory-fixture').innerText(),/Learning from 2 earlier chats in the background/);
 assert.equal(await page.getByRole('button').count(),0,'Waiting adds no management actions');
 await page.screenshot({path:'output/memory-readiness/blocked-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:850});
 await page.screenshot({path:'output/memory-readiness/blocked-narrow.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>{window.memoryStatus={...window.memoryStatus,analysis:{state:'unverified',code:'runtime_unverified',canAttempt:true,reason:'Synthetic route configured.'},pendingChats:1,earlierQueued:0,lastLearnedAt:new Date().toISOString()};window.renderMemory();});
 await page.getByText(/Last learned from a chat/).waitFor();
 assert.doesNotMatch(await page.locator('#memory-fixture').innerText(),/Analysis is waiting for spending protection/);
 assert.match(await page.locator('#memory-fixture').innerText(),/1 chat awaiting learning/);
 console.log('PASS memory readiness: pending, blocked, resumed, no added controls, narrow layout');
} finally {await browser.close();}
