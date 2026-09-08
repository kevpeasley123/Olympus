import type { ConversationMessage } from "../types";
export type ConsoleMode = "dormant" | "engaged" | "transcript";
export const CONSOLE = { nearBottom: 80, exchanges: 3, historyPage: 40, transitionMs: 240, signalMs: 650, streamBatchMs: 40 } as const;
export function liveConversationStart(messages: ConversationMessage[]): number {
  let exchanges = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && ++exchanges === CONSOLE.exchanges) return i;
  }
  return Math.max(0, messages.length - CONSOLE.exchanges * 2);
}
export function consoleStepBack(mode: ConsoleMode): ConsoleMode {
  return mode === "transcript" ? "engaged" : "dormant";
}
export function nearConversationBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= CONSOLE.nearBottom;
}
