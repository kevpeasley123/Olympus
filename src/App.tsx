import { Communications } from "./components/panels/Communications";
import { realtimeVoice, voicePreview, useVoiceState } from "./services/realtimeVoice";
import { validateVoiceNavigation } from "./services/voiceContract";
import { operationalStatuses, type OperationalStatus } from "./services/projectCommandBoard";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { AmbientDock } from "./components/panels/AmbientDock";
import { ChatPanel } from "./components/panels/ChatPanel";
import { CommandInstrument } from "./components/panels/CommandInstrument";
import { HeaderBar } from "./components/panels/HeaderBar";
import { LibraryPanel } from "./components/panels/LibraryPanel";
import { ProjectsPanel } from "./components/panels/ProjectsPanel";
import { QuickbarPanel } from "./components/panels/QuickbarPanel";
import { ToolBelt } from "./components/panels/ToolBelt";
import { WriteConfirmDialog } from "./components/panels/WriteConfirmDialog";
import { isTauriRuntime, openVaultNote } from "./services/launcher";
import { useActionQueue } from "./hooks/useActionQueue";
import { usePantheon } from "./hooks/usePantheon";
import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardMode } from "./hooks/useDashboardMode";
import type { DashboardMode } from "./hooks/useDashboardMode";

function App() {
  const [preferencesOpen,setPreferencesOpen]=useState(false);
  const {
    settings, settingsReady, updateVoicePreferences,
    tools,
    quickApps,
    projects,
    sessionBoundary,
    projectNoteWarnings,
    chat,
    chatPending,
    chatError,
    chatModel,
    chatProducing,
    chatFellBackFrom,
    sendChatMessage,
    updateVoiceMessage,
    recordObservation,
    syncResearchBase,
    syncProjectsCanvas,
    refreshAll
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
  /** Set when Project mode narrows its detailed briefing to one workspace. */
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  // Project mode is what focus mode was, so the density props that used to read
  // a boolean now read the mode. One state, not two.
  const dense = mode === "project";
  const research = mode === "research";
  const command = mode === "command";

  function enterProject(projectId: string) {
    setProjectFilter(projectId);
    setMode("project");
  }

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
  }, [sendChatMessage, updateVoiceMessage, projects, setMode]);
  useEffect(() => { if(settingsReady)void realtimeVoice.applyPreferences(settings); }, [settings,settingsReady]);
  useEffect(() => () => {realtimeVoice.stop();voicePreview.stop();}, []);

  // Switching modes by any other route clears the filter, so Project mode is
  // never silently showing a subset the operator did not ask for.
  function selectMode(next: DashboardMode) {
    if (next !== "project") {
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
        <HeaderBar mode={mode} onSelectMode={selectMode} projects={projects} />
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
            {<div className="panel-slot panel-slot-instrument" hidden={!command}>

                <CommandInstrument
                  active={command}
                  visualState={voice.active || voice.phase === "ERROR" ? (voice.phase==="IDLE"&&chatPending ? "thinking" : ({IDLE:"idle",LISTENING:"listening",PROCESSING:"thinking",SPEAKING:"speaking",ERROR:"error"} as const)[voice.phase]) : undefined}
                  voiceLevel={voice.level}
                  projects={projects}
                  tasks={actionTasks}
                  tasksLoading={actionTasksLoading}
                  tasksError={actionTasksError}
                  assistantPending={chatPending}
                  assistantProducing={chatProducing}
                  assistantModel={chatModel}
                  assistantFellBackFrom={chatFellBackFrom}
                  onSelectProject={enterProject}
                  onOpenNote={(notePath) => void openVaultNote(notePath)}
                />
              </div>}
            {command ? null : mode === "communications" ? <Communications onSettings={()=>setPreferencesOpen(true)} /> : research ? (
              <FadeInPanel index={1} className="panel-slot panel-slot-library-resident">
                <LibraryPanel onViewDatabase={syncResearchBase} resident />
              </FadeInPanel>
            ) : (
              <>
                <FadeInPanel index={4} className="panel-slot panel-slot-projects">
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
                    onOpenNote={(notePath) => void openVaultNote(notePath)}
                  />
                </FadeInPanel>
                <FadeInPanel index={7} className="panel-slot panel-slot-library">
                  <LibraryPanel onViewDatabase={syncResearchBase} />
                </FadeInPanel>
              </>
            )}
          </section>

          {/* The console stays anchored while its transcript aperture opens upward. */}
          <section className="right-stack dashboard-column">
            <FadeInPanel index={8} className="panel-slot panel-slot-chat">
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
              />
            </FadeInPanel>
          </section>
        </section>
      </div>

      <AmbientDock
        preferencesOpen={preferencesOpen} onPreferencesOpen={setPreferencesOpen}
        voicePreferences={settings} onVoicePreferences={updateVoicePreferences} settingsReady={settingsReady}
        onRefresh={() => void refreshAll()}
        mode={mode}
        onCycleMode={() => {
          // Cycling is an explicit mode change, so it clears the project filter
          // for the same reason any other mode switch does.
          setProjectFilter(null);
          cycleMode();
        }}
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
