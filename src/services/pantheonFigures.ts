import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Mission } from './capabilities';
import type { CommandCatalog } from './commandAgents';
import { MANIFESTED_FIGURES, PANTHEON_FIGURES, nextFigureState, type FigureId, type FigureMemory, type FigureSpec, type FigureState } from './pantheonFigureState';
import { CLIP_NAMES, RIG_GROUPS, RIG_HEIGHT, WORK_BEAT, boneSegments, buildSkeleton, figureClips, figureScale, rimmed, type ClipName } from './pantheonRig';
import { finishFor, pantheonSkin, rimColorFor, skinById, type Lighting, type Skin, type SkinId } from './pantheonSkins';
import { agentHighlightSnapshot } from './agentConstellation';

/**
 * The living Pantheon in Command's scene: each god stands on a pedestal at its
 * station, plays articulated clips through one AnimationMixer, looks around
 * through a procedural gaze layer, and works only while a recorded step names
 * its agent. Same camera, depth buffer, bloom and frame loop as the Omega; no
 * React state per frame.
 *
 * The statues are glTF files named in `public/pantheon/manifest.json`, built
 * by `scripts/pantheon/build_figures.py`. They carry no skin: they are skinned
 * here to the shared skeleton in `pantheonRig.ts`. A rigged glTF with the
 * Mixamo bone names and the clips in `CLIP_NAMES` is used as it comes
 * (docs/PANTHEON-FIGURES.md).
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
export const FIGURE_HEIGHT = 84;
const UNIT = FIGURE_HEIGHT / RIG_HEIGHT;

const BASE: Record<FigureState, ClipName> = { dormant: 'idle', unavailable: 'idle', idle: 'idle', assigned: 'work', working: 'work', reviewing: 'work', waiting: 'wait', completed: 'idle', blocked: 'blocked' };
/** Each god's habits at rest: what it tends to do with its hands and where it tends to look. */
const IDLE_GESTURES: Record<FigureId, readonly (readonly [ClipName, number])[]> = {
  zeus: [['idle_shift', .3], ['idle_inspect', .25], ['idle_adjust', .45]],
  athena: [['idle_shift', .3], ['idle_inspect', .25], ['idle_adjust', .45]],
  hephaestus: [['idle_shift', .3], ['idle_inspect', .5], ['idle_adjust', .2]],
  dionysus: [['idle_shift', .3], ['idle_inspect', .35], ['idle_adjust', .35]],
  themis: [['idle_shift', .25], ['idle_inspect', .5], ['idle_adjust', .25]],
};
const IDLE_GAZE: Record<FigureId, readonly [string, number][]> = {
  zeus: [['forward', .26], ['omega', .38], ['neighbour', .14], ['tool', .14], ['sky', .08]],
  athena: [['forward', .22], ['omega', .2], ['neighbour', .1], ['zeus', .1], ['tool', .1], ['sky', .28]],
  hephaestus: [['forward', .28], ['omega', .2], ['neighbour', .12], ['zeus', .1], ['tool', .3]],
  dionysus: [['forward', .3], ['omega', .18], ['neighbour', .22], ['zeus', .1], ['tool', .14], ['sky', .06]],
  themis: [['forward', .26], ['omega', .22], ['neighbour', .1], ['zeus', .14], ['tool', .28]],
};
/** A dormant god still breathes, slowly, and makes no gestures. */
const DORMANT_TEMPO = .35;

interface Figure {
  spec: FigureSpec; group: T.Group; frame: T.Group; body: T.Group; bones: Map<string, T.Object3D>; rest: Map<T.Object3D, { q: T.Quaternion; p: T.Vector3 }>;
  mixer: T.AnimationMixer; actions: Map<ClipName, T.AnimationAction>; current: T.AnimationAction | null; base: ClipName; gestureEnds: boolean;
  memory: FigureMemory | null; random: () => number; nextGesture: number; lastGesture: ClipName | null; nextGaze: number; gazeTarget: string;
  gaze: { yaw: number; pitch: number; vyaw: number; vpitch: number; neck: T.Quaternion; head: T.Quaternion }; tool: T.Object3D | null; live: Map<string, T.Object3D>;
  platform: { disc: T.Mesh; ring: T.LineLoop; uniforms: { glow: { value: number }; tint: { value: T.Color } } };
  light: T.PointLight; flash: number; source: 'pending' | 'statue' | 'model'; surface: Surface | null; target: HTMLElement | null; anchor: string; ember: number; model: T.Object3D | null;
  shade: { back: { value: number }; contact: { value: number }; halo: { value: number } }; halo: T.Mesh; materials: Dressed[]; skin: SkinId | null; lighting: Lighting; hover: number; shown: number; attended: boolean;
}
/** A statue material and what the skin and hover write into it, so neither recompiles a shader. */
interface Dressed { material: T.MeshStandardMaterial; uniforms: StatueUniforms; color: T.Color; emissive: T.Color; emissiveIntensity: number; rim: T.Color; env: number }
/** Hover: about a quarter second to acknowledge, and a little slower to settle back. */
const HOVER_IN = 11, HOVER_OUT = 8;
/** A god's work display: present while it works, dimmed while it waits. */
interface Surface { group: T.Object3D; presence: number; age: number; update(dt: number, clock: number, active: boolean): void; beat(): void; dispose(): void }

