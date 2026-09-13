import { GmailSettings } from "./GmailSettings";
import {ModelDiagnostics} from "./ModelSettings";
import { VoiceSettings } from "./VoiceSettings";
import type { VoicePreferences } from "../../services/voicePreferences";
import { CircleHelp, RefreshCw, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MODE_LABELS } from "../../hooks/useDashboardMode";
import type { DashboardMode } from "../../hooks/useDashboardMode";

interface AmbientDockProps {
  preferencesOpen:boolean;
  onPreferencesOpen:(open:boolean)=>void;
  voicePreferences: VoicePreferences;
  onVoicePreferences:(patch:Partial<VoicePreferences>)=>void;
  settingsReady:boolean;
  onRefresh: () => void;
  mode: DashboardMode;
  onCycleMode: () => void;
}

export function AmbientDock({ onRefresh, mode, onCycleMode, voicePreferences, onVoicePreferences, settingsReady, preferencesOpen, onPreferencesOpen:setPreferencesOpen }: AmbientDockProps) {
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

        {mode!=="command"&&<div className="ambient-floating-control">
          <button
            className="ambient-corner-button"
            onClick={() => setPreferencesOpen(!preferencesOpen)}
            title="Open preferences"
            aria-label="Open preferences"
            type="button"
          >
            <Settings2 size={16} />
          </button>
        </div>}
      </div>

      {preferencesOpen ? (
        <section className="settings-panel preferences-panel floating-preferences-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Preferences</p>
              <h2>Olympus Preferences</h2>
            </div>
            <button className="ghost-icon-action" type="button" aria-label="Close preferences" title="Close preferences" onClick={() => setPreferencesOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <ModelDiagnostics/>
          <GmailSettings/>
          <VoiceSettings preferences={voicePreferences} onChange={onVoicePreferences} ready={settingsReady}/>
          <button className="ghost-action" type="button" onClick={()=>setPreferencesOpen(false)}>Close preferences</button>
        </section>
      ) : null}
    </>
  );
}

