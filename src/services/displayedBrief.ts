import {invoke} from "@tauri-apps/api/core";
import {isTauriRuntime} from "./launcher";

// A bubble can become visible before the save transaction completes. The
// durable native receipt makes either event order and repeated views safe.
const visible=new Set<string>();
function confirm(id:string){
  if(isTauriRuntime())void invoke("briefing_confirm_display",{messageId:id}).catch(()=>{
    // A later view retries the still-pending receipt.
  });
}
export function briefDisplayed(id:string) {
  visible.add(id);
  if(visible.size>100)visible.delete(visible.values().next().value!);
  confirm(id);
}
export function briefSaved(id:string) {
  if(visible.has(id))confirm(id);
}
