import { useId, useState } from "react";
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
  renderScale: number;
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
  reducedMotion,
  renderScale
}: DayArcProps) {
  const [hovered, setHovered] = useState<DayTick | null>(null);
  const [arcHovered, setArcHovered] = useState(false);

  const elapsed = fractionOfDay(now);
  const ticks = buildTicks(commits, writes, now);
  const marker = pointOnRing(elapsed, centre, radius);
  const stableScale = Math.max(renderScale, 0.01);
  const tickHalfLength = 9 / stableScale;
  const trackerId = useId().replace(/:/g, "");
  const tailFraction = 24 / (stableScale * 2 * Math.PI * radius);
  const tailStart = pointOnRing(elapsed - tailFraction, centre, radius);
  const wake = arcPath(elapsed - tailFraction, elapsed, centre, radius);
  const railResponse = arcPath(elapsed - tailFraction, elapsed + tailFraction * .28, centre, radius);

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
        opacity={0}
        onMouseEnter={() => setArcHovered(true)}
        onMouseLeave={() => setArcHovered(false)}
      />


      {ticks.map((tick, index) => {
        // Ticks cross the track decisively. The previous 12-unit hairline used
        // the same amber as the elapsed arc, so correct live data could be
        // visually indistinguishable from the ring it was meant to annotate.
        const inner = pointOnRing(tick.fraction, centre, radius - tickHalfLength);
        const outer = pointOnRing(tick.fraction, centre, radius + tickHalfLength);
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

      {/* The time tracker rides the existing rail; its wake follows the same radius. */}
      <defs>
        <radialGradient id={`${trackerId}-halo`}>
          <stop offset="0" stopColor="#ffb45e" stopOpacity=".34"/>
          <stop offset=".4" stopColor="#e18b37" stopOpacity=".16"/>
          <stop offset="1" stopColor="#d97706" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`${trackerId}-wake`} gradientUnits="userSpaceOnUse" x1={tailStart.x} y1={tailStart.y} x2={marker.x} y2={marker.y}>
          <stop offset="0" stopColor="#d97706" stopOpacity="0"/>
          <stop offset=".65" stopColor="#e99540" stopOpacity=".38"/>
          <stop offset="1" stopColor="#ffd292" stopOpacity=".85"/>
        </linearGradient>
      </defs>
      <g className={`day-arc__tracker ${reducedMotion ? "" : "is-live"}`} pointerEvents="none">
        <path d={railResponse} className="day-arc__tracker-channel"/>
        <path d={wake} stroke={`url(#${trackerId}-wake)`} className="day-arc__tracker-reflection"/>
        <path d={wake} stroke={`url(#${trackerId}-wake)`} className="day-arc__tracker-wake"/>
        <g transform={`translate(${marker.x} ${marker.y}) rotate(${elapsed * 360})`}>
          <circle r={5 / stableScale} className="day-arc__tracker-beacon"/>
          <ellipse rx={12 / stableScale} ry={8 / stableScale} fill={`url(#${trackerId}-halo)`}/>
          <circle r={5 / stableScale} className="day-arc__tracker-housing"/>
          <circle r={3.2 / stableScale} className="day-arc__tracker-inset"/>
          <circle r={1.65 / stableScale} className={`day-arc__tracker-core ${reducedMotion ? "" : "is-live"}`}/>
        </g>
      </g>

      {label ? (
        <text
          x={centre}
          y={centre - radius - 18 / stableScale}
          textAnchor="middle"
          dominantBaseline="middle"
          className="day-arc__label"
          style={{ fontSize: `${13 / stableScale}px` }}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
