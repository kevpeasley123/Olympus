import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedState } from "../data/seed";
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
import { appendConversationMessages, loadState, persistPreferences } from "../services/storage";
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

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState<OlympusState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const [sessionBoundary, setSessionBoundary] = useState<SessionBoundary | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  /** Problems with `01 - Projects` itself, which belong to no single project. */
  const [projectNoteWarnings, setProjectNoteWarnings] = useState<string[]>([]);
  const [chatPending, setChatPending] = useState(false);
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
      const stored = await loadState();
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

      setDashboardState(stored);
      setSessionBoundary(boundary);
      setSessionReady(true);
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

  const refreshProjects = useCallback(async () => {
    try {
      const scan = await fetchProjects(
        dashboardState.settings.projectsRootPath,
        sessionBoundary?.previousSessionStartedAt ?? null
      );
      setDashboardState((current) => ({ ...current, projects: scan.projects }));
      setProjectNoteWarnings(scan.warnings);
      setProjectsError(null);
    } catch (error) {
      setProjectsError(errorMessage(error));
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

  const sendChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const user = createUserMessage(trimmed);

      // The user's turn lands immediately and is part of the history the model
      // sees, so it is captured before the request goes out.
      const history = [...dashboardState.conversation, user];
      setDashboardState((current) => ({
        ...current,
        conversation: [...current.conversation, user]
      }));
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
          dashboardState.settings,
          dashboardState.projects,
          (event) => {
            switch (event.kind) {
              case "started":
                // Latch the model at first paint. Routing noise must not churn
                // the readout mid-response.
                setChatModel(event.model);
                break;
              case "delta":
                // The speaking signal. Idempotent by construction — React bails
                // on an unchanged value, so every later delta is free.
                if (speakingStartedAt.current === null) {
                  speakingStartedAt.current = Date.now();
                }
                setChatProducing(true);
                break;
              case "fellBack":
                // A real change in what is answering, so it is surfaced. Both
                // models are kept: the readout shows the handoff.
                setChatFellBackFrom(event.from);
                setChatModel(event.to);
                break;
            }
          }
        );
        const assistant = createAssistantMessage(reply.content, reply.notice);
        setChatModel(reply.model);
        setDashboardState((current) => ({
          ...current,
          conversation: [...current.conversation, assistant]
        }));
        void appendConversationMessages([assistant]);
      } catch (error) {
        setChatError(errorMessage(error));
      } finally {
        // Both reachable paths clear the indicator: success falls through, an
        // error is caught, and either way this runs. A stuck "thinking" is worse
        // than no indicator, so the reset is structural rather than scheduled.
        //
        // Cancellation is deliberately unhandled. There is no cancel affordance
        // anywhere in the app, so it is not a reachable state and defending it
        // would be code that can never run and never be tested. **If a cancel
        // button is ever added, it has to clear both flags on this same path** —
        // an aborted request that skips this `finally` strands the indicator and
        // the omega's thinking *and* speaking states together.
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

  const refreshAll = useCallback(async () => {
    await refreshProjects();
    emitInstrumentEvent("poll");
  }, [refreshProjects]);

  return useMemo(
    () => ({
      tools: dashboardState.tools.filter((tool) => tool.id !== "tool-prompt-builder"),
      quickApps: dashboardState.quickApps,
      projects: dashboardState.projects,
      sessionBoundary,
      projectsError,
      projectNoteWarnings,
      chat: dashboardState.conversation,
      chatPending,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      sendChatMessage,
      recordObservation,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    }),
    [
      dashboardState,
      sessionBoundary,
      projectsError,
      projectNoteWarnings,
      chatPending,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      sendChatMessage,
      recordObservation,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    ]
  );
}
