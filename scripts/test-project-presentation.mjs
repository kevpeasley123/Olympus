import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output='output/project-presentation';
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0}});
let browser;
try {
 await server.listen();
 console.log('Project preview ready');
 browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=server.resolvedUrls.local[0];
 await page.goto(base+'project-board-harness.html',{waitUntil:'domcontentloaded',timeout:60000});
 console.log('Project fixture loaded');
 const olympus=page.getByRole('article',{name:'Olympus',exact:true});
 await olympus.waitFor();
 assert.match(await olympus.innerText(),/A private, local-first AI command station/,'The card leads with real project vision');
 assert.equal(await olympus.getByText('Owner: Unknown',{exact:true}).isVisible(),false);
 assert.equal(await olympus.locator('.command-project-action').count(),1,'One primary action per project');
 assert.equal(await page.locator('.command-row-details').count(),0,'No redundant card details disclosure');
 assert(await olympus.locator('.portfolio-workload').isVisible(),'Task badge visible');
 for(const width of [1440,1280,980]) {
  await page.setViewportSize({width,height:960});
  const board=page.locator('.command-board-scroll');
  assert(await board.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`No horizontal overflow at ${width}`);
  await page.screenshot({path:`${output}/projects-${width}.png`});
 }
 await olympus.getByRole('button',{name:'Continue project Olympus',exact:true}).click();
 await page.locator('.project-overview').waitFor();
 assert.equal(await page.getByRole('button',{name:'Open project note',exact:true}).isVisible(),false,'Vault shortcut stays behind details');
 assert.equal(await page.getByText('Error: Organizer requires the Olympus desktop connection.',{exact:true}).count(),0);
 for(const heading of ['Vision','Recent changes','Where it stands','Recommended next step'])assert(await page.getByRole('heading',{name:heading,exact:true}).isVisible());
 await page.screenshot({path:`${output}/project-detail.png`});
 await page.goto(base+'project-board-harness.html?run',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>/^(PASS|FAIL)/.test(document.querySelector('#results')?.textContent??''),{},{timeout:60000});
 const result=await page.locator('#results').innerText();assert(result.startsWith('PASS'),result);
 await page.setViewportSize({width:1440,height:960});
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('button',{name:'Project',exact:true}).click();
 await page.locator('.command-project-row').first().waitFor();
 await page.waitForFunction(()=>{
  const panel=document.querySelector('.panel-slot-projects');
  return panel && Number(getComputedStyle(panel).opacity)===1 && panel.getBoundingClientRect().width>500;
 });
 assert.equal(await page.locator('.panel-slot-library').count(),0,'Project mode is focused on projects');
 await page.screenshot({path:`${output}/project-mode-1440.png`});
 await page.setViewportSize({width:1200,height:900});
 await page.getByRole('article',{name:'Obsidian Visual Project',exact:true}).getByRole('heading').click();
 await page.locator('.project-overview').waitFor();
 assert(await page.getByRole('heading',{name:'Obsidian Visual Project',exact:true}).isVisible(),'Card surface opens matching project overview');
 const records=page.locator('.command-project-background');
 assert(await records.evaluate(e=>e.getBoundingClientRect().bottom<=e.closest('.command-board-scroll').getBoundingClientRect().bottom),'Overview and tool rows fit at 1200x900');
 await page.screenshot({path:`${output}/compact-overview-1200.png`});

 assert.deepEqual(errors,[]);
 console.log('PASS project presentation, responsive layout, project navigation and existing board browser checks. '+result);
} catch(error) { console.error(error);process.exitCode=1; }
finally {await browser?.close();await server.close();}
