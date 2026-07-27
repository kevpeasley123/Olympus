import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { selectNextAction } from "../../services/nextAction";
import {
  POLL_SOURCE_LABELS,
  getPollSources,
  subscribeToPollSources
} from "../../services/pollRegistry";
import type { PollSourceKey, PollSourceState } from "../../services/pollRegistry";
import { TIER_WEIGHT, tierBreakdown } from "../../services/projectTiers";
import type { ProjectStatus, TrackedProject } from "../../types";

interface CommandInstrumentProps {
  projects: TrackedProject[];
  onSelectTier: (status: ProjectStatus) => void;
  onOpenNote: (notePath: string) => void;
}

/**
 * Tiers containing a repo with uncommitted work.
 *
 * `repo_state` conflates two things: it is `git-pending` when the tree is dirty
 * *or* when the repo has no commits at all. Only the first is "you have work
 * you have not committed" — a folder that was never initialised is a scaffold,
 * not an urgent one — so the never-committed case is excluded here rather than
 * pulsed. It still reaches the ring through its own tier arc.
 */
function tiersWithDirtyRepo(projects: TrackedProject[]): Set<ProjectStatus> {
  const dirty = new Set<ProjectStatus>();
  for (const project of projects) {
    if (project.repoState === "git-pending" && project.lastCommitAt !== null) {
      dirty.add(project.status);
    }
  }
  return dirty;
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

/** Long enough to catch out of the corner of an eye. */
const DOT_LIT_MS = 1200;

/** "never" is a real answer here — it is what a dead poll looks like. */
function describeAge(source: PollSourceState, now: number): string {
  if (source.lastSuccessAt === null) {
    return source.lastError ? "no successful scan yet" : "waiting for first scan";
  }

  const seconds = Math.max(0, Math.round((now - source.lastSuccessAt) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

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
export function CommandInstrument({
  projects,
  onSelectTier,
  onOpenNote
}: CommandInstrumentProps) {
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const [hoveredTier, setHoveredTier] = useState<ProjectStatus | null>(null);
  const [hoveredDot, setHoveredDot] = useState<PollSourceKey | null>(null);
  const [pollSources, setPollSources] = useState(getPollSources);
  const [recentlyLanded, setRecentlyLanded] = useState<Set<PollSourceKey>>(new Set());
  // Only used to render "42s ago"; a slow tick keeps it honest without
  // re-rendering the whole dial every frame.
  const [now, setNow] = useState(() => Date.now());
  const reducedMotion = useReducedMotion();
  const tiers = tierBreakdown(projects);
  const action = selectNextAction(projects);
  const dirtyTiers = tiersWithDirtyRepo(projects);

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

  // A dot lights for its own landing rather than for any scan, so a stalled
  // source stays dark while the others keep flashing.
  useEffect(() => {
    const timers = new Map<PollSourceKey, number>();

    const unsubscribe = subscribeToPollSources(() => {
      const next = getPollSources();
      setPollSources((previous) => {
        for (const source of next) {
          const before = previous.find((candidate) => candidate.key === source.key);
          if (before && source.landings > before.landings) {
            setRecentlyLanded((current) => new Set(current).add(source.key));
            window.clearTimeout(timers.get(source.key));
            timers.set(
              source.key,
              window.setTimeout(() => {
                setRecentlyLanded((current) => {
                  const copy = new Set(current);
                  copy.delete(source.key);
                  return copy;
                });
              }, DOT_LIT_MS)
            );
          }
        }
        return next;
      });
    });

    const clock = window.setInterval(() => setNow(Date.now()), 10_000);

    return () => {
      unsubscribe();
      window.clearInterval(clock);
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  // Arcs are laid out head to tail around the ring, rotated so the first one
  // starts at twelve o'clock. `midAngle` is where a hover label hangs.
  let cursor = 0;
  const arcs = tiers.map((slice) => {
    const span = slice.fraction * TIER_CIRCUMFERENCE;
    // A lone tier would otherwise lose a gap it does not need, and a very small
    // tier must stay visible rather than collapse to nothing.
    const drawn = tiers.length === 1 ? span : Math.max(span - ARC_GAP, 4);
    const offset = cursor;
    const midAngle = ((offset + span / 2) / TIER_CIRCUMFERENCE) * 360 - 90;
    cursor += span;
    return { ...slice, drawn, offset, midAngle };
  });

  const hoveredDotSource = pollSources.find((source) => source.key === hoveredDot) ?? null;
  const hovered = arcs.find((arc) => arc.status === hoveredTier) ?? null;
  const hoverPoint = hovered
    ? {
        x: CENTRE + Math.cos((hovered.midAngle * Math.PI) / 180) * (TIER_RADIUS + 30),
        y: CENTRE + Math.sin((hovered.midAngle * Math.PI) / 180) * (TIER_RADIUS + 30)
      }
    : null;

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
                className={`instrument-arc instrument-arc--${arc.status} ${
                  hoveredTier === arc.status ? "is-hovered" : ""
                } ${dirtyTiers.has(arc.status) ? "is-dirty" : ""}`}
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
                onMouseEnter={() => setHoveredTier(arc.status)}
                onMouseLeave={() => setHoveredTier(null)}
                onFocus={() => setHoveredTier(arc.status)}
                onBlur={() => setHoveredTier(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectTier(arc.status);
                  }
                }}
              />
            ))}
          </g>

          {/* Hover label, hung just outside the arc it belongs to rather than
              in a fixed legend — the ring stays clean and the meaning is one
              mouse-move away. Outside the rotated group, since the angle
              already accounts for the rotation. */}
          {hovered && hoverPoint ? (
            <text
              x={hoverPoint.x}
              y={hoverPoint.y}
              className="instrument-hover-label"
              textAnchor={hoverPoint.x < CENTRE - 6 ? "end" : hoverPoint.x > CENTRE + 6 ? "start" : "middle"}
              dominantBaseline="middle"
            >
              {TIER_LABELS[hovered.status]} · {hovered.count} · click to open
            </text>
          ) : null}

          {/* Middle ring: one dot per poll source, not decorative specks. Each
              lights when its own scan lands, so a dot that stops lighting is a
              dead poll rather than a rendering quirk. The ring itself sweeps
              slowly to show the instrument is live at all.
              Dots flash twice at startup in dev — StrictMode double-invokes the
              effects that fire the first fetches. Absent under a release
              build, where React does not double-invoke. */}
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={ACTIVITY_RADIUS}
            fill="none"
            className="instrument-activity"
            strokeWidth={1}
            strokeDasharray="1 22"
            style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
          />

          {pollSources.map((source, index) => {
            const angle = (index / pollSources.length) * 360 - 90;
            const radians = (angle * Math.PI) / 180;
            const x = CENTRE + Math.cos(radians) * ACTIVITY_RADIUS;
            const y = CENTRE + Math.sin(radians) * ACTIVITY_RADIUS;
            const fresh = recentlyLanded.has(source.key);
            return (
              <circle
                key={source.key}
                cx={x}
                cy={y}
                r={fresh ? 5.5 : 3.5}
                className={`instrument-dot ${fresh ? "is-lit" : ""} ${
                  source.lastSuccessAt === null ? "is-cold" : ""
                }`}
                tabIndex={0}
                role="img"
                aria-label={`${POLL_SOURCE_LABELS[source.key]}: ${describeAge(source, now)}`}
                onMouseEnter={() => setHoveredDot(source.key)}
                onMouseLeave={() => setHoveredDot(null)}
                onFocus={() => setHoveredDot(source.key)}
                onBlur={() => setHoveredDot(null)}
              />
            );
          })}

          {hoveredDotSource ? (
            <text
              x={CENTRE}
              y={CENTRE + ACTIVITY_RADIUS + 34}
              className="instrument-hover-label"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {POLL_SOURCE_LABELS[hoveredDotSource.key]} · {describeAge(hoveredDotSource, now)}
            </text>
          ) : null}

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

      <NextActionLine action={action} onOpenNote={onOpenNote} />

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
function NextActionLine({
  action,
  onOpenNote
}: {
  action: ReturnType<typeof selectNextAction>;
  onOpenNote: (notePath: string) => void;
}) {
  // A prompt, not a confession. The old copy reported an empty frontmatter
  // field as the largest text on screen; this offers the fix instead.
  if (action.kind === "unset") {
    const label = "No next step set";
    return (
      <>
        {action.notePath ? (
          <button
            type="button"
            className="command-instrument__sentence is-prompt"
            onClick={() => onOpenNote(action.notePath as string)}
            title={`Open ${action.notePath} in Obsidian to set one`}
          >
            {label}
          </button>
        ) : (
          <p className="command-instrument__sentence is-quiet">{label}</p>
        )}
        {action.project ? (
          <p className="command-instrument__attribution is-quiet">
            {action.project}
            {action.notePath ? " — set one in the note" : null}
          </p>
        ) : null}
        <OtherActives count={action.otherActiveCount} />
      </>
    );
  }

  return (
    <>
      {/* Clamped to two lines with the whole sentence on hover. The dial is a
          fixed size: scaling it to fit long text would either shrink the arc
          strokes back under the readable floor or shift the visual ratios, and
          an instrument whose size varies with something it does not measure is
          worse than a clipped sentence. */}
      <p className="command-instrument__sentence" title={action.step}>
        {action.step}
      </p>
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
