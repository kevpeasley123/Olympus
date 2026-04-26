import { motion } from "motion/react";
import type { ReactNode } from "react";
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
    addResearch,
    sendChatMessage,
    syncResearchBase,
    syncProjectsCanvas,
    refreshAll
  } = useDashboardData();

  return (
    <main className="app-shell">
      <FadeInPanel index={0}>
        <HeaderBar onRefresh={() => void refreshAll()} />
      </FadeInPanel>

      <section className="main-grid">
        <aside className="tools-rail panel-shell">
          <FadeInPanel index={1}>
            <div className="strip-header compact">
              <div>
                <p className="eyebrow">Tools</p>
              </div>
            </div>
            <ToolBelt tools={tools} />
          </FadeInPanel>
          <FadeInPanel index={6}>
            <QuickbarPanel apps={quickApps} />
          </FadeInPanel>
        </aside>

        <section className="center-stack">
          <FadeInPanel index={2}>
            <MarketsPanel state={markets} onRetry={() => void refreshAll()} />
          </FadeInPanel>
          <FadeInPanel index={4}>
            <ProjectsPanel projects={projects} onSyncCanvas={syncProjectsCanvas} />
          </FadeInPanel>
          <FadeInPanel index={7}>
            <LibraryPanel
              entries={library}
              onAddResearch={addResearch}
              onViewDatabase={syncResearchBase}
            />
          </FadeInPanel>
        </section>

        <section className="right-stack">
          <FadeInPanel index={3}>
            <WeatherPanel state={weather} onRetry={() => void refreshAll()} />
          </FadeInPanel>
          <FadeInPanel index={5}>
            <NowPlayingPanel nowPlaying={nowPlaying} />
          </FadeInPanel>
          <FadeInPanel index={8}>
            <ChatPanel messages={chat} onSendMessage={sendChatMessage} />
          </FadeInPanel>
        </section>
      </section>
    </main>
  );
}

function FadeInPanel({
  index,
  children
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default App;
