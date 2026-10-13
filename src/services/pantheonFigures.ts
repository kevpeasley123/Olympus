import * as T from 'three';
import type { Mission } from './capabilities';
import type { CommandCatalog } from './commandAgents';
import { MANIFESTED_FIGURES, PANTHEON_FIGURES, nextFigureState, type FigureId, type FigureMemory, type FigureSpec, type FigureState } from './pantheonFigureState';
import { CLIP_NAMES, STAND_IN_HEIGHT, STRIKE_TIME, buildHephaestusStandIn, type ClipName } from './pantheonStandIn';

/**
 * The living Pantheon in Command's scene: each manifested god stands on a
 * platform at its station, plays articulated clips through one
 * AnimationMixer, looks around through a procedural gaze layer, and works only
 * while a recorded step names its agent. Same camera, depth buffer, bloom and
 * frame loop as the Omega; no React state per frame.
 *
 * A commissioned model replaces the stand-in when `public/pantheon/manifest.json`
 * names its glTF, e.g. {"hephaestus":"hephaestus.glb"}. It must use the Mixamo
 * bone names and provide the clips in `CLIP_NAMES` (docs/PANTHEON-FIGURES.md).
 */
const MANIFEST_URL = `${import.meta.env.BASE_URL}pantheon/manifest.json`;
async function figureModels(): Promise<Partial<Record<FigureId, string>>> {
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    // The dev server answers a missing file with the app's HTML; only JSON counts.
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return {};
    const entries = await response.json() as Record<string, unknown>;
    return Object.fromEntries(Object.entries(entries).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, new URL(v as string, new URL(MANIFEST_URL, location.href)).href]));
  } catch { return {}; }
}
/** Scene units per figure: about the figurine scale of the reference render. */
export const FIGURE_HEIGHT = 76;

const BASE: Record<FigureState, ClipName> = { dormant: 'idle', unavailable: 'idle', idle: 'idle', assigned: 'work', working: 'work', reviewing: 'work', waiting: 'wait', completed: 'idle', blocked: 'blocked' };
const IDLE_GESTURES: readonly (readonly [ClipName, number])[] = [['idle_shift', .38], ['idle_inspect', .32], ['idle_adjust', .3]];
const ZEUS = new T.Vector3(...PANTHEON_FIGURES[0].station).add(new T.Vector3(0, FIGURE_HEIGHT * .55, 0));

interface Figure {
  spec: FigureSpec; group: T.Group; body: T.Object3D; bones: Map<string, T.Object3D>; rest: Map<T.Object3D, { q: T.Quaternion; p: T.Vector3 }>;
  mixer: T.AnimationMixer; actions: Map<ClipName, T.AnimationAction>; current: T.AnimationAction | null; base: ClipName; gestureEnds: boolean;
  memory: FigureMemory | null; random: () => number; nextGesture: number; lastGesture: ClipName | null; nextGaze: number; gazeTarget: string;
  gaze: { yaw: number; pitch: number; vyaw: number; vpitch: number }; tool: T.Object3D | null; workTime: number;
  platform: { disc: T.Mesh; ring: T.LineLoop; uniforms: { glow: { value: number }; tint: { value: T.Color } } };
  light: T.PointLight; flash: number; source: 'stand-in' | 'model'; holo: Holo | null; target: HTMLElement | null; anchor: string; ember: number; dispose(): void;
}
interface Holo { group: T.Group; presence: number; age: number; materials: T.LineBasicMaterial[]; constructs: T.LineSegments[]; circuit: T.Line; circuitLength: number }

