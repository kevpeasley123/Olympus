import { useCallback, useEffect, useMemo, useState } from "react";
import { seedState } from "../data/seed";
import { fetchMarkets, fetchProjects, fetchWeather } from "../services/liveData";
import { isTauriRuntime } from "../services/launcher";
import {
  syncProjectsCanvasToVault,
  syncResearchBaseToVault
} from "../services/obsidian";
import { recordObservation as recordObservationInVault } from "../services/observations";
import { createAssistantMessage, requestAssistantReply } from "../services/assistant";
import { emitInstrumentEvent } from "../services/instrumentEvents";
import { reportPollFailure, reportPollSuccess } from "../services/pollRegistry";
import { buildPantheonReply, createUserMessage } from "../services/pantheonChat";
import { appendConversationMessages, loadState, persistPreferences } from "../services/storage";
import { beginOperatorSession } from "../services/session";
import type { LiveSourceHealth, LiveSourceStatus, LoadableState } from "../types/dashboard";
import type { OlympusState, SessionBoundary } from "../types";
import type { MarketPanelData } from "../types/markets";
import type { WeatherPanelData } from "../types/weather";

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

function seedMarketData(): MarketPanelData {
  return {
    indexes: seedState.market.indexes,
    rates: seedState.market.rates,
    news: seedState.market.news,
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
    indexWarning: null,
    rateWarning: null,
    overallError: null
  };
}

function emptyMarketData(error: string): MarketPanelData {
  return {
    indexes: seedState.market.indexes.map((item) => ({ ...item, value: "\u2014", change: "\u2014", direction: "flat" })),
    rates: seedState.market.rates.map((item) => ({ ...item, value: "\u2014", change: "\u2014", direction: "flat" })),
    news: seedState.market.news,
    updatedAt: "--:--",
    indexWarning: "Index quotes unavailable right now.",
    rateWarning: "Treasury rates unavailable right now.",
    overallError: error
  };
}

function seedWeatherData(): WeatherPanelData {
  return {
    label: seedState.weather.label,
    temperature: seedState.weather.temperature,
    condition: seedState.weather.condition,
    humidity: `${seedState.weather.humidity} RH`,
    wind: seedState.weather.wind,
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
    forecast: Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return {
        dayLabel: date.toLocaleDateString([], { weekday: "short" }).toUpperCase(),
        weatherCode: index < 2 ? 0 : index < 4 ? 2 : index === 4 ? 61 : 3,
        high: `${74 + index}\u00b0`,
        low: `${54 + index}\u00b0`,
        isToday: index === 0
      };
    })
  };
}

interface SourceTracker {
  label: string;
  expectedIntervalMs: number;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  consecutiveFailures: number;
  lastError?: string;
}

const SOURCE_INTERVALS = {
  marketIndexes: 60_000,
  marketRates: 60_000,
  weather: 300_000
} as const;

function nextSourceState(
  current: SourceTracker,
  outcome: "success" | "failed",
  error?: string
): SourceTracker {
  const now = Date.now();
  if (outcome === "success") {
    return {
      ...current,
      lastSuccessAt: now,
      lastAttemptAt: now,
      consecutiveFailures: 0,
      lastError: undefined
    };
  }

  return {
    ...current,
    lastAttemptAt: now,
    consecutiveFailures: current.consecutiveFailures + 1,
    lastError: error
  };
}

