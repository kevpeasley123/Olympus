/** Account telemetry is separate from Olympus's per-request/session receipts. */
export interface UsageMetric {
  value: number;
  unit: string;
  period: string;
}
export interface UsageWindow {
  label: string;
  remaining: UsageMetric | null;
  resetsAt: string | null;
}
export interface UsageSnapshot {
  evidence?: "historical";
  status?: "disconnected" | "unsupported" | "loading" | "failed" | "ready";
  detail?: string;
  consumption?: UsageMetric | null;
  provider: string;
  capabilityCategory: "models-subscriptions" | "apis-services";
  scope: "Account" | "Workspace" | "Olympus only";
  source: string;
  observedAt: string | null;
  windows: UsageWindow[];
  balance: UsageMetric | null;
  ytdConsumption: UsageMetric | null;
  ytdSpend: UsageMetric | null;
}

// No provider account endpoint is wired in this slice. Never seed live balances.
export const unavailableUsage: UsageSnapshot[] = [{provider:"Codex", capabilityCategory:"models-subscriptions" as const}, {provider:"Claude", capabilityCategory:"models-subscriptions" as const}, {provider:"ElevenLabs", capabilityCategory:"apis-services" as const}].map(({provider, capabilityCategory}) => ({
  provider, capabilityCategory, scope: "Account", source: "Account telemetry not connected", observedAt: null,
  windows: [], balance: null, ytdConsumption: null, ytdSpend: null,
}));

/** Display precision only; meter geometry and quota values remain unchanged. */
export function formatUsagePercentage(value: number | null): string {
  return value === null || !Number.isFinite(value) || value < 0 || value > 100
    ? "-" : value.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1});
}

export function formatUsageMetric(metric: UsageMetric | null): string {
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0 || !metric.unit.trim() || !metric.period.trim()) return "Unavailable";
  return `${metric.unit === "%" ? formatUsagePercentage(metric.value) : metric.value.toLocaleString(undefined, {maximumFractionDigits: 4})} ${metric.unit} · ${metric.period}`;
}

export function usageFreshness(observedAt: string | null, now = Date.now()): "Not checked" | "Recent" | "Stale" {
  const observed = observedAt ? Date.parse(observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now) return "Not checked";
  return now - observed > 5 * 60_000 ? "Stale" : "Recent";
}

/** A failed refresh never makes old evidence look newly observed. */
export function mergeUsageReading(previous: UsageSnapshot, next: UsageSnapshot): UsageSnapshot {
  return next.status === "failed" && previous.observedAt
    ? {...previous, status: "failed", detail: next.detail}
    : next;
}

/** A passive Claude window expires even if no new activity or Refresh occurs. */
export function expireUsageWindows(snapshot: UsageSnapshot, now=Date.now()): UsageSnapshot {
  if(snapshot.provider!=="Claude" || snapshot.source!=="Claude Code statusline (passive local)") return snapshot;
  return {...snapshot, windows:snapshot.windows.map(w=>w.resetsAt && Date.parse(w.resetsAt)<=now?{...w,remaining:null}:w)};
}

/** Historical observations are never presented as fresh account telemetry. */
export function snapshotFreshness(snapshot: UsageSnapshot, now=Date.now()) {
  return snapshot.evidence === "historical" ? "Stale" : usageFreshness(snapshot.observedAt,now);
}
