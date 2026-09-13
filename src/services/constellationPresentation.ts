import { CONSTELLATION_DEPTH, HYBRID_CAMERA } from "./hybridCore";

export const NODE_PALETTE = {
  project: {label:"PROJECT",color:0xcfa369},
  research: {label:"RESEARCH",color:0xb68aac},
  decision: {label:"DECISION / MEMORY",color:0x88c7d6},
  task: {label:"TASK",color:0xce956e},
  skill: {label:"SKILL",color:0x79b5ad},
  agent: {label:"AGENT",color:0x989dce},
  system: {label:"SYSTEM / TEMPLATE",color:0x9baaba},
  unknown: {label:"UNKNOWN",color:0xa1acb8},
} as const;
export type NodeCategory = keyof typeof NODE_PALETTE;
const OWNERS:Record<string,NodeCategory>={
  "01 - projects":"project","02 - research":"research","03 - tasks":"task",
  "04 - decisions":"decision","05 - skills":"skill","06 - agents":"agent",
  "00 - dashboard":"system","07 - templates":"system","08 - daily briefs":"system","09 - system":"system",
};
/** Classification describes source ownership, never title keywords or file extension. */
export function nodeCategory(node:{id:string;isProject?:boolean}):NodeCategory {
  if(node.isProject)return "project";
  const path=node.id.replace(/\\/g,"/");
  if(path.startsWith("/")||path.split("/").some(part=>part===".."||part==="."))return "unknown";
  return OWNERS[path.split("/")[0].toLowerCase()]??"unknown";
}
export const CONSTELLATION_ROTATION={periodSeconds:80,portalScreenRadius:140};
export function advanceConstellationYaw(yaw:number,delta:number,running:boolean) {
  return yaw+(running?Math.max(0,delta)*Math.PI*2/CONSTELLATION_ROTATION.periodSeconds:0);
}
/** CPU counterpart of volumeMaterial's camera/projection; returns coordinates
 * before the SVG overlay's existing affine transform. No camera or UI rotation. */
export function projectConstellationPoint(point:{x:number;y:number;z:number},pointer:{x:number;y:number}) {
  const h=Math.hypot(HYBRID_CAMERA.x,HYBRID_CAMERA.z),d=Math.hypot(h,HYBRID_CAMERA.y);
  const a=HYBRID_CAMERA.z/h,b=HYBRID_CAMERA.x*HYBRID_CAMERA.y/(h*d),e=h/d;
  const viewX=a*point.x-HYBRID_CAMERA.x/h*point.z;
  const viewY=-b*point.x+e*point.y-HYBRID_CAMERA.y*HYBRID_CAMERA.z/(h*d)*point.z;
  const t=Math.max(0,Math.min(1,(Math.hypot(point.x,point.y)-115)/35));
  const fade=1-t*t*(3-2*t),perspective=CONSTELLATION_DEPTH.perspectiveDistance/(CONSTELLATION_DEPTH.perspectiveDistance-point.z);
  const magnification=1+(perspective-1)*fade;
  let x=viewX*magnification+pointer.x*CONSTELLATION_DEPTH.parallaxX*(point.z+CONSTELLATION_DEPTH.range)*fade;
  let y=viewY*magnification+pointer.y*CONSTELLATION_DEPTH.parallaxY*(point.z+CONSTELLATION_DEPTH.range)*fade;
  if(fade>0){const bound=Math.min(1,CONSTELLATION_ROTATION.portalScreenRadius/Math.max(1,Math.hypot(x,y)));x*=bound;y*=bound;}
  const svgX=x/a;
  return {x:220+svgX,y:220+(-y-b*svgX)/e};
}
