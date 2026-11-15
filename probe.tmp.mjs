import {chromium} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});const p=await ctx.newPage();p.setDefaultTimeout(60000);
await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
await p.evaluate(()=>{[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim()==='Conversation')?.click()});
await p.waitForTimeout(800);
console.log((await p.evaluate(()=>{const out=[];
 const label=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()==='Opening briefing');
 let msg=label;for(let i=0;i<3;i++)msg=msg.parentElement;
 const walk=(e,d)=>{if(d>3)return;const s=getComputedStyle(e);out.push('  '.repeat(d)+[e.tagName,String(e.className).slice(0,60),s.fontSize,s.lineHeight,s.fontFamily.slice(0,20),s.color,s.backgroundColor].join(' | '));[...e.children].forEach(c=>walk(c,d+1))};
 walk(msg,0);
 let e=msg;for(let i=0;i<7&&e;i++){e=e.parentElement;const s=getComputedStyle(e);out.push('UP '+e.tagName+' '+String(e.className).slice(0,70)+' | '+s.backgroundColor+' | '+s.backgroundImage.slice(0,60));}
 return out})).join('\n'));
await b.close();
