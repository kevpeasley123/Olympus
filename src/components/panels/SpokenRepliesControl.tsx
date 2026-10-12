import {Volume2,VolumeX} from 'lucide-react';
import {VoiceUsage} from './VoiceUsage';
import type {VoiceSnapshot} from '../../services/realtimeVoice';
import './voiceConversationControl.css';

export function SpokenRepliesControl({enabled=false,voice,onToggle,ready=false}:{enabled?:boolean;voice?:VoiceSnapshot;onToggle?:()=>void;ready?:boolean}) {
  const speaking=enabled&&voice?.phase==='SPEAKING'&&!voice.muted;
  const failed=enabled&&voice?.phase==='ERROR';
  const energy=speaking?voice.level:0;
  return <div className="pantheon-voice voice-conversation" data-active={enabled} data-tone={failed?'error':speaking?'live':'idle'}>
    <button type="button" className="voice-conversation__toggle" role="switch" aria-checked={enabled} aria-label="Spoken replies" disabled={!ready||!onToggle} onClick={onToggle} title="Speak replies through ElevenLabs while you type. Microphone stays off.">
      {enabled?<Volume2 size={16} aria-hidden="true"/>:<VolumeX size={16} aria-hidden="true"/>}
      <span>Spoken replies: {enabled?'On':'Off'}</span>
      <span className="voice-conversation__switch" aria-hidden="true"><span/></span>
    </button>
    <div className="pantheon-voice__wave" aria-hidden="true">{Array.from({length:23},(_,i)=><span key={i} style={{height:2+Math.min(1,Math.max(0,energy))*26*Math.pow(Math.sin((i+1)*Math.PI/24),.7)}}/>)}</div>
    {failed&&<span role="status">Speech unavailable · see reply details</span>}
    <VoiceUsage/>
  </div>;
}
