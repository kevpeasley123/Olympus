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
 *
 * Pressed buttons, not tabs: no single tab panel exists for aria-controls to
 * name, and a tablist without arrow-key navigation misstates the keyboard.
 */
export function ModeSwitcher({ mode, onSelectMode }: ModeSwitcherProps) {
  return (
    <div className="mode-switcher" role="group" aria-label="Dashboard mode">
      {DASHBOARD_MODES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={candidate === mode}
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
