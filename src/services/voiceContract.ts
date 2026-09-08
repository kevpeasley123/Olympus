import { operationalStatuses, type OperationalStatus } from "./projectCommandBoard";
export type VoicePhase = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING" | "ERROR";
export type VoiceDepth = "ANSWER" | "BRIEF" | "DEEP_DIVE";
export type VoiceUiAction = {type:"show_projects";status?:OperationalStatus|"ALL"} | {type:"open_project"|"review_proposal";projectId:string};
export interface VoiceAnswer {
  spokenResponse:string;
  visualResponse:string;
  proposedActions:VoiceUiAction[];
  requiresConfirmation:boolean;
  conversationState:string;
  messageId?:string;
}
export interface VoiceMessageMetadata {
  kind:"input"|"output";
  spokenResponse?:string;
  audioTranscript?:string;
  playback?:"pending"|"completed"|"interrupted"|"unavailable";
  requiresConfirmation?:boolean;
}
export const VOICE_CLIENT = { shortcutCode:"KeyM", connectTimeoutMs:25000, idleTimeoutMs:120000, maxSessionMs:15*60*1000 } as const;
export function voiceDepthFor(text:string): VoiceDepth {
  if (/walk me through|deep dive|explain.*detail/i.test(text)) return "DEEP_DIVE";
  return /brief me|give me a briefing/i.test(text) ? "BRIEF" : "ANSWER";
}
export function voiceErrorMessage(error:unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission was denied. Allow Olympus microphone access and try again. Text is still available.";
  if (name === "NotFoundError" || name === "NotReadableError") return "The microphone is missing, disconnected, or busy. Text is still available.";
  return error instanceof Error ? error.message : String(error);
}

/** Strict navigation allowlist; neither model prose nor unknown action types can execute. */
export function validateVoiceNavigation(action: unknown, projects: {id:string}[]): VoiceUiAction | null {
  if (!action || typeof action !== "object") return null;
  const value=action as Record<string,unknown>;
  if (value.type === "show_projects") {
    const status=value.status ?? "ALL";
    return typeof status === "string" && (status === "ALL" || operationalStatuses.includes(status as OperationalStatus)) ? {type:"show_projects",status:status as OperationalStatus|"ALL"} : null;
  }
  if ((value.type === "open_project" || value.type === "review_proposal") && typeof value.projectId === "string" && projects.some(project => project.id === value.projectId)) return {type:value.type,projectId:value.projectId};
  return null;
}
