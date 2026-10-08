import {useId} from 'react';
import { CircleDot, Hammer, Grape, Zap, Scale } from 'lucide-react';

/** Stable visual identity follows the runtime ID from roster to loadout. */
export function AgentEmblem({id,size=24}:{id:string;size?:number}) {
 const goldId='agent-gold-'+useId().replace(/:/g,'');
 const gold='url(#'+goldId+')';
 const Icon=id==='olympus'?Zap:id==='coding-delegate'?Hammer:id==='dionysus'?Grape:id==='verification'?Scale:CircleDot;
 return <span className="agent-emblem-mark" data-agent-emblem={id} aria-hidden="true"><svg width="0" height="0" style={{position:'absolute'}}><defs><linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b551d"/><stop offset=".24" stopColor="#e9b85c"/><stop offset=".42" stopColor="#fff3c9"/><stop offset=".51" stopColor="#b77c2f"/><stop offset=".76" stopColor="#ffe4a0"/><stop offset="1" stopColor="#9d6326"/></linearGradient></defs></svg>{id==='research'?<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{stroke:gold}} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l2 4a8 8 0 0 1 12 0l2-4v10c0 5-5 8-8 9-3-1-8-4-8-9Z"/><circle cx="8" cy="11" r="3"/><circle cx="16" cy="11" r="3"/><path d="m10 15 2 3 2-3M8 10v2m8-2v2"/></svg>:<Icon size={size} strokeWidth={1.5} style={{stroke:gold}}/>}</span>;
}
