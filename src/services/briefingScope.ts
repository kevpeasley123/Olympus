import {invoke} from '@tauri-apps/api/core';
import {isTauriRuntime} from './launcher';

/** Revocation-only UI barrier. It never grants scope or enables inference. */
export function createBriefingScopeBarrier(revoke:()=>Promise<void>){
 let generation=0;
 let pending:Promise<boolean>=Promise.resolve(false);
 return {
  capture(){const current=generation;return ()=>current===generation;},
  invalidate(){
   const current=++generation;
   try { pending=Promise.resolve(revoke()).then(()=>current===generation,()=>false); }
   catch { pending=Promise.resolve(false); }
   return pending;
  },
  async settled(){const current=generation;const acknowledged=await pending;return acknowledged&&current===generation;}
 };
}
export const nativeBriefingScopeBarrier=()=>createBriefingScopeBarrier(async()=>{
 if(isTauriRuntime())await invoke('briefing_revoke_scope');
});
