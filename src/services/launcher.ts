import { invoke } from "@tauri-apps/api/core";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

export async function launchQuickApp(appId: string, launchUri: string): Promise<"native" | "fallback"> {
  if (isTauriRuntime()) {
    await invoke("launch_quick_app", { appId });
    return "native";
  }

  window.open(launchUri, "_blank", "noopener,noreferrer");
  return "fallback";
}

/**
 * Opens a vault note in Obsidian.
 *
 * Rust resolves the path through the vault containment guard and builds the
 * URI, so this passes a vault-relative path and nothing else.
 */
export async function openVaultNote(relativePath: string): Promise<"native" | "unsupported"> {
  if (!isTauriRuntime()) {
    return "unsupported";
  }

  await invoke("open_vault_note", { relativePath });
  return "native";
}

export async function restartDesktopApp(): Promise<"native" | "unsupported"> {
  if (!isTauriRuntime()) {
    return "unsupported";
  }

  await invoke("restart_olympus");
  return "native";
}
