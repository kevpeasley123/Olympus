import * as T from 'three';

/** Project stable architecture clusters through the galaxy's rotation; retain their UI size. */
export function architectureOrbits(host:HTMLElement,camera:T.Camera,_scene:T.Scene){
 const dial=host.closest('.command-instrument__dial');
 const records:Array<{element:HTMLElement;base:T.Vector3;x:number;y:number}>=[];
 const plane=new T.Plane(new T.Vector3(0,0,1),0),ray=new T.Raycaster();
 const point=new T.Vector3(),direction=new T.Vector3(),ndc=new T.Vector2();
 const initial=new T.Quaternion().setFromEuler(new T.Euler(.08,0,-.12)).invert();
 const rotation=new T.Quaternion();let width=0,height=0,previousTime=0;
 const agents=new Map<HTMLElement,{phase:number;blend:number}>();
 const nestPoint=new T.Vector3(),orbitPoint=new T.Vector3();
 const orbitTilt=new T.Quaternion().setFromEuler(new T.Euler(.45,0,-.28));
 function reset(clearAgents=false){for(const el of agents.keys()){el.style.removeProperty('transform');el.style.removeProperty('visibility');el.style.removeProperty('z-index');}if(clearAgents)agents.clear();for(const r of records){r.element.style.removeProperty('transform');r.element.style.removeProperty('visibility');}records.length=0;}
 return {
  update(time:number,moving=true){
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
   const delta=Math.min(Math.max(time-previousTime,0),.05);previousTime=time;
   rotation.setFromEuler(new T.Euler(.08,time*Math.PI*2/120,-.12));

   for(const r of records){
    const isNest=r.element.classList.contains('agents-constellation');
    point.copy(r.base).applyQuaternion(rotation).project(camera);
    if(isNest)point.set(r.x/width*2-1,1-r.y/height*2,0);
    r.element.style.transform=isNest?'none':'translate('+((point.x*.5+.5)*width-r.x).toFixed(2)+'px,'+((.5-point.y*.5)*height-r.y).toFixed(2)+'px)';
    // Architecture is an always-readable overlay, even across Omega's silhouette.
    r.element.style.visibility='visible';
    r.element.dataset.orbitPhase=String(isNest?0:time*Math.PI*2/120);
    if(r.element.classList.contains('agents-constellation')){
     const centerX=(point.x*.5+.5)*width,centerY=(.5-point.y*.5)*height;
     const groupWidth=r.element.offsetWidth,groupHeight=r.element.offsetHeight;
     const stars=r.element.querySelectorAll<HTMLElement>('.agent-architecture-star');
     stars.forEach((el,index)=>{
      const active=el.dataset.orbiting==='true';
      let state=agents.get(el);
      if(!state){state={phase:index*Math.PI*2/Math.max(stars.length,1),blend:active?1:0};agents.set(el,state);}
      const inspecting=el.dataset.inspecting==='true';
      if(!inspecting&&(active||state.blend>0))state.phase+=delta*Math.PI*2/12;
      state.blend=moving?T.MathUtils.damp(state.blend,active?1:0,3,delta):(active?1:0);
      if(!active&&state.blend<.001){state.blend=0;el.style.removeProperty('transform');el.style.removeProperty('visibility');el.style.removeProperty('z-index');return;}
      const localX=el.offsetLeft-groupWidth/2,localY=el.offsetTop-groupHeight/2;
      ndc.set((centerX+localX)/width*2-1,1-(centerY+localY)/height*2);
      ray.setFromCamera(ndc,camera);ray.ray.intersectPlane(plane,nestPoint);
      // A precessing, eccentric 3D orbit sweeps different star neighborhoods.
      const radius=185+32*Math.sin(state.phase*.61+index);
      orbitTilt.setFromEuler(new T.Euler(.8+.5*Math.sin(state.phase*.37),state.phase*.23,-.25+.35*Math.sin(state.phase*.19)));
      orbitPoint.set(Math.cos(state.phase)*radius,Math.sin(state.phase)*radius*.84,0).applyQuaternion(orbitTilt);
      orbitPoint.lerp(nestPoint,1-state.blend);
      const agentDistance=direction.copy(orbitPoint).sub(camera.position).length();
      const scale=1+(T.MathUtils.clamp(700/agentDistance,.78,1.3)-1)*state.blend;
      el.style.visibility='visible';
      el.style.zIndex=String(Math.round(2000-agentDistance));
      el.dataset.agentDepth=orbitPoint.z.toFixed(2);
      orbitPoint.project(camera);
      const dx=(orbitPoint.x*.5+.5)*width-centerX-localX,dy=(.5-orbitPoint.y*.5)*height-centerY-localY;
      el.style.transform='translate(calc(-50% + '+dx.toFixed(2)+'px),calc(-50% + '+dy.toFixed(2)+'px)) scale('+scale.toFixed(3)+')';
      el.dataset.agentOrbitPhase=String(state.phase);
     });
     for(const el of agents.keys())if(!el.isConnected)agents.delete(el);
    }

   }
  },dispose:()=>reset(true),
 };
}
