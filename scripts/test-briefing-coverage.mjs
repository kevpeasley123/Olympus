import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=(process.argv[2]??'http://127.0.0.1:31430').replace(/\/$/,'');
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 await page.goto(`${base}/command-agent-harness.html?flagship&scenario=chats&briefing-coverage`);
 await page.waitForSelector('[data-scene-ready="true"]');
 await page.getByRole('button',{name:'Conversation',exact:true}).click();
 const brief=page.locator('[data-message-id="conversation-briefing-coverage-fixture"]');
 await brief.waitFor();
 const disclosure=brief.locator('details.console-briefing-coverage');
 assert.equal(await disclosure.getAttribute('open'),null);
 assert.match(await brief.innerText(),/don't need to send a separate payment/);
 assert.ok(!(await brief.innerText()).includes("doesn't cover"));
 await disclosure.locator('summary').focus();
 await page.keyboard.press('Enter');
 assert.match(await disclosure.innerText(),/selected recent email and project code changes/);
 assert.match(await disclosure.innerText(),/doesn't cover tasks or agent runs/);
 await disclosure.locator('p').scrollIntoViewIfNeeded();
 await mkdir('output/briefing-coverage',{recursive:true});
 await page.screenshot({path:'output/briefing-coverage/expanded.png',fullPage:true});
 await disclosure.locator('summary').click();
 await page.screenshot({path:'output/briefing-coverage/collapsed.png',fullPage:true});
 console.log('PASS accessible coverage disclosure outside briefing prose');
} finally {await browser.close();}
