import { useEffect, useReducer } from "react";

/**
 * A poll shared by every consumer instead of one per mounting component.
 *
 * `useActionQueue` and `usePantheon` used to poll from inside `ProjectsPanel`
 * and `LibraryPanel`, so they ran only in the modes those panels appear in —
 * Command mode ran neither. Hoisting the subscription to `App` fixes that, and
 * a shared store means the panels reuse the same data rather than starting a
 * second timer beside it.
 *
 * The interval starts with the first subscriber and stops with the last, so
 * nothing polls when nothing is listening.
 */
export interface PollingStore<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function createPollingStore<T>(options: {
  intervalMs: number;
  initial: T;
  fetcher: () => Promise<T>;
  /** Called only after a successful fetch, before subscribers are notified. */
  onData?: (next: T, previous: T) => void;
}): () => PollingStore<T> {
  let data: T = options.initial;
  let loading = true;
  let error: string | null = null;
  let subscribers = 0;
  let timer: number | undefined;
  let inFlight: Promise<void> | null = null;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function refresh(): Promise<void> {
    // Coalesced: several panels mounting at once must not each trigger a scan.
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const previous = data;
        const next = await options.fetcher();
        data = next;
        options.onData?.(next, previous);
        error = null;
      } catch (caught) {
        error = String(caught);
      } finally {
        loading = false;
        inFlight = null;
        notify();
      }
    })();

    return inFlight;
  }

  return function usePollingStore(): PollingStore<T> {
    const [, rerender] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
      listeners.add(rerender);
      subscribers += 1;

      if (subscribers === 1) {
        void refresh();
        timer = window.setInterval(() => void refresh(), options.intervalMs);
      }

      return () => {
        listeners.delete(rerender);
        subscribers -= 1;
        if (subscribers === 0 && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      };
    }, []);

    return { data, loading, error, refresh };
  };
}
