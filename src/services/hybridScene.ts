import * as T from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { nodeDepth, type CommandLayout } from "./hybridCore";
import type { HybridFrame } from "../components/panels/HybridCommandCore";

const ORANGE = 0xee842d, BLUE = 0x739fbd;
// Same Omega composition and clearance as the existing 150-unit glyph; purpose-built beveled outline.
const OMEGA = "M-62 52 L-62 34 L-36 34 C-54 20 -62 2 -62 -17 C-62 -48 -35 -67 0 -67 C35 -67 62 -48 62 -17 C62 2 54 20 36 34 L62 34 L62 52 L18 52 L18 28 C38 12 44 -1 44 -18 C44 -44 26 -54 0 -54 C-26 -54 -44 -44 -44 -18 C-44 -1 -38 12 -18 28 L-18 52 Z";
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(canvas);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-220,220,220,-220,1,1000); camera.position.z = 500;
  scene.add(new T.HemisphereLight(0xc5e2ff,0x07121f,1.5));
  const light = new T.DirectionalLight(0xddefff,3.4); light.position.set(-100,160,230); scene.add(light);
  const warm = new T.PointLight(ORANGE, 160, 380, 1); warm.position.set(20,-20,100); scene.add(warm);
  const structural = new T.MeshStandardMaterial({ color: 0x172e43, metalness: .72, roughness: .5 });
  const glow = new T.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: .45, metalness: .45, roughness: .28 });
  const cool = new T.MeshStandardMaterial({ color: BLUE, emissive: 0x284d70, emissiveIntensity: .55, metalness: .65, roughness: .3 });
  function mesh(geometry: T.BufferGeometry, material: T.Material, z = 0) { const m = new T.Mesh(geometry,material); m.position.z=z; scene.add(m); return m; }
  function track(radius: number, width: number, material: T.Material, z: number) { return mesh(new T.TorusGeometry(radius,width,8,192),material,z); }
  // A dark core chassis establishes an actual occlusion plane behind the emissive Omega.
  mesh(new T.CylinderGeometry(76,78,7,96),structural,-20).rotation.x=Math.PI/2;
  track(78,.65,cool,-14); track(74,.35,cool,-12);
  const shapes = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${OMEGA}"/></svg>`).paths.flatMap(p => SVGLoader.createShapes(p));
  const omegaGeometry = new T.ExtrudeGeometry(shapes,{depth:5,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:1.7,bevelThickness:1.8,curveSegments:20});
  omegaGeometry.scale(1,-1,1);
  // Reflection maps SVG Y to world Y, so reverse winding without reversing the transformed normals.
  const triangleIndices = Array.from({length: omegaGeometry.getAttribute("position").count}, (_,i) => i%3===1?i+1:i%3===2?i-1:i);
  omegaGeometry.setIndex(triangleIndices);
  mesh(omegaGeometry,glow,15);
  const frames: {id:string; material:T.MeshStandardMaterial; active:boolean}[]=[];
  for (const segment of layout.ring.segments) {
    const active=segment.project.status==="active";
    const material=structural.clone(); material.color.set(active?0x583016:0x1b344b); material.emissive.set(active?0x8c390b:0x163b59); material.emissiveIntensity=active?.45:.2;
    mesh(new T.ExtrudeGeometry(band(segment.startAngle,segment.endAngle,156.5,179.5),{depth:6,bevelEnabled:true,bevelSize:.65,bevelThickness:1.1,bevelSegments:2,curveSegments:24,steps:1}),material,-10);
    frames.push({id:segment.project.id,material,active});
    mesh(new T.ShapeGeometry(band(segment.startAngle+.25,segment.endAngle-.25,178,179)),active?glow:cool,-1);
    mesh(new T.ShapeGeometry(band(segment.startAngle+.25,segment.endAngle-.25,157,157.45)),cool,-1);
  }
  track(185,.55,structural,-8); track(190,.35,cool,-15); track(194,.45,structural,-20);
  const orbital: T.Mesh[]=[];
  for (let i=0;i<2;i++) {
    const material=cool.clone(); material.color.set(i===0?ORANGE:BLUE); material.emissive.set(i===0?ORANGE:0x609cce); material.emissiveIntensity=.55;
    orbital.push(track(84+i*10,.48,material,5+i*2));
  }
  const nodeGeometry=new T.SphereGeometry(1,10,8);
  const nodes: {mesh:T.Mesh; project:string; material:T.MeshStandardMaterial; base:number}[]=[];
  for (const n of layout.constellation.nodes) {
    const z=nodeDepth(n.id), material=cool.clone(); material.emissiveIntensity=.3+(z+12)/40;
    const m=mesh(nodeGeometry,material,z);m.position.set(n.x-220,220-n.y,z);m.scale.setScalar(n.size);
    nodes.push({mesh:m,project:n.projectId,material,base:material.emissiveIntensity});
  }
  const byId=new Map(layout.constellation.nodes.map(n=>[n.id,n]));
  function pos(p:{x:number;y:number;id?:string}) { return new T.Vector3(p.x-220,220-p.y,p.id&&byId.has(p.id)?nodeDepth(p.id):-6); }
  function line(a:T.Vector3,b:T.Vector3,opacity:number) { const material=new T.LineBasicMaterial({color:BLUE,transparent:true,opacity,depthWrite:false}); const object=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),material);scene.add(object); }
  for (const edge of layout.constellation.treeEdges) line(pos(edge.from),pos(edge.to),edge.depth<=1?.12:.28);
  for (const edge of layout.constellation.crossProjectEdges) for(const piece of edge.pieces) line(pos(piece.from),pos(piece.to),.16);
  const tracer=mesh(new T.SphereGeometry(1.35,10,8),glow,-1);
  const signal=mesh(new T.SphereGeometry(1.2,10,8),glow,0);
  let frame: number | undefined, timer: number | undefined;
  let stopped=false, time=0, previous=0;
  const lost=(event:Event)=>{event.preventDefault();fail("Graphics context lost.");};canvas.addEventListener("webglcontextlost",lost);
  const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height),false);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let announced=false, lastSignature="", lastStats=0, renderCount=0;
  function render(now:number) {
    if(stopped)return;
    frame=undefined;timer=undefined;
    const value=current(), moving=value.running&&document.visibilityState==="visible";
    if(moving&&previous)time+=Math.min((now-previous)/1000,.05);previous=now;
    orbital.forEach((ring,i)=>{
      ring.rotation.set(time*(i%2?-.22:.28)+i*.8, time*.16+i*.65, i*.9);
    });
    const energy=value.state==="speaking"?(moving?Math.min(1,Math.max(0,value.voiceLevel)):.15):value.state==="thinking"?.35:value.state==="listening"?.22:0;
    glow.emissiveIntensity=.23+(moving?Math.sin(time*.8)*.06:0)+energy*.55;
    glow.color.set(value.state==="error"?0xe57854:ORANGE);
    frames.forEach(f=>{f.material.emissiveIntensity=value.hoverProject===f.id?1.1:f.active?.45:.2;});
    nodes.forEach((n,i)=>{n.material.emissiveIntensity=n.base+(value.hoverProject===n.project?.6:0)+(moving?Math.sin(time*.35+i)*.07:0);});
    tracer.visible=moving&&time%12<4.6;tracer.position.set(Math.sin(time*1.36)*190,Math.cos(time*1.36)*190,0);
    const edges=layout.constellation.treeEdges;
    signal.visible=moving&&edges.length>0&&time%9<2;
    if(signal.visible){const e=edges[Math.floor(time/9)%edges.length];signal.position.copy(pos(e.from)).lerp(pos(e.to),(time%9)/2);}
    const signature = `${value.state}/${moving?value.voiceLevel:0}/${value.hoverProject}/${canvas.width}/${canvas.height}/${value.running}`;
    try { if(document.visibilityState==="visible" && (moving || signature !== lastSignature)) { renderer.render(scene,camera); renderCount++; lastSignature=signature; } }
    catch { fail("Rendering stopped unexpectedly."); return; }
    if(!announced && renderCount){announced=true;ready();}
    if(now-lastStats>500){lastStats=now;canvas.dataset.rings=String(orbital.filter(r=>r.visible).length);canvas.dataset.frames=String(renderCount);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.nodes=String(nodes.length);}
    // One loop; no React updates per frame. Hidden and reduced-motion views render only on changes.
    if(moving)frame=requestAnimationFrame(render);
    else timer=window.setTimeout(()=>render(performance.now()),250);
  }
  frame=requestAnimationFrame(render);
  return ()=>{stopped=true;if(frame!==undefined)cancelAnimationFrame(frame);if(timer!==undefined)clearTimeout(timer);observer.disconnect();canvas.removeEventListener("webglcontextlost",lost);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    scene.traverse(o=>{const drawable=o as T.Mesh;if(drawable.geometry)geometries.add(drawable.geometry);if(drawable.material)(Array.isArray(drawable.material)?drawable.material:[drawable.material]).forEach(m=>materials.add(m));});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose()); structural.dispose();cool.dispose();glow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  };
}
