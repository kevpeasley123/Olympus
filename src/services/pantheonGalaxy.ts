import {PANTHEON_FIGURES} from "./pantheonFigureState";
import * as T from "three";
import { accessSnapshot, type SourceAccess } from "./sourceActivity";

export const GALAXY_RADIUS = 181;

export interface GalaxyAsset { id:string; label:string }
export function positionForAsset(id:string) {
  let hash=2166136261;
  for(const c of id) hash=Math.imul(hash ^ c.charCodeAt(0),16777619);
  const angle=(hash>>>0)/4294967296*Math.PI*2;
  const height=((Math.imul(hash,1664525)>>>0)/4294967296-.5)*190;
  const radius=95+((hash>>>8)%45);
  return new T.Vector3(radius*Math.cos(angle),height,radius*Math.sin(angle));
}

/** Real assets and observed interactions share one rotating coordinate frame. */
export function buildPantheonGalaxy(scene:T.Scene) {
  const group=new T.Group(); group.name="Pantheon galaxy";scene.add(group);
  let seed = 72431;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const count = 2400, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const color = new T.Color();
  for (let i = 0; i < count; i++) {
    const radius = GALAXY_RADIUS * (i % 4 === 0 ? .92 + random() * .08 : Math.pow(random(), .50)), azimuth = random() * Math.PI * 2;
    const latitude = 2 * random() - 1, radial = Math.sqrt(1 - latitude * latitude);
    positions.set([radius * radial * Math.cos(azimuth), radius * latitude, radius * radial * Math.sin(azimuth)], i * 3);
    color.set(i % 7 === 0 ? 0xe7bf78 : 0x8cb7d1).multiplyScalar((.50 + random() * .68) * (1 - .20 * Math.pow(radius / GALAXY_RADIUS, 4)));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  // A fixed permutation gives 40% of the ambient stars a varied size and glow.
  // Keep the original positions and quiet majority so the named clusters remain distinct.
  const variation = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const enhanced = (i * 197) % count < count * .4;
    const size = enhanced ? 1.35 + ((i * 73 + 19) % 101) / 100 * .75 : 1;
    variation.set([size, random() * Math.PI * 2, .65 + random() * .45], i * 3);
  }
  // Separate deterministic values avoid making every larger star equally bright.
  const glow = Float32Array.from({length: count}, (_, i) => (i * 197) % count < count * .4
    ? 1.2 + ((i * 137 + 53) % 101) / 100 * .65 : 1);
  const dustGeometry = new T.BufferGeometry();
  dustGeometry.setAttribute("glow", new T.BufferAttribute(glow, 1));
  dustGeometry.setAttribute("variation", new T.BufferAttribute(variation, 3));
  dustGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  dustGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  const dustMaterial = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexColors: true, transparent: true, depthTest: true, depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `
      attribute vec3 variation; attribute float glow; uniform float time;
      varying vec3 tint; varying float shimmer; varying float enhanced;
      void main() {
        tint=color*glow;
        enhanced=step(1.01,variation.x);
        float phase=variation.y;
        shimmer=enhanced>0. ? .92+.08*sin(time*variation.z+phase)*sin(time*variation.z*.43+phase*1.7) : 1.;
        vec4 p=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*p;
        // Extra sprite space holds the faint halo, not a larger solid core.
        gl_PointSize=clamp(3.3*700./max(200.,-p.z),2.2,5.2)*variation.x*mix(1.,2.,enhanced);
      }`,
    fragmentShader: `
      varying vec3 tint; varying float shimmer; varying float enhanced;
      void main() {
        vec2 uv=(gl_PointCoord-.5)*2.;
        float r2=dot(uv,uv);
        float quiet=1.-smoothstep(.05,1.,sqrt(r2));
        // Concentrated light and exponential falloff avoid a visible circular rim.
        float core=exp(-r2*60.);
        float halo=.18*exp(-r2*10.);
        float rays=.09*(exp(-abs(uv.x)*70.-abs(uv.y)*9.)+exp(-abs(uv.y)*70.-abs(uv.x)*9.));
        float light=mix(quiet,core+halo+rays,enhanced);
        vec3 hue=mix(tint,mix(tint,vec3(1.),.35*core),enhanced);
        gl_FragColor=vec4(hue,light*.85*shimmer);
      }`,
  });
  group.add(new T.Points(dustGeometry, dustMaterial));
  const assets=new Map<string,T.Mesh>();
  const geometry=new T.SphereGeometry(1.7,8,6);
  const surface=new T.MeshBasicMaterial({color:0x9fc2db});
  const memorySurface=new T.MeshBasicMaterial({color:0xb9a5df});
  const segments=12;
  const pulses=Array.from({length:6},()=>{
    const material=new T.LineBasicMaterial({color:new T.Color(3.8,2.3,1.1),transparent:true,depthTest:false});
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(new Float32Array((segments+1)*3),3));
    const line=new T.Line(geometry,material);line.visible=false;line.frustumCulled=false;
    const tip=new T.Mesh(new T.SphereGeometry(2,8,6),new T.MeshBasicMaterial({color:new T.Color(4,3,1.8),depthTest:false}));
    tip.visible=false;group.add(line,tip);
    return {material,line,tip};
  });
  let lastAssets:readonly GalaxyAsset[]|undefined,lastAccess:readonly SourceAccess[]|undefined;
  function update(time:number, items:readonly GalaxyAsset[], reduced:boolean) {
    dustMaterial.uniforms.time.value=time;
    const access=accessSnapshot();
    if(lastAssets!==items || lastAccess!==access) {
      const visible=new Map(items.map(item=>[item.id,item.label]));
      for(const event of access) {
        if(!visible.has("agent:"+event.actor))visible.set("actor:"+event.actor,event.actor);const destination=event.sourceId??"source:"+event.source;
        if(!visible.has(destination))visible.set(destination,event.source);
      }
      for(const [id,mesh] of assets) if(!visible.has(id)){group.remove(mesh);assets.delete(id);}
      for(const [id,label] of visible) if(!assets.has(id)){
        const mesh=new T.Mesh(geometry,id.startsWith("note:")?memorySurface:surface);mesh.position.copy(positionForAsset(id));mesh.name=label;mesh.userData.assetId=id;
        group.add(mesh);assets.set(id,mesh);
      }
      lastAssets=items;lastAccess=access;
    }
    group.rotation.set(.08,time*Math.PI*2/120,-.12);
    group.updateWorldMatrix(true,false);
    for(const figure of PANTHEON_FIGURES){
      const anchor=assets.get("agent:"+figure.agent)??assets.get("actor:"+figure.agent);
      if(anchor){
        const avatar=scene.getObjectByName('Pantheon figures')?.getObjectByName(figure.name);
        if(avatar)avatar.getWorldPosition(anchor.position);
        else anchor.position.set(...figure.station);
        group.worldToLocal(anchor.position);
      }
    }
    const now=performance.now();
    pulses.forEach(({line,material,tip},index)=>{
      const event=access[index];
      const age=event?(now-event.at)/1000:Infinity;
      line.visible=age>=0 && age<2.6;
      tip.visible=line.visible && !reduced;
      if(!line.visible)return;
      const from=(assets.get("agent:"+event.actor)??assets.get("actor:"+event.actor))!.position,to=assets.get(event.sourceId??"source:"+event.source)!.position;
      const progress=reduced?1:Math.min(1,age/.85);
      const amplitude=Math.min(6,from.distanceTo(to)*.045);
      const vertices=line.geometry.getAttribute("position") as T.BufferAttribute;
      for(let i=0;i<=segments;i++){
        const t=progress*i/segments;
        const ripple=reduced?0:Math.sin(Math.PI*i/segments)*Math.sin(i*4.7)*amplitude;
        vertices.setXYZ(i,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t+ripple,from.z+(to.z-from.z)*t);
      }
      tip.position.copy(from).lerp(to,progress);
      vertices.needsUpdate=true;
      if(event.success)material.color.setRGB(3.8,2.3,1.1);
      else material.color.setRGB(2.1,.4,.2);
      tip.material.color.copy(material.color);
      material.opacity=Math.min(1,(2.6-age)/.8);
    });
  }
  function pick(ray:T.Raycaster) {
    const object=ray.intersectObjects([...assets.values()],false)[0]?.object;
    return object ? {id:String(object.userData.assetId),label:object.name} : undefined;
  }
  return {group,update,pick,particleCount:count,count:()=>assets.size,activePulses:()=>pulses.filter(p=>p.line.visible).length};
}
