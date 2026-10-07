import { invoke } from "@tauri-apps/api/core";

/**
 * Command's capability armory and mission projections
 * (`src-tauri/src/commands/capabilities.rs`). The backend owns what exists;
 * this module only derives presentation state from it. Nothing here invokes a
 * capability: selecting a domain, Tool or Skill is inspection, not consent.
 */

export type Availability = "AVAILABLE" | "UNAVAILABLE";
export interface Usage { count: number; lastAt: string | null }

export interface CapabilityDomain {
  id: string;
  label: string;
  summary: string;
  tools: number;
  skills: number;
  available: number;
}

interface CapabilityBase {
  id: string;
  name: string;
  domain: string;
  usedBy: string[];
  workflows: string[];
  usage: Usage | null;
  usageUnit: string | null;
}
export interface ToolDescriptor extends CapabilityBase {
  kind: "tool";
  toolKind: "connection" | "source" | "handoff" | "local" | "executor" | "model";
  state: Availability;
  detail: string;
  capabilities: string[];
  authority: string;
  effects: string[];
  /** `required`: every use needs an approval; `writes`: only its writes ask. */
  approval: "none" | "writes" | "required";
  model?: string;
}
export interface SkillDescriptor extends CapabilityBase {
  kind: "skill";
  version: number;
  instructions?: string;
  purpose: string;
  inputs: string;
  output: string;
  effects: string;
  allowedTools: string[];
  state?: undefined;
}
export type Capability = ToolDescriptor | SkillDescriptor;

export interface AgentArmory { id: string; tools: string[]; skills: string[]; note: string }

export interface CapabilitySnapshot {
  observedAt: string;
  acceptance: boolean;
  domains: CapabilityDomain[];
  tools: ToolDescriptor[];
  skills: SkillDescriptor[];
  agents: AgentArmory[];
}

export type StepState = "completed" | "active" | "pending" | "waiting" | "failed" | "skipped" | "not-run";
export interface MissionStep {
  id: string;
  label: string;
  state: StepState;
  recorded: string | null;
  agent: string | null;
  tools: string[];
  skills: string[];
}
export type MissionStatus = "running" | "waiting" | "completed" | "failed" | "cancelled" | "interrupted";
export interface Mission {
  id: string;
  kind: "research-verification" | "communication-intelligence" | "communication-situations" | "knowledge-audit" | "coding-delegation";
  workflow: string;
  title: string;
  request: string;
  status: MissionStatus;
  phase?: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps: MissionStep[];
  approval: { required: boolean; detail: string } | null;
  result: { summary: string; detail?: string | null } | null;
  destination: "research" | "communications" | "project";
  source: string;
}
export interface MissionSnapshot { observedAt: string; missions: Mission[] }

export interface CapabilityClient {
  capabilities(): Promise<CapabilitySnapshot>;
  missions(): Promise<MissionSnapshot>;
}
export const capabilityClient: CapabilityClient = {
  capabilities: () => invoke<CapabilitySnapshot>("command_capabilities"),
  missions: () => invoke<MissionSnapshot>("command_missions")
};

export function allCapabilities(snapshot: CapabilitySnapshot): Capability[] {
  return [...snapshot.tools, ...snapshot.skills];
}
export function findCapability(snapshot: CapabilitySnapshot | null, id: string | null): Capability | null {
  if (!snapshot || !id) return null;
  return allCapabilities(snapshot).find(item => item.id === id) ?? null;
}
export function isAvailable(item: Capability): boolean {
  return item.kind === "skill" || item.state === "AVAILABLE";
}

/** What the selected agent is armed with; Olympus Core is the aggregate. */
export function lensFor(snapshot: CapabilitySnapshot, agentId: string | null): Set<string> {
  const armory = snapshot.agents.find(agent => agent.id === (agentId ?? "olympus")) ?? snapshot.agents.find(agent => agent.id === "olympus");
  return new Set([...(armory?.tools ?? []), ...(armory?.skills ?? [])]);
}

/**
 * The mission the Command surfaces show: live work first, otherwise one that
 * finished within `recentMs` and has not been dismissed. Never invents one.
 */
