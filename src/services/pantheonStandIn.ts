import * as T from 'three';

/**
 * A stand-in figure for proving the living Pantheon before the commissioned
 * art exists: a bronze statue built from primitives on a humanoid skeleton
 * named to the Mixamo convention (Hips, Spine1, RightForeArm…), which is what
 * Meshy, Tripo, AccuRIG and Mixamo export. The behaviour layer addresses bones
 * by these names, so a rigged glTF with the same skeleton replaces this
 * without code changes. This is not the art; see docs/PANTHEON-FIGURES.md.
 *
 * Bone frames: every bone rests with identity rotation, the figure faces +Z,
 * and its left is +X. +X rotation tips a hanging limb backwards.
 */
export const STAND_IN_HEIGHT = 1.86;

export interface StandIn { root: T.Group; bones: Map<string, T.Bone>; clips: T.AnimationClip[]; hammerHead: T.Object3D; dispose(): void }

const bone = (name: string, parent: T.Object3D | null, x: number, y: number, z = 0) => { const b = new T.Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b; };

export function buildHephaestusStandIn(accent: number): StandIn {
  const root = new T.Group(); root.name = 'Hephaestus stand-in';
  const bones = new Map<string, T.Bone>();
  const add = (b: T.Bone) => { bones.set(b.name, b); return b; };
  const hips = add(bone('Hips', root, 0, .98));
  const spine = add(bone('Spine', hips, 0, .1)), spine1 = add(bone('Spine1', spine, 0, .12)), spine2 = add(bone('Spine2', spine1, 0, .14));
  const neck = add(bone('Neck', spine2, 0, .16)), head = add(bone('Head', neck, 0, .08));
  const arm = (side: 'Left' | 'Right', s: number) => {
    const shoulder = add(bone(`${side}Shoulder`, spine2, .07 * s, .12));
    const upper = add(bone(`${side}Arm`, shoulder, .13 * s, -.01));
    const fore = add(bone(`${side}ForeArm`, upper, 0, -.29));
    const hand = add(bone(`${side}Hand`, fore, 0, -.26));
    return { shoulder, upper, fore, hand };
  };
  const left = arm('Left', 1), right = arm('Right', -1);
  const leg = (side: 'Left' | 'Right', s: number) => {
    const up = add(bone(`${side}UpLeg`, hips, .1 * s, -.05));
    const knee = add(bone(`${side}Leg`, up, 0, -.43));
    const foot = add(bone(`${side}Foot`, knee, 0, -.44));
    return { up, knee, foot };
  };
  const lLeg = leg('Left', 1), rLeg = leg('Right', -1);

  const bronze = rimmed(new T.MeshStandardMaterial({ color: 0x7a4a24, metalness: .88, roughness: .34 }), accent, .55);
  const gold = rimmed(new T.MeshStandardMaterial({ color: 0xd9a24e, metalness: 1, roughness: .26, emissive: 0x3a2008, emissiveIntensity: .4 }), 0xffd08a, .7);
  const cloth = rimmed(new T.MeshStandardMaterial({ color: 0x3b2516, metalness: .35, roughness: .7 }), accent, .35);
  const iron = rimmed(new T.MeshStandardMaterial({ color: 0x4a423c, metalness: .85, roughness: .4 }), accent, .4);
  const molten = new T.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: .35, metalness: .4, roughness: .4 });
  const materials = [bronze, gold, cloth, iron, molten];
  const geometries: T.BufferGeometry[] = [];
  const part = (geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geometries.push(geometry); const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
  };
  const limb = (r1: number, r2: number, length: number) => new T.CylinderGeometry(r1, r2, length, 12, 1);
  const ball = (r: number) => new T.SphereGeometry(r, 16, 12);

  // Torso: a broad smith's chest, belted waist, leather apron over a short chiton.
  part(new T.CylinderGeometry(.15, .12, .14, 14), cloth, hips, 0, .02);
  part(new T.CylinderGeometry(.14, .15, .16, 14), bronze, spine, 0, .06);
  part(new T.CylinderGeometry(.2, .15, .22, 16), bronze, spine1, 0, .1);
  part(new T.CylinderGeometry(.24, .2, .12, 16), bronze, spine2, 0, .06);
  part(new T.TorusGeometry(.15, .022, 8, 24), gold, spine, 0, -.01, 0, Math.PI / 2);
  part(new T.CylinderGeometry(.16, .25, .36, 14, 1, true), cloth, hips, 0, -.15);
  part(new T.BoxGeometry(.2, .42, .02), cloth, hips, 0, -.12, .17, -.08);
  part(ball(.11), gold, left.shoulder, .1, .02).scale.set(1, .7, 1.05);
  part(ball(.11), gold, right.shoulder, -.1, .02).scale.set(1, .7, 1.05);
  // Head: bearded, with a craftsman's cap.
  part(limb(.05, .06, .1), bronze, neck, 0, .04);
  part(ball(.095), bronze, head, 0, .08).scale.set(.95, 1.08, 1);
  part(new T.ConeGeometry(.07, .15, 10), bronze, head, 0, .0, .055, Math.PI * .92);
  part(new T.SphereGeometry(.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, head, 0, .1, -.008).scale.set(1, .75, 1.05);
  // Arms and legs.
  for (const [a, s] of [[left, 1], [right, -1]] as const) {
    part(limb(.055, .045, .27), bronze, a.upper, 0, -.14);
    part(limb(.048, .038, .24), bronze, a.fore, 0, -.12);
    part(limb(.052, .05, .08), gold, a.fore, 0, -.19);
    part(ball(.045), bronze, a.hand, 0, -.04).scale.set(.85, 1.2, .8);
    void s;
  }
  for (const l of [lLeg, rLeg]) {
    part(limb(.075, .055, .42), bronze, l.up, 0, -.21);
    part(limb(.055, .042, .42), bronze, l.knee, 0, -.21);
    part(limb(.06, .06, .12), gold, l.knee, 0, -.33);
    part(new T.BoxGeometry(.09, .05, .2), bronze, l.foot, 0, -.025, .05);
  }
  // The hammer rides in the right hand, head forward and down from the grip.
  const hammer = new T.Group(); hammer.name = 'Hammer'; hammer.position.set(0, -.06, .02); hammer.rotation.x = Math.PI / 2 + .6; right.hand.add(hammer);
  part(limb(.016, .02, .5), cloth, hammer, 0, .14);
  const hammerHead = part(new T.BoxGeometry(.2, .1, .1), iron, hammer, 0, .38);
  part(new T.BoxGeometry(.205, .02, .105), molten, hammerHead, 0, 0);
  // An anvil beside him on the platform.
  const anvil = new T.Group(); anvil.name = 'Anvil'; anvil.position.set(-.2, 0, .56); root.add(anvil);
  part(new T.CylinderGeometry(.05, .09, .62, 10), bronze, anvil, 0, .31);
  part(new T.BoxGeometry(.32, .09, .15), iron, anvil, 0, .665);
  part(new T.ConeGeometry(.05, .14, 8), iron, anvil, -.22, .665, 0, 0, 0, Math.PI / 2);
  part(new T.BoxGeometry(.3, .012, .13), molten, anvil, 0, .713);

  const clips = hephaestusClips();
  return { root, bones, clips, hammerHead, dispose: () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
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

// Clip authoring: each key lists [bone, x, y, z] Euler offsets from rest.
type Pose = Record<string, readonly [number, number, number]>;
const HOLD: Pose = {
  RightArm: [-.12, 0, -.1], RightForeArm: [-.75, 0, 0], RightHand: [0, 0, 0],
  LeftArm: [.05, 0, .12], LeftForeArm: [-.18, 0, 0], LeftUpLeg: [0, 0, .02], RightUpLeg: [0, 0, -.04],
};
const euler = new T.Euler(), quaternion = new T.Quaternion();
function clip(name: string, duration: number, keys: readonly (readonly [number, Pose])[], hips?: readonly (readonly [number, number])[]) {
  const names = new Set<string>(Object.keys(HOLD)); keys.forEach(([, p]) => Object.keys(p).forEach(n => names.add(n)));
  const tracks: T.KeyframeTrack[] = [...names].map(n => {
    const values: number[] = [];
    for (const [, pose] of keys) { const [x, y, z] = pose[n] ?? HOLD[n] ?? [0, 0, 0]; quaternion.setFromEuler(euler.set(x, y, z)); values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w); }
    return new T.QuaternionKeyframeTrack(`${n}.quaternion`, keys.map(([t]) => t), values);
  });
  if (hips) tracks.push(new T.VectorKeyframeTrack('Hips.position', hips.map(([t]) => t), hips.flatMap(([, x]) => [x, .98, 0])));
  return new T.AnimationClip(name, duration, tracks);
}
const merge = (...poses: Pose[]): Pose => Object.assign({}, HOLD, ...poses);

/** The clip contract a commissioned model must also provide; see docs/PANTHEON-FIGURES.md. */
export const CLIP_NAMES = ['idle', 'idle_shift', 'idle_inspect', 'idle_adjust', 'assigned', 'work', 'wait', 'complete', 'blocked'] as const;
export type ClipName = typeof CLIP_NAMES[number];

function hephaestusClips() {
  const breathe = (d: number): Pose => ({ Spine1: [-.03 * d, 0, 0], Spine2: [-.025 * d, 0, 0], LeftShoulder: [0, 0, .035 * d], RightShoulder: [0, 0, -.035 * d] });
  return [
    clip('idle', 4.4, [[0, merge()], [1.9, merge(breathe(1))], [2.4, merge(breathe(1))], [4.4, merge()]]),
    clip('idle_shift', 3.4, [[0, merge()], [1.1, merge({ Spine: [0, .04, .05], LeftUpLeg: [0, 0, .07], RightUpLeg: [0, 0, .02], LeftLeg: [.05, 0, 0] })], [2.4, merge({ Spine: [0, .04, .045], LeftUpLeg: [0, 0, .065], RightUpLeg: [0, 0, .02] })], [3.4, merge()]], [[0, 0], [1.1, -.035], [2.4, -.032], [3.4, 0]]),
    // Lifts the hammer to eye level and turns it over in his hand.
    clip('idle_inspect', 5.2, [[0, merge()], [1.1, merge({ RightArm: [-.5, .3, -.05], RightForeArm: [-1.55, 0, 0], RightHand: [.5, 0, 1.25] })], [2.6, merge({ RightArm: [-.55, .32, -.05], RightForeArm: [-1.6, 0, 0], RightHand: [.5, .7, 1.25], Spine1: [.05, -.06, 0], LeftArm: [-.25, 0, -.05], LeftForeArm: [-1.2, 0, 0] })], [3.8, merge({ RightArm: [-.5, .3, -.05], RightForeArm: [-1.55, 0, 0], RightHand: [.5, .2, 1.25] })], [5.2, merge()]]),
    clip('idle_adjust', 2.8, [[0, merge()], [.8, merge({ RightForeArm: [-.95, 0, 0], RightHand: [0, 0, .5], LeftArm: [-.4, 0, -.05], LeftForeArm: [-1.1, 0, 0] })], [1.9, merge({ RightForeArm: [-.9, 0, 0], RightHand: [0, 0, -.2], LeftArm: [-.35, 0, -.05], LeftForeArm: [-1.05, 0, 0] })], [2.8, merge()]]),
    // Acknowledgement: chest lifts, the hammer rises a hand's width toward the summons.
    clip('assigned', 1.6, [[0, merge()], [.55, merge({ Spine2: [-.08, 0, 0], RightArm: [-.5, 0, -.1], RightForeArm: [-1.1, 0, 0] })], [1.6, merge({ RightArm: [-.3, 0, -.1], RightForeArm: [-.9, 0, 0] })]]),
    // Forging: wind-up, strike on the anvil at 0.62 s, recover.
    clip('work', 1.5, [
      [0, merge({ RightArm: [-.3, .1, -.25], RightForeArm: [-.6, 0, 0], Spine: [0, -.06, 0], Spine1: [.02, .08, 0] })],
      [.45, merge({ RightArm: [-2.25, .25, -.35], RightForeArm: [-.95, 0, 0], Spine: [0, -.05, 0], Spine1: [-.08, .1, 0], LeftArm: [-.3, 0, .2] })],
      [.62, merge({ RightArm: [-.25, .1, -.2], RightForeArm: [-.15, 0, 0], Spine: [0, -.08, 0], Spine1: [.16, .1, 0], LeftArm: [-.2, 0, .18] })],
      [.8, merge({ RightArm: [-.45, .12, -.28], RightForeArm: [-.55, 0, 0], Spine: [0, -.07, 0], Spine1: [.1, .09, 0] })],
      [1.5, merge({ RightArm: [-.3, .1, -.25], RightForeArm: [-.6, 0, 0], Spine: [0, -.06, 0], Spine1: [.02, .08, 0] })]]),
    clip('wait', 3.6, [[0, merge({ RightArm: [-.05, 0, -.1], RightForeArm: [-.4, 0, 0], Spine: [0, -.05, 0], LeftArm: [-.25, 0, .05], LeftForeArm: [-1.25, 0, .2] })], [1.8, merge({ RightArm: [-.05, 0, -.1], RightForeArm: [-.42, 0, 0], Spine: [0, -.05, 0], Spine1: [-.02, 0, 0], LeftArm: [-.27, 0, .05], LeftForeArm: [-1.28, 0, .2] })], [3.6, merge({ RightArm: [-.05, 0, -.1], RightForeArm: [-.4, 0, 0], Spine: [0, -.05, 0], LeftArm: [-.25, 0, .05], LeftForeArm: [-1.25, 0, .2] })]]),
    clip('complete', 2.4, [[0, merge()], [.7, merge({ RightArm: [-1.35, 0, -.2], RightForeArm: [-.7, 0, 0], Spine2: [-.07, 0, 0] })], [1.4, merge({ RightArm: [-1.3, 0, -.2], RightForeArm: [-.72, 0, 0], Spine2: [-.06, 0, 0] })], [2.4, merge()]]),
    clip('blocked', 4, [[0, merge({ Spine1: [.1, 0, 0], Spine2: [.05, 0, 0], RightForeArm: [-.3, 0, 0], LeftShoulder: [0, 0, -.04], RightShoulder: [0, 0, .04] })], [2, merge({ Spine1: [.115, 0, 0], Spine2: [.06, 0, 0], RightForeArm: [-.32, 0, 0], LeftShoulder: [0, 0, -.045], RightShoulder: [0, 0, .045] })], [4, merge({ Spine1: [.1, 0, 0], Spine2: [.05, 0, 0], RightForeArm: [-.3, 0, 0], LeftShoulder: [0, 0, -.04], RightShoulder: [0, 0, .04] })]]),
  ];
}
/** The strike lands on the anvil this far into `work`; sparks fire here. */
export const STRIKE_TIME = .62;
