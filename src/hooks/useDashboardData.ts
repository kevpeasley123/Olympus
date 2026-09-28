import {consumeNextModel} from "../services/modelRouting";
import { normalizeVoicePreferences, type VoicePreferences } from "../services/voicePreferences";
import { refreshActionQueue, useActionQueue } from "./useActionQueue";
import { refreshDelegationRuns, useDelegationRuns } from "./useDelegationRuns";
import { refreshPantheon } from "./usePantheon";
import { refreshVaultGraph } from "./useVaultGraph";
import { refreshVaultWrites } from "./useVaultWrites";
import { emitRefreshRequested } from "../services/navigation";
import { buildProjectCommandBoard } from "../services/projectCommandBoard";
import { composeOpeningBriefing } from "../services/openingBriefing";
import type { VoiceDepth, VoiceAnswer, VoiceMessageMetadata } from "../services/voiceContract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conversationStream } from "../services/conversationStream";
import { fetchProjects } from "../services/liveData";
import { isTauriRuntime } from "../services/launcher";
import {
  syncProjectsCanvasToVault,
  syncResearchBaseToVault
} from "../services/obsidian";
import { recordObservation as recordObservationInVault } from "../services/observations";
import { createAssistantMessage, requestAssistantReply } from "../services/assistant";
import { planTurnRelease } from "../services/glyphState";
import { emitInstrumentEvent } from "../services/instrumentEvents";
import { buildPantheonReply, createUserMessage } from "../services/pantheonChat";
import { appendConversationMessages, initialDashboardState, loadState, persistPreferences } from "../services/storage";
import { beginOperatorSession } from "../services/session";
import type { OlympusState, SessionBoundary } from "../types";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error payload";
    }
  }

  return "Unknown error";
}

/**
 * Where the project scan stands (review U1). Surfaces render from this rather
 * than inferring from `projects.length`:
 *
 *  - `loading`: no scan has settled yet. Desktop `projects` is empty.
 *  - `ready`:   the last scan succeeded. An empty list means no projects.
 *  - `stale`:   a refresh failed after an earlier success. `projects` keeps the
 *               last genuine result; show `lastSuccessAt` and `error`.
 *  - `failed`:  no scan has ever succeeded this launch. `projects` is empty —
 *               nothing rather than fiction.
 *
 * `scanning` is true while a scan is in flight, including a Retry.
 */
export type ProjectScanStatus = "loading" | "ready" | "stale" | "failed";

export interface ProjectScanState {
  status: ProjectScanStatus;
  /** ISO time of the last successful scan this launch. */
  lastSuccessAt: string | null;
  error: string | null;
  scanning: boolean;
}

/**
 * The browser dev server has no scan. It shows the seed as demo data, and
 * `demoData` tells surfaces to label it as such.
 */
