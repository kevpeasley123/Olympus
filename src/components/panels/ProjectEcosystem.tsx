import {useEffect,useRef,useState, type CSSProperties} from "react";
import {BookOpen,Mountain,GraduationCap,Blocks,Network,HeartPulse,Apple,Bot,Folder,Camera,Monitor,Settings} from "lucide-react";
import type {ProjectCommandState} from "../../services/projectCommandBoard";
/** Names describe the subject; opaque IDs must not randomly choose a symbol. */
export function projectIdentity(id:string,name="") {
 const subject=(name||id).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/pokedex|pokemon/.test(subject))return {symbol:"pokeball",hue:355,Icon:Folder};
 if(/olympus/.test(subject))return {symbol:"mountain",hue:13,Icon:Mountain};
 if(/learning|course|education/.test(subject))return {symbol:"graduation",hue:207,Icon:GraduationCap};
 if(/scaffold/.test(subject))return {symbol:"blocks",hue:184,Icon:Blocks};
 if(/obsidian|knowledge.*graph/.test(subject))return {symbol:"network",hue:273,Icon:Network};
 if(/health|fitness/.test(subject))return {symbol:"heartbeat",hue:151,Icon:HeartPulse};
 if(/fruit/.test(subject))return {symbol:"apple",hue:87,Icon:Apple};
 if(/fidelity|agentic|agent/.test(subject))return {symbol:"agent",hue:35,Icon:Bot};
 if(/research|library|book/.test(subject))return {symbol:"book",hue:149,Icon:BookOpen};
 if(/studio|photo|camera/.test(subject))return {symbol:"camera",hue:276,Icon:Camera};
 if(/website|web site|portfolio/.test(subject))return {symbol:"monitor",hue:187,Icon:Monitor};
 if(/automation|toolkit/.test(subject))return {symbol:"settings",hue:32,Icon:Settings};
 return {symbol:"folder",hue:210,Icon:Folder};
}
const starPoints=Array.from({length:260},(_,i)=>({x:((i*73.73+11)%100),y:((i*i*17.37+7)%100),r:i%13===0?.19:i%4===0?.105:.045}));
const constellations=[[[5,25],[13,18],[20,22],[26,13],[32,19]],[[64,12],[72,18],[79,13],[87,24],[94,20]],[[8,66],[17,60],[24,69],[19,81]],[[70,77],[79,68],[88,75],[94,63]]];
function CelestialField(){return <><div className="ecosystem-star-points" aria-hidden="true">{starPoints.map((p,i)=><i key={i} className={i%13===0?"is-bright":""} style={{left:`${p.x}%`,top:`${p.y}%`,width:i%13===0?3:i%4===0?1.5:1,height:i%13===0?3:i%4===0?1.5:1,animationDelay:`${-i*.23}s`}}/>)}{constellations.flat().map(([x,y],i)=><b key={`beacon-${i}`} className="ecosystem-beacon" style={{left:`${x}%`,top:`${y}%`}}/>)}</div><svg className="ecosystem-starfield" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
 <g className="ecosystem-constellations">{constellations.map((points,i)=><polyline key={i} points={points.map(p=>p.join(',')).join(' ')}/>)}</g>
 </svg></>}
