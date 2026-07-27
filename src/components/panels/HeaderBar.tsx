import { useLayoutEffect, useRef, useState } from "react";
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
 * Floor for the left zone: the sigil plus enough of the wordmark to read.
 * The rail is never given a budget that would push the left zone below this,
 * which is what stops a wide rail from starving the mark off the screen.
 */
const LEFT_ZONE_MIN = 280;

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
  const headerRef = useRef<HTMLElement>(null);
  const centreRef = useRef<HTMLDivElement>(null);
  const [railBudget, setRailBudget] = useState(0);

  // The rail cannot measure its own container — its grid track is `auto`, so
  // the container is sized by the rail. The budget is computed here instead,
  // from the header's content box minus the switcher and the left zone's floor.
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const recompute = () => {
      const styles = getComputedStyle(header);
      const inner =
        header.clientWidth -
        parseFloat(styles.paddingLeft || "0") -
        parseFloat(styles.paddingRight || "0");
      const gap = parseFloat(styles.columnGap || "0") || 0;
      const centre = centreRef.current?.getBoundingClientRect().width ?? 0;
      const next = Math.max(0, inner - centre - LEFT_ZONE_MIN - gap * 2);
      setRailBudget((current) => (Math.abs(current - next) < 1 ? current : next));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(header);
    return () => observer.disconnect();
  }, [mode]);

  return (
    <header className="topbar olympus-header" ref={headerRef}>
      <div className="olympus-header__zone olympus-header__zone--left">
        <OmegaInstrument projects={projects} />
      </div>

      <div className="olympus-header__zone olympus-header__zone--center" ref={centreRef}>
        <ModeSwitcher mode={mode} onSelectMode={onSelectMode} />
      </div>

      <div className="olympus-header__zone olympus-header__zone--right">
        <StatusRail
          markets={markets}
          weather={weather}
          onOpen={onOpenStatusPanel}
          budget={railBudget}
        />
      </div>
    </header>
  );
}
