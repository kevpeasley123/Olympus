import { Globe2, MessageCircle, Music2 } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { launchQuickApp } from "../../services/launcher";
import type { QuickApp } from "../../types";

const quickAppIcons: Record<string, typeof Music2> = {
  "quick-spotify": Music2,
  "quick-discord": MessageCircle,
  "quick-chrome": Globe2
};

interface QuickbarPanelProps {
  apps: QuickApp[];
}

export function QuickbarPanel({ apps }: QuickbarPanelProps) {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2800);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleLaunch(app: QuickApp) {
    try {
      const mode = await launchQuickApp(app.id, app.launchUri);
      setStatus(
        mode === "native"
          ? `${app.name} opened from the desktop shell.`
          : `${app.name} opened in preview mode with the best available route.`
      );
    } catch {
      setStatus(`${app.name} could not be opened from this environment yet.`);
    }
  }

  return (
    <div className="quickbar-block">
      <p className="eyebrow">Quickbar</p>
      <div className="quickbar-grid">
        {apps.map((app) => (
          <QuickAppButton key={app.id} app={app} onLaunch={() => void handleLaunch(app)} />
        ))}
      </div>
      <p className="quickbar-note">
        {status || "Launch the apps you reach for most without leaving Olympus."}
      </p>
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
  const Icon = quickAppIcons[app.id] ?? Globe2;

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
      <Icon size={16} strokeWidth={1.8} />
      <span>{app.name}</span>
    </button>
  );
}
