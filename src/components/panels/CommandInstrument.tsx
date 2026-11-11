import {PANTHEON_FIGURES} from "../../services/pantheonFigureState";
import { openProject } from "../../services/navigation";
import { inspectArmoryCapability } from "../../services/armoryNavigation";
import { inspectConstellationAgent } from "../../services/agentConstellation";
import { openVaultNote } from "../../services/launcher";
import type { GalaxyAsset } from "../../services/pantheonGalaxy";
import { InstrumentActivity } from "./InstrumentActivity";
import { activityMissions, agentEventsSnapshot, subscribeAgentEvents } from "../../services/agentEvents";
import { selectConversationProvider, useConversationProvider } from "../../services/conversationProvider";
import "./engineSwitch.css";
import { CodeXml } from "lucide-react";
import { siClaude } from "simple-icons";
import { MissionTargets } from "./PantheonMissions";
import { PantheonFigures } from "./PantheonFigures";
import { SkillsConstellation } from "./SkillsConstellation";
import type { Mission } from "../../services/capabilities";
import "./pantheonMissions.css";
import { ArmoryConstellation } from "./ArmoryConstellation";
import { OlympusVoiceDock } from "./OlympusVoiceDock";
import { omegaVoiceEnergy } from "../../services/voiceSignal";
import type {VoiceSnapshot} from "../../services/realtimeVoice";
import { HybridCommandCore } from "./HybridCommandCore";
import { OrbitalAtmosphere } from "./OrbitalAtmosphere";
import { commandLayout } from "../../services/hybridCore";
import { useAmbientMotion } from "../../hooks/useAmbientMotion";
import { useSceneParallax } from "../../hooks/useSceneParallax";
import { AMBIENT, ambientVariables } from "../../services/ambientMotion";
import type { OlympusVisualState } from "../../services/ambientMotion";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { useOperatorProfile } from "../../hooks/useOperatorProfile";
import { useVaultGraph } from "../../hooks/useVaultGraph";
import { useVaultWrites } from "../../hooks/useVaultWrites";
import {
  glyphStateFor
} from "../../services/glyphState";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import type { InstrumentEvent } from "../../services/instrumentEvents";
import { PROJECT_RING_RADIUS } from "../../services/projectRing";
import type { TrackedProject } from "../../types";
import type { ModelCapability } from "../../services/modelRouting";
import { routeName } from "../../services/routeLabel";
import type { ArmoryView, CapabilitySnapshot } from "../../services/capabilities";
import { DayArc } from "./DayArc";
import { CapabilityRing } from "./CapabilityRing";
import "./command.css";
import "./commandArmory.css";
import "./commandReference.css";

interface CommandInstrumentProps {
  missions?: Mission[];
  selectedMission?: string | null;
  onSelectMission?: (id:string)=>void;
  flagship?: boolean;
  onProjects?: () => void;
  domainActions?: Partial<Record<string, () => void>>;
  active?: boolean;
  visualState?: OlympusVisualState;
  voiceLevel?: number;
  voiceSnapshot?:VoiceSnapshot;
  onSpokenRepliesToggle?:()=>void;
  spokenReplies?:boolean;
  voiceReady?:boolean;
  /** Only the ambient note field's placement; Command draws no project names. */
  projects: TrackedProject[];
  /** The armory; null while it is read or when it is unavailable. */
  capabilities: CapabilitySnapshot | null;
  capabilitiesError?: string | null;
  view: ArmoryView | null;
  /** Per-domain glow for the WebGL ring (0..1). */
  light: Readonly<Record<string, number>>;
  /** Domains a recorded mission step is using now; drives the working theater. */
  activeDomains: readonly string[];
  /** Increments when a recorded mission step completes: one pulse, never a timer. */
  missionOperation?: number;
  working?: boolean;
  selectedDomain: string | null;
  selectedCapability: string | null;
  onHoverDomain: (id: string | null) => void;
  onSelectDomain: (id: string | null) => void;
  onSelectCapability: (id: string) => void;
  /** Browser preview draws synthetic capabilities and says so. */
  previewLabel?: string | null;
  /** A chat request is in flight. Drives the glyph's thinking state. */
  assistantPending?: boolean;
  /** Response text is arriving. Drives the glyph's speaking state. */
  assistantProducing?: boolean;
  /**
   * The model that answered the last turn, from the API response rather than
   * from any local constant. Null before the first reply of the session.
   */
  assistantModel?: string | null;
  /**
   * The model that declined, when a mid-turn fallback changed who answered.
   * Renders as a transition beside the current model rather than replacing it.
   */
  assistantFellBackFrom?: string | null;
  /** The route of the current or last turn, for a human label (review D3). */
  assistantCapability?: ModelCapability | null;
}

