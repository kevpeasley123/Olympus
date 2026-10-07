import * as T from "three";

/** Decorative astronomy, never a representation of agent activity. The shared
 * scene depth buffer lets bodies pass both behind and in front of Omega. */
export function buildPantheonGalaxy(scene: T.Scene, flagship = false) {
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
  const dustGeometry = new T.BufferGeometry();
  dustGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  dustGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  const dustMaterial = new T.ShaderMaterial({
    vertexColors: true, transparent: true, depthTest: true, depthWrite: false,
    vertexShader: `varying vec3 tint; void main(){ tint=color; vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(2.4+(550.+p.z)*.012,1.2,4.5); }`,
    fragmentShader: `varying vec3 tint; void main(){float r=length(gl_PointCoord-.5)*2.; float a=1.-smoothstep(.05,1.,r); gl_FragColor=vec4(tint,a*.75);}`,
  });
  group.add(new T.Points(dustGeometry, dustMaterial));
  const bodyGeometry = flagship ? new T.PlaneGeometry(2, 2) : new T.SphereGeometry(1, 12, 10);
  const bodies = Array.from({length: 22}, (_, i) => {
    const radius = (flagship ? 95 : 46) + random() * (flagship ? 76 : 117);
    const tilt = new T.Quaternion().setFromEuler(new T.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI));
    const material = flagship ? new T.ShaderMaterial({
      uniforms: {tint:{value:new T.Color(i % 3 ? 0x9fc3dc : 0xeac58b)}},
      transparent:true, depthTest:true, depthWrite:false, blending:T.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){vUv=uv; vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.); vec2 size=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz)); center.xy+=position.xy*size; gl_Position=projectionMatrix*center;}`,
      fragmentShader:`varying vec2 vUv; uniform vec3 tint; void main(){float r=length(vUv-.5)*2.; float light=exp(-r*r*28.)*.8+exp(-r*r*5.)*.22; gl_FragColor=vec4(tint,light*(1.-smoothstep(.65,1.,r)));}`,
    }) : new T.MeshStandardMaterial({color: i % 3 ? 0x7899b0 : 0xd5ac6b, emissive: i % 3 ? 0x456878 : 0x8c5a23, emissiveIntensity: .5, roughness: .65, metalness: .15});
    const mesh = new T.Mesh(bodyGeometry, material); mesh.scale.setScalar(i % 5 === 0 ? (flagship ? 2.4 : 2.2) : .65 + random() * .55); group.add(mesh);
    const phase = random() * Math.PI * 2, speed = (.010 + random() * .013) * (i % 3 ? 1 : -1) * (flagship ? 3.2 : 1);
    // Only four short, fading wakes. No closed orbit or connections to cards.
    const trail = !flagship && i % 6 === 0 ? new T.Line(new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(new Float32Array(90), 3)), new T.LineBasicMaterial({color: 0x819baa, transparent: true, opacity: flagship ? .2 : .13, depthTest: true, depthWrite: false})) : undefined;
    if (trail) group.add(trail);
    return {mesh, radius, tilt, phase, speed, trail};
  });
  const point = new T.Vector3();
  function update(time: number) {
    group.rotation.set(.08, time * (flagship ? .018 : .006), -.12);
    for (const body of bodies) {
      const angle = body.phase + time * body.speed;
      body.mesh.position.set(Math.cos(angle) * body.radius, Math.sin(angle) * body.radius, 0).applyQuaternion(body.tilt);
      if (body.trail) {
        const attribute = body.trail.geometry.getAttribute("position") as T.BufferAttribute;
        for (let j = 0; j < 30; j++) {
          const a = angle - Math.sign(body.speed) * j * .012;
          point.set(Math.cos(a) * body.radius, Math.sin(a) * body.radius, 0).applyQuaternion(body.tilt);
          attribute.setXYZ(j, point.x, point.y, point.z);
        }
        attribute.needsUpdate = true; body.trail.geometry.computeBoundingSphere();
      }
    }
  }
  update(0);
  return {update, group}; // Shared scene traversal owns GPU resource disposal.
}
