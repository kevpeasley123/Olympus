import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('output/project-linking',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0}});let browser;
try{
 await server.listen();console.log('Project linking preview ready');
 browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'project-linking-harness.html',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:'+ Add project',exact:true}).click();
 await page.getByRole('dialog',{name:'Add a project',exact:true}).waitFor();
 await page.screenshot({path:'output/project-linking/add-project.png'});
 await page.getByRole('button',{name:'Browse…',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Project folder'}).inputValue(),'C:/Fixture/Folder project');
 await page.getByRole('button',{name:'Add project',exact:true}).click();
 await page.getByRole('region',{name:'Project brief',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.project-command')?.textContent.includes('Updating project…'));
 const purpose=page.getByRole('textbox',{name:'What should this project achieve?'});
 await purpose.fill('Make project decisions simple and reliable.');
 await page.getByRole('textbox',{name:'What matters next?'}).fill('Validate the first useful workflow.');
 await page.evaluate(()=>window.projectFixture.failSave());
 await page.getByRole('button',{name:'Save answers',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Fixture save unavailable'}).waitFor();
 assert.equal(await purpose.inputValue(),'Make project decisions simple and reliable.');
 await page.getByRole('button',{name:'Save answers',exact:true}).click();await page.getByText('Answers saved.',{exact:true}).waitFor();
 await page.screenshot({path:'output/project-linking/project-brief.png'});
 await page.evaluate(()=>window.addEventListener('olympus:focus-console',e=>window.assessmentDetail=e.detail,{once:true}));
 await page.getByRole('button',{name:'Evaluate with Olympus →',exact:true}).click();
 assert.match(await page.evaluate(()=>window.assessmentDetail.context),/Make project decisions simple/);
 assert(!(await page.evaluate(()=>window.projectFixture.calls)).some(c=>/assistant|start_delegation/.test(c)));
 await page.getByRole('button',{name:'← All projects',exact:true}).click();
 const card=page.getByRole('article',{name:'Folder project',exact:true});
 await card.getByRole('button',{name:'Continue project Folder project',exact:true}).click();assert.equal(await purpose.inputValue(),'Make project decisions simple and reliable.');
 await page.getByRole('button',{name:'← All projects',exact:true}).click();
 await card.getByLabel('Options for Folder project').click();await page.evaluate(()=>window.projectFixture.blockRemoval(true));
 await card.getByRole('button',{name:'Remove from dashboard',exact:true}).click();await page.getByRole('alert').filter({hasText:'Resolve this project'}).waitFor();assert(await card.isVisible());
 await page.evaluate(()=>window.projectFixture.blockRemoval(false));await card.getByRole('button',{name:'Remove from dashboard',exact:true}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).waitFor();assert.equal(await card.count(),0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await card.waitFor();
 await card.getByLabel('Options for Folder project').click();await card.getByRole('button',{name:'Remove from dashboard',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Add project',exact:true}).click();await page.getByRole('textbox',{name:'Project folder'}).fill('C:/Fixture/Folder project');await page.getByRole('button',{name:'Add project',exact:true}).click();
 await page.getByRole('button',{name:'Restore project',exact:true}).click();await purpose.waitFor();await page.getByRole('button',{name:'← All projects',exact:true}).click();
 for(const [kind,field,value] of [['Git repository','Repository URL','https://github.com/example/repository'],['An idea','Project name','A new idea']]){
  await page.getByRole('button',{name:'+ Add project',exact:true}).click();await page.getByRole('button',{name:kind,exact:true}).click();await page.getByRole('textbox',{name:field,exact:true}).fill(value);await page.getByRole('button',{name:'Add project',exact:true}).click();await purpose.waitFor();await page.waitForFunction(()=>!document.querySelector('.project-command')?.textContent.includes('Updating project…'));await page.getByRole('button',{name:'← All projects',exact:true}).click();
 }
 for(const width of [1440,980,640]){await page.setViewportSize({width,height:960});assert(await page.locator('.command-board-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:`output/project-linking/portfolio-${width}.png`})}
 await page.setViewportSize({width:1440,height:960});
 await card.getByLabel('Options for Folder project').click();await page.keyboard.press('Escape');assert.equal(await card.locator('.project-row-options').getAttribute('open'),null,'Escape closes project options');assert(await card.getByLabel('Options for Folder project').evaluate(e=>e===document.activeElement),'Escape returns focus to options');
 await page.evaluate(()=>window.projectFixture.failReads());
 await card.getByLabel('Options for Folder project').click();await card.getByRole('button',{name:'Remove from dashboard',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).waitFor();
 await page.evaluate(()=>window.projectFixture.remount());await page.getByRole('alert').filter({hasText:'Membership fixture unavailable'}).waitFor();assert.equal(await page.locator('.command-project-row').count(),0,'Unavailable membership never falls back to stale scanned projects');
 assert.deepEqual(errors,[]);console.log('PASS folder picker, Git URL, idea, duplicate restore, removal guard, Undo, saved answers, failure retention, explicit AI handoff, responsive layout, and fail-closed membership after navigation');
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();await server.close()}
