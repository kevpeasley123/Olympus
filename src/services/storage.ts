import { seedState } from "../data/seed";
import type { OlympusState, ResearchRecord, ToolDefinition } from "../types";

const STORAGE_KEY = "olympus:v7";
const LEGACY_KEYS = ["olympus:v1", "olympus:v2", "olympus:v3", "olympus:v4", "olympus:v5", "olympus:v6"];

export function loadState(): OlympusState {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    clearLegacyState();
    return seedState;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<OlympusState>;
    const merged: OlympusState = {
      ...seedState,
      ...parsed,
      tools: mergeById(seedState.tools, parsed.tools ?? []),
      quickApps: mergeById(seedState.quickApps, parsed.quickApps ?? []),
      projects: mergeById(seedState.projects, parsed.projects ?? []),
      research: mergeById(seedState.research, parsed.research ?? []).map((record) => ({
        ...record,
        sourceDate: record.sourceDate ?? record.createdAt
      })),
      conversation: mergeById(seedState.conversation, parsed.conversation ?? []),
      market: parsed.market ? { ...seedState.market, ...parsed.market } : seedState.market,
      weather: parsed.weather ? { ...seedState.weather, ...parsed.weather } : seedState.weather,
      nowPlaying: parsed.nowPlaying
        ? { ...seedState.nowPlaying, ...parsed.nowPlaying }
        : seedState.nowPlaying,
      settings: parsed.settings
        ? { ...seedState.settings, ...parsed.settings }
        : seedState.settings,
      version: seedState.version
    };

    clearLegacyState();
    return merged;
  } catch {
    clearLegacyState();
    return seedState;
  }
}

function clearLegacyState(): void {
  LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

function mergeById<T extends { id: string }>(seedItems: T[], storedItems: T[]): T[] {
  const merged = new Map<string, T>();

  seedItems.forEach((item) => merged.set(item.id, item));
  storedItems.forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item }));

  return Array.from(merged.values());
}

export function saveState(state: OlympusState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): OlympusState {
  clearLegacyState();
  saveState(seedState);
  return seedState;
}

export function addResearchRecord(state: OlympusState, item: ResearchRecord): OlympusState {
  return {
    ...state,
    research: [item, ...state.research]
  };
}

export function updateToolEnabled(
  state: OlympusState,
  toolId: ToolDefinition["id"],
  enabled: boolean
): OlympusState {
  return {
    ...state,
    tools: state.tools.map((tool) => (tool.id === toolId ? { ...tool, enabled } : tool))
  };
}