export function buildPantheonFigures(scene: T.Scene, host: HTMLElement, camera: T.Camera, renderer: T.WebGLRenderer) {
  const root = new T.Group(); root.name = 'Pantheon figures'; scene.add(root);
  const sprite = sparkTexture();
  const sparks = buildSparks(sprite); root.add(sparks.points);
  const signals = buildSignals(sprite, root);
  // Marble and gold need something to reflect; this lights the statues only.
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
  const pedestal = buildPedestal();
  const figures: Figure[] = [];
  let disposed = false;
  for (const id of MANIFESTED_FIGURES) figures.push(createFigure(PANTHEON_FIGURES.find(f => f.id === id)!, root, pedestal, sprite));
  void figureModels().then(models => figures.forEach(figure => {
    const url = models[figure.spec.id];
    if (url && !disposed) void loadFigureModel(url).then(model => { if (!disposed) adopt(figure, model, environment); }).catch(error => console.warn(`[Olympus] ${figure.spec.name} model unavailable.`, error));
  }));
  const projected = new T.Vector3(), world = new T.Vector3(), local = new T.Vector3(), headWorld = new T.Vector3(), inverse = new T.Matrix4(), q = new T.Quaternion(), q2 = new T.Quaternion(), tilted = new T.Quaternion(), e = new T.Euler();
  const zeusFigure = figures.find(f => f.spec.id === 'zeus');
  const zeusFallback = new T.Vector3(...PANTHEON_FIGURES[0].station).add(new T.Vector3(0, FIGURE_HEIGHT * .55, 0));
  /** Where orchestration signals start and return: Zeus's bolt once he stands. */
  const zeusPoint = (out: T.Vector3) => zeusFigure?.tool ? zeusFigure.tool.getWorldPosition(out) : out.copy(zeusFallback);

  function update(missions: readonly Mission[], catalog: CommandCatalog | null, delta: number, clock: number, moving: boolean) {
    const skin = skinById(pantheonSkin()), highlighted = agentHighlightSnapshot();
    let signature = '';
    let working = 0;
    for (const f of figures) {
      const before = f.memory?.state;
      f.memory = nextFigureState(f.spec, missions, catalog, f.memory, clock);
      const state = f.memory.state;
      if (state !== before) enter(f, state, before ?? null, clock);
      if (f.spec.id !== 'zeus' && (state === 'working' || state === 'reviewing')) working++;
      signature += `${f.spec.id}:${state};`;
    }
    for (const f of figures) {
      const state = f.memory!.state;
      const dt = delta * f.spec.temperament.tempo * (state === 'dormant' ? DORMANT_TEMPO : 1);
      if (f.skin !== skin.id) applySkin(f, skin);
      attend(f, highlighted === f.spec.agent, state, delta, clock, moving);
      for (const d of f.materials) d.uniforms.time.value = clock;
      if (moving && state === 'idle' && clock >= f.nextGesture && f.current === f.actions.get('idle')) {
        play(f, pick(f, IDLE_GESTURES[f.spec.id]), true);
        f.nextGesture = clock + span(f.random, f.spec.temperament.gesture);
      }
      if (f.gestureEnds && f.current && f.current.time >= f.current.getClip().duration - .55) { f.gestureEnds = false; play(f, f.base, false); }
      // Take back last frame's glance first: the mixer only writes a bone when its clip value changes.
      undoGaze(f);
      const work = f.actions.get('work'), before = work?.time ?? 0, beat = WORK_BEAT[f.spec.id];
      f.mixer.update(dt);
      if (moving && work && work.isRunning() && work.getEffectiveWeight() > .5 && (before < beat && work.time >= beat || before > work.time && work.time >= beat)) onBeat(f);
      if (moving && clock >= f.nextGaze && !f.attended) { f.gazeTarget = chooseGaze(f, state); f.nextGaze = clock + span(f.random, state === 'working' || state === 'reviewing' ? [1.6, 3.4] : state === 'dormant' ? [9, 14] : f.spec.temperament.gaze); }
      f.group.updateMatrixWorld(true);
      applyGaze(f, dt, moving);
      animateLiveParts(f, state, clock);
      updateEffects(f, state, dt, clock, moving, working);
      place(f);
    }
    sparks.update(delta);
    signals.update(delta);
    return signature;
  }

  /**
   * Hover from the god or its Armory row: the figure lifts a little, grows
   * by about eight percent, brightens its rim, reflections and platform, is
   * backlit by a gold halo in the Armory highlight's colour, and glances at
   * the viewer unless it is at work. It blends over whatever clip is running.
   */
  function attend(f: Figure, wanted: boolean, state: FigureState, delta: number, clock: number, moving: boolean) {
    const want = wanted ? 1 : 0;
    f.hover = moving ? f.hover + (want - f.hover) * (1 - Math.exp(-delta * (want > f.hover ? HOVER_IN : HOVER_OUT))) : want;
    const busy = state === 'working' || state === 'reviewing' || state === 'assigned' || state === 'dormant';
    if (wanted && !f.attended && !busy) { f.attended = true; f.gazeTarget = 'viewer'; }
    if ((!wanted || busy) && f.attended) { f.attended = false; f.nextGaze = clock + .4; }
    const h = f.hover * f.hover * (3 - 2 * f.hover);
    if (Math.abs(h - f.shown) < 1e-4) return;
    f.shown = h;
    f.body.scale.setScalar(figureScale(f.spec.id) * (1 + .08 * h));
    f.body.position.y = .022 * h;
    for (const d of f.materials) { d.uniforms.rimColor.value.copy(d.rim).multiplyScalar(1 + h); d.material.envMapIntensity = d.env * (1 + .3 * h); }
    // The halo replaces the dark veil behind the figure rather than fighting it.
    f.shade.back.value = f.lighting.backShadow * (1 - .7 * h);
    f.shade.halo.value = h; f.halo.visible = h > .002;
    f.shade.contact.value = .72 * (1 + .25 * h);
  }

  function enter(f: Figure, state: FigureState, previous: FigureState | null, clock: number) {
    f.base = BASE[state];
    if (f.target) f.target.dataset.figureState = state;
    const chest = f.frame.localToWorld(world.set(0, 1.25, 0)).clone();
    if (state === 'assigned') { if (f.spec.id !== 'zeus') signals.fire(zeusPoint(new T.Vector3()), chest, 0xffd27a); play(f, 'assigned', true); return; }
    if (state === 'completed' && previous) { if (f.spec.id !== 'zeus') signals.fire(chest, zeusPoint(new T.Vector3()), f.spec.accent); play(f, 'complete', true); return; }
    f.platform.uniforms.tint.value.set(state === 'dormant' || state === 'unavailable' ? 0x8c8a96 : f.spec.accent);
    if (!(previous === 'assigned' && (state === 'working' || state === 'reviewing'))) play(f, f.base, false);
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
    if (state === 'dormant' || state === 'blocked') return 'down';
    if (state === 'working' || state === 'reviewing' || state === 'assigned') return f.spec.id === 'zeus' ? (r < .5 ? 'omega' : r < .8 ? 'tool' : 'forward') : r < .6 ? 'holo' : 'tool';
    if (state === 'waiting') return r < .7 ? 'holo' : 'omega';
    if (state === 'completed') return 'zeus';
    if (f.current === f.actions.get('idle_inspect')) return 'tool';
    const options = IDLE_GAZE[f.spec.id];
    const pool = options.filter(([n]) => n !== f.gazeTarget && !(n === 'zeus' && f.spec.id === 'zeus')), total = pool.reduce((s, [, w]) => s + w, 0);
    let pickValue = r * total;
    for (const [n, w] of pool) if ((pickValue -= w) <= 0) return n;
    return 'forward';
  }

  function gazePoint(f: Figure, out: T.Vector3) {
    const station = f.group.position;
    switch (f.gazeTarget) {
      case 'omega': return out.set(0, 0, 0);
      case 'zeus': return zeusPoint(out);
      case 'neighbour': { const n = PANTHEON_FIGURES.find(s => s.id !== f.spec.id && Math.sign(s.station[0]) !== Math.sign(station.x) && Math.abs(s.station[1] - station.y) < 60) ?? PANTHEON_FIGURES[0]; return out.set(n.station[0], n.station[1] + FIGURE_HEIGHT * .8, 0); }
      case 'tool': return f.tool ? f.tool.getWorldPosition(out) : f.frame.localToWorld(out.set(-.2, .75, .56));
      case 'holo': return f.surface ? f.surface.group.getWorldPosition(out) : f.frame.localToWorld(out.set(.4, 1.2, .5));
      case 'down': return f.frame.localToWorld(out.set(0, .2, 1.2));
      case 'viewer': return out.copy(camera.position);
      // The constellations overhead: Plugins above the left of the Omega, Skills in the upper right.
      case 'sky': return out.set(station.x < 0 ? -150 : 320, 260, -60);
      default: return f.frame.localToWorld(out.set(0, 1.62, 3));
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
    const k = 26 * f.spec.temperament.tempo ** 2 * (f.memory?.state === 'dormant' ? .2 : 1), c = 2 * Math.sqrt(k) * .92;
    if (!moving) { f.gaze.yaw = yaw * .4; f.gaze.pitch = pitch * .4; }
    else if (dt > 0) {
      f.gaze.vyaw += ((yaw - f.gaze.yaw) * k - f.gaze.vyaw * c) * dt; f.gaze.yaw += f.gaze.vyaw * dt;
      f.gaze.vpitch += ((pitch - f.gaze.pitch) * k - f.gaze.vpitch * c) * dt; f.gaze.pitch += f.gaze.vpitch * dt;
    }
    f.gaze.neck.setFromEuler(e.set(f.gaze.pitch * .35, f.gaze.yaw * .38, 0)); neck.quaternion.multiply(f.gaze.neck);
    f.gaze.head.setFromEuler(e.set(f.gaze.pitch * .65, f.gaze.yaw * .62, 0)); head.quaternion.multiply(f.gaze.head);
    neck.updateMatrixWorld(true);
  }

  function undoGaze(f: Figure) {
    f.bones.get('Neck')?.quaternion.multiply(q.copy(f.gaze.neck).invert());
    f.bones.get('Head')?.quaternion.multiply(q.copy(f.gaze.head).invert());
    f.gaze.neck.identity(); f.gaze.head.identity();
  }

  /** Themis's scales stay level under her hand and tip gently; harder while she weighs. */
  function animateLiveParts(f: Figure, state: FigureState, clock: number) {
    const beam = f.live.get('LiveBeam'); if (!beam?.parent) return;
    const weighing = state === 'reviewing' || state === 'assigned';
    const tilt = state === 'dormant' ? 0 : Math.sin(clock * (weighing ? 1.7 : .6)) * (weighing ? .16 : .045) + (weighing ? Math.sin(clock * 4.1) * .02 : 0);
    f.group.getWorldQuaternion(q2);
    beam.parent.getWorldQuaternion(q);
    beam.quaternion.copy(q.invert()).multiply(q2).multiply(tilted.setFromEuler(e.set(0, 0, tilt)));
    beam.updateMatrixWorld(true);
    for (const name of ['LivePanL', 'LivePanR']) {
      const pan = f.live.get(name); if (!pan) continue;
      beam.getWorldQuaternion(q);
      pan.quaternion.copy(q.invert()).multiply(q2);
    }
  }

  function onBeat(f: Figure) {
    f.surface?.beat();
    const at = f.tool ? f.tool.getWorldPosition(world) : f.frame.localToWorld(world.set(0, 1.2, .4));
    if (f.spec.id === 'hephaestus') { sparks.burst(at, 14, f.spec.accent); f.flash = 1; }
    else if (f.spec.id === 'zeus') { sparks.burst(at, 10, 0xffe2a0); f.flash = 1.3; }
    else { sparks.burst(at, 5, f.spec.accent, .45); f.flash = .5; }
  }

  function updateEffects(f: Figure, state: FigureState, dt: number, clock: number, moving: boolean, working: number) {
    const active = state === 'working' || state === 'assigned' || state === 'reviewing';
    // Zeus's aura widens with the number of gods at work.
    const aura = f.spec.id === 'zeus' && active ? Math.min(working, 4) * .12 : 0;
    const glow = state === 'dormant' ? .12 : state === 'unavailable' ? .18 : active ? 1 + aura : state === 'waiting' ? .62 : state === 'blocked' ? .4 : state === 'completed' ? .9 : .42;
    const u = f.platform.uniforms.glow;
    const target = glow * f.lighting.pedestal + .32 * f.hover;
    u.value += (target - u.value) * (moving ? 1 - Math.exp(-dt * 3) : 1);
    f.flash = Math.max(0, f.flash - dt * 5);
    const flicker = moving ? Math.sin(clock * 9.1) * .08 + Math.sin(clock * 23.7) * .05 : 0;
    f.light.intensity = (state === 'dormant' ? 0 : 900 * f.lighting.fill * (.18 + u.value * .55 + flicker * u.value) * (1 + .5 * f.hover)) + f.flash * 2600;
    if (f.surface) {
      const s = f.surface, want = active ? 1 : state === 'waiting' ? .55 : 0;
      s.presence += (want - s.presence) * (moving ? 1 - Math.exp(-dt * (want > s.presence ? 2.4 : 1.6)) : 1);
      s.group.visible = s.presence > .01;
      if (active && moving) s.age += dt;
      if (!active && s.presence < .02) s.age = 0;
      if (s.group.visible) s.update(moving ? dt : 0, clock, active);
    }
    // Embers drift up from the forge even at rest; idle effects stay quieter than work.
    if (moving && f.spec.id === 'hephaestus' && f.source !== 'pending') {
      f.ember -= dt;
      if (f.ember <= 0) { f.ember = span(f.random, active ? [.25, .6] : [1.2, 2.6]); sparks.ember(f.frame.localToWorld(world.set(-.17 + (f.random() - .5) * .1, .57, .57)), f.spec.accent); }
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
    projected.copy(f.group.position).add(world.set(0, FIGURE_HEIGHT * 1.02 * figureScale(f.spec.id), 0)).project(camera);
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
      figures.forEach(f => { f.mixer.stopAllAction(); f.surface?.dispose(); });
      sparks.dispose(); signals.dispose(); sprite.dispose(); environment.dispose();
      root.traverse(o => { const m = o as T.Mesh; m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach(x => x.dispose()); });
      scene.remove(root);
    },
  };
}

function createFigure(spec: FigureSpec, parent: T.Group, pedestal: T.Mesh, sprite: T.Texture): Figure {
  const group = new T.Group(); group.name = spec.name;
  group.position.set(...spec.station);
  // Turned toward the viewer and the Omega, tipped back so the dais reads from above.
  group.rotation.set(.16, Math.atan2(-60 - spec.station[0], 700), 0, 'YXZ');
  const frame = new T.Group(); frame.scale.setScalar(UNIT); group.add(frame);
  const stand = pedestal.clone(); stand.name = 'Pedestal'; frame.add(stand);
  const platform = buildPlatform(spec.accent); frame.add(platform.disc, platform.ring);
  const shade = buildShade(); frame.add(shade.halo, shade.back, shade.contact);
  const light = new T.PointLight(spec.accent, 0, FIGURE_HEIGHT * 2.2, 1.6); light.position.set(-.1, .95, .7); frame.add(light);
  parent.add(group);
  const body = new T.Group(); body.name = `${spec.name} body`; body.scale.setScalar(figureScale(spec.id)); frame.add(body);
  const skeleton = buildSkeleton(); body.add(skeleton.root);
  const surface = buildSurface(spec, sprite);
  if (surface) frame.add(surface.group);
  const figure: Figure = {
    spec, group, frame, body, bones: skeleton.bones, rest: restPose(skeleton.bones), mixer: new T.AnimationMixer(body), actions: new Map(), current: null, base: 'idle', gestureEnds: false,
    memory: null, random: seeded(spec.id), nextGesture: 0, lastGesture: null, nextGaze: 0, gazeTarget: 'forward', gaze: { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, neck: new T.Quaternion(), head: new T.Quaternion() },
    tool: null, live: new Map(), platform, light, flash: 0, source: 'pending', surface, target: null, anchor: '', ember: 1, model: null,
    shade: shade.uniforms, halo: shade.halo, materials: [], skin: null, lighting: skinById(pantheonSkin()).lighting, hover: 0, shown: -1, attended: false,
  };
  bindClips(figure, figureClips(spec.id));
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

/** Dark bronze drum with a gold lip; the glowing disc sits on its top face. */
function buildPedestal() {
  const profile = [[0, -.2], [.6, -.2], [.66, -.185], [.67, -.15], [.64, -.135], [.61, -.115], [.6, -.035], [.64, -.022], [.645, -.006], [.62, 0], [0, 0]].map(([x, y]) => new T.Vector2(x, y));
  const material = rimmed(new T.MeshStandardMaterial({ color: 0x2c2018, metalness: .85, roughness: .46 }), 0xd9a24e, .16);
  return new T.Mesh(new T.LatheGeometry(profile, 56), material);
}

/**
 * Depth without real-time shadow maps: a soft dark veil behind the figure
 * that separates it from stars and mountains, and a contact shadow under its
 * feet on the pedestal. On hover a gold halo shines from behind the figure.
 * All are single quads; the skin and hover set their strength.
 */
function buildShade() {
  const uniforms = { back: { value: .5 }, contact: { value: .72 }, halo: { value: 0 } };
  const veil = (fragment: string, strength: { value: number }) => new T.ShaderMaterial({
    uniforms: { strength }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float strength;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;${fragment}}`,
  });
  // Shaped like the figure: narrow, tallest at the shoulders, gone before the pedestal's rim.
  const back = new T.Mesh(new T.PlaneGeometry(1.5, 2.3), veil('float d=length(vec2(p.x*(1.15-.25*p.y),p.y*.92));float a=pow(1.-smoothstep(.12,1.,d),1.5)*smoothstep(-1.,-.72,p.y);gl_FragColor=vec4(.008,.01,.016,a*strength);', uniforms.back));
  back.position.set(0, 1.18, -.44); back.renderOrder = -1; back.name = 'Back shadow';
  const contact = new T.Mesh(new T.CircleGeometry(.36, 40), veil('float r=length(p);gl_FragColor=vec4(.01,.008,.006,pow(1.-smoothstep(0.,1.,r),1.6)*strength);', uniforms.contact));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, .003, .02); contact.renderOrder = 1; contact.name = 'Contact shadow';
  // The Armory row's gold (#f2cf86), hot at the shoulders, with faint rays; it fades before the pedestal so the platform keeps its own glow.
  const halo = new T.Mesh(new T.PlaneGeometry(2.5, 2.9), veil('float d=length(vec2(p.x*1.15,(p.y-.1)*1.02));float rays=.78+.22*pow(abs(sin(atan(p.y-.1,p.x)*7.)),6.);float wide=pow(1.-smoothstep(0.,1.,d),2.2)*.55*rays,core=exp(-d*d*10.);vec3 c=mix(vec3(.95,.64,.28),vec3(1.,.92,.76),core);c*=(core+wide)*smoothstep(-.95,-.5,p.y)*strength;gl_FragColor=vec4(c,min(max(c.r,max(c.g,c.b)),1.));', uniforms.halo));
  // Light adds to the scene, and its alpha lets it show over the page behind a transparent canvas.
  Object.assign(halo.material, { blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor });
  halo.position.set(0, 1.2, -.52); halo.renderOrder = -.5; halo.visible = false; halo.name = 'Hover halo';
  return { back, contact, halo, uniforms };
}

function buildPlatform(accent: number) {
  const uniforms = { glow: { value: .4 }, tint: { value: new T.Color(accent) } };
  const disc = new T.Mesh(new T.CircleGeometry(.62, 48), new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float glow;uniform vec3 tint;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float rim=smoothstep(.78,.93,r)*(1.-smoothstep(.93,1.,r));float pool=(1.-smoothstep(0.,.9,r))*.16;gl_FragColor=vec4(tint*(rim*.6+pool)*glow,1.);}',
  }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .005; disc.renderOrder = 2;
  const ring = new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new T.Vector3(Math.cos(i / 96 * Math.PI * 2) * .78, -.1, Math.sin(i / 96 * Math.PI * 2) * .78))), new T.LineBasicMaterial({ color: accent, transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending }));
  return { disc, ring, uniforms };
}

// ---------------------------------------------------------------- work surfaces

const lineMaterial = (color: T.ColorRepresentation, opacity = 0) => new T.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending });
const outline = (w: number, h: number) => new T.BufferGeometry().setFromPoints([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => new T.Vector3(x, y, 0)));
const disposeLines = (group: T.Object3D) => group.traverse(o => { const l = o as T.Line; l.geometry?.dispose(); (l.material as T.Material | undefined)?.dispose(); });

function buildSurface(spec: FigureSpec, sprite: T.Texture): Surface {
  switch (spec.id) {
    case 'hephaestus': return buildForgeHolo(spec.accent);
    case 'athena': return buildResearchPanels(spec.accent);
    case 'themis': return buildVerdictPanel(spec.accent);
    case 'zeus': return buildCrackle(spec.accent);
    case 'dionysus': return buildTrails(spec.accent, sprite);
  }
}

/** Hephaestus: an engineering surface where wireframe parts assemble and a circuit traces itself. */
function buildForgeHolo(accent: number): Surface {
  const holder = new T.Group(); holder.name = 'Engineering surface'; holder.visible = false;
  holder.position.set(.5, 1.28, .38); holder.rotation.y = -.35;
  const tone = new T.Color(accent).lerp(new T.Color(0xffe2b0), .35);
  const frameMat = lineMaterial(tone), gridMat = lineMaterial(tone), circuitMat = lineMaterial(tone);
  const w = .5, h = .34;
  holder.add(new T.LineLoop(outline(w, h), frameMat));
  const grid: T.Vector3[] = [];
  for (let i = 1; i < 6; i++) grid.push(new T.Vector3(-w / 2 + i * w / 6, -h / 2, 0), new T.Vector3(-w / 2 + i * w / 6, h / 2, 0));
  for (let i = 1; i < 4; i++) grid.push(new T.Vector3(-w / 2, -h / 2 + i * h / 4, 0), new T.Vector3(w / 2, -h / 2 + i * h / 4, 0));
  holder.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(grid), gridMat));
  const path = [[-.21, -.12], [-.12, -.12], [-.12, -.03], [-.02, -.03], [-.02, .09], [.08, .09], [.08, -.06], [.17, -.06], [.17, .12], [.21, .12]];
  const points: T.Vector3[] = [];
  for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < 8; s++) { const [ax, ay] = path[i], [bx, by] = path[i + 1]; points.push(new T.Vector3(ax + (bx - ax) * s / 8, ay + (by - ay) * s / 8, .002)); }
  const circuit = new T.Line(new T.BufferGeometry().setFromPoints(points), circuitMat); holder.add(circuit);
  const constructs = [new T.BoxGeometry(.075, .075, .075), new T.OctahedronGeometry(.05), new T.IcosahedronGeometry(.045)].map((g, i) => {
    const s = new T.LineSegments(new T.EdgesGeometry(g), lineMaterial(tone)); g.dispose();
    s.position.set(-.13 + i * .13, .25 + (i % 2) * .04, .06); holder.add(s); return s;
  });
  const surface: Surface = {
    group: holder, presence: 0, age: 0,
    update(dt) {
      const p = surface.presence;
      frameMat.opacity = p * .55; gridMat.opacity = p * .16; circuitMat.opacity = p * .85;
      // Constructs assemble one after another; the circuit traces itself in a six-second build.
      constructs.forEach((c, i) => { const k = T.MathUtils.smoothstep(surface.age, .35 + i * .5, 1.1 + i * .5); c.scale.setScalar(.25 + k * .75); c.rotation.y += dt * (.4 + i * .17); c.rotation.x += dt * .13; (c.material as T.LineBasicMaterial).opacity = p * k * .9; });
      circuit.geometry.setDrawRange(0, Math.max(2, Math.floor(points.length * Math.min(1, (surface.age % 6) / 4.2))));
      holder.scale.setScalar(.85 + p * .15);
    },
    beat() {},
    dispose: () => disposeLines(holder),
  };
  return surface;
}

/** Athena: research panels in an arc around her; her spear sweeps across them and they reorder. */
function buildResearchPanels(accent: number): Surface {
  const group = new T.Group(); group.name = 'Research panels'; group.visible = false;
  const tone = new T.Color(accent);
  const slots = [[-.62, 1.52, .18, .45], [-.7, 1.06, .26, .55], [.7, 1.5, .16, -.45], [.76, 1.04, .26, -.55]].map(([x, y, z, ry]) => ({ p: new T.Vector3(x, y, z), ry }));
  const panels = slots.map((slot, i) => {
    const panel = new T.Group(); panel.position.copy(slot.p); panel.rotation.y = slot.ry;
    const frame = lineMaterial(tone), content = lineMaterial(tone);
    panel.add(new T.LineLoop(outline(.26, .2), frame));
    const lines: T.Vector3[] = [];
    // Each panel draws a different figure: rows of text, a chart, a network, a document.
    if (i === 0) for (let r = 0; r < 5; r++) lines.push(new T.Vector3(-.1, .07 - r * .035, 0), new T.Vector3(-.1 + .2 * (.45 + ((r * 37) % 10) / 18), .07 - r * .035, 0));
    if (i === 1) for (let b = 0; b < 6; b++) { const hgt = .03 + ((b * 53) % 7) / 60; lines.push(new T.Vector3(-.09 + b * .036, -.08, 0), new T.Vector3(-.09 + b * .036, -.08 + hgt, 0)); }
    if (i === 2) { const n = [[-.08, .05], [0, .07], [.08, .03], [-.05, -.05], [.06, -.06]]; for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [2, 4]]) lines.push(new T.Vector3(n[a][0], n[a][1], 0), new T.Vector3(n[b][0], n[b][1], 0)); }
    if (i === 3) { lines.push(new T.Vector3(-.1, .07, 0), new T.Vector3(.02, .07, 0)); for (let r = 0; r < 4; r++) lines.push(new T.Vector3(-.1, .03 - r * .03, 0), new T.Vector3(.1, .03 - r * .03, 0)); }
    panel.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(lines), content));
    group.add(panel);
    return { panel, frame, content, slot: i, focus: 0 };
  });
  let focused = 0;
  const surface: Surface = {
    group, presence: 0, age: 0,
    update(dt, clock) {
      const p = surface.presence, ease = dt ? 1 - Math.exp(-dt * 3) : 1;
      panels.forEach((x, i) => {
        const slot = slots[x.slot];
        x.panel.position.lerp(slot.p, ease);
        x.panel.rotation.y += (slot.ry - x.panel.rotation.y) * ease;
        x.panel.position.y += Math.sin(clock * .9 + i * 1.7) * .004;
        x.focus = Math.max(i === focused ? .6 : 0, x.focus - dt * .4);
        x.frame.opacity = p * (.42 + x.focus * .5); x.content.opacity = p * (.5 + x.focus * .45);
        x.panel.scale.setScalar((.8 + p * .2) * (1 + x.focus * .08));
      });
    },
    beat() {
      // Two findings trade places and the arrival takes focus.
      const a = Math.floor(Math.random() * 4), b = (a + 1 + Math.floor(Math.random() * 3)) % 4;
      const pa = panels.find(x => x.slot === a)!, pb = panels.find(x => x.slot === b)!;
      pa.slot = b; pb.slot = a; focused = panels.indexOf(pa); pa.focus = 1;
    },
    dispose: () => disposeLines(group),
  };
  return surface;
}

/** Themis: a column of checks that light in turn while she weighs, then clear and begin again. */
function buildVerdictPanel(accent: number): Surface {
  const group = new T.Group(); group.name = 'Verification panel'; group.visible = false;
  group.position.set(.62, 1.26, .2); group.rotation.y = -.5;
  const tone = new T.Color(accent).lerp(new T.Color(0xffd27a), .35);
  const rows = [0, 1, 2].map(r => {
    const frame = lineMaterial(tone), mark = lineMaterial(0xfff4d6);
    const box = new T.LineLoop(outline(.11, .11), frame); box.position.y = .15 - r * .15; group.add(box);
    const check = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-.035, 0, .002), new T.Vector3(-.008, -.028, .002), new T.Vector3(.04, .032, .002)]), mark);
    check.position.y = box.position.y; group.add(check);
    return { frame, mark, lit: 0, on: false };
  });
  let next = 0;
  const surface: Surface = {
    group, presence: 0, age: 0,
    update(dt) {
      const p = surface.presence;
      rows.forEach(r => { r.lit += ((r.on ? 1 : 0) - r.lit) * (dt ? 1 - Math.exp(-dt * 5) : 1); r.frame.opacity = p * (.4 + r.lit * .35); r.mark.opacity = p * r.lit * .95; });
      group.scale.setScalar(.85 + p * .15);
    },
    beat() {
      if (next === rows.length) { rows.forEach(r => { r.on = false; }); next = 0; return; }
      rows[next++].on = true;
    },
    dispose: () => disposeLines(group),
  };
  return surface;
}

/** Zeus: restrained lightning that crawls over the bolt while any run is live. */
function buildCrackle(accent: number): Surface {
  const group = new T.Group(); group.name = 'Crackle'; group.visible = false;
  const material = lineMaterial(new T.Color(accent).lerp(new T.Color(0xffffff), .5));
  const count = 3, segments = 7;
  const strands = Array.from({ length: count }, () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(segments * 3), 3)); const l = new T.Line(g, material); l.frustumCulled = false; group.add(l); return l; });
  let regrow = 0, burst = 0;
  const surface: Surface = {
    group, presence: 0, age: 0,
    update(dt) {
      regrow -= dt; burst = Math.max(0, burst - dt * 2.5);
      // The crackle follows the bolt in Zeus's hand.
      const tool = group.parent?.getObjectByName('Tool');
      if (tool) { tool.getWorldPosition(group.position); group.parent!.worldToLocal(group.position); }
      if (regrow <= 0 && dt > 0) {
        regrow = .07 + Math.random() * .08;
        for (const s of strands) {
          const a = s.geometry.attributes.position as T.BufferAttribute;
          let x = 0, y = -.05, z = 0; const dx = (Math.random() - .5) * .1, dz = (Math.random() - .5) * .06;
          for (let i = 0; i < segments; i++) { a.setXYZ(i, x, y, z); x += dx + (Math.random() - .5) * .07; y += .06 + Math.random() * .04; z += dz + (Math.random() - .5) * .04; }
          a.needsUpdate = true;
        }
      }
      material.opacity = surface.presence * (.25 + (dt ? Math.random() : .5) * .25 + burst * .5);
    },
    beat() { burst = 1; regrow = 0; },
    dispose() { strands.forEach(s => s.geometry.dispose()); material.dispose(); },
  };
  return surface;
}

/** Dionysus: ribbons of violet light that wheel around him while he creates. */
function buildTrails(accent: number, sprite: T.Texture): Surface {
  const group = new T.Group(); group.name = 'Trails'; group.visible = false;
  const n = 48;
  const trails = [0, 1].map(k => {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const material = lineMaterial(new T.Color(accent).lerp(new T.Color(0xff9ce6), k * .4));
    const line = new T.Line(g, material); line.frustumCulled = false; group.add(line); return { g, material, phase: k * Math.PI };
  });
  const head = new T.Sprite(new T.SpriteMaterial({ map: sprite, color: accent, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); head.scale.setScalar(.12); group.add(head);
  let time = 0, swell = 0;
  const at = (t: number, phase: number, out: T.Vector3) => out.set(Math.sin(t * 1.3 + phase) * (.55 + .1 * Math.sin(t * .7)), 1.05 + .35 * Math.sin(t * .9 + phase * .5), Math.cos(t * 1.3 + phase) * .38 + .1);
  const v = new T.Vector3();
  const surface: Surface = {
    group, presence: 0, age: 0,
    update(dt) {
      time += dt * (1 + swell); swell = Math.max(0, swell - dt);
      trails.forEach(tr => {
        const a = tr.g.attributes.position as T.BufferAttribute;
        for (let i = 0; i < n; i++) { at(time - i * .03, tr.phase, v); a.setXYZ(i, v.x, v.y, v.z); }
        a.needsUpdate = true; tr.material.opacity = surface.presence * .6;
      });
      at(time, 0, head.position); (head.material as T.SpriteMaterial).opacity = surface.presence;
    },
    beat() { swell = 1.2; },
    dispose() { trails.forEach(t => { t.g.dispose(); t.material.dispose(); }); (head.material as T.Material).dispose(); },
  };
  return surface;
}

// ---------------------------------------------------------------- particles and signals

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
  points.frustumCulled = false; points.name = 'Sparks';
  let cursor = 0;
  const spawn = (at: T.Vector3, v: [number, number, number], l: number, g: number, c: number) => {
    const i = cursor; cursor = (cursor + 1) % count;
    position.set([at.x, at.y, at.z], i * 3); velocity.set(v, i * 3); life[i] = l; age[i] = 0; gravity[i] = g; tint[i].set(c).lerp(new T.Color(0xffffff), .35);
  };
  return {
    points,
    burst(at: T.Vector3, n: number, c: number, force = 1) { for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, s = (18 + Math.random() * 34) * force; spawn(at, [Math.cos(a) * s * .8, (14 + Math.random() * 30) * force, Math.sin(a) * s * .5], .35 + Math.random() * .5, -70 * force, c); } },
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

// ---------------------------------------------------------------- models

type Merge = (geometries: T.BufferGeometry[]) => T.BufferGeometry | null;
interface LoadedModel { root: T.Object3D; clips: T.AnimationClip[]; merge: Merge }
export async function loadFigureModel(url: string): Promise<LoadedModel> {
  const [{ GLTFLoader }, { mergeGeometries }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/BufferGeometryUtils.js')]);
  const gltf = await new GLTFLoader().loadAsync(url);
  // Mixamo exports prefix every bone ("mixamorig:Hips"); the contract uses the bare names.
  const bare = (n: string) => n.replace(/^mixamorig\d*[:_]?/, '');
  gltf.scene.traverse(o => { o.name = bare(o.name); });
  for (const clip of gltf.animations) clip.tracks.forEach(t => { const dot = t.name.lastIndexOf('.'); t.name = bare(t.name.slice(0, dot)) + t.name.slice(dot); });
  return { root: gltf.scene, clips: gltf.animations, merge: list => mergeGeometries(list) };
}

function adopt(f: Figure, model: LoadedModel, environment: T.Texture) {
  let rigged = false;
  model.root.traverse(o => { if ((o as T.SkinnedMesh).isSkinnedMesh || (o as T.Bone).isBone || RIG_NAMES.test(o.name)) rigged = true; });
  if (rigged) adoptRigged(f, model); else adoptStatue(f, model);
  f.materials = [];
  f.model?.traverse(o => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    occlusion(mesh.geometry);
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
      const standard = m as T.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial || standard.userData.dressed) continue;
      standard.userData.dressed = true;
      // Baked occlusion arrives as vertex colour and is read by the statue shader instead.
      standard.vertexColors = false;
      standard.envMap = environment;
      f.materials.push({ material: standard, uniforms: statueShader(standard), color: standard.color.clone(), emissive: standard.emissive.clone(), emissiveIntensity: standard.emissiveIntensity, rim: new T.Color(), env: standard.envMapIntensity });
    }
  });
  f.skin = null;
  f.anchor = ''; if (f.target) f.target.dataset.figureSource = f.source;
}

/** Writes a skin into a god's materials: uniforms and parameters only, so switching never recompiles. */
function applySkin(f: Figure, skin: Skin) {
  f.skin = skin.id; f.lighting = skin.lighting; f.shown = -1;
  const rim = rimColorFor(skin, f.spec.id);
  for (const d of f.materials) {
    const m = d.material, finish = finishFor(skin, f.spec.id, m.name);
    if (!finish) { d.rim.setRGB(0, 0, 0); d.uniforms.occlusion.value = skin.lighting.ao; d.uniforms.form.value = skin.lighting.form; d.uniforms.celestial.value = 0; continue; }
    if (finish.color === undefined) m.color.copy(d.color); else m.color.setHex(finish.color);
    // An accent recoloured by the skin glows in its new colour.
    if (m.name === 'accent') { if (finish.color === undefined) m.emissive.copy(d.emissive); else m.emissive.setHex(finish.color); }
    m.metalness = finish.metalness; m.roughness = finish.roughness; d.env = finish.env;
    if (finish.emissive !== undefined) m.emissiveIntensity = d.emissiveIntensity * finish.emissive;
    d.rim.setHex(rim).multiplyScalar(finish.rim * 1.35);
    d.uniforms.grain.value = finish.grain; d.uniforms.occlusion.value = skin.lighting.ao; d.uniforms.form.value = skin.lighting.form; d.uniforms.celestial.value = finish.celestial ?? 0;
  }
}

/** The statues' baked occlusion as one float per vertex; parts without it are fully open. */
function occlusion(geometry: T.BufferGeometry) {
  if (geometry.attributes.ao) return;
  const color = geometry.attributes.color, count = geometry.attributes.position.count, ao = new Float32Array(count).fill(1);
  if (color) for (let i = 0; i < count; i++) ao[i] = color.getX(i);
  geometry.setAttribute('ao', new T.BufferAttribute(ao, 1));
  geometry.deleteAttribute('color');
}

type StatueUniforms = { rimColor: { value: T.Color }; grain: { value: number }; occlusion: { value: number }; form: { value: number }; celestial: { value: number }; time: { value: number } };
const VALUE_NOISE = `float pantheonHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float pantheonNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(pantheonHash(i),pantheonHash(i+vec3(1,0,0)),f.x),mix(pantheonHash(i+vec3(0,1,0)),pantheonHash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(pantheonHash(i+vec3(0,0,1)),pantheonHash(i+vec3(1,0,1)),f.x),mix(pantheonHash(i+vec3(0,1,1)),pantheonHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
/**
 * The statue surface on top of three's standard material: weathering noise
 * fixed to the rest pose (it does not swim as the god moves), baked
 * occlusion on ambient light and in the folds, and a rim light that is
 * strongest from above and behind.
 */
function statueShader(material: T.MeshStandardMaterial): StatueUniforms {
  const uniforms: StatueUniforms = { rimColor: { value: new T.Color() }, grain: { value: 0 }, occlusion: { value: 0 }, form: { value: 0 }, celestial: { value: 0 }, time: { value: 0 } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float ao;\nvarying float vAo;\nvarying vec3 vRest;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAo=ao;vRest=position;');
    shader.fragmentShader = 'uniform vec3 rimColor;uniform float grain;uniform float occlusion;uniform float form;uniform float celestial;uniform float time;varying float vAo;varying vec3 vRest;\n' + VALUE_NOISE + '\n' + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
float weather=pantheonNoise(vRest*23.)*.65+pantheonNoise(vRest*67.)*.35;
float cavity=mix(1.,max(vAo,.22),occlusion);
// Form shading, as a sculpture photographed under one soft key: surfaces turned from the upper left fall
// gently into shade, and the figure darkens a little toward its feet. Hemisphere fill alone reads flat.
float keyFacing=dot(normalize(vNormal),normalize(vec3(-.45,.62,.65)));
float sculpt=mix(1.,smoothstep(-.55,.85,keyFacing)*.72+.28,form)*mix(1.,.72+.28*smoothstep(.1,1.35,vRest.y),form);
diffuseColor.rgb*=(1.+(weather-.5)*grain*1.6)*mix(1.,cavity,.7)*sculpt;
// Celestial: a nebula that drifts slowly through the figure, darkest in its folds.
float nebula=pantheonNoise(vRest*5.5+vec3(0.,time*.025,0.))*.7+pantheonNoise(vRest*13.-vec3(time*.02))*.3;
vec3 deepSky=mix(vec3(.015,.035,.11),vec3(.09,.2,.46),smoothstep(.25,.85,nebula))*cavity;
diffuseColor.rgb=mix(diffuseColor.rgb,deepSky*.18,celestial);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(weather-.5)*grain,.04,1.);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 rimNormal=normalize(vNormal);
float rimLight=pow(1.-clamp(dot(rimNormal,normalize(vViewPosition)),0.,1.),2.6)*mix(.45,1.2,clamp(rimNormal.y*.5+.5,0.,1.));
totalEmissiveRadiance+=rimColor*rimLight*cavity;
if(celestial>.001){
  // Stars sit in screen space, so the figure reads as a window onto the sky behind it.
  vec2 starGrid=gl_FragCoord.xy/2.2;vec2 starCell=floor(starGrid);vec2 starOffset=fract(starGrid)-.5;
  float starSeed=pantheonHash(vec3(starCell,3.7));
  float star=step(.8,starSeed)*smoothstep(.45,0.,length(starOffset))*(.5+.5*sin(time*(1.2+starSeed*2.)+starSeed*60.));
  float bright=step(.975,starSeed);
  // Fine dust between the stars, then a cool edge glow, so the centre stays deep like glass.
  float dust=pantheonHash(vec3(floor(gl_FragCoord.xy),9.1));
  float facing=clamp(dot(normalize(vNormal),normalize(vViewPosition)),0.,1.);
  totalEmissiveRadiance+=celestial*(deepSky*.3+vec3(.78,.87,1.)*(star*(.6+bright*1.1)+step(.93,dust)*.12)*cavity+vec3(.3,.55,1.)*pow(1.-facing,3.2)*.5);
}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse*=cavity*sculpt;reflectedLight.indirectSpecular*=cavity*mix(1.,sculpt,.6);`);
  };
  material.customProgramCacheKey = () => 'pantheon-statue';
  material.needsUpdate = true;
  return uniforms;
}

/**
 * Skins a static statue to the shared skeleton. Node names carry the binding
 * (`label@bones~power`, see build_figures.py): weights fall off with distance
 * to each allowed bone's segment, `Tool` and `Live` parts ride their bone as
 * nodes, and `root` parts stay on the pedestal. Parts merge into one mesh per
 * material, so a god is a handful of draw calls.
 */
function adoptStatue(f: Figure, model: LoadedModel) {
  // Bind in the rest pose, then put the current pose back (the mixer will not rewrite unchanged values).
  const posed = [...f.rest.keys()].map(b => [b, b.quaternion.clone(), b.position.clone()] as const);
  for (const [b, r] of f.rest) { b.quaternion.copy(r.q); b.position.copy(r.p); }
  model.root.updateMatrixWorld(true);
  const order = [...f.bones.keys()], index = new Map(order.map((n, i) => [n, i]));
  const segments = boneSegments();
  const skinned = new Map<T.Material, T.BufferGeometry[]>(), fixed = new Map<T.Material, T.BufferGeometry[]>();
  const keep: T.Object3D[] = [];
  const add = (map: Map<T.Material, T.BufferGeometry[]>, material: T.Material, geometry: T.BufferGeometry) => { const list = map.get(material) ?? []; list.push(geometry); map.set(material, list); };
  model.root.traverse(o => {
    if (o === model.root || keep.some(k => isInside(o, k))) return;
    const [label, binding = 'Hips'] = o.name.split('@');
    if (/^(Tool|Live)/.test(label)) { keep.push(o); return; }
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    occlusion(geometry);
    for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'ao') geometry.deleteAttribute(name);
    const material = mesh.material as T.Material;
    if (binding === 'root') { add(fixed, material, geometry); return; }
    const [names, power] = binding.split('~');
    const bones = (RIG_GROUPS[names] ?? names.split('+')).filter(b => index.has(b));
    weigh(geometry, bones, Number(power) || 4, segments, index);
    add(skinned, material, geometry);
  });
  const statue = new T.Group(); statue.name = `${f.spec.name} statue`;
  f.body.add(statue);
  f.body.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(order.map(n => f.bones.get(n) as T.Bone));
  for (const [material, list] of skinned) {
    const mesh = new T.SkinnedMesh(model.merge(list)!, material); mesh.frustumCulled = false;
    statue.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(skeleton, mesh.matrixWorld);
    list.forEach(g => g.dispose());
  }
  for (const [material, list] of fixed) { statue.add(new T.Mesh(model.merge(list)!, material)); list.forEach(g => g.dispose()); }
  const tidy = (name: string) => name.split('@')[0].replace(/_?\d+$/, '');
  for (const node of keep) {
    const binding = node.name.split('@')[1];
    const matrix = node.matrixWorld.clone();
    node.removeFromParent(); statue.add(node);
    matrix.decompose(node.position, node.quaternion, node.scale);
    node.traverse(c => { c.name = tidy(c.name); });
    statue.updateMatrixWorld(true);
    f.bones.get(binding)?.attach(node);
    if (node.name === 'Tool') f.tool = node;
    node.traverse(c => { if (c.name.startsWith('Live')) f.live.set(c.name, c); });
  }
  for (const [b, quaternion, position] of posed) { b.quaternion.copy(quaternion); b.position.copy(position); }
  f.model = statue; f.source = 'statue';
}
const isInside = (o: T.Object3D, ancestor: T.Object3D) => { for (let p: T.Object3D | null = o; p; p = p.parent) if (p === ancestor) return true; return false; };

/** Up to four bones per vertex, weighted by inverse distance to each bone's segment. */
function weigh(geometry: T.BufferGeometry, bones: string[], power: number, segments: Map<string, [T.Vector3, T.Vector3]>, index: Map<string, number>) {
  const position = geometry.attributes.position, count = position.count;
  const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
  const v = new T.Vector3(), closest = new T.Vector3();
  const lines = bones.map(b => { const [s, e] = segments.get(b)!; return { bone: index.get(b)!, line: new T.Line3(s, e) }; });
  const weights = new Float64Array(lines.length), order = lines.map((_, k) => k);
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(position, i);
    lines.forEach((l, k) => { l.line.closestPointToPoint(v, true, closest); weights[k] = 1 / (closest.distanceTo(v) ** power + 1e-9); });
    const top = order.slice().sort((a, b) => weights[b] - weights[a]).slice(0, 4);
    const total = top.reduce((s, k) => s + weights[k], 0);
    top.forEach((k, j) => { skinIndex[i * 4 + j] = lines[k].bone; skinWeight[i * 4 + j] = weights[k] / total; });
  }
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight, 4));
}

/** A commissioned, rigged model: its own skeleton, and its own clips when it has them. */
function adoptRigged(f: Figure, model: LoadedModel) {
  const box = new T.Box3().setFromObject(model.root), size = box.getSize(new T.Vector3());
  model.root.scale.setScalar(RIG_HEIGHT / Math.max(size.y, 1e-3));
  model.root.position.y = -box.min.y * model.root.scale.y;
  const bones = new Map<string, T.Object3D>();
  model.root.traverse(o => { if ((o as T.Bone).isBone || RIG_NAMES.test(o.name)) bones.set(o.name, o); });
  f.mixer.stopAllAction(); f.body.clear();
  f.body.add(model.root);
  f.bones = bones; f.rest = restPose(bones); f.mixer = new T.AnimationMixer(model.root); f.gaze.neck.identity(); f.gaze.head.identity();
  f.tool = model.root.getObjectByName('Tool') ?? model.root.getObjectByName('RightHand') ?? null;
  bindClips(f, model.clips.length ? model.clips : figureClips(f.spec.id));
  f.model = model.root; f.source = 'model';
  const state = f.memory?.state ?? 'idle';
  f.base = BASE[state];
  const action = f.actions.get(f.base); action?.play(); f.current = action ?? null;
}
