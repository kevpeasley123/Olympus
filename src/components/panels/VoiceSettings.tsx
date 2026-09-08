import { useEffect, useState, useSyncExternalStore } from "react";
import { CURATED_VOICES, OLYMPUS_VOICES, VOICE_PREVIEW_PHRASE, type VoicePreferences } from "../../services/voicePreferences";
import { realtimeVoice, voicePreview } from "../../services/realtimeVoice";

export function VoiceSettings({preferences,onChange,ready=true}:{preferences:VoicePreferences;onChange:(patch:Partial<VoicePreferences>)=>void;ready?:boolean}) {
  const [advanced,setAdvanced]=useState(false);
  const [previewing,setPreviewing]=useState<string|null>(null);
  const preview=useSyncExternalStore(voicePreview.subscribe,voicePreview.getSnapshot,voicePreview.getSnapshot);
  useEffect(()=>()=>voicePreview.stop(),[]);
  const busy=preview.active||preview.connecting;
  const voices=advanced ? OLYMPUS_VOICES : [...new Set([...CURATED_VOICES,preferences.selectedVoice])];
  function change(patch:Partial<VoicePreferences>){voicePreview.stop();onChange(patch);}
  function play(voice:string){
    realtimeVoice.stop();setPreviewing(voice);
    void voicePreview.startPreview({...preferences,selectedVoice:voice});
  }
  return <fieldset className="voice-settings" disabled={!ready}>
    <legend>VOICE</legend>
    <label className="voice-setting-row">Olympus Voice
      <select aria-label="Olympus Voice" value={preferences.selectedVoice} onChange={event=>change({selectedVoice:event.target.value})}>
        {voices.map(voice=><option key={voice} value={voice}>{voice[0].toUpperCase()+voice.slice(1)}</option>)}
      </select>
    </label>
    <div className="voice-settings-actions">
      <button type="button" className="ghost-action" onClick={()=>play(preferences.selectedVoice)} disabled={busy}>Preview</button>
      {busy && <button type="button" className="ghost-action" onClick={()=>voicePreview.stop()}>Stop preview</button>}
      <button type="button" className="ghost-action" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}>{advanced ? "Fewer voices" : "All voices"}</button>
    </div>
    {advanced && <div className="voice-catalog">{OLYMPUS_VOICES.map(voice=><div key={voice}>
      <button type="button" className="ghost-action" aria-pressed={preferences.selectedVoice===voice} onClick={()=>change({selectedVoice:voice})}>{voice[0].toUpperCase()+voice.slice(1)}</button>
      <button type="button" className="ghost-action" aria-label={`Preview ${voice}`} disabled={busy} onClick={()=>play(voice)}>Preview</button>
    </div>)}</div>}
    <p className="voice-settings-hint">Previews use API audio, pause the microphone, and stay out of chat. Resume conversation with the microphone button.</p>
    <details className="voice-preview-sample"><summary>Preview phrase</summary><p>{VOICE_PREVIEW_PHRASE}</p></details>
    <p className="voice-preview-status" role="status">{preview.error || (busy ? `${preview.connecting ? "Connecting" : "Previewing"} ${previewing}…` : "")}</p>
    <label className="voice-setting-row">Speaking Style<select aria-label="Speaking Style" value={preferences.speechStyle} onChange={event=>change({speechStyle:event.target.value as VoicePreferences["speechStyle"]})}>
      <option value="measured">Measured</option><option value="conversational">Conversational</option><option value="concise">Concise</option>
    </select></label>
    <label className="voice-setting-row">Response Depth<select aria-label="Response Depth" value={preferences.responseDepth} onChange={event=>change({responseDepth:event.target.value as VoicePreferences["responseDepth"]})}>
      <option value="brief">Brief</option><option value="standard">Standard</option><option value="detailed">Detailed</option>
    </select></label>
    {([["autoSpeak","Auto Speak"],["captionsEnabled","Live Captions"],["bargeInEnabled","Allow Interruption"]] as const).map(([key,label])=><label key={key} className="voice-setting-row">{label}<input type="checkbox" checked={preferences[key]} onChange={event=>change({[key]:event.target.checked})}/></label>)}
    <p className="voice-settings-hint">Auto Speak controls replies during voice conversations. Live Captions controls in-progress recognition; saved messages always remain readable. With interruption off, microphone input pauses during Olympus playback. Manual Interrupt remains available.</p>
  </fieldset>;
}
