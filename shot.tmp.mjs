import {chromium} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});const p=await ctx.newPage();p.setDefaultTimeout(60000);
await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
const t0=Date.now();
await p.evaluate(()=>{[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim()==='Conversation')?.click()});
await p.locator('#olympus-console-input').fill('How are you today Olympus? Checking how longer lines wrap in this panel.');await p.keyboard.press('Enter');
await p.waitForTimeout(3000);console.log('took',Date.now()-t0);
await p.screenshot({path:'/tmp/conv.png'});
console.log((await p.evaluate(()=>{const out=[];
 const walk=(e,d)=>{if(d>3)return;const s=getComputedStyle(e);out.push('  '.repeat(d)+[e.tagName,String(e.className).slice(0,50),s.fontSize,s.lineHeight,s.color,s.backgroundColor].join(' | '));[...e.children].forEach(c=>walk(c,d+1))};
 [...document.querySelectorAll('.console-message')].slice(-3).forEach(m=>walk(m,0));
 let e=document.querySelector('.console-message');for(let i=0;i<6&&e;i++){e=e.parentElement;const s=getComputedStyle(e);out.push('UP '+String(e.className).slice(0,60)+' | '+s.backgroundColor+' | '+s.backgroundImage.slice(0,50));}
 return out})).join('\n'));
await b.close();
