import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

async function pcm16(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const data = (await offline.startRendering()).getChannelData(0);
    const bytes = new Uint8Array(data.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i=0;i<data.length;i++) view.setInt16(i*2, Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
    let raw = "";
    for (let j=0;j<bytes.length;j+=8192) raw += String.fromCharCode(...bytes.subarray(j,j+8192));
    return btoa(raw);
  } finally { await context.close(); }
}

export function LocalSpeechControl({onText,reply,onUseLocal}:{onText:(text:string)=>void;reply:string;onUseLocal?:()=>void}) {
  const [status,setStatus]=useState("Ready");
  const [active,setActive]=useState(false);
  const processing=useRef(false);
  const generation=useRef(0), player=useRef<HTMLAudioElement|null>(null);
  const clipUrl=useRef<string|null>(null);
  const recorder=useRef<MediaRecorder|null>(null), timeout=useRef<number>();
  function release() {
    window.clearTimeout(timeout.current);
    const mic=recorder.current; recorder.current=null;
    if(mic?.state==="recording") mic.stop();
    mic?.stream.getTracks().forEach(track=>track.stop());
    player.current?.pause(); player.current=null;
    if(clipUrl.current){URL.revokeObjectURL(clipUrl.current);clipUrl.current=null;}
  }
  useEffect(()=>()=>{generation.current++;release();if(processing.current)void invoke("cancel_local_speech").catch(()=>{});},[]);
  async function start(kind:"transcribe"|"speak") {
    onUseLocal?.();
    const token=++generation.current; setActive(true);
    const current=()=>token===generation.current;
    const finish=(message:string)=>{if(current()){processing.current=false;release();setStatus(message);setActive(false);}};
    try {
      if(kind==="speak") {
        setStatus("Synthesizing locally");
        processing.current=true;
        const wav=await invoke<string>("local_speech",{kind,value:reply});
        if(!current())return;
        const bytes=Uint8Array.from(atob(wav),char=>char.charCodeAt(0));
        clipUrl.current=URL.createObjectURL(new Blob([bytes],{type:"audio/wav"}));
        const audio=new Audio(clipUrl.current); player.current=audio;
        audio.onended=()=>finish("Ready");audio.onerror=()=>finish("Playback failed");
        await audio.play();if(current())setStatus("Speaking locally");
      } else {
        setStatus("Opening microphone");
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
        let mic:MediaRecorder;
        try { mic=new MediaRecorder(stream); } catch (e){stream.getTracks().forEach(t=>t.stop());throw e;}
        recorder.current=mic; const chunks:BlobPart[]=[];
        mic.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        mic.onstop=async()=>{
          stream.getTracks().forEach(t=>t.stop()); if(!current())return;
          setStatus("Transcribing locally");
          try {
            const value=await pcm16(new Blob(chunks,{type:mic.mimeType}));
            if(!current())return;
            processing.current=true;
            const text=await invoke<string>("local_speech",{kind,value});
            if(current() && text)onText(text);
            finish(text?"Transcript ready to review":"No speech detected");
          } catch(e){finish(String(e));}
        };
        mic.start(); setStatus("Listening locally");
        timeout.current=window.setTimeout(()=>{if(mic.state==="recording")mic.stop();},55_000);
      }
    } catch(e){finish(String(e));}
  }
  const toggle=useRef<()=>void>(()=>{});
  toggle.current=()=>{
    if(recorder.current?.state==="recording"){recorder.current.stop();return;}
    if(!active)void start("transcribe");
  };
  const details=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const open=()=>{if(details.current)details.current.open=true;toggle.current();};
    window.addEventListener("olympus:local-mic",open);
    return ()=>window.removeEventListener("olympus:local-mic",open);
  },[]);
  return <details ref={details} className="local-speech"><summary>Local voice</summary>
    <button type="button" disabled={active} onClick={()=>void start("transcribe")}>Dictate</button>
    {status==="Listening locally" && <button type="button" onClick={()=>{if(recorder.current?.state==="recording")recorder.current.stop();}}>Finish dictation</button>}
    <button type="button" disabled={active || !reply.trim()} onClick={()=>void start("speak")}>Speak latest reply</button>
    {active && <button type="button" onClick={()=>{generation.current++;processing.current=false;release();void invoke("cancel_local_speech").catch(()=>{});setActive(false);setStatus("Stopped");}}>Stop</button>}
    <span role="status">{status}</span>
  </details>;
}
