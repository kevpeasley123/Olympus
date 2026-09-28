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
  /**
   * `force` guarantees a fetch that starts after the call. Without it a caller
   * can join a fetch already in flight, which may predate the write it wants
   * to see.
   */
  refresh: (options?: { force?: boolean }) => Promise<void>;
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
  let dirty = false;
  // Compared once per poll so an unchanged result does not re-render every
  // subscriber. Cheap next to the render it saves: the 3 s delegation poll
  // would otherwise redraw the whole App tree forever.
  let snapshot: string | undefined;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  async function refresh(refreshOptions?: { force?: boolean }): Promise<void> {
    if (inFlight) {
      // Coalesced: several panels mounting at once must not each trigger a scan.
      if (!refreshOptions?.force) return inFlight;
      // The running fetch may predate the caller's write: queue one more.
      dirty = true;
      await inFlight;
      return inFlight ?? undefined;
    }

    inFlight = (async () => {
      const before = { data, loading, error };
      try {
        const previous = data;
        const next = await options.fetcher();
        const serialized = JSON.stringify(next);
        if (serialized !== snapshot) {
          snapshot = serialized;
          data = next;
        }
        options.onData?.(data, previous);
        error = null;
      } catch (caught) {
        error = String(caught);
      } finally {
        loading = false;
        inFlight = null;
        if (data !== before.data || loading !== before.loading || error !== before.error) notify();
        if (dirty) {
          dirty = false;
          void refresh();
        }
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