export function buildPantheonFigures(scene: T.Scene, host: HTMLElement, camera: T.Camera) {
  const root = new T.Group(); root.name = 'Pantheon figures'; scene.add(root);
  const sprite = sparkTexture();
  const sparks = buildSparks(sprite); root.add(sparks.points);
  const signals = buildSignals(sprite, root);
  const figures: Figure[] = [];
  let disposed = false;
  for (const id of MANIFESTED_FIGURES) {
    const spec = PANTHEON_FIGURES.find(f => f.id === id)!;
    const figure = createFigure(spec, root);
    figures.push(figure);
  }
  void figureModels().then(models => figures.forEach(figure => {
    const url = models[figure.spec.id];
    if (url && !disposed) void loadFigureModel(url).then(model => { if (!disposed) adoptModel(figure, model); }).catch(error => console.warn(`[Olympus] ${figure.spec.name} model unavailable; keeping the stand-in.`, error));
  }));
  const projected = new T.Vector3(), world = new T.Vector3(), local = new T.Vector3(), headWorld = new T.Vector3(), inverse = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();

  function update(missions: readonly Mission[], catalog: CommandCatalog | null, delta: number, clock: number, moving: boolean) {
    let signature = '';
    for (const f of figures) {
      const before = f.memory?.state;
      f.memory = nextFigureState(f.spec, missions, catalog, f.memory, clock);
      const state = f.memory.state;
      if (state !== before) enter(f, state, before ?? null, clock);
      signature += `${f.spec.id}:${state};`;
      const dt = delta * f.spec.temperament.tempo * (state === 'dormant' ? 0 : 1);
      if (moving && state === 'idle' && clock >= f.nextGesture && f.current === f.actions.get('idle')) {
        play(f, pick(f, IDLE_GESTURES), true);
        f.nextGesture = clock + span(f.random, f.spec.temperament.gesture);
      }
      if (f.gestureEnds && f.current && f.current.time >= f.current.getClip().duration - .55) { f.gestureEnds = false; play(f, f.base, false); }
      // Rest first, so clip weights blend from the bind pose and gaze never accumulates.
      for (const [b, r] of f.rest) { b.quaternion.copy(r.q); b.position.copy(r.p); }
      const work = f.actions.get('work')!, before2 = work.time;
      f.mixer.update(dt);
      if (moving && work.isRunning() && work.getEffectiveWeight() > .5 && (before2 < STRIKE_TIME && work.time >= STRIKE_TIME || before2 > work.time && work.time >= STRIKE_TIME)) strike(f);
      if (moving && clock >= f.nextGaze) { f.gazeTarget = chooseGaze(f, state); f.nextGaze = clock + span(f.random, state === 'working' ? [1.6, 3.4] : f.spec.temperament.gaze); }
      f.group.updateMatrixWorld(true);
      applyGaze(f, dt, moving);
      updateEffects(f, state, dt, clock, moving);
      place(f);
    }
    sparks.update(delta);
    signals.update(delta);
    return signature;
  }

  function enter(f: Figure, state: FigureState, previous: FigureState | null, clock: number) {
    f.base = BASE[state];
    if (f.target) { f.target.dataset.figureState = state; }
    const chest = f.group.localToWorld(world.set(0, 1.25, 0)).clone();
    if (state === 'assigned') { signals.fire(ZEUS, chest, 0xffd27a); play(f, 'assigned', true); return; }
    if (state === 'completed' && previous) { signals.fire(chest, ZEUS, f.spec.accent); play(f, 'complete', true); return; }
    if (state === 'dormant' || state === 'unavailable') f.platform.uniforms.tint.value.set(0x8c8a96);
    else f.platform.uniforms.tint.value.set(f.spec.accent);
    if (!(previous === 'assigned' && state === 'working')) play(f, f.base, false);
    f.nextGesture = clock + span(f.random, f.spec.temperament.gesture);
    f.nextGaze = clock;
  }

  function play(f: Figure, name: ClipName, gesture: boolean) {
    const next = f.actions.get(name); if (!next) return;
    const previous = f.current;
    if (previous === next && !gesture) return;
    next.enabled = true; next.setEffectiveTimeScale(1); next.setEffectiveWeight(1);
    if (gesture || !next.isRunning()) next.reset();
    next.play();
    if (previous && previous !== next) next.crossFadeFrom(previous, gesture ? .45 : .6, false);
    f.current = next; f.gestureEnds = gesture; if (gesture) f.lastGesture = name;
  }

  function pick(f: Figure, options: readonly (readonly [ClipName, number])[]) {
    // Weighted, never the same gesture twice running.
    const pool = options.filter(([n]) => n !== f.lastGesture), total = pool.reduce((s, [, w]) => s + w, 0);
    let r = f.random() * total;
    for (const [n, w] of pool) if ((r -= w) <= 0) return n;
    return pool[pool.length - 1][0];
  }

  function chooseGaze(f: Figure, state: FigureState) {
    const r = f.random();
    if (state === 'working' || state === 'assigned') return r < .72 ? 'tool' : 'holo';
    if (state === 'waiting') return r < .7 ? 'holo' : 'omega';
    if (state === 'blocked') return 'down';
    if (state === 'completed') return 'zeus';
    if (f.current === f.actions.get('idle_inspect')) return 'tool';
    const options: [string, number][] = [['forward', .32], ['omega', .26], ['neighbour', .16], ['zeus', .12], ['tool', .14]];
    const pool = options.filter(([n]) => n !== f.gazeTarget), total = pool.reduce((s, [, w]) => s + w, 0);
    let pickValue = r * total;
    for (const [n, w] of pool) if ((pickValue -= w) <= 0) return n;
    return 'forward';
  }

  function gazePoint(f: Figure, out: T.Vector3) {
    const station = f.group.position;
    switch (f.gazeTarget) {
      case 'omega': return out.set(0, 0, 0);
      case 'zeus': return out.copy(ZEUS);
      case 'neighbour': { const n = PANTHEON_FIGURES.find(s => s.id !== f.spec.id && Math.sign(s.station[0]) !== Math.sign(station.x) && Math.abs(s.station[1] - station.y) < 60) ?? PANTHEON_FIGURES[0]; return out.set(n.station[0], n.station[1] + FIGURE_HEIGHT * .8, 0); }
      case 'tool': return f.tool ? f.tool.getWorldPosition(out) : f.group.localToWorld(out.set(-.2, .75, .56));
      case 'holo': return f.holo ? f.holo.group.getWorldPosition(out) : f.group.localToWorld(out.set(.4, 1.2, .5));
      case 'down': return f.group.localToWorld(out.set(0, .2, 1.2));
      default: return f.group.localToWorld(out.set(0, 1.62, 3));
    }
  }

  function applyGaze(f: Figure, dt: number, moving: boolean) {
    const head = f.bones.get('Head'), neck = f.bones.get('Neck');
    if (!head || !neck) return;
    head.getWorldPosition(headWorld);
    gazePoint(f, world);
    inverse.copy(f.group.matrixWorld).invert();
    local.copy(world).applyMatrix4(inverse).sub(headWorld.applyMatrix4(inverse));
    const yaw = T.MathUtils.clamp(Math.atan2(local.x, local.z), -.95, .95);
    const pitch = T.MathUtils.clamp(Math.atan2(-local.y, Math.hypot(local.x, local.z)), -.42, .5);
    // A damped spring gives each glance its anticipation and settle; slower gods turn slower.
    const k = 26 * f.spec.temperament.tempo ** 2, c = 2 * Math.sqrt(k) * .92;
    if (!moving || dt === 0) { if (!moving) { f.gaze.yaw = yaw * .4; f.gaze.pitch = pitch * .4; } }
    else {
      f.gaze.vyaw += ((yaw - f.gaze.yaw) * k - f.gaze.vyaw * c) * dt; f.gaze.yaw += f.gaze.vyaw * dt;
      f.gaze.vpitch += ((pitch - f.gaze.pitch) * k - f.gaze.vpitch * c) * dt; f.gaze.pitch += f.gaze.vpitch * dt;
    }
    neck.quaternion.multiply(q.setFromEuler(e.set(f.gaze.pitch * .35, f.gaze.yaw * .38, 0)));
    head.quaternion.multiply(q.setFromEuler(e.set(f.gaze.pitch * .65, f.gaze.yaw * .62, 0)));
  }

  function strike(f: Figure) {
    if (!f.tool) return;
    f.tool.getWorldPosition(world);
    sparks.burst(world, 14, f.spec.accent);
    f.flash = 1;
  }

  function updateEffects(f: Figure, state: FigureState, dt: number, clock: number, moving: boolean) {
    const active = state === 'working' || state === 'assigned' || state === 'reviewing';
    const glow = state === 'dormant' ? .12 : state === 'unavailable' ? .18 : active ? 1 : state === 'waiting' ? .62 : state === 'blocked' ? .4 : state === 'completed' ? .9 : .42;
    const u = f.platform.uniforms.glow;
    u.value += (glow - u.value) * (moving ? 1 - Math.exp(-dt * 3) : 1);
    f.flash = Math.max(0, f.flash - dt * 5);
    const flicker = moving ? Math.sin(clock * 9.1) * .08 + Math.sin(clock * 23.7) * .05 : 0;
    f.light.intensity = (state === 'dormant' ? 0 : 900 * (.18 + u.value * .55 + flicker * u.value)) + f.flash * 2600;
    if (f.holo) {
      const h = f.holo, want = active ? 1 : state === 'waiting' ? .55 : 0;
      h.presence += (want - h.presence) * (moving ? 1 - Math.exp(-dt * (want > h.presence ? 2.4 : 1.6)) : 1);
      h.group.visible = h.presence > .01;
      if (active && moving) h.age += dt;
      if (!active && h.presence < .02) h.age = 0;
      h.materials.forEach((m, i) => { m.opacity = h.presence * (i === 0 ? .55 : i === 1 ? .16 : .85); });
      // Constructs assemble one after another; the circuit traces itself in a six-second build.
      h.constructs.forEach((c, i) => { const p = T.MathUtils.smoothstep(h.age, .35 + i * .5, 1.1 + i * .5); c.scale.setScalar(.25 + p * .75); c.rotation.y += dt * (.4 + i * .17); c.rotation.x += dt * .13; (c.material as T.LineBasicMaterial).opacity = h.presence * p * .9; });
      h.circuit.geometry.setDrawRange(0, Math.max(2, Math.floor(h.circuitLength * Math.min(1, (h.age % 6) / 4.2))));
      h.group.scale.setScalar(.85 + h.presence * .15);
    }
    // Embers drift up from the forge even at rest; idle effects stay quieter than work.
    if (moving && f.spec.id === 'hephaestus' && state !== 'dormant') {
      f.ember -= dt;
      if (f.ember <= 0) { f.ember = span(f.random, active ? [.25, .6] : [1.2, 2.6]); sparks.ember(f.group.localToWorld(world.set(-.2 + (f.random() - .5) * .2, .74, .56)), f.spec.accent); }
    }
  }

  function place(f: Figure) {
    if (!f.target?.isConnected) {
      f.target = host.closest('.command-instrument__dial')?.querySelector<HTMLElement>(`[data-figure-id="${f.spec.id}"]`) ?? null;
      if (f.target && f.memory) f.target.dataset.figureState = f.memory.state;
      if (f.target) f.target.dataset.figureSource = f.source;
      f.anchor = '';
    }
    if (!f.target) return;
    projected.copy(f.group.position).project(camera);
    const x = (projected.x * .5 + .5) * 100, y = (.5 - projected.y * .5) * 100;
    projected.copy(f.group.position).add(world.set(0, FIGURE_HEIGHT * 1.02, 0)).project(camera);
    const top = (.5 - projected.y * .5) * 100;
    const anchor = `${x.toFixed(1)}/${y.toFixed(1)}/${top.toFixed(1)}`;
    if (anchor === f.anchor) return;
    f.anchor = anchor;
    f.target.style.left = `${x.toFixed(1)}%`; f.target.style.top = `${top.toFixed(1)}%`;
    f.target.style.setProperty('--figure-height', `${(y - top).toFixed(1)}%`);
  }

  return {
    update,
    dispose() {
      disposed = true;
      figures.forEach(f => { f.mixer.stopAllAction(); f.dispose(); });
      sparks.dispose(); signals.dispose(); sprite.dispose();
      root.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach(x => x.dispose()); });
      scene.remove(root);
    },
  };
}

