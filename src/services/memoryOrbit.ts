/** A two-minute tilted ellipse below Omega; positive Z is the near side. */
export function memoryOrbit(seconds:number) {
  const phase=seconds*Math.PI*2/120+Math.PI/2;
  const depth=Math.sin(phase);
  return {x:150*Math.cos(phase),y:-105-28*depth,z:125*depth,
    scale:.92+.22*depth,opacity:.79+.21*depth};
}
