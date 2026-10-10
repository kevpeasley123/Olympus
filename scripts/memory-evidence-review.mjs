import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:31430';
const out='output/memory-evidence-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});const checks=[];const errors=[];
const check=(condition,label)=>{assert(condition,label);checks.push(label);};
try{
 for(const [width,height] of [[1280,800],[1440,960],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/command-agent-harness.html?flagship&scenario=chat-expanded&memory-evidence`);
  await page.waitForSelector('html[data-visual-ready]');
  const tab=page.getByRole('button',{name:'Conversation',exact:true});if(await tab.count())await tab.click();
  const summary=page.getByText('Answered by actual-fixture',{exact:true});await summary.scrollIntoViewIfNeeded();
  check(await page.locator('.memory-evidence').count()===0,`Evidence stays closed until details open ${width}`);
  await summary.click();await page.getByText('Memory: partial · 1 passage',{exact:true}).waitFor();
  const source=page.locator('.memory-evidence summary');await source.click();
  await page.locator('.memory-evidence').evaluate(element=>element.scrollIntoView({block:'start'}));
  check(await page.getByText('Source date: Unknown',{exact:false}).isVisible(),`Unknown date stays explicit ${width}`);
  check((await page.locator('.memory-evidence').innerText()).includes('not a native recall result'),`Partial coverage warning visible ${width}`);
  check(await page.locator('.memory-evidence untrusted').count()===0,`Source text stays inert ${width}`);
  check(await page.locator('.memory-evidence').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`Evidence wraps without horizontal overflow ${width}`);
  const composer=page.locator('.console-command-bar');check(await composer.isVisible(),`Composer remains visible ${width}`);
  await page.screenshot({path:`${out}/details-${width}.png`});
  await summary.scrollIntoViewIfNeeded();await summary.focus();await page.keyboard.press('Enter');
  await page.locator('.memory-evidence').waitFor({state:'detached'});
  check(await page.locator('.memory-evidence').count()===0,`Keyboard closes response details ${width}`);
  await page.close();
 }
 check(errors.length===0,'No browser errors');await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} memory evidence checks`);
}finally{await browser.close();}
