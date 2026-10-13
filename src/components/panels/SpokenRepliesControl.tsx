import {Mic,Volume2,VolumeX} from 'lucide-react';
import type {VoiceSnapshot} from '../../services/realtimeVoice';
import './olympusSignal.css';

/**
 * The discreet voice controls beneath the signal. Spoken replies (output) is the
 * only switch here; the microphone keeps its own button in the console and only
 * shows a status mark here while it is on, so the two are never one control.
 */
export function SpokenRepliesControl({enabled=false,voice,onToggle,ready=false}:{enabled?:boolean;voice?:VoiceSnapshot;onToggle?:()=>void;ready?:boolean}) {
  const micOn=!!voice?.microphoneOn;
  const capturing=micOn&&!!voice?.microphoneCapturing;
  return <div className="olympus-voice-controls" data-active={enabled}>
    {micOn&&<span className="olympus-voice-controls__mic" data-live={capturing||undefined} role="img" aria-label={capturing?'Microphone on':'Microphone paused'}
      title={capturing?'Microphone on. Olympus is listening; stop it with the console microphone.':'Microphone paused while Olympus speaks.'}>
      <Mic size={13} aria-hidden="true"/>
    </span>}
    <button type="button" className="olympus-voice-toggle" role="switch" aria-checked={enabled} aria-label="Spoken replies" disabled={!ready||!onToggle} onClick={onToggle}
      title={enabled?'Spoken replies on: Olympus reads its answers aloud. The microphone is separate.':'Spoken replies off: select to have Olympus read its answers aloud. The microphone stays off.'}>
      {enabled?<Volume2 size={13} aria-hidden="true"/>:<VolumeX size={13} aria-hidden="true"/>}
      <span className="olympus-voice-toggle__track" aria-hidden="true"><span/></span>
    </button>
  </div>;
}