export const RECENT_MISSION_MS = 20 * 60_000;
export function currentMission(snapshot: MissionSnapshot | null, now: number, dismissed: ReadonlySet<string> = new Set()): Mission | null {
  if (!snapshot) return null;
  const live = snapshot.missions.find(mission => mission.status === "running" || mission.status === "waiting");
  if (live) return live;
  const recent = snapshot.missions.find(mission => {
    const finished = mission.finishedAt ? Date.parse(mission.finishedAt) : NaN;
    return !dismissed.has(mission.id) && Number.isFinite(finished) && now - finished <= RECENT_MISSION_MS;
  });
  return recent ?? null;
}

export type CapabilityState = "available" | "in-scope" | "active" | "completed" | "unavailable" | "requires-approval";
export type DomainState = "idle" | "in-scope" | "active" | "completed" | "unavailable";

export interface MissionFocus {
  /** Agent id → its strongest state in the mission. */
  agents: Map<string, "active" | "completed">;
  /** Capability id → state from the steps that name it. */
  capabilities: Map<string, "active" | "completed">;
  running: boolean;
}
export function missionFocus(mission: Mission | null): MissionFocus {
  const agents = new Map<string, "active" | "completed">();
  const capabilities = new Map<string, "active" | "completed">();
  if (!mission) return { agents, capabilities, running: false };
  const running = mission.status === "running";
  for (const step of mission.steps) {
    const state = step.state === "active" && running ? "active" : step.state === "completed" ? "completed" : null;
    if (!state) continue;
    const mark = (map: Map<string, "active" | "completed">, id: string) => { if (map.get(id) !== "active") map.set(id, state); };
    if (step.agent) mark(agents, step.agent);
    for (const id of [...step.tools, ...step.skills]) mark(capabilities, id);
  }
  return { agents, capabilities, running };
}

export interface ArmoryView {
  domains: Record<string, DomainState>;
  /** Only the capabilities to draw around the instrument; empty means none. */
  revealed: Capability[];
  states: Record<string, CapabilityState>;
}

/**
 * One derivation for everything the instrument shows. Priority: an active
 * mission, then a selected or hovered domain, then the agent lens. Olympus
 * Core's lens is aggregate, so it reveals no individual nodes: idle stays clean.
 */
export function armoryView(snapshot: CapabilitySnapshot, options: {
  agentId: string | null;
  hoverDomain?: string | null;
  selectedDomain?: string | null;
  focus?: MissionFocus;
}): ArmoryView {
  const items = allCapabilities(snapshot);
  const lens = lensFor(snapshot, options.agentId);
  const aggregate = !options.agentId || options.agentId === "olympus";
  const focus = options.focus;
  const states: Record<string, CapabilityState> = {};
  for (const item of items) {
    const mission = focus?.capabilities.get(item.id);
    states[item.id] = mission ?? (!isAvailable(item) ? "unavailable"
      : item.kind === "tool" && item.approval === "required" ? "requires-approval"
      : !aggregate && lens.has(item.id) ? "in-scope" : "available");
  }
  const openDomain = options.selectedDomain ?? options.hoverDomain ?? null;
  let revealed: Capability[];
  if (focus && focus.capabilities.size > 0) revealed = items.filter(item => focus.capabilities.has(item.id));
  else if (openDomain) revealed = items.filter(item => item.domain === openDomain);
  else if (!aggregate) revealed = items.filter(item => lens.has(item.id));
  else revealed = [];
  const domains: Record<string, DomainState> = {};
  for (const domain of snapshot.domains) {
    const owned = items.filter(item => item.domain === domain.id);
    const missionStates = owned.map(item => focus?.capabilities.get(item.id)).filter(Boolean);
    domains[domain.id] = missionStates.includes("active") ? "active"
      : missionStates.includes("completed") ? "completed"
      : domain.available === 0 ? "unavailable"
      : openDomain === domain.id || (!aggregate && owned.some(item => lens.has(item.id))) ? "in-scope"
      : "idle";
  }
  return { domains, revealed, states };
}

