import {useEffect,useRef,useState, type CSSProperties} from "react";
import {BookOpen,Compass,Layers,Mountain,Orbit,Sparkles} from "lucide-react";
import type {ProjectCommandState} from "../../services/projectCommandBoard";
const icons=[Mountain,BookOpen,Compass,Layers,Sparkles,Orbit];
const starPoints=Array.from({length:180},(_,i)=>({x:((i*73.73+11)%100),y:((i*i*17.37+7)%100),r:i%13===0?.19:i%4===0?.105:.045}));
function CelestialField(){return <svg className="ecosystem-starfield" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
 <g className="ecosystem-constellations">{[[[5,25],[13,18],[20,22],[26,13],[32,19]],[[64,12],[72,18],[79,13],[87,24],[94,20]],[[8,66],[17,60],[24,69],[19,81]],[[70,77],[79,68],[88,75],[94,63]]].map((points,i)=><g key={i}><polyline points={points.map(p=>p.join(',')).join(' ')}/>{points.map(([x,y],j)=><g key={j}><circle cx={x} cy={y} r=".22"/><path d={`M${x-.5} ${y}h1 M${x} ${y-.65}v1.3`}/></g>)}</g>)}</g>
 <g>{starPoints.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={p.r} className={i%13===0?"is-bright":""} style={{animationDelay:`${-i*.23}s`}}/>)}</g>
 <g className="ecosystem-orbits"><ellipse cx="50" cy="50" rx="44" ry="27" transform="rotate(-18 50 50)"/><ellipse cx="50" cy="50" rx="37" ry="42" transform="rotate(32 50 50)"/></g>
 </svg>}
function identity(id:string){return [...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)}
export function projectColor(id:string){return [38,202,154,269,185,18][identity(id)%6]}
export function ProjectEmblem({id}:{id:string}){const Icon=icons[identity(id)%icons.length];return <span className="project-emblem" aria-hidden="true"><Icon size={23} strokeWidth={1.4}/></span>}
/** Node area encodes bounded vault-task workload; unknown is distinct from zero. */
export function ProjectEcosystem({rows,onOpen}:{rows:ProjectCommandState[];onOpen:(id:string)=>void}){
 const [paused,setPaused]=useState(false),[page,setPage]=useState(0),[inView,setInView]=useState(true),[documentVisible,setDocumentVisible]=useState(!document.hidden);
 const root=useRef<HTMLDivElement>(null);
 const pages=Math.max(1,Math.ceil(rows.length/8)),current=Math.min(page,pages-1),visible=rows.slice(current*8,current*8+8);
 useEffect(()=>{const node=root.current;if(!node)return;const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting));observer.observe(node);return()=>observer.disconnect()},[]);
 useEffect(()=>{const listener=()=>setDocumentVisible(!document.hidden);document.addEventListener("visibilitychange",listener);return()=>document.removeEventListener("visibilitychange",listener)},[]);
 const points=visible.map((row,i)=>{const a=-Math.PI/2+i*2*Math.PI/visible.length;return {row,x:50+36*Math.cos(a),y:50+36*Math.sin(a)}});
 return <div className={`project-ecosystem ${paused||!inView||!documentVisible?"is-paused":""}`} ref={root} aria-label="Project ecosystem">
  <div className="ecosystem-toolbar"><span title="Area uses open vault task counts, capped at 25 for readability. It does not estimate total project size.">Size · open vault tasks</span><button aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?"Resume motion":"Pause motion"}</button></div>
  <div className="ecosystem-canvas">
   <CelestialField/>
   <svg className="ecosystem-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="50" rx="36" ry="36"/>{points.map(({row,x,y})=><path key={row.project.id} d={`M50 50 Q${50+(x-50)*.25-7} ${y} ${x} ${y}`} />)}</svg>
   <div className="ecosystem-center"><i className="ecosystem-surface" aria-hidden="true"/><span>Ω</span><strong>OLYMPUS</strong><small>Your project ecosystem</small></div>
   {points.map(({row,x,y},i)=><button key={row.project.id} className={`ecosystem-node ${row.openTaskCount===null?"is-unmeasured":""}`} style={{left:`${x}%`,top:`${y}%`,"--project-hue":projectColor(row.project.id),"--planet-size":`${Math.sqrt(6400+Math.min(25,row.openTaskCount??0)*320)}px`,"--drift-delay":`${-i*1.7}s`} as CSSProperties} onClick={()=>onOpen(row.project.id)} aria-label={`Open ${row.project.name}, ${row.openTaskCount===null?"task count unknown":`${row.openTaskCount} open vault tasks`}`}>
    <span className="ecosystem-planet"><i className="ecosystem-surface" aria-hidden="true"/><ProjectEmblem id={row.project.id}/></span><strong>{row.project.name}</strong><small>{row.openTaskCount===null?"Unmeasured":`${row.openTaskCount} open tasks`}</small>
   </button>)}
  </div>
  {!rows.length&&<p className="ecosystem-empty">No projects match this view.</p>}
  {pages>1&&<nav className="ecosystem-pages" aria-label="Ecosystem pages"><button disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span>{current+1} / {pages} · {rows.length} projects</span><button disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next</button></nav>}
 </div>
}
