import {useEffect,useRef,useState} from "react";
import {nativeVoiceCommand} from "../../services/elevenSpeech";
import {isTauriRuntime} from "../../services/launcher";
import type {VoicePreferences} from "../../services/voicePreferences";

export function ElevenVoiceSettings({preferences,onChange,onPreview,onStop,busy}:{preferences:VoicePreferences;onChange:(patch:Partial<VoicePreferences>)=>void;onPreview:()=>void;onStop:()=>void;busy:boolean}){
  const native=isTauriRuntime();
  const [configured,setConfigured]=useState(false),[working,setWorking]=useState(false),[status,setStatus]=useState("");
  const [voice,setVoice]=useState(preferences.elevenVoiceId),[model,setModel]=useState(preferences.elevenModelId);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;if(native)void nativeVoiceCommand<{configured:boolean}>("elevenlabs_status").then(value=>{if(alive.current)setConfigured(value.configured);}).catch(error=>{if(alive.current)setStatus(String(error));});return()=>{alive.current=false;};},[native]);
  useEffect(()=>{setVoice(preferences.elevenVoiceId);setModel(preferences.elevenModelId);setStatus("");},[preferences.elevenVoiceId,preferences.elevenModelId]);
  async function run(action:()=>Promise<void>){setWorking(true);setStatus("");onStop();try{await action();}catch(error){if(alive.current)setStatus(error instanceof Error?error.message:String(error));}finally{if(alive.current)setWorking(false);}}
  const valid=/^[\w-]{1,128}$/.test(voice)&&/^[\w-]{1,128}$/.test(model);
  const changed=voice!==preferences.elevenVoiceId||model!==preferences.elevenModelId;
  return <div className="eleven-voice-settings">
    <p className="voice-settings-hint">{native?(configured?"API key saved in Windows Credential Manager.":"Connect your ElevenLabs API key to use this voice."):"Connect ElevenLabs in the native Olympus desktop app. This browser is a visual preview."}</p>
    <div className="eleven-voice-actions">
      <button type="button" className="ghost-action" disabled={!native||working} onClick={()=>void run(async()=>{const saved=await nativeVoiceCommand<boolean>("elevenlabs_connect");if(saved){setConfigured(true);setStatus("Key saved. Check connection before previewing.");}else setStatus("Key entry cancelled.");})}>{configured?"Replace API key":"Connect API key"}</button>
      {configured&&<button type="button" className="ghost-action" disabled={working} onClick={()=>void run(async()=>{await nativeVoiceCommand("elevenlabs_disconnect");setConfigured(false);setStatus("API key removed from this computer.");})}>Remove key</button>}
    </div>
    <p className="voice-settings-hint">The Windows dialog asks for a password: paste your API key there. Leave the user name unchanged.</p>
    <label className="voice-setting-row">Voice ID<input aria-label="ElevenLabs voice ID" value={voice} maxLength={128} spellCheck={false} onChange={e=>setVoice(e.target.value)}/></label>
    <label className="voice-setting-row">Speech model<input aria-label="ElevenLabs speech model" value={model} maxLength={128} spellCheck={false} onChange={e=>setModel(e.target.value)}/></label>
    <div className="eleven-voice-actions">
      {changed&&<button type="button" className="ghost-action" disabled={!valid||working} onClick={()=>onChange({elevenVoiceId:voice,elevenModelId:model})}>Save voice settings</button>}
      <button type="button" className="ghost-action" disabled={!native||!configured||working||changed} onClick={()=>void run(async()=>{const result=await nativeVoiceCommand<{voiceName:string;modelName:string}>("elevenlabs_check",{voiceId:preferences.elevenVoiceId,modelId:preferences.elevenModelId});setStatus(`Available: ${result.voiceName} · ${result.modelName}. No speech generated.`);})}>Check connection</button>
      <button type="button" className="ghost-action" disabled={!native||!configured||working||changed} onClick={busy?onStop:onPreview}>{busy?"Stop preview":"Preview voice"}</button>
    </div>
    <p className="voice-settings-hint">English · Preview and spoken replies use ElevenLabs credits. Connection check generates no audio. Microphone transcription continues through OpenAI. No automatic voice substitution.</p>
    <p className="voice-preview-status" role="status">{working?"Working…":status}</p>
  </div>;
}
