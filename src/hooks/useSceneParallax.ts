import { useEffect } from "react";
import { useSpring, type MotionStyle } from "motion/react";

// Screen pixels, independent of dial scale and constellation depth response.
const LAYERS = {
  instrument: { x: 5, y: 3, stiffness: 60, damping: 20, mass: .85 },
  background: { x: -4, y: -3, stiffness: 45, damping: 21, mass: 1 },
};

export function useSceneParallax(running: boolean, layer: keyof typeof LAYERS): MotionStyle {
  const profile = LAYERS[layer];
  const spring = { stiffness: profile.stiffness, damping: profile.damping, mass: profile.mass, restDelta: .01, restSpeed: .01 };
  const x = useSpring(0, spring);
  const y = useSpring(0, spring);

  useEffect(() => {
    if (!running) {
      x.jump(0);
      y.jump(0);
      return;
    }
    const reset = () => { x.set(0); y.set(0); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") { x.jump(0); y.jump(0); return; }
      const position = (value: number, extent: number) => Math.max(-1, Math.min(1, value / Math.max(1, extent) * 2 - 1));
      x.set(position(event.clientX, window.innerWidth) * profile.x);
      y.set(position(event.clientY, window.innerHeight) * profile.y);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      x.jump(0);
      y.jump(0);
    };
  }, [running, x, y, profile]);

  // Independent CSS translation preserves the dial's existing scale transform.
  return { "--scene-parallax-x": x, "--scene-parallax-y": y } as MotionStyle;
}
