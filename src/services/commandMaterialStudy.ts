import * as T from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { INNER_CORE_SCALE, type CommandLayout } from "./hybridCore";

export const ACTIVE_PROJECT = { edgeIntensity:1.15, internalWarmth:.006, tracerDuration:2.8, tracerInterval:7 };
export const FRONT_GLASS = { opacity:.24, roughness:.10, reflectionGain:2.1, reflectionFloor:.16, grazingGain:1.8 };
export const PROJECT_GLASS = {
  transmission:0, opacity:.22, roughness:.16, metalness:0,
  ior:1.38, thickness:7, clearcoat:.25, clearcoatRoughness:.18,
  bevelOpacity:.55, bevelReflection:1.1,
  reflection:.7, attenuation:0x536a7b, attenuationDistance:18,
  rimOpacity:.035, activeRimBoost:.035, hoverRimBoost:.07,
  inactiveChannel:.045, activeChannel:.18,
  backingColor:0x07111a, backingDetailOpacity:.10, surfaceReflection:.4,
};
export const MATERIAL_TUNING = {
  glassOpacity: .10, glassRoughness: .12, glassReflection: .18,
  activeEmission: .03, inactiveEmission: .018, edgeOpacity: .22,
  coreEmission: 1.65, haloOpacity: .58,
  breathSeconds: 5.3, breathGain: .13,
  heartbeatIntervals: [11.7,14.2,12.6,14.8],
  heartbeatPrimary: .12, heartbeatSecondary: .055,
  rippleOpacity: .045, rippleStart: 57, rippleEnd: 140,
  localLight: 85, radialHalo: .18,
  structurePrimary: .38, structureSecondary: .12,
};
// Idle-only motion profile. Other system states retain their existing behavior.
export const OMEGA_SPEECH = { scaleGain:.182, attackSeconds:.045, releaseSeconds:.20 };
export const OMEGA_IDLE = {
  breathDuration:5.6, breathStrength:.13, haloBreathMin:.75, haloBreathMax:1.45,
  heartbeatMinInterval:10.5, heartbeatMaxInterval:14.8,
  primaryStrength:.13, primaryDuration:.8,
  secondaryStrength:.055, secondaryDelay:1.02, secondaryDuration:.6,
  rippleDelay:.8, rippleDuration:2.2, rippleStrength:.032,
  rippleStart:57, rippleEnd:118, haloExpansion:.009, localLightBoost:1.15,
};
const smoothStep5=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
export function createIdleCoreCycle(random:()=>number=Math.random){
  const t=OMEGA_IDLE;
  const interval=()=>t.heartbeatMinInterval+Math.max(0,Math.min(1,random()))*(t.heartbeatMaxInterval-t.heartbeatMinInterval);
  let elapsed=0,lastPulse=-100,nextPulse=interval();
  return (delta:number,moving:boolean)=>{
    if(!moving)return {envelope:1,breath:0,pulse:0,ripple:0,rippleProgress:0};
    elapsed+=Math.max(0,delta);
    while(elapsed>=nextPulse){lastPulse=nextPulse;nextPulse+=interval();}
    const phase=(elapsed%t.breathDuration)/t.breathDuration;
    // Slow asymmetric rise and longer release, with zero velocity at both ends.
    const breath=phase<.43?smoothStep5(phase/.43):1-smoothStep5((phase-.43)/.57);
    const age=elapsed-lastPulse;
    const pulseShape=(age:number,duration:number)=>{
      if(age<0||age>=duration)return 0;
      const phase=age/duration;
      return phase<.4?smoothStep5(phase/.4):1-smoothStep5((phase-.4)/.6);
    };
    const pulse=t.primaryStrength*pulseShape(age,t.primaryDuration)+t.secondaryStrength*pulseShape(age-t.secondaryDelay,t.secondaryDuration);
    const rippleProgress=(age-t.rippleDelay)/t.rippleDuration;
    const ripple=rippleProgress>0&&rippleProgress<1?Math.sin(Math.PI*rippleProgress)**2*t.rippleStrength:0;
    return {envelope:1+t.breathStrength*breath+pulse,breath,pulse,ripple,rippleProgress};
  };
}
const heartbeatPeriod=MATERIAL_TUNING.heartbeatIntervals.reduce((a,b)=>a+b,0);
export function heartbeatAge(time:number){
  const phase=time%heartbeatPeriod;
  let event=0,previous=time>=heartbeatPeriod?0:-100;
  for(const interval of MATERIAL_TUNING.heartbeatIntervals){event+=interval;if(event<=phase)previous=event;}
  return phase-previous;
}
export function coreGlowEnvelope(time:number,moving:boolean) {
  if(!moving)return 1;
  const t=MATERIAL_TUNING,age=heartbeatAge(time);
  const breath=.5-.5*Math.cos(time*Math.PI*2/t.breathSeconds);
  const primary=age>=0&&age<.65?Math.sin(Math.PI*age/.65)**2:0;
  const secondary=age>=.95&&age<1.4?Math.sin(Math.PI*(age-.95)/.45)**2:0;
  return 1+t.breathGain*breath+t.heartbeatPrimary*primary+t.heartbeatSecondary*secondary;
}

