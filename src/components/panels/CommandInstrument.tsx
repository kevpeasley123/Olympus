import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import { useOperatorProfile } from "../../hooks/useOperatorProfile";
import { useVaultGraph } from "../../hooks/useVaultGraph";
import { useVaultWrites } from "../../hooks/useVaultWrites";
import {
  SPEAKING_ENVELOPE,
  SPEAKING_LOOP_SECONDS,
  glyphStateFor
} from "../../services/glyphState";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { PROJECT_RING_RADIUS } from "../../services/projectRing";
import { tierBreakdown } from "../../services/projectTiers";
import type { TrackedProject } from "../../types";
import { DayArc } from "./DayArc";
import { ProjectRing } from "./ProjectRing";

interface CommandInstrumentProps {
  projects: TrackedProject[];
  tasks: ActionQueueTask[];
  tasksLoading: boolean;
  tasksError: string | null;
  /** A chat request is in flight. Drives the glyph's thinking state. */
  assistantPending?: boolean;
  onSelectProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
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
 * The breath sits inside the glyph clearance disc at rest and swells within it,
 * so it never reaches the innermost note band at 87.
 */
const GLOW_RADIUS = 74;

/**
 * Inside the glyph clearance disc, which is protected empty space — cross-project
 * edges are clipped out of it and no note band reaches in.
 *
 * **[V] 84 was wrong.** The glyph's ink reaches about 76 units from centre and the
 * innermost note band's inner extent is 83.16, so an arc at 84 would have crossed
 * the depth-3 notes. 79 sits between the two with margin on both sides and never
 * leaves the disc at 82.
 */
const THINK_ARC_RADIUS = 79;

/**
 * How long each pulse stays mounted.
 *
 * A vault write plays twice. A newly linked graph node uses the same outward
 * vocabulary once: confirmation that the five-minute scan actually landed.
 */
const PULSE_MS: Record<InstrumentEvent, number> = {
  "vault-write": 2800,
  "graph-node": 1400,
  poll: 700
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
  assistantPending = false,
  onSelectProject,
  onOpenNote
}: CommandInstrumentProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [renderScale, setRenderScale] = useState(1);
  const reducedMotion = useReducedMotion();
  const profile = useOperatorProfile();
  const { writes } = useVaultWrites();
  const { graph } = useVaultGraph();
  const commits = projects.flatMap((project) =>
    (project.recentCommits ?? []).map((commit) => ({ ...commit, project: project.name }))
  );
  const tiers = tierBreakdown(projects);
  // `producing` stays false until the chat streams — see `glyphState.ts`. Because
  // the state is derived rather than scheduled, an error or a cancellation that
  // clears `assistantPending` settles back to idle through the same transition as
  // a normal completion, and no animation can be left running.
  const glyphState = glyphStateFor({ pending: assistantPending, producing: false });

  useLayoutEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;

    const measure = () => {
      const next = dial.getBoundingClientRect().width / SIZE;
      setRenderScale((current) => (Math.abs(current - next) < 0.001 ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dial);
    return () => observer.disconnect();
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
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(clock);
  }, []);

  return (
    <div className="command-instrument">
      <div className="command-instrument__dial" ref={dialRef}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`command-instrument__svg ${pulse ? `is-pulsing pulse-${pulse}` : ""}`}
          role="group"
          aria-label="Portfolio instrument"
          data-render-scale={renderScale.toFixed(3)}
        >
          <DayArc
            centre={CENTRE}
            radius={DAY_RADIUS}
            now={new Date(now)}
            quietHours={profile?.quietHours ?? null}
            commits={commits}
            writes={writes}
            reducedMotion={Boolean(reducedMotion)}
            renderScale={renderScale}
          />

          <ProjectRing
            centre={CENTRE}
            radius={PROJECT_RING_RADIUS}
            projects={projects}
            graph={graph}
            tasks={tasks}
            tasksError={tasksLoading ? "tasks loading" : tasksError}
            renderScale={renderScale}
            onSelectProject={onSelectProject}
            onOpenNote={onOpenNote}
          />

          {(pulse === "vault-write" || pulse === "graph-node") && !reducedMotion ? (
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

          {/* The glyph and everything that makes it feel present. Grouped so the
              three states are one class swap, and so every transform here
              declares its origin — SVG defaults `transform-origin` to `0 0`,
              which sends a scaled glyph 162px out of frame rather than growing
              it in place. Measured, not assumed. */}
          <g className={`omega-presence omega-presence--${glyphState}`}>
            <defs>
              <radialGradient id="omega-glow">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.34" />
                <stop offset="55%" stopColor="#d97706" stopOpacity="0.13" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* The breath. A dedicated element so the cycle animates opacity and
                transform, which composite, instead of the glyph's own
                drop-shadow filter, which would re-raster every frame over the
                backdrop blur. Radius and opacity move together by construction. */}
            <circle
              className="omega-glow"
              cx={CENTRE}
              cy={CENTRE}
              r={GLOW_RADIUS}
              fill="url(#omega-glow)"
              pointerEvents="none"
              style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
            />

            {/* Thinking circles around; speaking emits from. Direction of motion
                is what separates them without a label. */}
            {glyphState === "thinking" ? (
              <circle
                className="omega-think-arc"
                cx={CENTRE}
                cy={CENTRE}
                r={THINK_ARC_RADIUS}
                fill="none"
                pointerEvents="none"
                style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
              />
            ) : null}

            {/* No transform-origin here on purpose. **[V]** `motion` writes
                `transform-box: fill-box; transform-origin: 50% 50%` inline and
                overrides anything set alongside it — which is exactly the pair
                that makes an SVG scale in place, so the trap is already closed.
                Measured at scale 1.12: zero drift, 21.4px of growth. Setting an
                origin here looks like it works and does nothing. */}
            <motion.g
              className="omega-scale"
              animate={
                glyphState === "speaking" && !reducedMotion
                  ? { scale: SPEAKING_ENVELOPE.scale }
                  : { scale: 1 }
              }
              transition={
                glyphState === "speaking" && !reducedMotion
                  ? {
                      duration: SPEAKING_LOOP_SECONDS,
                      times: SPEAKING_ENVELOPE.times,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  : { duration: 0.9, ease: "easeOut" }
              }
            >
              <text
                x={CENTRE}
                y={CENTRE + 52}
                textAnchor="middle"
                className="instrument-glyph"
                fontFamily="'Cinzel', 'Times New Roman', serif"
                fontSize="150"
                fontWeight="500"
              >
                {"Ω"}
              </text>
            </motion.g>
          </g>
        </svg>
      </div>

      {tiers.length > 0 ? (
        <p className="command-instrument__counts tabular-data">
          {tiers.map((slice, index) => (
            <span key={slice.status}>
              {index > 0 ? <span className="command-instrument__counts-sep"> · </span> : null}
              <span className="command-instrument__count-value">{slice.count}</span>{" "}
              {slice.status}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
