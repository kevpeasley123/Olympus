import { Communications } from "./components/panels/Communications";
import { realtimeVoice, voicePreview, useVoiceState, type VoiceSnapshot } from "./services/realtimeVoice";
import type { OlympusVisualState } from "./services/ambientMotion";
import { validateVoiceNavigation } from "./services/voiceContract";
import { operationalStatuses, type OperationalStatus } from "./services/projectCommandBoard";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { AmbientDock } from "./components/panels/AmbientDock";
import { ChatPanel } from "./components/panels/ChatPanel";
import { CommandInstrument } from "./components/panels/CommandInstrument";
import { CommandAgentCatalog } from "./components/panels/CommandAgentCatalog";
import type { ResearchInspectionTarget } from "./services/commandAgents";
import { HeaderBar } from "./components/panels/HeaderBar";
import { LibraryPanel } from "./components/panels/LibraryPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { QuickbarPanel } from "./components/panels/QuickbarPanel";
import { ToolBelt } from "./components/panels/ToolBelt";
import { WriteConfirmDialog } from "./components/panels/WriteConfirmDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { projectHasOpenWork, readViewSlice, useViewSlice } from "./state/viewState";
import { subscribeToNavigation } from "./services/navigation";
import { isTauriRuntime, openVaultNote } from "./services/launcher";
import { useActionQueue } from "./hooks/useActionQueue";
import { usePantheon } from "./hooks/usePantheon";
import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardMode } from "./hooks/useDashboardMode";
import type { DashboardMode } from "./hooks/useDashboardMode";

