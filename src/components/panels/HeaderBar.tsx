import { RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderBarProps {
  onRefresh: () => void;
}

export function HeaderBar({ onRefresh }: HeaderBarProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
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

  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Command Station</p>
          <h1>Olympus</h1>
        </div>

        <div className="topbar-actions">
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
