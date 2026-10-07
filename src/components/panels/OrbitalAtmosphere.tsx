import { useId } from "react";

// A composed, deterministic star field. It supplies the ambient instrument's
// visual depth; only the separate runtime capability layer conveys work state.
const stars = Array.from({ length: 760 }, (_, i) => {
  const a = i * 2.39996323;
  const r = 42 + Math.sqrt(((i * 317) % 761) / 761) * 163;
  return { x: 220 + Math.cos(a) * r * .91, y: 220 + Math.sin(a) * r,
    r: i % 29 === 0 ? .62 : i % 7 === 0 ? .38 : .18,
    opacity: .14 + (i % 9) * .077 };
});
const anchors = [
  [220, 78, 1], [137, 49, 1], [70, 135, 0], [303, 126, 0],
  [325, 195, 0], [352, 215, 1], [103, 183, 0], [148, 281, 1],
  [217, 323, 1], [313, 340, 0], [220, 408, 1], [95, 328, 1],
  [227, 130, 1], [165, 201, 1], [273, 231, 1], [194, 362, 0],
] as const;

export function OrbitalAtmosphere() {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return <g className="orbital-atmosphere" aria-hidden="true" pointerEvents="none">
    <defs>
      <radialGradient id={`${id}-clear-core`}><stop offset="0" stopColor="black"/><stop offset=".19" stopColor="black"/><stop offset=".29" stopColor="white"/><stop offset="1" stopColor="white"/></radialGradient>
      <mask id={`${id}-core-mask`}><rect width="440" height="440" fill={ref("clear-core")}/></mask>
      <radialGradient id={`${id}-amber`}><stop stopColor="#fff7dc"/><stop offset=".08" stopColor="#ffe5aa" stopOpacity=".95"/><stop offset=".23" stopColor="#ffbd53" stopOpacity=".5"/><stop offset=".55" stopColor="#f28a27" stopOpacity=".13"/><stop offset="1" stopColor="#ff981e" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-blue`}><stop stopColor="#fff"/><stop offset=".07" stopColor="#c1e9ff"/><stop offset=".22" stopColor="#71c3ff" stopOpacity=".48"/><stop offset=".6" stopColor="#328fe2" stopOpacity=".025"/><stop offset="1" stopColor="#217ad8" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-corona`}><stop stopColor="#ffbe5c" stopOpacity="0"/><stop offset=".40" stopColor="#ff9b2b" stopOpacity=".045"/><stop offset=".58" stopColor="#e47a26" stopOpacity=".025"/><stop offset="1" stopColor="#e47923" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-orbit`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6696c0" stopOpacity=".16"/><stop offset=".25" stopColor="#c5e7ff" stopOpacity=".65"/><stop offset=".48" stopColor="#648eac" stopOpacity=".18"/><stop offset=".7" stopColor="#f3ce8c" stopOpacity=".72"/><stop offset="1" stopColor="#86b7dd" stopOpacity=".15"/></linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a77738" stopOpacity=".16"/><stop offset=".36" stopColor="#ffe1a2" stopOpacity=".85"/><stop offset=".68" stopColor="#d68e38" stopOpacity=".3"/><stop offset="1" stopColor="#f7d295" stopOpacity=".8"/></linearGradient>
      <filter id={`${id}-bloom`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.5"/></filter>
    </defs>
    
    <g className="orbital-atmosphere__dust">
      {stars.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i%4===0?"#eacb8b":"#a8d7f4"} opacity={s.opacity}/>)}
    </g>
    <g fill="none" stroke={ref("gold")}>
      <ellipse cx="220" cy="220" rx="63" ry="24" strokeWidth=".6" transform="rotate(-28 220 220)"/>
      <ellipse cx="220" cy="220" rx="27" ry="68" strokeWidth=".5" transform="rotate(24 220 220)"/>
    </g>
    <circle cx="220" cy="220" r="120" fill={ref("corona")}/>
    {anchors.map(([x,y,warm],i)=><g key={i}>
      <circle cx={x} cy={y} r={warm?7:6} fill={ref(warm?"amber":"blue")}/>
      <path d={`M${x-4} ${y}h8M${x} ${y-6}v12`} stroke={warm?"#ffdca0":"#c5eaff"} strokeWidth=".4" opacity=".6"/>
      <circle cx={x} cy={y} r="1.2" fill={warm?"#ffc766":"#b2deff"} filter={ref("bloom")}/>
      <circle cx={x} cy={y} r={i%3===0?.85:.55} fill="#fff4d8"/>
    </g>)}
  </g>;
}
