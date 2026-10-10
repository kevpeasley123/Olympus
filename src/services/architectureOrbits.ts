import * as T from 'three';

/** Project stable architecture clusters through the galaxy's rotation; retain their UI size. */
export function architectureOrbits(host:HTMLElement,camera:T.Camera){
 const dial=host.closest('.command-instrument__dial');
 const records:Array<{element:HTMLElement;base:T.Vector3;x:number;y:number}>=[];
 const plane=new T.Plane(new T.Vector3(0,0,1),0),ray=new T.Raycaster();
 const point=new T.Vector3(),ndc=new T.Vector2();
 const initial=new T.Quaternion().setFromEuler(new T.Euler(.08,0,-.12)).invert();
 const rotation=new T.Quaternion();let width=0,height=0;
 function reset(){for(const r of records){r.element.style.removeProperty('transform');r.element.style.removeProperty('visibility');}records.length=0;}
 return {
  update(time:number){
   if(!dial)return;
   const bounds=host.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
   if(bounds.width!==width||bounds.height!==height||!records.length){
    reset();width=bounds.width;height=bounds.height;
    for(const element of dial.querySelectorAll<HTMLElement>('.armory-constellation,.skills-constellation,.vault-constellation,.agents-constellation')){
     const rect=element.getBoundingClientRect(),x=rect.left+rect.width/2-bounds.left,y=rect.top+rect.height/2-bounds.top;
     ndc.set(x/width*2-1,1-y/height*2);ray.setFromCamera(ndc,camera);
     if(ray.ray.intersectPlane(plane,point))records.push({element,base:point.clone().applyQuaternion(initial),x,y});
    }
   }
   rotation.setFromEuler(new T.Euler(.08,time*Math.PI*2/120,-.12));

   for(const r of records){
    const isNest=r.element.classList.contains('agents-constellation');
    point.copy(r.base).applyQuaternion(rotation).project(camera);
    if(isNest)point.set(r.x/width*2-1,1-r.y/height*2,0);
    r.element.style.transform=isNest?'none':'translate('+((point.x*.5+.5)*width-r.x).toFixed(2)+'px,'+((.5-point.y*.5)*height-r.y).toFixed(2)+'px)';
    // Architecture is an always-readable overlay, even across Omega's silhouette.
    r.element.style.visibility='visible';
    r.element.dataset.orbitPhase=String(isNest?0:time*Math.PI*2/120);

   }
  },dispose:()=>reset(),
 };
}
