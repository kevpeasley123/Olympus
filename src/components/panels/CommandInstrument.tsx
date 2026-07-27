import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { selectNextAction } from "../../services/nextAction";
import { TIER_WEIGHT, tierBreakdown } from "../../services/projectTiers";
import type { ProjectStatus, TrackedProject } from "../../types";

interface CommandInstrumentProps {
  projects: TrackedProject[];
  onSelectTier: (status: ProjectStatus) => void;
}

/** Viewbox is square and fixed; CSS decides how large it actually draws. */
const SIZE = 400;
const CENTRE = SIZE / 2;
const TIER_RADIUS = 168;
const ACTIVITY_RADIUS = 138;

const TIER_CIRCUMFERENCE = 2 * Math.PI * TIER_RADIUS;

/** Visual separation between arcs, in path units. */
const ARC_GAP = 10;

const PULSE_MS: Record<InstrumentEvent, number> = {
  "vault-write": 1400,
  poll: 700
};

const TIER_LABELS: Record<ProjectStatus, string> = {
  active: "active",
  unclassified: "unclassified",
  watching: "watching",
  scaffold: "scaffold",
  archived: "archived"
};

/**
 * Command mode's whole centre column.
 *
 * No panel, no card, no surface — it draws directly on the background image,
 * which is the only mode where that image is visible, and is the point of the
 * mode. The test is whether it reads from across the room: one glyph, one
 * sentence, a ring parseable without focusing. If a scrolling list ever appears
 * here, this has become Project mode with a different tab lit.
 *
 * The glyph is the only thing that glows. Glow on text at this density causes
 * fatigue within a week; one glowing object reads as intentional.
 */
export function CommandInstrument({ projects, onSelectTier }: CommandInstrumentProps) {
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const reducedMotion = useReducedMotion();
  const tiers = tierBreakdown(projects);
  const action = selectNextAction(projects);

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

  // Arcs are laid out head to tail around the ring, rotated so the first one
  // starts at twelve o'clock.
  let cursor = 0;
  const arcs = tiers.map((slice) => {
    const span = slice.fraction * TIER_CIRCUMFERENCE;
    // A lone tier would otherwise lose a gap it does not need, and a very small
    // tier must stay visible rather than collapse to nothing.
    const drawn = tiers.length === 1 ? span : Math.max(span - ARC_GAP, 2);
    const offset = cursor;
    cursor += span;
    return { ...slice, drawn, offset };
  });

  return (
    <div className="command-instrument">
      <div className="command-instrument__dial">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`command-instrument__svg ${pulse ? `is-pulsing pulse-${pulse}` : ""}`}
          role="group"
          aria-label="Portfolio instrument"
        >
          {/* Outer ring: one arc per tier. Length is count, weight is status. */}
          <g transform={`rotate(-90 ${CENTRE} ${CENTRE})`}>
            {arcs.map((arc) => (
              <circle
                key={arc.status}
                cx={CENTRE}
                cy={CENTRE}
                r={TIER_RADIUS}
                fill="none"
                className={`instrument-arc instrument-arc--${arc.status}`}
                strokeWidth={TIER_WEIGHT[arc.status]}
                strokeDasharray={`${arc.drawn} ${TIER_CIRCUMFERENCE - arc.drawn}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="butt"
                tabIndex={0}
                role="button"
                aria-label={`${arc.count} ${TIER_LABELS[arc.status]} ${
                  arc.count === 1 ? "project" : "projects"
                } — open in Project mode`}
                onClick={() => onSelectTier(arc.status)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectTier(arc.status);
                  }
                }}
              >
                <title>
                  {arc.count} {TIER_LABELS[arc.status]}
                </title>
              </circle>
            ))}
          </g>

          {/* Middle ring: poll activity. Rotates slowly; brightens on each
              completed scan. Ticks twice at startup in dev — StrictMode
              double-invokes the effect that fires the first fetches. */}
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={ACTIVITY_RADIUS}
            fill="none"
            className={`instrument-activity ${pulse === "poll" ? "is-ticking" : ""}`}
            strokeWidth={1.5}
            strokeDasharray="2 16"
            style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
          />

          {/* The write pulse. Present only while it runs, so it costs nothing
              at rest and cannot be mistaken for part of the mark. */}
          {pulse === "vault-write" && !reducedMotion ? (
            <motion.circle
              cx={CENTRE}
              cy={CENTRE}
              r={TIER_RADIUS + 14}
              fill="none"
              stroke="#d97706"
              strokeWidth={2}
              initial={{ opacity: 0.7, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.08 }}
              transition={{ duration: PULSE_MS["vault-write"] / 1000, ease: "easeOut", repeat: 1 }}
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

      <NextActionLine action={action} />

      {tiers.length > 0 ? (
        <p className="command-instrument__counts tabular-data">
          {tiers.map((slice, index) => (
            <span key={slice.status}>
              {index > 0 ? <span className="command-instrument__counts-sep"> · </span> : null}
              <span className="command-instrument__count-value">{slice.count}</span>{" "}
              {TIER_LABELS[slice.status]}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One sentence, large. Never invented: each state below says exactly what it
 * knows, including the states where the honest answer is that nothing was
 * stated.
 */
function NextActionLine({ action }: { action: ReturnType<typeof selectNextAction> }) {
  if (action.kind === "empty") {
    return (
      <p className="command-instrument__sentence is-quiet">No project states a next step.</p>
    );
  }

  if (action.kind === "activeWithoutStep") {
    return (
      <>
        <p className="command-instrument__sentence is-quiet">
          {action.project} is active but states no next step.
        </p>
        <OtherActives count={action.otherActiveCount} />
      </>
    );
  }

  return (
    <>
      <p className="command-instrument__sentence">{action.step}</p>
      <p className="command-instrument__attribution">
        {action.project}
        {action.fallback ? (
          <span className="command-instrument__fallback"> — no project is active</span>
        ) : null}
      </p>
      <OtherActives count={action.otherActiveCount} />
    </>
  );
}

function OtherActives({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="command-instrument__attribution is-quiet">
      +{count} more active
    </p>
  );
}