const DEMO_DATA = !isTauriRuntime();

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState<OlympusState>(initialDashboardState);
  const dashboardRef = useRef(dashboardState);
  dashboardRef.current = dashboardState;
  const updateVoicePreferences = useCallback((patch:Partial<VoicePreferences>) => {
    setDashboardState(current => ({...current, settings:{...current.settings,...normalizeVoicePreferences({...current.settings,...patch})}}));
  }, []);
  const taskStore = useActionQueue();
  const runStore = useDelegationRuns();
  const tasksReady = !taskStore.error && !taskStore.loading;
  const runsReady = !runStore.error && !runStore.loading;
  const commandBoard = useMemo(
    () => buildProjectCommandBoard(dashboardState.projects, taskStore.tasks, runStore.data, {tasks:tasksReady,runs:runsReady}),
    [dashboardState.projects, taskStore.tasks, runStore.data, tasksReady, runsReady]
  );
  const boardRef = useRef(commandBoard); boardRef.current = commandBoard;
  const [hydrated, setHydrated] = useState(false);
  /** Read inside `sendChatMessage`, which voice can call before a re-render. */
  const hydratedRef = useRef(false);
  const [sessionBoundary, setSessionBoundary] = useState<SessionBoundary | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [projectScan, setProjectScan] = useState<ProjectScanState>(() => DEMO_DATA
    ? { status: "ready", lastSuccessAt: null, error: null, scanning: false }
    : { status: "loading", lastSuccessAt: null, error: null, scanning: false });
  const projectsError = projectScan.error;
  const openingBriefed = useRef(false);
  const [openingBriefing, setOpeningBriefing] = useState<{ id: string; text: string } | null>(null);
  /** Problems with `01 - Projects` itself, which belong to no single project. */
  const [projectNoteWarnings, setProjectNoteWarnings] = useState<string[]>([]);
  const [chatPending, setChatPending] = useState(false);
  const requestInFlight = useRef(false);
  const [chatError, setChatError] = useState<string | null>(null);
  /**
   * The model that answered the last turn, as reported by the API response.
   *
   * Not the Rust `MODEL` constant: the request carries a server-side fallback
   * header, so the constant is the model *asked for* and this is the model that
   * *replied*. If they ever diverge, reading the constant would be wrong
   * invisibly. Null until a turn has landed this session — nothing has answered
   * yet, and naming a model before one has is the same invisible-wrongness in a
   * smaller form. Session state, deliberately not persisted.
   */
  const [chatModel, setChatModel] = useState<string | null>(null);
  /**
   * Response text is arriving. Drives the omega's speaking state.
   *
   * Set on the **first delta**, not on the response envelope: the envelope
   * arrives before any text exists, so deriving this from it would make speaking
   * start the instant thinking did and the two states would never be
   * distinguishable. Cleared on the same path as `chatPending`.
   */
  const [chatProducing, setChatProducing] = useState(false);
  /**
   * When speaking began, so the floor can be measured from it.
   *
   * A ref rather than state: it is read inside the request's own closure at
   * completion, and making it state would re-run the send callback mid-turn.
   */
  const speakingStartedAt = useRef<number | null>(null);
  /** The pending floor timer, so a new turn can cancel a stale one. */
  const speakingHoldTimer = useRef<number | undefined>(undefined);
  /**
   * The model that declined, when a mid-turn fallback changed who was answering.
   *
   * Kept separate from `chatModel` so the readout can show the *transition*
   * rather than silently swapping one value for another — a value that changes
   * quietly is the invisible-wrongness problem the readout exists to prevent.
   * Cleared at the start of each turn, so it describes the last turn only.
   */
  const [chatFellBackFrom, setChatFellBackFrom] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let stored: OlympusState | null = null;
      try {
        stored = await loadState();
      } catch (error) {
        // Desktop only. Stay unhydrated: seed state must never be saved over
        // the real settings, and a send would give the model seed history.
        console.warn("[Olympus] Could not read the local database.", error);
        if (!cancelled) setChatError(`The local database could not be read (${errorMessage(error)}). Settings and conversation history are not loaded, and nothing will be saved or sent until Olympus restarts.`);
      }
      if (cancelled) return;

      let boundary: SessionBoundary | null = null;
      try {
        boundary = await beginOperatorSession();
      } catch (error) {
        console.warn(
          "[Olympus] Could not persist the session boundary; the briefing will say so.",
          error
        );
      }
      if (cancelled) return;

      if (stored) setDashboardState(stored);
      setSessionBoundary(boundary);
      setSessionReady(true);
      if (!stored) return;
      hydratedRef.current = true;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Gated on hydration so the seed defaults never overwrite stored state during
  // the first render pass.
  useEffect(() => {
    if (!hydrated) return;
    void persistPreferences(dashboardState);
  }, [dashboardState, hydrated]);

  // Scans are not coalesced, so a slow scan of an old root can settle after a
  // newer one. Only the latest request may write.
  const projectScanSeq = useRef(0);
  const refreshProjects = useCallback(async () => {
    if (DEMO_DATA) return;
    const request = ++projectScanSeq.current;
    setProjectScan((current) => current.scanning ? current : { ...current, scanning: true });
    try {
      const scan = await fetchProjects(
        dashboardState.settings.projectsRootPath,
        sessionBoundary?.previousSessionStartedAt ?? null
      );
      if (request !== projectScanSeq.current) return;
      // An unchanged scan keeps the same array, so nothing downstream rebuilds.
      setDashboardState((current) => JSON.stringify(current.projects) === JSON.stringify(scan.projects)
        ? current
        : { ...current, projects: scan.projects });
      setProjectNoteWarnings((current) => JSON.stringify(current) === JSON.stringify(scan.warnings) ? current : scan.warnings);
      setProjectScan({ status: "ready", lastSuccessAt: new Date().toISOString(), error: null, scanning: false });
    } catch (error) {
      if (request !== projectScanSeq.current) return;
      const message = errorMessage(error);
      // Projects are left untouched either way: empty if no scan ever
      // succeeded, the last genuine result if one did.
      setProjectScan((current) => current.lastSuccessAt
        ? { status: "stale", lastSuccessAt: current.lastSuccessAt, error: message, scanning: false }
        : { status: "failed", lastSuccessAt: null, error: message, scanning: false });
    }
  }, [dashboardState.settings.projectsRootPath, sessionBoundary?.previousSessionStartedAt]);

  useEffect(() => {
    if (!sessionReady) return;

    void refreshProjects();

    // The omega ticks on the polls themselves, not just on a manual refresh.
    // StrictMode double-invokes this effect in dev, so the first tick lands
    // twice at startup — expected, not a bug to chase.
    const tick = (refresh: () => Promise<void>) => () => {
      void refresh().then(() => emitInstrumentEvent("poll"));
    };

    const projectsTimer = window.setInterval(tick(refreshProjects), 60_000);

    return () => {
      window.clearInterval(projectsTimer);
    };
  }, [refreshProjects, sessionReady]);

  // Once per launch, after hydration and the first real scan, so the briefing
  // describes stored state rather than seed data. Composed without a model; the
  // caller decides whether to speak it.
  const projectsScanned = projectScan.status !== "loading";
  useEffect(() => {
    if (openingBriefed.current || !hydrated || !projectsScanned) return;
    if (taskStore.loading || runStore.loading) return;
    openingBriefed.current = true;
    if (!dashboardRef.current.settings.briefOnOpen) return;
    const text = composeOpeningBriefing({
      projects: dashboardRef.current.projects,
      board: boardRef.current,
      sessionBoundary,
      projectsError
    });
    const message = createAssistantMessage(text);
    message.id = `conversation-briefing-${Date.now()}`;
    message.voice = { kind: "output", spokenResponse: text };
    dashboardRef.current = { ...dashboardRef.current, conversation: [...dashboardRef.current.conversation, message] };
    setDashboardState(dashboardRef.current);
    void appendConversationMessages([message]);
    setOpeningBriefing({ id: message.id, text });
  }, [hydrated, projectsScanned, taskStore.loading, runStore.loading, sessionBoundary, projectsError]);

  const sendChatMessage = useCallback(
    async (text: string, voiceDepth?: VoiceDepth, voiceMessageId?: string): Promise<VoiceAnswer | undefined> => {
      if (voiceDepth) while (requestInFlight.current) await new Promise(resolve => window.setTimeout(resolve, 80));
      const trimmed = text.trim();
      // Before hydration the history is seed data and the stored conversation
      // would replace this turn on arrival.
      if (!trimmed || requestInFlight.current || !hydratedRef.current) return;
      conversationStream.reset();
      emitInstrumentEvent("command-received");

      const user = createUserMessage(trimmed);
      // Output modality is independent of input modality: a typed request may
      // ask for a spoken answer, but only a transcription has a voice input ID.
      if (voiceMessageId) { user.voice = {kind:"input"}; user.id = voiceMessageId; }

      // The user's turn lands immediately and is part of the history the model
      // sees, so it is captured before the request goes out.
      const history = [...dashboardRef.current.conversation, user];
      dashboardRef.current = {...dashboardRef.current, conversation:history};
      setDashboardState(dashboardRef.current);
      void appendConversationMessages([user]);

      if (!isTauriRuntime()) {
        // Browser dev server: no API key available, so fall back to the local
        // keyword search over Pantheon entries.
        const offline = buildPantheonReply(trimmed, []);
        setDashboardState((current) => ({
          ...current,
          conversation: [...current.conversation, offline]
        }));
        return;
      }

      const capability=consumeNextModel();
      requestInFlight.current = true;
      setChatModel(null);
      setChatPending(true);
      setChatError(null);
      setChatProducing(false);
      setChatFellBackFrom(null);
      // A new turn cancels any floor still holding from the previous one.
      window.clearTimeout(speakingHoldTimer.current);
      speakingStartedAt.current = null;

      try {
        const reply = await requestAssistantReply(
          history,
          dashboardRef.current.settings,
          dashboardRef.current.projects,
          (event) => {
            switch (event.kind) {
              case "started":
                // Latch the model at first paint. Routing noise must not churn
                // the readout mid-response.
                setChatModel(event.model);
                break;
              case "delta":
                if (voiceDepth) break; // Never stream the JSON response envelope into the console.
                // The speaking signal. Idempotent by construction — React bails
                // on an unchanged value, so every later delta is free.
                if (speakingStartedAt.current === null) {
                  speakingStartedAt.current = Date.now();
                  emitInstrumentEvent("response-start");
                }
                conversationStream.append(event.text);
                setChatProducing(true);
                break;
              case "fellBack":
                // A real change in what is answering, so it is surfaced. Both
                // models are kept: the readout shows the handoff.
                setChatFellBackFrom(event.from);
                setChatModel(event.to);
                break;
            }
          },
          {capability, voiceDepth, commandBoard: boardRef.current}
        );
        const assistant = createAssistantMessage(reply.content, reply.notice, reply.research);
        assistant.mail = reply.mail;
        assistant.request=reply.request;
        if (reply.voice) assistant.voice = {kind:"output",spokenResponse:reply.voice.spokenResponse,playback:"pending",requiresConfirmation:reply.voice.requiresConfirmation};
        setChatModel(reply.model);
        dashboardRef.current = {...dashboardRef.current,conversation:[...dashboardRef.current.conversation,assistant]};
        setDashboardState(dashboardRef.current);
        // Persist the planned summary before the transport can record a fast
        // connection failure or playback receipt for this same message.
        await appendConversationMessages([assistant]);
        return reply.voice ? {...reply.voice,messageId:assistant.id} : undefined;
      } catch (error) {
        const partial = conversationStream.current().trim();
        if (partial) {
          const interrupted = createAssistantMessage(partial, { kind: "truncated", message: "Response interrupted. This is the output received before the error." });
          setDashboardState(current => ({ ...current, conversation: [...current.conversation, interrupted] }));
          void appendConversationMessages([interrupted]);
        }
        setChatError(errorMessage(error));
      } finally {
        requestInFlight.current = false;
        conversationStream.reset();
        // Both reachable paths clear the indicator: success falls through, an
        // error is caught, and either way this runs. A stuck "thinking" is worse
        // than no indicator, so the reset is structural rather than scheduled.
        //
        // Voice interruption cancels audio delivery, not the accepted reasoning turn.
        // Its visual answer is retained; both input modes release the same lock here.
        setChatPending(false);

        // The speaking floor. A five-character reply's speaking window measured
        // 20ms — below one frame, so the state never rendered at all.
        //
        // **This holds the glyph only.** The reply was appended to the
        // conversation above, before this line runs; nothing here can delay
        // text. And the timer only ever *clears* — no state is entered by a
        // timer, so none can be stranded on by one.
        const release = planTurnRelease(speakingStartedAt.current, Date.now());
        if (release.holdSpeakingMs === 0) {
          setChatProducing(false);
        } else {
          speakingHoldTimer.current = window.setTimeout(
            () => setChatProducing(false),
            release.holdSpeakingMs
          );
        }
        speakingStartedAt.current = null;
      }
    },
    [dashboardState.conversation, dashboardState.projects, dashboardState.settings]
  );

  const updateVoiceMessage = useCallback((id: string, metadata: Partial<VoiceMessageMetadata>) => {
    const existing = dashboardRef.current.conversation.find(message => message.id === id);
    if (!existing?.voice) return;
    const updated = {...existing, voice:{...existing.voice,...metadata}};
    dashboardRef.current = {...dashboardRef.current,conversation:dashboardRef.current.conversation.map(message => message.id === id ? updated : message)};
    setDashboardState(dashboardRef.current);
    void appendConversationMessages([updated]);
  }, []);

  const syncResearchBase = useCallback(async () => {
    try {
      return await syncResearchBaseToVault();
    } catch (error) {
      return {
        tone: "error" as const,
        message: `Could not update the Obsidian Base: ${errorMessage(error)}`
      };
    }
  }, []);

  const syncProjectsCanvas = useCallback(async () => {
    try {
      return await syncProjectsCanvasToVault(dashboardState.projects);
    } catch (error) {
      return {
        tone: "error" as const,
        message: `Could not update the project canvas: ${errorMessage(error)}`
      };
    }
  }, [dashboardState.projects]);

  // Not folded into the conversation save path: an observation is a deliberate,
  // approved vault write, not a side effect of chatting.
  const recordObservation = useCallback(async (text: string) => {
    try {
      return await recordObservationInVault(text);
    } catch (error) {
      return {
        tone: "error" as const,
        message: `Could not record the observation: ${errorMessage(error)}`
      };
    }
  }, []);

  /**
   * Everything the Ctrl+R registry label promises, and anything subscribed to
   * `subscribeToRefresh`. Settled, not awaited in sequence: one failing source
   * must not hold the others back.
   */
  const refreshAll = useCallback(async () => {
    emitRefreshRequested();
    await Promise.allSettled([
      refreshProjects(),
      refreshActionQueue(),
      refreshDelegationRuns(),
      refreshPantheon(),
      refreshVaultGraph(),
      refreshVaultWrites()
    ]);
    emitInstrumentEvent("poll");
  }, [refreshProjects]);

  return useMemo(
    () => ({
      settings: dashboardState.settings,
      settingsReady: hydrated,
      tools: dashboardState.tools.filter((tool) => tool.id !== "tool-prompt-builder"),
      quickApps: dashboardState.quickApps,
      projects: dashboardState.projects,
      sessionBoundary,
      openingBriefing,
      projectScan,
      /** True in the browser preview: projects and conversation are seed fixtures. */
      demoData: DEMO_DATA,
      /** Kept for existing callers; the same value as `projectScan.error`. */
      projectsError,
      rescanProjects: refreshProjects,
      projectNoteWarnings,
      chat: dashboardState.conversation,
      chatPending,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      sendChatMessage,
      updateVoiceMessage,
      updateVoicePreferences,
      recordObservation,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    }),
    [
      dashboardState,
      hydrated,
      sessionBoundary,
      openingBriefing,
      projectScan,
      projectsError,
      refreshProjects,
      projectNoteWarnings,
      chatPending,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      sendChatMessage,
      updateVoiceMessage,
      updateVoicePreferences,
      recordObservation,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    ]
  );
}
