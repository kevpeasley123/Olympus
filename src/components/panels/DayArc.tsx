import { useState } from "react";
import {
  arcPath,
  buildTicks,
  fractionOfDay,
  pointOnRing,
  quietSpans
} from "../../services/dayArc";
import type { DayTick } from "../../services/dayArc";
import type { QuietHours } from "../../hooks/useOperatorProfile";
import type { RecentCommit } from "../../types";
import type { VaultWriteEvent } from "../../hooks/useVaultWrites";

interface DayArcProps {
  centre: number;
  radius: number;
  now: Date;
  quietHours: QuietHours | null;
  commits: Array<RecentCommit & { project: string }>;
  writes: VaultWriteEvent[];
  reducedMotion: boolean;
}

/**
 * The outermost ring: one day, midnight at the top, clockwise.
 *
 * Elapsed time is traced in amber up to a ringed marker at the current moment,
 * and small ticks mark work that actually happened — commits and vault writes.
 * Quiet hours are a wide faint band behind all of it.
 */
export function DayArc({
  centre,
  radius,
  now,
  quietHours,
  commits,
  writes,
  reducedMotion
}: DayArcProps) {
  const [hovered, setHovered] = useState<DayTick | null>(null);
  const [arcHovered, setArcHovered] = useState(false);

  const elapsed = fractionOfDay(now);
  const ticks = buildTicks(commits, writes, now);
  const marker = pointOnRing(elapsed, centre, radius);

  // Quiet hours are the one thing here that comes from the operator profile.
  // A missing or malformed field renders nothing at all rather than blocking
  // the arc — the day is still the day without it.
  const quiet = quietSpans(quietHours);

  const label = hovered
    ? `${hovered.label} · ${hovered.detail}`
    : arcHovered
      ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : null;

  return (
    <g className="day-arc">
      {quiet.map((span, index) => (
        <path
          key={`quiet-${index}`}
          d={arcPath(span.from, span.to, centre, radius)}
          className="day-arc__quiet"
          fill="none"
        />
      ))}

      {/* The full day, then the part of it that has happened. */}
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        className="day-arc__track"
        onMouseEnter={() => setArcHovered(true)}
        onMouseLeave={() => setArcHovered(false)}
      />

      {elapsed > 0.001 ? (
        <path
          d={arcPath(0, elapsed, centre, radius)}
          className="day-arc__elapsed"
          fill="none"
          pointerEvents="none"
        />
      ) : null}

      {ticks.map((tick, index) => {
        // Ticks cross the track decisively. The previous 12-unit hairline used
        // the same amber as the elapsed arc, so correct live data could be
        // visually indistinguishable from the ring it was meant to annotate.
        const inner = pointOnRing(tick.fraction, centre, radius - 9);
        const outer = pointOnRing(tick.fraction, centre, radius + 9);
        return (
          <line
            key={`${tick.kind}-${index}-${tick.fraction}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className={`day-arc__tick day-arc__tick--${tick.kind}`}
            onMouseEnter={() => setHovered(tick)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}

      {/* Now. A ringed dot rather than a filled one, so it reads as a position
          on the ring rather than as another tick. */}
      <circle
        cx={marker.x}
        cy={marker.y}
        r={5}
        className={`day-arc__now ${reducedMotion ? "" : "is-live"}`}
        pointerEvents="none"
      />

      {label ? (
        <text
          x={centre}
          y={centre - radius - 18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="day-arc__label"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
