const integrationBase=process.argv[2]??'http://127.0.0.1:31430';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const faults=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto(integrationBase+'/communications-harness.html?navigator&fit&observatory');
 await page.getByRole('searchbox',{name:'Search relationships, conversations and documents'}).fill('inspection');
 const geometry=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {map:r('.focused-map'),results:r('.focused-search-results'),footer:r('.focused-map-footer')}});
 if(geometry.results.bottom>geometry.map.bottom||geometry.footer.bottom>geometry.map.bottom+1)faults.push('Search results/paging escape the visible map');
 await page.goto(integrationBase+'/focused-map-harness.html');
 const expand=page.getByRole('button',{name:'Focus branch: Inspections',exact:true});await expand.focus();await expand.press('Enter');
 if(!await page.evaluate(()=>document.activeElement?.closest('.focused-node.is-root')))faults.push('Branch navigation loses keyboard focus');
 await page.getByRole('button',{name:'Mark correspondence stale',exact:true}).click();
 await page.getByRole('searchbox').fill('Inspector 0');
 const actorResult=page.locator('.focused-search-results').getByRole('button').first();await actorResult.focus();await actorResult.press('Enter');
 if(!await page.evaluate(()=>document.activeElement?.closest('.focused-detail')))faults.push('Search navigation loses keyboard focus');
 await page.getByRole('searchbox').fill('Inspection appointment');
 const result=page.locator('.focused-search-results').getByRole('button').first();await result.focus();await result.press('Enter');
 if(!await page.getByText('This conversation changed or left the cache. The interpretation may be out of date.',{exact:true}).isVisible())faults.push('Direct thread selection hides stale source warning');
 if(!await page.getByText('Email understanding needs refresh. Saved records remain available.',{exact:true}).isVisible())faults.push('Stale situation warning is not visible across tabs');
 console.log(JSON.stringify({geometry,faults},null,2));
 assert.deepEqual(faults,[]);
 console.log('PASS bounded search and visible stale-source warnings');
} finally {await browser.close()}
