import { HybridCommandCore } from "./HybridCommandCore";
import { commandLayout, HYBRID_OVERLAY_TRANSFORM } from "../../services/hybridCore";
import { useAmbientMotion } from "../../hooks/useAmbientMotion";
import { useSceneParallax } from "../../hooks/useSceneParallax";
import { AMBIENT, ambientVariables } from "../../services/ambientMotion";
import type { OlympusVisualState } from "../../services/ambientMotion";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import { useOperatorProfile } from "../../hooks/useOperatorProfile";
import { useVaultGraph } from "../../hooks/useVaultGraph";
import { useVaultWrites } from "../../hooks/useVaultWrites";
import {
  glyphStateFor
} from "../../services/glyphState";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { PROJECT_RING_RADIUS } from "../../services/projectRing";
import type { TrackedProject } from "../../types";
import type { ProjectScanState } from "../../hooks/useDashboardData";
import type { ModelCapability } from "../../services/modelRouting";
import { routeName } from "../../services/routeLabel";
import { clockTime, toDate } from "../../services/time";
import { DayArc } from "./DayArc";
import { ProjectRing } from "./ProjectRing";
import "./command.css";

interface CommandInstrumentProps {
  active?: boolean;
  visualState?: OlympusVisualState;
  voiceLevel?: number;
  execution?: { projectId: string; operation: number };
  projects: TrackedProject[];
  tasks: ActionQueueTask[];
  tasksLoading: boolean;
  tasksError: string | null;
  /** A chat request is in flight. Drives the glyph's thinking state. */
  assistantPending?: boolean;
  /** Response text is arriving. Drives the glyph's speaking state. */
  assistantProducing?: boolean;
  /**
   * The model that answered the last turn, from the API response rather than
   * from any local constant. Null before the first reply of the session.
   */
  assistantModel?: string | null;
  /**
   * The model that declined, when a mid-turn fallback changed who answered.
   * Renders as a transition beside the current model rather than replacing it.
   */
  assistantFellBackFrom?: string | null;
  /** The route of the current or last turn, for a human label (review D3). */
  assistantCapability?: ModelCapability | null;
  /**
   * Where the project scan stands (review U1). Absent means ready — harnesses
   * and fixtures that pass projects directly.
   */
  projectScan?: ProjectScanState;
  onRetryScan?: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
}

/**
 * The scan state as the ring's centre readout and the line under the dial.
 * Loading and failure show no project names at all; stale keeps the genuine
 * last result and says how old it is.
 */
function scanReadout(scan: ProjectScanState | undefined): { centre: string[]; line: string | null; retry: boolean } {
  if (!scan || scan.status === "ready") return { centre: [], line: null, retry: false };
  if (scan.status === "loading") return { centre: ["SCANNING…"], line: "Scanning projects…", retry: false };
  if (scan.status === "failed") return { centre: ["SCAN FAILED"], line: "Project scan failed", retry: true };
  const last = toDate(scan.lastSuccessAt);
  const when = last ? clockTime(last) : "unknown";
  return { centre: [`STALE · ${when}`], line: `Stale · last scan ${when}`, retry: true };
}

/**
 * Viewbox is square and fixed; CSS decides how large it actually draws.
 *
 * Radius means distance from active work, outermost first: the day arc, the
 * labelled project ring, each project's notes, then the glyph. The viewbox and
 * omega metrics are intentionally unchanged by the ring replacement.
 */
const SIZE = 440;
const CENTRE = SIZE / 2;
const DAY_RADIUS = 205;

/**
 * How long each pulse stays mounted.
 *
 * A vault write plays twice. A newly linked graph node uses the same outward
 * vocabulary once: confirmation that the five-minute scan actually landed.
 */
const PULSE_MS: Record<InstrumentEvent, number> = {
  "vault-write": 2800,
  "graph-node": 1400,
  poll: 700,
  "command-received": 700,
  "response-start": 1400
};

const RIPPLE_SECONDS = 1.4;

/**
 * Command mode's whole centre column.
 *
 * No panel, no card, no surface. The omega remains the subject; the project
 * ring makes the surrounding constellation legible without becoming a list.
 */
