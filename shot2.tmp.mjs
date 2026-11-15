import {chromium} from 'playwright';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1672,height:941}});
await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/load.png'});
console.log(await p.evaluate(()=>[...document.querySelectorAll('[role=dialog],dialog[open]')].map(d=>d.className+' '+d.innerText.slice(0,80)).join('\n')));
await b.close();
