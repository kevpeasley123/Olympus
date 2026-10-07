import type { CapabilitySnapshot, MissionSnapshot, ToolDescriptor } from "./capabilities";
/** Plugins are source/connection/local adapters, not model routes or executors. */
export function armoryPlugins(snapshot: CapabilitySnapshot | null) {
  return snapshot?.tools.filter(tool => !["model", "executor"].includes(tool.toolKind)) ?? [];
}
export function pluginStatus(tool: ToolDescriptor) {
  if (tool.state !== "AVAILABLE") return "Unavailable";
  // Only Gmail currently supplies an authenticated connection observation.
  if (tool.id === "gmail" && tool.detail.startsWith("Connected")) return "Connected";
  return "Available";
}
export function liveOperations(snapshot: MissionSnapshot | null) {
  return snapshot?.missions.filter(m => m.status === "running" || m.status === "waiting") ?? [];
}