/** Per-domain light for the WebGL ring, 0..1; recomputed only when state changes. */
export function domainLight(view: ArmoryView, hoverDomain: string | null): Record<string, number> {
  const light: Record<string, number> = {};
  for (const [id, state] of Object.entries(view.domains)) {
    light[id] = state === "active" ? 1 : id === hoverDomain ? .9 : state === "in-scope" ? .75 : state === "completed" ? .35 : 0;
  }
  return light;
}

export interface Suggestion { id: string; label: string; prompt: string; requires: string[] }
/**
 * Conversation starters, each tied to capabilities chat already uses when it
 * answers (Gmail excerpts, research excerpts, project board, Decision Log).
 * They fill the composer; nothing is sent or executed.
 */
const SUGGESTIONS: Suggestion[] = [
  { id: "mail", label: "Summarize my recent email", prompt: "Summarize what needs my attention in recent email.", requires: ["gmail", "model-primary"] },
  { id: "research", label: "Ask the research library", prompt: "What does my research library say about ", requires: ["pantheon", "model-primary"] },
  { id: "projects", label: "Brief me on my projects", prompt: "Brief me on where my active projects stand and what needs me.", requires: ["git", "model-primary"] },
  { id: "decisions", label: "Review recent decisions", prompt: "What have I decided recently, and is anything worth revisiting?", requires: ["vault", "model-primary"] },
  { id: "deep", label: "Think something through deeply", prompt: "Help me think through ", requires: ["model-deep"] }
];
export function suggestionsFor(snapshot: CapabilitySnapshot | null): Suggestion[] {
  if (!snapshot) return [];
  const available = new Set(snapshot.tools.filter(tool => tool.state === "AVAILABLE").map(tool => tool.id));
  return SUGGESTIONS.filter(suggestion => suggestion.requires.every(id => available.has(id)));
}

export function counts(snapshot: CapabilitySnapshot | null) {
  if (!snapshot) return null;
  return { tools: snapshot.tools.length, skills: snapshot.skills.length, agents: snapshot.agents.filter(agent => agent.id !== "olympus").length };
}

export const STEP_GLYPH: Record<StepState, string> = {
  completed: "✓", active: "●", pending: "○", waiting: "◐", failed: "✕", skipped: "–", "not-run": "·"
};
export const STEP_WORD: Record<StepState, string> = {
  completed: "Completed", active: "In progress", pending: "Pending", waiting: "Waiting for you", failed: "Failed", skipped: "Skipped", "not-run": "Not run"
};
export const CAPABILITY_WORD: Record<CapabilityState, string> = {
  available: "Available", "in-scope": "In scope", active: "Active", completed: "Completed", unavailable: "Unavailable", "requires-approval": "Requires approval"
};

/** Short names for glyph labels around the instrument; full names stay in every accessible label. */
const SHORT_NAMES: Record<string, string> = {
  gmail: "Gmail", pantheon: "Pantheon", vault: "Vault", obsidian: "Obsidian", git: "Git", "claude-code": "Claude Code",
  "model-deep": "Astra", "model-claude": "Claude", "realtime-voice": "Speech", transcription: "Transcribe",
  "file-attachments": "Attach", "quick-apps": "Apps", browser: "Browser",
  "communication-assess": "Assess", "project-relevance": "Relevance", "situation-discovery": "Discover", "situation-briefing": "Brief",
  "research-retrieval": "Retrieve", "evidence-synthesis": "Synthesize", "claim-verification": "Verify"
};
export function shortName(item: Capability): string {
  return SHORT_NAMES[item.id] ?? item.name.split(/[\s·]+/)[0];
}

