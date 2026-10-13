import { invoke } from "@tauri-apps/api/core";
import { isSeedMessage } from "../data/seed";
import { isTauriRuntime } from "./launcher";
import type { ConversationMessage } from "../types";

/**
 * Separate chats (docs/CONVERSATIONS-AND-MEMORY.md). SQLite owns them on the
 * desktop; the browser preview keeps its single local conversation, so every
 * call here is desktop-only and the preview says so instead of pretending.
 */

export interface ConversationSummary {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  legacy: boolean;
  vaultPath: string | null;
}

export interface ConversationSearchHit {
  conversationId: string;
  title: string;
  messageId: string;
  role: string;
  /** FTS5 snippet; each matched word sits between U+0002 and U+0003. */
  snippet: string;
  at: string;
}

/** The chat the console is showing. A temporary chat is never stored. */
export interface ChatSession {
  id: string;
  title: string;
  temporary: boolean;
}

/** Read at call time: a harness installs its IPC mock after modules load. */
export const chatsAvailable = () => isTauriRuntime();

export function newChatSession(temporary = false): ChatSession {
  return { id: crypto.randomUUID(), title: "", temporary };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  if (!chatsAvailable()) return [];
  return invoke<ConversationSummary[]>("list_conversations", { limit: 200 });
}

export async function loadConversation(id: string): Promise<ConversationMessage[]> {
  const messages = await invoke<ConversationMessage[]>("load_conversation", { id });
  return messages.filter((message) => !isSeedMessage(message));
}

export async function searchConversations(query: string): Promise<ConversationSearchHit[]> {
  if (!chatsAvailable() || !query.trim()) return [];
  return invoke<ConversationSearchHit[]>("search_conversations", { query });
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await invoke("rename_conversation", { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  await invoke("delete_conversation", { id });
}

const TITLE_CHARS = 60;

/**
 * The title the backend gives a chat from its first operator message
 * (`conversations::title_from`), so the console can name a chat before the
 * list is fetched again.
 */
export function titleFrom(text: string): string {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  const words = line.replace(/^[#>\-* ]+/, "").split(/\s+/).filter(Boolean).join(" ").replace(/[*`_]/g, "");
  if ([...words].length <= TITLE_CHARS) return words;
  const cut = [...words].slice(0, TITLE_CHARS).join("");
  const space = cut.lastIndexOf(" ");
  const atWord = space > TITLE_CHARS / 2 ? cut.slice(0, space) : cut;
  return `${atWord.replace(/[,.;:]+$/, "")}…`;
}

export function chatTitle(session: ChatSession, messages: ConversationMessage[]): string {
  if (session.title) return session.title;
  const first = messages.find((message) => message.role === "user");
  return (first && titleFrom(first.content)) || (session.temporary ? "Temporary chat" : "New chat");
}
