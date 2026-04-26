import { Maximize2, Minimize2, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LiveSourceHealth } from "../../types/dashboard";

interface HeaderBarProps {
  onRefresh: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  sourceHealth: LiveSourceHealth[];
}

export function HeaderBar({
  onRefresh,
  focusMode,
  onToggleFocusMode,
  sourceHealth
}: HeaderBarProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const msUntilNextHalfMinute = 30_000 - (Date.now() % 30_000);
    let interval: number | undefined;

    const timeout = window.setTimeout(() => {
      update();
      interval = window.setInterval(update, 30_000);
    }, msUntilNextHalfMinute);

    return () => {
      window.clearTimeout(timeout);
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, []);

  const timeLabel = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const dateLabel = now.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
  const overallHealth = deriveOverallHealth(sourceHealth);

  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Command Station</p>
          <h1>Olympus</h1>
        </div>

        <div className="topbar-actions">
          <div className={`health-indicator ${overallHealth}`} title="Live data source health">
            <span className="health-indicator-dot" aria-hidden="true"></span>
            <div className="health-popover">
              {sourceHealth.map((source) => (
                <div key={source.key} className="health-popover-row">
                  <span className={`health-source-dot ${source.status}`} aria-hidden="true"></span>
                  <span>{source.label}</span>
                  <small>{formatHealthMeta(source, now)}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="header-pill tabular-data">
            <span>{timeLabel}</span>
            <span className="header-separator">&middot;</span>
            <span>{dateLabel}</span>
          </div>
          <button className="icon-button" onClick={onRefresh} title="Refresh live dashboard data">
            <RefreshCw size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setPreferencesOpen((value) => !value)}
            title="Open preferences"
          >
            <Settings2 size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onToggleFocusMode}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
          >
            {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {preferencesOpen && (
        <section className="settings-panel preferences-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Preferences</p>
              <h2>Command Surface</h2>
            </div>
          </div>
          <p className="section-copy">
            Olympus should keep operational preferences light on the home screen. Deep workspace
            configuration like vault paths and project roots should live in a later admin/setup
            view, not in the primary dashboard.
          </p>
          <div className="preferences-list">
            <div className="preference-row">
              <span>Dashboard mode</span>
              <strong>Projects first</strong>
            </div>
            <div className="preference-row">
              <span>Memory surface</span>
              <strong>Obsidian connected</strong>
            </div>
            <div className="preference-row">
              <span>Markets detail</span>
              <strong>Collapsed by default</strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function deriveOverallHealth(sources: LiveSourceHealth[]): LiveSourceHealth["status"] {
  if (sources.some((source) => source.status === "failed")) return "failed";
  if (sources.some((source) => source.status === "stale")) return "stale";
  return "ok";
}

function formatHealthMeta(source: LiveSourceHealth, now: Date): string {
  if (!source.lastFetchAt) {
    return source.lastError ? source.lastError : "No successful fetch yet";
  }

  const secondsAgo = Math.max(0, Math.round((now.getTime() - source.lastFetchAt) / 1000));
  if (source.status === "ok") {
    return `OK · ${secondsAgo}s ago`;
  }

  return source.lastError ? `${source.status} · ${source.lastError}` : `${source.status} · ${secondsAgo}s ago`;
}