export function CommandInstrument({
  projects,
  tasks,
  tasksLoading,
  tasksError,
  active = true,
  visualState,
  voiceLevel = 0,
  execution,
  assistantPending = false,
  assistantProducing = false,
  assistantModel = null,
  assistantFellBackFrom = null,
  assistantCapability = null,
  projectScan,
  onRetryScan,
  onSelectProject,
  onOpenNote
}: CommandInstrumentProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [renderScale, setRenderScale] = useState(1);
  const profile = useOperatorProfile();
  const { writes } = useVaultWrites();
  const { graph } = useVaultGraph();
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [hybridReady, setHybridReady] = useState(false);
  const [hybridError, setHybridError] = useState<string | null>(null);
  // The WebGL scene starts the first time Command is shown, not at launch:
  // opening Olympus in Research must not pay for it (review F5). Until it is
  // ready, and whenever it fails, the SVG instrument is the whole instrument.
  const [sceneWanted, setSceneWanted] = useState(active);
  useEffect(() => { if (active) setSceneWanted(true); }, [active]);
  const sceneShown = hybridReady && !hybridError;
  const scan = scanReadout(projectScan);
  const [hoverProject, setHoverProject] = useState<string | null>(null);
  const layout = useMemo(() => commandLayout(projects, graph, renderScale), [projects, graph, renderScale]);

  const commits = projects.flatMap((project) =>
    (project.recentCommits ?? []).map((commit) => ({ ...commit, project: project.name }))
  );
  // Both flags come from the same request state as the chat panel, so the line,
  // the panel and the omega cannot disagree. Because the state is *derived*
  // rather than scheduled, an error or a cancellation that clears them settles
  // back to idle through the same transition as a normal completion, and no
  // animation can be left running.
  const glyphState = visualState === "speaking" ? "speaking" : visualState === "thinking" ? "thinking" : visualState ? "idle" : glyphStateFor({
    pending: assistantPending,
    producing: assistantProducing
  });
  // Precise names (review D6): audio is "speaking", arriving text is
  // "responding", a live microphone is "listening".
  const activity = visualState === "speaking" ? "speaking"
    : visualState === "listening" ? "listening"
    : glyphState === "speaking" ? "responding"
    : glyphState === "thinking" ? "thinking" : null;

  const [completionSettled, setCompletionSettled] = useState(false);
  useEffect(() => {
    setCompletionSettled(false);
    if (visualState !== "complete") return;
    const timer = window.setTimeout(() => setCompletionSettled(true), AMBIENT.nodePulse * 1000);
    return () => window.clearTimeout(timer);
  }, [visualState]);
  const ambientState = visualState === "complete" && completionSettled ? "idle" : visualState ?? glyphState;
  const ambient = useAmbientMotion(ambientState, active);
  const instrumentParallax = useSceneParallax(active && ambient.running, "instrument");

  // Identity first, then activity: the model is the stable half and must not
  // move when the transient half appears beside it.
  //
  // A fallback renders as `from → to` rather than swapping the value in place.
  // Both models genuinely answered part of the turn, and a readout that quietly
  // changed would be the invisible-wrongness this line exists to prevent — the
  // arrow is the visible transition. It clears on the next turn.
  const identity = assistantModel
    ? `${routeName(assistantCapability) === "Model" ? assistantModel : routeName(assistantCapability)}${assistantFellBackFrom ? " · fallback" : ""}`
    : null;
  // The exact model stays one hover away; the readout carries the route.
  const identityTitle = assistantFellBackFrom ? `${assistantFellBackFrom} → ${assistantModel ?? "?"}` : assistantModel ?? undefined;

  const statusParts = [identity, activity].filter((part): part is string => Boolean(part));

  useLayoutEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;

    const measure = () => {
      const next = dial.getBoundingClientRect().width / SIZE;
      if (next <= 0) return;
      setRenderScale((current) => (Math.abs(current - next) < 0.001 ? current : next));
    };
    measure();
    // A window drag reports every pixel; the 3D scene rebuilds its label
    // atlas for a new scale, so only the size the drag settles on counts.
    let settle: number | undefined;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(settle);
      settle = window.setTimeout(measure, 150);
    });
    observer.observe(dial);
    return () => { observer.disconnect(); window.clearTimeout(settle); };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = subscribeToInstrumentEvents((event) => {
      setPulse(event);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulse(null), PULSE_MS[event]);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let clock: number | undefined;
    const visibilityChanged = () => {
      window.clearInterval(clock);
      if (document.visibilityState !== "visible" || !active) return;
      setNow(Date.now());
      clock = window.setInterval(() => setNow(Date.now()), 10_000);
    };
    visibilityChanged();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { window.clearInterval(clock); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [active]);

  return (
    <div className="command-instrument" data-visual-state={ambientState} data-voice-energy={voiceLevel > 0.15 ? "active" : "quiet"}
      data-motion={ambient.running ? "running" : "paused"} data-renderer={sceneShown ? "hybrid" : "svg"} data-scene-ready={sceneShown}
      data-scan={projectScan?.status ?? "ready"}
      style={{ ...ambientVariables, "--ambient-drift": `${2 / renderScale}px` } as CSSProperties}>
      <motion.div className="command-instrument__dial" ref={dialRef} style={instrumentParallax}>
        {/* Unmounted on failure so its GPU resources, listeners and timers go
            with it; Retry mounts a fresh one. */}
        {sceneWanted && !hybridError && <HybridCommandCore key={renderAttempt} layout={layout} state={ambientState} voiceLevel={voiceLevel} execution={execution}
          running={active && ambient.running} hoverProject={hoverProject}
          onReady={setHybridReady} onError={setHybridError} />}
        <svg
          style={{ transform: HYBRID_OVERLAY_TRANSFORM, transformOrigin: "50% 50%" }}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`command-instrument__svg ${pulse ? `is-pulsing pulse-${pulse}` : ""}`}
          role="group"
          aria-label="Portfolio instrument"
          data-render-scale={renderScale.toFixed(3)}
        >
          {/* The flat instrument's glyph; the 3D core replaces it once drawn. */}
          <text x={CENTRE} y={CENTRE + 30} className="command-instrument__fallback-omega" textAnchor="middle" aria-hidden="true">Ω</text>
          <DayArc
            centre={CENTRE}
            radius={DAY_RADIUS}
            now={new Date(now)}
            quietHours={profile?.quietHours ?? null}
            commits={commits}
            writes={writes}
            reducedMotion={!ambient.running}
            renderScale={renderScale}
          />

          <ProjectRing
            layout={layout}
            onHoverProject={setHoverProject}
            centre={CENTRE}
            radius={PROJECT_RING_RADIUS}
            projects={projects}
            graph={graph}
            ambientNodeEvent={ambient.events.node}
            tasks={tasks}
            tasksError={tasksLoading ? "tasks loading" : tasksError}
            renderScale={renderScale}
            onSelectProject={onSelectProject}
            onOpenNote={onOpenNote}
            idleReadout={scan.centre}
          />

          {(pulse === "vault-write" || pulse === "graph-node" || pulse === "response-start") && ambient.running ? (
            <motion.circle
              cx={CENTRE}
              cy={CENTRE}
              r={PROJECT_RING_RADIUS + 14}
              fill="none"
              stroke="#d97706"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0.7, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.08 }}
              transition={{
                duration: RIPPLE_SECONDS,
                ease: "easeOut",
                repeat: pulse === "vault-write" ? 1 : 0
              }}
              style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
            />
          ) : null}

        </svg>
      </motion.div>

      {/* Where the tier counts used to sit, at the same weight.

          The counts came out because they were a legend for a vocabulary the
          ring already teaches better: the hover readout names a project's tier
          beside its own name, which attaches the word to the thing instead of
          to an aggregate. What is left here is the one fact about this mode the
          instrument cannot draw — who is answering, and whether it is answering
          right now.

          Nothing renders before the first reply of a session. Naming a model
          that has not spoken would be the same invisible wrongness as reading
          the request constant. */}
      {scan.line && <p className="command-instrument__scan" role="status" data-scan={projectScan?.status}>
        <span>{scan.line}</span>
        {scan.retry && onRetryScan && <button type="button" className="ghost-action" disabled={projectScan?.scanning} onClick={onRetryScan}>
          {projectScan?.scanning ? "Retrying…" : "Retry"}</button>}
        {projectScan?.error && scan.retry && <span className="command-instrument__scan-detail" title={projectScan.error}>{projectScan.error}</span>}
      </p>}
      {hybridError && <div className="hybrid-status" role="status">
        <span>3D view unavailable · showing the flat instrument.</span>
        <button type="button" className="ghost-action" onClick={() => { setHybridError(null); setHybridReady(false); setRenderAttempt(n => n + 1); }}>Retry 3D view</button>
        <details><summary>Technical detail</summary><span>{hybridError}</span></details>
      </div>}
      {statusParts.length > 0 ? (
        <p className="command-instrument__status" title={identityTitle}>
          {statusParts.map((part, index) => (
            <span key={part}>
              {index > 0 ? <span className="command-instrument__status-sep"> · </span> : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
