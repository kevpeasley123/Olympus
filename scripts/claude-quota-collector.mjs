import {readFile,writeFile,rename,mkdir,stat,unlink,rmdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Only quota fields are retained. Statusline input never reaches disk or logs. */
export function collectQuota(input,previous,now=Date.now()) {
 const windows={};
 for(const name of ['five_hour','seven_day']) {
  const q=input?.rate_limits?.[name];
  if(!q || typeof q.used_percentage!=='number' || !Number.isFinite(q.used_percentage) || q.used_percentage<0 || q.used_percentage>100 || !Number.isSafeInteger(q.resets_at) || q.resets_at<=now/1000 || q.resets_at>now/1000+8*86400) continue;
  const old=previous?.windows?.[name];
  const unchanged=old?.usedPercentage===q.used_percentage && old?.resetsAt===q.resets_at && Number.isFinite(Date.parse(old?.observedAt)) && Date.parse(old.observedAt)<=now;
  windows[name]={usedPercentage:q.used_percentage,resetsAt:q.resets_at,observedAt:unchanged?old.observedAt:new Date(now).toISOString()};
 }
 const same=JSON.stringify(windows)===JSON.stringify(previous?.windows);
 return {version:1,observedAt:same&&Number.isFinite(Date.parse(previous?.observedAt))&&Date.parse(previous.observedAt)<=now?previous.observedAt:new Date(now).toISOString(),windows};
}

export async function storeQuota(input,file,now=Date.now()) {
 await mkdir(dirname(file),{recursive:true});
 const lock=file+'.lock';let acquired=false;
 for(let attempt=0;attempt<40;attempt++) {
  try {await mkdir(lock);acquired=true;await writeFile(join(lock,'owner'),String(process.pid));break;}
  catch(e) {
   if(acquired){await unlink(join(lock,'owner')).catch(()=>{});await rmdir(lock).catch(()=>{});throw e;}
   if(e.code!=='EEXIST')throw e;
   // Fail closed on an abandoned lock. Automatic reclamation can race with
   // another writer; explicit recovery must first verify no collector is active.
   await new Promise(resolve=>setTimeout(resolve,25));
  }
 }
 if(!acquired)return;
 try {
  let previous=null;
  try {if((await stat(file)).size<=8192)previous=JSON.parse(await readFile(file,'utf8'));}catch{}
  if(Date.parse(previous?.observedAt)>now)return;
  const next=collectQuota(input,previous,now);
  if(JSON.stringify(next)===JSON.stringify(previous))return;
  const temp=file+'.'+process.pid+'.'+Math.random().toString(16).slice(2)+'.tmp';
  try {await writeFile(temp,JSON.stringify(next),{flag:'wx',mode:0o600});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
 } finally {await unlink(join(lock,'owner')).catch(()=>{});await rmdir(lock).catch(()=>{});}
}

async function main() {
 let size=0;const chunks=[];
 for await(const chunk of process.stdin){size+=chunk.length;if(size>1024*1024)return;chunks.push(chunk);}
 const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const index=process.argv.indexOf('--output');
 const file=index>=0?process.argv[index+1]:process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'Olympus','telemetry','claude-quota.json'):null;
 if(file)await storeQuota(input,file);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{});