// Exact non-3D glyph: Times New Roman regular, 150px, centered, baseline +52.
// Cinzel has no Greek coverage; the original SVG uses this fallback for U+03A9.
const OMEGA = "M-51.3427734375 29.0751953125H-48.6328125Q-48.33984375 34.275390625 -45.556640625 36.326171875Q-42.7734375 38.376953125 -36.6943359375 38.376953125H-16.69921875L-16.845703125 33.4697265625Q-28.4912109375 31.1259765625 -38.0859375 20.505859375Q-47.6806640625 9.8857421875 -47.6806640625 -6.30078125Q-47.6806640625 -24.2451171875 -34.31396484375 -36.916015625Q-20.947265625 -49.5869140625 0.5859375 -49.5869140625Q21.4599609375 -49.5869140625 34.716796875 -37.61181640625Q47.9736328125 -25.63671875 47.9736328125 -6.9599609375Q47.9736328125 8.201171875 39.73388671875 18.78466796875Q31.494140625 29.3681640625 17.431640625 33.4697265625L16.69921875 38.376953125H37.060546875Q44.0185546875 38.376953125 46.25244140625 35.740234375Q48.486328125 33.103515625 48.6328125 29.0751953125H51.3427734375V52.0H10.3271484375L12.2314453125 29.880859375Q31.1279296875 23.9482421875 31.1279296875 -5.0556640625Q31.1279296875 -24.025390625 21.86279296875 -34.1328125Q12.59765625 -44.240234375 0.146484375 -44.240234375Q-13.1103515625 -44.240234375 -21.78955078125 -33.51025390625Q-30.46875 -22.7802734375 -30.46875 -6.0810546875Q-30.46875 6.00390625 -26.5869140625 15.92822265625Q-22.705078125 25.8525390625 -11.71875 29.880859375L-10.3271484375 52.0H-51.3427734375Z";
const polar = (a:number,r:number) => new T.Vector2(Math.sin(a*Math.PI/180)*r,Math.cos(a*Math.PI/180)*r);
function annulus(start:number,end:number,inner:number,outer:number) {
  const shape=new T.Shape(), steps=Math.ceil((end-start)*4);
  for(let i=0;i<=steps;i++){const p=polar(start+(end-start)*i/steps,outer);i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y);}
  for(let i=steps;i>=0;i--){const p=polar(start+(end-start)*i/steps,inner);shape.lineTo(p.x,p.y);}
  shape.closePath();return shape;
}
function engravedTexture() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;
  const c=canvas.getContext("2d")!;c.fillStyle="#191919";c.fillRect(0,0,1024,1024);
  let seed=713;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  c.lineWidth=.6;c.strokeStyle="#151515";
  for(let x=0;x<1024;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,1024);c.moveTo(0,x);c.lineTo(1024,x);c.stroke();}
  for(let i=0;i<380;i++){
    const x=random()*1024,y=random()*1024,w=4+random()*80,h=3+random()*28;
    c.strokeStyle=i%9===0?"#dedede":"#717171";c.lineWidth=i%9===0?1.2:.6;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.lineTo(x+w+h,y+h);c.lineTo(x+w+h+random()*15,y+h);c.stroke();
    if(i%5===0){c.fillStyle="#989898";c.fillRect(x,y,2,2);}
  }
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.repeat.set(1/128,1/128);texture.offset.set(.5,.5);texture.colorSpace=T.SRGBColorSpace;
  return texture;
}
function contourTexture() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;const c=canvas.getContext("2d")!;
  c.scale(1024/160,1024/160);c.translate(80,80);
  const path=new Path2D(OMEGA);
  c.strokeStyle="#ff7a12";c.shadowColor="#ff7a12";c.shadowBlur=35;c.lineWidth=1.05;c.stroke(path);
  c.shadowBlur=12;c.lineWidth=.55;c.strokeStyle="#ffb854";c.stroke(path);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