function createFigure(spec: FigureSpec, parent: T.Group): Figure {
  const group = new T.Group(); group.name = spec.name;
  group.position.set(...spec.station);
  // Turned toward the viewer and the Omega, tipped back so the dais reads from above.
  group.rotation.set(.16, Math.atan2(-60 - spec.station[0], 700), 0, 'YXZ');
  const scale = FIGURE_HEIGHT / STAND_IN_HEIGHT;
  const platform = buildPlatform(spec.accent); platform.disc.scale.setScalar(scale); platform.ring.scale.setScalar(scale); group.add(platform.disc, platform.ring);
  const light = new T.PointLight(spec.accent, 0, FIGURE_HEIGHT * 2.2, 1.6); light.position.set(-.1 * scale, .95 * scale, .7 * scale); group.add(light);
  parent.add(group);
  const standIn = buildHephaestusStandIn(spec.accent);
  standIn.root.scale.setScalar(scale); group.add(standIn.root);
  const holo = spec.id === 'hephaestus' ? buildHolo(spec.accent) : null;
  if (holo) { const holder = new T.Group(); holder.position.set(.5 * scale, 1.28 * scale, .38 * scale); holder.scale.setScalar(scale); holder.rotation.y = -.35; holder.add(holo.group); group.add(holder); }
  const figure: Figure = {
    spec, group, body: standIn.root, bones: standIn.bones, rest: restPose(standIn.bones), mixer: new T.AnimationMixer(standIn.root), actions: new Map(), current: null, base: 'idle', gestureEnds: false,
    memory: null, random: seeded(spec.id), nextGesture: 0, lastGesture: null, nextGaze: 0, gazeTarget: 'forward', gaze: { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 },
    tool: standIn.hammerHead, workTime: 0, platform, light, flash: 0, source: 'stand-in', holo, target: null, anchor: '', ember: 1, dispose: standIn.dispose,
  };
  bindClips(figure, standIn.clips);
  figure.nextGesture = span(figure.random, spec.temperament.gesture) * .6;
  return figure;
}

