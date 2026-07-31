import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { AmbientDock } from "./components/panels/AmbientDock";
import { ChatPanel } from "./components/panels/ChatPanel";
import { CommandInstrument } from "./components/panels/CommandInstrument";
import { HeaderBar } from "./components/panels/HeaderBar";
import { LibraryPanel } from "./components/panels/LibraryPanel";
import { MarketsPanel } from "./components/panels/MarketsPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { QuickbarPanel } from "./components/panels/QuickbarPanel";
import { StatusOverlay } from "./components/panels/StatusOverlay";
import type { StatusRailTarget } from "./components/panels/StatusRail";
import { ToolBelt } from "./components/panels/ToolBelt";
import { WeatherPanel } from "./components/panels/WeatherPanel";
import { WriteConfirmDialog } from "./components/panels/WriteConfirmDialog";
import { openVaultNote } from "./services/launcher";
import { useActionQueue } from "./hooks/useActionQueue";
import { usePantheon } from "./hooks/usePantheon";
import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardMode } from "./hooks/useDashboardMode";
import type { DashboardMode } from "./hooks/useDashboardMode";
import type { ProjectStatus } from "./types";

function App() {
  const {
    tools,
    quickApps,
    projects,
    sessionBoundary,
    projectNoteWarnings,
    chat,
    chatPending,
    chatError,
    chatModel,
    markets,
    weather,
    sourceHealth,
    sendChatMessage,
    recordObservation,
    syncResearchBase,
    syncProjectsCanvas,
    refreshAll
  } = useDashboardData();
  const { mode, setMode, cycleMode } = useDashboardMode();
  // Subscribed here, not only inside the panels that display them, so both
  // scans run in every mode. Without this the instrument's task and pantheon
  // dots would be permanently dark in Command — the one mode that shows them.
  const {
    tasks: actionTasks,
    loading: actionTasksLoading,
    error: actionTasksError
  } = useActionQueue();
  usePantheon();
  const [statusPanel, setStatusPanel] = useState<StatusRailTarget | null>(null);
  /** Set by clicking a tier arc; Project mode opens filtered to it. */
  const [tierFilter, setTierFilter] = useState<ProjectStatus | null>(null);
  /** Set when Project mode narrows its detailed briefing to one workspace. */
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  // Project mode is what focus mode was, so the density props that used to read
  // a boolean now read the mode. One state, not two.
  const dense = mode === "project";
  const research = mode === "research";
  const command = mode === "command";

  function enterTier(status: ProjectStatus) {
    setProjectFilter(null);
    setTierFilter(status);
    setMode("project");
  }

  function enterProject(projectId: string) {
    setTierFilter(null);
    setProjectFilter(projectId);
    setMode("project");
  }

  // Switching modes by any other route clears the filter, so Project mode is
  // never silently showing a subset the operator did not ask for.
  function selectMode(next: DashboardMode) {
    if (next !== "project") {
      setTierFilter(null);
      setProjectFilter(null);
    }
    setMode(next);
  }

  return (
    // `reducedMotion="user"` makes every `motion` component in the tree honour
    // the OS setting, including AnimatePresence inside LibraryPanel. Wiring it
    // per component would leave the ones nobody remembered to touch animating.
    <MotionConfig reducedMotion="user">
      <BackgroundLayer />
      <main className={`app-shell mode-${mode} ${dense ? "focus-mode" : ""}`}>
      <FadeInPanel index={0} className="panel-slot panel-slot-header">
        <HeaderBar
          mode={mode}
          onSelectMode={selectMode}
          projects={projects}
          markets={markets}
          weather={weather}
          onOpenStatusPanel={setStatusPanel}
        />
      </FadeInPanel>

      <div className="dashboard-body">
        <section className="main-grid">
          {/* An icon rail. The "Tools" heading and the labels came out with the
              column width — at 44px the icons are the whole affordance, and
              each row already carries a title attribute. */}
          <aside className="tools-rail dashboard-column panel-shell surface-chrome">
            <FadeInPanel index={1} className="panel-slot panel-slot-tools">
              <ToolBelt tools={tools} compact />
            </FadeInPanel>
            <FadeInPanel index={6} className="panel-slot panel-slot-quickbar">
              <QuickbarPanel apps={quickApps} />
            </FadeInPanel>
          </aside>

          <section className="center-stack dashboard-column">
            {/* Research mode gives the whole column to the library. The other
                two keep the queue and the projects; the library rides along as
                its one-line strip. */}
            {/* Command is the instrument and nothing else — no list, no strip,
                no panel chrome. If a scrolling list appears here it has become
                Project mode with a different tab lit. */}
            {command ? (
              <FadeInPanel index={1} className="panel-slot panel-slot-instrument">
                <CommandInstrument
                  projects={projects}
                  tasks={actionTasks}
                  tasksLoading={actionTasksLoading}
                  tasksError={actionTasksError}
                  assistantPending={chatPending}
                  assistantModel={chatModel}
                  onSelectProject={enterProject}
                  onOpenNote={(notePath) => void openVaultNote(notePath)}
                />
              </FadeInPanel>
            ) : research ? (
              <FadeInPanel index={1} className="panel-slot panel-slot-library-resident">
                <LibraryPanel onViewDatabase={syncResearchBase} resident />
              </FadeInPanel>
            ) : (
              <>
                <FadeInPanel index={4} className="panel-slot panel-slot-projects">
                  <ProjectsPanel
                    projects={projects}
                    sessionBoundary={sessionBoundary}
                    onSyncCanvas={syncProjectsCanvas}
                    noteWarnings={projectNoteWarnings}
                    focusMode={dense}
                    tierFilter={tierFilter}
                    projectFilter={projectFilter}
                    onClearFilter={() => {
                      setTierFilter(null);
                      setProjectFilter(null);
                    }}
                    onFocusProject={enterProject}
                    onOpenNote={(notePath) => void openVaultNote(notePath)}
                  />
                </FadeInPanel>
                <FadeInPanel index={7} className="panel-slot panel-slot-library">
                  <LibraryPanel onViewDatabase={syncResearchBase} />
                </FadeInPanel>
              </>
            )}
          </section>

          {/* Chat stays in the right column in every mode, including Research —
              it is the one surface that should not move when the mode does. */}
          <section className="right-stack dashboard-column">
            <FadeInPanel index={8} className="panel-slot panel-slot-chat">
              <ChatPanel
                messages={chat}
                onSendMessage={sendChatMessage}
                onRecordObservation={recordObservation}
                pending={chatPending}
                error={chatError}
                compact={command}
              />
            </FadeInPanel>
          </section>
        </section>
      </div>

      {/* Markets and Weather are resident in the header rail now. The panels
          themselves are unchanged — the rail summarises them, it does not
          reimplement them. */}
      {statusPanel === "markets" ? (
        <StatusOverlay label="Markets" onClose={() => setStatusPanel(null)}>
          <MarketsPanel state={markets} onRetry={() => void refreshAll()} />
        </StatusOverlay>
      ) : null}

      {statusPanel === "weather" ? (
        <StatusOverlay label="Weather" onClose={() => setStatusPanel(null)}>
          <WeatherPanel state={weather} onRetry={() => void refreshAll()} />
        </StatusOverlay>
      ) : null}

      <AmbientDock
        onRefresh={() => void refreshAll()}
        mode={mode}
        onCycleMode={() => {
          // Cycling is an explicit mode change, so it clears the tier filter
          // for the same reason clicking a segment does.
          setTierFilter(null);
          setProjectFilter(null);
          cycleMode();
        }}
        sourceHealth={sourceHealth}
      />
      <WriteConfirmDialog />
      </main>
    </MotionConfig>
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
  // MotionConfig already strips the transform from `animate`, but the stagger
  // delay is not motion — it would still hold each panel invisible in sequence.
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 0.2, delay: index * 0.05, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}

export default App;
