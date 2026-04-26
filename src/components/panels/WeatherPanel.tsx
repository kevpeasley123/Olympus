import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun
} from "lucide-react";
import type { WeatherForecastDay } from "../../types";
import type { LoadableState } from "../../types/dashboard";
import type { WeatherPanelData } from "../../types/weather";

interface WeatherPanelProps {
  state: LoadableState<WeatherPanelData>;
  onRetry: () => void;
  compact?: boolean;
}

export function WeatherPanel({ state, onRetry, compact = false }: WeatherPanelProps) {
  return (
    <section className={`dashboard-panel weather-panel ${compact ? "compact-weather" : ""}`}>
      <div className="weather-strip">
        <div className="weather-top-row">
          <div className="weather-heading">
            <p className="eyebrow">Weather</p>
            <strong>{state.data?.label ?? "Tucson, AZ"}</strong>
          </div>
          {state.error ? (
            <div className="inline-panel-error">
              <span>Failed to load</span>
              <button className="ghost-action retry-action" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <span className="panel-meta tabular-data">Updated {state.data?.updatedAt ?? "--:--"}</span>
          )}
        </div>

        {state.loading && !state.data ? (
          <>
            <div className="weather-inline weather-inline-loading">
              <span className="skeleton-line weather-skeleton weather-skeleton-temp"></span>
              <span className="skeleton-line weather-skeleton weather-skeleton-detail"></span>
              <span className="skeleton-line weather-skeleton weather-skeleton-detail"></span>
            </div>
            <div className="weather-forecast-grid weather-forecast-loading">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="weather-forecast-day">
                  <span className="skeleton-line weather-forecast-skeleton weather-forecast-skeleton-day"></span>
                  <span className="skeleton-line weather-forecast-skeleton weather-forecast-skeleton-icon"></span>
                  <span className="skeleton-line weather-forecast-skeleton weather-forecast-skeleton-temp"></span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="weather-inline">
              <span className="weather-temp tabular-data">{state.data?.temperature ?? "--"}</span>
              <span className="weather-separator">&middot;</span>
              <span>{state.data?.condition ?? "--"}</span>
              <span className="weather-separator">&middot;</span>
              <span className="tabular-data">{state.data?.humidity ?? "--"}</span>
              <span className="weather-separator">&middot;</span>
              <span className="tabular-data">{state.data?.wind ?? "--"}</span>
            </div>
            {!compact ? (
              <div className="weather-forecast-grid">
                {state.data?.forecast.map((day) => <ForecastDayCard key={day.dayLabel} day={day} />)}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ForecastDayCard({ day }: { day: WeatherForecastDay }) {
  const Icon = iconForWeatherCode(day.weatherCode);

  return (
    <article className={`weather-forecast-day ${day.isToday ? "is-today" : ""}`}>
      <span className="weather-forecast-label">{day.dayLabel}</span>
      <Icon size={18} strokeWidth={1.8} className="weather-forecast-icon" />
      <span className="weather-forecast-temps tabular-data">
        <strong>{day.high}</strong>
        <span> / </span>
        <small>{day.low}</small>
      </span>
    </article>
  );
}

function iconForWeatherCode(code: number) {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return CloudDrizzle;
  if (
    code === 61 ||
    code === 63 ||
    code === 65 ||
    code === 66 ||
    code === 67 ||
    code === 80 ||
    code === 81 ||
    code === 82
  ) {
    return CloudRain;
  }
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return CloudSnow;
  }
  if (code === 95 || code === 96 || code === 99) return CloudLightning;
  return CloudMoon;
}