function App() {
  const [preferencesOpen,setPreferencesOpen]=useState(false);
  const [commandAgent,setCommandAgent]=useState("olympus");
  const [researchInspection,setResearchInspection]=useState<ResearchInspectionTarget|null>(null);
  const {
    settings, settingsReady, updateVoicePreferences,
    tools,
    quickApps,
    projects,
    sessionBoundary,
    openingBriefing,
    projectNoteWarnings,
    chat,
    chatPending,
    chatError,
    chatModel,
    chatProducing,
    chatFellBackFrom,
    chatCapability,
    sendChatMessage,
    updateVoiceMessage,
    recordObservation,
    syncResearchBase,
    syncProjectsCanvas,
    refreshAll,
    projectScan,
    rescanProjects,
    demoData
  } = useDashboardData();
  const voice = useVoiceState();
  const [voiceFilter, setVoiceFilter] = useState<{status:OperationalStatus|"ALL"; revision:number}>({status:"ALL",revision:0});
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
  /**
   * The project whose detail is open in Project mode. Held in the session view
   * store rather than App state so a Command glance and back can restore it
   * (review U3); `selectMode` still decides when it is cleared.
   */
  const [projectView, setProjectView] = useViewSlice("project");
  const projectFilter = projectView.detailProjectId;
  const setProjectFilter = useCallback((detailProjectId: string | null) => {
    setProjectView(current => current.detailProjectId === detailProjectId ? current : { ...current, detailProjectId });
  }, [setProjectView]);
  /**
   * Leaving Project mode clears the open project so it never silently shows a
   * subset — unless the operator has typed work there (an unsent run task or
   * review notes), which would otherwise be stranded behind the board.
   */
  const releaseProjectFilter = useCallback(() => {
    if (!projectHasOpenWork(readViewSlice("project").detailProjectId)) setProjectFilter(null);
  }, [setProjectFilter]);

  // Project mode is what focus mode was, so the density props that used to read
  // a boolean now read the mode. One state, not two.
  const dense = mode === "project";
  const research = mode === "research";
  const command = mode === "command";

  // Stable handlers: AmbientDock re-subscribes its global shortcuts whenever
  // these change, and App re-renders on every poll that lands.
  const enterProject = useCallback((projectId: string) => {
    setProjectFilter(projectId);
    setMode("project");
  }, [setMode]);
  const openNote = useCallback((notePath: string) => void openVaultNote(notePath), []);
  const refreshDashboard = useCallback(() => void refreshAll(), [refreshAll]);
  const cycleDashboardMode = useCallback(() => {
    // Cycling is an explicit mode change, so it releases the project filter
    // for the same reason any other mode switch does.
    releaseProjectFilter();
    cycleMode();
  }, [cycleMode, releaseProjectFilter]);

  // Cross-surface navigation (services/navigation.ts). The target itself is
  // already parked in the view store; App only moves to the right mode.
  useEffect(() => subscribeToNavigation(request => {
    setResearchInspection(null);
    if (request.kind === "project") {
      setProjectFilter(request.projectId);
      setMode("project");
      return;
    }
    releaseProjectFilter();
    setMode(request.kind === "research" ? "research" : "communications");
  }), [setMode, setProjectFilter, releaseProjectFilter]);

  useEffect(() => {
    realtimeVoice.configure({
      answer: sendChatMessage,
      update: updateVoiceMessage,
      navigate: candidate => {
        const action=validateVoiceNavigation(candidate,projects);if(!action)return;
        // Navigation only. Never dispatch approval, execution, or vault mutation here.
        if (action.type === "show_projects") {
          const status = action.status ?? "ALL";
          if (status !== "ALL" && !operationalStatuses.includes(status)) return;
          setProjectFilter(null); setMode("project");
          setVoiceFilter(current => ({status,revision:current.revision+1}));
        } else if (["open_project","review_proposal"].includes(action.type) && "projectId" in action && projects.some(project => project.id === action.projectId)) {
          setProjectFilter(action.projectId); setMode("project");
        }
      }
    });
  }, [sendChatMessage, updateVoiceMessage, projects, setMode, setProjectFilter]);
  useEffect(() => { if(settingsReady)void realtimeVoice.applyPreferences(settings); }, [settings,settingsReady]);
  // Spoken through the same output-only path as a typed reply, so Auto Speak
  // governs it and the transcript keeps a Replay control either way. At most
  // once: turning Auto Speak on later must not replay it.
  const spokenBriefing = useRef<string | null>(null);
  useEffect(() => {
    if (!openingBriefing || spokenBriefing.current === openingBriefing.id) return;
    spokenBriefing.current = openingBriefing.id;
    // The browser runtime has no voice session to open; the text still lands.
    // After a voice failure this session it stays text: no retry loop (U2).
    if (settings.autoSpeak && isTauriRuntime() && realtimeVoice.getSnapshot().failures === 0) void realtimeVoice.replay(openingBriefing.text, openingBriefing.id);
  }, [openingBriefing, settings.autoSpeak]);
  useEffect(() => () => {realtimeVoice.stop();voicePreview.stop();}, []);

  // Switching modes by any other route clears the filter, so Project mode is
  // never silently showing a subset the operator did not ask for.
  function selectMode(next: DashboardMode) {
    setResearchInspection(null);
    if (next !== "project") {
      releaseProjectFilter();
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
      {/* Each region has its own error boundary, so one view failing to render
          never unmounts the header, the console or the write gate. The write
          gate sits outside every boundary. */}
      <FadeInPanel index={0} className="panel-slot panel-slot-header">
        <ErrorBoundary label="Header">
          <HeaderBar mode={mode} onSelectMode={selectMode} projects={projects} projectScan={projectScan} />
        </ErrorBoundary>
      </FadeInPanel>

      <div className="dashboard-body">
        <section className="main-grid">
          {/* An icon rail. The "Tools" heading and the labels came out with the
              column width — at 44px the icons are the whole affordance, and
              each row already carries a title attribute. */}
          <aside className="tools-rail dashboard-column panel-shell surface-chrome">
            <ErrorBoundary label="Tool rail">
              <FadeInPanel index={1} className="panel-slot panel-slot-tools">
                <ToolBelt tools={tools} compact />
              </FadeInPanel>
              <FadeInPanel index={6} className="panel-slot panel-slot-quickbar">
                <QuickbarPanel apps={quickApps} />
              </FadeInPanel>
            </ErrorBoundary>
          </aside>

          {command&&<ErrorBoundary label="Agent catalog"><CommandAgentCatalog selectedId={commandAgent} onSelect={setCommandAgent}
            onResearch={runId=>{setResearchInspection(previous=>({runId,revision:(previous?.revision??0)+1}));setMode("research")}}
            onProjects={()=>selectMode("project")}/></ErrorBoundary>}

          <section className="center-stack dashboard-column">
            {/* Research mode gives the whole column to the library. The other
                two keep the queue and the projects; the library rides along as
                its one-line strip. */}
            {/* Command is the instrument and nothing else — no list, no strip,
                no panel chrome. If a scrolling list appears here it has become
                Project mode with a different tab lit. */}
            {<div className="panel-slot panel-slot-instrument" hidden={!command}>
              <ErrorBoundary label="Command view">
                <CommandInstrument
                  active={command}
                  visualState={instrumentState(voice, chatError)}
                  voiceLevel={voice.level}
                  projects={projects}
                  tasks={actionTasks}
                  tasksLoading={actionTasksLoading}
                  tasksError={actionTasksError}
                  assistantPending={chatPending}
                  assistantProducing={chatProducing}
                  assistantModel={chatModel}
                  assistantFellBackFrom={chatFellBackFrom}
                  assistantCapability={chatCapability}
                  projectScan={projectScan}
                  onRetryScan={rescanProjects}
                  onSelectProject={enterProject}
                  onOpenNote={openNote}
                />
              </ErrorBoundary>
              </div>}
            {command ? null : mode === "communications" ? <ErrorBoundary label="Communications view"><Communications onSettings={()=>setPreferencesOpen(true)} /></ErrorBoundary> : research ? (
              <FadeInPanel index={1} className="panel-slot panel-slot-library-resident">
                <ErrorBoundary label="Research view">
                  <LibraryPanel onViewDatabase={syncResearchBase} resident inspectionTarget={researchInspection}
                    onReturnToCommand={()=>{setResearchInspection(null);setMode("command")}}/>
                </ErrorBoundary>
              </FadeInPanel>
            ) : (
              <>
                <FadeInPanel index={4} className="panel-slot panel-slot-projects">
                  <ErrorBoundary label="Project view">
                    <ProjectsPanel
                      requestedStatus={voiceFilter}
                      projects={projects}
                      sessionBoundary={sessionBoundary}
                      onSyncCanvas={syncProjectsCanvas}
                      noteWarnings={projectNoteWarnings}
                      focusMode={dense}
                      projectFilter={projectFilter}
                      onClearFilter={() => setProjectFilter(null)}
                      onFocusProject={enterProject}
                      onOpenNote={openNote}
                      projectScan={projectScan}
                      onRescan={rescanProjects}
                      demoData={demoData}
                      projectsRootPath={settings.projectsRootPath}
                    />
                  </ErrorBoundary>
                </FadeInPanel>
                <FadeInPanel index={7} className="panel-slot panel-slot-library">
                  <ErrorBoundary label="Pantheon strip">
                    <LibraryPanel onViewDatabase={syncResearchBase} />
                  </ErrorBoundary>
                </FadeInPanel>
              </>
            )}
          </section>

          {/* The console stays anchored while its transcript aperture opens upward. */}
          <section className="right-stack dashboard-column">
            <FadeInPanel index={8} className="panel-slot panel-slot-chat">
              <ErrorBoundary label="Command console">
                <ChatPanel
                  onOpenPreferences={()=>setPreferencesOpen(true)}
                  autoSpeak={settings.autoSpeak}
                  onAutoSpeakChange={autoSpeak=>updateVoicePreferences({autoSpeak})}
                  voiceSettingsReady={settingsReady}
                  messages={chat}
                  onSendMessage={text => { voicePreview.stop(); void realtimeVoice.sendText(mode === "communications" ? `[Gmail workspace] ${text}` : text,isTauriRuntime()); }}
                  onRecordObservation={recordObservation}
                  pending={chatPending}
                  error={chatError}
                  briefing={openingBriefing}
                />
              </ErrorBoundary>
            </FadeInPanel>
          </section>
        </section>
      </div>

      <ErrorBoundary label="Status dock">
        <AmbientDock
          preferencesOpen={preferencesOpen} onPreferencesOpen={setPreferencesOpen}
          voicePreferences={settings} onVoicePreferences={updateVoicePreferences} settingsReady={settingsReady}
          chatPending={chatPending}
          onRefresh={refreshDashboard}
          mode={mode}
          onCycleMode={cycleDashboardMode}
        />
      </ErrorBoundary>
      <WriteConfirmDialog />
      </main>
    </MotionConfig>
  );
}

/**
 * The instrument's state from the voice transport and the reasoning turn.
 *
 * A voice-provider failure is not an instrument error: audio is one output
 * channel and text still works, so it stays in the console's voice row
 * (review U2). `error` is reserved for a failed reasoning request. With the
 * voice session idle, the reply's own pending/producing state decides.
 */
function instrumentState(voice: VoiceSnapshot, chatError: string | null): OlympusVisualState | undefined {
  if (voice.active) {
    if (voice.phase === "LISTENING") return "listening";
    if (voice.phase === "PROCESSING") return "thinking";
    if (voice.phase === "SPEAKING") return "speaking";
  }
  return chatError ? "error" : undefined;
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