function bindClips(f: Figure, clips: readonly T.AnimationClip[]) {
  f.actions.clear();
  for (const name of CLIP_NAMES) {
    const clip = clips.find(c => c.name === name) ?? clips.find(c => c.name === 'idle');
    if (!clip) continue;
    const action = f.mixer.clipAction(clip);
    const once = !['idle', 'work', 'wait', 'blocked'].includes(name);
    action.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity); action.clampWhenFinished = once;
    // Independent phase per god, so no two breathe or strike together.
    if (!once) action.time = f.random() * clip.duration;
    f.actions.set(name, action);
  }
  f.current = null;
}

// The contract skeleton; exporters without skins still name these joints.
const RIG_NAMES = /^(Hips|Spine[12]?|Neck|Head|(Left|Right)(Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot))$/;
function restPose(bones: Map<string, T.Object3D>) {
  return new Map([...bones.values()].map(b => [b, { q: b.quaternion.clone(), p: b.position.clone() }]));
}

function seeded(id: string) {
  let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  // Seeded per god and per launch: independent rhythms that differ from one session to the next.
  let s = (h ^ Math.floor(Math.random() * 2 ** 31)) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const span = (random: () => number, [a, b]: readonly [number, number]) => a + random() * (b - a);

function buildPlatform(accent: number) {
  const uniforms = { glow: { value: .4 }, tint: { value: new T.Color(accent) } };
  const disc = new T.Mesh(new T.CircleGeometry(.62, 48), new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float glow;uniform vec3 tint;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float rim=smoothstep(.78,.93,r)*(1.-smoothstep(.93,1.,r));float pool=(1.-smoothstep(0.,.9,r))*.35;gl_FragColor=vec4(tint*(rim*.9+pool)*glow,1.);}',
  }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .005;
  const ring = new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new T.Vector3(Math.cos(i / 96 * Math.PI * 2) * .78, 0, Math.sin(i / 96 * Math.PI * 2) * .78))), new T.LineBasicMaterial({ color: accent, transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending }));
  return { disc, ring, uniforms };
}

