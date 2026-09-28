import * as T from "three";

/** Opaque inner space with an atmospheric taper contained by the outer rail. */
export const CONSTELLATION_FIELD = {
  // Keep the main aperture opaque; only the zone behind the ring architecture fades.
  radius: 155.5, depthRatio: .40, reflection: .012, coreInfluence: .045,
  outerRadius: 191, atmosphereStart: 72,
};

export function buildConstellationField(scene: T.Scene) {
  const geometry = new T.SphereGeometry(CONSTELLATION_FIELD.radius, 64, 40);
  const uniforms = {
    reflection: {value: CONSTELLATION_FIELD.reflection},
    warmth: {value: CONSTELLATION_FIELD.coreInfluence},
  };
  const vertexShader = `
    varying vec3 fieldPosition, fieldNormal, fieldView;
    void main() {
      fieldPosition=position/${CONSTELLATION_FIELD.radius.toFixed(1)};
      vec4 viewPosition=modelViewMatrix*vec4(position,1.);
      fieldNormal=normalize(normalMatrix*normal);
      fieldView=normalize(-viewPosition.xyz);
      gl_Position=projectionMatrix*viewPosition;
    }`;
  const rear = new T.ShaderMaterial({
    // Draw the backdrop BEFORE opaque metal/linings as well as transparent glass.
    // Custom blending permits the outer alpha taper in that early render queue.
    transparent:false, depthTest:false, depthWrite:false,
    blending:T.CustomBlending, blendEquation:T.AddEquation,
    blendSrc:T.SrcAlphaFactor, blendDst:T.OneMinusSrcAlphaFactor,
    blendEquationAlpha:T.AddEquation, blendSrcAlpha:T.OneFactor, blendDstAlpha:T.OneMinusSrcAlphaFactor,
    vertexShader:`
      varying vec2 portalPosition;
      void main() {
        portalPosition=position.xy;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      varying vec2 portalPosition;
      float smoother(float start,float end,float value) {
        float t=clamp((value-start)/(end-start),0.,1.);
        return t*t*t*(t*(t*6.-15.)+10.);
      }
      void main() {
        float radius=length(portalPosition);
        // A long luminance transition shapes the space without exposing scenery.
        float atmosphere=smoother(${CONSTELLATION_FIELD.atmosphereStart.toFixed(1)},${CONSTELLATION_FIELD.outerRadius.toFixed(1)},radius);
        vec2 fieldPosition=portalPosition/${CONSTELLATION_FIELD.outerRadius.toFixed(1)};
        float coolMist=pow(max(0.,fieldPosition.y*.6-fieldPosition.x*.4),2.);
        vec3 color=mix(vec3(.0015,.0035,.008),vec3(.005,.012,.023),atmosphere);
        color+=vec3(.003,.006,.010)*coolMist*atmosphere;
        // Alpha stays exactly 1 through the main portal, then eases to zero
        // across the full outer zone, ending inside the existing rail (r=192).
        float opacity=1.-smoother(${CONSTELLATION_FIELD.radius.toFixed(1)},${CONSTELLATION_FIELD.outerRadius.toFixed(1)},radius);
        gl_FragColor=vec4(color,opacity);
      }`,
  });
  const front = new T.ShaderMaterial({
    uniforms, vertexShader, transparent:true, depthWrite:false,
    blending:T.AdditiveBlending, toneMapped:false,
    fragmentShader:`
      varying vec3 fieldPosition, fieldNormal, fieldView;
      uniform float reflection, warmth;
      void main() {
        float facing=max(0.,dot(normalize(fieldNormal),normalize(fieldView)));
        // Broad atmosphere fades BEFORE the silhouette; no Fresnel edge band.
        float softFacing=smoothstep(.03,.35,facing)*(1.-smoothstep(.55,.94,facing));
        float key=pow(max(0.,dot(normalize(fieldPosition),normalize(vec3(-.65,.8,.15)))),4.);
        float light=softFacing*key*reflection;
        float core=exp(-dot(fieldPosition.xy,fieldPosition.xy)*23.)*warmth;
        vec3 color=vec3(.38,.60,.80)*light+vec3(1.,.28,.035)*core;
        float alpha=min(.3,light+core);
        gl_FragColor=vec4(color/max(alpha,.0001),alpha);
      }`,
  });
  const volume = new T.Group();
  volume.name = "Constellation field";
  volume.scale.z = CONSTELLATION_FIELD.depthRatio;
  // This backing footprint follows the ring plane, so its fade cannot protrude
  // past the rail at the fixed oblique camera angle. Curved front shading remains.
  const enclosure = new T.Mesh(new T.CircleGeometry(CONSTELLATION_FIELD.outerRadius,128),rear);
  enclosure.name="Constellation portal with outer falloff";
  enclosure.renderOrder=-2;
  const reflection = new T.Mesh(geometry,front);
  reflection.renderOrder=2;
  volume.add(enclosure,reflection);
  scene.add(volume);
  // Geometry and materials are disposed by the scene's shared cleanup traversal.
  return {update(energy:number) {uniforms.warmth.value=CONSTELLATION_FIELD.coreInfluence*(1+energy*.35);}};
}
