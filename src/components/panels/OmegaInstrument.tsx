import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import type { TrackedProject } from "../../types";

interface OmegaInstrumentProps {
  projects: TrackedProject[];
}

/**
 * How long a pulse stays mounted.
 *
 * The write pulse plays its ripple twice, so the window covers both plays. At
 * 1400ms against a 1.4s repeating animation the element unmounted exactly as
 * the second expansion began, so the repeat could never render — the same
 * defect the centre instrument carried.
 */
const PULSE_MS: Record<InstrumentEvent, number> = {
  /** Two plays of a 0.7s ripple. */
  "vault-write": 1400,
  /** One. */
  poll: 700
};

/**
 * One expansion. The write pulse plays two; the poll tick plays one.
 *
 * Snappier than the centre instrument's 1.4s because this mark is 56px rather
 * than 505px — the same ripple duration over a tenth of the radius reads as
 * sluggish.
 */
const RIPPLE_SECONDS = 0.7;

/**
 * The next action, or nothing.
 *
 * The operator's own words from a vault note, never generated. `next_step` used
 * to be one of three canned sentences, which read as advice while carrying no
 * information — so an absent one renders as absence. Projects arrive already
 * ordered by the Rust scan (active first, then by commit recency), so the first
 * one that states a next step is the one that matters most.
 */
function nextAction(projects: TrackedProject[]): { project: string; step: string } | null {
  const stated = projects.find((project) => project.nextStep.trim().length > 0);
  return stated ? { project: stated.name, step: stated.nextStep.trim() } : null;
}

/**
 * The sigil, told what the app is doing.
 *
 * Two events animate: an approved vault write, and a poll tick. The brief's
 * outer ring of count-proportional tier arcs was dropped — with eight projects
 * across three or four tiers it encodes three numbers, and three numbers lose
 * to a text line. Events are the part a static list genuinely cannot show.
 *
 * The poll tick fires twice at startup in dev. StrictMode double-invokes the
 * effects that drive the fetches; that is expected, not a bug to chase.
 */
export function OmegaInstrument({ projects }: OmegaInstrumentProps) {
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const reducedMotion = useReducedMotion();
  const action = nextAction(projects);

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

  const pulsing = pulse !== null && !reducedMotion;

  return (
    <div className="omega-instrument">
      <motion.div
        className={`olympus-emblem-stack ${pulse ? `is-pulsing pulse-${pulse}` : ""}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
        aria-hidden="true"
      >
        <svg width="56" height="56" viewBox="0 0 100 100" fill="none" className="olympus-sigil-svg">
          <g className="ring-outer" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="48" stroke="#d97706" strokeWidth="0.6" opacity="0.25" fill="none" />
          </g>
          <g className="ring-middle" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="41" stroke="#d97706" strokeWidth="0.6" opacity="0.30" fill="none" />
          </g>
          <g className="ring-inner" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="34" stroke="#d97706" strokeWidth="0.6" opacity="0.35" fill="none" />
          </g>

          {/* The event ring. Present only while pulsing, so it costs nothing at
              rest and cannot be mistaken for part of the mark. */}
          {pulsing ? (
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              stroke="#d97706"
              strokeWidth="1.4"
              fill="none"
              initial={{ opacity: 0.75, scale: 0.82 }}
              animate={{ opacity: 0, scale: 1.12 }}
              transition={{
                duration: RIPPLE_SECONDS,
                ease: "easeOut",
                repeat: pulse === "vault-write" ? 1 : 0
              }}
              style={{ transformOrigin: "50px 50px" }}
            />
          ) : null}

          <text
            x="50"
            y="68"
            textAnchor="middle"
            fontFamily="'Cinzel', 'Times New Roman', serif"
            fontSize="64"
            fontWeight="500"
            fill="#d97706"
            opacity="0.85"
          >
            {"Ω"}
          </text>
        </svg>
      </motion.div>

      <div className="omega-instrument__text">
        <motion.h1
          className="olympus-wordmark"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        >
          OLYMPUS
        </motion.h1>

        {action ? (
          <p className="omega-next-action" title={`${action.project}: ${action.step}`}>
            <span className="omega-next-action__project">{action.project}</span>
            <span className="omega-next-action__arrow" aria-hidden="true">
              {"→"}
            </span>
            <span className="omega-next-action__step">{action.step}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
