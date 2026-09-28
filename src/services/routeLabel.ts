import type { ModelCapability, ModelRequest } from "./modelRouting";

/**
 * The route a request took, in the operator's words (review D3). The model
 * identifier stays available as a tooltip or in diagnostics; it is a name to
 * be read exactly, not a label to glance at.
 */
const ROUTES: Record<string, { name: string; note?: string }> = {
  PRIMARY: { name: "Sol" },
  DEEP_REASONING: { name: "Astra", note: "one request" },
  CLAUDE_COMPARISON: { name: "Claude comparison", note: "one request" },
  REALTIME: { name: "Realtime voice" }
};

export function routeName(capability: ModelCapability | string | null | undefined): string {
  if (!capability) return "Model";
  return ROUTES[capability]?.name ?? capability.toLowerCase().replace(/_/g, " ");
}

/** "Sol · medium", "Astra · high (one request)". */
export function routeLabel(request: Pick<ModelRequest, "capability" | "reasoningEffort">): string {
  const route = ROUTES[request.capability];
  const name = routeName(request.capability);
  const effort = request.reasoningEffort ? ` · ${request.reasoningEffort}` : "";
  return `${name}${effort}${route?.note ? ` (${route.note})` : ""}`;
}

/** Tooltip text: provider, the model that answered (or was asked for), request id. */
export function routeTitle(request: Pick<ModelRequest, "provider" | "actualModel" | "requestedModel" | "id">): string {
  return `${request.provider} · ${request.actualModel ?? `${request.requestedModel} (requested; unconfirmed)`} · request ${request.id}`;
}
