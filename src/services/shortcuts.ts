import { VOICE_CLIENT } from "./voiceContract";

/**
 * Every keyboard shortcut Olympus owns, in one place (review U9).
 *
 * The popover in AmbientDock renders from this list and each handler matches
 * with the entry's own `matches`, so what the popover says and what the keys do
 * cannot drift apart again. Each key has exactly one owner: Ctrl+K is the
 * console everywhere; library search is `/`.
 *
 * Window-level handlers call `isModalOpen()` first: while any aria-modal dialog is
 * open, it owns the keyboard. Ctrl+R is the one exception to yielding
 * silently — its default is always suppressed so the webview never reloads
 * mid-draft or under the write gate.
 */

export type ShortcutScope = "global" | "command" | "research" | "console" | "dialog";

export interface ShortcutDefinition {
  id: ShortcutId;
  /** As printed in the popover. */
  keys: string;
  label: string;
  scope: ShortcutScope;
  description: string;
  matches: (event: KeyboardEvent) => boolean;
}

export type ShortcutId = "console" | "cycleMode" | "microphone" | "refresh" | "escape" | "librarySearch";

const primary = (event: KeyboardEvent) => event.ctrlKey || event.metaKey;

export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  console: {
    id: "console", keys: "Ctrl/Cmd+K", scope: "global",
    label: "Focus the command console",
    description: "Moves focus to the console input from any mode.",
    matches: (event) => primary(event) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k"
  },
  cycleMode: {
    id: "cycleMode", keys: "Ctrl/Cmd+\\", scope: "global",
    label: "Cycle mode — Command, Project, Research, Communications",
    description: "Ignored while typing in a field.",
    matches: (event) => primary(event) && event.key === "\\"
  },
  microphone: {
    id: "microphone", keys: "Ctrl/Cmd+Shift+M", scope: "global",
    label: "Start or stop the microphone",
    description: "Opens a voice session; audio is sent to OpenAI while the microphone is on.",
    matches: (event) => primary(event) && event.shiftKey && event.code === VOICE_CLIENT.shortcutCode && !event.repeat
  },
  refresh: {
    id: "refresh", keys: "Ctrl/Cmd+R", scope: "global",
    // Communications subscribes via `subscribeToRefresh`: it re-reads the mail
    // cache and situations. It does not sync Gmail or run understanding.
    label: "Refresh projects, tasks, runs, library, vault and mail view",
    description: "Never reloads the window, even while typing.",
    matches: (event) => primary(event) && !event.altKey && event.key.toLowerCase() === "r"
  },
  escape: {
    id: "escape", keys: "Esc", scope: "console",
    label: "Close a dialog, or step the console back",
    description: "Transcript → live conversation → closed. In Research, clears the library search first.",
    matches: (event) => event.key === "Escape"
  },
  librarySearch: {
    id: "librarySearch", keys: "/", scope: "research",
    label: "Focus library search (Research)",
    description: "Only when focus is not already in a text field.",
    matches: (event) => event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey
  }
};

/** Popover order. */
export const SHORTCUT_LIST: ShortcutDefinition[] = [
  SHORTCUTS.console, SHORTCUTS.cycleMode, SHORTCUTS.microphone, SHORTCUTS.refresh, SHORTCUTS.escape, SHORTCUTS.librarySearch
];

/** Any aria-modal dialog is open: the write gate, Preferences, the library modal. */
export function isModalOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector('[aria-modal="true"]') !== null;
}

/** True when the dialog `own` is open but another modal sits above or beside it. */
export function anotherModalIsOpen(own: Element | null): boolean {
  return Array.from(document.querySelectorAll('[aria-modal="true"]')).some((node) => node !== own);
}

/** A key typed here is text, not a command. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(target.type);
  }
  return false;
}

/**
 * Installed once in main.tsx, outside every error boundary: the webview's own
 * Ctrl/Cmd+R reload is suppressed even when the region that performs the
 * refresh (the Status dock) has crashed and unmounted its handler. Capture
 * phase, so no handler below can run first and stop it.
 */
export function suppressWebviewReload(target: Window = window): () => void {
  const suppress = (event: KeyboardEvent) => {
    if (SHORTCUTS.refresh.matches(event)) event.preventDefault();
  };
  target.addEventListener("keydown", suppress, true);
  return () => target.removeEventListener("keydown", suppress, true);
}
