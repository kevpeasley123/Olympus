import { useId } from "react";

/** Directional edge lighting and inset glass, shared by each orbital control. */
export function OrbitalCardSurface({compact=false,cool=false}:{compact?:boolean;cool?:boolean}) {
  const id=useId().replace(/:/g,"");
  const paint=(name:string)=>`url(#${id}-${name})`;
  const w=compact?86:138,h=compact?32:58;
  const rim=cool?"#a5d5ff":"#ffdc9d";
  return <g pointerEvents="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2=".65" y2="1"><stop stopColor="#293742"/><stop offset=".18" stopColor="#101e29"/><stop offset=".53" stopColor="#06101a"/><stop offset="1" stopColor="#101b24"/></linearGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor={rim}/><stop offset=".23" stopColor={rim} stopOpacity=".75"/><stop offset=".48" stopColor="#7b9bad" stopOpacity=".26"/><stop offset=".8" stopColor="#7694a7" stopOpacity=".35"/><stop offset="1" stopColor={rim} stopOpacity=".7"/></linearGradient>
      <radialGradient id={`${id}-disc`} cx=".28" cy=".18" r=".85"><stop stopColor={cool?"#29476b":"#514b3c"}/><stop offset=".46" stopColor={cool?"#172c43":"#302f29"}/><stop offset="1" stopColor="#07111b"/></radialGradient>
      <radialGradient id={`${id}-flare`}><stop stopColor="#fff8e7"/><stop offset=".09" stopColor={rim} stopOpacity=".85"/><stop offset=".3" stopColor={rim} stopOpacity=".2"/><stop offset="1" stopColor={rim} stopOpacity="0"/></radialGradient>
      <filter id={`${id}-soft`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>
    <rect width={w} height={h} rx="11" className="orbit-domain__glass" style={{fill:paint("glass"),stroke:paint("rim")}}/>
    <rect x="1.8" y="1.8" width={w-3.6} height={h-3.6} rx="9.5" fill="none" stroke="#b9d7e6" strokeOpacity=".09" strokeWidth=".5"/>
    <path d={`M0 29V12Q0 0 12 0H${compact?34:60}`} fill="none" stroke={rim} strokeWidth="2" opacity=".65" filter={paint("soft")}/>
    <path d={`M.5 26V12Q.5 .5 12 .5H${compact?26:49}`} fill="none" stroke={rim} strokeWidth=".8" opacity=".94"/>
    <ellipse cx="8" cy="3" rx="18" ry="11" fill={paint("flare")} opacity=".78"/>
    <circle cx={compact?15:21} cy={compact?16:25} r={compact?10:17} fill={paint("disc")} stroke={paint("rim")} strokeWidth=".6"/>
    <path d={compact?"M7 16A8 8 0 0 1 18 8":"M6 26A15 15 0 0 1 28 12"} stroke={rim} strokeOpacity=".3" strokeWidth=".7" fill="none"/>
  </g>;
}
