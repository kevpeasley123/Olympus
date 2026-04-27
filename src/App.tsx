import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChatPanel } from "./components/panels/ChatPanel";
import { HeaderBar } from "./components/panels/HeaderBar";
import { LibraryPanel } from "./components/panels/LibraryPanel";
import { MarketsPanel } from "./components/panels/MarketsPanel";
import { NowPlayingPanel } from "./components/panels/NowPlayingPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { QuickbarPanel } from "./components/panels/QuickbarPanel";
import { ToolBelt } from "./components/panels/ToolBelt";
import { WeatherPanel } from "./components/panels/WeatherPanel";
import { useDashboardData } from "./hooks/useDashboardData";

const FOCUS_MODE_KEY = "olympus.focusMode";

function App() {
  const {
    tools,
    quickApps,
    projects,
    library,
    chat,
    nowPlaying,
    markets,
    weather,
    sourceHealth,
    addResearch,
    sendChatMessage,
    syncResearchBase,
    syncProjectsCanvas,
    refreshAll
  } = useDashboardData();
  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FOCUS_MODE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(FOCUS_MODE_KEY, String(focusMode));
  }, [focusMode]);

  return (
    <main className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
      <FadeInPanel index={0} className="panel-slot panel-slot-header">
        <HeaderBar
          onRefresh={() => void refreshAll()}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((value) => !value)}
          sourceHealth={sourceHealth}
          projects={projects}
          markets={markets}
        />
      </FadeInPanel>

      <section className="main-grid">
        <aside className="tools-rail panel-shell">
          <FadeInPanel index={1} className="panel-slot panel-slot-tools">
            <div className="strip-header compact">
              <div>
                <p className="eyebrow">Tools</p>
              </div>
            </div>
            <ToolBelt tools={tools} compact={focusMode} />
          </FadeInPanel>
          <FadeInPanel index={6} className="panel-slot panel-slot-quickbar">
            <QuickbarPanel apps={quickApps} />
          </FadeInPanel>
        </aside>

        <section className="center-stack">
          <FadeInPanel index={2} className="panel-slot panel-slot-markets">
            <MarketsPanel state={markets} onRetry={() => void refreshAll()} compact={focusMode} />
          </FadeInPanel>
          <FadeInPanel index={4} className="panel-slot panel-slot-projects">
            <ProjectsPanel projects={projects} onSyncCanvas={syncProjectsCanvas} focusMode={focusMode} />
          </FadeInPanel>
          <FadeInPanel index={7} className="panel-slot panel-slot-library">
            <LibraryPanel
              entries={library}
              onAddResearch={addResearch}
              onViewDatabase={syncResearchBase}
            />
          </FadeInPanel>
        </section>

        <section className="right-stack">
          <FadeInPanel index={3} className="panel-slot panel-slot-weather">
            <WeatherPanel state={weather} onRetry={() => void refreshAll()} compact={focusMode} />
          </FadeInPanel>
          <FadeInPanel index={5} className="panel-slot panel-slot-now-playing">
            <NowPlayingPanel nowPlaying={nowPlaying} compact={focusMode} />
          </FadeInPanel>
          <FadeInPanel index={8} className="panel-slot panel-slot-chat">
            <ChatPanel messages={chat} onSendMessage={sendChatMessage} />
          </FadeInPanel>
        </section>
      </section>
    </main>
  );
}

function FadeInPanel({
  index,
  className,
  children
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default App;
