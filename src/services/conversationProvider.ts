import {useSyncExternalStore} from "react";
export type ConversationProvider = "codex" | "legacy-api";
let selected: ConversationProvider | null = null;
const listeners = new Set<() => void>();
/** Session-only: never silently restore a paid route on another launch. */
export function selectConversationProvider(value: string): void {
  if (value !== "codex" && value !== "legacy-api") throw Error("Unsupported conversation provider.");
  selected=value; for (const listener of listeners) listener();
}
export function requireConversationProvider(): ConversationProvider {
  if (!selected) throw Error("Choose a conversation provider in Preferences > Subscription engines. Legacy API may incur API charges.");
  return selected;
}
export function useConversationProvider() {
  return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>selected);
}
