import {useEffect,useState} from 'react';
import {nativeVoiceCommand} from '../../services/elevenSpeech';
import {isTauriRuntime} from '../../services/launcher';
import './VoiceUsage.css';
type Usage={credits:number;confirmed:number;unconfirmed:number;notSubmitted:number;transcriptionRequests:number;transcriptionTokens:number;transcriptionUnconfirmed:number;openaiSpeechRequests:number};
export function VoiceUsage({expanded=false}:{expanded?:boolean}){
  const native=isTauriRuntime();const [usage,setUsage]=useState<Usage|null>(null);const [error,setError]=useState(false);
  const [rate,setRate]=useState(()=>{try{return localStorage.getItem('olympus.voice.creditRate')??'';}catch{return '';}});
  useEffect(()=>{
    if(!native)return;let alive=true;let pending=false;
    async function refresh(){if(pending)return;pending=true;try{const next=await nativeVoiceCommand<Usage>('voice_usage');if(alive){setUsage(next);setError(false);}}catch{if(alive)setError(true);}finally{pending=false;}}
    void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},3000);
    return()=>{alive=false;clearInterval(timer);};
  },[native]);
  const numericRate=rate.trim()===''?null:Number(rate);const validRate=numericRate!==null&&Number.isFinite(numericRate)&&numericRate>=0;
  const partial=!!usage&&(usage.unconfirmed>0||usage.transcriptionRequests>0||usage.openaiSpeechRequests>0);
  const label=!native?'Voice usage · desktop only':error?'Voice usage · unavailable':!usage?'Voice usage · loading…':`Voice session · ${usage.credits.toLocaleString(undefined,{maximumFractionDigits:2})} credits${partial?' + unconfirmed':''}`;
  return <details className="voice-usage" open={expanded||undefined}>
    <summary>{label}</summary>
    <div className="voice-usage__details">
      <strong>Voice usage · this app run</strong>
      <p>Includes previews and spoken replies from this app process. Resets when the app restarts; request history remains saved. Reasoning costs are separate.</p>
      {usage&&!error&&<>
        <p>ElevenLabs: {usage.credits.toLocaleString()} confirmed credits · {usage.confirmed} requests.<br/>{usage.unconfirmed} charges unconfirmed · {usage.notSubmitted} not submitted.</p>
        <p>OpenAI microphone transcription: {usage.transcriptionRequests} requests · {usage.transcriptionTokens.toLocaleString()} reported tokens · {usage.transcriptionUnconfirmed} usage unconfirmed. Cost unconfirmed.</p>
        {usage.openaiSpeechRequests>0&&<p>OpenAI speech: {usage.openaiSpeechRequests} requests · cost unconfirmed.</p>}
      </>}
      <label>Optional plan rate · USD per 1,000 credits<input aria-label="USD per 1000 voice credits" type="number" min="0" step="0.01" placeholder="Not configured" value={rate} onChange={event=>{setRate(event.target.value);try{localStorage.setItem('olympus.voice.creditRate',event.target.value);}catch{/* Optional display preference only. */}}}/></label>
      <p>{usage&&!error&&validRate?`Estimated ElevenLabs value: $${(usage.credits*numericRate!/1000).toFixed(4)} for confirmed credits only.`:'Dollar estimate unavailable until a plan rate is entered.'} This is not an invoice or a full voice-session total. Unconfirmed usage is never treated as free.</p>
    </div>
  </details>;
}
