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

export function LocalSpeechControl({onText,onUseLocal}:{onText:(text:string)=>void;onUseLocal?:()=>void}) {
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
  async function start(kind:"transcribe") {
    onUseLocal?.();
    const token=++generation.current; setActive(true);
    const current=()=>token===generation.current;
    const finish=(message:string)=>{if(current()){processing.current=false;release();setStatus(message);setActive(false);}};
    try {
      {
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
  useEffect(()=>{
    const open=()=>toggle.current();
    window.addEventListener("olympus:local-mic",open);
    return ()=>window.removeEventListener("olympus:local-mic",open);
  },[]);
  // The microphone button drives dictation through this component. It shows itself only
  // while listening or transcribing, so Kevin can finish or stop; otherwise nothing.
  if(!active) return null;
  return <div className="local-speech" role="group" aria-label="Local dictation">
    <span role="status">{status}</span>
    {status==="Listening locally" && <button type="button" className="ghost-action" onClick={()=>{if(recorder.current?.state==="recording")recorder.current.stop();}}>Finish</button>}
    <button type="button" className="ghost-action" onClick={()=>{generation.current++;processing.current=false;release();void invoke("cancel_local_speech").catch(()=>{});setActive(false);setStatus("Stopped");}}>Stop</button>
  </div>;
}
