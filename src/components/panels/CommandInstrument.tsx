import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import { useOperatorProfile } from "../../hooks/useOperatorProfile";
import { useVaultGraph } from "../../hooks/useVaultGraph";
import { useVaultWrites } from "../../hooks/useVaultWrites";
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
