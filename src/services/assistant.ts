import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";
import type { ConversationMessage, OlympusSettings, TrackedProject } from "../types";

export interface AssistantReply {
  content: string;
  model: string;
}

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
  projects: TrackedProject[]
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

  return invoke<AssistantReply>("send_assistant_message", {
    history: turns,
    context: {
      vaultPath: settings.vaultPath,
      projectsRootPath: settings.projectsRootPath,
      projects: projects.map((project) => ({
        name: project.name,
        status: project.status,
        branch: project.branch,
        repoState: project.repoState,
        nextStep: project.nextStep
      }))
    }
  });
}

export function createAssistantMessage(content: string): ConversationMessage {
  return {
    id: `conversation-assistant-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  };
}
