import { OlympusArmory } from "./components/panels/OlympusArmory";
import "@fontsource/cinzel/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
/**
 * Command harness: the real Command composition (catalog, capability
 * instrument, chat workspace) over synthetic data, for functional checks
 * (`?check`) and deterministic visual scenarios (`?scenario=<name>`).
 *
 * Visual-ready contract: once the scenario's state is applied, fonts are
 * loaded, the catalog has read, the instrument has painted (WebGL scene ready,
 * or the flat fallback in place) and finite CSS animations have finished,
 * `<html data-visual-ready="<scenario>">` is set. `scripts/visual-review.mjs`
 * waits for it instead of sleeping. Nothing here touches live data.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { BookOpen, Network, Layers, MessageSquare } from "lucide-react";
import { BackgroundLayer } from "./components/BackgroundLayer";
import { CommandInstrument } from "./components/panels/CommandInstrument";
import { CommandAgentCatalog } from "./components/panels/CommandAgentCatalog";
import { ChatPanel } from "./components/panels/ChatPanel";
import { HeaderBar } from "./components/panels/HeaderBar";
import { ResearchVerification } from "./components/panels/ResearchVerification";
import type { CommandCatalog, CommandCatalogClient } from "./services/commandAgents";
import type { ResearchClient, ResearchRun, AgentCatalog } from "./services/researchVerification";
import type { TrackedProject, ConversationMessage } from "./types";
import { EMPTY_VAULT_GRAPH, type VaultGraphPayload } from "./services/vaultGraph";
import { runProjectRingHarness } from "./services/projectRing.harness";
import { runGlyphStateHarness } from "./services/glyphState.harness";
import { runAmbientMotionHarness } from "./services/ambientMotion.harness";
import { runCapabilitiesHarness } from "./services/capabilities.harness";
import { suggestionsFor, type CapabilitySnapshot, type MissionSnapshot } from "./services/capabilities";
import { useCommandView } from "./hooks/useCommandView";
import catalogFixture from "./services/commandAgentsFixture.json";
import capabilityFixture from "./services/capabilitiesFixture.json";
import inspectionFixture from "./services/researchVerificationFixture.json";
import "./styles.css";

const params = new URLSearchParams(location.search);
export const SCENARIOS = {
  "idle": "Command at rest: catalog, aggregate armory, expanded chat ready",
  "agent-olympus": "Olympus Core selected: aggregate armory",
  "agent-research": "Research Agent lens",
  "agent-verification": "Verification Agent lens",
  "agent-coding": "Coding Delegate lens: unproven, executor unavailable",
  "domain-communications": "Communications domain revealed (the densest domain)",
  "capability-detail": "Claim Verification inspected from the Research domain",
  "chat-compact": "Compact console, instrument unobstructed",
  "chat-expanded": "Expanded chat with a conversation from this launch",
  "mission-active": "Recorded mail-analysis mission in progress",
  "mission-research": "Recorded research verification in progress",
  "mission-complete": "Research verification finished: result ready",
  "reduced-motion": "Idle with reduced motion"
} as const;
type Scenario = keyof typeof SCENARIOS;
const scenario: Scenario = (params.get("scenario") as Scenario) in SCENARIOS ? params.get("scenario") as Scenario : "idle";

let catalogScenario = "empty", reads = 0, mutations = 0, reduced = scenario === "reduced-motion";
const invoked: string[] = [];
const listeners = new Set<() => void>(); const originalMatchMedia = window.matchMedia.bind(window);
window.matchMedia = ((query: string) => query === "(prefers-reduced-motion: reduce)" ? {
  get matches() { return reduced }, addEventListener: (_: string, f: () => void) => listeners.add(f), removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  addListener: (f: () => void) => listeners.add(f), removeListener: (f: () => void) => listeners.delete(f)
} : originalMatchMedia(query)) as typeof window.matchMedia;

const projects: TrackedProject[] = ["Olympus", "Pokedex", "Agentic AI", "AI Learning", "Fidelity", "Obsidian", "Health App", "Fruit Organizer"].map((name, i) => ({
  id: `p${i}`, name, path: `C:/fixture/${i}`, status: i === 0 ? "active" : "watching", statusSource: "declared", promoted: null, branch: "main", lastCommit: "fixture",
  lastCommitAt: null, repoState: "git-active", recentCommits: [], sinceSessionCommits: [], linkedWorktrees: [], summary: "", vision: "", visionReviewedAt: null,
  nextStep: "", notePath: `project-${i}.md`, warnings: []
}));
const graph: VaultGraphPayload = { ...EMPTY_VAULT_GRAPH, nodes: projects.map(p => ({ id: p.notePath!, title: p.name, folder: "Projects", isProject: true, degree: 1, hop: 0 })), edges: [] };
for (let i = 0; i < (params.has("dense-vault") ? 112 : 32); i++) { const id = `note-${i}.md`; graph.nodes.push({ id, title: `Synthetic note ${i}`, folder: "Research", isProject: false, degree: 1, hop: 1 }); graph.edges.push({ from: projects[i % projects.length].notePath!, to: id }); }
mockIPC(command => {
  invoked.push(command);
  if (command === "fetch_vault_graph") return graph;
  if (command === "fetch_recent_vault_writes") return [];
  if (command === "fetch_operator_profile") return null;
  if (command === "model_routes") return { routes: [{ capability: "PRIMARY", provider: "openai", model: "fixture-only", label: "Sol", effort: "medium" }], realtime: "fixture", transcription: "fixture", coding: "fixture" };
  throw Error(`Unexpected fixture IPC: ${command}`);
});
const client: CommandCatalogClient = { read: async () => {
  reads++; if (catalogScenario === "error") throw Error("Synthetic runtime unavailable");
  const fixture = catalogFixture as unknown as { empty: CommandCatalog; history: CommandCatalog };
  const value = structuredClone(catalogScenario === "history" ? fixture.history : fixture.empty);
  if (catalogScenario === "unavailable") value.agents.filter(a => a.kind === "agent").forEach(a => { a.status = "UNAVAILABLE"; a.tone = "unavailable"; a.availability = "Synthetic missing credentials"; });
  if (catalogScenario === "six") for (let i = 0; i < 4; i++) value.agents.push({ ...structuredClone(value.agents[0]), id: `fixture-${i}`, name: `Fixture executor ${i + 1}`, description: "Synthetic executable role for layout testing only." });
  return value;
} };
const readOnlyResearch: ResearchClient = {
  catalog: async () => structuredClone(inspectionFixture.catalog) as unknown as AgentCatalog,
  list: async () => [{ id: "parent", question: "Synthetic question", status: "completed", startedAt: inspectionFixture.run.startedAt, agentIds: ["research", "verification"] }],
  inspect: async id => ({ ...structuredClone(inspectionFixture.run), id }) as unknown as ResearchRun,
  start: async () => { mutations++; throw Error("Inspection must never start"); }, cancel: async () => { mutations++; throw Error("Inspection must never cancel"); },
};

const capabilities = capabilityFixture.capabilities as unknown as CapabilitySnapshot;
const missionSets = capabilityFixture.missions as unknown as Record<"none" | "completed" | "researchActive" | "mailActive", MissionSnapshot>;
const missionFor: Record<Scenario, MissionSnapshot> = {
  "idle": missionSets.none, "agent-olympus": missionSets.none, "agent-research": missionSets.none, "agent-verification": missionSets.none,
  "agent-coding": missionSets.none, "domain-communications": missionSets.none, "capability-detail": missionSets.none, "chat-compact": missionSets.none,
  "chat-expanded": missionSets.none, "mission-active": missionSets.mailActive, "mission-research": missionSets.researchActive,
  "mission-complete": missionSets.completed, "reduced-motion": missionSets.none
};
// The fixture's clock: completed runs are "recent" only relative to this instant.
const fixtureNow = Date.parse("2026-09-29T07:20:00Z");
const earlier = new Date(Date.now() - 26 * 3600_000).toISOString();
const history: ConversationMessage[] = Array.from({ length: 14 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", timestamp: "12:04", at: earlier,
  content: i % 2 ? "This is synthetic conversation evidence for the Command layout. The real catalog is read-only. ".repeat(3) : "Show the available operational roles." }));
const thisLaunch: ConversationMessage[] = [
  { id: "s1", role: "user", timestamp: "09:02", at: new Date().toISOString(), content: "Which of my research notes support evidence-first review?" },
  { id: "s2", role: "assistant", timestamp: "09:02", at: new Date().toISOString(), content: "Two library entries support it directly: **Evidence Before Authority** and **Checklist Discipline**. A third discusses review cost without taking a side.\n\nIf you want the claims checked against the excerpts, run a research verification from the Research view; it records each claim as supported, contradicted or insufficient." },
  { id: "s3", role: "user", timestamp: "09:04", at: new Date().toISOString(), content: "What's still unresolved?" },
  { id: "s4", role: "assistant", timestamp: "09:04", at: new Date().toISOString(), content: "Whether the review step slows delivery. The library has one article arguing it does, from a different domain. That is the claim a verification run would mark insufficient." }
];

function Harness() {
  const flagship = params.has("flagship");
  const [key, setKey] = useState(0), [destination, setDestination] = useState<null | { runId?: string; projects?: boolean }>(null);
  const [layout, setLayout] = useState<"compact" | "expanded">(scenario === "chat-compact" ? "compact" : "expanded");
  const [catalogReady, setCatalogReady] = useState(false);
  const missions = missionFor[scenario];
  const command = useCommandView(capabilities, missions, fixtureNow);
  const messages = scenario === "chat-expanded" ? [...history, ...thisLaunch] : history;
  const suggestions = useMemo(() => suggestionsFor(capabilities), []);
  useEffect(() => {
    if (scenario === "agent-research") command.selectAgent("research");
    if (scenario === "agent-verification") command.selectAgent("verification");
    if (scenario === "agent-coding") { command.selectAgent("coding-delegate"); command.setSelectedCapability("claude-code"); }
    if (scenario === "domain-communications") command.setSelectedDomain("communications");
    if (scenario === "capability-detail") { command.setSelectedDomain("research"); command.setSelectedCapability("claim-verification"); }
  }, []);
  useEffect(() => {
    const observer = new MutationObserver(() => { if (document.querySelector(".agent-role-row, .olympus-armory")) { setCatalogReady(true); observer.disconnect(); } });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (catalogReady) void markVisualReady(); }, [catalogReady]);

  return <><BackgroundLayer /><main className="app-shell mode-command" data-chat-layout={layout}><div className="panel-slot panel-slot-header"><HeaderBar mode="command" onSelectMode={() => {}} projects={projects} /></div>
    <div className="dashboard-body"><section className="main-grid">
      <aside className="tools-rail dashboard-column panel-shell surface-chrome" aria-label="Global icon rail">{[Layers, MessageSquare, BookOpen, Network].map((Icon, i) => <span key={i} style={{ padding: "12px 8px", color: "#a9b7c5" }}><Icon size={17} /></span>)}</aside>
      {flagship ? <OlympusArmory capabilities={capabilities} missions={missions} preview selectedAgent={command.agent} onSelectAgent={command.selectAgent} onDestination={destination=>setDestination(destination==="project"?{projects:true}:{})}/> : <CommandAgentCatalog key={key} client={client} available selectedId={command.agent} onSelect={command.selectAgent}
        onResearch={runId => setDestination({ runId })} onProjects={() => setDestination({ projects: true })}
        capabilities={capabilities} working={command.focus.agents} orchestrating={command.focus.running} selectedCapability={command.selectedCapability} onSelectCapability={command.setSelectedCapability} />}
      <section className="center-stack dashboard-column"><div className="panel-slot panel-slot-instrument">
        <CommandInstrument visualState={params.get("voice")==="speaking"?"speaking":params.get("voice")==="listening"?"listening":undefined} voiceLevel={Number(params.get("level")??0)} flagship={flagship} onProjects={()=>setDestination({projects:true})} projects={projects} capabilities={capabilities} view={command.view} light={command.light} activeDomains={command.activeDomains}
          missionOperation={command.missionOperation} working={command.working} selectedDomain={command.selectedDomain} selectedCapability={command.selectedCapability}
          onHoverDomain={command.setHoverDomain} onSelectDomain={command.setSelectedDomain} onSelectCapability={command.setSelectedCapability} />
      </div></section>
      <section className="right-stack dashboard-column"><div className="panel-slot panel-slot-chat">
        <ChatPanel companion={flagship} inspectionProjects={["fixture-repo"]} messages={messages} autoSpeak={false} onAutoSpeakChange={() => {}} onOpenPreferences={() => {}} onSendMessage={() => { mutations++; }} onRecordObservation={async () => { mutations++; return { tone: "error", message: "Fixture only" }; }}
          layout={layout} onLayoutChange={setLayout} mission={command.mission} capabilities={capabilities} suggestions={flagship?suggestions.slice(0,3):suggestions}
          onOpenMission={destination => setDestination(destination === "research" ? {} : { projects: true })} onDismissMission={command.dismissMission} />
      </div></section>
    </section></div>
    {!params.has("scenario") && <div className="command-fixture-controls"><span>SYNTHETIC · no live observations</span><label>Fixture <select aria-label="Agent catalog fixture" defaultValue="empty" onChange={e => { catalogScenario = e.target.value; setKey(n => n + 1); }}>{["empty", "history", "unavailable", "six", "error"].map(s => <option key={s}>{s}</option>)}</select></label>
      <button onClick={() => { reduced = !reduced; listeners.forEach(f => f()); }}>Toggle reduced motion</button>
      <label>Scenario <select aria-label="Visual scenario" value={scenario} onChange={e => { location.search = `?scenario=${e.target.value}`; }}>{Object.keys(SCENARIOS).map(s => <option key={s}>{s}</option>)}</select></label>
      <details><summary>Test results</summary><pre id="result">Manual visual study</pre></details></div>}
    {destination && <section className="command-fixture-inspector" aria-label="Existing inspection destination">{destination.projects ? <><button onClick={() => setDestination(null)}>Return to Command catalog</button><p>Project destination · fixture only</p></> :
      <ResearchVerification client={readOnlyResearch} available requestedRunId={destination.runId} inspectionOnly onReturn={() => setDestination(null)} />}</section>}
  </main><style>{`.command-fixture-controls{position:fixed;left:18px;bottom:3px;right:18px;display:flex;align-items:center;gap:14px;font:9px monospace;z-index:30;color:#acbacb}.command-fixture-controls button,.command-fixture-controls select{font:9px monospace;background:#10202d;color:#bdcbd8;border:1px solid #64798c55;padding:2px 5px}.command-fixture-controls details{margin-left:auto}.command-fixture-controls pre{position:absolute;bottom:20px;right:0;max-height:55vh;max-width:80vw;overflow:auto;white-space:pre-wrap;background:#07121e;padding:14px;border:1px solid #526479}.command-fixture-inspector{position:fixed;inset:90px 20px 35px;overflow:auto;z-index:40;background:#0a1522;border:1px solid #64798c;padding:15px}`}</style></>;
}

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
/** Sets `data-visual-ready` once the scenario is genuinely painted; never on a timer alone. */
async function markVisualReady() {
  await document.fonts.ready;
  const deadline = performance.now() + 20_000;
  // The instrument is painted when the WebGL scene reports ready, or when the flat fallback is in place.
  while (performance.now() < deadline) {
    const instrument = document.querySelector<HTMLElement>(".command-instrument");
    if (instrument && (instrument.dataset.sceneReady === "true" || document.querySelector(".hybrid-status"))) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Finite transitions and entrance animations settle; ambient infinite ones are expected.
  while (performance.now() < deadline && document.getAnimations().some(animation => animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== Infinity)) await frame();
  await frame(); await frame();
  document.documentElement.dataset.visualRenderer = document.querySelector<HTMLElement>(".command-instrument")?.dataset.renderer ?? "none";
  document.documentElement.dataset.visualReady = scenario;
}

createRoot(document.getElementById("root")!).render(<Harness />);
const wait = (ms = 180) => new Promise(r => setTimeout(r, ms));
async function checks() {
  const results: string[] = []; const check = (condition: unknown, label: string) => { if (!condition) throw Error(label); results.push(label); };
  const query = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
  const click = (text: string, root: ParentNode = document) => { const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes(text)); if (!button) throw Error("Missing " + text); button.click(); };
  const fixture = async (value: string) => { const input = query<HTMLSelectElement>('[aria-label="Agent catalog fixture"]'); input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); await wait(); };
  const detail = () => query(".agent-selected-detail")?.textContent ?? "";
  const rect = (selector: string) => query(selector).getBoundingClientRect();
  const layoutChecks = () => {
    const catalog = rect(".command-agent-catalog"), dial = rect(".command-instrument__dial"), right = rect(".right-stack"), chat = rect(".command-console"), rail = rect(".tools-rail");
    check(rail.right <= catalog.left && catalog.right <= dial.left + 2 && dial.right <= right.left + 2, "Rail → catalog → instrument → chat do not overlap");
    check(chat.left >= right.left - 1 && chat.right <= right.right + 1 && chat.top >= right.top - 1 && chat.bottom <= right.bottom + 1, "Chat stays within its reserved column");
    const center = rect(".center-stack"); check(Math.abs((dial.left + dial.right) / 2 - (center.left + center.right) / 2) < 8, "Instrument remains centered in the middle zone");
  };
  const ringNames = () => [...document.querySelectorAll(".capability-ring__name")].map(node => node.textContent ?? "");
  try {
    await wait(800); for (let i = 0; i < 80 && !document.querySelector('[data-scene-ready="true"]'); i++) await wait(100);
    check(document.querySelector('[data-scene-ready="true"]'), "Existing hybrid instrument initializes");
    check(runCapabilitiesHarness().passed, "Capability projection derivations pass");
    check(query(".command-agent-catalog").textContent?.includes("1 orchestrator · 3 agents"), "Count excludes the separate orchestrator");
    check(document.querySelectorAll(".agent-role-row").length === 4, "Only Olympus and three real role fixtures appear");
    check(!query(".command-agent-catalog").textContent?.match(/Research Analyst|Project Architect|Daily Briefing|Obsidian Curator|Strategy General|Project Soldier/), "No documentary candidates enter the operational HUD");
    check(detail().includes("Main orchestrator") && !detail().includes("Full system"), "Olympus has bounded real orchestration authority");
    check(Boolean(query(".console-inspect-project")), "Read-only project inspection is discoverable in the console");
    // The ring is capability, not projects.
    check(document.querySelectorAll(".capability-ring__hit").length === capabilities.domains.length, "One ring sector per capability domain");
    check(!ringNames().some(name => projects.some(project => name.toUpperCase().includes(project.name.toUpperCase()))), "No project names on the Command ring");
    check(!document.querySelector(".capability-node"), "Idle aggregate armory reveals no individual capabilities");
    check(detail().includes(`${capabilities.tools.length} · the full armory`), "Olympus Core shows the aggregate armory count from the projection");
    layoutChecks(); const baseline = rect(".command-instrument__dial");
    click("Research Agent"); await wait();
    check(detail().includes("Research Retrieval") && detail().includes("Evidence Synthesis") && detail().includes("No recorded executions yet"), "Research shows real skills, scope, version and empty history");
    const lens = [...document.querySelectorAll<HTMLElement>(".capability-node")].map(node => node.dataset.capability).sort();
    check(JSON.stringify(lens) === JSON.stringify(["evidence-synthesis", "model-primary", "pantheon", "research-retrieval"]), "Research lens reveals exactly its contract's Tools and Skills");
    click("Verification Agent"); await wait();
    check(detail().includes("Claim Verification") && detail().includes("Research Agent"), "Verification has its separate skill and declared peer");
    check([...document.querySelectorAll<HTMLElement>(".capability-node")].map(n => n.dataset.capability).sort().join() === "claim-verification,model-primary,pantheon", "Verification lens matches its contract");
    click("Coding Delegate"); await wait();
    check(detail().includes("Legacy / unversioned") && detail().includes("UNPROVEN") && detail().includes("No completed Olympus delegation runs"), "Coding stays unversioned and unproven");
    check(query('.capability-node[data-capability="claude-code"]')?.getAttribute("data-state") === "unavailable", "An unavailable executor is drawn unavailable, not ready");
    click("Olympus Core"); await wait();
    check(!document.querySelector(".capability-node"), "Olympus Core restores the aggregate view");
    query<SVGElement>('.capability-ring__hit[data-domain="communications"]').dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait();
    check(document.querySelectorAll(".capability-node").length === 5, "Selecting a domain reveals its Tools and Skills");
    query<SVGElement>('.capability-node[data-capability="communication-assess"] .capability-node__hit').dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait();
    check(query(".capability-detail")?.textContent?.includes("Communication Assessment") && query(".capability-detail")?.textContent?.includes("Inspection only"), "Capability detail opens in the catalog, not over the core");
    click("Olympus Core", query(".capability-detail")); await wait();
    await fixture("unavailable"); click("Research Agent"); await wait();
    check(detail().includes("UNAVAILABLE") && detail().includes("Synthetic missing credentials"), "Missing dependencies cannot display ready");
    await fixture("history"); click("Research Agent"); await wait();
    check(detail().includes("2 executions") && document.querySelectorAll(".agent-recent-runs button").length === 2, "Persisted child execution count and saved history are displayed");
    query<HTMLButtonElement>(".agent-recent-runs button").click(); await wait();
    check(query<HTMLSelectElement>('.command-fixture-inspector [aria-label="Saved research runs"]').value === "parent" && query(".command-fixture-inspector").textContent?.includes("Research Verification · inspection"), "Recent execution opens its parent run in existing inspector");
    check(!document.querySelector(".command-fixture-inspector form") && !query(".command-fixture-inspector").textContent?.includes("Cancel this run"), "Deep-linked inspection exposes no execution controls"); click("Return to Command catalog"); await wait();
    await fixture("six"); check(document.querySelectorAll(".agent-role-row").length === 8 && query(".agent-catalog-list").scrollHeight > query(".agent-catalog-list").clientHeight, "Future executable fixtures scroll vertically without fixed slots");
    await fixture("error"); check(!document.querySelector(".agent-status") && query(".command-agent-catalog").textContent?.includes("Agent catalog could not be read from the local database") && Boolean(query(".agent-catalog-error button")), "Read failure removes stale ready claims");
    await fixture("empty"); click("Olympus Core"); await wait();
    query<HTMLButtonElement>('.agent-detail-tabs [role="tab"]:nth-child(3)').click(); await wait();
    check(query('.agent-tab-content').textContent?.includes("Gmail"), "Tools tab exposes actual tool bindings");
    query<HTMLButtonElement>('.agent-detail-tabs [role="tab"]:nth-child(4)').click(); await wait();
    check(query('.agent-tab-content').textContent?.includes("Authority"), "Policies tab retains backend authority");
    query<HTMLButtonElement>('.agent-detail-tabs [role="tab"]:nth-child(1)').click(); await wait();
    query<SVGElement>('[aria-label="Open Project workspace"]').dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await wait();
    check(query('.command-fixture-inspector').textContent?.includes("Project destination"), "Project orbital shortcut navigates without executing");
    click("Return to Command catalog");await wait();
    // Chat: expanded workspace by default in Command, compact on request.
    check(query(".command-console").dataset.layout === "expanded" && query(".console-idle"), "Command opens with the expanded chat workspace in its ready state");
    layoutChecks();
    const suggestion = query<HTMLButtonElement>(".console-suggestion"); suggestion?.click(); await wait();
    check(query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').value.length > 0 && mutations === 0, "A suggestion fills the composer and sends nothing");
    query<HTMLButtonElement>('[aria-label="Compact console"]').click(); await wait(400);
    check(query(".command-console").dataset.layout === "compact" && query(".command-console").dataset.mode === "dormant", "Compact console returns to the anchored command bar");
    // A scripted click does not take focus the way a pointer does; release the composer the suggestion focused.
    query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').blur();
    query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').focus(); await wait(500); check(query(".command-console").dataset.mode === "engaged", "Compact console opens upward"); layoutChecks();
    query<HTMLButtonElement>('[aria-label="Open conversation history"]').click(); await wait(500); check(query(".command-console").dataset.mode === "transcript", "Full history expansion uses the right reserve"); layoutChecks();
    check(Math.abs(rect(".command-instrument__dial").width - baseline.width) < 1, "Chat expansion does not resize instrument geometry");
    query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait();
    query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait();
    check(query(".command-console").dataset.mode === "dormant", "Collapsed console returns to bottom-right compact state");
    query<HTMLButtonElement>('[aria-label="Expand conversation"]').click(); await wait(400);
    check(query(".command-console").dataset.layout === "expanded", "Expanding restores the workspace without losing state");
    click("Toggle reduced motion"); await wait(900); const canvas = query<HTMLCanvasElement>(".hybrid-core canvas"), frames = canvas.dataset.frames; await wait(700); check(canvas.dataset.frames === frames, "Reduced motion freezes the existing GPU instrument");
    check([...document.querySelectorAll(".command-agent-catalog *")].every(el => getComputedStyle(el).animationName === "none"), "Catalog introduces no ambient animation");
    check(runProjectRingHarness().passed, "Project-ring layout checks still pass (the note field's placement)");
    check(runGlyphStateHarness().passed, "Existing glyph-state checks pass");
    check(runAmbientMotionHarness().passed, "Existing ambient-motion checks pass");
    const allowed = new Set(["acceptance_profile", "fetch_vault_graph", "fetch_recent_vault_writes", "fetch_operator_profile", "model_routes", "plugin:event|listen", "plugin:event|unlisten"]);
    check(invoked.every(command => allowed.has(command)), `Inspection invoked no capability (${[...new Set(invoked)].join(", ")})`);
    check(mutations === 0 && reads > 0, "Catalog selection, refresh, lenses and cross-links perform reads only");
    check(document.documentElement.scrollWidth <= innerWidth + 2, "Desktop composition has no horizontal overflow");
    query("#result").textContent = results.map(r => "PASS " + r).join("\n") + `\n${results.length} Command/catalog checks passed`;
  } catch (e) { query("#result").textContent = results.map(r => "PASS " + r).join("\n") + "\nFAIL " + String(e); }
}
if (params.has("check")) void checks();

async function inspectionChecks(){
 await wait(800);
 try{
  const menu=document.querySelector<HTMLDetailsElement>(".console-inspect-project")!;menu.open=true;
  const select=document.querySelector<HTMLSelectElement>('[aria-label="Inspect a project read-only"]')!;
  select.value="fixture-repo";select.dispatchEvent(new Event("change",{bubbles:true}));await wait();
  if(!document.querySelector<HTMLTextAreaElement>("#olympus-console-input")!.value.startsWith("/inspect fixture-repo:"))throw Error("Missing scoped draft");
  if(mutations!==0)throw Error("Selection executed an action");
  if(document.querySelector('[placeholder="Something Olympus should know about how you work."]'))throw Error("Opened observation writer");
  document.getElementById("result")!.textContent="PASS scoped draft; no send; no memory writer";
 }catch(error){document.getElementById("result")!.textContent="FAIL "+String(error);}
}
if(params.has("inspect-check"))void inspectionChecks();
