import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isUnchangedSnapshot, type SituationSnapshot, type SituationsClient } from "../../services/situations";
import { subscribeToRefresh } from "../../services/navigation";

/** False while the window is minimised or behind another tab; polls pause then. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    (listener) => {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
    () => document.visibilityState !== "hidden",
    () => true
  );
}

export const readableSituationError = (e: unknown) =>
  String(e).includes("detail_") ? "The first map could not be completed because a source detail could not be verified. Try Refresh situations."
    : String(e) === "communication_analysis_already_running" ? "Another analysis is running. Retry when it finishes."
    : String(e).replace(/_/g, " ");

/**
 * The situation snapshot, polled only as often as someone can see it (review F5).
 *
 * Every 3 s while the situation maps are on screen, every 15 s while only the
 * header's freshness line needs it, and not at all while the window is hidden.
 * An identical snapshot is never set again: the backend answers "unchanged"
 * for the revision already held, and a client without revisions (the harness
 * fixtures) is compared structurally. Priority and actor projections are
 * derived from `data`, so they recompute only when something changed.
 *
 * Reads only. Background understanding keeps running in the Rust engine
 * whatever this view does.
 */
export function useSituationSnapshot(api: SituationsClient, focused: boolean) {
  const [data, setData] = useState<SituationSnapshot | null>(null);
  const [error, setError] = useState("");
  const visible = useDocumentVisible();
  const revision = useRef<string | undefined>(undefined);
  const structural = useRef("");
  const epoch = useRef(0);
  const pending = useRef(false);
  const sequence = useRef(0);
  const applied = useRef(0);

  const pull = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const current = epoch.current;
    const request = ++sequence.current;
    try {
      const next = await api.snapshot(revision.current);
      // A reload can overtake a poll; an older answer never replaces a newer one.
      if (current !== epoch.current || request < applied.current) return;
      applied.current = request;
      setError("");
      if (isUnchangedSnapshot(next)) return;
      if (next.revision) {
        if (next.revision === revision.current) return;
        revision.current = next.revision;
      } else {
        const key = JSON.stringify(next);
        if (key === structural.current) return;
        structural.current = key;
      }
      setData(next);
    } catch (e) {
      if (current === epoch.current) setError(readableSituationError(e));
    } finally {
      pending.current = false;
    }
  }, [api]);

  // A different client (harness fixture switch) starts from nothing.
  useEffect(() => {
    epoch.current++;
    revision.current = undefined;
    structural.current = "";
    pending.current = false;
    setData(null);
    return () => { epoch.current++; };
  }, [api]);

  useEffect(() => {
    if (!visible) return;
    void pull();
    const timer = window.setInterval(() => void pull(), focused ? 3000 : 15000);
    return () => window.clearInterval(timer);
  }, [pull, visible, focused]);

  useEffect(() => subscribeToRefresh(() => void pull()), [pull]);

  /** After an operator action: fetch now, even if a poll is in flight. */
  const reload = useCallback(async () => {
    pending.current = false;
    await pull();
  }, [pull]);

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  /** One operator action at a time; its failure is reported separately from polling. */
  const act = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setActionError(""); setNotice("");
    try { await fn(); await reload(); return true; }
    catch (e) { if (epoch.current) setActionError(readableSituationError(e)); return false; }
    finally { setBusy(""); }
  }, [reload]);

  return { data, error, setError, reload, busy, act, notice, setNotice, actionError, setActionError };
}

export type SituationFeed = ReturnType<typeof useSituationSnapshot>;