function deriveSourceHealth(source: SourceTracker): LiveSourceHealth {
  const now = Date.now();
  let status: LiveSourceStatus = "ok";

  if (source.consecutiveFailures >= 3) {
    status = "failed";
  } else if (
    source.consecutiveFailures > 0 ||
    (source.lastSuccessAt !== null && now - source.lastSuccessAt > source.expectedIntervalMs * 2)
  ) {
    status = "stale";
  }

  return {
    key: source.label.toLowerCase().replace(/\s+/g, "-"),
    label: source.label,
    status,
    lastFetchAt: source.lastSuccessAt,
    lastError: source.lastError
  };
}

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState<OlympusState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const [sessionBoundary, setSessionBoundary] = useState<SessionBoundary | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [markets, setMarkets] = useState<LoadableState<MarketPanelData>>({
    data: null,
    loading: true,
    error: null
  });
  const [weather, setWeather] = useState<LoadableState<WeatherPanelData>>({
    data: null,
    loading: true,
    error: null
  });
  const [sourceTrackers, setSourceTrackers] = useState<Record<string, SourceTracker>>({
    marketIndexes: {
      label: "Index feed",
      expectedIntervalMs: SOURCE_INTERVALS.marketIndexes,
      lastSuccessAt: null,
      lastAttemptAt: null,
      consecutiveFailures: 0
    },
    marketRates: {
      label: "FRED",
      expectedIntervalMs: SOURCE_INTERVALS.marketRates,
      lastSuccessAt: null,
      lastAttemptAt: null,
      consecutiveFailures: 0
    },
    weather: {
      label: "Open-Meteo",
      expectedIntervalMs: SOURCE_INTERVALS.weather,
      lastSuccessAt: null,
      lastAttemptAt: null,
      consecutiveFailures: 0
    }
  });
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

  const refreshMarkets = useCallback(async () => {
    setMarkets((current) => ({ ...current, loading: current.data === null, error: null }));

    try {
      const next = await fetchMarkets();
      setMarkets({ data: next, loading: false, error: null });
      reportPollSuccess("markets");
      setSourceTrackers((current) => ({
        ...current,
        marketIndexes: nextSourceState(
          current.marketIndexes,
          next.indexWarning ? "failed" : "success",
          next.indexWarning ?? undefined
        ),
        marketRates: nextSourceState(
          current.marketRates,
          next.rateWarning ? "failed" : "success",
          next.rateWarning ?? undefined
        )
      }));
    } catch (error) {
      const message = errorMessage(error);
      reportPollFailure("markets", message);
      console.warn("[Olympus] Markets fell back to seeded preview data.", error);
      setMarkets((current) => ({
        data: isTauriRuntime() ? current.data ?? emptyMarketData(message) : current.data ?? seedMarketData(),
        loading: false,
        error: message
      }));
      setSourceTrackers((current) => ({
        ...current,
        marketIndexes: nextSourceState(current.marketIndexes, "failed", message),
        marketRates: nextSourceState(current.marketRates, "failed", message)
      }));
    }
  }, []);

  const refreshWeather = useCallback(async () => {
    setWeather((current) => ({ ...current, loading: current.data === null, error: null }));

    try {
      const next = await fetchWeather();
      setWeather({ data: next, loading: false, error: null });
      reportPollSuccess("weather");
      setSourceTrackers((current) => ({
        ...current,
        weather: nextSourceState(current.weather, "success")
      }));
    } catch (error) {
      const message = errorMessage(error);
      reportPollFailure("weather", message);
      console.warn("[Olympus] Weather fell back to seeded preview data.", error);
      setWeather((current) => ({
        data: isTauriRuntime() ? current.data : current.data ?? seedWeatherData(),
        loading: false,
        error: message
      }));
      setSourceTrackers((current) => ({
        ...current,
        weather: nextSourceState(current.weather, "failed", message)
      }));
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const scan = await fetchProjects(
        dashboardState.settings.projectsRootPath,
        sessionBoundary?.previousSessionStartedAt ?? null
      );
      setDashboardState((current) => ({ ...current, projects: scan.projects }));
      setProjectNoteWarnings(scan.warnings);
      setProjectsError(null);
      reportPollSuccess("git");
    } catch (error) {
      const message = errorMessage(error);
      setProjectsError(message);
      reportPollFailure("git", message);
    }
  }, [dashboardState.settings.projectsRootPath, sessionBoundary?.previousSessionStartedAt]);

  useEffect(() => {
    if (!sessionReady) return;

    void refreshMarkets();
    void refreshWeather();
    void refreshProjects();

    // The omega ticks on the polls themselves, not just on a manual refresh.
    // StrictMode double-invokes this effect in dev, so the first tick lands
    // twice at startup — expected, not a bug to chase.
    const tick = (refresh: () => Promise<void>) => () => {
      void refresh().then(() => emitInstrumentEvent("poll"));
    };

    const marketsTimer = window.setInterval(tick(refreshMarkets), 60_000);
    const weatherTimer = window.setInterval(tick(refreshWeather), 300_000);
    const projectsTimer = window.setInterval(tick(refreshProjects), 60_000);

    return () => {
      window.clearInterval(marketsTimer);
      window.clearInterval(weatherTimer);
      window.clearInterval(projectsTimer);
    };
  }, [refreshMarkets, refreshProjects, refreshWeather, sessionReady]);

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
        setChatProducing(false);
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
    await Promise.allSettled([refreshMarkets(), refreshWeather(), refreshProjects()]);
    emitInstrumentEvent("poll");
  }, [refreshMarkets, refreshProjects, refreshWeather]);

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
      nowPlaying: dashboardState.nowPlaying,
      markets,
      weather,
      sourceHealth: Object.values(sourceTrackers).map(deriveSourceHealth),
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
      markets,
      weather,
      sourceTrackers,
      sendChatMessage,
      recordObservation,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    ]
  );
}
