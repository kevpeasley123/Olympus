import React from "react";
import {createRoot} from "react-dom/client";
import {useAmbientMotion} from "./hooks/useAmbientMotion";
let visibility = "visible", reduced = false;
const listeners = new Set<() => void>();
Object.defineProperty(document, "visibilityState", {configurable:true,get:()=>visibility});
window.matchMedia = (() => ({get matches(){return reduced},addEventListener:(_:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_:string,fn:()=>void)=>listeners.delete(fn)})) as any;
let snapshot:any;
function Probe(){snapshot=useAmbientMotion("idle");return <span>{snapshot.running ? "running" : "paused"}</span>}
const root=createRoot(document.getElementById("probe")!);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const assert=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)};
try {
 root.render(<Probe/>);await wait(2800);
 assert(snapshot.running && snapshot.events.tracer>0,"visible page never started its tracer");
 visibility="hidden";document.dispatchEvent(new Event("visibilitychange"));await wait(100);
 assert(!snapshot.running,"hidden page is running");await wait(3000);
 assert(Object.values(snapshot.events).every(v=>v===0),"hidden page fired events");
 visibility="visible";document.dispatchEvent(new Event("visibilitychange"));await wait(2600);
 assert(snapshot.running && snapshot.events.tracer>0,"visible page did not resume");
 reduced=true;listeners.forEach(fn=>fn());await wait(100);
 assert(!snapshot.running,"live reduced-motion change was ignored");await wait(3000);
 assert(Object.values(snapshot.events).every(v=>v===0),"reduced-motion page fired events");
 reduced=false;listeners.forEach(fn=>fn());await wait(100);assert(snapshot.running,"motion preference did not resume");
 root.unmount();await wait(100);assert(listeners.size===0,"media listener leaked on unmount");
 document.getElementById("result")!.textContent="PASS: visible events, hidden timer cancellation, resume, live reduced-motion changes, reduced event suppression, and listener cleanup.";
} catch(e) {document.getElementById("result")!.textContent="FAIL: "+String(e);}
