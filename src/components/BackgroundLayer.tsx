import { motion } from "motion/react";
import { useMotionPermission } from "../hooks/useAmbientMotion";
import { useSceneParallax } from "../hooks/useSceneParallax";

/** Slow counter-motion separates the environment from the foreground instrument. */
export function BackgroundLayer() {
  const running = useMotionPermission();
  const parallax = useSceneParallax(running, "background");
  return <>
    <motion.div className="background-image" style={parallax} aria-hidden="true" />
    <div className="background-vignette background-vignette--cinematic" aria-hidden="true" />
  </>;
}
