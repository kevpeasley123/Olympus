import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { realtimeVoice } from "../../services/realtimeVoice";

/**
 * Audition the local Kokoro voices. A preview is synthesized on this PC, like any
 * local reply; nothing is sent anywhere. The microphone pauses while one plays.
 */
export function LocalVoiceLab({selected,groups,name,phrase,onUse}:{selected:string;groups:{label:string;voices:string[]}[];name:(voice:string)=>string;phrase:string;onUse:(voice:string)=>void}) {
  const [playing,setPlaying]=useState<string|null>(null);
  const [status,setStatus]=useState("");
  const token=useRef(0), audio=useRef<HTMLAudioElement|null>(null), url=useRef<string|null>(null);
  function stop() {
    token.current++;
    audio.current?.pause(); audio.current=null;
    if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
    void invoke("cancel_local_speech").catch(()=>{});
    realtimeVoice.setAuditionPaused(false);
    setPlaying(null);
  }
  useEffect(()=>stop,[]);
  async function preview(voice:string) {
    stop();
    const mine=++token.current;
    setPlaying(voice); setStatus(`Preparing ${name(voice)}…`);
    realtimeVoice.setAuditionPaused(true);
    try {
      const wav=await invoke<string>("local_speech",{kind:"speak",value:phrase,voice});
      if(mine!==token.current)return;
      url.current=URL.createObjectURL(new Blob([Uint8Array.from(atob(wav),c=>c.charCodeAt(0))],{type:"audio/wav"}));
      const clip=new Audio(url.current); audio.current=clip;
      clip.onended=()=>{if(mine===token.current){stop();setStatus("");}};
      clip.onerror=()=>{if(mine===token.current){stop();setStatus("That preview could not play.");}};
      setStatus(`Playing ${name(voice)}`);
      await clip.play();
    } catch(error) {
      if(mine===token.current){stop();setStatus(String(error));}
    }
  }
  return <details className="voice-lab" open><summary className="voice-lab-title">Voice lab · preview and choose a voice</summary>
    {groups.map(group=><section key={group.label} aria-label={group.label}>
      <h4 className="voice-lab-group">{group.label}</h4>
      <div className="voice-catalog">{group.voices.map(voice=><div key={voice} data-selected={selected===voice}>
        <div className="voice-lab-identity"><strong>{name(voice).toUpperCase()}</strong>{selected===voice&&<span>Selected</span>}</div>
        <button type="button" className="ghost-action" aria-label={`Preview ${name(voice)}`} onClick={()=>playing===voice?stop():void preview(voice)}>{playing===voice?"Stop":"Preview"}</button>
        <button type="button" className="ghost-action" aria-label={`Use ${name(voice)} as Olympus voice`} disabled={selected===voice} onClick={()=>{stop();onUse(voice);}}>Use as Olympus voice</button>
      </div>)}</div>
    </section>)}
    <p className="voice-preview-status" role="status">{status}</p>
    <p className="voice-settings-hint">Each preview is spoken on this PC by Kokoro and takes a few seconds to prepare. The microphone pauses while one plays.</p>
  </details>;
}