export function projectColor(id:string,name=""){return projectIdentity(id,name).hue}
export function ProjectEmblem({id,name}:{id:string;name?:string}){
 const {symbol,Icon}=projectIdentity(id,name);
 return <span className="project-emblem" data-project-symbol={symbol} aria-hidden="true">{symbol==="pokeball"?
 <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12a9 9 0 0 1 18 0Z" fill="currentColor" fillOpacity=".3"/><circle cx="12" cy="12" r="9"/><path d="M3 12h5.5m7 0H21"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>:<Icon size={23} strokeWidth={1.6}/>}</span>
}
/** Node area encodes bounded vault-task workload; unknown is distinct from zero. */
export function ProjectEcosystem({rows,onOpen,onHighlight}:{rows:ProjectCommandState[];onOpen:(id:string)=>void;onHighlight?:(id:string|null)=>void}){
 const [page,setPage]=useState(0),[inView,setInView]=useState(true),[documentVisible,setDocumentVisible]=useState(!document.hidden);
 const [hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const root=useRef<HTMLDivElement>(null);
 const olympus=rows.find(row=>/^(project\s+)?olympus$/i.test(row.project.name.trim()));
 const satellites=rows.filter(row=>row!==olympus);
 const pages=Math.max(1,Math.ceil(satellites.length/8)),current=Math.min(page,pages-1),visible=satellites.slice(current*8,current*8+8);
 const activeId=[hovered,focused].find(id=>id&&(olympus?.project.id===id||visible.some(row=>row.project.id===id)))??null;
 useEffect(()=>{onHighlight?.(activeId)},[activeId,onHighlight]);
 useEffect(()=>()=>onHighlight?.(null),[onHighlight]);
 const inspect=(id:string)=>({onPointerEnter:()=>setHovered(id),onPointerLeave:()=>setHovered(null),onPointerCancel:()=>setHovered(null),onFocus:()=>setFocused(id),onBlur:()=>setFocused(null)});
 const centerContent=<><i className="ecosystem-surface" aria-hidden="true"/><span aria-hidden="true">Ω</span><strong>OLYMPUS</strong></>;
 useEffect(()=>{const node=root.current;if(!node)return;const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting));observer.observe(node);return()=>observer.disconnect()},[]);
 useEffect(()=>{const listener=()=>setDocumentVisible(!document.hidden);document.addEventListener("visibilitychange",listener);return()=>document.removeEventListener("visibilitychange",listener)},[]);
 // Art-directed positions leave a clear central valley and room for side labels.
 const layout=visible.length>6
  ? [[23,14],[63,12],[10,39],[73,38],[17,67],[64,66],[28,91],[74,90]]
  : visible.length<=4 ? [[24,22],[67,18],[20,80],[71,77]]
  : [[26,18],[65,16],[13,49],[74,46],[31,84],[65,82]];
 const points=visible.map((row,i)=>({row,x:layout[i][0],y:layout[i][1]}));
 return <div className={`project-ecosystem ${visible.length>6?"is-dense":""} ${!inView||!documentVisible?"is-paused":""}`} ref={root} aria-label="Project ecosystem">
  <div className="ecosystem-canvas">
   <CelestialField/>
   <svg className="ecosystem-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{points.map(({row,x,y},i)=>{
    const d=`M47 50 C${47+(x-47)*.42} ${50+(y-50)*.12} ${x+(x<47?8:-8)} ${y+(y<50?-8:8)} ${x} ${y}`;
    return <g key={row.project.id}><path className="ecosystem-link-base" d={d}/><path className="ecosystem-link-signal" d={d} pathLength="100" style={{animationDelay:`${-i*1.1}s`,animationDuration:`${5+i*.31}s`}}/></g>
   })}</svg>
   {olympus ? <button {...inspect(olympus.project.id)} type="button" className={`ecosystem-center ${olympus.openTaskCount===null?"is-unmeasured":""}`} onClick={()=>onOpen(olympus.project.id)} aria-label={`Open Olympus project, ${olympus.openTaskCount===null?"task count unknown":`${olympus.openTaskCount} open vault tasks`}`} title="Open Olympus project">{centerContent}</button> : <div className="ecosystem-center" aria-label="Olympus ecosystem hub">{centerContent}</div>}
   {points.map(({row,x,y},i)=><button {...inspect(row.project.id)} key={row.project.id} className={`ecosystem-node ${row.openTaskCount===null?"is-unmeasured":""}`} style={{left:`${x}%`,top:`${y}%`,"--project-hue":projectColor(row.project.id,row.project.name),"--planet-size":`${Math.sqrt(4096+Math.min(25,row.openTaskCount??0)*220)}px`,"--drift-delay":`${-i*1.7}s`} as CSSProperties} onClick={()=>onOpen(row.project.id)} aria-label={`Open ${row.project.name}, ${row.openTaskCount===null?"task count unknown":`${row.openTaskCount} open vault tasks`}`}>
    <span className="ecosystem-planet"><i className="ecosystem-surface" aria-hidden="true"/><ProjectEmblem id={row.project.id} name={row.project.name}/></span><span className="ecosystem-node-label"><strong>{row.project.name}</strong><small>{row.openTaskCount===null?"Unmeasured":`${row.openTaskCount} open tasks`}</small></span>
   </button>)}
  </div>
  {!rows.length&&<p className="ecosystem-empty">No projects match this view.</p>}
  {pages>1&&<nav className="ecosystem-pages" aria-label="Ecosystem pages"><button disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span>{current+1} / {pages} · {rows.length} projects</span><button disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next</button></nav>}
 </div>
}