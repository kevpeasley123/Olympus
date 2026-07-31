import { CircleHelp, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MODE_LABELS } from "../../hooks/useDashboardMode";
import type { DashboardMode } from "../../hooks/useDashboardMode";

interface AmbientDockProps {
  onRefresh: () => void;
  mode: DashboardMode;
  onCycleMode: () => void;
}

export function AmbientDock({ onRefresh, mode, onCycleMode }: AmbientDockProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (!(event.metaKey || event.ctrlKey) || isTypingTarget) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleRefresh();
      }

      // An accelerator for the switcher in the header, never the only way to
      // reach a mode.
      if (event.key === "\\") {
        event.preventDefault();
        onCycleMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCycleMode]);

  const timeLabel = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const dateLabel = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  function handleRefresh() {
    setRefreshSpinning(true);
    onRefresh();
    window.setTimeout(() => setRefreshSpinning(false), 200);
  }

  return (
    <>
      <div className="ambient-bottom-left">
        <div className="ambient-time-row tabular-data">
          <span className="ambient-time">{timeLabel}</span>
          <span className="ambient-separator">·</span>
          <span className="ambient-date">{dateLabel}</span>
          <span className="ambient-separator">·</span>
          <span className="ambient-focus-label">{MODE_LABELS[mode]}</span>
          <button
            className={`ambient-inline-button ${refreshSpinning ? "is-spinning" : ""}`}
            onClick={handleRefresh}
            title="Refresh data (Ctrl/Cmd+R)"
            aria-label="Refresh data"
            type="button"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="ambient-bottom-right">
        <div className="ambient-floating-control">
          <button
            className="ambient-corner-button"
            onClick={() => setShortcutsOpen((value) => !value)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            type="button"
          >
            <CircleHelp size={16} />
          </button>
          {shortcutsOpen ? (
            <div className="ambient-popover shortcut-popover">
              <div className="shortcut-row">
                <span>Ctrl/Cmd+R</span>
                <small>Refresh data</small>
              </div>
              <div className="shortcut-row">
                <span>Ctrl/Cmd+\</span>
                <small>Cycle mode — Command, Project, Research</small>
              </div>
              {/* Ctrl+K focuses the search box inside the library once it is
                  open; it has never opened it. Saying otherwise taught the
                  shortcut wrong. */}
              <div className="shortcut-row">
                <span>Ctrl/Cmd+K</span>
                <small>Focus search in the open library</small>
              </div>
              <div className="shortcut-row">
                <span>Esc</span>
                <small>Clear search / close detail view</small>
              </div>
            </div>
          ) : null}
        </div>

        <div className="ambient-floating-control">
          <button
            className="ambient-corner-button"
            onClick={() => setPreferencesOpen((value) => !value)}
            title="Open preferences"
            aria-label="Open preferences"
            type="button"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {preferencesOpen ? (
        <section className="settings-panel preferences-panel floating-preferences-panel">
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
          </div>
        </section>
      ) : null}
    </>
  );
}

