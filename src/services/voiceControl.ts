import type {VoiceSnapshot} from './realtimeVoice';
export function voiceControlState(voice:Pick<VoiceSnapshot,'active'|'connecting'|'microphoneOn'|'microphoneCapturing'|'phase'|'muted'|'error'>){
  const on=voice.microphoneOn&&(voice.active||voice.connecting);
  const capturing=on&&voice.active&&voice.microphoneCapturing===true;
  const mic=capturing?'Mic on':on&&voice.active?'Mic paused':'Mic off';
  const label=voice.connecting&&on?'Connecting…':voice.phase==='ERROR'?`Voice unavailable · ${mic}`:voice.phase==='SPEAKING'?`${voice.muted?'Output muted':'Speaking'} · ${mic}`:voice.phase==='PROCESSING'&&voice.active?`Thinking · ${mic}`:capturing?'Listening · Mic on':on?`Voice on · ${mic}`:'Voice off';
  return {on,capturing,label,tone:voice.phase==='ERROR'?'error':voice.connecting&&on?'connecting':capturing?'live':'off'};
}
