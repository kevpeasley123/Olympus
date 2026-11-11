import {mkdir} from 'node:fs/promises';
await mkdir('output/canyon-cleanup',{recursive:true});
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 let release;const models=new Promise(resolve=>{release=resolve;});
 await page.route(/\.(glb|gltf)(\?.*)?$/,async route=>{await models;await route.continue();});
 // Model requests are intentionally held below; waiting for all resources here
 // would deadlock the test before it can release them.
 await page.goto((process.argv[2]??'http://127.0.0.1:31430')+'/harness/command-agent-harness.html?flagship&scenario=reduced-motion',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-scene-ready="true"]');
 await page.waitForTimeout(1200);
 const canvas=page.locator('.hybrid-core canvas');
 const before=Number(await canvas.getAttribute('data-frames'));
 assert.ok(await page.locator('.pantheon-figure[data-figure-source="pending"]').count()>0,'model loads are deliberately delayed');
 release();
 await page.waitForFunction(()=>document.querySelectorAll('.pantheon-figure[data-figure-source="statue"],.pantheon-figure[data-figure-source="rigged"]').length===5,{},{timeout:90000});
 await page.waitForTimeout(1500);
 const after=Number(await canvas.getAttribute('data-frames'));
 await page.screenshot({path:'output/canyon-cleanup/reduced-ready.png'});
 assert.ok(after>before,`loaded avatars must redraw with motion disabled (${before} -> ${after})`);
 const time=await canvas.getAttribute('data-galaxy-time');
 await page.waitForTimeout(1200);
 assert.equal(await canvas.getAttribute('data-galaxy-time'),time,'galaxy remains still');
 console.log('PASS delayed avatars redraw with reduced motion; galaxy stays still');
} finally {await browser.close();}
