import {useEffect,useState,useSyncExternalStore} from 'react';
import {VoiceLab,validLabText} from '../../services/voiceLab';
import {realtimeVoice,voicePreview} from '../../services/realtimeVoice';
export function ElevenVoiceLab({voiceId,modelId,enabled}:{voiceId:string;modelId:string;enabled:boolean}){
  const [lab]=useState(()=>new VoiceLab());const state=useSyncExternalStore(lab.subscribe,lab.getSnapshot,lab.getSnapshot);
  const [text,setText]=useState('Olympus, tell me something useful.');
  useEffect(()=>()=>lab.dispose(),[lab]);
  useEffect(()=>{lab.dispose();},[lab,voiceId,modelId,enabled]);
  const busy=state.phase==='generating'||state.phase==='playing';
  function silence(){voicePreview.stop();realtimeVoice.stop();}
  return <details className="voice-lab eleven-lab" open>
    <summary>Voice Lab · short speech tests</summary>
    <p className="voice-settings-hint">ElevenLabs only · microphone off · no OpenAI key needed.</p>
    <label>Test script<textarea aria-label="Voice Lab test script" value={text} maxLength={200} rows={2} onChange={event=>{lab.dispose();setText(event.target.value);}}/></label>
    <small>{text.trim()?text.trim().split(/\s+/u).length:0}/5 words · {Array.from(text).length}/200 characters</small>
    <p className="voice-settings-hint">Voice: {voiceId}<br/>Model: {modelId}</p>
    <div className="eleven-voice-actions">
      <button type="button" className="ghost-action" disabled={!enabled||busy||!validLabText(text)} onClick={()=>{silence();void lab.generate({text,voiceId,modelId});}}>Generate</button>
      <button type="button" className="ghost-action" disabled={!busy} onClick={()=>lab.stop()}>Stop</button>
      <button type="button" className="ghost-action" disabled={!enabled||busy||!state.canReplay} onClick={()=>{silence();void lab.replay();}}>Replay</button>
    </div>
    <p className="voice-settings-hint">Generate uses credits. Replay reuses this audio at no additional generation cost. Stop may not prevent a provider charge. Starting a test ends any live microphone conversation.</p>
    <p role="status" className="voice-preview-status">{state.error??(state.phase==='generating'?'Generating…':state.phase==='playing'?'Playing · microphone off':state.generationMs!==null?`Ready · generated in ${(state.generationMs/1000).toFixed(2)}s`:'Ready for a short test.')}</p>
  </details>;
}
