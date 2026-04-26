import { siDiscord, siSpotify, siX, siYoutube } from "simple-icons";
import type { KeyboardEvent } from "react";
import { launchQuickApp } from "../../services/launcher";
import type { QuickApp } from "../../types";

const quickAppIcons: Record<string, { path: string; color: string }> = {
  "quick-spotify": { path: siSpotify.path, color: "#1DB954" },
  "quick-discord": { path: siDiscord.path, color: "#5865F2" },
  "quick-x": { path: siX.path, color: "#FFFFFF" },
  "quick-youtube": { path: siYoutube.path, color: "#FF0000" }
};

interface QuickbarPanelProps {
  apps: QuickApp[];
}

export function QuickbarPanel({ apps }: QuickbarPanelProps) {
  async function handleLaunch(app: QuickApp) {
    try {
      await launchQuickApp(app.id, app.launchUri);
    } catch {
      console.warn(`[Olympus] Could not launch ${app.name} from this environment yet.`);
    }
  }

  return (
    <div className="quickbar-block">
      <div className="quickbar-grid">
        {apps.map((app) => (
          <QuickAppButton key={app.id} app={app} onLaunch={() => void handleLaunch(app)} />
        ))}
      </div>
    </div>
  );
}

function QuickAppButton({
  app,
  onLaunch
}: {
  app: QuickApp;
  onLaunch: () => void;
}) {
  const icon = quickAppIcons[app.id] ?? quickAppIcons["quick-x"];

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onLaunch();
    }
  }

  return (
    <button
      className="quick-app-button"
      onClick={onLaunch}
      onKeyDown={handleKeyDown}
      title={`Open ${app.name}`}
      aria-label={`Open ${app.name}`}
      type="button"
    >
      <span className="quick-app-tooltip">{app.name}</span>
      <svg
        className="quick-app-logo"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ color: icon.color }}
      >
        <path d={icon.path} fill="currentColor" />
      </svg>
    </button>
  );
}
