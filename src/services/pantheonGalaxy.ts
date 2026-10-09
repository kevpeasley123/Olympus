import * as T from "three";

/** Ambient dust only. Solid celestial bodies are created exclusively from missions. The shared
 * scene depth buffer lets bodies pass both behind and in front of Omega. */
export function buildPantheonGalaxy(scene: T.Scene) {
  const group = new T.Group(); group.name = "Pantheon galaxy"; scene.add(group);
  let seed = 72431;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const count = 680, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const color = new T.Color();
  for (let i = 0; i < count; i++) {
    const radius = 20 + Math.cbrt(random()) * 161, azimuth = random() * Math.PI * 2;
    const latitude = 2 * random() - 1, radial = Math.sqrt(1 - latitude * latitude);
    positions.set([radius * radial * Math.cos(azimuth), radius * latitude, radius * radial * Math.sin(azimuth)], i * 3);
    color.set(i % 7 === 0 ? 0xe7bf78 : 0x8cb7d1).multiplyScalar((.25 + random() * .65) * (1 - .65 * Math.pow(radius / 181, 4)));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  // A fixed permutation distributes exactly 30% without changing the seeded star positions.
  const variation = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const larger = (i * 197) % count < count * .3;
    variation.set([larger ? 1.3 : 1, random() * Math.PI * 2, .65 + random() * .45], i * 3);
  }
  const dustGeometry = new T.BufferGeometry();
  dustGeometry.setAttribute("variation", new T.BufferAttribute(variation, 3));
  dustGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  dustGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  const dustMaterial = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexColors: true, transparent: true, depthTest: true, depthWrite: false,
    vertexShader: `attribute vec3 variation; uniform float time; varying vec3 tint; varying float shimmer; void main(){ tint=color; float phase=variation.y; shimmer=variation.x>1. ? .92+.08*sin(time*variation.z+phase)*sin(time*variation.z*.43+phase*1.7) : 1.; vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(2.4*700./max(200.,-p.z),1.6,4.0)*variation.x; }`,
    fragmentShader: `varying vec3 tint; varying float shimmer; void main(){float r=length(gl_PointCoord-.5)*2.; float a=1.-smoothstep(.05,1.,r); gl_FragColor=vec4(tint,a*.85*shimmer);}`,
  });
  group.add(new T.Points(dustGeometry, dustMaterial));
  function update(time: number) {
    dustMaterial.uniforms.time.value = time;
    // A full revolution every two minutes keeps the abyss visibly alive.
    group.rotation.set(.08, time * Math.PI * 2 / 120, -.12);
  }
  update(0);
  return {update, group}; // Shared scene traversal owns GPU resource disposal.
}
