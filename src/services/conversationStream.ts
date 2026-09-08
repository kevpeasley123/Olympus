import { useSyncExternalStore } from "react";
import { CONSOLE } from "./commandConsole";
// Only the console subscribes. Text deltas do not rerender the entire instrument.
let text = "", snapshot = "";
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function publish() { timer = undefined; snapshot = text; for (const listener of listeners) listener(); }
export const conversationStream = {
  reset() { clearTimeout(timer); timer = undefined; text = ""; publish(); },
  append(delta: string) { text += delta; if (timer === undefined) timer = setTimeout(publish, CONSOLE.streamBatchMs); },
  current() { return text; }
};
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useConversationStream() { return useSyncExternalStore(subscribe, () => snapshot, () => ""); }
