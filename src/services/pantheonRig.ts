import * as T from 'three';
import rig from './pantheonRig.json';
import type { FigureId } from './pantheonFigureState';

/**
 * The skeleton every Pantheon god shares, and each god's clips. Bones use the
 * Mixamo names (Hips, Spine1, RightForeArm…), so a rigged glTF from Mixamo or
 * AccuRIG can also drive the same behaviour. Joints, bone groups and hold
 * poses live in `pantheonRig.json`, which the Blender build script
 * (`scripts/pantheon/build_figures.py`) reads too: the statues are modelled
 * around these joints, and props are modelled where the hold pose puts them.
 *
 * Bone frames: every bone rests with identity rotation, the figure faces +Z,
 * and its left is +X. +X rotation tips a hanging limb backwards.
 */
export const RIG_HEIGHT = rig.height;
export const RIG_GROUPS = rig.groups as Record<string, string[]>;
export const figureScale = (id: FigureId) => (rig.scale as Record<FigureId, number>)[id] ?? 1;

export function buildSkeleton() {
  const bones = new Map<string, T.Bone>();
  for (const [name, parent, x, y, z] of rig.joints as [string, string | null, number, number, number][]) {
    const bone = new T.Bone(); bone.name = name; bone.position.set(x, y, z);
    if (parent) bones.get(parent)!.add(bone);
    bones.set(name, bone);
  }
  return { root: bones.get('Hips')!, bones };
}

/** Rest-pose joint positions in figure units, and where each bone's influence ends. */
export function boneSegments(): Map<string, [T.Vector3, T.Vector3]> {
  const at = new Map<string, T.Vector3>();
  for (const [name, parent, x, y, z] of rig.joints as [string, string | null, number, number, number][]) at.set(name, new T.Vector3(x, y, z).add(parent ? at.get(parent)! : new T.Vector3()));
  const tip: Record<string, [number, number, number]> = { Head: [0, .22, 0], LeftHand: [0, -.12, 0], RightHand: [0, -.12, 0], LeftFoot: [0, -.04, .14], RightFoot: [0, -.04, .14] };
  const next: Record<string, string> = { Hips: 'Spine', Spine2: 'Neck', LeftShoulder: 'LeftArm', RightShoulder: 'RightArm' };
  const child = new Map<string, string>();
  for (const [name, parent] of rig.joints as [string, string | null][]) if (parent && !child.has(parent)) child.set(parent, name);
  return new Map([...at].map(([name, start]) => {
    const end = tip[name] ? start.clone().add(new T.Vector3(...tip[name])) : at.get(next[name] ?? child.get(name)!)!.clone();
    return [name, [start, end]];
  }));
}

