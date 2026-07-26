import { DASHBOARD_MODES, MODE_LABELS } from "../../hooks/useDashboardMode";
import type { DashboardMode } from "../../hooks/useDashboardMode";

interface ModeSwitcherProps {
  mode: DashboardMode;
  onSelectMode: (mode: DashboardMode) => void;
}

/**
 * A visible segmented control. Ctrl+\ cycles the same state, but the keyboard
 * is an accelerator — a mode you can only reach by knowing a shortcut is a mode
 * most operators never find.
 */
export function ModeSwitcher({ mode, onSelectMode }: ModeSwitcherProps) {
  return (
    <div className="mode-switcher" role="tablist" aria-label="Dashboard mode">
      {DASHBOARD_MODES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="tab"
          aria-selected={candidate === mode}
          className={`mode-switcher__segment ${candidate === mode ? "is-active" : ""}`}
          onClick={() => onSelectMode(candidate)}
          title={`${MODE_LABELS[candidate]} mode (Ctrl/Cmd+\\ cycles)`}
        >
          {MODE_LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}
