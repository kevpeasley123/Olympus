import { useEffect, useLayoutEffect, useRef } from "react";
import { useMotionPermission } from "../../hooks/useAmbientMotion";
import { SignalRenderer, type SignalState } from "../../services/olympusSignal";
import { voiceSignal } from "../../services/voiceSignal";

const LABEL: Record<SignalState, string> = {
  idle: "Voice idle", listening: "Voice listening", thinking: "Voice thinking", speaking: "Voice speaking", off: "Voice off", error: "Voice unavailable",
};
const HARNESS_ATTRIBUTES = import.meta.env.DEV;

/**
 * The energy signal beneath the Omega. React only mounts the canvas and passes
 * the state; the frame loop reads live audio straight from `voiceSignal`.
 * `live` false keeps reply audio out of the waveform (for example while muted).
 */
export function OlympusSignal({ state, active = true, live = true }: { state: SignalState; active?: boolean; live?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SignalRenderer | null>(null);
  const animate = useMotionPermission() && active;
  const current = useRef({ state, live, animate });
  current.current = { state, live, animate };

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const engine = new SignalRenderer(element);
    renderer.current = engine;
    engine.setState(current.current.state);
    const fit = () => {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return;
      engine.resize(box.width, box.height, window.devicePixelRatio || 1);
      if (!current.current.animate) engine.renderStatic(current.current.state);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    // Zoom changes the pixel ratio without resizing the element.
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); renderer.current = null; };
  }, []);

  useEffect(() => {
    const engine = renderer.current;
    if (!engine) return;
    engine.setState(state);
    if (!animate) {
      engine.renderStatic(state);
      if (HARNESS_ATTRIBUTES && canvas.current) {
        canvas.current.dataset.signalState = state;
        canvas.current.dataset.signalPeak = String(engine.stats.peak);
        canvas.current.dataset.signalSource = "none";
      }
    }
  }, [state, animate]);

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    let reported = 0;
    const loop = (now: number) => {
      const engine = renderer.current;
      const { state: s, live: hear } = current.current;
      const kind = s === "speaking" && hear ? "output" : s === "listening" ? "input" : null;
      engine?.frame(now / 1000, kind ? voiceSignal.sample(kind, now) : null);
      if (HARNESS_ATTRIBUTES && engine && canvas.current && now - reported > 200) {
        reported = now;
        canvas.current.dataset.signalState = engine.stats.state;
        canvas.current.dataset.signalPeak = String(engine.stats.peak);
        canvas.current.dataset.signalSource = engine.stats.live ? "live" : "none";
        canvas.current.dataset.signalQuality = engine.stats.quality;
        canvas.current.dataset.signalCost = engine.stats.costMs.toFixed(2);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  return <canvas ref={canvas} className="olympus-signal" role="img" aria-label={LABEL[state]} data-state={state} data-animated={animate || undefined} />;
}
