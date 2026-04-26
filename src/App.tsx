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
      <HeaderBar onRefresh={() => void refreshAll()} />

      <section className="main-grid">
        <aside className="tools-rail panel-shell">
          <div className="strip-header compact">
            <div>
              <p className="eyebrow">Tools</p>
            </div>
          </div>
          <ToolBelt tools={tools} />
          <QuickbarPanel apps={quickApps} />
        </aside>

        <section className="center-stack">
          <MarketsPanel state={markets} onRetry={() => void refreshAll()} />
          <ProjectsPanel projects={projects} onSyncCanvas={syncProjectsCanvas} />
          <LibraryPanel
            entries={library}
            onAddResearch={addResearch}
            onViewDatabase={syncResearchBase}
          />
        </section>

        <section className="right-stack">
          <WeatherPanel state={weather} onRetry={() => void refreshAll()} />
          <NowPlayingPanel nowPlaying={nowPlaying} />
          <ChatPanel messages={chat} onSendMessage={sendChatMessage} />
        </section>
      </section>
    </main>
  );
}

export default App;