function buildHolo(accent: number): Holo {
  const group = new T.Group(); group.name = 'Engineering surface'; group.visible = false;
  const tone = new T.Color(accent).lerp(new T.Color(0xffe2b0), .35);
  const line = (opacity: number) => new T.LineBasicMaterial({ color: tone, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending });
  const frameMat = line(.55), gridMat = line(.16), circuitMat = line(.85);
  const w = .5, h = .34;
  group.add(new T.LineLoop(new T.BufferGeometry().setFromPoints([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => new T.Vector3(x, y, 0))), frameMat));
  const grid: T.Vector3[] = [];
  for (let i = 1; i < 6; i++) grid.push(new T.Vector3(-w / 2 + i * w / 6, -h / 2, 0), new T.Vector3(-w / 2 + i * w / 6, h / 2, 0));
  for (let i = 1; i < 4; i++) grid.push(new T.Vector3(-w / 2, -h / 2 + i * h / 4, 0), new T.Vector3(w / 2, -h / 2 + i * h / 4, 0));
  group.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(grid), gridMat));
  const path = [[-.21, -.12], [-.12, -.12], [-.12, -.03], [-.02, -.03], [-.02, .09], [.08, .09], [.08, -.06], [.17, -.06], [.17, .12], [.21, .12]];
  const points: T.Vector3[] = [];
  for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < 8; s++) { const [ax, ay] = path[i], [bx, by] = path[i + 1]; points.push(new T.Vector3(ax + (bx - ax) * s / 8, ay + (by - ay) * s / 8, .002)); }
  const circuit = new T.Line(new T.BufferGeometry().setFromPoints(points), circuitMat); group.add(circuit);
  const constructs = [new T.BoxGeometry(.075, .075, .075), new T.OctahedronGeometry(.05), new T.IcosahedronGeometry(.045)].map((g, i) => {
    const s = new T.LineSegments(new T.EdgesGeometry(g), line(0)); g.dispose();
    s.position.set(-.13 + i * .13, .25 + (i % 2) * .04, .06); group.add(s); return s;
  });
  return { group, presence: 0, age: 0, materials: [frameMat, gridMat, circuitMat], constructs, circuit, circuitLength: points.length };
}

function sparkTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,230,180,.85)'); r.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}

/** One pooled draw for every spark and ember; the pool caps the particle count. */
function buildSparks(texture: T.Texture) {
  const count = 72, position = new Float32Array(count * 3), color = new Float32Array(count * 3);
  const velocity = new Float32Array(count * 3), life = new Float32Array(count), age = new Float32Array(count).fill(1), tint: T.Color[] = Array.from({ length: count }, () => new T.Color()), gravity = new Float32Array(count);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3)); geometry.setAttribute('color', new T.BufferAttribute(color, 3));
  const points = new T.Points(geometry, new T.PointsMaterial({ size: 2.4, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  points.frustumCulled = false; points.name = 'Forge sparks';
  let cursor = 0;
  const spawn = (at: T.Vector3, v: [number, number, number], l: number, g: number, c: number) => {
    const i = cursor; cursor = (cursor + 1) % count;
    position.set([at.x, at.y, at.z], i * 3); velocity.set(v, i * 3); life[i] = l; age[i] = 0; gravity[i] = g; tint[i].set(c).lerp(new T.Color(0xffffff), .35);
  };
  return {
    points,
    burst(at: T.Vector3, n: number, c: number) { for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = 18 + Math.random() * 34; spawn(at, [Math.cos(a) * s * .8, 14 + Math.random() * 30, Math.sin(a) * s * .5], .35 + Math.random() * .5, -70, c); } },
    ember(at: T.Vector3, c: number) { spawn(at, [(Math.random() - .5) * 2.5, 5 + Math.random() * 4, (Math.random() - .5) * 2], 2 + Math.random() * 1.4, 0, c); },
    update(dt: number) {
      for (let i = 0; i < count; i++) {
        if (age[i] >= 1) { color[i * 3] = color[i * 3 + 1] = color[i * 3 + 2] = 0; continue; }
        age[i] = Math.min(1, age[i] + dt / life[i]);
        velocity[i * 3 + 1] += gravity[i] * dt;
        for (let k = 0; k < 3; k++) position[i * 3 + k] += velocity[i * 3 + k] * dt;
        const fade = (1 - age[i]) ** 1.5;
        color[i * 3] = tint[i].r * fade; color[i * 3 + 1] = tint[i].g * fade; color[i * 3 + 2] = tint[i].b * fade;
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    },
    dispose() { geometry.dispose(); (points.material as T.Material).dispose(); },
  };
}

/** Thin celestial pulses: Zeus to a summoned god, and back when work is recorded complete. */
function buildSignals(texture: T.Texture, parent: T.Group) {
  const pool = Array.from({ length: 6 }, () => {
    const head = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    head.scale.setScalar(7); head.visible = false;
    const trailPositions = new Float32Array(24 * 3);
    const trailGeometry = new T.BufferGeometry(); trailGeometry.setAttribute('position', new T.BufferAttribute(trailPositions, 3));
    const trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ transparent: true, opacity: .55, depthWrite: false, blending: T.AdditiveBlending })); trail.visible = false; trail.frustumCulled = false;
    parent.add(head, trail);
    return { head, trail, trailPositions, from: new T.Vector3(), to: new T.Vector3(), control: new T.Vector3(), age: 1 };
  });
  const point = new T.Vector3();
  const at = (s: typeof pool[number], t: number, out: T.Vector3) => { const u = 1 - t; return out.copy(s.from).multiplyScalar(u * u).addScaledVector(s.control, 2 * u * t).addScaledVector(s.to, t * t); };
  const DURATION = 1.15;
  return {
    fire(from: T.Vector3, to: T.Vector3, color: number) {
      const s = pool.find(p => p.age >= 1) ?? pool[0];
      s.from.copy(from); s.to.copy(to); s.control.copy(from).lerp(to, .5).add(new T.Vector3(0, 26, 18)); s.age = 0;
      (s.head.material as T.SpriteMaterial).color.set(color); (s.trail.material as T.LineBasicMaterial).color.set(color);
    },
    update(dt: number) {
      for (const s of pool) {
        if (s.age >= 1) { s.head.visible = s.trail.visible = false; continue; }
        s.age = Math.min(1, s.age + dt / DURATION);
        const t = T.MathUtils.smootherstep(s.age, 0, 1);
        s.head.visible = s.trail.visible = true;
        at(s, t, s.head.position);
        for (let i = 0; i < 24; i++) { at(s, Math.max(0, t - .22 * (1 - i / 23)), point); s.trailPositions.set([point.x, point.y, point.z], i * 3); }
        s.trail.geometry.attributes.position.needsUpdate = true;
        (s.trail.material as T.LineBasicMaterial).opacity = .5 * Math.sin(Math.PI * s.age);
        (s.head.material as T.SpriteMaterial).opacity = Math.sin(Math.PI * s.age) ** .5;
      }
    },
    dispose() { pool.forEach(s => { s.trail.geometry.dispose(); (s.trail.material as T.Material).dispose(); (s.head.material as T.Material).dispose(); }); },
  };
}

