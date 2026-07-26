import type { LoadableState } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";
import type { WeatherPanelData } from "../../types/weather";

export type StatusRailTarget = "markets" | "weather";

interface StatusRailProps {
  markets: LoadableState<MarketPanelData>;
  weather: LoadableState<WeatherPanelData>;
  onOpen: (target: StatusRailTarget) => void;
}

const DASH = "—";
const MINUS = "−";

function normalizeDelta(change: string): string {
  return change.replace(/^-/, MINUS);
}

function directionClass(direction: string | undefined): string {
  if (direction === "up") return "is-up";
  if (direction === "down") return "is-down";
  return "is-flat";
}

/**
 * Markets and Weather collapsed to one monospace line in the header band.
 *
 * This is residency, not a rewrite — both panels stay intact and open as an
 * overlay when a segment is clicked. The rail is a glance surface; anything it
 * cannot say in a few characters belongs in the panel behind it.
 */
export function StatusRail({ markets, weather, onOpen }: StatusRailProps) {
  // Three indexes is what fits before the line stops being glanceable. The rest
  // are one click away in the panel.
  const indexes = (markets.data?.indexes ?? []).slice(0, 3);
  const marketsFailed = Boolean(markets.data?.overallError ?? markets.error);

  // Same rule as WeatherPanel l.34: the label comes from Rust, which owns the
  // coordinates. No literal fallback — a hardcoded city that disagrees with the
  // one actually fetched is worse than a dash.
  const weatherLabel = weather.data?.label ?? DASH;
  const weatherFailed = Boolean(weather.error) && !weather.data;

  return (
    <div className="status-rail tabular-data">
      <button
        type="button"
        className={`status-rail__segment ${marketsFailed ? "is-failed" : ""}`}
        onClick={() => onOpen("markets")}
        title="Open the markets panel"
      >
        {marketsFailed ? (
          <span className="status-rail__failed">Markets unavailable</span>
        ) : indexes.length === 0 ? (
          <span className="status-rail__pending">{DASH}</span>
        ) : (
          indexes.map((index) => (
            <span key={index.id} className="status-rail__quote">
              <span className="status-rail__quote-label">{index.label}</span>
              <span className="status-rail__quote-value">{index.value}</span>
              <span className={`status-rail__quote-delta ${directionClass(index.direction)}`}>
                {normalizeDelta(index.change)}
              </span>
            </span>
          ))
        )}
      </button>

      <span className="status-rail__divider" aria-hidden="true" />

      <button
        type="button"
        className={`status-rail__segment ${weatherFailed ? "is-failed" : ""}`}
        onClick={() => onOpen("weather")}
        title="Open the weather panel"
      >
        {weatherFailed ? (
          <span className="status-rail__failed">Weather unavailable</span>
        ) : (
          <span className="status-rail__weather">
            <span className="status-rail__quote-label">{weatherLabel}</span>
            <span className="status-rail__quote-value">
              {weather.data?.temperature ?? DASH}
            </span>
            <span className="status-rail__weather-condition">
              {weather.data?.condition ?? DASH}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
