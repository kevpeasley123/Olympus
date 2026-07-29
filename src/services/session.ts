import { invoke } from "@tauri-apps/api/core";
import type { SessionBoundary } from "../types";
import { isTauriRuntime } from "./launcher";

// One ID for the lifetime of this webview. React StrictMode may call the
// initializer twice, but both calls resolve to one durable session row.
const sessionId = crypto.randomUUID();

export async function beginOperatorSession(): Promise<SessionBoundary | null> {
  if (!isTauriRuntime()) return null;

  return invoke<SessionBoundary>("begin_operator_session", {
    request: { sessionId }
  });
}
