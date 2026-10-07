import { Channel, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";
import { briefingTurnContent, isBriefing, modelHistory } from "./conversationHistory";
import type { ConversationMessage, OlympusSettings, TrackedProject } from "../types";
import { turnText } from "./turnAttachment";

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
  mail?: import("./gmail").MailExcerpt[];
  request?: import("./modelRouting").ModelRequest;
  voice?: import("./voiceContract").VoiceAnswer;
  research: import("../types").ResearchExcerpt[];
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
  | { kind: "progress"; message: string }
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
  onEvent?: (event: AssistantStreamEvent) => void,
  options?: {requestId?: string; capability?: import("./modelRouting").ModelCapability; voiceDepth?: import("./voiceContract").VoiceDepth; commandBoard?: unknown}
): Promise<AssistantReply> {
  if (!isTauriRuntime()) {
    throw new Error(
      "The assistant runs in the desktop app, where the API key is available. Start it with `npm run tauri dev`."
    );
  }

  const turns: ChatTurn[] = modelHistory(history).map((message) => ({
    role: message.role,
    content: conversationTurnContent(message)
  }));

  // A Channel rather than a global Tauri event: it belongs to this invocation,
  // so concurrent turns cannot interleave and there is no id to filter on.
  const channel = new Channel<AssistantStreamEvent>();
  if (onEvent) channel.onmessage = onEvent;

  return invoke<AssistantReply>("send_assistant_message", {
    history: turns,
    requestId: options?.requestId,
    onEvent: channel,
    context: {
      capability: options?.capability,
      voiceDepth: options?.voiceDepth,
      commandBoard: options?.commandBoard,
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
  notice?: AssistantNotice,
  research?: import("../types").ResearchExcerpt[]
): ConversationMessage {
  return {
    id: `conversation-assistant-${Date.now()}`,
    role: "assistant",
    content,
    notice,
    research,
    at: new Date().toISOString(),
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  };
}

/** Keep conversational references to the spoken abstraction available on later typed turns. */
export function conversationTurnContent(message: ConversationMessage): string {
  if (isBriefing(message)) return briefingTurnContent(message);
  // An attachment rides with its turn in every later request too, so "that
  // thread" stays resolvable from history.
  if (message.voice?.kind !== "output") return turnText(message);
  return `${message.content}\n\nSpoken summary: ${message.voice.spokenResponse ?? "Unavailable"}\nPlayback: ${message.voice.playback ?? "unconfirmed"}. An interrupted transcript may contain words not heard.\nAudio transcript: ${message.voice.audioTranscript ?? "Unavailable"}`;
}

export const cancelAssistantReply = (requestId: string) => invoke<boolean>("cancel_assistant_message", { requestId });
