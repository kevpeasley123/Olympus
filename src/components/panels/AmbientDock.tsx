import { PreferencesDialog } from "./PreferencesDialog";
import type { VoicePreferences } from "../../services/voicePreferences";
import { isEditableTarget, isModalOpen, SHORTCUT_LIST, SHORTCUTS, type ShortcutScope } from "../../services/shortcuts";
import { CircleHelp, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MODE_LABELS } from "../../hooks/useDashboardMode";
import type { DashboardMode } from "../../hooks/useDashboardMode";

interface AmbientDockProps {
  preferencesOpen:boolean;
  onPreferencesOpen:(open:boolean)=>void;
  voicePreferences: VoicePreferences;
  onVoicePreferences:(patch:Partial<VoicePreferences>)=>void;
  settingsReady:boolean;
  /** A reply is being generated; the Restart confirmation names it. */
  chatPending?:boolean;
  onRefresh: () => void;
  mode: DashboardMode;
  onCycleMode: () => void;
}

const SCOPE_NOTES: Partial<Record<ShortcutScope, string>> = { research: "Research", console: "Console" };

export function AmbientDock({ onRefresh, mode, onCycleMode, voicePreferences, onVoicePreferences, settingsReady, chatPending = false, preferencesOpen, onPreferencesOpen:setPreferencesOpen }: AmbientDockProps) {
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
      // A modal owns the keyboard: changing mode or refreshing under the write
      // gate would move the ground beneath the decision it is asking for.
      const modalOpen = isModalOpen();

      // Checked before any typing guard: refreshing is safe while typing; it
      // touches no draft. The reload itself is suppressed by
      // `suppressWebviewReload` in main.tsx, outside this dock's boundary.
      if (SHORTCUTS.refresh.matches(event)) {
        if (!modalOpen) handleRefresh();
        return;
      }

      // An accelerator for the switcher in the header, never the only way to
      // reach a mode.
      if (SHORTCUTS.cycleMode.matches(event)) {
        event.preventDefault();
        if (!modalOpen && !isEditableTarget(event.target)) onCycleMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCycleMode, onRefresh]);

  // The popover sits over the console, so it behaves like any transient
  // layer: Escape or a press elsewhere closes it, before the console steps back.
  const shortcutsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shortcutsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isModalOpen()) return;
      event.stopPropagation();
      setShortcutsOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (!shortcutsRef.current?.contains(event.target as Node)) setShortcutsOpen(false);
    };
    window.addEventListener("keydown", close, true);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", close, true); document.removeEventListener("pointerdown", outside); };
  }, [shortcutsOpen]);

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
            title={`${SHORTCUTS.refresh.label} (${SHORTCUTS.refresh.keys})`}
            aria-label={SHORTCUTS.refresh.label}
            type="button"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="ambient-bottom-right">
        <div className="ambient-floating-control" ref={shortcutsRef}>
          <button
            className="ambient-corner-button"
            onClick={() => setShortcutsOpen((value) => !value)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            aria-expanded={shortcutsOpen}
            type="button"
          >
            <CircleHelp size={16} />
          </button>
          {/* Rendered from the registry the handlers match against, so the
              list cannot describe keys that do something else. */}
          {shortcutsOpen ? (
            <div className="ambient-popover shortcut-popover" role="note" aria-label="Keyboard shortcuts">
              {SHORTCUT_LIST.map((shortcut) => {
                const scope = SCOPE_NOTES[shortcut.scope];
                return (
                  <div className="shortcut-row" key={shortcut.id} title={shortcut.description}>
                    <kbd>{shortcut.keys}</kbd>
                    <small>{shortcut.label}{scope && !shortcut.label.includes(scope) ? ` · ${scope}` : ""}</small>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {mode!=="command"&&<div className="ambient-floating-control">
          <button
            className="ambient-corner-button"
            onClick={() => setPreferencesOpen(!preferencesOpen)}
            aria-haspopup="dialog"
            title="Open preferences"
            aria-label="Open preferences"
            type="button"
          >
            <Settings2 size={16} />
          </button>
        </div>}
      </div>

      <PreferencesDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)}
        preferences={voicePreferences} onPreferences={onVoicePreferences} settingsReady={settingsReady} chatPending={chatPending} />
    </>
  );
}

