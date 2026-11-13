import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const out='output/canyon-cleanup';
const base=process.argv[2]??'http://127.0.0.1:31430';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];const errors=[];
try{
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
for(const [width,height] of [[1440,960],[1280,960],[1280,800],[1280,720],[1920,1080],[1201,960],[1051,900],[1000,900]]){
 await page.setViewportSize({width,height});
 await page.goto(base+'/harness/command-agent-harness.html?flagship&scenario=mission-research&missions=2');
 await page.waitForSelector('[data-scene-ready="true"]');await page.evaluate(()=>document.fonts.ready);
 await page.getByRole('button',{name:'Codex',exact:true}).click();
 await page.waitForTimeout(1800);
 const measure=()=>{
  const box=e=>e.getBoundingClientRect().toJSON();
  const get=s=>box(document.querySelector(s));
  const dial=get('.command-instrument__dial'),engine=get('.instrument-engine'),voice=get('.olympus-voice-dock');
  const rects=[...document.querySelectorAll('.pantheon-figure,.pantheon-figure__label,.pantheon-figure__session')].map(e=>({name:(e.dataset.figureId??e.parentElement.dataset.figureId)+' '+e.className,...box(e)}));
  const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
  const faults=[];
  for(const r of rects){if(r.left<dial.left-1||r.right>dial.right+1||r.top<engine.bottom+4||r.bottom>voice.top-4)faults.push(r.name+' outside readable stage');if(overlap(r,engine)||overlap(r,voice))faults.push(r.name+' overlaps control');}
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)if(overlap(rects[i],rects[j]))faults.push(rects[i].name+' overlaps '+rects[j].name);
  const clusters=[...document.querySelectorAll('.armory-constellation,.skills-constellation')].map(e=>({name:e.className,...box(e)}));
  for(const c of clusters)for(const r of rects)if(overlap(c,r))faults.push(c.name+' overlaps '+r.name);
  const canvas=document.querySelector('.hybrid-core canvas'),cb=box(canvas);
  const sphere=JSON.parse(canvas.dataset.galaxyEnvelope);
  sphere.x+=cb.left;sphere.y+=cb.top;
  for(const r of [...rects,...clusters,{name:'engine',...engine},{name:'voice',...voice}]){
   const dx=Math.max(r.left-sphere.x,0,sphere.x-r.right),dy=Math.max(r.top-sphere.y,0,sphere.y-r.bottom);
   if(Math.hypot(dx,dy)<sphere.r)faults.push(r.name+' intersects particle envelope');
  }
  const tiles=[...document.querySelectorAll('.usage-summary--dock .usage-tile')].map(e=>({name:e.textContent,...box(e)}));
  if(document.documentElement.scrollWidth>innerWidth+1)faults.push('Horizontal page overflow');
  return {faults,dial,engine,voice,rects,clusters,tiles,sphere,selected:document.querySelector('.instrument-engine [aria-pressed=true]')?.textContent};
 };
 const data=await page.evaluate(measure);
 if([1440,1201,1280].includes(width)){
  for(const [x,y] of [[.02,.02],[.98,.02],[.98,.98],[.02,.98]]){
   await page.mouse.move(data.dial.x+data.dial.width*x,data.dial.y+data.dial.height*y);
   await page.waitForTimeout(800);
   const sample=await page.evaluate(measure);
   data.faults.push(...sample.faults.map(f=>`Pointer ${x}/${y}: ${f}`));
  }
 }
 await page.screenshot({path:`${out}/${width}x${height}.png`,fullPage:true});
 results.push({width,height,...data});console.log(`${width}x${height}: ${data.faults.length?data.faults.join('; '):'PASS geometry'}`);
}
await writeFile(out+'/report.json',JSON.stringify({results,errors},null,2));
if(errors.length||results.some(r=>r.faults.length)){console.log(errors);process.exitCode=1;}
}finally{await browser.close();}
