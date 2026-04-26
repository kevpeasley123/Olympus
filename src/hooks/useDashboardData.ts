import { useCallback, useEffect, useMemo, useState } from "react";
import { seedState } from "../data/seed";
import { fetchMarkets, fetchProjects, fetchWeather } from "../services/liveData";
import {
  syncProjectsCanvasToVault,
  syncResearchBaseToVault,
  syncResearchNoteToVault
} from "../services/obsidian";
import { buildPantheonReply, createUserMessage } from "../services/pantheonChat";
import { createResearchRecordFromText } from "../services/research";
import { addResearchRecord, loadState, saveState } from "../services/storage";
import type { LoadableState } from "../types/dashboard";
import type { OlympusState, ResearchRecord } from "../types";
import type { MarketPanelData } from "../types/markets";
import type { WeatherPanelData } from "../types/weather";

const PHOENIX_LATITUDE = 33.4484;
const PHOENIX_LONGITUDE = -112.074;
const PHOENIX_LABEL = "Phoenix, AZ";

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
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
  };
}

function seedWeatherData(): WeatherPanelData {
  return {
    label: seedState.weather.label,
    temperature: seedState.weather.temperature,
    condition: seedState.weather.condition,
    humidity: `${seedState.weather.humidity} RH`,
    wind: seedState.weather.wind,
    updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
  };
}

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState<OlympusState>(() => loadState());
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
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    saveState(dashboardState);
  }, [dashboardState]);

  const refreshMarkets = useCallback(async () => {
    setMarkets((current) => ({ ...current, loading: current.data === null, error: null }));

    try {
      const next = await fetchMarkets();
      setMarkets({ data: next, loading: false, error: null });
    } catch (error) {
      setMarkets((current) => ({
        data: current.data ?? seedMarketData(),
        loading: false,
        error: errorMessage(error)
      }));
    }
  }, []);

  const refreshWeather = useCallback(async () => {
    setWeather((current) => ({ ...current, loading: current.data === null, error: null }));

    try {
      const next = await fetchWeather(PHOENIX_LATITUDE, PHOENIX_LONGITUDE, PHOENIX_LABEL);
      setWeather({ data: next, loading: false, error: null });
    } catch (error) {
      setWeather((current) => ({
        data: current.data ?? seedWeatherData(),
        loading: false,
        error: errorMessage(error)
      }));
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const nextProjects = await fetchProjects(dashboardState.settings.projectsRootPath);
      setDashboardState((current) => ({ ...current, projects: nextProjects }));
      setProjectsError(null);
    } catch (error) {
      setProjectsError(errorMessage(error));
    }
  }, [dashboardState.settings.projectsRootPath]);

  useEffect(() => {
    void refreshMarkets();
    void refreshWeather();
    void refreshProjects();

    const marketsTimer = window.setInterval(() => {
      void refreshMarkets();
    }, 60_000);
    const weatherTimer = window.setInterval(() => {
      void refreshWeather();
    }, 300_000);
    const projectsTimer = window.setInterval(() => {
      void refreshProjects();
    }, 60_000);

    return () => {
      window.clearInterval(marketsTimer);
      window.clearInterval(weatherTimer);
      window.clearInterval(projectsTimer);
    };
  }, [refreshMarkets, refreshProjects, refreshWeather]);

  const addResearch = useCallback(
    async (
      title: string,
      text: string,
      sourceType: ResearchRecord["sourceType"],
      sourceDate: string
    ) => {
      if (!text.trim()) {
        return {
          tone: "warning" as const,
          message: "Add some source text before saving research."
        };
      }

      const record = createResearchRecordFromText(title, text, sourceType, sourceDate);
      setDashboardState((current) => addResearchRecord(current, record));

      try {
        return await syncResearchNoteToVault(dashboardState.settings.vaultPath, record);
      } catch (error) {
        return {
          tone: "error" as const,
          message: `Research saved locally, but vault sync failed: ${errorMessage(error)}`
        };
      }
    },
    [dashboardState.settings.vaultPath]
  );

  const sendChatMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setDashboardState((current) => {
      const user = createUserMessage(trimmed);
      const assistant = buildPantheonReply(trimmed, current.research);
      return {
        ...current,
        conversation: [...current.conversation, user, assistant]
      };
    });
  }, []);

  const syncResearchBase = useCallback(async () => {
    try {
      return await syncResearchBaseToVault(dashboardState.settings.vaultPath);
    } catch (error) {
      return {
        tone: "error" as const,
        message: `Could not update the Obsidian Base: ${errorMessage(error)}`
      };
    }
  }, [dashboardState.settings.vaultPath]);

  const syncProjectsCanvas = useCallback(async () => {
    try {
      return await syncProjectsCanvasToVault(dashboardState.settings.vaultPath, dashboardState.projects);
    } catch (error) {
      return {
        tone: "error" as const,
        message: `Could not update the project canvas: ${errorMessage(error)}`
      };
    }
  }, [dashboardState.projects, dashboardState.settings.vaultPath]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshMarkets(), refreshWeather(), refreshProjects()]);
  }, [refreshMarkets, refreshProjects, refreshWeather]);

  return useMemo(
    () => ({
      tools: dashboardState.tools.filter((tool) => tool.id !== "tool-prompt-builder"),
      quickApps: dashboardState.quickApps,
      projects: dashboardState.projects,
      projectsError,
      library: dashboardState.research,
      chat: dashboardState.conversation,
      nowPlaying: dashboardState.nowPlaying,
      markets,
      weather,
      addResearch,
      sendChatMessage,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    }),
    [
      dashboardState,
      projectsError,
      markets,
      weather,
      addResearch,
      sendChatMessage,
      syncResearchBase,
      syncProjectsCanvas,
      refreshAll
    ]
  );
}
