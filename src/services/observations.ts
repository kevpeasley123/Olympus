import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";
import type { ObsidianActionResult } from "./obsidian";

/**
 * Records one inferred observation in `09 - System/Profile Observations.md`.
 *
 * The gate handles review: Rust blocks on the confirmation dialog and shows the
 * exact lines it would add, so this call resolves only after the operator has
 * answered. `written: false` means they declined, which is a normal outcome.
 */

interface ObservationResult {
  path: string;
  written: boolean;
}

/** Mirrors `MAX_OBSERVATION_CHARS` in `observations.rs`, which is the authority. */
export const OBSERVATION_MAX_CHARS = 500;

export const OBSERVATIONS_NOTE = "09 - System/Profile Observations.md";

export async function recordObservation(text: string): Promise<ObsidianActionResult> {
  if (!isTauriRuntime()) {
    return {
      tone: "warning",
      message: "Observations are written to the vault from the desktop app."
    };
  }

  const result = await invoke<ObservationResult>("append_profile_observation", {
    request: { text }
  });

  if (!result.written) {
    return {
      tone: "warning",
      message: "Nothing was added. The note is unchanged.",
      path: result.path
    };
  }

  return {
    tone: "success",
    message: `Appended to ${OBSERVATIONS_NOTE}`,
    path: result.path
  };
}
