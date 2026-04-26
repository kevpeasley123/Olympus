export interface LoadableState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type LiveSourceStatus = "ok" | "stale" | "failed";

export interface LiveSourceHealth {
  key: string;
  label: string;
  status: LiveSourceStatus;
  lastFetchAt: number | null;
  lastError?: string;
}
