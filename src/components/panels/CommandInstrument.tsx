import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { DayArc } from "./DayArc";
import { useOperatorProfile } from "../../hooks/useOperatorProfile";
import { useVaultWrites } from "../../hooks/useVaultWrites";
import { useVaultGraph } from "../../hooks/useVaultGraph";
import { selectNextAction } from "../../services/nextAction";
import { TIER_WEIGHT, tierBreakdown } from "../../services/projectTiers";
import { VaultGraph } from "./VaultGraph";
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

/**
 * Viewbox is square and fixed; CSS decides how large it actually draws.
 *
 * Radius means distance from active work, outermost first: the day arc, then
 * project tiers, then the vault graph's bands, then the glyph. The viewbox grew
 * from 400 to make room for the day arc *outside* the tier arcs without
 * shrinking them — the CSS size grew to match, so the tiers keep their
 * apparent size on screen.
 *
 * The graph's own radii live in `services/vaultGraph.ts`, measured against the
 * two things that bound them: the Ω's ink corner near r=77, and this ring's
 * inner edge at 162.5 once the heaviest tier stroke is accounted for.
 */
const SIZE = 440;
const CENTRE = SIZE / 2;
const DAY_RADIUS = 205;
const TIER_RADIUS = 168;

const TIER_CIRCUMFERENCE = 2 * Math.PI * TIER_RADIUS;

/** Visual separation between arcs, in path units. */
const ARC_GAP = 10;

/**
 * How long each pulse stays mounted.
 *
 * The write pulse plays its ripple twice (`repeat: 1` below), so its window has
 * to cover both plays. It was 1400ms against a 1.4s animation set to repeat,
 * which meant the element unmounted exactly as the second expansion began and
 * the repeat could never render — a rare event reduced to one sub-second
 * ripple that was easy to miss entirely against a dark background.
 */
const PULSE_MS: Record<InstrumentEvent, number> = {
  "vault-write": 2800,
  poll: 700
};

/** One expansion. Two of these play per write. */
const WRITE_RIPPLE_SECONDS = 1.4;

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
  // Advances the day arc's now-marker. A slow tick keeps it honest without
  // re-rendering the whole dial every frame.
  const [now, setNow] = useState(() => Date.now());
  const reducedMotion = useReducedMotion();
  const profile = useOperatorProfile();
  const { writes } = useVaultWrites();
  const { graph } = useVaultGraph();
  // Flattened here rather than in the arc so the arc stays a pure renderer and
  // each tick can name the project it came from.
  const commits = projects.flatMap((project) =>
    (project.recentCommits ?? []).map((commit) => ({ ...commit, project: project.name }))
  );
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

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(clock);
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
          <DayArc
            centre={CENTRE}
            radius={DAY_RADIUS}
            now={new Date(now)}
            quietHours={profile?.quietHours ?? null}
            commits={commits}
            writes={writes}
            reducedMotion={Boolean(reducedMotion)}
          />

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

          {/* Inner bands: the vault's link structure, hop distance as radius.
              This replaced five poll-freshness dots and a sweeping ring —
              infrastructure health that changed no decision the operator makes.
              Draws nothing until an anchor carries an edge. */}
          <VaultGraph centre={CENTRE} graph={graph} onOpenNote={onOpenNote} />

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
              transition={{ duration: WRITE_RIPPLE_SECONDS, ease: "easeOut", repeat: 1 }}
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
