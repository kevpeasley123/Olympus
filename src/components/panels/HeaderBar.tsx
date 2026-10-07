import { ModeSwitcher } from "./ModeSwitcher";
import { OmegaInstrument } from "./OmegaInstrument";
import type { DashboardMode } from "../../hooks/useDashboardMode";
import type { TrackedProject } from "../../types";
import type { MouseEvent } from "react";
import type { ProjectScanState } from "../../hooks/useDashboardData";
import { ACCEPTANCE_LABEL, useAcceptanceProfile } from "../../services/acceptanceProfile";
import "./command.css";

interface HeaderBarProps {
  mode: DashboardMode;
  onSelectMode: (mode: DashboardMode) => void;
  projects: TrackedProject[];
  /** The next-step line shows only a genuine scan result (review U1). */
  projectScan?: ProjectScanState;
}

/** The console input's focus event; ChatPanel owns the input. */
function skipToConsole(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  window.dispatchEvent(new CustomEvent("olympus:focus-console"));
}

/**
 * Two zones at 96px: the omega instrument left, the mode switcher right.
 *
 * This was a centred 140px ceremonial band with no side slots, and three
 * separate redesign tasks all wanted to live in it — so they landed as one
 * restructure. The status rail that occupied the third zone went with the
 * markets/weather extraction; the budget machinery that sized it lived and
 * died with it.
 */
export function HeaderBar({ mode, onSelectMode, projects, projectScan }: HeaderBarProps) {
  const scanned = !projectScan || projectScan.status === "ready" || (projectScan.status === "stale" && projects.length > 0);
  const acceptance = useAcceptanceProfile();
  return (
    <header className="topbar olympus-header">
      {/* Persistent in every mode, so an acceptance run cannot be mistaken
          for the operator's real data. */}
      {acceptance && <p className="acceptance-profile-label" title={acceptance.dir}>{ACCEPTANCE_LABEL}</p>}
      {/* The first tab stop in every mode: the console sits last in reading
          order, behind the rail, catalog, board, library or mail (review U9). */}
      <a className="skip-to-console" href="#olympus-console-input" onClick={skipToConsole}>Skip to console</a>
      {/* Command mode moves the glyph and the sentence to the centre column, so
          the header keeps only the wordmark. Two omegas and two copies of the
          same sentence would contradict the one-glowing-object rule. */}
      <div className="olympus-header__zone olympus-header__zone--left">
        {mode === "command" || mode === "communications" ? (
          <div><h1 className="olympus-wordmark">OLYMPUS</h1></div>
        ) : (
          <OmegaInstrument projects={scanned ? projects : []} />
        )}
      </div>

      <div className="olympus-header__zone olympus-header__zone--center">
        <ModeSwitcher mode={mode} onSelectMode={onSelectMode} />
      </div>
    </header>
  );
}
