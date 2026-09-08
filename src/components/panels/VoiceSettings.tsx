import { useEffect, useState, useSyncExternalStore } from "react";
import { CURATED_VOICES, OLYMPUS_VOICES, VOICE_PREVIEW_PHRASE, type VoicePreferences } from "../../services/voicePreferences";
import { realtimeVoice, voicePreview } from "../../services/realtimeVoice";

export function VoiceSettings({preferences,onChange,ready=true}:{preferences:VoicePreferences;onChange:(patch:Partial<VoicePreferences>)=>void;ready?:boolean}) {
  const [previewing,setPreviewing]=useState<string|null>(null);
  const preview=useSyncExternalStore(voicePreview.subscribe,voicePreview.getSnapshot,voicePreview.getSnapshot);
  useEffect(()=>{
    const release=voicePreview.subscribe(()=>{const state=voicePreview.getSnapshot();realtimeVoice.setAuditionPaused(state.active||state.connecting);});
    return ()=>{voicePreview.stop();release();realtimeVoice.setAuditionPaused(false);};
  },[]);
  const busy=preview.active||preview.connecting;
  function change(patch:Partial<VoicePreferences>){voicePreview.stop();onChange(patch);}
  function play(voice:string){
    setPreviewing(voice);
    void voicePreview.startPreview({...preferences,selectedVoice:voice});
  }
  return <fieldset className="voice-settings" disabled={!ready}>
    <legend>VOICE</legend>
    <h3 className="voice-lab-title">VOICE LAB</h3>
    <div className="voice-catalog">{OLYMPUS_VOICES.map(voice=><div key={voice} data-selected={preferences.selectedVoice===voice}>
      <div className="voice-lab-identity"><strong>{voice.toUpperCase()}</strong>
        {CURATED_VOICES.includes(voice) && <small>OpenAI recommended</small>}
        {preferences.selectedVoice===voice && <span>Selected</span>}
      </div>
      <button type="button" className="ghost-action" aria-label={`Preview ${voice}`} onClick={()=>play(voice)}>Preview</button>
      <button type="button" className="ghost-action" aria-label={`Use ${voice} as Olympus voice`} disabled={preferences.selectedVoice===voice} onClick={()=>change({selectedVoice:voice})}>Use as Olympus voice</button>
    </div>)}</div>
    {busy && <button type="button" className="ghost-action" onClick={()=>voicePreview.stop()}>Stop preview</button>}
    <p className="voice-settings-hint">Isolated API audio audition. The live microphone pauses during previews and resumes afterward. The sample counts are fictional, not a project status report.</p>
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