/** A fresnel rim in the figure's accent: celestial light without a second pass. */
export function rimmed<M extends T.MeshStandardMaterial>(material: M, color: number, strength: number) {
  const rim = { value: new T.Color(color).multiplyScalar(strength) };
  material.userData.rim = rim;
  material.onBeforeCompile = shader => {
    shader.uniforms.rimColor = rim;
    shader.fragmentShader = 'uniform vec3 rimColor;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float rimLight=pow(1.-clamp(dot(normalize(vNormal),normalize(vViewPosition)),0.,1.),2.6);
totalEmissiveRadiance+=rimColor*rimLight;`);
  };
  material.customProgramCacheKey = () => 'pantheon-rim';
  return material;
}

/** The clip contract every god provides (and a commissioned model must too). */
export const CLIP_NAMES = ['idle', 'idle_shift', 'idle_inspect', 'idle_adjust', 'assigned', 'work', 'wait', 'complete', 'blocked'] as const;
export type ClipName = typeof CLIP_NAMES[number];

/** The moment in each god's `work` loop that lands: a hammer strike, a bolt, a check. */
export const WORK_BEAT: Record<FigureId, number> = { hephaestus: .62, zeus: 1.05, athena: .85, themis: 1.9, dionysus: 1.1 };

// Clip authoring: each key lists [bone, x, y, z] Euler rotations. Absolute for
// Hephaestus (authored first); offsets from the hold pose for the others.
type Triple = readonly [number, number, number];
type Pose = Record<string, Triple>;
type Key = readonly [number, Pose];
const euler = new T.Euler(), quaternion = new T.Quaternion();

function clipMaker(hold: Pose) {
  const absolute = (...poses: Pose[]): Pose => Object.assign({}, hold, ...poses);
  const offset = (...poses: Pose[]): Pose => {
    const out: Record<string, Triple> = { ...hold };
    for (const p of poses) for (const [bone, [x, y, z]] of Object.entries(p)) { const [a, b, c] = out[bone] ?? [0, 0, 0]; out[bone] = [a + x, b + y, c + z]; }
    return out;
  };
  const clip = (name: ClipName, duration: number, keys: readonly Key[], hips?: readonly (readonly [number, number])[]) => {
    const names = new Set<string>(Object.keys(hold)); keys.forEach(([, p]) => Object.keys(p).forEach(n => names.add(n)));
    const tracks: T.KeyframeTrack[] = [...names].map(n => {
      const values: number[] = [];
      for (const [, pose] of keys) { const [x, y, z] = pose[n] ?? hold[n] ?? [0, 0, 0]; quaternion.setFromEuler(euler.set(x, y, z)); values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w); }
      return new T.QuaternionKeyframeTrack(`${n}.quaternion`, keys.map(([t]) => t), values);
    });
    if (hips) tracks.push(new T.VectorKeyframeTrack('Hips.position', hips.map(([t]) => t), hips.flatMap(([, x]) => [x, .98, 0])));
    return new T.AnimationClip(name, duration, tracks);
  };
  return { absolute, offset, clip };
}

const breathe = (d: number): Pose => ({ Spine1: [-.03 * d, 0, 0], Spine2: [-.025 * d, 0, 0], LeftShoulder: [0, 0, .035 * d], RightShoulder: [0, 0, -.035 * d] });
const SHIFT: Pose = { Spine: [0, .04, .05], LeftUpLeg: [0, 0, .05], LeftLeg: [.05, 0, 0] };
const SLUMP: Pose = { Spine1: [.1, 0, 0], Spine2: [.05, 0, 0], LeftShoulder: [0, 0, -.04], RightShoulder: [0, 0, .04] };
const SLUMP2: Pose = { Spine1: [.115, 0, 0], Spine2: [.06, 0, 0], LeftShoulder: [0, 0, -.045], RightShoulder: [0, 0, .045] };

export function figureClips(id: FigureId): T.AnimationClip[] {
  const hold = (rig.hold as unknown as Record<FigureId, Pose>)[id];
  const { absolute: A, offset: O, clip } = clipMaker(hold);
  // Shared by all five: breathing, a weight shift.
  const common = [
    clip('idle', 4.4, [[0, O()], [1.9, O(breathe(1))], [2.4, O(breathe(1))], [4.4, O()]]),
    clip('idle_shift', 3.4, [[0, O()], [1.1, O(SHIFT)], [2.4, O(SHIFT, { Spine: [0, 0, -.005] })], [3.4, O()]], [[0, 0], [1.1, -.035], [2.4, -.032], [3.4, 0]]),
  ];
  if (id === 'hephaestus') return [...common,
    // Lifts the hammer to eye level and turns it over in his hand.
    clip('idle_inspect', 5.2, [[0, A()], [1.1, A({ RightArm: [-.5, .3, -.05], RightForeArm: [-1.55, 0, 0], RightHand: [.5, 0, 1.25] })], [2.6, A({ RightArm: [-.55, .32, -.05], RightForeArm: [-1.6, 0, 0], RightHand: [.5, .7, 1.25], Spine1: [.05, -.06, 0], LeftArm: [-.25, 0, -.05], LeftForeArm: [-1.2, 0, 0] })], [3.8, A({ RightArm: [-.5, .3, -.05], RightForeArm: [-1.55, 0, 0], RightHand: [.5, .2, 1.25] })], [5.2, A()]]),
    clip('idle_adjust', 2.8, [[0, A()], [.8, A({ RightForeArm: [-.95, 0, 0], RightHand: [0, 0, .5], LeftArm: [-.4, 0, -.05], LeftForeArm: [-1.1, 0, 0] })], [1.9, A({ RightForeArm: [-.9, 0, 0], RightHand: [0, 0, -.2], LeftArm: [-.35, 0, -.05], LeftForeArm: [-1.05, 0, 0] })], [2.8, A()]]),
    // Acknowledgement: chest lifts, the hammer rises a hand's width toward the summons.
    clip('assigned', 1.6, [[0, A()], [.55, A({ Spine2: [-.08, 0, 0], RightArm: [-.5, 0, -.1], RightForeArm: [-1.1, 0, 0] })], [1.6, A({ RightArm: [-.3, 0, -.1], RightForeArm: [-.9, 0, 0] })]]),
    // Forging: wind-up, strike on the anvil at the beat, recover.
    clip('work', 1.5, [
      [0, A({ RightArm: [-.3, .1, -.25], RightForeArm: [-.6, 0, 0], Spine: [0, -.06, 0], Spine1: [.02, .08, 0] })],
      [.45, A({ RightArm: [-2.25, .25, -.35], RightForeArm: [-.95, 0, 0], Spine: [0, -.05, 0], Spine1: [-.08, .1, 0], LeftArm: [-.3, 0, .2] })],
      [.62, A({ RightArm: [-.25, .1, -.2], RightForeArm: [-.15, 0, 0], Spine: [0, -.08, 0], Spine1: [.16, .1, 0], LeftArm: [-.2, 0, .18] })],
      [.8, A({ RightArm: [-.45, .12, -.28], RightForeArm: [-.55, 0, 0], Spine: [0, -.07, 0], Spine1: [.1, .09, 0] })],
      [1.5, A({ RightArm: [-.3, .1, -.25], RightForeArm: [-.6, 0, 0], Spine: [0, -.06, 0], Spine1: [.02, .08, 0] })]]),
    clip('wait', 3.6, [[0, A({ RightArm: [-.05, 0, -.1], RightForeArm: [-.4, 0, 0], Spine: [0, -.05, 0], LeftArm: [-.25, 0, .05], LeftForeArm: [-1.25, 0, .2] })], [1.8, A({ RightArm: [-.05, 0, -.1], RightForeArm: [-.42, 0, 0], Spine: [0, -.05, 0], Spine1: [-.02, 0, 0], LeftArm: [-.27, 0, .05], LeftForeArm: [-1.28, 0, .2] })], [3.6, A({ RightArm: [-.05, 0, -.1], RightForeArm: [-.4, 0, 0], Spine: [0, -.05, 0], LeftArm: [-.25, 0, .05], LeftForeArm: [-1.25, 0, .2] })]]),
    clip('complete', 2.4, [[0, A()], [.7, A({ RightArm: [-1.35, 0, -.2], RightForeArm: [-.7, 0, 0], Spine2: [-.07, 0, 0] })], [1.4, A({ RightArm: [-1.3, 0, -.2], RightForeArm: [-.72, 0, 0], Spine2: [-.06, 0, 0] })], [2.4, A()]]),
    clip('blocked', 4, [[0, A(SLUMP, { RightForeArm: [-.3, 0, 0] })], [2, A(SLUMP2, { RightForeArm: [-.32, 0, 0] })], [4, A(SLUMP, { RightForeArm: [-.3, 0, 0] })]]),
  ];
  if (id === 'zeus') return [...common,
    // Turns the bolt in his fist and studies it.
    clip('idle_inspect', 5, [[0, O()], [1.2, O({ RightArm: [.15, .2, .25], RightForeArm: [-.2, 0, 0], RightHand: [0, .6, 0], Spine1: [0, -.06, 0] })], [3.4, O({ RightArm: [.17, .22, .25], RightForeArm: [-.22, 0, 0], RightHand: [0, -.4, 0], Spine1: [0, -.07, 0] })], [5, O()]]),
    // Lifts the orb a little and lets it settle.
    clip('idle_adjust', 3, [[0, O()], [1, O({ LeftArm: [-.18, 0, 0], LeftForeArm: [-.22, 0, 0], Spine2: [-.03, 0, 0] })], [2, O({ LeftArm: [-.16, 0, 0], LeftForeArm: [-.2, 0, 0] })], [3, O()]]),
    clip('assigned', 1.6, [[0, O()], [.6, O({ RightArm: [-.55, 0, .05], RightForeArm: [.2, 0, 0], Spine2: [-.07, 0, 0] })], [1.6, O({ RightArm: [-.3, 0, 0] })]]),
    // Orchestrating: raises the bolt, casts it forward at the beat, draws it back.
    clip('work', 2.4, [
      [0, O({ RightArm: [-.3, 0, 0] })],
      [.75, O({ RightArm: [-1.85, .1, .2], RightForeArm: [1.05, 0, 0], Spine1: [-.05, -.06, 0], LeftArm: [-.2, 0, .05] })],
      [1.05, O({ RightArm: [-1.15, .05, .12], RightForeArm: [1.45, 0, 0], Spine1: [.06, -.1, 0], Spine: [0, -.05, 0], LeftArm: [-.3, 0, .1] })],
      [1.5, O({ RightArm: [-.9, 0, .1], RightForeArm: [1.1, 0, 0], Spine1: [.03, -.06, 0] })],
      [2.4, O({ RightArm: [-.3, 0, 0] })]]),
    clip('wait', 3.8, [[0, O({ RightArm: [.15, 0, .15], RightForeArm: [.3, 0, 0], LeftForeArm: [.2, 0, 0] })], [1.9, O({ RightArm: [.14, 0, .15], RightForeArm: [.32, 0, 0], LeftForeArm: [.22, 0, 0], Spine1: [-.02, 0, 0] })], [3.8, O({ RightArm: [.15, 0, .15], RightForeArm: [.3, 0, 0], LeftForeArm: [.2, 0, 0] })]]),
    clip('complete', 2.4, [[0, O()], [.8, O({ RightArm: [-1.6, 0, .15], RightForeArm: [1.2, 0, 0], Spine2: [-.07, 0, 0] })], [1.5, O({ RightArm: [-1.55, 0, .15], RightForeArm: [1.15, 0, 0], Spine2: [-.06, 0, 0] })], [2.4, O()]]),
    clip('blocked', 4, [[0, O(SLUMP, { RightArm: [.35, 0, .3], RightForeArm: [.6, 0, 0], LeftForeArm: [.4, 0, 0] })], [2, O(SLUMP2, { RightArm: [.36, 0, .3], RightForeArm: [.62, 0, 0], LeftForeArm: [.42, 0, 0] })], [4, O(SLUMP, { RightArm: [.35, 0, .3], RightForeArm: [.6, 0, 0], LeftForeArm: [.4, 0, 0] })]]),
  ];
  if (id === 'athena') return [...common,
    // Turns to look over her shield.
    clip('idle_inspect', 4.6, [[0, O()], [1.2, O({ LeftArm: [-.2, -.2, -.05], LeftForeArm: [-.15, 0, 0], Spine1: [0, .12, 0] })], [3.2, O({ LeftArm: [-.22, -.24, -.05], LeftForeArm: [-.17, 0, 0], Spine1: [0, .14, 0] })], [4.6, O()]]),
    // Re-grips the spear.
    clip('idle_adjust', 2.6, [[0, O()], [.7, O({ RightForeArm: [.18, 0, 0], RightArm: [.05, 0, 0] })], [1.6, O({ RightForeArm: [-.06, 0, 0] })], [2.6, O()]]),
    clip('assigned', 1.6, [[0, O()], [.6, O({ RightArm: [-.2, 0, 0], Spine2: [-.07, 0, 0], LeftArm: [-.1, 0, 0] })], [1.6, O({ RightArm: [-.08, 0, 0] })]]),
    // Research: the spear tip points across her panels, one after another.
    clip('work', 3.4, [
      [0, O({ Spine1: [0, .05, 0] })],
      [.85, O({ RightArm: [-.3, .35, .3], RightForeArm: [-.1, 0, 0], Spine1: [0, -.12, 0], Spine: [0, -.04, 0] })],
      [1.7, O({ RightArm: [-.28, .3, .26], RightForeArm: [-.08, 0, 0], Spine1: [0, -.1, 0] })],
      [2.5, O({ RightArm: [-.12, -.1, -.05], LeftArm: [-.1, -.15, 0], Spine1: [0, .14, 0] })],
      [3.4, O({ Spine1: [0, .05, 0] })]]),
    clip('wait', 3.6, [[0, O({ LeftArm: [.1, 0, 0], LeftForeArm: [.3, 0, 0], RightArm: [.05, 0, 0] })], [1.8, O({ LeftArm: [.1, 0, 0], LeftForeArm: [.32, 0, 0], RightArm: [.05, 0, 0], Spine1: [-.02, 0, 0] })], [3.6, O({ LeftArm: [.1, 0, 0], LeftForeArm: [.3, 0, 0], RightArm: [.05, 0, 0] })]]),
    clip('complete', 2.4, [[0, O()], [.8, O({ RightArm: [-.35, 0, 0], LeftArm: [-.25, 0, 0], Spine2: [-.07, 0, 0] })], [1.5, O({ RightArm: [-.33, 0, 0], LeftArm: [-.23, 0, 0] })], [2.4, O()]]),
    clip('blocked', 4, [[0, O(SLUMP, { LeftForeArm: [.55, 0, 0], RightArm: [.1, 0, 0] })], [2, O(SLUMP2, { LeftForeArm: [.57, 0, 0], RightArm: [.1, 0, 0] })], [4, O(SLUMP, { LeftForeArm: [.55, 0, 0], RightArm: [.1, 0, 0] })]]),
  ];
  if (id === 'themis') return [...common,
    // Raises the scroll to read.
    clip('idle_inspect', 5, [[0, O()], [1.3, O({ LeftArm: [-.35, 0, -.08], LeftForeArm: [-.3, 0, 0], Spine1: [.04, .06, 0] })], [3.5, O({ LeftArm: [-.37, 0, -.08], LeftForeArm: [-.32, 0, 0], Spine1: [.05, .07, 0] })], [5, O()]]),
    clip('idle_adjust', 2.8, [[0, O()], [.9, O({ RightArm: [-.12, 0, -.06], RightForeArm: [.1, 0, 0] })], [1.9, O({ RightArm: [-.1, 0, -.05] })], [2.8, O()]]),
    clip('assigned', 1.6, [[0, O()], [.6, O({ RightArm: [-.25, 0, 0], Spine2: [-.07, 0, 0] })], [1.6, O({ RightArm: [-.1, 0, 0] })]]),
    // Weighing: scales lifted and studied, the scroll read, a judgement at the beat.
    clip('work', 3.8, [
      [0, O({ RightArm: [-.12, 0, 0], LeftArm: [-.3, 0, -.06], LeftForeArm: [-.3, 0, 0] })],
      [1.1, O({ RightArm: [-.22, 0, -.05], LeftArm: [-.32, 0, -.06], LeftForeArm: [-.32, 0, 0], Spine1: [0, -.1, 0] })],
      [1.9, O({ RightArm: [-.18, 0, -.03], LeftArm: [-.34, 0, -.06], LeftForeArm: [-.34, 0, 0], Spine1: [.04, .05, 0] })],
      [2.9, O({ RightArm: [-.14, 0, 0], LeftArm: [-.3, 0, -.06], LeftForeArm: [-.3, 0, 0], Spine1: [.03, .08, 0] })],
      [3.8, O({ RightArm: [-.12, 0, 0], LeftArm: [-.3, 0, -.06], LeftForeArm: [-.3, 0, 0] })]]),
    clip('wait', 3.6, [[0, O({ RightArm: [.3, 0, .3], RightForeArm: [.2, 0, 0] })], [1.8, O({ RightArm: [.31, 0, .3], RightForeArm: [.22, 0, 0], Spine1: [-.02, 0, 0] })], [3.6, O({ RightArm: [.3, 0, .3], RightForeArm: [.2, 0, 0] })]]),
    clip('complete', 2.4, [[0, O()], [.8, O({ RightArm: [-.4, 0, 0], Spine2: [-.07, 0, 0] })], [1.5, O({ RightArm: [-.38, 0, 0] })], [2.4, O()]]),
    clip('blocked', 4, [[0, O(SLUMP, { RightArm: [.45, 0, .45], RightForeArm: [.3, 0, 0] })], [2, O(SLUMP2, { RightArm: [.46, 0, .45], RightForeArm: [.32, 0, 0] })], [4, O(SLUMP, { RightArm: [.45, 0, .45], RightForeArm: [.3, 0, 0] })]]),
  ];
  // Dionysus.
  return [...common,
    // Swirls the cup and watches the wine turn.
    clip('idle_inspect', 4.4, [[0, O()], [1, O({ LeftHand: [0, 0, .3], LeftForeArm: [-.15, 0, 0], Spine1: [0, .06, 0] })], [2, O({ LeftHand: [.2, 0, -.25], LeftForeArm: [-.18, 0, 0], Spine1: [0, .07, 0] })], [3, O({ LeftHand: [-.15, 0, .2], LeftForeArm: [-.15, 0, 0] })], [4.4, O()]]),
    clip('idle_adjust', 3, [[0, O()], [1, O({ RightArm: [-.12, 0, -.06], RightForeArm: [-.15, 0, 0], Spine: [0, 0, -.03] })], [2, O({ RightArm: [-.1, 0, -.05] })], [3, O()]]),
    clip('assigned', 1.6, [[0, O()], [.6, O({ LeftArm: [-.35, 0, .1], Spine2: [-.07, 0, 0] })], [1.6, O({ LeftArm: [-.12, 0, 0] })]]),
    // Creating: a swaying turn, the cup drawing an arc of light.
    clip('work', 2.8, [
      [0, O({ Spine: [0, 0, .03] })],
      [.7, O({ LeftArm: [-.25, -.25, .2], LeftForeArm: [-.1, 0, 0], Spine: [0, .05, -.02], Spine1: [0, .1, 0] })],
      [1.1, O({ LeftArm: [-.45, -.1, .3], Spine: [0, .03, -.04], Spine1: [0, .06, 0] })],
      [2, O({ LeftArm: [-.15, .2, .1], RightArm: [-.15, 0, -.1], Spine: [0, -.05, .03], Spine1: [0, -.08, 0] })],
      [2.8, O({ Spine: [0, 0, .03] })]], [[0, .01], [1.1, -.02], [2, .015], [2.8, .01]]),
    clip('wait', 3.6, [[0, O({ LeftArm: [.15, 0, -.1], LeftForeArm: [.35, 0, 0] })], [1.8, O({ LeftArm: [.15, 0, -.1], LeftForeArm: [.37, 0, 0], Spine1: [-.02, 0, 0] })], [3.6, O({ LeftArm: [.15, 0, -.1], LeftForeArm: [.35, 0, 0] })]]),
    clip('complete', 2.4, [[0, O()], [.8, O({ LeftArm: [-.6, 0, .05], Spine2: [-.07, 0, 0] })], [1.5, O({ LeftArm: [-.58, 0, .05] })], [2.4, O()]]),
    clip('blocked', 4, [[0, O(SLUMP, { LeftArm: [.25, 0, -.2], LeftForeArm: [.6, 0, 0] })], [2, O(SLUMP2, { LeftArm: [.26, 0, -.2], LeftForeArm: [.62, 0, 0] })], [4, O(SLUMP, { LeftArm: [.25, 0, -.2], LeftForeArm: [.6, 0, 0] })]]),
  ];
}
