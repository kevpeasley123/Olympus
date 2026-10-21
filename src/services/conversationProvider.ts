import {useSyncExternalStore} from "react";
export type ConversationProvider = "codex" | "claude-code" | "legacy-api";
/** Mirrors `CLAUDE_MODELS` in `claude_subscription.rs`; the backend refuses anything else. */
export const CLAUDE_SUBSCRIPTION_MODELS = [
  {id: "claude-opus-5-5", label: "Opus 5.5", description: "Most capable"},
  {id: "claude-sonnet-5-5", label: "Sonnet 5.5", description: "Everyday thinking"},
  {id: "claude-fable-5-1", label: "Fable 5.1", description: "Writing and ideas"},
  {id: "claude-haiku-4-5", label: "Haiku 4.5", description: "Quick answers"},
] as const;
export type ClaudeSubscriptionModel = typeof CLAUDE_SUBSCRIPTION_MODELS[number]["id"];
export interface ConversationChoice {provider: ConversationProvider; claudeModel: ClaudeSubscriptionModel}
const STORAGE_KEY = "olympus.subscriptionChoice";
const isClaudeModel = (value: unknown): value is ClaudeSubscriptionModel => CLAUDE_SUBSCRIPTION_MODELS.some(model => model.id === value);
let selected: ConversationChoice | null = restore();
const listeners = new Set<() => void>();

/**
 * Only a subscription choice survives a relaunch, as a convenience: the backend
 * gate, not this value, decides whether it may run. A paid route is never restored.
 */
function restore(): ConversationChoice | null {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "null");
    return (value?.provider === "claude-code" || value?.provider === "codex") && isClaudeModel(value.claudeModel) ? {provider: value.provider, claudeModel: value.claudeModel} : null;
  } catch { return null; }
}
export function selectConversationProvider(value: string, claudeModel: string = selected?.claudeModel ?? "claude-sonnet-5-5"): void {
  if (value !== "codex" && value !== "claude-code" && value !== "legacy-api") throw Error("Unsupported conversation provider.");
  if (!isClaudeModel(claudeModel)) throw Error("Unsupported Claude subscription model.");
  selected = {provider: value, claudeModel};
  try {
    if (value !== "legacy-api") globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(selected));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch { /* storage is a convenience; the choice still holds for this session */ }
  for (const listener of listeners) listener();
}
export function requireConversationProvider(): ConversationProvider {
  if (!selected) throw Error("Choose a model in the chat's model picker. Paid API calls require separate approval.");
  return selected.provider;
}
export function selectedClaudeModel(): ClaudeSubscriptionModel {
  return selected?.claudeModel ?? "claude-sonnet-5-5";
}
export function useConversationChoice() {
  return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>selected);
}
export function useConversationProvider() {
  return useConversationChoice()?.provider ?? null;
}