/** Builds the representative finish, independent of project truth and interaction. */
export function buildCommandMaterialStudy(scene:T.Scene,renderer:T.WebGLRenderer,layout:CommandLayout) {
  const environment=new RoomEnvironment(), pmrem=new T.PMREMGenerator(renderer);
  const environmentTarget=pmrem.fromScene(environment,.04);scene.environment=environmentTarget.texture;scene.environmentIntensity=.48;
  environment.dispose();pmrem.dispose();
  const engraving=engravedTexture(), contour=contourTexture();
  const frameMetal=new T.MeshPhysicalMaterial({color:0x1c303f,metalness:.85,roughness:.25,envMapIntensity:.55,clearcoat:.4});
  const dark=new T.MeshStandardMaterial({color:0x070d15,metalness:.7,roughness:.42});
  const lines=new T.LineBasicMaterial({color:0x547891,transparent:true,opacity:MATERIAL_TUNING.structureSecondary});
  const warmLines=new T.LineBasicMaterial({color:0xffa13d,transparent:true,opacity:.8,toneMapped:false});
  const group=new T.Group();group.name="Command material study";scene.add(group);
  const mesh=(geometry:T.BufferGeometry,material:T.Material|T.Material[],z:number)=>{const m=new T.Mesh(geometry,material);m.position.z=z;group.add(m);return m;};
  const extrude=(shape:T.Shape|T.Shape[],depth:number,bevel=.4,curveSegments=64)=>new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:6,curveSegments});
  const coreStart=group.children.length;
  const shapes=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${OMEGA}"/></svg>`).paths.flatMap(path=>path.toShapes());
  const body=extrude(shapes,7,.65);body.scale(1,-1,1);body.setIndex(Array.from({length:body.getAttribute('position').count},(_,i)=>i%3===1?i+1:i%3===2?i-1:i));
  const face=new T.MeshPhysicalMaterial({color:0x6c3611,metalness:.25,roughness:.36,envMapIntensity:.3,clearcoat:.5,clearcoatRoughness:.14,transmission:0,thickness:2.5,ior:1.48,emissive:0xd87520,emissiveMap:engraving,emissiveIntensity:1.8});
  const side=new T.MeshPhysicalMaterial({color:0x38261b,metalness:.88,roughness:.23,clearcoat:.5});
  mesh(body,[face,side],3);
  for(const shape of shapes){
    const points=shape.getPoints(128).map(p=>new T.Vector3(p.x,-p.y,10.75));
    const outline=new T.LineLoop(new T.BufferGeometry().setFromPoints(points),warmLines);group.add(outline);
    // Inset dark side seam makes thickness readable without changing the screen-plane glyph.
    const back=new T.LineLoop(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p.x+.7,p.y-.7,3))),lines);group.add(back);
  }
  const haloMaterial=new T.MeshBasicMaterial({map:contour,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  mesh(new T.PlaneGeometry(160,160),haloMaterial,11.2);
  const glyph=new T.Group();
  for(const child of group.children.slice(coreStart))glyph.add(child);
  group.add(glyph);
  const radialMaterial=new T.ShaderMaterial({
    uniforms:{intensity:{value:.13},tint:{value:new T.Vector3(1,.25,.035)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float intensity;uniform vec3 tint;void main(){float r=length(vUv-.5)*2.;float glow=pow(max(0.,1.-r),3.);gl_FragColor=vec4(tint,glow*intensity);}`,
  });
  const radialHalo=mesh(new T.PlaneGeometry(220,220),radialMaterial,-15);
  const coreLight=new T.PointLight(0xff8c36,70,150,1);coreLight.position.set(0,0,28);group.add(coreLight);
  const core=new T.Group();
  for(const child of group.children.slice(coreStart))core.add(child);
  core.scale.setScalar(INNER_CORE_SCALE);group.add(core);
  // The selected study section follows the existing map, never an independently arranged scene.
  const studyIds=new Set(layout.ring.segments.map(segment=>segment.project.id));
  // The chassis and energy channel surround an open gap outside the cassettes.
  const chassis=new T.MeshPhysicalMaterial({color:0x314450,metalness:.82,roughness:.22,envMapIntensity:1.4,clearcoat:.12,clearcoatRoughness:.3});
  const chassisSides=new T.MeshStandardMaterial({color:0x0d1822,metalness:.78,roughness:.22,envMapIntensity:1.05});
  const channelBed=new T.MeshStandardMaterial({color:0x03070c,metalness:.25,roughness:.62});
  const circularBand=(inner:number,outer:number)=>{
    const shape=new T.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);
    const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
    return shape;
  };
  // Keep the outside silhouette and front plane fixed; deepen only toward the rear.
  // Separate cap/side materials reveal the recess without another outline or mesh.
  const primaryGeometry=new T.ExtrudeGeometry(circularBand(198,205),{depth:8,steps:1,bevelEnabled:true,bevelSize:.45,bevelThickness:.45,bevelSegments:6,curveSegments:256});
  const primary=mesh(primaryGeometry,[chassis,chassisSides],-12);
  primary.name="Primary structural band";
  mesh(extrude(circularBand(192,193),1,.12,256),channelBed,-10);
  // Long, asymmetrically spaced light sources remain within the existing channel.
  const energySections=[
    {start:12,end:48,gain:3.2,warm:true},
    {start:91,end:132,gain:2.6,warm:true},
    {start:196,end:224,gain:2.9,warm:true},
    {start:280,end:311,gain:2.4,warm:true},
    {start:153,end:173,gain:1.1,warm:false},
    {start:331,end:351,gain:1.25,warm:false},
  ];
  for(const {start,end,gain,warm} of energySections){
    const hotspot=.28+.1*Math.sin(start*.071);
    const secondaryHotspot=.7+.08*Math.cos(start*.053);
    const railLight=new T.MeshStandardMaterial({color:0x080e14,emissive:warm?0xff821e:0x9dcced,emissiveIntensity:gain*1.15,metalness:.2,roughness:.34});
    railLight.onBeforeCompile=shader=>{
      shader.uniforms.channelStart={value:start};shader.uniforms.channelSpan={value:end-start};
      shader.uniforms.channelWarm={value:warm?1:0};
      shader.uniforms.channelHotspot={value:hotspot};shader.uniforms.channelSecondary={value:secondaryHotspot};
      shader.vertexShader='varying vec2 energyPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nenergyPosition=position.xy;');
      shader.fragmentShader='varying vec2 energyPosition; uniform float channelStart,channelSpan,channelWarm,channelHotspot,channelSecondary;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float along=clamp(mod(degrees(atan(energyPosition.x,energyPosition.y))-channelStart+360.,360.)/channelSpan,0.,1.);
        float across=abs(length(energyPosition)-192.5)/.42;
        float core=exp(-pow(across/mix(.27,.34,channelWarm),2.));
        float shoulder=mix(.08,.16,channelWarm)*exp(-pow(across/mix(.56,.76,channelWarm),2.));
        float ends=smoothstep(0.,.13,along)*smoothstep(0.,.17,1.-along);
        float primaryLobe=exp(-pow((along-channelHotspot)/.15,2.));
        float secondaryLobe=exp(-pow((along-channelSecondary)/.22,2.));
        float sourceBalance=.56+.46*primaryLobe+.24*secondaryLobe;
        totalEmissiveRadiance*= (core+shoulder)*ends*sourceBalance;
      `);
    };
    railLight.customProgramCacheKey=()=> 'contained-energy-channel-v2';
    mesh(new T.ShapeGeometry(annulus(start,end,192.08,192.92)),railLight,-8.8);
    const position=polar(start+(end-start)*hotspot,195);
    const spill=new T.PointLight(warm?0xff942e:0xafd6ef,(warm?18:13)*gain,15,1.5);
    spill.position.set(position.x,position.y,-5);group.add(spill);
  }
  const rippleMaterial=new T.MeshBasicMaterial({color:0xffab54,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const ripple=mesh(new T.RingGeometry(.995,1,256),rippleMaterial,-8);
  const tabHousing=frameMetal.clone();tabHousing.color.set(0x152736);tabHousing.roughness=.3;tabHousing.envMapIntensity=.65;
  const endCapMaterial=new T.MeshStandardMaterial({color:0x12212c,metalness:.65,roughness:.34,envMapIntensity:.48});
  const activeChannels:T.ShaderMaterial[]=[];
  // A shared high-resolution engraving atlas lives below the front glass plane.
  const labelAtlas=document.createElement('canvas');labelAtlas.width=labelAtlas.height=2048;
  const labelContext=labelAtlas.getContext('2d')!;
  const atlasScale=2048/440;labelContext.scale(atlasScale,atlasScale);
  labelContext.textAlign='center';labelContext.textBaseline='middle';
  for(const segment of layout.ring.segments){
    const active=segment.project.status==='active';
    const fontSize=(active?11.5:10)/Math.max(layout.labelScale,.01);
    labelContext.font=`500 ${fontSize}px "JetBrains Mono"`;
    const spacing=fontSize*.09,advance=labelContext.measureText('M').width+spacing;
    const capacity=Math.floor(((segment.endAngle-segment.startAngle)*Math.PI*168/180-12)/(fontSize*.62));
    const original=segment.project.name.toUpperCase();
    const name=original.length<=capacity?original:original.slice(0,Math.max(0,capacity-1))+'…';
    const flipped=segment.midAngle>90&&segment.midAngle<270;
    labelContext.fillStyle=active?'#f2bc74':'#ddb17a';
    Array.from(name).forEach((letter,i)=>{
      const offset=(i-(name.length-1)/2)*advance/168;
      const angle=segment.midAngle*Math.PI/180+(flipped?-offset:offset);
      labelContext.save();labelContext.translate(220+Math.sin(angle)*168,220-Math.cos(angle)*168);
      labelContext.rotate(angle+(flipped?Math.PI:0));labelContext.fillText(letter,0,0);labelContext.restore();
    });
  }
  const labelTexture=new T.CanvasTexture(labelAtlas);labelTexture.colorSpace=T.SRGBColorSpace;
  labelTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const engravingLabel=mesh(new T.PlaneGeometry(440,440),new T.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false}),-2);
  engravingLabel.name='Internal glass lettering';engravingLabel.renderOrder=19;
  const diffusionCanvas=document.createElement('canvas');diffusionCanvas.width=diffusionCanvas.height=2048;
  const diffusionContext=diffusionCanvas.getContext('2d')!;
  diffusionContext.filter=`blur(${atlasScale*.32}px)`;diffusionContext.drawImage(labelAtlas,0,0);
  const diffusionTexture=new T.CanvasTexture(diffusionCanvas);diffusionTexture.colorSpace=T.SRGBColorSpace;
  const diffusionLabel=mesh(new T.PlaneGeometry(440,440),new T.MeshBasicMaterial({map:diffusionTexture,transparent:true,opacity:.16,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),-2.2);
  diffusionLabel.name='Subsurface lettering diffusion';diffusionLabel.renderOrder=18;
  const panels:{id:string;face:T.MeshPhysicalMaterial;active:boolean;rim:T.LineBasicMaterial}[]=[];
  for(const segment of layout.ring.segments){
    if(!studyIds.has(segment.project.id))continue;
    const {startAngle:a,endAngle:b}=segment,active=segment.project.status==='active';
    // One polished glass volume replaces the stacked rails, ribs and fasteners.
    const glass=new T.MeshPhysicalMaterial({
      color:0x284454,metalness:PROJECT_GLASS.metalness,roughness:PROJECT_GLASS.roughness,
      transparent:true,depthWrite:false,opacity:PROJECT_GLASS.opacity,envMapIntensity:PROJECT_GLASS.reflection,
      clearcoat:PROJECT_GLASS.clearcoat,clearcoatRoughness:PROJECT_GLASS.clearcoatRoughness,
      transmission:PROJECT_GLASS.transmission,thickness:PROJECT_GLASS.thickness,ior:PROJECT_GLASS.ior,
      attenuationColor:new T.Color(PROJECT_GLASS.attenuation),attenuationDistance:PROJECT_GLASS.attenuationDistance,
      emissive:0x000000,emissiveIntensity:0,
    });
    // Broad optical surface variation breaks up flat reflections without a texture/noise layer.
    glass.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(.035*sin(vViewPosition.x*.025), .025*cos(vViewPosition.y*.022), 0.0));');
      shader.uniforms.glassReflectionGain={value:FRONT_GLASS.reflectionGain};
      shader.uniforms.glassGrazingGain={value:FRONT_GLASS.grazingGain};
      shader.uniforms.glassReflectionFloor={value:FRONT_GLASS.reflectionFloor};
      shader.fragmentShader='uniform float glassReflectionGain; uniform float glassGrazingGain; uniform float glassReflectionFloor;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
        'vec3 glassView=normalize(vViewPosition);\nfloat grazing=pow(1.0-clamp(abs(dot(normal,glassView)),0.0,1.0),2.0);\nvec3 reflectedView=reflect(-glassView,normal);\nfloat environmentLobe=pow(max(0.0,dot(reflectedView,normalize(vec3(-.35,.55,.76)))),12.0);\nfloat softReflection=exp(-pow((vViewPosition.x*.7+vViewPosition.y*.4-35.)/55.,2.))*.55+environmentLobe*.45;\nsoftReflection = sqrt(softReflection*softReflection+glassReflectionFloor*glassReflectionFloor)/sqrt(1.0+glassReflectionFloor*glassReflectionFloor);\noutgoingLight = mix(outgoingLight, reflectedLight.directSpecular + reflectedLight.indirectSpecular, .85);\noutgoingLight += vec3(.18,.25,.3)*softReflection*glassReflectionGain*(.65+glassGrazingGain*grazing);\n#include <opaque_fragment>');
    };
    glass.customProgramCacheKey=()=>"olympus-glass-soft-reflection-v6";
    // Open-backed housing: only the perimeter is solid, preserving the glass window.
    const mountingFrame=annulus(a+.16,b-.16,155.2,180.8);
    mountingFrame.holes.push(new T.Path(annulus(a+.3,b-.3,156.1,179.9).getPoints()));
    const mountingGeometry=extrude(mountingFrame,10,.12);
    const mountingPositions=mountingGeometry.getAttribute('position');
    const distanceToEnd=(x:number,y:number)=>{
      const angle=(Math.atan2(x,y)*180/Math.PI-a+720)%360;
      return Math.min(angle,Math.abs(b-a-angle),360-angle);
    };
    // Sink only the end-cap region; the long supporting rails retain their depth.
    for(let i=0;i<mountingPositions.count;i++){
      const d=distanceToEnd(mountingPositions.getX(i),mountingPositions.getY(i));
      const recess=1-T.MathUtils.smoothstep(d,.3,.75);
      mountingPositions.setZ(i,mountingPositions.getZ(i)-2.2*recess);
    }
    mountingGeometry.clearGroups();
    let groupStart=0,groupMaterial=-1;
    for(let i=0;i<mountingPositions.count;i+=3){
      const x=(mountingPositions.getX(i)+mountingPositions.getX(i+1)+mountingPositions.getX(i+2))/3;
      const y=(mountingPositions.getY(i)+mountingPositions.getY(i+1)+mountingPositions.getY(i+2))/3;
      const materialIndex=distanceToEnd(x,y)<.6?1:0;
      if(materialIndex!==groupMaterial){
        if(i>groupStart)mountingGeometry.addGroup(groupStart,i-groupStart,groupMaterial);
        groupStart=i;groupMaterial=materialIndex;
      }
    }
    mountingGeometry.addGroup(groupStart,mountingPositions.count-groupStart,groupMaterial);
    mountingGeometry.computeVertexNormals();
    mesh(mountingGeometry,[tabHousing,endCapMaterial],-13);
    // Existing bevel/side faces catch more light than the front pane.
    const bevelGlass=glass.clone();bevelGlass.opacity=PROJECT_GLASS.bevelOpacity;
    bevelGlass.envMapIntensity=PROJECT_GLASS.bevelReflection*1.15;bevelGlass.roughness=.08;
    // Front-only tuning after the bevel clone: construction and edge material stay fixed.
    glass.opacity=FRONT_GLASS.opacity;glass.roughness=FRONT_GLASS.roughness;
    const pane=mesh(extrude(annulus(a+.3,b-.3,156.1,179.9),7,.4),[glass,bevelGlass],-8);
    // Render after transparent network links, which Three's transmission buffer omits.
    pane.renderOrder=20;
    const backGlass=new T.MeshBasicMaterial({color:PROJECT_GLASS.backingColor});
    if(active){
      backGlass.onBeforeCompile=shader=>{
        shader.uniforms.activeWarmth={value:ACTIVE_PROJECT.internalWarmth};
        shader.vertexShader='varying vec2 backingPosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbackingPosition=position.xy;');
        shader.fragmentShader='varying vec2 backingPosition; uniform float activeWarmth;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
          'float edgeWarmth=exp(-pow((length(backingPosition)-177.)/2.5,2.));\noutgoingLight+=vec3(1.,.3,.035)*activeWarmth*edgeWarmth;\n#include <opaque_fragment>');
      };
      backGlass.customProgramCacheKey=()=>"olympus-active-recess-v1";
    }
    mesh(new T.ShapeGeometry(annulus(a+.6,b-.6,157,179)),backGlass,-12);
    const channel:T.Material=active?new T.ShaderMaterial({
      uniforms:{clock:{value:0},motion:{value:0},start:{value:a},span:{value:b-a},strength:{value:ACTIVE_PROJECT.edgeIntensity},duration:{value:ACTIVE_PROJECT.tracerDuration},interval:{value:ACTIVE_PROJECT.tracerInterval}},
      transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:`varying vec2 channelPosition;void main(){channelPosition=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 channelPosition;uniform float clock,motion,start,span,strength,duration,interval;
        void main(){float angle=degrees(atan(channelPosition.x,channelPosition.y));float u=mod(angle-start+360.,360.)/span;
        float outer=smoothstep(170.,178.,length(channelPosition));
        float localized=.012+outer*.78*exp(-pow((u-.24)/.085,2.))+(1.-outer)*.46*exp(-pow((u-.72)/.105,2.));
        float phase=mod(clock,interval);float progress=phase/duration;
        float tracer=0.;if(phase<duration){
          float offset=u-(.18+.54*progress);
          float head=exp(-pow(offset/.016,2.));
          float tail=exp(min(offset,0.)/.045)*smoothstep(-.12,-.075,offset)*(1.-smoothstep(-.008,0.,offset));
          tracer=(head+tail*.28)*pow(sin(progress*3.14159),2.)*motion*outer;
        }
        gl_FragColor=vec4(vec3(4.5,1.2,.18)*(1.+tracer*.5),min(.95,strength*(localized+tracer*.55)));}`,
    }):new T.MeshBasicMaterial({color:0x9fc9df,transparent:true,opacity:PROJECT_GLASS.inactiveChannel,depthWrite:false,toneMapped:false});
    if(active)activeChannels.push(channel as T.ShaderMaterial);
    for(const [inner,outer] of active?[[156.6,156.85],[179.15,179.4]]:[])
      mesh(new T.ShapeGeometry(annulus(a+1,b-1,inner,outer)),channel,-1.2);
    const rim=new T.LineBasicMaterial({vertexColors:true,color:active?0xe7bb7a:0xa9d5e8,transparent:true,opacity:PROJECT_GLASS.rimOpacity,depthWrite:false});
    const outline=annulus(a,b,155.2,180.8).getPoints(256);
    const rimGeometry=new T.BufferGeometry().setFromPoints(outline.map(p=>new T.Vector3(p.x,p.y,-.5)));
    const rimColors=outline.flatMap(p=>{const response=.16+.84*Math.max(0,(p.x*-.65+p.y*.76)/p.length())**3;return [response,response,response];});
    rimGeometry.setAttribute('color',new T.Float32BufferAttribute(rimColors,3));
    group.add(new T.LineLoop(rimGeometry,rim));
    panels.push({id:segment.project.id,face:glass,active,rim});

  }
  const idleCycle=createIdleCoreCycle();
  let previousTime=0,wasIdle=false,speechAmount=0;
  return {
    studyIds,
    update(time:number,energy:number,moving:boolean,hover:string|null,idle=false,speaking=false,executing=false,executionProject?:string,operationPulse=0,completing=false,errorAge=-1){
      const frameDelta=Math.min(.05,Math.max(0,time-previousTime));
      const target=speaking&&moving?Math.max(0,Math.min(1,energy)):0;
      const response=target>speechAmount?OMEGA_SPEECH.attackSeconds:OMEGA_SPEECH.releaseSeconds;
      speechAmount=moving?speechAmount+(target-speechAmount)*(1-Math.exp(-frameDelta/response)):0;
      glyph.scale.setScalar(1+OMEGA_SPEECH.scaleGain*speechAmount);
      const delta=idle&&wasIdle?Math.max(0,time-previousTime):0;
      previousTime=time;wasIdle=idle;
      const idleSample=idle?idleCycle(delta,moving):null;
      const error=errorAge>=0;
      const dip=error&&moving&&errorAge<1.4?.20*Math.sin(Math.PI*errorAge/1.4)**2:0;
      face.color.set(error?0x480609:0x6c3611);
      face.emissive.set(error?0xa30813:0xd87520);
      radialMaterial.uniforms.tint.value.set(1,error?.008:.25,error?.018:.035);
      warmLines.color.set(error?0xc91422:0xffa13d);
      haloMaterial.color.set(error?0xd51022:0xffffff);
      const envelope=error?.95-dip:executing?1.12+operationPulse*.10:idleSample?.envelope??coreGlowEnvelope(time,moving),t=MATERIAL_TUNING;
      face.emissiveIntensity=t.coreEmission*envelope+energy*.5;
      haloMaterial.opacity=t.haloOpacity*envelope+energy*.12;
      radialMaterial.uniforms.intensity.value=t.radialHalo*envelope*(idle&&moving?.85+.55*idleSample!.breath:1)+energy*.06;
      radialHalo.scale.setScalar(idle?(moving?OMEGA_IDLE.haloBreathMin+(OMEGA_IDLE.haloBreathMax-OMEGA_IDLE.haloBreathMin)*idleSample!.breath+(idleSample!.pulse/OMEGA_IDLE.primaryStrength)*OMEGA_IDLE.haloExpansion:1):1+(envelope-1)*.15);
      coreLight.intensity=t.localLight*(idle?1+(envelope-1)*OMEGA_IDLE.localLightBoost:envelope)+energy*25;
      const progress=idleSample?.rippleProgress??(heartbeatAge(time)-.95)/1.8;
      ripple.visible=!error&&!executing&&!completing&&moving&&(idleSample?idleSample.ripple>0:progress>=0&&progress<=1);
      if(ripple.visible){
        const start=idle?OMEGA_IDLE.rippleStart:t.rippleStart,end=idle?OMEGA_IDLE.rippleEnd:t.rippleEnd;
        ripple.scale.setScalar(start+(end-start)*progress);
        rippleMaterial.opacity=idleSample?.ripple??t.rippleOpacity*Math.sin(Math.PI*progress)**2;
      }
      warmLines.opacity=.72+.12*(envelope-1)+energy*.08;
      activeChannels.forEach(material=>{material.uniforms.clock.value=time;material.uniforms.motion.value=moving?1:0;});
      panels.forEach(p=>{
        const selected=hover===p.id;
        p.face.emissiveIntensity=0;
        p.rim.color.set(error&&p.id===executionProject?0xe57950:p.active?0xe7bb7a:0xa9d5e8);
        p.rim.opacity=PROJECT_GLASS.rimOpacity+(p.active?PROJECT_GLASS.activeRimBoost*.25:0)+(selected?PROJECT_GLASS.hoverRimBoost:0)+(p.id===executionProject?.10+operationPulse*.10:0);
      });
    },
    dispose(){labelTexture.dispose();diffusionTexture.dispose();engraving.dispose();contour.dispose();environmentTarget.dispose();scene.environment=null;}
  };
}
