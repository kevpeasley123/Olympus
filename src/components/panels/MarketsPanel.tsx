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

export function MarketsPanel({ state, onRetry, compact = false }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const panelError = state.data?.overallError ?? state.error;

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
        </div>
      </div>

      {state.loading && !state.data ? (
        <div className="market-groups market-strip-grid-loading">
          <MarketMetricSkeletonGroup title="Indexes" count={3} />
          <MarketMetricSkeletonGroup title="Rates" count={4} />
        </div>
      ) : (
        <>
          <div className="market-groups">
            <MarketMetricGroup
              title="Indexes"
              items={state.data?.indexes ?? []}
              warning={state.data?.indexWarning}
              sectionClassName="indexes"
            />
            <MarketMetricGroup
              title="Rates"
              items={state.data?.rates ?? []}
              warning={state.data?.rateWarning}
              sectionClassName="rates"
            />
          </div>
          {!compact && state.data ? (
            <button
              className="market-news-toggle"
              onClick={() => setExpanded((value) => !value)}
              title={expanded ? "Hide market news" : "Show market news"}
            >
              <span>{expanded ? "Hide news" : "Show news"}</span>
              <ChevronDown size={16} className={expanded ? "is-expanded" : ""} />
            </button>
          ) : null}
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

function MarketMetricGroup({
  title,
  items,
  warning,
  sectionClassName
}: {
  title: string;
  items: Array<MarketIndex | MarketRate>;
  warning?: string | null;
  sectionClassName: string;
}) {
  return (
    <section className={`market-metric-group ${sectionClassName}`}>
      <div className="market-group-header">
        <p className="subhead">{title}</p>
        {warning ? (
          <span className="market-metric-help" title={warning}>
            <CircleHelp size={11} />
          </span>
        ) : null}
      </div>
      <div className={`market-strip-grid ${sectionClassName}`}>
        {items.map((item) => (
          <div key={item.id} className="market-strip-metric">
            <span className="market-strip-label">{item.label}</span>
            <span className="market-strip-value tabular-data">{item.value}</span>
            <span className={`market-strip-delta ${item.direction} tabular-data`}>{item.change}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketMetricSkeletonGroup({ title, count }: { title: string; count: number }) {
  return (
    <section className="market-metric-group">
      <div className="market-group-header">
        <p className="subhead">{title}</p>
      </div>
      <div className="market-strip-grid">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`${title}-${index}`} className="market-strip-metric">
            <span className="skeleton-line skeleton-label"></span>
            <span className="skeleton-line skeleton-value"></span>
            <span className="skeleton-line skeleton-delta"></span>
          </div>
        ))}
      </div>
    </section>
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
