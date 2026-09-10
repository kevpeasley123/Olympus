import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export const SCENE_FINISH={
  bloom:{threshold:1.35,strength:.3,radius:.26},
  network:{rear:.32,mid:.58,front:.95,treeOpacity:.09,crossOpacity:.10},
};
import { buildCommandMaterialStudy } from "./commandMaterialStudy";
import { buildConstellationField } from "./constellationField";
import { INNER_CORE_SCALE, HYBRID_CAMERA, CONSTELLATION_DEPTH, nodeDepth, type CommandLayout } from "./hybridCore";
import type { HybridFrame } from "../components/panels/HybridCommandCore";

export const LISTENING_RINGS = { transitionSeconds:2.8, waveInterval:1, waveDuration:.95, waveTravel:23, waveOpacity:.10 };
export const VOICE_SIGNATURE = {
  attackSeconds:.07, releaseSeconds:.24, fadeInSeconds:.20, fadeOutSeconds:.48,
  phaseSpeed:.75, travelSpeed:.60, amplitude:28.6, coreWidth:.30, glowWidth:1.0,
  opacity:.90, glowOpacity:.12,
};
const EXECUTING_MOTION = { launchesPerSecond:5, transitSeconds:1.2, rotationSpeed:2 };
const ORANGE = 0xee842d, BLUE = 0x739fbd;
const point = (angle: number, radius: number) => new T.Vector2(Math.sin(angle * Math.PI / 180) * radius, Math.cos(angle * Math.PI / 180) * radius);
function band(start: number, end: number, inner: number, outer: number) {
  const shape = new T.Shape();
  const steps = Math.max(6, Math.ceil((end - start) / 2));
  for (let i = 0; i <= steps; i++) { const p = point(start + (end - start) * i / steps, outer); i ? shape.lineTo(p.x,p.y) : shape.moveTo(p.x,p.y); }
  for (let i = steps; i >= 0; i--) { const p = point(start + (end - start) * i / steps, inner); shape.lineTo(p.x,p.y); }
  shape.closePath(); return shape;
}

