import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LoadableState } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";
import type { WeatherPanelData } from "../../types/weather";

export type StatusRailTarget = "markets" | "weather";

interface StatusRailProps {
  markets: LoadableState<MarketPanelData>;
  weather: LoadableState<WeatherPanelData>;
  onOpen: (target: StatusRailTarget) => void;
  /**
   * Pixels the rail may occupy, handed down by `HeaderBar`.
   *
   * Deliberately not measured from the rail's own container: its grid track is
   * `auto`, so the container is sized *by* the rail. Observing it would make
   * the budget depend on the choice the budget is supposed to decide.
   */
  budget: number;
}

const DASH = "—";
const MINUS = "−";

type WeatherDetail = "full" | "locTemp" | "temp";

interface RailLevel {
  indexCount: number;
  weather: WeatherDetail;
}

/**
 * Compositions the rail may render, richest first. The first that fits wins.
 *
 * The floor is deliberate: the leading index is never dropped, and weather
 * never falls below its temperature. Between those, units go by what they cost
 * against what they say — `Tucson, AZ 74°F` is 141px for a complete outdoor
 * state, where a third index is 161px for one more number. Dropping a whole
 * category to keep a third quote is the worse trade, which is why weather
 * outranks the tail of the index list rather than sitting below it.
 *
 * Ordering within the indexes follows the data, dropping from the tail. The
 * widths differ by about 10px, which is not enough to justify reordering what
 * Rust hands over.
 */
const RAIL_LEVELS: RailLevel[] = [
  { indexCount: 3, weather: "full" },
  { indexCount: 3, weather: "locTemp" },
  { indexCount: 2, weather: "locTemp" },
  { indexCount: 1, weather: "locTemp" },
  { indexCount: 1, weather: "temp" }
];

/** Tickers buy back roughly 97px across the three. Unknown labels stay whole. */
const SHORT_LABELS: Record<string, string> = {
  "S&P 500": "SPX",
  "Nasdaq 100": "NDX",
  "Nasdaq": "NDX",
  "Dow": "DJI",
  "Dow Jones": "DJI"
};

function normalizeDelta(change: string): string {
  return change.replace(/^-/, MINUS);
}

function directionClass(direction: string | undefined): string {
  if (direction === "up") return "is-up";
  if (direction === "down") return "is-down";
  return "is-flat";
}

/**
 * Markets and Weather collapsed to one line in the header band.
 *
 * This is residency, not a rewrite — both panels stay intact and open as an
 * overlay when a segment is clicked. The rail summarises them; it must never
 * become a second implementation that can drift from the panel behind it.
 */
export function StatusRail({ markets, weather, onOpen, budget }: StatusRailProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);

  // Each candidate is rendered off-layout and measured, so the choice is made
  // against real text rather than a breakpoint. A five-digit Dow is wider than
  // a four-digit one, and a viewport width cannot know that.
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;

    const candidates = [...root.children] as HTMLElement[];
    if (candidates.length === 0) return;

    // Falls back to the narrowest composition when even that is too wide —
    // clipped by the shell, never overlapping.
    let chosen = candidates.length - 1;
    for (let index = 0; index < candidates.length; index += 1) {
      if (candidates[index].getBoundingClientRect().width <= budget) {
        chosen = index;
        break;
      }
    }

    // Guarded so the effect cannot drive a render loop. `budget` is derived
    // from the header and the switcher, neither of which depends on the level.
    setLevel((current) => (current === chosen ? current : chosen));
  });

  return (
    <div className="status-rail-shell">
      <div className="status-rail-measure" ref={measureRef} aria-hidden="true">
        {RAIL_LEVELS.map((candidate, index) => (
          <div className="status-rail" key={index}>
            <RailContent level={candidate} markets={markets} weather={weather} />
          </div>
        ))}
      </div>

      <div className="status-rail tabular-data">
        <RailContent
          level={RAIL_LEVELS[level] ?? RAIL_LEVELS[RAIL_LEVELS.length - 1]}
          markets={markets}
          weather={weather}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function RailContent({
  level,
  markets,
  weather,
  onOpen
}: {
  level: RailLevel;
  markets: LoadableState<MarketPanelData>;
  weather: LoadableState<WeatherPanelData>;
  onOpen?: (target: StatusRailTarget) => void;
}) {
  const indexes = (markets.data?.indexes ?? []).slice(0, level.indexCount);
  const marketsFailed = Boolean(markets.data?.overallError ?? markets.error);

  // Same rule as WeatherPanel: the label comes from Rust, which owns the
  // coordinates. No literal fallback — a hardcoded city that disagrees with the
  // one actually fetched is worse than a dash.
  const weatherLabel = weather.data?.label ?? DASH;
  const weatherFailed = Boolean(weather.error) && !weather.data;

  return (
    <>
      <Segment onOpen={onOpen} target="markets" failed={marketsFailed} title="Open the markets panel">
        {marketsFailed ? (
          <span className="status-rail__failed">Markets unavailable</span>
        ) : indexes.length === 0 ? (
          <span className="status-rail__pending">{DASH}</span>
        ) : (
          indexes.map((index) => (
            <span key={index.id} className="status-rail__quote">
              <span className="status-rail__quote-label" title={index.label}>
                {SHORT_LABELS[index.label] ?? index.label}
              </span>
              <span className="status-rail__quote-value">{index.value}</span>
              <span className={`status-rail__quote-delta ${directionClass(index.direction)}`}>
                {normalizeDelta(index.change)}
              </span>
            </span>
          ))
        )}
      </Segment>

      <span className="status-rail__divider" aria-hidden="true" />

      <Segment onOpen={onOpen} target="weather" failed={weatherFailed} title="Open the weather panel">
        {weatherFailed ? (
          <span className="status-rail__failed">Weather unavailable</span>
        ) : (
          <span className="status-rail__weather">
            {level.weather !== "temp" ? (
              <span className="status-rail__quote-label">{weatherLabel}</span>
            ) : null}
            <span className="status-rail__quote-value">
              {weather.data?.temperature ?? DASH}
            </span>
            {level.weather === "full" ? (
              <span className="status-rail__weather-condition">
                {weather.data?.condition ?? DASH}
              </span>
            ) : null}
          </span>
        )}
      </Segment>
    </>
  );
}

/**
 * A button when live, a plain span in the measurement copies — duplicating
 * focusable controls into the accessibility tree would be worse than the
 * overlap this measurement exists to prevent.
 */
function Segment({
  onOpen,
  target,
  failed,
  title,
  children
}: {
  onOpen?: (target: StatusRailTarget) => void;
  target: StatusRailTarget;
  failed: boolean;
  title: string;
  children: ReactNode;
}) {
  const className = `status-rail__segment ${failed ? "is-failed" : ""}`;

  if (!onOpen) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button type="button" className={className} onClick={() => onOpen(target)} title={title}>
      {children}
    </button>
  );
}
