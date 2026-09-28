import type { CommandLayout } from "./hybridCore";

type RealNode = CommandLayout["constellation"]["nodes"][number];
export interface BackdropStar { x: number; y: number; z: number; size: number; intensity: number }
export const BACKDROP_STARS = { perNode: .6, cap: 72, innerRadius: 68, outerRadius: 139, clearance: 6 };

function hash(id: string) {
  let value=2166136261;
  for(const character of id)value=Math.imul(value^character.charCodeAt(0),16777619);
  return value>>>0;
}

/** Artistic points only: no new graph nodes, links, labels, or actions.
 * Actual rendered nodes determine density and placement; crowded gaps can stay empty. */
export function layoutBackdropStars(nodes: readonly RealNode[]): BackdropStar[] {
  const budget=Math.min(BACKDROP_STARS.cap,Math.floor(nodes.length*BACKDROP_STARS.perNode));
  const anchors=[...nodes].sort((a,b)=>hash(a.id)-hash(b.id)||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,budget);
  const stars: BackdropStar[]=[];
  for(const anchor of anchors){
    let seed=hash(`backdrop/${anchor.id}`);
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let best: {x:number;y:number;score:number}|undefined;
    for(let attempt=0;attempt<32;attempt++){
      const angle=random()*Math.PI*2;
      const distance=attempt<20?12+Math.sqrt(random())*32:
        Math.sqrt(BACKDROP_STARS.innerRadius**2+random()*(BACKDROP_STARS.outerRadius**2-BACKDROP_STARS.innerRadius**2));
      const x=Math.cos(angle)*distance+(attempt<20?anchor.x-220:0);
      const y=Math.sin(angle)*distance+(attempt<20?220-anchor.y:0);
      const radius=Math.hypot(x,y);
      if(radius<BACKDROP_STARS.innerRadius||radius>BACKDROP_STARS.outerRadius)continue;
      const nodeClearance=nodes.reduce((clearance,node)=>Math.min(clearance,Math.hypot(x-(node.x-220),y-(220-node.y))-node.size),30);
      const starClearance=stars.reduce((clearance,star)=>Math.min(clearance,Math.hypot(x-star.x,y-star.y)),30);
      if(Math.min(nodeClearance,starClearance)<BACKDROP_STARS.clearance)continue;
      const score=Math.min(nodeClearance,starClearance)-Math.hypot(x-(anchor.x-220),y-(220-anchor.y))*.055;
      if(!best||score>best.score)best={x,y,score};
    }
    if(!best)continue;
    const tier=random();
    stars.push({x:best.x,y:best.y,z:-36-random()*12,size:tier<.6?1.1:tier<.9?1.7:2.5,intensity:.48+random()*.32});
  }
  return stars;
}
