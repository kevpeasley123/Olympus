import * as T from 'three';
import type { Mission } from './capabilities';
import { missionOrbit, missionTelemetry } from './pantheonMissions';

/** Real spheres and their progress arcs share Omega's camera and depth buffer. */
export function buildMissionScene(scene:T.Scene, host:HTMLElement, camera:T.Camera) {
  const root=new T.Group();root.name='Active mission planets';scene.add(root);
  const sphere=new T.SphereGeometry(5.1,48,32);
  const records=new Map<string,{group:T.Group;path:T.LineLoop;body:T.Mesh;halo:T.Line;material:T.MeshStandardMaterial;atmosphere:T.ShaderMaterial;orbit:ReturnType<typeof missionOrbit>;tilt:T.Quaternion;elapsed:number;target:HTMLElement|null;progress:number|null}>();
  const projection=new T.Vector3(), direction=new T.Vector3(), ray=new T.Raycaster();
  function disposeRecord(record:ReturnType<typeof records.get>) {if(!record)return;root.remove(record.group,record.path);record.path.geometry.dispose();(record.path.material as T.Material).dispose();record.material.dispose();record.atmosphere.dispose();record.halo.geometry.dispose();(record.halo.material as T.Material).dispose();}
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
        const material=new T.MeshStandardMaterial({color,metalness:.12,roughness:.72,emissive:color,emissiveIntensity:.07});
        material.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 terrain;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrain=position;');
          shader.fragmentShader=`varying vec3 terrain;
float hashTerrain(vec3 p){p=fract(p*.3183099+vec3(.11,.27,.43));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noiseTerrain(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hashTerrain(i),hashTerrain(i+vec3(1,0,0)),f.x),mix(hashTerrain(i+vec3(0,1,0)),hashTerrain(i+vec3(1,1,0)),f.x),f.y),mix(mix(hashTerrain(i+vec3(0,0,1)),hashTerrain(i+vec3(1,0,1)),f.x),mix(hashTerrain(i+vec3(0,1,1)),hashTerrain(i+vec3(1,1,1)),f.x),f.y),f.z);}
float terrainFbm(vec3 p){return noiseTerrain(p)*.55+noiseTerrain(p*2.03)*.27+noiseTerrain(p*4.11)*.12+noiseTerrain(p*8.21)*.06;}
`+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=normalize(terrain);
float continental=terrainFbm(p*3.6+vec3(2.,7.,1.));
float detail=terrainFbm(p*19.);
float clouds=smoothstep(.53,.72,terrainFbm(p*7.+vec3(continental*3.)));
float warm=step(diffuseColor.b,diffuseColor.r);
vec3 ocean=vec3(.018,.075,.15),land=mix(vec3(.07,.17,.20),vec3(.28,.38,.35),detail);
vec3 terrestrial=mix(ocean,land,smoothstep(.48,.57,continental));
float bands=.5+.5*sin(p.y*29.+continental*15.+detail*3.);
vec3 mineral=mix(vec3(.12,.052,.023),vec3(.64,.36,.12),bands*.6+detail*.4);
vec3 surface=mix(terrestrial,mineral,warm);
surface=mix(surface,vec3(.78,.84,.86),clouds*mix(.72,.18,warm));
float pole=smoothstep(.88,.99,abs(p.y)+continental*.055);
surface=mix(surface,vec3(.75,.82,.85),pole*(1.-warm)*.8);
diffuseColor.rgb=surface*(.83+detail*.3);
`);
        };
        const body=new T.Mesh(sphere,material);body.rotation.z=.32;group.add(body);
        const atmosphere=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(color)}},vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.5);gl_FragColor=vec4(tint,rim*.28);}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
        const air=new T.Mesh(sphere,atmosphere);air.scale.setScalar(1.07);group.add(air);
        const halo=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthTest:true,depthWrite:false}));group.add(halo);root.add(group);
        const tilt=new T.Quaternion().setFromEuler(new T.Euler(orbit.inclination,.18,orbit.rotation));
        const path=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:192},(_,i)=>new T.Vector3(Math.cos(i/192*Math.PI*2)*orbit.radius,Math.sin(i/192*Math.PI*2)*orbit.radius,0).applyQuaternion(tilt))),new T.LineBasicMaterial({color:0xc89b54,transparent:true,opacity:.075,depthTest:true,depthWrite:false}));path.visible=false;root.add(path);
        record={group,path,body,halo,material,atmosphere,orbit,tilt,elapsed:0,target:null,progress:null};records.set(mission.id,record);
      }
      if(!record.target?.isConnected)record.target=Array.from(host.closest('.command-instrument__dial')?.querySelectorAll<HTMLElement>('[data-mission-id]')??[]).find(t=>t.dataset.missionId===mission.id)??null;
      record.atmosphere.uniforms.tint.value.setHex(color);record.material.color.setHex(color);record.material.emissive.setHex(color);
      record.material.emissiveIntensity=selected && selected!==mission.id ? .025 : .10;
      if(record.progress!==telemetry.progress || !record.halo.geometry.getAttribute('position')){
        record.progress=telemetry.progress;record.halo.geometry.dispose();
        const points=Array.from({length:65},(_,i)=>{const a=-Math.PI/2+i/64*Math.PI*2*(telemetry.progress??0);return new T.Vector3(Math.cos(a)*6.5,Math.sin(a)*6.5,0)});
        record.halo.geometry=new T.BufferGeometry().setFromPoints(points);
      }
      record.halo.visible=false; // Progress belongs in the mission directory; inspection uses the hover reticle.
      (record.halo.material as T.LineBasicMaterial).color.setHex(color);
      const inspecting=Boolean(record.target?.matches(':hover, :focus-visible, [data-inspecting="true"]'));
      if(!inspecting)record.elapsed+=delta;
      const a=record.orbit.phase+record.elapsed*Math.PI*2/record.orbit.period;
      record.group.position.set(Math.cos(a)*record.orbit.radius,Math.sin(a)*record.orbit.radius,0).applyQuaternion(record.tilt);
      record.body.rotation.y=record.elapsed*.012;
      record.halo.quaternion.copy(camera.quaternion);
      if(record.target){
        projection.copy(record.group.position).project(camera);
        const x=(projection.x*.5+.5)*100,y=(.5-projection.y*.5)*100;
        record.target.style.left=`${x.toFixed(2)}%`;record.target.style.top=`${y.toFixed(2)}%`;
        record.target.dataset.orbitPaused=String(inspecting);
        record.target.dataset.orbitAngle=String(a);
        record.target.dataset.side=x<50?'left':'right';
        direction.copy(record.group.position).sub(camera.position);const distance=direction.length();ray.set(camera.position,direction.normalize());
        const omega=scene.getObjectByName('Omega solid');
        const hit=omega?ray.intersectObject(omega,false)[0]:undefined;
        const hidden=Boolean(hit&&hit.distance<distance-5.1);
        record.target.dataset.occluded=String(hidden);
        record.target.style.setProperty('--planet-scale',String(Math.max(.65,Math.min(1.3,560/distance))));
      }
    }
    return records.size;
  }
  return {update,dispose:()=>{for(const record of records.values())disposeRecord(record);sphere.dispose();scene.remove(root);}};
}
