import config from "../config/olympusVoice.json";
import type { VoiceDepth } from "./voiceContract";
export const OLYMPUS_VOICES = config.voices;
export const CURATED_VOICES = config.curatedVoices;
export const VOICE_PREVIEW_PHRASE = config.previewPhrase;
export interface VoicePreferences {
  speechProvider:"openai"|"elevenlabs"|"local";
  elevenVoiceId:string;
  elevenModelId:string;
  selectedVoice:string;
  speechStyle:"measured"|"conversational"|"concise";
  responseDepth:"brief"|"standard"|"detailed";
  autoSpeak:boolean;
  captionsEnabled:boolean;
  bargeInEnabled:boolean;
  /** Speak a short project briefing once each time Olympus opens. */
  briefOnOpen:boolean;
  /** The Kokoro voice for local speech. Mirrors `VOICES` in `local_speech.rs`. */
  localVoice:string;
}
/** English Kokoro voices, grouped for the voice lab. Kept in step with `local_speech.rs`. */
export const LOCAL_VOICE_GROUPS:{label:string;voices:string[]}[] = [
  {label:"American female",voices:["af_heart","af_bella","af_nicole","af_sarah","af_sky","af_nova","af_alloy","af_aoede","af_jessica","af_kore","af_river"]},
  {label:"American male",voices:["am_adam","am_michael","am_eric","am_liam","am_onyx","am_echo","am_fenrir","am_puck","am_santa"]},
  {label:"British female",voices:["bf_emma","bf_isabella","bf_alice","bf_lily"]},
  {label:"British male",voices:["bm_george","bm_lewis","bm_daniel","bm_fable"]},
];
export const LOCAL_VOICES = LOCAL_VOICE_GROUPS.flatMap(group => group.voices);
export const localVoiceName = (voice:string) => voice.slice(3).replace(/^./, letter => letter.toUpperCase());
export const DEFAULT_VOICE_PREFERENCES:VoicePreferences = {...config.defaults as Omit<VoicePreferences,"speechProvider"|"elevenVoiceId"|"elevenModelId"|"localVoice">,localVoice:"af_sarah",speechProvider:"openai",elevenVoiceId:"NOpBlnGInO9m6vDvFkFC",elevenModelId:"eleven_v4"};
export function normalizeVoicePreferences(value:unknown):VoicePreferences {
  const raw = value && typeof value === "object" ? value as Partial<VoicePreferences> : {};
  return {
    selectedVoice:OLYMPUS_VOICES.includes(raw.selectedVoice ?? "") ? raw.selectedVoice! : DEFAULT_VOICE_PREFERENCES.selectedVoice,
    speechStyle:["measured","conversational","concise"].includes(raw.speechStyle ?? "") ? raw.speechStyle! : DEFAULT_VOICE_PREFERENCES.speechStyle,
    responseDepth:["brief","standard","detailed"].includes(raw.responseDepth ?? "") ? raw.responseDepth! : DEFAULT_VOICE_PREFERENCES.responseDepth,
    autoSpeak:typeof raw.autoSpeak === "boolean" ? raw.autoSpeak : DEFAULT_VOICE_PREFERENCES.autoSpeak,
    captionsEnabled:typeof raw.captionsEnabled === "boolean" ? raw.captionsEnabled : DEFAULT_VOICE_PREFERENCES.captionsEnabled,
    bargeInEnabled:typeof raw.bargeInEnabled === "boolean" ? raw.bargeInEnabled : DEFAULT_VOICE_PREFERENCES.bargeInEnabled,
    briefOnOpen:typeof raw.briefOnOpen === "boolean" ? raw.briefOnOpen : DEFAULT_VOICE_PREFERENCES.briefOnOpen,
    localVoice:LOCAL_VOICES.includes(raw.localVoice ?? "") ? raw.localVoice! : DEFAULT_VOICE_PREFERENCES.localVoice,
    speechProvider:raw.speechProvider==="local"?"local":raw.speechProvider==="elevenlabs"?"elevenlabs":"openai",
    elevenVoiceId:typeof raw.elevenVoiceId==="string"&&/^[\w-]{1,128}$/.test(raw.elevenVoiceId)?raw.elevenVoiceId:DEFAULT_VOICE_PREFERENCES.elevenVoiceId,
    elevenModelId:typeof raw.elevenModelId==="string"&&/^[\w-]{1,128}$/.test(raw.elevenModelId)?raw.elevenModelId:DEFAULT_VOICE_PREFERENCES.elevenModelId,
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
