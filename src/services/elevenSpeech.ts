import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";

export interface ElevenRequest {requestId:string;voiceId:string;modelId:string;text:string;preview:boolean}
export interface ElevenAudio {audioBase64:string}
export function nativeVoiceCommand<T>(command:string,args?:Record<string,unknown>):Promise<T>{
  if(!isTauriRuntime())return Promise.reject(Error("ElevenLabs connects in the Olympus desktop app. This browser preview cannot use your API key."));
  return invoke<T>(command,args);
}
export const synthesizeEleven=(request:ElevenRequest)=>nativeVoiceCommand<ElevenAudio>("elevenlabs_synthesize",{...request});
export const cancelEleven=(requestId:string)=>nativeVoiceCommand<void>("elevenlabs_cancel",{requestId});

/** Only transient audio bytes cross IPC. Never persist the Blob or provider key. */
export function speechUrl(audio:ElevenAudio):string{
  const decoded=atob(audio.audioBase64);
  const bytes=new Uint8Array(decoded.length);
  for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:"audio/mpeg"}));
}
