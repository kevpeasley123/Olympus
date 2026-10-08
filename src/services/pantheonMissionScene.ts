import * as T from 'three';
import type { Mission } from './capabilities';
import { missionOrbit, missionTelemetry } from './pantheonMissions';

/** Real spheres and their progress arcs share Omega's camera and depth buffer. */
export function buildMissionScene(scene:T.Scene, host:HTMLElement, camera:T.Camera) {
  const root=new T.Group();root.name='Active mission planets';scene.add(root);
  const sphere=new T.SphereGeometry(4.1,24,16);
  const records=new Map<string,{group:T.Group;path:T.LineLoop;body:T.Mesh;halo:T.Line;material:T.MeshStandardMaterial;orbit:ReturnType<typeof missionOrbit>;tilt:T.Quaternion;elapsed:number;target:HTMLElement|null;progress:number|null}>();
  const projection=new T.Vector3(), direction=new T.Vector3(), ray=new T.Raycaster();
  function disposeRecord(record:ReturnType<typeof records.get>) {if(!record)return;root.remove(record.group,record.path);record.path.geometry.dispose();(record.path.material as T.Material).dispose();record.material.dispose();record.halo.geometry.dispose();(record.halo.material as T.Material).dispose();}
  function update(missions:readonly Mission[], selected:string|null, delta:number) {
    const ids=new Set(missions.map(m=>m.id));
    for(const [id,record] of records)if(!ids.has(id)){disposeRecord(record);records.delete(id);}
    for(const mission of missions){
      const telemetry=missionTelemetry(mission), color=telemetry.tone==='cyan'?0x75b9db:telemetry.tone==='amber'?0xe7b76b:0xb97567;
      let record=records.get(mission.id);
      if(!record){
        const orbit=missionOrbit(mission.id),group=new T.Group();group.name=mission.id;
        // Spread simultaneous arrivals without moving existing missions on refresh.
        orbit.phase=2.5+records.size*2.399963-orbit.rotation+(orbit.phase% .3);
        const material=new T.MeshStandardMaterial({color,metalness:.38,roughness:.64,emissive:color,emissiveIntensity:.07});
        material.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 terrain;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrain=position;');
          shader.fragmentShader='varying vec3 terrain;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat bands=sin(terrain.y*7.+sin(terrain.x*4.)*1.5+sin(terrain.z*6.));diffuseColor.rgb*=.5+.5*smoothstep(-.7,.7,bands);');
        };
        const body=new T.Mesh(sphere,material);group.add(body);
        const halo=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthTest:true,depthWrite:false}));group.add(halo);root.add(group);
        const tilt=new T.Quaternion().setFromEuler(new T.Euler(orbit.inclination,.18,orbit.rotation));
        const path=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:192},(_,i)=>new T.Vector3(Math.cos(i/192*Math.PI*2)*orbit.radius,Math.sin(i/192*Math.PI*2)*orbit.radius,0).applyQuaternion(tilt))),new T.LineBasicMaterial({color:0xc89b54,transparent:true,opacity:.075,depthTest:true,depthWrite:false}));root.add(path);
        record={group,path,body,halo,material,orbit,tilt,elapsed:0,target:null,progress:null};records.set(mission.id,record);
      }
      if(!record.target?.isConnected)record.target=Array.from(host.closest('.command-instrument__dial')?.querySelectorAll<HTMLElement>('[data-mission-id]')??[]).find(t=>t.dataset.missionId===mission.id)??null;
      record.material.color.setHex(color);record.material.emissive.setHex(color);
      record.material.emissiveIntensity=selected && selected!==mission.id ? .025 : .10;
      if(record.progress!==telemetry.progress || !record.halo.geometry.getAttribute('position')){
        record.progress=telemetry.progress;record.halo.geometry.dispose();
        const points=Array.from({length:65},(_,i)=>{const a=-Math.PI/2+i/64*Math.PI*2*(telemetry.progress??0);return new T.Vector3(Math.cos(a)*5.8,Math.sin(a)*5.8,0)});
        record.halo.geometry=new T.BufferGeometry().setFromPoints(points);
      }
      record.halo.visible=telemetry.progress!==null && telemetry.progress>0;
      (record.halo.material as T.LineBasicMaterial).color.setHex(color);
      record.elapsed+=delta*(mission.status==='waiting'?.12:1);
      const a=record.orbit.phase+record.elapsed*Math.PI*2/record.orbit.period;
      record.group.position.set(Math.cos(a)*record.orbit.radius,Math.sin(a)*record.orbit.radius,0).applyQuaternion(record.tilt);
      record.body.rotation.y=record.elapsed*.012;
      record.halo.quaternion.copy(camera.quaternion);
      if(record.target){
        projection.copy(record.group.position).project(camera);
        const x=(projection.x*.5+.5)*100,y=(.5-projection.y*.5)*100;
        record.target.style.left=`${x.toFixed(2)}%`;record.target.style.top=`${y.toFixed(2)}%`;
        record.target.dataset.side=x<50?'left':'right';
        direction.copy(record.group.position).sub(camera.position);const distance=direction.length();ray.set(camera.position,direction.normalize());
        const omega=scene.getObjectByName('Omega solid');
        const hit=omega?ray.intersectObject(omega,false)[0]:undefined;
        const hidden=Boolean(hit&&hit.distance<distance-4);
        record.target.dataset.occluded=String(hidden);
        record.target.style.setProperty('--planet-scale',String(Math.max(.65,Math.min(1.3,560/distance))));
      }
    }
    return records.size;
  }
  return {update,dispose:()=>{for(const record of records.values())disposeRecord(record);sphere.dispose();scene.remove(root);}};
}
