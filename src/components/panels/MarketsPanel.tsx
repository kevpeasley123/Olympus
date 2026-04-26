import { ChevronDown, CircleHelp } from "lucide-react";
import { useMemo, useState } from "react";
import type { MarketIndex, MarketNewsItem, MarketRate } from "../../types";
import type { LoadableState } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";

interface MarketsPanelProps {
  state: LoadableState<MarketPanelData>;
  onRetry: () => void;
  compact?: boolean;
}

export function MarketsPanel({ state, onRetry, compact = false }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const panelError = state.data?.overallError ?? state.error;
  const metrics = useMemo(() => {
    if (!state.data) return [];
    return [...state.data.indexes, ...state.data.rates];
  }, [state.data]);

  return (
    <section className={`dashboard-panel market-panel ${compact ? "compact-market" : ""}`}>
      <div className="market-strip-top">
        <div className="market-strip-title">
          <p className="eyebrow">Markets</p>
        </div>
        <div className="market-strip-actions">
          {panelError ? (
            <>
              <div className="panel-meta panel-error-text" title={panelError}>
                Failed to load: {panelError}
              </div>
              <button className="ghost-action retry-action" onClick={onRetry}>
                Retry
              </button>
            </>
          ) : (
            <div className="panel-meta tabular-data">
              Updated {state.data?.updatedAt ?? "--:--"}
            </div>
          )}
          <button
            className="market-toggle"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? "Collapse market detail" : "Expand market detail"}
            disabled={!state.data || compact}
          >
            <ChevronDown size={16} className={expanded ? "is-expanded" : ""} />
          </button>
        </div>
      </div>

      {state.loading && !state.data ? (
        <div className="market-strip-grid market-strip-grid-loading">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="market-strip-metric">
              <span className="skeleton-line skeleton-label"></span>
              <span className="skeleton-line skeleton-value"></span>
              <span className="skeleton-line skeleton-delta"></span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="market-strip-grid">
            {metrics.map((item) => (
              <MarketStripMetric
                key={item.id}
                item={item}
                warning={item.id.startsWith("ust") ? state.data?.rateWarning : state.data?.indexWarning}
              />
            ))}
          </div>
          <div className={expanded && !compact ? "market-detail is-expanded" : "market-detail"}>
            <div className="market-news-section">
              <p className="subhead">News</p>
              <div className="market-news-list">
                {state.data?.news.map((item) => <MarketNewsRow key={item.id} item={item} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MarketStripMetric({
  item,
  warning
}: {
  item: MarketIndex | MarketRate;
  warning?: string | null;
}) {
  return (
    <div className="market-strip-metric">
      <span className="market-strip-label">
        {item.label}
        {warning ? (
          <span className="market-metric-help" title={warning}>
            <CircleHelp size={11} />
          </span>
        ) : null}
      </span>
      <span className="market-strip-value tabular-data">{item.value}</span>
      <span className={`market-strip-delta ${item.direction} tabular-data`}>{item.change}</span>
    </div>
  );
}

function MarketNewsRow({ item }: { item: MarketNewsItem }) {
  return (
    <article className="market-news-row">
      <div className="market-news-head">
        <strong>{item.headline}</strong>
        <small>{item.source}</small>
      </div>
      <p className="dense-text">{item.summary}</p>
    </article>
  );
}
