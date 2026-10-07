import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31426';
const out='output/flagship-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const checks=[],errors=[];
const check=(condition,label)=>{assert(condition,label);checks.push(label)};
try{
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
for(const [width,height] of [[1440,960],[1920,1080],[1280,800],[900,900]]){
 await page.setViewportSize({width,height});await page.goto(base);
 await page.getByRole('button',{name:'Command',exact:true}).click();
 await page.waitForSelector('[data-flagship][data-scene-ready="true"]');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
 check(await page.locator('.command-agent-catalog').count()===0,'No permanent catalog '+width);
 const geometry=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const a=r('.olympus-armory'),c=r('.center-stack'),chat=r('.command-console'),bar=r('.console-command-bar');return {a:a.toJSON(),c:c.toJSON(),chat:chat.toJSON(),bar:bar.toJSON(),width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth}});
 check(geometry.a.right<=geometry.c.left+1,'Armory and hero do not overlap '+width);
 if(width>=1280){check(geometry.c.right<=geometry.chat.left+1,'Hero and chat do not overlap '+width);check(geometry.bar.bottom<=height-25,'Composer fits short viewport '+width);}
 check(geometry.scroll<=width+1,'No horizontal overflow '+width);
 await page.screenshot({path:`${out}/command-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Agents 3',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Olympus Armory'});
 await dialog.waitFor();await dialog.getByRole('button',{name:/Research Agent Finds/}).click();
 check(await dialog.getByText('Scoped Pantheon Research excerpts only',{exact:true}).isVisible(),'Real agent scope '+width);
 check(await page.evaluate(()=>document.activeElement?.tagName==='H3'),'Focus follows loadout '+width);
 await dialog.getByRole('button',{name:'Pantheon library Available',exact:true}).click();
 check(await dialog.getByLabel('Capability detail',{exact:true}).isVisible(),'Capability contract opens '+width);
 await page.keyboard.press('Escape');check(await dialog.count()===0,'Escape closes Armory '+width);
 if(width===1440){
  for(const [name,file] of [['Agents 3','agents'],['Plugins 8','plugins'],['Skills 7','skills'],['Operations 0','operations']]){
   await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(250);await page.screenshot({path:`${out}/${file}.png`,fullPage:true});
   await page.getByRole('button',{name:'Close Armory',exact:true}).click();
  }
 }
}
await page.setViewportSize({width:1440,height:960});
await page.goto(base);await page.getByRole('button',{name:'Command',exact:true}).click();
for(const [name,mode] of [['Project','project'],['Research','research'],['Communications','communications']]){
 await page.getByRole('button',{name,exact:true}).click();await page.locator(`.mode-${mode}`).waitFor();check(true,`${name} opens its actual destination`);
 await page.getByRole('button',{name:'Command',exact:true}).click();
}
await page.getByRole('button',{name:'Open preferences',exact:true}).click();await page.getByRole('dialog').waitFor();check(true,'System opens Preferences');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Agents 3',exact:true}).click();await page.keyboard.press('Escape');
check(await page.getByRole('button',{name:'Agents 3',exact:true}).evaluate(e=>e===document.activeElement),'Armory returns keyboard focus to its trigger');
for(const scenario of ['idle','mission-research','mission-active','reduced-motion']){
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=${scenario}`);
 await page.waitForSelector(`html[data-visual-ready="${scenario}"]`);
 const canvas=page.locator('.hybrid-core canvas');
 check(await canvas.getAttribute('data-projection')==='PerspectiveCamera','Perspective camera '+scenario);
 check(await canvas.getAttribute('data-rings')==='2','Two state-aware inner rings '+scenario);
 if(scenario==='idle'){
  const start=+(await canvas.getAttribute('data-galaxy-time'));const frames=+(await canvas.getAttribute('data-frames'));
  await page.waitForTimeout(2500);const end=+(await canvas.getAttribute('data-galaxy-time'));const endFrames=+(await canvas.getAttribute('data-frames'));
  check(end>start,'Galaxy advances with animation frames');
  const volume=JSON.parse(await canvas.getAttribute('data-volume-depth'));check(volume.front>0&&volume.rear>0,'Bodies occupy foreground and rear volume');
  console.log(JSON.stringify({framesOver2_5Seconds:endFrames-frames,drawCalls:await canvas.getAttribute('data-draw-calls'),volume}));
 }
 if(scenario==='reduced-motion'){
  const start=await canvas.getAttribute('data-galaxy-time');await page.waitForTimeout(1400);check(start===await canvas.getAttribute('data-galaxy-time'),'Reduced motion freezes galaxy');
  await page.evaluate(()=>document.querySelector('.hybrid-core canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await page.getByText('3D view unavailable',{exact:false}).waitFor();check(await page.getByRole('group',{name:'Dashboard mode'}).getByRole('button').count()===4,'Header navigation survives context loss');
 }
 if(scenario.startsWith('mission')){const operationButton=page.locator('.armory-index button').filter({hasText:'Operations'});check((await operationButton.innerText()).includes('1'),'Real fixture active-operation count '+scenario);await operationButton.click();await page.getByRole('dialog').waitFor();}
 await page.waitForTimeout(250);await page.screenshot({path:`${out}/${scenario}.png`,fullPage:true});
}
for(const [voice,level] of [['speaking',0],['speaking',.8],['listening',.4]]){
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=idle&voice=${voice}&level=${level}`);
 await page.waitForSelector('[data-scene-ready="true"]');
 check(await page.getByRole('img',{name:`Voice ${voice}`}).isVisible(),`Voice state ${voice} ${level}`);
 const heights=await page.locator('.pantheon-voice__wave span').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
 check(level===0?Math.max(...heights)===2:Math.max(...heights)>10,`Wave reflects actual level ${level}`);
 await page.screenshot({path:`${out}/voice-${voice}-${level}.png`,fullPage:true});
}
check(errors.length===0,'No page errors');
await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} flagship checks`);
}finally{await browser.close()}