export interface RevealedNode { item: Capability; x: number; y: number; angle: number; radius: number; labelX: number; labelY: number }
interface Box { left: number; right: number; top: number; bottom: number }
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
/** Approximate label box in viewBox units: Inter medium averages ~0.6em per glyph. */
export function labelBox(text: string, x: number, y: number, fontUnits: number): Box {
  const width = text.length * fontUnits * .6 + 3, height = fontUnits * 1.2;
  return { left: x - width / 2, right: x + width / 2, top: y - height * .8, bottom: y + height * .4 };
}
/**
 * Places revealed Tools and Skills inside their domain's wedge, on a band just
 * inside the ring (Tools outer, Skills inner), then places each label at the
 * first candidate — stepping inward toward the Ω, then sideways — that clears
 * every placed label and glyph and stays out of the Ω's clearance. Pure, so the
 * harness asserts the same separation the visual review measures.
 */
export function layoutRevealed(revealed: Capability[], segments: { id: string; startAngle: number; endAngle: number }[], centre = 220, fontUnits = 9): RevealedNode[] {
  const nodes: RevealedNode[] = [];
  const placed: Box[] = [];
  const polar = (angle: number, radius: number) => { const r = (angle - 90) * Math.PI / 180; return { x: centre + Math.cos(r) * radius, y: centre + Math.sin(r) * radius }; };
  const glyphs: Box[] = [];
  const pending: { item: Capability; angle: number; radius: number; x: number; y: number }[] = [];
  for (const segment of segments) {
    const owned = revealed.filter(item => item.domain === segment.id).sort((a, b) => a.kind === b.kind ? 0 : a.kind === "tool" ? -1 : 1);
    if (!owned.length) continue;
    const pad = 5, span = segment.endAngle - segment.startAngle - pad * 2;
    owned.forEach((item, index) => {
      const angle = segment.startAngle + pad + span * (index + .5) / owned.length;
      // Stagger radius as well as kind, so neighbours in a crowded wedge separate.
      const radius = (item.kind === "tool" ? 140 : 128) - (owned.length > 3 ? (index % 2) * 7 : 0);
      const { x, y } = polar(angle, radius);
      glyphs.push({ left: x - 5, right: x + 5, top: y - 5, bottom: y + 5 });
      pending.push({ item, angle, radius, x, y });
    });
  }
  for (const node of pending) {
    const text = shortName(node.item);
    const width = text.length * fontUnits * .6 + 3, height = fontUnits * 1.2;
    // Toward the Ω from the glyph, and along the ring. The label's near edge
    // sits a small gap from its glyph whatever the angle, so a label reads as
    // its glyph's; crowded wedges stack further inward a row at a time.
    const inward = { x: (centre - node.x) / node.radius, y: (centre - node.y) / node.radius };
    const along = { x: -inward.y, y: inward.x };
    const reach = Math.abs(inward.x) * width / 2 + Math.abs(inward.y) * height / 2;
    let best = { score: Infinity, x: 0, y: 0 };
    search: for (let row = 0; row < 8; row += 1) {
      for (const sideways of [0, -.5, .5, -1, 1]) {
        const distance = 7 + reach + row * height * 1.1;
        const shift = sideways * (Math.abs(along.x) * width + Math.abs(along.y) * height + 4);
        const x = node.x + inward.x * distance + along.x * shift;
        // labelBox measures from the baseline; centre the box on the point.
        const y = node.y + inward.y * distance + along.y * shift + height * .2;
        const box = labelBox(text, x, y, fontUnits);
        const collisions = placed.filter(other => overlaps(box, other)).length + glyphs.filter(glyph => overlaps(box, glyph)).length;
        const corners = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]];
        const escapes = corners.filter(([cx, cy]) => { const d = Math.hypot(cx - centre, cy - centre); return d <= 70 || d >= 154; }).length;
        const score = collisions * 10 + escapes;
        if (score < best.score) best = { score, x, y };
        if (score === 0) break search;
      }
    }
    const at = best;
    placed.push(labelBox(text, at.x, at.y, fontUnits));
    nodes.push({ item: node.item, x: node.x, y: node.y, angle: node.angle, radius: node.radius, labelX: at.x, labelY: at.y });
  }
  return nodes;
}

/** Display names for runtime roles; the Agent Catalog owns their details. */
export const AGENT_NAMES: Record<string, string> = {
  olympus: "Olympus Core", research: "Research Agent @1", verification: "Verification Agent @1", "coding-delegate": "Coding Delegate"
};
