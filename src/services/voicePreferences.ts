import config from "../config/olympusVoice.json";
import type { VoiceDepth } from "./voiceContract";
export const OLYMPUS_VOICES = config.voices;
export const CURATED_VOICES = config.curatedVoices;
export const VOICE_PREVIEW_PHRASE = config.previewPhrase;
export interface VoicePreferences {
  selectedVoice:string;
  speechStyle:"measured"|"conversational"|"concise";
  responseDepth:"brief"|"standard"|"detailed";
  autoSpeak:boolean;
  captionsEnabled:boolean;
  bargeInEnabled:boolean;
}
export const DEFAULT_VOICE_PREFERENCES = config.defaults as VoicePreferences;
export function normalizeVoicePreferences(value:unknown):VoicePreferences {
  const raw = value && typeof value === "object" ? value as Partial<VoicePreferences> : {};
  return {
    selectedVoice:OLYMPUS_VOICES.includes(raw.selectedVoice ?? "") ? raw.selectedVoice! : DEFAULT_VOICE_PREFERENCES.selectedVoice,
    speechStyle:["measured","conversational","concise"].includes(raw.speechStyle ?? "") ? raw.speechStyle! : DEFAULT_VOICE_PREFERENCES.speechStyle,
    responseDepth:["brief","standard","detailed"].includes(raw.responseDepth ?? "") ? raw.responseDepth! : DEFAULT_VOICE_PREFERENCES.responseDepth,
    autoSpeak:typeof raw.autoSpeak === "boolean" ? raw.autoSpeak : DEFAULT_VOICE_PREFERENCES.autoSpeak,
    captionsEnabled:typeof raw.captionsEnabled === "boolean" ? raw.captionsEnabled : DEFAULT_VOICE_PREFERENCES.captionsEnabled,
    bargeInEnabled:typeof raw.bargeInEnabled === "boolean" ? raw.bargeInEnabled : DEFAULT_VOICE_PREFERENCES.bargeInEnabled,
  };
}
export function voiceBehavior(preferences:VoicePreferences) { return `${config.behavior} ${config.styles[preferences.speechStyle]}`; }
export function preferredDepth(text:string, preferences:VoicePreferences):VoiceDepth {
  if (/walk me through|deep dive|explain.*detail/i.test(text)) return "DEEP_DIVE";
  if (/brief me|give me a briefing/i.test(text)) return "BRIEF";
  return preferences.responseDepth === "detailed" ? "DEEP_DIVE" : preferences.responseDepth === "brief" ? "SHORT" : "ANSWER";
}
export function readVoicePreferences(serialized?:string):VoicePreferences {
  try { return normalizeVoicePreferences(JSON.parse(serialized ?? "{}")); } catch { return {...DEFAULT_VOICE_PREFERENCES}; }
}
