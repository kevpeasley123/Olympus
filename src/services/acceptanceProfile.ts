import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { isTauriRuntime } from "./launcher";

/**
 * The desktop acceptance profile (`OLYMPUS_ACCEPTANCE_DIR`, debug builds only).
 * Read once: the backend fixes it at startup and it cannot change while the
 * app runs. A failed read is treated as no profile, which is also what every
 * release build and the browser preview report.
 */
export interface AcceptanceProfile {
  active: boolean;
  dir: string;
}

export const ACCEPTANCE_LABEL = "Acceptance profile — synthetic data; providers and Gmail disabled";

let request: Promise<AcceptanceProfile | null> | null = null;

export function loadAcceptanceProfile(): Promise<AcceptanceProfile | null> {
  if (!isTauriRuntime()) return Promise.resolve(null);
  request ??= invoke<AcceptanceProfile | null>("acceptance_profile").catch(() => null);
  return request;
}

export function useAcceptanceProfile(): AcceptanceProfile | null {
  const [profile, setProfile] = useState<AcceptanceProfile | null>(null);
  useEffect(() => {
    let live = true;
    void loadAcceptanceProfile().then((value) => { if (live) setProfile(value?.active ? value : null); });
    return () => { live = false; };
  }, []);
  return profile;
}
