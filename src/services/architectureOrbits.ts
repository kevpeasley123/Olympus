import * as T from 'three';
import {memoryOrbit} from './memoryOrbit';

/** Project stable architecture clusters through the galaxy's rotation; retain their UI size. */
export function architectureOrbits(host:HTMLElement,camera:T.Camera){
 const dial=host.closest('.command-instrument__dial');
 const records:Array<{element:HTMLElement;base:T.Vector3;x:number;y:number}>=[];
 const plane=new T.Plane(new T.Vector3(0,0,1),0),ray=new T.Raycaster();
 const point=new T.Vector3(),ndc=new T.Vector2();
 const initial=new T.Quaternion().setFromEuler(new T.Euler(.08,0,-.12)).invert();
 const rotation=new T.Quaternion();let width=0,height=0,memoryTime=0,previousTime=0;
 function reset(){for(const r of records){for(const name of ['transform','visibility','opacity','z-index'])r.element.style.removeProperty(name);delete r.element.dataset.orbitDepth;}records.length=0;}
 return {
  update(time:number){
   const delta=Math.max(0,Math.min(.1,time-previousTime));previousTime=time;
   if(!dial)return;
   const bounds=host.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
   if(bounds.width!==width||bounds.height!==height||!records.length){
    reset();width=bounds.width;height=bounds.height;
    for(const element of dial.querySelectorAll<HTMLElement>('.armory-constellation,.skills-constellation,.vault-constellation')){
     const rect=element.getBoundingClientRect(),x=rect.left+rect.width/2-bounds.left,y=rect.top+rect.height/2-bounds.top;
     ndc.set(x/width*2-1,1-y/height*2);ray.setFromCamera(ndc,camera);
     if(ray.ray.intersectPlane(plane,point))records.push({element,base:point.clone().applyQuaternion(initial),x,y});
    }
   }
   rotation.setFromEuler(new T.Euler(.08,time*Math.PI*2/120,-.12));

   for(const r of records){
    if(r.element.classList.contains('vault-constellation')){
     // Empty/error placeholders stay anchored; no synthetic memories are shown.
     if(!r.element.querySelector('.vault-star')){r.element.style.transform='none';r.element.style.opacity='1';r.element.style.zIndex='4';continue;}
     const inspecting=r.element.matches(':hover,:focus-within');
     if(!inspecting)memoryTime+=delta;
     const orbit=memoryOrbit(memoryTime);
     point.set(orbit.x,orbit.y,orbit.z).project(camera);
     r.element.style.transform=`translate(${((point.x*.5+.5)*width-r.x).toFixed(2)}px,${((.5-point.y*.5)*height-r.y).toFixed(2)}px) scale(${orbit.scale.toFixed(3)})`;
     r.element.style.opacity=String(orbit.opacity);
     // The transparent canvas paints Omega over the rear cluster, while the
     // foreground cluster stays above it. Inspection keeps note targets usable.
     r.element.style.zIndex=orbit.z<0&&!inspecting?'0':'4';
     r.element.style.visibility='visible';
     r.element.dataset.orbitDepth=String(orbit.z);
     r.element.dataset.orbitPhase=String(memoryTime*Math.PI*2/120);
     continue;
    }
    point.copy(r.base).applyQuaternion(rotation).project(camera);
    r.element.style.transform='translate('+((point.x*.5+.5)*width-r.x).toFixed(2)+'px,'+((.5-point.y*.5)*height-r.y).toFixed(2)+'px)';
    // Architecture is an always-readable overlay, even across Omega's silhouette.
    r.element.style.visibility='visible';
    r.element.dataset.orbitPhase=String(time*Math.PI*2/120);

   }
  },dispose:()=>reset(),
 };
}
