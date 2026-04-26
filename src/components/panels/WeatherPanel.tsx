import type { LoadableState } from "../../types/dashboard";
import type { WeatherPanelData } from "../../types/weather";

interface WeatherPanelProps {
  state: LoadableState<WeatherPanelData>;
  onRetry: () => void;
}

export function WeatherPanel({ state, onRetry }: WeatherPanelProps) {
  return (
    <section className="dashboard-panel weather-panel">
      <div className="weather-strip">
        <div className="weather-top-row">
          <p className="eyebrow">Weather</p>
          {state.error && (
            <div className="inline-panel-error">
              <span>⚠ Failed to load</span>
              <button className="ghost-action retry-action" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}
        </div>
        {state.loading && !state.data ? (
          <div className="weather-inline weather-inline-loading">
            <span className="skeleton-line weather-skeleton weather-skeleton-location"></span>
            <span className="skeleton-line weather-skeleton weather-skeleton-temp"></span>
            <span className="skeleton-line weather-skeleton weather-skeleton-detail"></span>
          </div>
        ) : (
          <div className="weather-inline">
            <span className="weather-location">{state.data?.label ?? "--"}</span>
            <span className="weather-separator">&middot;</span>
            <span className="weather-temp tabular-data">{state.data?.temperature ?? "--"}</span>
            <span className="weather-separator">&middot;</span>
            <span>{state.data?.condition ?? "--"}</span>
            <span className="weather-separator">&middot;</span>
            <span className="tabular-data">{state.data?.humidity ?? "--"}</span>
            <span className="weather-separator">&middot;</span>
            <span className="tabular-data">{state.data?.wind ?? "--"}</span>
          </div>
        )}
      </div>
    </section>
  );
}
