import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output='output/project-dock';await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('olympus.mode','project'));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:90000});
 const app=page.locator('.mode-project'),projects=page.locator('.center-stack'),dock=page.getByRole('button',{name:'Ask Olympus',exact:true});
 await dock.waitFor();
 const closedWidth=(await projects.boundingBox()).width;
 assert(closedWidth>1200,'Projects use the available width');
 await page.screenshot({path:output+'/projects-wide.png'});
 await dock.click();const input=page.getByRole('textbox',{name:'Command to Olympus',exact:true});await input.fill('Keep this project draft');
 await page.waitForTimeout(300);assert((await projects.boundingBox()).width<closedWidth-300,'Conversation makes room alongside projects');
 await page.getByRole('heading',{name:/Projects/}).first().click();assert.equal(await input.isVisible(),true,'Outside clicks do not collapse chat');
 await page.screenshot({path:output+'/conversation-open.png'});
 await page.getByRole('button',{name:'Back to projects',exact:true}).click();assert.equal(await input.isVisible(),false);assert(await dock.evaluate(el=>el===document.activeElement),'Focus returns to the dock');
 await dock.click();assert.equal(await input.inputValue(),'Keep this project draft','Draft survives collapse');
 await page.getByRole('button',{name:'Back to projects',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('olympus:focus-console',{detail:{label:'Olympus',context:'Selected project only',prompt:'Evaluate this project',projectId:'olympus'}})));
 await input.waitFor({state:'visible'});assert.equal(await input.inputValue(),'Keep this project draft','Assessment preserves existing draft');assert(await input.evaluate(el=>el===document.activeElement),'Assessment focuses the opened input');
 for(const width of [1280,980,640]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  if(width<1100){assert((await projects.boundingBox()).width>width-100,'Narrow drawer does not squeeze projects');const drawer=await page.locator('.right-stack').boundingBox();assert(drawer.x>=0&&drawer.x+drawer.width<=width+1&&drawer.width>=300,'Drawer stays on screen');assert(await input.isVisible());}
  await page.screenshot({path:`${output}/open-${width}.png`});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Back to projects',exact:true}).click();await dock.click();assert.equal(await input.inputValue(),'Keep this project draft');
 assert.deepEqual(errors,[]);console.log('PASS full-width Projects, explicit chat activation, stable outside clicks, draft retention, focus return, assessment handoff, narrow drawer and reduced motion');
}finally{await browser?.close();await server.close()}
