import { ModeSwitcher } from "./ModeSwitcher";
import { OmegaInstrument } from "./OmegaInstrument";
import { StatusRail } from "./StatusRail";
import type { StatusRailTarget } from "./StatusRail";
import type { DashboardMode } from "../../hooks/useDashboardMode";
import type { LoadableState } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";
import type { TrackedProject } from "../../types";
import type { WeatherPanelData } from "../../types/weather";

interface HeaderBarProps {
  mode: DashboardMode;
  onSelectMode: (mode: DashboardMode) => void;
  projects: TrackedProject[];
  markets: LoadableState<MarketPanelData>;
  weather: LoadableState<WeatherPanelData>;
  onOpenStatusPanel: (target: StatusRailTarget) => void;
}

/**
 * Three zones at 96px: the omega instrument left, the mode switcher centre, the
 * status rail right.
 *
 * This was a centred 140px ceremonial band with no side slots, and three
 * separate redesign tasks all wanted to live in it — so they landed as one
 * restructure. The sigil came down from 100px and the wordmark from 56px to pay
 * for the two zones that did not exist before.
 */
export function HeaderBar({
  mode,
  onSelectMode,
  projects,
  markets,
  weather,
  onOpenStatusPanel
}: HeaderBarProps) {
  return (
    <header className="topbar olympus-header">
      <div className="olympus-header__zone olympus-header__zone--left">
        <OmegaInstrument projects={projects} />
      </div>

      <div className="olympus-header__zone olympus-header__zone--center">
        <ModeSwitcher mode={mode} onSelectMode={onSelectMode} />
      </div>

      <div className="olympus-header__zone olympus-header__zone--right">
        <StatusRail markets={markets} weather={weather} onOpen={onOpenStatusPanel} />
      </div>
    </header>
  );
}
