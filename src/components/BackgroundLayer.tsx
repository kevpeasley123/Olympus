import { useMotionPermission } from "../hooks/useAmbientMotion";
import { ambientVariables } from "../services/ambientMotion";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect } from "react";

/**
 * The background image and the vignette that sits over it.
 *
 * The image used to be a `background-attachment: fixed` layer on `body`, which
 * cannot be moved without repainting it. Here it is a transformed element, so
 * the parallax is GPU-composited.
 *
 * It is overscanned by 24px on every side (see `.background-image`), so a
 * translation of up to ±MAX_SHIFT never exposes an edge.
 */

/** Small on purpose. Parallax that announces itself is a distraction. */
const MAX_SHIFT = 10;

const SPRING = { stiffness: 40, damping: 20, mass: 0.6 };

export function BackgroundLayer() {
  const running = useMotionPermission();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, SPRING);
  const smoothY = useSpring(y, SPRING);

  useEffect(() => {
    if (!running) {
      // Also reset, in case the preference is turned on mid-session.
      x.set(0);
      y.set(0);
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      // -1..1 from the centre of the viewport, inverted so the background
      // drifts against the pointer rather than following it.
      const fromCentreX = event.clientX / window.innerWidth - 0.5;
      const fromCentreY = event.clientY / window.innerHeight - 0.5;

      x.set(-fromCentreX * 2 * MAX_SHIFT);
      y.set(-fromCentreY * 2 * MAX_SHIFT);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [running, x, y]);

  return (
    <>
      <motion.div
        className="background-image"
        style={running ? { x: smoothX, y: smoothY } : { x: 0, y: 0 }}
        aria-hidden="true"
      />
      <div className="background-vignette" data-motion={running ? "running" : "paused"} style={ambientVariables} aria-hidden="true" />
    </>
  );
}
