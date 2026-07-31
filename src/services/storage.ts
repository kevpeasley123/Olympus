import { invoke } from "@tauri-apps/api/core";
import { seedState } from "../data/seed";
import { isTauriRuntime } from "./launcher";
import type {
  ConversationMessage,
  OlympusState,
  ProjectStatus,
  ToolDefinition,
  TrackedProject
} from "../types";

const STORAGE_KEY = "olympus:v8";
const LEGACY_KEYS = [
  "olympus:v1",
  "olympus:v2",
  "olympus:v3",
  "olympus:v4",
  "olympus:v5",
  "olympus:v6",
  "olympus:v7"
];

interface PersistedToolState {
  toolId: string;
  enabled: boolean;
}

interface PersistedState {
  settings: Record<string, string>;
  toolStates: PersistedToolState[];
  conversation: ConversationMessage[];
}

/**
 * Desktop builds persist to SQLite in the Tauri app data directory; the browser
 * dev server keeps using localStorage. Each runtime has exactly one source of
 * truth, so the two never have to be reconciled.
 */
export async function loadState(): Promise<OlympusState> {
  if (!isTauriRuntime()) {
    return readLocalState();
  }

  try {
    const persisted = await invoke<PersistedState>("load_persisted_state");

    if (isEmptyPersistedState(persisted) && hasLocalPayload()) {
      const local = readLocalState();
      await migrateLocalState(local);
      return local;
    }

    clearLegacyState();
    return applyPersistedState(persisted);
  } catch (error) {
    console.warn("[Olympus] Could not read the local database; falling back to localStorage.", error);
    return readLocalState();
  }
}

/**
 * Writes the small, bounded slice of state worth keeping: settings and tool
 * toggles. Conversation is deliberately excluded — it is appended at the point
 * a message is sent so history never gets rewritten on unrelated updates.
 */
export async function persistPreferences(state: OlympusState): Promise<void> {
  if (!isTauriRuntime()) {
    writeLocalState(state);
    return;
  }

  try {
    await invoke("save_settings", {
      settings: {
        projectsRootPath: state.settings.projectsRootPath
      }
    });
    await invoke("save_tool_states", {
      states: state.tools.map((tool) => ({ toolId: tool.id, enabled: tool.enabled }))
    });
  } catch (error) {
    console.warn("[Olympus] Could not save preferences to the local database.", error);
  }
}

export async function appendConversationMessages(messages: ConversationMessage[]): Promise<void> {
  if (messages.length === 0 || !isTauriRuntime()) return;

  try {
    await invoke("append_conversation_messages", { messages });
  } catch (error) {
    console.warn("[Olympus] Could not append conversation history.", error);
  }
}

export async function resetState(): Promise<OlympusState> {
  clearLegacyState();
  window.localStorage.removeItem(STORAGE_KEY);

  if (isTauriRuntime()) {
    try {
      await invoke("clear_conversation");
    } catch (error) {
      console.warn("[Olympus] Could not clear conversation history.", error);
    }
  }

  await persistPreferences(seedState);
  return seedState;
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

function applyPersistedState(persisted: PersistedState): OlympusState {
  const toolStates = new Map(persisted.toolStates.map((state) => [state.toolId, state.enabled]));

  return {
    ...seedState,
    settings: {
      projectsRootPath: persisted.settings.projectsRootPath ?? seedState.settings.projectsRootPath
    },
    tools: seedState.tools.map((tool) =>
      toolStates.has(tool.id) ? { ...tool, enabled: toolStates.get(tool.id)! } : tool
    ),
    conversation:
      persisted.conversation.length > 0 ? persisted.conversation : seedState.conversation,
    version: seedState.version
  };
}

function isEmptyPersistedState(persisted: PersistedState): boolean {
  return (
    Object.keys(persisted.settings).length === 0 &&
    persisted.toolStates.length === 0 &&
    persisted.conversation.length === 0
  );
}

function hasLocalPayload(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

/** One-time import so an existing localStorage install keeps its history. */
async function migrateLocalState(local: OlympusState): Promise<void> {
  console.info("[Olympus] Importing existing localStorage state into the local database.");
  await persistPreferences(local);
  await appendConversationMessages(local.conversation);
  clearLegacyState();
}

function readLocalState(): OlympusState {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    clearLegacyState();
    return seedState;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<OlympusState> & { research?: unknown[] };

    if (Array.isArray(parsed.research) && parsed.research.length > 0) {
      console.warn(
        "[pantheon] Found legacy research entries in localStorage. These are no longer used; the vault is now the source of truth. Migrate any custom entries by re-creating them via Add Entry."
      );
    }

    const merged: OlympusState = {
      ...seedState,
      ...parsed,
      tools: mergeById(seedState.tools, parsed.tools ?? []),
      quickApps: mergeKnownIds(seedState.quickApps, parsed.quickApps ?? []),
      projects: mergeById(seedState.projects, parsed.projects ?? []).map(normalizeProject),
      conversation: mergeById(seedState.conversation, parsed.conversation ?? []),
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

/**
 * Fills fields a payload written before project tiering existed does not have.
 *
 * `mergeById` spreads stored over seed, so a stored project whose id is not in
 * the seed contributes every field itself — and an older one has no `status`
 * this code recognises. TypeScript cannot catch that: the value came out of
 * `JSON.parse`. An unrecognised status becomes `unclassified`, which is the
 * honest reading of "nothing here declared one".
 */
function normalizeProject(project: TrackedProject): TrackedProject {
  const known: ProjectStatus[] = ["active", "watching", "scaffold", "archived", "unclassified"];

  return {
    ...project,
    status: known.includes(project.status) ? project.status : "unclassified",
    statusSource: project.statusSource === "declared" ? "declared" : "inferred",
    promoted: project.promoted ?? null,
    lastCommitAt: project.lastCommitAt ?? null,
    recentCommits: project.recentCommits ?? [],
    sinceSessionCommits: project.sinceSessionCommits ?? [],
    linkedWorktrees: project.linkedWorktrees ?? [],
    nextStep: project.nextStep ?? "",
    notePath: project.notePath ?? null,
    warnings: project.warnings ?? []
  };
}

function writeLocalState(state: OlympusState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function mergeKnownIds<T extends { id: string }>(seedItems: T[], storedItems: T[]): T[] {
  const merged = new Map<string, T>();

  seedItems.forEach((item) => merged.set(item.id, item));
  storedItems.forEach((item) => {
    if (merged.has(item.id)) {
      merged.set(item.id, { ...merged.get(item.id), ...item });
    }
  });

  return seedItems.map((item) => merged.get(item.id) ?? item);
}
