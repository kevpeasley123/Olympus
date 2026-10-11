import {VoiceUsage} from './VoiceUsage';
import {Mic,MicOff} from 'lucide-react';
import type {VoiceSnapshot} from '../../services/realtimeVoice';
import {voiceControlState} from '../../services/voiceControl';
import './voiceConversationControl.css';
export function VoiceConversationControl({voice,onToggle,ready=false}:{voice?:VoiceSnapshot;onToggle?:()=>void;ready?:boolean}){
  const state=voiceControlState(voice??{phase:'IDLE',active:false,connecting:false,microphoneOn:false,microphoneCapturing:false,muted:false,error:null});
  const energy=voice&&((state.capturing&&voice.phase!=='SPEAKING')||(voice.phase==='SPEAKING'&&!voice.muted))?voice.level:0;
  return <div className="pantheon-voice voice-conversation" data-active={state.on||voice?.phase==='SPEAKING'} data-tone={state.tone}>
    <button type="button" className="voice-conversation__toggle" role="switch" aria-checked={state.on} aria-label="Voice conversation" aria-describedby="voice-conversation-status" disabled={!ready||!onToggle} onClick={onToggle} title={state.on?'End voice conversation and release microphone · Ctrl+Shift+M':'Start voice conversation with spoken replies · Ctrl+Shift+M'}>
      {state.capturing?<Mic size={16} aria-hidden="true"/>:<MicOff size={16} aria-hidden="true"/>}
      <span id="voice-conversation-status" role="status">{state.label}</span>
      <span className="voice-conversation__switch" aria-hidden="true"><span/></span>
    </button>
    <div className="pantheon-voice__wave" aria-hidden="true">{Array.from({length:23},(_,i)=><span key={i} style={{height:2+Math.min(1,Math.max(0,energy))*26*Math.pow(Math.sin((i+1)*Math.PI/24),.7)}}/>)}</div>
    <VoiceUsage/>
  </div>;
}
