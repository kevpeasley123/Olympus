import * as T from "three";
import {HYBRID_CAMERA,HYBRID_OVERLAY_TRANSFORM,CONSTELLATION_DEPTH} from "./hybridCore";
import {advanceConstellationYaw,nodeCategory,projectConstellationPoint} from "./constellationPresentation";

export function runConstellationPresentationHarness() {
  const checks:string[]=[];
  const assert=(ok:boolean,message:string)=>{if(!ok)throw Error(message);checks.push(message);};
  const owners={"01 - Projects":"project","02 - Research":"research","03 - Tasks":"task","04 - Decisions":"decision","05 - Skills":"skill","06 - Agents":"agent","07 - Templates":"system","09 - System":"system"};
  assert(Object.entries(owners).every(([folder,category])=>nodeCategory({id:`${folder}/nested/Note.md`})===category),"Categories follow vault ownership paths");
  assert(nodeCategory({id:"02 - Research\\Nested\\Note.md"})==="research","Windows path separators normalize");
  assert(nodeCategory({id:"Research Agent Task.md"})==="unknown"&&nodeCategory({id:"mystery/note.md"})==="unknown"&&nodeCategory({id:"02 - Research/../Note.md"})==="unknown","Unrecognized and ambiguous paths remain neutral");
  assert(nodeCategory({id:"root.md",isProject:true})==="project","Explicit project metadata remains authoritative");
  assert(Math.abs(advanceConstellationYaw(0,80,true)-2*Math.PI)<1e-12&&advanceConstellationYaw(2*Math.PI,1,true)>2*Math.PI,"80-second yaw continues across the revolution boundary");
  assert(advanceConstellationYaw(1.2,99,false)===1.2,"Reduced or inactive motion preserves a static orientation");
  const camera=new T.OrthographicCamera(-220,220,220,-220,.1,2000);
  camera.position.set(HYBRID_CAMERA.x,HYBRID_CAMERA.y,HYBRID_CAMERA.z);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const affine=new DOMMatrix(HYBRID_OVERLAY_TRANSFORM);
  for(const yaw of [0,.4,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]) {
    const point=new T.Vector3(110,35,27).applyAxisAngle(new T.Vector3(0,1,0),yaw);
    for(const pointer of [{x:0,y:0},{x:1,y:-1}]) {
      const view=point.clone().applyMatrix4(camera.matrixWorldInverse);
      const t=T.MathUtils.smoothstep(Math.hypot(point.x,point.y),115,150),fade=1-t;
      const factor=1+(360/(360-point.z)-1)*fade;
      let expectedX=view.x*factor+pointer.x*CONSTELLATION_DEPTH.parallaxX*(point.z+34)*fade;
      let expectedY=view.y*factor+pointer.y*CONSTELLATION_DEPTH.parallaxY*(point.z+34)*fade;
      if(fade>0){const bound=Math.min(1,140/Math.max(1,Math.hypot(expectedX,expectedY)));expectedX*=bound;expectedY*=bound;}
      const svg=projectConstellationPoint(point,pointer),screen=affine.transformPoint({x:svg.x-220,y:svg.y-220});
      assert(Math.abs(screen.x-expectedX)<1e-8&&Math.abs(screen.y+expectedY)<1e-8,`SVG targets match Three.js projection at yaw ${yaw.toFixed(2)} / pointer ${pointer.x}`);
    }
  }
  for(let i=0;i<360;i++) {
    const point=new T.Vector3(140,0,32).applyAxisAngle(new T.Vector3(0,1,0),i*Math.PI/180);
    const svg=projectConstellationPoint(point,{x:1,y:1});
    const screen=affine.transformPoint({x:svg.x-220,y:svg.y-220});
    if(Math.hypot(screen.x,screen.y)>140.000001)throw Error('Rotating node escaped the portal opening');
  }
  checks.push('Near-side nodes remain inside the portal through 360 sampled angles');
  return checks;
}
