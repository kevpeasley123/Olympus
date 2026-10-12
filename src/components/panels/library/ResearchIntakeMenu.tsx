import {useEffect,useRef,useState} from "react";
import {FilePenLine,Upload,Link,Plus} from "lucide-react";
export function ResearchIntakeMenu({onChoose,disabled}:{onChoose:(mode:"write"|"upload"|"link")=>void;disabled:boolean}) {
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[open]);
 return <div className="research-intake" ref={root} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
 <button ref={trigger} type="button" className="research-add" disabled={disabled} aria-expanded={open} aria-controls="research-intake-options" onClick={()=>setOpen(!open)}><Plus size={16}/>Add research</button>
 {open&&<div id="research-intake-options" className="research-intake-menu" aria-label="Add research options">{([
 ["write",FilePenLine,"Write or paste","A note, transcript, or excerpt"],
 ["upload",Upload,"Upload a file","Attach a file and review PDF text"],
 ["link",Link,"Save a link","Keep a source URL with your notes"]
 ] as const).map(([mode,Icon,title,description])=><button key={mode} type="button" onClick={()=>{setOpen(false);onChoose(mode);}}><Icon size={21}/><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>}
 </div>;
}
