import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface QuietHours {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface OperatorProfile {
  status: "seed" | "assumed" | "active";
  briefTime: TimeOfDay | null;
  briefMaxWords: number | null;
  activeProjectCap: number | null;
  quietHours: QuietHours | null;
  /** Fields present but unparseable, so a typo is visible rather than silent. */
  warnings: string[];
}

/**
 * The first consumer of the structured profile.
 *
 * `profile.rs` has parsed this since the typed-settings work; nothing on the
 * frontend had ever read it. Read once at mount rather than polled — the note
 * is edited by hand, rarely, and a stale quiet-hours band costs nothing.
 *
 * Failure is silent by design. Quiet hours are decoration on the day arc: if
 * the field is missing, malformed, or the whole call fails, the band simply
 * does not render. It must never block the arc.
 */
export function useOperatorProfile(): OperatorProfile | null {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await invoke<OperatorProfile>("fetch_operator_profile");
        if (!cancelled) setProfile(loaded);
      } catch {
        // Deliberately swallowed — see above.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}
