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
  status?: "disconnected" | "unsupported" | "loading" | "failed" | "ready";
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

export function formatUsageMetric(metric: UsageMetric | null): string {
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0 || !metric.unit.trim() || !metric.period.trim()) return "Unavailable";
  return `${metric.value.toLocaleString(undefined, {maximumFractionDigits: 4})} ${metric.unit} · ${metric.period}`;
}

export function usageFreshness(observedAt: string | null, now = Date.now()): "Not checked" | "Recent" | "Stale" {
  const observed = observedAt ? Date.parse(observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now) return "Not checked";
  return now - observed > 5 * 60_000 ? "Stale" : "Recent";
}
