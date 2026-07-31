import { Channel, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";
import type { ConversationMessage, OlympusSettings, TrackedProject } from "../types";

/**
 * An app-level statement about how the turn ended. Never model prose — it is
 * rendered distinctly from assistant text precisely so the two cannot be
 * confused.
 */
export interface AssistantNotice {
  kind: "refusal" | "truncated";
  message: string;
}

export interface AssistantReply {
  content: string;
  model: string;
  /** Present when the turn was refused or truncated. Appended, never substituted. */
  notice?: AssistantNotice;
  /** The model that declined, when a mid-stream fallback changed who answered. */
  fellBackFrom?: string;
}

/**
 * Events from the in-flight turn, in arrival order.
 *
 * `delta` is the one that matters for presence: **the first `delta` is the
 * moment the omega stops thinking and starts speaking.** Not `started` — that
 * fires on the response envelope, before any text exists, and deriving the
 * speaking state from it would collapse the two states into one.
 */
export type AssistantStreamEvent =
  | { kind: "started"; model: string }
  | { kind: "delta"; text: string }
  | { kind: "fellBack"; from: string; to: string };

interface ChatTurn {
  role: string;
  content: string;
}

/**
 * The API key lives in the Tauri process and is never exposed to the webview,
 * so the request is made from Rust rather than here.
 */
export async function requestAssistantReply(
  history: ConversationMessage[],
  settings: OlympusSettings,
  projects: TrackedProject[],
  onEvent?: (event: AssistantStreamEvent) => void
): Promise<AssistantReply> {
  if (!isTauriRuntime()) {
    throw new Error(
      "The assistant runs in the desktop app, where the API key is available. Start it with `npm run tauri dev`."
    );
  }

  const turns: ChatTurn[] = history.map((message) => ({
    role: message.role,
    content: message.content
  }));

  // A Channel rather than a global Tauri event: it belongs to this invocation,
  // so concurrent turns cannot interleave and there is no id to filter on.
  const channel = new Channel<AssistantStreamEvent>();
  if (onEvent) channel.onmessage = onEvent;

  return invoke<AssistantReply>("send_assistant_message", {
    history: turns,
    onEvent: channel,
    context: {
      projectsRootPath: settings.projectsRootPath,
      projects: projects.map((project) => ({
        name: project.name,
        status: project.status,
        branch: project.branch,
        repoState: project.repoState,
        vision: project.vision,
        lastCommit: project.lastCommit,
        nextStep: project.nextStep
      }))
    }
  });
}

export function createAssistantMessage(
  content: string,
  notice?: AssistantNotice
): ConversationMessage {
  return {
    id: `conversation-assistant-${Date.now()}`,
    role: "assistant",
    content,
    notice,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  };
}