export function mountHybridScene(host: HTMLDivElement, layout: CommandLayout, current: () => HybridFrame, ready: () => void, fail: (message: string) => void) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) { fail("WebGL 2 is unavailable."); return () => {}; }
  let renderer: T.WebGLRenderer;
  try { renderer = new T.WebGLRenderer({ canvas, context, alpha: true, antialias: true }); }
  catch { fail("The graphics device could not start."); return () => {}; }
  renderer.setClearColor(0x000000, 0);
  // Modest supersampling on 1x displays keeps bevels from breaking into pixels.
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(canvas);
  const scene = new T.Scene(); // Transparent scene: the live page supplies the environment background.
  const camera = new T.OrthographicCamera(-220,220,220,-220,1,1000); camera.position.set(HYBRID_CAMERA.x,HYBRID_CAMERA.y,HYBRID_CAMERA.z); camera.lookAt(0,0,0);
  const pointerTarget=new T.Vector2(),pointer=new T.Vector2();
  const interaction=host.closest('.command-instrument__dial') ?? host.parentElement!;
  const movePointer=(event:Event)=>{
    const e=event as PointerEvent,rect=host.getBoundingClientRect();
    if(e.pointerType==='touch'||!rect.width||!rect.height)return;
    pointerTarget.set(T.MathUtils.clamp((e.clientX-rect.left)/rect.width*2-1,-1,1),T.MathUtils.clamp(1-(e.clientY-rect.top)/rect.height*2,-1,1));
  };
  const resetPointer=()=>pointerTarget.set(0,0);
  interaction.addEventListener('pointermove',movePointer);
  interaction.addEventListener('pointerleave',resetPointer);
  window.addEventListener('blur',resetPointer);
  // A plane-anchored perspective projection for the network only. Z=0 retains
  // the exact orthographic composition; the instrument camera never moves.
  // Keep camera-space depth for real occlusion against the unchanged chassis/core.
  function volumeMaterial(material:T.Material){
    material.onBeforeCompile=shader=>{
      shader.uniforms.volumePointer={value:pointer};
      shader.vertexShader='uniform vec2 volumePointer;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
        vec4 volumeLocal=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          volumeLocal=instanceMatrix*volumeLocal;
        #endif
        vec4 volumeWorld=modelMatrix*volumeLocal;
        vec4 volumeOrigin=vec4(0.0,0.0,0.0,1.0);
        #ifdef USE_INSTANCING
          volumeOrigin=instanceMatrix*volumeOrigin;
        #endif
        vec4 volumeCenter=${material instanceof T.LineBasicMaterial?'volumeWorld':'modelMatrix*volumeOrigin'};
        vec4 centerView=viewMatrix*volumeCenter;
        vec4 mvPosition=viewMatrix*volumeWorld;
        float volumeZ=volumeCenter.z;
        float perspectiveScale=${CONSTELLATION_DEPTH.perspectiveDistance.toFixed(1)}/(${CONSTELLATION_DEPTH.perspectiveDistance.toFixed(1)}-volumeZ);
        // Ease magnification out at the project anchors so stars cannot spill
        // onto glass labels. The interior retains the full depth projection.
        float anchorFade=1.0-smoothstep(115.0,150.0,length(volumeCenter.xy));
        mvPosition.xy=centerView.xy*mix(1.0,perspectiveScale,anchorFade)+(mvPosition.xy-centerView.xy)*perspectiveScale;
        mvPosition.xy+=volumePointer*vec2(${CONSTELLATION_DEPTH.parallaxX},${CONSTELLATION_DEPTH.parallaxY})*(volumeZ+${CONSTELLATION_DEPTH.range.toFixed(1)})*anchorFade;
        gl_Position=projectionMatrix*mvPosition;
      `);
    };
    material.customProgramCacheKey=()=> 'constellation-volume-v2';
    material.depthTest=true;
    return material;
  }
  scene.add(new T.HemisphereLight(0xc5e2ff,0x07121f,.65));
  const light = new T.DirectionalLight(0xddefff,2.1); light.position.set(-100,160,230); scene.add(light);
  const warm = new T.PointLight(ORANGE, 160, 380, 1); warm.position.set(20,-20,100); scene.add(warm);
  const structural = new T.MeshStandardMaterial({ color: 0x172e43, metalness: .72, roughness: .5 });
  const glow = new T.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: .45, metalness: .45, roughness: .28 });
  const cool = new T.MeshStandardMaterial({ color: BLUE, emissive: 0x284d70, emissiveIntensity: .55, metalness: .65, roughness: .3 });
  function mesh(geometry: T.BufferGeometry, material: T.Material, z = 0) { const m = new T.Mesh(geometry,material); m.position.z=z; scene.add(m); return m; }
  const study = buildCommandMaterialStudy(scene, renderer, layout);
  const field = buildConstellationField(scene);
  renderer.info.autoReset=false;
  const sceneTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,sceneTarget);
  const renderPass=new RenderPass(scene,camera);
  // Render the network into the SAME color/depth target, after the instrument.
  // Orbital depth proxies below affect only this pass, never the visible finish.
  const networkScene=new T.Scene();
  networkScene.add(new T.HemisphereLight(0xc5e2ff,0x07121f,.65),light.clone(),warm.clone());
  const networkPass=new RenderPass(networkScene,camera);networkPass.clear=false;
  const bloomPass=new UnrealBloomPass(new T.Vector2(512,512),SCENE_FINISH.bloom.strength,SCENE_FINISH.bloom.radius,SCENE_FINISH.bloom.threshold);
  const outputPass=new OutputPass();
  composer.addPass(renderPass);composer.addPass(networkPass);composer.addPass(bloomPass);composer.addPass(outputPass);
  const frames: {id:string; material:T.MeshStandardMaterial; active:boolean}[]=[];
  for (const segment of layout.ring.segments) {
    if(study.studyIds.has(segment.project.id)) continue;
    const active=segment.project.status==="active";
    const material=structural.clone(); material.color.set(active?0x110c08:0x050d16); material.emissive.set(active?0x462009:0x0e2639); material.emissiveIntensity=active?.45:.2;
    mesh(new T.ExtrudeGeometry(band(segment.startAngle,segment.endAngle,156.5,179.5),{depth:9,bevelEnabled:true,bevelSize:.65,bevelThickness:1.1,bevelSegments:2,curveSegments:24,steps:1}),material,-13);
    frames.push({id:segment.project.id,material,active});
    mesh(new T.ShapeGeometry(band(segment.startAngle+.25,segment.endAngle-.25,178,179)),active?glow:cool,-1);
    mesh(new T.ShapeGeometry(band(segment.startAngle+.25,segment.endAngle-.25,157,157.45)),cool,-1);
  }
  // Two continuous light paths. Layered additive halos have no metal reflections.
  const orbital: T.Group[]=[];
  const ringLightMaterials:T.ShaderMaterial[]=[];
  for (let i=0;i<2;i++) {
    const group=new T.Group();group.position.z=(5+i*2)*INNER_CORE_SCALE;group.scale.setScalar(INNER_CORE_SCALE);scene.add(group);orbital.push(group);
    for(const [tube,alpha] of [[.20,.68],[.55,.16],[1.0,.085],[1.7,.042],[2.6,.018]]) {
      const material=new T.ShaderMaterial({
        uniforms:{phase:{value:i*2.1},tint:{value:new T.Color(i===0?0xffcf7a:0xe5efff)},alpha:{value:alpha*.42}},
        vertexShader:`varying vec2 ringUv;
          void main(){ringUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`uniform float phase;uniform vec3 tint;uniform float alpha;varying vec2 ringUv;
          void main(){
            float flow=pow(0.5+0.5*cos(ringUv.x*6.2831853-phase),18.0);
            vec3 light=mix(tint,vec3(1.0,.98,.91),flow*.7);
            gl_FragColor=vec4(light*(.85+flow*.55),alpha);
          }`,
        transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,
      });
      ringLightMaterials.push(material);
      group.add(new T.Mesh(new T.TorusGeometry(84+i*10,tube,8,192),material));
    }
  }
  const orbitalDepthMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true});
  const orbitalDepth=orbital.map(ring=>{
    const proxy=new T.Mesh((ring.children[0] as T.Mesh).geometry,orbitalDepthMaterial);
    proxy.position.copy(ring.position);proxy.scale.copy(ring.scale);proxy.renderOrder=-1;
    networkScene.add(proxy);return proxy;
  });
  const voiceUniforms={energy:{value:0},presence:{value:0},phase:{value:0}};
  // Localized speech peaks lift off the intact amber orbital. Sharing its
  // transform makes the trace part of that orbit, rather than another ring.
  const voiceTrace=new T.Group();voiceTrace.visible=false;orbital[0].add(voiceTrace);
  for(const [width,opacity] of [[VOICE_SIGNATURE.coreWidth,VOICE_SIGNATURE.opacity],[VOICE_SIGNATURE.glowWidth,VOICE_SIGNATURE.glowOpacity]]){
    const material=new T.ShaderMaterial({
      uniforms:{...voiceUniforms,opacity:{value:opacity}},
      vertexShader:`uniform float energy;uniform float phase;varying float packet;varying float peak;
        void main(){
          float angle=uv.x*6.2831853;
          float travelingAngle=angle-phase*${VOICE_SIGNATURE.travelSpeed};
          packet=pow(.5+.5*cos(2.0*travelingAngle),5.0);
          peak=pow(.5+.5*sin(18.0*travelingAngle),6.0);
          float lift=.45+energy*${VOICE_SIGNATURE.amplitude.toFixed(1)}*packet*peak;
          vec3 p=position+vec3(cos(angle),sin(angle),0.0)*lift;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }`,
      fragmentShader:`uniform float energy;uniform float presence;uniform float opacity;varying float packet;varying float peak;
        void main(){
          vec3 amber=mix(vec3(1.0,.56,.19),vec3(1.0,.84,.53),peak*.4);
          gl_FragColor=vec4(amber*(1.35+energy*.5),presence*opacity*smoothstep(.02,.35,packet));
        }`,
      transparent:true,blending:T.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false,
    });
    voiceTrace.add(new T.Mesh(new T.TorusGeometry(84,width,6,384),material));
  }
  // Reuse one wave per orbital path; no per-frame allocations or React updates.
  const listeningWaves=orbital.map((ring,i)=>{
    const material=new T.MeshBasicMaterial({color:i===0?0xffcf7a:0xe5efff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
    const wave=mesh(new T.RingGeometry(.995,1,192),material,ring.position.z);
    wave.quaternion.copy(camera.quaternion);wave.visible=false;
    return {mesh:wave,material,radius:(84+i*10)*INNER_CORE_SCALE};
  });
  const transitionStarts=orbital.map(ring=>ring.quaternion.clone());
  const idleOrientation=new T.Quaternion(),idleEuler=new T.Euler();
  let listening=false,transition=1,listeningTime=0,orbitalTime=0,executing=false,operationAge=100,completionAge=100;
  let previousOperation:number|undefined,previousState="idle",executionTime=0,errorState=false,errorAge=100,ringFlowTime=0;
  const nodeGeometry=new T.SphereGeometry(1,10,8);
  const nodes: {mesh:T.Mesh; project:string; material:T.MeshStandardMaterial; base:number; z:number; period:number}[]=[];
  for (const n of layout.constellation.nodes) {
    const radius=Math.hypot(n.x-220,n.y-220),rawDepth=nodeDepth(n.id);
    const protection=T.MathUtils.smoothstep(radius,CONSTELLATION_DEPTH.protectedRadius,CONSTELLATION_DEPTH.foregroundRadius);
    const z=rawDepth>0?T.MathUtils.lerp(-4,rawDepth,protection):rawDepth, material=cool.clone(); volumeMaterial(material);material.emissive.set(0x96cfff);material.color.set(0xa4cddd);const depth=z/CONSTELLATION_DEPTH.range;
    material.metalness=0;material.roughness=.8;
    material.emissiveIntensity=CONSTELLATION_DEPTH.midIntensity+Math.abs(depth)*(depth<0?CONSTELLATION_DEPTH.rearIntensity-CONSTELLATION_DEPTH.midIntensity:CONSTELLATION_DEPTH.frontIntensity-CONSTELLATION_DEPTH.midIntensity);
    const m=mesh(nodeGeometry,material,z);networkScene.add(m);m.position.set(n.x-220,220-n.y,z);m.scale.setScalar(n.size*(1+Math.abs(depth)*(depth<0?CONSTELLATION_DEPTH.rearScale-1:CONSTELLATION_DEPTH.frontScale-1)));
    nodes.push({mesh:m,project:n.projectId,material,base:material.emissiveIntensity,z,period:CONSTELLATION_DEPTH.driftMinPeriod+(depth+1)*.5*CONSTELLATION_DEPTH.driftPeriodSpread});
  }
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=64;
  const haloContext=haloCanvas.getContext('2d')!;
  const haloGradient=haloContext.createRadialGradient(32,32,0,32,32,32);
  haloGradient.addColorStop(0,'rgba(180,218,255,.7)');haloGradient.addColorStop(.25,'rgba(160,206,255,.22)');haloGradient.addColorStop(1,'rgba(140,196,255,0)');
  haloContext.fillStyle=haloGradient;haloContext.fillRect(0,0,64,64);
  const haloTexture=new T.CanvasTexture(haloCanvas);haloTexture.colorSpace=T.SRGBColorSpace;
  const haloMaterial=new T.MeshBasicMaterial({map:haloTexture,transparent:true,opacity:CONSTELLATION_DEPTH.haloOpacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});volumeMaterial(haloMaterial);
  const halos=new T.InstancedMesh(new T.PlaneGeometry(1,1),haloMaterial,nodes.length);
  halos.instanceMatrix.setUsage(T.DynamicDrawUsage);halos.frustumCulled=false;networkScene.add(halos);
  const haloMatrix=new T.Matrix4(),haloScale=new T.Vector3();
  nodes.forEach((n,i)=>halos.setColorAt(i,new T.Color().setScalar(1+.45*n.z/CONSTELLATION_DEPTH.range)));
  const nodeMeshes=new Map(layout.constellation.nodes.map((n,i)=>[n.id,nodes[i].mesh]));
  function pos(p:{x:number;y:number;id?:string}) { return p.id&&nodeMeshes.has(p.id)?nodeMeshes.get(p.id)!.position:new T.Vector3(p.x-220,220-p.y,-6); }
  const depthLines:{attribute:T.BufferAttribute;colors:T.BufferAttribute;a:T.Vector3;b:T.Vector3;from:number;to:number}[]=[];
  function line(a:T.Vector3,b:T.Vector3,opacity:number,from=0,to=1) {
    const material=new T.LineBasicMaterial({color:BLUE,transparent:true,opacity,depthWrite:false,vertexColors:true});volumeMaterial(material);
    const geometry=new T.BufferGeometry().setFromPoints([a,b]);
    geometry.setAttribute('color',new T.Float32BufferAttribute([1,1,1,1,1,1],3).setUsage(T.DynamicDrawUsage));
    (geometry.getAttribute('position') as T.BufferAttribute).setUsage(T.DynamicDrawUsage);
    depthLines.push({attribute:geometry.getAttribute('position') as T.BufferAttribute,colors:geometry.getAttribute('color') as T.BufferAttribute,a,b,from,to});
    const connection=new T.Line(geometry,material);connection.frustumCulled=false;networkScene.add(connection);
  }
  for (const edge of layout.constellation.treeEdges) line(pos(edge.from),pos(edge.to),edge.depth<=1?SCENE_FINISH.network.treeOpacity*.6:SCENE_FINISH.network.treeOpacity);
  for (const edge of layout.constellation.crossProjectEdges) for(const piece of edge.pieces){
    const dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y,lengthSquared=dx*dx+dy*dy;
    const fraction=(p:{x:number;y:number})=>lengthSquared?((p.x-edge.from.x)*dx+(p.y-edge.from.y)*dy)/lengthSquared:0;
    line(pos(edge.from),pos(edge.to),SCENE_FINISH.network.crossOpacity,fraction(piece.from),fraction(piece.to));
  }
  const signalLight=new T.MeshBasicMaterial({color:new T.Color(2.2,2.2,2.2),toneMapped:false});
  volumeMaterial(signalLight);
  const signalGeometry=new T.SphereGeometry(1.2,10,8);
  const signal=mesh(signalGeometry,signalLight,0);
  const executionSignals=Array.from({length:Math.ceil(EXECUTING_MOTION.launchesPerSecond*EXECUTING_MOTION.transitSeconds)},()=>{
    const orb=mesh(signalGeometry,signalLight,0);orb.visible=false;return orb;
  });
  let frame: number | undefined, timer: number | undefined;
  let stopped=false, time=0, previous=0;
  const lost=(event:Event)=>{event.preventDefault();fail("Graphics context lost.");};canvas.addEventListener("webglcontextlost",lost);
  let renderWidth=0,renderHeight=0;
  const resize=()=>{const {width,height}=host.getBoundingClientRect();if(width<=0||height<=0||(width===renderWidth&&height===renderHeight))return;renderWidth=width;renderHeight=height;renderer.setSize(width,height,false);composer.setSize(width,height);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let announced=false, lastSignature="", lastStats=0, renderCount=0;
  function render(now:number) {
    if(stopped)return;
    frame=undefined;timer=undefined;
    const value=current(), moving=value.running&&document.visibilityState==="visible";
    const delta=moving&&previous?Math.min((now-previous)/1000,.05):0;
    if(moving)pointer.lerp(pointerTarget,1-Math.exp(-delta*CONSTELLATION_DEPTH.parallaxResponse));
    else {pointer.set(0,0);pointerTarget.set(0,0);}
    time+=delta;previous=now;
    orbitalTime+=value.state==="error"?0:delta*(value.state==="thinking"?14:1);
    if(value.state!=="error")ringFlowTime+=delta;
    const nextError=value.state==="error";
    errorAge=nextError?(errorState?errorAge+delta:0):100;
    const nextExecuting=value.state==="executing";
    executionTime=nextExecuting?(executing?executionTime+delta:0):0;
    operationAge+=delta;completionAge+=delta;
    if(nextExecuting&&executing&&value.execution?.operation!==undefined&&previousOperation!==undefined&&value.execution.operation!==previousOperation)operationAge=0;
    if(value.state==="complete"&&previousState!=="complete")completionAge=0;
    previousOperation=value.execution?.operation;previousState=value.state;
    const operationPulse=moving&&nextExecuting&&operationAge<.65?Math.sin(Math.PI*operationAge/.65)**2:0;
    const nextListening=value.state==="listening";
    if(nextListening!==listening||nextExecuting!==executing||nextError!==errorState){
      listening=nextListening;executing=nextExecuting;errorState=nextError;transition=0;listeningTime=0;
      orbital.forEach((ring,i)=>transitionStarts[i].copy(ring.quaternion));
    }
    transition=moving?Math.min(1,transition+delta/LISTENING_RINGS.transitionSeconds):1;
    const ease=transition*transition*(3-2*transition);
    orbital.forEach((ring,i)=>{
      idleOrientation.setFromEuler(idleEuler.set(orbitalTime*(i%2?-.22:.28)+i*.8,orbitalTime*.16+i*.65,i*.9));
      if(executing)idleOrientation.setFromEuler(idleEuler.set(.32+i*.22+orbitalTime*.28*EXECUTING_MOTION.rotationSpeed,.28+i*.18+orbitalTime*.16*EXECUTING_MOTION.rotationSpeed,orbitalTime*.20+i*Math.PI));
      if(errorState)idleOrientation.setFromEuler(idleEuler.set(i===0?.55:-.48,i===0?-.65:.65,i*.7));
      ring.quaternion.copy(transitionStarts[i]).slerp(listening?camera.quaternion:idleOrientation,ease);
      orbitalDepth[i].quaternion.copy(ring.quaternion);
    });
    if(listening&&transition===1)listeningTime+=delta;
    listeningWaves.forEach((wave,index)=>{
      const completing=value.state==="complete"&&completionAge<1.6;
      const age=listeningTime%LISTENING_RINGS.waveInterval,progress=completing?completionAge/1.6:age/LISTENING_RINGS.waveDuration;
      wave.mesh.visible=moving&&(completing?index===1:listening&&transition===1&&progress<1);
      if(wave.mesh.visible){
        wave.mesh.scale.setScalar(wave.radius+LISTENING_RINGS.waveTravel*progress);
        wave.material.opacity=LISTENING_RINGS.waveOpacity*Math.sin(Math.PI*progress)**2;
      }
    });
    canvas.dataset.listeningOpen=String(listening&&transition===1);
    canvas.dataset.listeningWaves=String(listeningWaves.filter(wave=>wave.mesh.visible).length);
    ringLightMaterials.forEach((material,i)=>{material.uniforms.phase.value=ringFlowTime*.48+Math.floor(i/5)*2.1;});
    const energy=value.state==="speaking"?(moving?Math.min(1,Math.max(0,value.voiceLevel)):.15):value.state==="thinking"?.35:value.state==="listening"?.22:executing?.18+operationPulse*.3:0;
    field.update(energy);
    const speechTarget=value.state==='speaking'?energy:0;
    const voiceResponse=speechTarget>voiceUniforms.energy.value?VOICE_SIGNATURE.attackSeconds:VOICE_SIGNATURE.releaseSeconds;
    const voicePresence=value.state==='speaking'?1:0;
    const fadeSeconds=voicePresence?VOICE_SIGNATURE.fadeInSeconds:VOICE_SIGNATURE.fadeOutSeconds;
    if(moving){
      voiceUniforms.energy.value+=(speechTarget-voiceUniforms.energy.value)*(1-Math.exp(-delta/voiceResponse));
      voiceUniforms.presence.value+=(voicePresence-voiceUniforms.presence.value)*(1-Math.exp(-delta/fadeSeconds));
      voiceUniforms.phase.value+=delta*VOICE_SIGNATURE.phaseSpeed*(.7+voiceUniforms.energy.value*.3);
    }else {voiceUniforms.energy.value=speechTarget;voiceUniforms.presence.value=voicePresence;}
    voiceTrace.visible=voiceUniforms.presence.value>.005&&value.state!=="error";
    canvas.dataset.voiceSignature=String(voiceUniforms.presence.value>.005);
    canvas.dataset.voiceSignatureEnergy=String(voiceUniforms.energy.value);
    glow.emissiveIntensity=.23+(moving?Math.sin(time*.8)*.06:0)+energy*.55;
    study.update(time, energy, moving, value.hoverProject, value.state==="idle", value.state==="speaking", executing, executing||errorState?value.execution?.projectId:undefined, operationPulse, value.state==="complete", errorState?errorAge:-1);
    glow.color.set(value.state==="error"?0xe57854:ORANGE);
    frames.forEach(f=>{f.material.emissiveIntensity=value.hoverProject===f.id?1.1:f.active?.45:.2;});
    nodes.forEach((n,i)=>{n.mesh.position.z=n.z+(moving?Math.sin(time*Math.PI*2/n.period+i*2.4)*CONSTELLATION_DEPTH.driftAmount:0);n.material.emissiveIntensity=n.base+(value.hoverProject===n.project?.6:0)+(moving?Math.sin(time*.35+i)*.07:0);});
    nodes.forEach((n,i)=>{
      const depth=n.z/CONSTELLATION_DEPTH.range;
      haloScale.setScalar(n.mesh.scale.x*(depth<0?5.8:5.0));
      haloMatrix.compose(n.mesh.position,camera.quaternion,haloScale);halos.setMatrixAt(i,haloMatrix);
    });
    halos.instanceMatrix.needsUpdate=true;
    for(const connection of depthLines){
      const {attribute,colors,a,b,from,to}=connection;
      attribute.setXYZ(0,a.x+(b.x-a.x)*from,a.y+(b.y-a.y)*from,a.z+(b.z-a.z)*from);
      attribute.setXYZ(1,a.x+(b.x-a.x)*to,a.y+(b.y-a.y)*to,a.z+(b.z-a.z)*to);
      attribute.needsUpdate=true;
      for(let i=0;i<2;i++){
        const depth=T.MathUtils.clamp(attribute.getZ(i)/CONSTELLATION_DEPTH.range,-1,1);
        const intensity=1+Math.abs(depth)*(depth<0?CONSTELLATION_DEPTH.rearLine-1:CONSTELLATION_DEPTH.frontLine-1);
        colors.setXYZ(i,intensity,intensity,intensity);
      }
      colors.needsUpdate=true;
    }
    const edges=executing?layout.constellation.treeEdges.filter(edge=>edge.to.projectId===value.execution?.projectId):layout.constellation.treeEdges;
    signal.visible=!errorState&&!executing&&moving&&edges.length>0&&time%4.5<2;
    const launch=Math.floor(executionTime*EXECUTING_MOTION.launchesPerSecond);
    executionSignals.forEach((orb,index)=>{
      const event=launch-index,age=executionTime-event/EXECUTING_MOTION.launchesPerSecond;
      orb.visible=executing&&moving&&edges.length>0&&event>=0&&age<EXECUTING_MOTION.transitSeconds;
      if(orb.visible){
        const edge=edges[event%edges.length];
        orb.position.copy(pos(edge.to)).lerp(pos(edge.from),age/EXECUTING_MOTION.transitSeconds);
      }
    });
    canvas.dataset.executionSignals=String(executionSignals.filter(orb=>orb.visible).length);
    if(signal.visible){const e=edges[Math.floor(time/4.5)%edges.length];signal.position.copy(pos(executing?e.to:e.from)).lerp(pos(executing?e.from:e.to),(time%4.5)/2);}
    const signature = `${value.state}/${moving?value.voiceLevel:0}/${value.hoverProject}/${canvas.width}/${canvas.height}/${value.running}`;
    try { if(document.visibilityState==="visible" && host.getBoundingClientRect().width>0 && (moving || signature !== lastSignature)) { renderer.info.reset();composer.render(); renderCount++; lastSignature=signature; } }
    catch { fail("Rendering stopped unexpectedly."); return; }
    if(!announced && renderCount){announced=true;ready();}
    if(now-lastStats>500){lastStats=now;canvas.dataset.rings=String(orbital.filter(r=>r.visible).length);canvas.dataset.frames=String(renderCount);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.nodes=String(nodes.length);canvas.dataset.parallax=JSON.stringify([pointer.x,pointer.y]);}
    // One loop; no React updates per frame. Hidden and reduced-motion views render only on changes.
    if(moving)frame=requestAnimationFrame(render);
    else timer=window.setTimeout(()=>render(performance.now()),250);
  }
  frame=requestAnimationFrame(render);
  return ()=>{stopped=true;interaction.removeEventListener('pointermove',movePointer);interaction.removeEventListener('pointerleave',resetPointer);window.removeEventListener('blur',resetPointer);if(frame!==undefined)cancelAnimationFrame(frame);if(timer!==undefined)clearTimeout(timer);observer.disconnect();canvas.removeEventListener("webglcontextlost",lost);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    for(const root of [scene,networkScene])root.traverse(o=>{const drawable=o as T.Mesh;if(drawable.geometry)geometries.add(drawable.geometry);if(drawable.material)(Array.isArray(drawable.material)?drawable.material:[drawable.material]).forEach(m=>materials.add(m));});
    halos.dispose();haloTexture.dispose();
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose()); structural.dispose();cool.dispose();glow.dispose();study.dispose();bloomPass.dispose();outputPass.dispose();composer.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  };
}