/**
 * Viewbox is square and fixed; CSS decides how large it actually draws.
 *
 * Radius means distance from active work, outermost first: the day arc, the
 * capability ring, revealed Tools and Skills with the ambient note field, then
 * the glyph. The viewbox and omega metrics are unchanged from the project ring.
 */
const SIZE = 440;
const CENTRE = SIZE / 2;
const DAY_RADIUS = 205;

/**
 * How long each pulse stays mounted.
 *
 * A vault write plays twice. A newly linked graph node uses the same outward
 * vocabulary once: confirmation that the five-minute scan actually landed.
 */
const PULSE_MS: Record<InstrumentEvent, number> = {
  "vault-write": 2800,
  "graph-node": 1400,
  poll: 700,
  "command-received": 700,
  "response-start": 1400
};

const RIPPLE_SECONDS = 1.4;

/**
 * Command mode's whole centre column: the Ω and the armory Olympus can
 * assemble. Projects live in Project mode; nothing here is project navigation.
 */
export function CommandInstrument({
  missions = [], selectedMission = null, onSelectMission,
  flagship = false,
  projects,
  onProjects,
  domainActions,
  capabilities,
  capabilitiesError = null,
  view,
  light,
  activeDomains,
  missionOperation = 0,
  working = false,
  selectedDomain,
  selectedCapability,
  onHoverDomain,
  onSelectDomain,
  onSelectCapability,
  previewLabel = null,
  active = true,
  visualState,
  voiceLevel = 0,
  voiceSnapshot, onSpokenRepliesToggle, spokenReplies=false, voiceReady=false,
  assistantPending = false,
  assistantProducing = false,
  assistantModel = null,
  assistantFellBackFrom = null,
  assistantCapability = null
}: CommandInstrumentProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState<InstrumentEvent | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [renderScale, setRenderScale] = useState(1);
  const profile = useOperatorProfile();
  const { writes } = useVaultWrites();
  const { graph, error: vaultGraphError, loading: vaultGraphLoading } = useVaultGraph();
  const [renderAttempt, setRenderAttempt] = useState(0);
  // Runs seen on the agent event stream move the figures without becoming orbiting missions.
  const agentEvents = useSyncExternalStore(subscribeAgentEvents, agentEventsSnapshot);
  const observedRuns = useMemo(() => activityMissions(agentEvents), [agentEvents]);
  const figureMissions = useMemo(() => observedRuns.length ? [...missions, ...observedRuns] : missions, [missions, observedRuns]);
  const [hybridReady, setHybridReady] = useState(false);
  const [hybridError, setHybridError] = useState<string | null>(null);
  // The WebGL scene starts the first time Command is shown, not at launch:
  // opening Olympus in Research must not pay for it (review F5). Until it is
  // ready, and whenever it fails, the SVG instrument is the whole instrument.
  const [sceneWanted, setSceneWanted] = useState(active);
  useEffect(() => { if (active) setSceneWanted(true); }, [active]);
  const sceneShown = hybridReady && !hybridError;
  const domains = capabilities?.domains ?? [];
  const layout = useMemo(() => commandLayout(domains, projects, graph, renderScale), [domains, projects, graph, renderScale]);
  const readout = capabilities ? undefined : capabilitiesError ? ["ARMORY UNAVAILABLE"] : ["READING ARMORY…"];

  const commits = projects.flatMap((project) =>
    (project.recentCommits ?? []).map((commit) => ({ ...commit, project: project.name }))
  );
  // Both flags come from the same request state as the chat panel, so the line,
  // the panel and the omega cannot disagree. Because the state is *derived*
  // rather than scheduled, an error or a cancellation that clears them settles
  // back to idle through the same transition as a normal completion, and no
  // animation can be left running.
  const glyphState = visualState === "speaking" ? "speaking" : visualState === "thinking" ? "thinking" : visualState ? "idle" : glyphStateFor({
    pending: assistantPending,
    producing: assistantProducing
  });
  // Precise names (review D6): audio is "speaking", arriving text is
  // "responding", a live microphone is "listening".
  const activity = visualState === "speaking" ? "speaking"
    : visualState === "listening" ? "listening"
    : glyphState === "speaking" ? "responding"
    : glyphState === "thinking" ? "thinking" : null;

  const [completionSettled, setCompletionSettled] = useState(false);
  useEffect(() => {
    setCompletionSettled(false);
    if (visualState !== "complete") return;
    const timer = window.setTimeout(() => setCompletionSettled(true), AMBIENT.nodePulse * 1000);
    return () => window.clearTimeout(timer);
  }, [visualState]);
  const execution = useMemo(() => ({ operation: missionOperation }), [missionOperation]);
  // A recorded mission step animates the instrument only when nothing more
  // immediate (voice, a reply in flight, an error) owns it.
  const baseState = visualState ?? (glyphState === "idle" && working ? "executing" : glyphState);
  const ambientState = baseState === "complete" && completionSettled ? "idle" : baseState;
  const ambient = useAmbientMotion(ambientState, active);
  const instrumentParallax = useSceneParallax(active && ambient.running, "instrument");

  // Identity first, then activity: the model is the stable half and must not
  // move when the transient half appears beside it.
  //
  // A fallback renders as `from → to` rather than swapping the value in place.
  // Both models genuinely answered part of the turn, and a readout that quietly
  // changed would be the invisible-wrongness this line exists to prevent — the
  // arrow is the visible transition. It clears on the next turn.
  const identity = assistantModel
    ? `${routeName(assistantCapability) === "Model" ? assistantModel : routeName(assistantCapability)}${assistantFellBackFrom ? " · fallback" : ""}`
    : null;
  // The exact model stays one hover away; the readout carries the route.
  const identityTitle = assistantFellBackFrom ? `${assistantFellBackFrom} → ${assistantModel ?? "?"}` : assistantModel ?? undefined;

  // The armory's size, from the projection; nothing renders before it arrives.
  const [ringDetail, setRingDetail] = useState<string | null>(null);
  const armory = ringDetail ?? (capabilities ? `${capabilities.agents.length - 1} agents · ${capabilities.tools.length} tools · ${capabilities.skills.length} skills` : null);
  const statusParts = [identity, activity ?? (working ? "working" : null)].filter((part): part is string => Boolean(part));

  useLayoutEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;

    const measure = () => {
      const next = dial.getBoundingClientRect().width / SIZE;
      if (next <= 0) return;
      setRenderScale((current) => (Math.abs(current - next) < 0.001 ? current : next));
    };
    measure();
    // A window drag reports every pixel; the 3D scene rebuilds its label
    // atlas for a new scale, so only the size the drag settles on counts.
    let settle: number | undefined;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(settle);
      settle = window.setTimeout(measure, 150);
    });
    observer.observe(dial);
    return () => { observer.disconnect(); window.clearTimeout(settle); };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = subscribeToInstrumentEvents((event) => {
      setPulse(event);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulse(null), PULSE_MS[event]);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let clock: number | undefined;
    const visibilityChanged = () => {
      window.clearInterval(clock);
      if (document.visibilityState !== "visible" || !active) return;
      setNow(Date.now());
      clock = window.setInterval(() => setNow(Date.now()), 10_000);
    };
    visibilityChanged();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { window.clearInterval(clock); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [active]);

  const engine = useConversationProvider();
  const galaxyAssets=useMemo(()=>[
    ...projects.map(p=>({id:"project:"+p.id,label:p.name})),
    ...graph.nodes.map(n=>({id:"note:"+n.id,label:n.title})),
    ...(capabilities?.agents??[]).map(a=>({id:"agent:"+a.id,label:PANTHEON_FIGURES.find(f=>f.agent===a.id)?.name??a.id})),
    ...(capabilities?.skills??[]).map(s=>({id:"skill:"+s.id,label:s.name})),
    {id:"actor:Project Change Review",label:"Project Change Review"},
  ],[projects,graph.nodes,capabilities]);
  const [asset,setAsset]=useState<GalaxyAsset|null>(null);
  const [assetError,setAssetError]=useState("");
  useEffect(()=>{
    const inspect=(e:Event)=>{setAsset((e as CustomEvent<GalaxyAsset>).detail);setAssetError("");};
    window.addEventListener("olympus:inspect-asset",inspect);
    return ()=>window.removeEventListener("olympus:inspect-asset",inspect);
  },[]);
  return (
    <div className="command-instrument" data-engine={engine??undefined} data-flagship={flagship || undefined} data-visual-state={ambientState} data-voice-energy={voiceLevel > 0.15 ? "active" : "quiet"}
      data-motion={ambient.running ? "running" : "paused"} data-renderer={sceneShown ? "hybrid" : "svg"} data-scene-ready={sceneShown}
      data-armory={capabilities ? "ready" : capabilitiesError ? "unavailable" : "loading"} data-working={working || undefined}
      style={{ ...ambientVariables, "--ambient-drift": `${2 / renderScale}px` } as CSSProperties}>
      {flagship && <div className="instrument-engine" role="group" aria-label="Conversation engine">
        {(["claude-code", "codex"] as const).map(id => <button key={id} type="button" data-engine={id}
          title="Select for the next eligible request. Subscription generation is currently gated." aria-pressed={engine === id} onClick={() => selectConversationProvider(id)}>
          {id === "codex" ? <CodeXml aria-hidden="true"/> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d={siClaude.path}/></svg>}
          <span>{id === "codex" ? "Codex" : "Claude Code"}</span>
        </button>)}
      </div>}
      {flagship && <InstrumentActivity vaultStatus={vaultGraphError ? (graph.nodes.length ? "Showing last vault snapshot" : "Vault unavailable") : vaultGraphLoading ? "Loading vault notes" : graph.nodes.length+" vault notes in the sphere"} missions={missions} assets={galaxyAssets} onInspect={setAsset}/>}
      {flagship && asset && <aside className="asset-inspection" aria-live="polite"><strong>{asset.label}</strong><small>{asset.id}</small>
        {asset.id.startsWith("note:") && <button onClick={()=>void openVaultNote(asset.id.slice(5)).then(result=>setAssetError(result==="unsupported"?"Open notes from the desktop app.":"")).catch(()=>setAssetError("Could not open the note."))}>Open note</button>}
        {asset.id.startsWith("project:") && <button onClick={()=>openProject(asset.id.slice(8))}>Open project</button>}
        {asset.id.startsWith("agent:") && <button onClick={()=>inspectConstellationAgent(asset.id.slice(6))}>Inspect agent</button>}
        {asset.id.startsWith("skill:") && <button onClick={()=>{const skill=capabilities?.skills.find(s=>s.id===asset.id.slice(6));if(skill)inspectArmoryCapability(skill);}}>Inspect skill</button>}
        {(asset.id==="actor:Project Change Review" || (asset.id.startsWith("source:") && asset.label.endsWith(" · Git HEAD"))) && <button onClick={()=>window.dispatchEvent(new Event("olympus:open-review"))}>Open Project Change Review</button>}
        {assetError && <small>{assetError}</small>} <button onClick={()=>setAsset(null)}>Close</button></aside>}
      <motion.div className="command-instrument__dial" ref={dialRef} style={instrumentParallax}>
        <div className="command-orbital-atmosphere" aria-hidden="true"/>
        {flagship && <div className="engine-core-tint" aria-hidden="true" />}
        {flagship && <><ArmoryConstellation capabilities={capabilities??null}/><SkillsConstellation capabilities={capabilities}/></>}
        {flagship && <MissionTargets missions={missions} selected={selectedMission} onSelect={onSelectMission} fallback={!sceneShown}/>}
        {flagship && <PantheonFigures missions={figureMissions}/>}
        {/* Unmounted on failure so its GPU resources, listeners and timers go
            with it; Retry mounts a fresh one. */}
        {sceneWanted && !hybridError && <HybridCommandCore assets={galaxyAssets} engine={engine} key={renderAttempt} layout={{...layout, orbitalCards: true, flagship}} state={ambientState} voiceLevel={voiceLevel} voiceEnergy={voiceSnapshot?.muted ? undefined : omegaVoiceEnergy} execution={execution}
          missions={missions} activity={observedRuns} selectedMission={selectedMission} running={active && ambient.running} light={light} activeDomains={activeDomains}
          onReady={setHybridReady} onError={setHybridError} />}
        <svg
          style={{ transformOrigin: "50% 50%" }}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={`command-instrument__svg ${pulse ? `is-pulsing pulse-${pulse}` : ""}`}
          role="group"
          aria-label="Olympus capability instrument"
          data-render-scale={renderScale.toFixed(3)}
        >
          {/* The flat instrument's glyph; the 3D core replaces it once drawn. */}
          <text x={CENTRE} y={CENTRE + 30} className="command-instrument__fallback-omega" textAnchor="middle" aria-hidden="true">Ω</text>
          <OrbitalAtmosphere />
          {!flagship && <DayArc
            centre={CENTRE}
            radius={DAY_RADIUS}
            now={new Date(now)}
            quietHours={profile?.quietHours ?? null}
            commits={commits}
            writes={writes}
            reducedMotion={!ambient.running}
            renderScale={renderScale}
          />}

          {!flagship && <CapabilityRing
            onProjects={onProjects}
            domainActions={domainActions}
            layout={layout}
            domains={domains}
            view={view ?? { domains: {}, revealed: [], states: {} }}
            centre={CENTRE}
            radius={PROJECT_RING_RADIUS}
            renderScale={renderScale}
            selectedDomain={selectedDomain}
            selectedCapability={selectedCapability}
            working={working}
            idleReadout={readout}
            onDetail={setRingDetail}
            onHoverDomain={onHoverDomain}
            onSelectDomain={onSelectDomain}
            onSelectCapability={onSelectCapability}
          />}

          {(pulse === "vault-write" || pulse === "graph-node" || pulse === "response-start") && ambient.running ? (
            <motion.circle
              cx={CENTRE}
              cy={CENTRE}
              r={PROJECT_RING_RADIUS + 14}
              fill="none"
              stroke="#d97706"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0.7, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.08 }}
              transition={{
                duration: RIPPLE_SECONDS,
                ease: "easeOut",
                repeat: pulse === "vault-write" ? 1 : 0
              }}
              style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
            />
          ) : null}

        </svg>
      </motion.div>

      {/* Olympus's voice beneath the Omega. Its waveform reads real audio per
          frame from voiceSignal; React only passes the voice state. */}
      {flagship && <OlympusVoiceDock voice={voiceSnapshot} spokenReplies={spokenReplies} onToggle={onSpokenRepliesToggle} ready={voiceReady} assistantPending={assistantPending} active={active} />}
      {!flagship && previewLabel && <p className="command-instrument__preview" role="note">{previewLabel}</p>}
      {hybridError && <div className="hybrid-status" role="status">
        <span>3D view unavailable · showing the flat instrument.</span>
        <button type="button" className="ghost-action" onClick={() => { setHybridError(null); setHybridReady(false); setRenderAttempt(n => n + 1); }}>Retry 3D view</button>
        <details><summary>Technical detail</summary><span>{hybridError}</span></details>
      </div>}
      {!flagship && armory && statusParts.length === 0 && <p className="command-instrument__status command-instrument__armory">{armory}</p>}
      {statusParts.length > 0 ? (
        <p className="command-instrument__status" title={identityTitle}>
          {statusParts.map((part, index) => (
            <span key={part}>
              {index > 0 ? <span className="command-instrument__status-sep"> · </span> : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