interface LoadedModel { root: T.Object3D; clips: T.AnimationClip[] }
export async function loadFigureModel(url: string): Promise<LoadedModel> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  // Mixamo exports prefix every bone ("mixamorig:Hips"); the contract uses the bare names.
  const bare = (n: string) => n.replace(/^mixamorig\d*[:_]?/, '');
  gltf.scene.traverse(o => { o.name = bare(o.name); });
  for (const clip of gltf.animations) clip.tracks.forEach(t => { const dot = t.name.lastIndexOf('.'); t.name = bare(t.name.slice(0, dot)) + t.name.slice(dot); });
  return { root: gltf.scene, clips: gltf.animations };
}

function adoptModel(f: Figure, model: LoadedModel) {
  const box = new T.Box3().setFromObject(model.root), size = box.getSize(new T.Vector3());
  model.root.scale.setScalar(FIGURE_HEIGHT / Math.max(size.y, 1e-3));
  model.root.position.y = -box.min.y * model.root.scale.y;
  const bones = new Map<string, T.Object3D>();
  model.root.traverse(o => { if ((o as T.Bone).isBone || RIG_NAMES.test(o.name)) bones.set(o.name, o); });
  f.mixer.stopAllAction(); f.group.remove(f.body); f.dispose();
  f.group.add(model.root);
  f.body = model.root; f.bones = bones; f.rest = restPose(bones); f.mixer = new T.AnimationMixer(model.root);
  f.tool = model.root.getObjectByName('Tool') ?? model.root.getObjectByName('RightHand') ?? null;
  f.dispose = () => model.root.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach(x => x.dispose()); });
  bindClips(f, model.clips);
  f.source = 'model'; f.anchor = ''; if (f.target) f.target.dataset.figureSource = 'model';
  const state = f.memory?.state ?? 'idle';
  f.base = BASE[state];
  const action = f.actions.get(f.base); action?.play(); f.current = action ?? null;
}
