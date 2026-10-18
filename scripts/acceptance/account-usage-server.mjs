import {createInterface} from 'node:readline';
const scenario=process.argv[2];let phase=0;
for await(const line of createInterface({input:process.stdin})){
 const v=JSON.parse(line);
 const expected=['initialize','initialized','account/rateLimits/read','account/usage/read'][phase++];
 if(v.method!==expected)process.exit(2);
 if(v.method==='initialized')continue;
 if(v.id===3 && scenario==='usage-eof')process.exit(0);
 if(v.id===3 && scenario==='usage-malformed'){console.log('invalid');continue;}
 const out=scenario==='unexpected'?{id:91,method:'item/tool/call',params:{}}:v.id===1?{id:1,result:{}}:v.id===2?{id:2,result:{rateLimits:{primary:{usedPercent:20,windowDurationMins:300}}}}:scenario==='usage-error'?{id:3,error:{code:-1,message:'synthetic'}}:{id:3,result:{summary:{lifetimeTokens:1200}}};
 console.log(JSON.stringify(out));
}
