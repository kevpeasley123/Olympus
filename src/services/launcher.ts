import { invoke } from "@tauri-apps/api/core";

function isTauriRuntime(): boolean {
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

export async function restartDesktopApp(): Promise<"native" | "unsupported"> {
  if (!isTauriRuntime()) {
    return "unsupported";
  }

  await invoke("restart_olympus");
  return "native";
}
