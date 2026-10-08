import { CircleDot, Code2, Search, ShieldCheck } from 'lucide-react';

/** Stable visual identity follows an agent from the roster into its loadout. */
export function AgentEmblem({id,size=24}:{id:string;size?:number}) {
  const Icon=id==='research'?Search:id==='verification'?ShieldCheck:id==='coding-delegate'?Code2:CircleDot;
  return <span className="agent-emblem-mark" data-agent-emblem={id} aria-hidden="true"><Icon size={size} strokeWidth={1.3}/></span>;
}
