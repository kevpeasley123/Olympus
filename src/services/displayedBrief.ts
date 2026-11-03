// A view can mount before its message is saved. Resolve both conditions, in either order.
const visible = new Set<string>();
const pending = new Map<string,()=>Promise<void>>();
function flush(id:string) {
  const record=pending.get(id);
  if(!record || !visible.has(id))return;
  pending.delete(id);visible.delete(id);
  void record().catch(()=>{ /* Leave the undelivered revision eligible next time. */ });
}
export function briefDisplayed(id:string) {
  visible.add(id);
  if(visible.size>100)visible.delete(visible.values().next().value!);
  flush(id);
}
export function recordWhenDisplayed(id:string,record:()=>Promise<void>) {
  pending.set(id,record);
  if(pending.size>100)pending.delete(pending.keys().next().value!);
  flush(id);
}
