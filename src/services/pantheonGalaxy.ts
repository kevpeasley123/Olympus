import * as T from "three";
import { accessSnapshot, type SourceAccess } from "./sourceActivity";

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
  const assets=new Map<string,T.Mesh>();
  const geometry=new T.SphereGeometry(1.7,8,6);
  const surface=new T.MeshBasicMaterial({color:0x9fc2db});
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
    const access=accessSnapshot();
    if(lastAssets!==items || lastAccess!==access) {
      const visible=new Map(items.map(item=>[item.id,item.label]));
      for(const event of access) {
        if(!visible.has("agent:"+event.actor))visible.set("actor:"+event.actor,event.actor);visible.set("source:"+event.source,event.source);
      }
      for(const [id,mesh] of assets) if(!visible.has(id)){group.remove(mesh);assets.delete(id);}
      for(const [id,label] of visible) if(!assets.has(id)){
        const mesh=new T.Mesh(geometry,surface);mesh.position.copy(positionForAsset(id));mesh.name=label;mesh.userData.assetId=id;
        group.add(mesh);assets.set(id,mesh);
      }
      lastAssets=items;lastAccess=access;
    }
    group.rotation.set(.08,time*Math.PI*2/120,-.12);
    const now=performance.now();
    pulses.forEach(({line,material,tip},index)=>{
      const event=access[index];
      const age=event?(now-event.at)/1000:Infinity;
      line.visible=age>=0 && age<2.6;
      tip.visible=line.visible && !reduced;
      if(!line.visible)return;
      const from=(assets.get("agent:"+event.actor)??assets.get("actor:"+event.actor))!.position,to=assets.get("source:"+event.source)!.position;
      const progress=reduced?1:Math.min(1,age/.85);
      const vertices=line.geometry.getAttribute("position") as T.BufferAttribute;
      for(let i=0;i<=segments;i++){
        const t=progress*i/segments;
        const ripple=reduced?0:Math.sin(Math.PI*i/segments)*Math.sin(i*4.7)*2.2;
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
  return {group,update,pick,count:()=>assets.size};
}
