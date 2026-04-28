import { ChevronDown, CircleHelp } from "lucide-react";
import { useState } from "react";
import type { MarketIndex, MarketNewsItem, MarketRate } from "../../types";
import type { LoadableState } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";

interface MarketsPanelProps {
  state: LoadableState<MarketPanelData>;
  onRetry: () => void;
  compact?: boolean;
}

const MINUS = "−";

function normalizeDelta(change: string): string {
  return change.replace(/^-/, MINUS);
}

interface MetricCellProps {
  label: string;
  value: string;
  delta: string;
  deltaPositive?: boolean;
  deltaNegative?: boolean;
}

function MetricCell({ label, value, delta, deltaPositive, deltaNegative }: MetricCellProps) {
  const deltaColor = deltaPositive
    ? "var(--positive)"
    : deltaNegative
      ? "var(--negative)"
      : "var(--muted)";

  return (
    <div className="metric-cell">
      <div className="metric-cell-label">{label}</div>
      <div className="metric-cell-row">
        <div className="metric-cell-value">{value}</div>
        <div className="metric-cell-delta" style={{ color: deltaColor }}>
          {delta}
        </div>
      </div>
    </div>
  );
}

function MarketCells({ items }: { items: Array<MarketIndex | MarketRate> }) {
  return (
    <>
      {items.map((item) => (
        <MetricCell
          key={item.id}
          label={item.label}
          value={item.value}
          delta={normalizeDelta(item.change)}
          deltaPositive={item.direction === "up"}
          deltaNegative={item.direction === "down"}
        />
      ))}
    </>
  );
}

export function MarketsPanel({ state, onRetry, compact = false }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const panelError = state.data?.overallError ?? state.error;
  const indexes = state.data?.indexes ?? [];
  const rates = state.data?.rates ?? [];
  const indexWarning = state.data?.indexWarning;
  const rateWarning = state.data?.rateWarning;

  return (
    <section className={`dashboard-panel markets-panel ${compact ? "markets-panel--compact" : ""}`}>
      <header className="markets-header">
        <span className="markets-eyebrow">Markets</span>
        {panelError ? (
          <div className="markets-header-actions">
            <span className="panel-error-text" title={panelError}>
              Failed to load: {panelError}
            </span>
            <button className="ghost-action retry-action" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : (
          <span className="markets-updated tabular-data">
            Updated {state.data?.updatedAt ?? "--:--"}
          </span>
        )}
      </header>

      {state.loading && !state.data ? (
        <>
          <SkeletonGroup label="Indexes" count={3} variant="indexes" />
          <div className="markets-divider" />
          <SkeletonGroup label="Rates" count={4} variant="rates" />
        </>
      ) : (
        <>
          <div className="markets-group">
            <div className="markets-group-label">
              <span>Indexes</span>
              {indexWarning ? (
                <span className="markets-group-warning" title={indexWarning}>
                  <CircleHelp size={11} />
                </span>
              ) : null}
            </div>
            <div className="markets-grid markets-grid--indexes">
              <MarketCells items={indexes} />
            </div>
          </div>

          <div className="markets-divider" />

          <div className="markets-group">
            <div className="markets-group-label">
              <span>Rates</span>
              {rateWarning ? (
                <span className="markets-group-warning" title={rateWarning}>
                  <CircleHelp size={11} />
                </span>
              ) : null}
            </div>
            <div className="markets-grid markets-grid--rates">
              <MarketCells items={rates} />
            </div>
          </div>

          {!compact && state.data ? (
            <footer className="markets-footer">
              <button
                className="markets-news-toggle"
                onClick={() => setExpanded((value) => !value)}
                title={expanded ? "Hide market news" : "Show market news"}
              >
                <span>{expanded ? "Hide news" : "Show news"}</span>
                <ChevronDown size={14} className={expanded ? "is-expanded" : ""} />
              </button>
            </footer>
          ) : null}

          <div className={expanded && !compact ? "markets-detail is-expanded" : "markets-detail"}>
            <div className="markets-news-section">
              <p className="subhead">News</p>
              <div className="markets-news-list">
                {state.data?.news.map((item) => <MarketNewsRow key={item.id} item={item} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SkeletonGroup({
  label,
  count,
  variant
}: {
  label: string;
  count: number;
  variant: "indexes" | "rates";
}) {
  return (
    <div className="markets-group">
      <div className="markets-group-label">
        <span>{label}</span>
      </div>
      <div className={`markets-grid markets-grid--${variant}`}>
        {Array.from({ length: count }).map((_, index) => (
          <div className="metric-cell" key={`${label}-${index}`}>
            <span className="skeleton-line skeleton-label"></span>
            <span className="skeleton-line skeleton-value"></span>
            <span className="skeleton-line skeleton-delta"></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketNewsRow({ item }: { item: MarketNewsItem }) {
  return (
    <article className="markets-news-row">
      <div className="markets-news-head">
        <strong>{item.headline}</strong>
        <small>{item.source}</small>
      </div>
      <p className="dense-text">{item.summary}</p>
    </article>
  );
}
