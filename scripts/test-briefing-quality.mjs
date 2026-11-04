import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('output/tests',{recursive:true});
await build({entryPoints:['src/services/briefingIntelligence.ts'],bundle:true,platform:'node',format:'esm',outfile:'output/tests/briefingQuality.mjs',logLevel:'warning'});
const {briefItems,selectBrief}=await import('../output/tests/briefingQuality.mjs');
const now=Date.parse('2026-11-04T17:00:00Z');
const mail=(id,subject,extra={})=>({messageId:id,threadId:id,fingerprint:'hash-'+id,sender:'Lumen Lights <orders@lights.example.invalid>',timestamp:now-3600000,subject,...extra});
const items=(messages,at=now)=>briefItems({projects:[],board:[],projectsError:null,situations:null,gmail:{busy:false,account:{id:'fixture',enabled:true,status:'connected',lastSuccess:new Date(at).toISOString()},analysis:{state:'blocked'},briefMail:messages}},at).filter(i=>i.id.startsWith('mail:'));
const shipping=mail('ship','Your order has shipped!',{item:'Color Starter kit: 2 E26 smart bulbs (60 W)'});
let result=items([shipping,mail('invoice','Your order invoice'),mail('confirm','Your order has been confirmed!'),mail('receipt','Your receipt from Example Software #0000-0000-0000',{sender:'Example Software'})]);
assert.equal(result.length,1,'Routine receipts/invoices/confirmations are not headline filler');
assert.match(result[0].text,/starter kit.*shipped/i);
assert.doesNotMatch(result[0].text,/60 W|E26|notice lists|sent.*update|[“”"]|arrival.*unconfirmed/i);
assert.equal(items([mail('food','We got your order!',{sender:'Meal Courier',detail:'The estimated delivery time for your scheduled order is 11:30 AM - 11:50 AM on November 3, 2026.'})]).length,0,'Past food delivery is not current news');
result=items([mail('due','Payment due: invoice 123',{detail:'Payment due: November 6, 2026'})]);
assert.equal(result[0].kind,'attention');assert.match(result[0].text,/payment|review/i);
result=items([shipping,mail('problem','Delivery delayed: order #A123')]);
assert.ok(selectBrief(result,{},'opening',now)[0].priority>70,'Actionable shipping problem leads');
result=items([mail('s','Your order #A123 has shipped!'),mail('d','Your order #A123 has been delivered!',{timestamp:now})]);
assert.equal(result.length,1,'Explicit same-sender order reference reconciles shipment state');
assert.match(result[0].text,/delivered/i);assert.doesNotMatch(result[0].text,/has shipped/);
assert.equal(items([mail('s','Your order #A123 has shipped!'),mail('d','Your order #B456 has been delivered!',{timestamp:now})]).length,2,'Distinct orders remain distinct');
assert.equal(items([mail('s','Your order #A123 has shipped!'),mail('d','Your order #A123 has been delivered!',{timestamp:now,sender:'Other <other@example.invalid>'})]).length,2,'Matching order numbers across senders do not merge');
result=items([mail('s','Your order has shipped!',{threadId:'same'}),mail('d','Your order has been delivered!',{threadId:'same',timestamp:now})]);
assert.equal(result.length,1,'Latest state within a thread wins');
result=items([mail('s','Your order has shipped!',{threadId:'same'}),mail('r','Your order invoice',{threadId:'same',timestamp:now})]);
assert.equal(result.length,1);assert.match(result[0].text,/shipped/,'A later receipt does not erase shipment evidence');
result=items([shipping]);assert.doesNotMatch(result[0].text,/arriv|expected|estimated/i,'No ETA invented');
result=items([mail('eta','Your order has shipped!',{detail:'Estimated delivery: November 6, 2026'})]);
assert.match(result[0].text,/estimated.*Nov.*6/i);
result=items([mail('eta','Your order has shipped!',{detail:'Estimated delivery: November 3, 2026'})]);
assert.doesNotMatch(result[0].text,/estimated.*Nov.*3/i,'Expired ETA not presented as upcoming');
assert.doesNotMatch(result[0].text,/was delivered|has arrived/i,'Expired ETA never proves arrival');
assert.equal(items([mail('negative','Your order has not shipped')]).length,0,'Negation is not shipment evidence');
assert.equal(items([mail('negative','Your order is not out for delivery')]).length,0,'Negated delivery state is not asserted');
assert.equal(items([mail('question','Your order has shipped?')]).length,0,'A question is not a shipment assertion');
for(const subject of ['No action required','Payment due?','Delivery delayed?','Automatic transfer not established'])assert.equal(items([mail('negative',subject)]).length,0,'No asserted event from '+subject);
result=items([mail('s','Your order has shipped!',{threadId:'both'}),mail('a','Payment due',{threadId:'both'})]);
assert.equal(new Set(result.map(i=>i.id)).size,2,'Shipment and payment notices never share a receipt ID');
assert.equal(items([mail('failure','We could not deliver your order')])[0].kind,'attention','Actual failed delivery survives negation filtering');
result=items([mail('bad-date','Your order has shipped!',{detail:'Estimated delivery: February 30, 2027'})]);
assert.doesNotMatch(result[0].text,/estimated/i,'Invalid dates are not normalized into invented ETAs');
result=items([mail('setup','Automatic transfer instruction established',{sender:'Example Account Service'}),mail('cancel','Automatic withdrawal instruction canceled',{sender:'Example Account Service'})]);
assert.equal(result.length,2,'Distinct account notices are not assumed to change one instruction');
assert.ok(result.every(i=>i.kind==='attention'&&i.priority>70));
assert.doesNotMatch(result.map(i=>i.text).join(' '),/recurring expense|replacement|make a payment/i,'Fallback does not infer a financial linkage or prescribe a transaction');
console.log('PASS brief quality: concise shipping, action priority, receipt filtering, reconciliation, ETA uncertainty');

const history=[mail('aged-shipping','Your order #Z900 has shipped!',{timestamp:now-7*86400000+3600000}),mail('recent-delivery','Your order #Z900 has been delivered!',{timestamp:now-86400000})];
assert.equal(items(history)[0].revision,items(history,now+2*3600000)[0].revision,'Expiring superseded evidence cannot repeat an unchanged headline');

const resolvedItems=(action,extra={})=>briefItems({projects:[],board:[],projectsError:null,
 gmail:{busy:false,account:{id:'fixture',enabled:true,status:'connected',lastSuccess:new Date(now).toISOString()},analysis:{state:'blocked'},briefMail:[shipping]},
 situations:{accountId:'fixture',enabled:true,attention:[],observations:[],learning:[{threadId:'ship',signature:'current-source',current:true,action,correction:'I arranged this.',until:null,...extra}]}
},now).filter(i=>i.id.startsWith('mail:'));
for(const action of ['handled','dismissed'])assert.equal(resolvedItems(action).length,0,action+' remains suppressed after correction disappears from attention');
assert.equal(resolvedItems('snoozed',{until:now+1000}).length,0,'Active snooze suppresses raw notices');
assert.equal(resolvedItems('snoozed',{until:now-1,correction:''}).length,1,'Expired snooze permits current notice');
assert.equal(resolvedItems('handled',{current:false}).length,1,'Changed source does not inherit old handling');
assert.equal(resolvedItems('handled',{signature:''}).length,1,'Missing source signature cannot suppress');
for(const subject of ['Your order has not shipped','Your order was cancelled','Your order is not out for delivery']){
 assert.equal(items([shipping,mail('contradiction',subject,{threadId:'ship',timestamp:now})]).length,0,'Newer contradictory notice suppresses old shipment: '+subject);
}
assert.equal(items([mail('old','Your order #A123 has shipped'),mail('new','Your order #A123 was cancelled',{timestamp:now})]).length,0,'Explicit order identity links cancellation across threads');
assert.equal(items([shipping,mail('other','Your order was cancelled',{timestamp:now})]).length,1,'Unrelated cancellation does not suppress shipment');
console.log('PASS fallback resolution and newer contradiction regressions');
