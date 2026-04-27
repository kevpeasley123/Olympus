import { Maximize2, Minimize2, RefreshCw, Settings2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { TrackedProject } from "../../types";
import type { LoadableState, LiveSourceHealth } from "../../types/dashboard";
import type { MarketPanelData } from "../../types/markets";

interface HeaderBarProps {
  onRefresh: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  sourceHealth: LiveSourceHealth[];
  projects: TrackedProject[];
  markets: LoadableState<MarketPanelData>;
}

const TAGLINES = [
  "aut viam inveniam aut faciam",
  "ad astra per aspera",
  "imperium et libertas",
  "labor omnia vincit",
  "non ducor, duco"
];

export function HeaderBar({
  onRefresh,
  focusMode,
  onToggleFocusMode,
  sourceHealth,
  projects,
  markets
}: HeaderBarProps) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [tagline, setTagline] = useState(() => getDailyTagline(new Date()));

  useEffect(() => {
    const update = () => {
      const nextNow = new Date();
      setNow(nextNow);
      setTagline(getDailyTagline(nextNow));
    };

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
  const overallHealth = deriveOverallHealth(sourceHealth);
  const invocation = useMemo(
    () => generateInvocation(now, projects, markets),
    [markets, now, projects]
  );

  return (
    <>
      <header className="topbar topbar-olympus">
        <div className="topbar-backdrop" aria-hidden="true">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="topoFade" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d="M0,140 Q200,100 400,120 T800,110 T1200,130" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
            <path d="M0,150 Q220,118 420,135 T820,128 T1200,145" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
            <path d="M0,160 Q180,135 380,148 T780,142 T1200,158" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
            <path d="M0,170 Q240,148 440,160 T840,155 T1200,170" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
            <path d="M0,180 Q200,165 400,172 T800,170 T1200,182" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
            <path d="M0,190 Q220,180 420,184 T820,182 T1200,192" stroke="url(#topoFade)" strokeWidth="0.8" fill="none" />
          </svg>
        </div>

        <div className="brand-block olympus-brand-block">
          <motion.div
            className="olympus-sigil-shell"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
          >
            <OlympusSigil />
          </motion.div>

          <div className="olympus-brand-copy">
            <p className="olympus-eyebrow">COMMAND STATION</p>
            <div className="olympus-wordmark-row">
              <motion.h1
                className="olympus-wordmark"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
              >
                OLYMPUS
              </motion.h1>
              <motion.p
                className="olympus-tagline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.7, ease: "easeOut" }}
              >
                {tagline}
              </motion.p>
            </div>
            <motion.p
              className="olympus-invocation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.7, ease: "easeOut" }}
            >
              <span className="time-phrase">{invocation.timePhrase}.</span>{" "}
              <span className="project-phrase">{invocation.projectPhrase}.</span>
              {invocation.ambientPhrase ? (
                <>
                  {" "}
                  <span className="ambient-phrase">{invocation.ambientPhrase}</span>
                </>
              ) : null}
            </motion.p>
          </div>
        </div>

        <div className="topbar-actions olympus-topbar-actions">
          <div className={`health-indicator ${overallHealth}`} title="Live data source health">
            <span className="health-indicator-dot" aria-hidden="true"></span>
            <div className="health-popover">
              {sourceHealth.map((source) => (
                <div key={source.key} className="health-popover-row">
                  <span className={`health-source-dot ${source.status}`} aria-hidden="true"></span>
                  <span>{source.label}</span>
                  <small>{formatHealthMeta(source, now)}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="header-pill olympus-time-pill tabular-data">
            <span>{timeLabel}</span>
            <span className="header-separator">·</span>
            <span>{dateLabel}</span>
          </div>

          <button className="icon-button" onClick={onRefresh} title="Refresh live dashboard data">
            <RefreshCw size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setPreferencesOpen((value) => !value)}
            title="Open preferences"
          >
            <Settings2 size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onToggleFocusMode}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
          >
            {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      {preferencesOpen && (
        <section className="settings-panel preferences-panel">
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
            <div className="preference-row">
              <span>Markets detail</span>
              <strong>Collapsed by default</strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function OlympusSigil() {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" className="olympus-sigil">
      <circle
        cx="21"
        cy="21"
        r="19"
        stroke="#d97706"
        strokeWidth="0.8"
        opacity="0.3"
        className="olympus-sigil-ring outer"
      />
      <circle cx="21" cy="21" r="14" stroke="#d97706" strokeWidth="0.6" opacity="0.5" />
      <text
        x="21"
        y="28"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontSize="20"
        fontWeight="500"
        fill="#d97706"
        className="olympus-sigil-glyph"
      >
        Ω
      </text>
    </svg>
  );
}

function deriveOverallHealth(sources: LiveSourceHealth[]): LiveSourceHealth["status"] {
  if (sources.some((source) => source.status === "failed")) return "failed";
  if (sources.some((source) => source.status === "stale")) return "stale";
  return "ok";
}

function formatHealthMeta(source: LiveSourceHealth, now: Date): string {
  if (!source.lastFetchAt) {
    return source.lastError ? source.lastError : "No successful fetch yet";
  }

  const secondsAgo = Math.max(0, Math.round((now.getTime() - source.lastFetchAt) / 1000));
  if (source.status === "ok") {
    return `OK · ${secondsAgo}s ago`;
  }

  return source.lastError
    ? `${source.status} · ${source.lastError}`
    : `${source.status} · ${secondsAgo}s ago`;
}

function getDailyTagline(now: Date): string {
  const storageKey = "olympus.dailyTagline";
  const dateKey = now.toISOString().slice(0, 10);

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { date: string; value: string };
        if (parsed.date === dateKey && TAGLINES.includes(parsed.value)) {
          return parsed.value;
        }
      } catch {
        // ignore malformed persisted value
      }
    }
  }

  const index =
    Math.abs(
      dateKey
        .split("-")
        .join("")
        .split("")
        .reduce((sum, char) => sum + Number(char), 0)
    ) % TAGLINES.length;
  const next = TAGLINES[index];

  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, value: next }));
  }

  return next;
}

function generateInvocation(
  now: Date,
  projects: TrackedProject[],
  markets: LoadableState<MarketPanelData>
) {
  const hour = now.getHours();
  const day = now.toLocaleDateString([], { weekday: "long" });
  let timePhrase: string;

  if (hour < 6) timePhrase = `Late ${day} hours`;
  else if (hour < 12) timePhrase = `${day} morning`;
  else if (hour < 17) timePhrase = `${day} afternoon`;
  else if (hour < 21) timePhrase = `${day} evening`;
  else timePhrase = `${day} night`;

  const activeCount = projects.filter((project) => project.status === "active").length;
  const projectPhrase =
    activeCount === 0 ? "Quiet docket" : activeCount === 1 ? "1 active project" : `${activeCount} active projects`;

  const weekday = now.getDay();
  const isMarketWeekday = weekday >= 1 && weekday <= 5;
  const hasLiveIssue = !!markets.error || !!markets.data?.overallError;
  let ambientPhrase = "";

  if (hasLiveIssue) {
    ambientPhrase = "Market feeds need attention.";
  } else if (isMarketWeekday && hour >= 9 && hour < 16) {
    ambientPhrase = "Markets open.";
  } else if (isMarketWeekday && hour >= 16 && hour < 18) {
    ambientPhrase = "Markets settling into the close.";
  } else if (isMarketWeekday && hour < 9) {
    ambientPhrase = "Markets pre-open.";
  }

  return { timePhrase, projectPhrase, ambientPhrase };
}
