import { isBrief, matchChatHandoff, operationReply, runOperation } from "../services/skillRuns";
import { invoke } from "@tauri-apps/api/core";
import {nativeBriefingScopeBarrier} from "../services/briefingScope";
import {feedbackForBrief,resolveConversationTurn} from "../services/conversationFeedback";
import { briefSaved } from "../services/displayedBrief";
import { matchSkillRequest } from "../services/executableSkills";
import { recordSourceAccess } from "../services/sourceActivity";
import { prepareSituationBriefing } from "../services/situationBriefing";
import {consumeNextModel,endChatModelScope} from "../services/modelRouting";
import {conversationChoiceSnapshot} from "../services/conversationProvider";
import { normalizeVoicePreferences, type VoicePreferences } from "../services/voicePreferences";
import { refreshActionQueue, useActionQueue } from "./useActionQueue";
import { refreshDelegationRuns, useDelegationRuns } from "./useDelegationRuns";
import { refreshPantheon } from "./usePantheon";
import { refreshVaultGraph } from "./useVaultGraph";
import { refreshVaultWrites } from "./useVaultWrites";
import { emitRefreshRequested } from "../services/navigation";
import { buildProjectCommandBoard } from "../services/projectCommandBoard";
import { composeOpeningBriefing } from "../services/openingBriefing";
import { prepareFactualBrief, prepareStableBrief, waitForBriefMail } from "../services/briefingDelivery";
import { BRIEFING_ID_PREFIX } from "../services/conversationHistory";
import type { ModelCapability } from "../services/modelRouting";
import type { VoiceDepth, VoiceAnswer, VoiceMessageMetadata } from "../services/voiceContract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conversationStream } from "../services/conversationStream";
import { fetchProjects } from "../services/liveData";
import {applyProjectMember,subscribeProjectMembers} from "../services/projectMembership";
import { isTauriRuntime } from "../services/launcher";
import { cancelAssistantReply, createAssistantMessage, requestAssistantReply } from "../services/assistant";
import { planTurnRelease } from "../services/glyphState";
import { emitInstrumentEvent } from "../services/instrumentEvents";
import { buildPantheonReply, createUserMessage } from "../services/pantheonChat";
import { appendConversationMessages, initialDashboardState, loadSession, persistPreferences } from "../services/storage";
import { deleteConversation, loadConversation, newChatSession, renameConversation, type ChatSession } from "../services/conversations";
import { beginOperatorSession } from "../services/session";
import type { OlympusState, SessionBoundary, TurnContext, ConversationMessage } from "../types";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error payload";
    }
  }

  return "Unknown error";
}

/**
 * Where the project scan stands (review U1). Surfaces render from this rather
 * than inferring from `projects.length`:
 *
 *  - `loading`: no scan has settled yet. Desktop `projects` is empty.
 *  - `ready`:   the last scan succeeded. An empty list means no projects.
 *  - `stale`:   a refresh failed after an earlier success. `projects` keeps the
 *               last genuine result; show `lastSuccessAt` and `error`.
 *  - `failed`:  no scan has ever succeeded this launch. `projects` is empty —
 *               nothing rather than fiction.
 *
 * `scanning` is true while a scan is in flight, including a Retry.
 */
export type ProjectScanStatus = "loading" | "ready" | "stale" | "failed";

export interface ProjectScanState {
  status: ProjectScanStatus;
  /** ISO time of the last successful scan this launch. */
  lastSuccessAt: string | null;
  error: string | null;
  scanning: boolean;
  /** ISO time of the failure behind `error`, for "Project scan failed 10:42". */
  failedAt?: string | null;
}

/**
 * The browser dev server has no scan. It shows the seed as demo data, and
 * `demoData` tells surfaces to label it as such.
 */
const DEMO_DATA = !isTauriRuntime();

export function useDashboardData() {
  const [dashboardState, setDashboardState] = useState<OlympusState>(initialDashboardState);
  const dashboardRef = useRef(dashboardState);
  dashboardRef.current = dashboardState;
  const updateVoicePreferences = useCallback((patch:Partial<VoicePreferences>) => {
    setDashboardState(current => ({...current, settings:{...current.settings,...normalizeVoicePreferences({...current.settings,...patch})}}));
  }, []);
  const taskStore = useActionQueue();
  const runStore = useDelegationRuns();
  const tasksReady = !taskStore.error && !taskStore.loading;
  const runsReady = !runStore.error && !runStore.loading;
  const commandBoard = useMemo(
    () => buildProjectCommandBoard(dashboardState.projects, taskStore.tasks, runStore.data, {tasks:tasksReady,runs:runsReady}),
    [dashboardState.projects, taskStore.tasks, runStore.data, tasksReady, runsReady]
  );
  const boardRef = useRef(commandBoard); boardRef.current = commandBoard;
  const [hydrated, setHydrated] = useState(false);
  /** Read inside `sendChatMessage`, which voice can call before a re-render. */
  const hydratedRef = useRef(false);
  const [sessionBoundary, setSessionBoundary] = useState<SessionBoundary | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [projectScan, setProjectScan] = useState<ProjectScanState>(() => DEMO_DATA
    ? { status: "ready", lastSuccessAt: null, error: null, scanning: false }
    : { status: "loading", lastSuccessAt: null, error: null, scanning: false });
  const projectsError = projectScan.error;
  const openingBriefed = useRef(false);
  const [openingBriefing, setOpeningBriefing] = useState<{ id: string; text: string } | null>(null);
  /** Problems with `01 - Projects` itself, which belong to no single project. */
  const [projectNoteWarnings, setProjectNoteWarnings] = useState<string[]>([]);
  const [chatPending, setChatPending] = useState(false);
  const [chatProgress, setChatProgress] = useState<string | null>(null);
  const activeRequest = useRef<string | null>(null);
  const turnCancelled = useRef(false);
  const cancelChat = useCallback(async () => {
    const id = activeRequest.current; if (!id) return;
    turnCancelled.current = true;
    try {
      const stopped = await cancelAssistantReply(id);
      if (activeRequest.current === id) setChatProgress(stopped ? "Stopping…" : "Turn is finishing; waiting for its result…");
    } catch { if (activeRequest.current === id) setChatProgress("Stop could not reach the backend. Try Stop again."); }
  }, []);
  const requestInFlight = useRef(false);
  const [chatError, setChatError] = useState<string | null>(null);
  /**
   * The model that answered the last turn, as reported by the API response.
   *
   * Not the Rust `MODEL` constant: the request carries a server-side fallback
   * header, so the constant is the model *asked for* and this is the model that
   * *replied*. If they ever diverge, reading the constant would be wrong
   * invisibly. Null until a turn has landed this session — nothing has answered
   * yet, and naming a model before one has is the same invisible-wrongness in a
   * smaller form. Session state, deliberately not persisted.
   */
  const [chatModel, setChatModel] = useState<string | null>(null);
  /**
   * Response text is arriving. Drives the omega's speaking state.
   *
   * Set on the **first delta**, not on the response envelope: the envelope
   * arrives before any text exists, so deriving this from it would make speaking
   * start the instant thinking did and the two states would never be
   * distinguishable. Cleared on the same path as `chatPending`.
   */
  const [chatProducing, setChatProducing] = useState(false);
  /**
   * When speaking began, so the floor can be measured from it.
   *
   * A ref rather than state: it is read inside the request's own closure at
   * completion, and making it state would re-run the send callback mid-turn.
   */
  const speakingStartedAt = useRef<number | null>(null);
  /** The pending floor timer, so a new turn can cancel a stale one. */
  const speakingHoldTimer = useRef<number | undefined>(undefined);
  /**
   * The model that declined, when a mid-turn fallback changed who was answering.
   *
   * Kept separate from `chatModel` so the readout can show the *transition*
   * rather than silently swapping one value for another — a value that changes
   * quietly is the invisible-wrongness problem the readout exists to prevent.
   * Cleared at the start of each turn, so it describes the last turn only.
   */
  const [chatFellBackFrom, setChatFellBackFrom] = useState<string | null>(null);
  /** The route of the current or last turn, for human labels (review D3). */
  const [chatCapability, setChatCapability] = useState<ModelCapability | null>(null);
  /**
   * The chat on screen. The ref is what appends read: a send captures it once,
   * so its reply lands in the chat it was asked in.
   */
  const [chatSession, setChatSessionState] = useState<ChatSession>(newChatSession);
  const sessionRef = useRef(chatSession);
  const briefingScope = useRef(nativeBriefingScopeBarrier());
  const setChatSession = useCallback((session: ChatSession) => {
    if(session.id!==sessionRef.current.id || session.temporary!==sessionRef.current.temporary) void briefingScope.current.invalidate();
    sessionRef.current = session; setChatSessionState(session);
  }, []);
  useEffect(()=>{void briefingScope.current.invalidate();return()=>{void briefingScope.current.invalidate();};},[]);
  /** A temporary chat is never stored, so it never reaches the vault or memory. */
  const remember = useCallback((messages: Parameters<typeof appendConversationMessages>[1], session: ChatSession = sessionRef.current) =>
    session.temporary ? Promise.resolve(false) : appendConversationMessages(session.id, messages), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let stored: OlympusState | null = null;
      let conversationId: string | null = null;
      try {
        ({ state: stored, conversationId } = await loadSession());
      } catch (error) {
        // Desktop only. Stay unhydrated: seed state must never be saved over
        // the real settings, and a send would give the model seed history.
        console.warn("[Olympus] Could not read the local database.", error);
        if (!cancelled) setChatError(`The local database could not be read (${errorMessage(error)}). Settings and conversation history are not loaded, and nothing will be saved or sent until Olympus restarts.`);
      }
      if (cancelled) return;

      let boundary: SessionBoundary | null = null;
      try {
        boundary = await beginOperatorSession();
      } catch (error) {
        console.warn(
          "[Olympus] Could not persist the session boundary; the briefing will say so.",
          error
        );
      }
      if (cancelled) return;

      if (stored) setDashboardState(stored);
      if (conversationId) setChatSession({ id: conversationId, title: "", temporary: false });
      setSessionBoundary(boundary);
      setSessionReady(true);
      if (!stored) return;
      hydratedRef.current = true;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Gated on hydration so the seed defaults never overwrite stored state during
  // the first render pass.
  useEffect(() => {
    if (!hydrated) return;
    void persistPreferences(dashboardState);
  }, [dashboardState, hydrated]);

  // Scans are not coalesced, so a slow scan of an old root can settle after a
  // newer one. Only the latest request may write.
  const projectScanSeq = useRef(0);
  useEffect(()=>subscribeProjectMembers(member=>{
    // The backend mutation succeeded. Publish it even if the following scan fails.
    projectScanSeq.current++;
    setDashboardState(current=>({...current,projects:applyProjectMember(current.projects,member)}));
    setProjectScan(current=>({...current,scanning:false}));
  }),[]);
  const refreshProjects = useCallback(async () => {
    if (DEMO_DATA) return;
    const request = ++projectScanSeq.current;
    setProjectScan((current) => current.scanning ? current : { ...current, scanning: true });
    try {
      const scan = await fetchProjects(
        dashboardState.settings.projectsRootPath,
        sessionBoundary?.previousSessionStartedAt ?? null
      );
      if (request !== projectScanSeq.current) return;
      // An unchanged scan keeps the same array, so nothing downstream rebuilds.
      setDashboardState((current) => JSON.stringify(current.projects) === JSON.stringify(scan.projects)
        ? current
        : { ...current, projects: scan.projects });
      setProjectNoteWarnings((current) => JSON.stringify(current) === JSON.stringify(scan.warnings) ? current : scan.warnings);
      setProjectScan({ status: "ready", lastSuccessAt: new Date().toISOString(), error: null, scanning: false });
    } catch (error) {
      if (request !== projectScanSeq.current) return;
      const message = errorMessage(error);
      // Projects are left untouched either way: empty if no scan ever
      // succeeded, the last genuine result if one did.
      const failedAt = new Date().toISOString();
      setProjectScan((current) => current.lastSuccessAt
        ? { status: "stale", lastSuccessAt: current.lastSuccessAt, error: message, scanning: false, failedAt }
        : { status: "failed", lastSuccessAt: null, error: message, scanning: false, failedAt });
    }
  }, [dashboardState.settings.projectsRootPath, sessionBoundary?.previousSessionStartedAt]);

  useEffect(() => {
    if (!sessionReady) return;

    void refreshProjects();

    // The omega ticks on the polls themselves, not just on a manual refresh.
    // StrictMode double-invokes this effect in dev, so the first tick lands
    // twice at startup — expected, not a bug to chase.
    const tick = (refresh: () => Promise<void>) => () => {
      void refresh().then(() => emitInstrumentEvent("poll"));
    };

    const projectsTimer = window.setInterval(tick(refreshProjects), 60_000);

    return () => {
      window.clearInterval(projectsTimer);
    };
  }, [refreshProjects, sessionReady]);

  // Displayed-item receipts are separate from launch and speech state.
  const briefingLock = useRef(false);
  const [briefingPending, setBriefingPending] = useState(false);
  const [previousBriefing,setPreviousBriefing] = useState<ConversationMessage|null>(null);
  const [briefingNoUpdate,setBriefingNoUpdate] = useState(false);
  const [briefingCompared,setBriefingCompared] = useState(false);
  const cancelBriefing=useCallback(async()=>{
    if(!briefingLock.current)return;
    openingBriefed.current = true;
    const confirmed=await briefingScope.current.invalidate();
    if(briefingMounted.current){setBriefingNoUpdate(false);setBriefingCompared(false);setChatError(confirmed?"Briefing stop confirmed. A result saved just before cancellation may remain in history.":"Stop requested, but Olympus could not confirm that the worker stopped.");}
  },[]);
  useEffect(()=>{setPreviousBriefing(null);setBriefingNoUpdate(false);setBriefingCompared(false)},[chatSession.id]);
  const briefingMounted = useRef(true);
  useEffect(() => { briefingMounted.current = true; return () => { briefingMounted.current = false; }; }, []);
  // Native synthesis saves the exact source-bound text before returning it.
  // Display it unchanged; acknowledgement happens only through the visible brief.
  const showLocalBrief = useCallback(async (session: ChatSession, active: () => boolean): Promise<boolean> => {
    setBriefingNoUpdate(false);
    setBriefingCompared(false);
    if (session.temporary || !isTauriRuntime()) return false;
    const projectIds = dashboardRef.current.projects
      .filter(p => p.repoState === "git-active" || p.repoState === "git-pending")
      .sort((a, b) => (Date.parse(b.lastCommitAt ?? "") || 0) - (Date.parse(a.lastCommitAt ?? "") || 0))
      .slice(0, 3).map(p => p.id);
    // The Olympians workflow: Zeus prepares the brief as a skill run with Olympus's own
    // read-only tools. The run is in the Activity Deck while it works; the spoken text
    // is saved to this chat like any brief. A failure says so and substitutes nothing.
    const routes = await invoke<{settings:Record<string,string>}>("load_persisted_state").catch(()=>null);
    if (routes?.settings["briefing.workflow.v1"] === "harness") {
      try {
        const run = await runOperation(null, "claude-code", "opening-brief");
        if (!active()) return true;
        if (run.status !== "completed" || !run.output || !isBrief(run.output)) { setChatError(`The brief could not finish. ${run.error ?? "No reason was recorded."}`); return true; }
        const brief = createAssistantMessage(run.output.brief);
        brief.id = `${BRIEFING_ID_PREFIX}${crypto.randomUUID()}`;
        brief.kind = "briefing";
        brief.voice = { kind: "output", spokenResponse: brief.content, ...(dashboardRef.current.settings.autoSpeak ? {} : { playback: "skipped" as const }) };
        dashboardRef.current = { ...dashboardRef.current, conversation: [...dashboardRef.current.conversation, brief] };
        setDashboardState(dashboardRef.current);
        setOpeningBriefing({ id: brief.id, text: brief.content });
        if (!await remember([brief], session)) setChatError("The brief was shown but could not be saved to this chat.");
      } catch (error) { if (active()) setChatError(`The brief could not start. ${errorMessage(error)}`); }
      return true;
    }
    let message: ConversationMessage | null;
    try {
        const previous = await invoke<ConversationMessage|null>("briefing_previous", {conversationId:session.id}).catch(()=>null);
        if (!active()) return true;
        setPreviousBriefing(previous);
      await waitForBriefMail(active);
      if (!active()) return true;
      const ticket = await invoke<string>("briefing_local_prepare", { conversationId: session.id });
      if (!active()) { await briefingScope.current.invalidate(); return true; }
        const result = briefingOutcome(await invoke("briefing_local", { conversationId: session.id, ticket, projectIds }));
        if(!active())return true;
        if(result.outcome==="shadow"){setBriefingCompared(true);return true;}
        message=result.message;
    }
    catch (error) {
      if (!active()) return true;
      const reason = String(error);
        if (!reason.includes("briefing_legacy_unconfigured")) {
          setChatError(briefingFailure(error));
        return true;
      }
      return false;
    }
    if (!active()) return true;
    if (!message) { setBriefingNoUpdate(true); return true; }
    setPreviousBriefing(null);
    message.kind = "briefing";
    message.voice = { kind: "output", spokenResponse: message.content, ...(dashboardRef.current.settings.autoSpeak ? {} : { playback: "skipped" as const }) };
    dashboardRef.current = { ...dashboardRef.current, conversation: [...dashboardRef.current.conversation, message] };
    setDashboardState(dashboardRef.current);
    setOpeningBriefing({ id: message.id, text: message.content });
    briefSaved(message.id);
    return true;
  }, []);
  const projectsScanned = projectScan.status !== "loading";
  useEffect(() => {
    if (openingBriefed.current || !hydrated || !projectsScanned || taskStore.loading || runStore.loading) return;
    if (!dashboardRef.current.settings.briefOnOpen) { openingBriefed.current = true; return; }
    if (briefingLock.current) return;
    const session = sessionRef.current;
    briefingLock.current = true;
    setBriefingPending(true);
    void (async () => {
      try {
        const scopeCurrent = briefingScope.current.capture();
        const active = () => scopeCurrent() && briefingMounted.current && sessionRef.current.id === session.id;
        if(!await briefingScope.current.settled() || !active()) throw Error("Briefing scope revocation was not acknowledged.");
        if (await showLocalBrief(session, active)) { if (active()) openingBriefed.current = true; return; }
        const prepared = isTauriRuntime() ? await prepareStableBrief(() => {
          const projects = dashboardRef.current.projects, board = boardRef.current;
          const root = dashboardRef.current.settings.projectsRootPath;
          return prepareFactualBrief({rootPath:root,projects,board,projectsError}, 'opening', Date.now(), undefined,
            () => dashboardRef.current.projects === projects && boardRef.current === board && dashboardRef.current.settings.projectsRootPath === root, {temporary:session.temporary,conversationId:session.id});
        }, active) : null;
        if (!active()) return;
        const text = prepared ? prepared.text : composeOpeningBriefing({projects:dashboardRef.current.projects,board:boardRef.current,sessionBoundary,projectsError});
        // A deliberate no-items result consumes the opening; invalidated attempts do not.
        openingBriefed.current = true;
        if (!text) return;
        const message = createAssistantMessage(text);
        message.id = `${BRIEFING_ID_PREFIX}${crypto.randomUUID()}`;
        message.kind = "briefing";
        message.delivery = prepared?.delivery;
        message.briefing = prepared?.briefing;
        message.feedback = prepared && !session.temporary ? feedbackForBrief(prepared.items) : undefined;
        message.voice = { kind: "output", spokenResponse: text, ...(dashboardRef.current.settings.autoSpeak ? {} : { playback: "skipped" as const }) };
        dashboardRef.current = { ...dashboardRef.current, conversation: [...dashboardRef.current.conversation, message] };
        setDashboardState(dashboardRef.current);
        setOpeningBriefing({ id: message.id, text });
        const saved = await remember([message], session);
        if (prepared && !saved && !session.temporary) throw Error("Briefing could not be saved.");
        if (prepared && saved && !session.temporary) briefSaved(message.id);
      } catch {
        if (briefingMounted.current && sessionRef.current.id === session.id) setChatError("The briefing could not finish or its delivery record could not be saved. Request a fresh update; unrecorded items remain eligible.");
      } finally {
        briefingLock.current = false;
        if (briefingMounted.current) setBriefingPending(false);
      }
    })();
  }, [hydrated, projectsScanned, taskStore.loading, runStore.loading, sessionBoundary, projectsError, projectScan.lastSuccessAt, remember, showLocalBrief]);

  const requestBriefing = useCallback(async () => {
    if (briefingLock.current || !hydratedRef.current || !isTauriRuntime()) return;
    const session = sessionRef.current;
    briefingLock.current = true;
    setBriefingPending(true);
    setChatError(null);
    try {
      const root = dashboardRef.current.settings.projectsRootPath;
      const scopeCurrent = briefingScope.current.capture();
      const active = () => scopeCurrent() && briefingMounted.current && sessionRef.current.id === session.id && dashboardRef.current.settings.projectsRootPath === root;
      if(!await briefingScope.current.settled() || !active()) throw Error("Briefing scope revocation was not acknowledged.");
      if (await showLocalBrief(session, active)) return;
      const prepared = await prepareStableBrief(() => prepareSituationBriefing(root, sessionBoundary, {temporary:session.temporary,conversationId:session.id}), active);
      if (!active()) return;
      const text = prepared.text;
      if (!text) return;
      const message = createAssistantMessage(text);
      message.id = `${BRIEFING_ID_PREFIX}sitrep-${crypto.randomUUID()}`;
      message.kind = "briefing";
      message.delivery = prepared?.delivery;
        message.briefing = prepared?.briefing;
      message.feedback = prepared && !session.temporary ? feedbackForBrief(prepared.items) : undefined;
      message.voice = { kind: "output", spokenResponse: text, ...(dashboardRef.current.settings.autoSpeak ? {} : { playback: "skipped" as const }) };
      dashboardRef.current = { ...dashboardRef.current, conversation: [...dashboardRef.current.conversation, message] };
      setDashboardState(dashboardRef.current);
      setOpeningBriefing({ id: message.id, text });
      const saved = await remember([message], session);
      if (!saved && !session.temporary) throw Error("Briefing could not be saved.");
      if (saved && !session.temporary) briefSaved(message.id);
    } catch (error) { if(briefingMounted.current) setChatError(errorMessage(error)); }
    finally { briefingLock.current = false; if(briefingMounted.current) setBriefingPending(false); }
  }, [sessionBoundary, remember, showLocalBrief]);

  const sendChatMessage = useCallback(
    async (text: string, voiceDepth?: VoiceDepth, voiceMessageId?: string, turn?: TurnContext): Promise<VoiceAnswer | undefined> => {
      if (voiceDepth) while (requestInFlight.current) await new Promise(resolve => window.setTimeout(resolve, 80));
      const trimmed = text.trim();
      // Before hydration the history is seed data and the stored conversation
      // would replace this turn on arrival.
      if (!trimmed || requestInFlight.current || !hydratedRef.current) return;
      conversationStream.reset();
      emitInstrumentEvent("command-received");

      const skillRequest = matchSkillRequest(trimmed);
      const turnEngine = conversationChoiceSnapshot();
      let capability: import("../services/modelRouting").ModelCapability = "PRIMARY";
      const user = createUserMessage(trimmed);
      // Output modality is independent of input modality: a typed request may
      // ask for a spoken answer, but only a transcription has a voice input ID.
      if (voiceMessageId) { user.voice = {kind:"input"}; user.id = voiceMessageId; }
      // The transcript shows the operator's words; the model is sent them with
      // the attachment and scope composed back in (`turnAttachment`).
      if (turn?.attachment) user.attachment = turn.attachment;
      if (turn?.scope) user.scope = turn.scope;
      const session = sessionRef.current;

      // The user's turn lands immediately and is part of the history the model
      // sees, so it is captured before the request goes out.
      const history = [...dashboardRef.current.conversation, user];
      dashboardRef.current = {...dashboardRef.current, conversation:history};
      setDashboardState(dashboardRef.current);
      const userSaved = remember([user], session);

      if (!isTauriRuntime()) {
        // Browser dev server: no API key available, so fall back to the local
        // keyword search over Pantheon entries.
        const offline = buildPantheonReply(trimmed, []);
        setDashboardState((current) => ({
          ...current,
          conversation: [...current.conversation, offline]
        }));
        return;
      }

      if (skillRequest) {
        requestInFlight.current=true; setChatPending(true);
        try {
          if(!await userSaved && !session.temporary)throw Error("Your request could not be saved.");
          const record=session.temporary ? null : await skillRequest.skill.run(skillRequest.input,"manual");
          const message=createAssistantMessage(record
            ? "Project Change Review #"+record.id+" · "+record.project+" · "+record.outcome+". "+record.detail+(record.revision?" · Git "+record.revision:"")
            : "Project reviews keep a durable source record. Run this skill from a saved conversation or the Armory.");
          if(sessionRef.current.id===session.id){
            dashboardRef.current={...dashboardRef.current,conversation:[...dashboardRef.current.conversation,message]};
            setDashboardState(dashboardRef.current); await remember([message],session);
            if(voiceDepth)return {messageId:message.id,spokenResponse:message.content,visualResponse:message.content,proposedActions:[],requiresConfirmation:false,conversationState:"answered"};
          }
        } catch(error){setChatError(errorMessage(error));}
        finally{requestInFlight.current=false;setChatPending(false);}
        return;
      }
      // A turn that asks for an Olympian (`/ask`, "have Themis check that", "Athena, find…")
      // runs as an operation instead of a chat reply. It follows the skill path above:
      // the request is saved first, the answer is appended and saved when the run
      // settles, and the Activity Deck shows the work meanwhile.
      const operationRequest = matchChatHandoff(trimmed, history.slice(0, -1).map(turn => ({ role: turn.role, content: turn.content })));
      if (operationRequest) {
        requestInFlight.current=true; setChatPending(true); setChatError(null);
        setChatProgress(`${operationRequest.lead} has it. The Activity Deck shows the work.`);
        try {
          if(!await userSaved && !session.temporary)throw Error("Your request could not be saved.");
          const message=createAssistantMessage(session.temporary
            ? "An operation keeps a record of its request and steps, so it cannot start from a Temporary chat. Use a saved chat."
            : operationReply(await runOperation(operationRequest.request, "claude-code", operationRequest.skillId)));
          if(sessionRef.current.id===session.id){
            dashboardRef.current={...dashboardRef.current,conversation:[...dashboardRef.current.conversation,message]};
            setDashboardState(dashboardRef.current); await remember([message],session);
          }
        } catch(error){setChatError(errorMessage(error));}
        finally{requestInFlight.current=false;setChatPending(false);setChatProgress(null);}
        return;
      }
      setChatCapability(capability);
      requestInFlight.current = true;
      setChatModel(null);
      setChatPending(true);
      activeRequest.current = crypto.randomUUID();
      turnCancelled.current = false;
      setChatProgress(null);
      setChatError(null);
      setChatProducing(false);
      setChatFellBackFrom(null);
      // A new turn cancels any floor still holding from the previous one.
      window.clearTimeout(speakingHoldTimer.current);
      speakingStartedAt.current = null;

      try {
        const reply = await resolveConversationTurn(userSaved,{...session,voiceDepth,active:()=>!turnCancelled.current&&sessionRef.current.id===session.id},user.id,async()=>{
          if (turnEngine?.provider === "legacy-api") capability=consumeNextModel();
          setChatCapability(capability);
          return requestAssistantReply(
          history,
          dashboardRef.current.settings,
          dashboardRef.current.projects,
          (event) => {
            switch (event.kind) {
              case "vaultRecall": if(!session.temporary)recordSourceAccess("olympus",event.file,true,activeRequest.current??"Vault recall","read","note:"+event.file); break;
              case "sourceAccess": if (!session.temporary) recordSourceAccess("Repository inspection", event.project + "/" + event.file, event.success, activeRequest.current ?? "Repository inspection"); break;
              case "progress": setChatProgress(event.message); break;
              case "started":
                // Latch the model at first paint. Routing noise must not churn
                // the readout mid-response.
                setChatModel(event.model);
                break;
              case "delta":
                // Voice turns arrive here too: Rust forwards only the decoded
                // visual answer, never the JSON envelope (voice::VisualStream).
                // The speaking signal. Idempotent by construction — React bails
                // on an unchanged value, so every later delta is free.
                if (speakingStartedAt.current === null) {
                  speakingStartedAt.current = Date.now();
                  emitInstrumentEvent("response-start");
                }
                conversationStream.append(event.text);
                setChatProducing(true);
                break;
              case "fellBack":
                // A real change in what is answering, so it is surfaced. Both
                // models are kept: the readout shows the handoff.
                setChatFellBackFrom(event.from);
                setChatModel(event.to);
                break;
            }
          },
          {engineChoice:turnEngine, requestId: activeRequest.current ?? undefined, capability, voiceDepth, commandBoard: boardRef.current, temporary: session.temporary, conversationId: session.id}
        );
        });
        const assistant = createAssistantMessage(reply.content, reply.notice, reply.research);
        assistant.feedback = reply.feedback;
        assistant.mail = reply.mail;
        assistant.request=reply.request;
        if (reply.voice) assistant.voice = {kind:"output",spokenResponse:reply.voice.spokenResponse,playback:"pending",requiresConfirmation:reply.voice.requiresConfirmation};
        setChatModel(reply.model);
        dashboardRef.current = {...dashboardRef.current,conversation:[...dashboardRef.current.conversation,assistant]};
        setDashboardState(dashboardRef.current);
        // Persist the planned summary before the transport can record a fast
        // connection failure or playback receipt for this same message.
        await remember([assistant], session);
        return reply.voice ? {...reply.voice,messageId:assistant.id} : undefined;
      } catch (error) {
        const partial = conversationStream.current().trim();
        if (partial) {
          const interrupted = createAssistantMessage(partial, { kind: "truncated", message: "Response interrupted. This is the output received before the error." });
          setDashboardState(current => ({ ...current, conversation: [...current.conversation, interrupted] }));
          void remember([interrupted], session);
        }
        setChatError(errorMessage(error));
      } finally {
        requestInFlight.current = false;
        activeRequest.current = null;
        setChatProgress(null);
        conversationStream.reset();
        // Both reachable paths clear the indicator: success falls through, an
        // error is caught, and either way this runs. A stuck "thinking" is worse
        // than no indicator, so the reset is structural rather than scheduled.
        //
        // Voice interruption cancels audio delivery, not the accepted reasoning turn.
        // Its visual answer is retained; both input modes release the same lock here.
        setChatPending(false);

        // The speaking floor. A five-character reply's speaking window measured
        // 20ms — below one frame, so the state never rendered at all.
        //
        // **This holds the glyph only.** The reply was appended to the
        // conversation above, before this line runs; nothing here can delay
        // text. And the timer only ever *clears* — no state is entered by a
        // timer, so none can be stranded on by one.
        const release = planTurnRelease(speakingStartedAt.current, Date.now());
        if (release.holdSpeakingMs === 0) {
          setChatProducing(false);
        } else {
          speakingHoldTimer.current = window.setTimeout(
            () => setChatProducing(false),
            release.holdSpeakingMs
          );
        }
        speakingStartedAt.current = null;
      }
    },
    [dashboardState.conversation, dashboardState.projects, dashboardState.settings]
  );

  const updateVoiceMessage = useCallback((id: string, metadata: Partial<VoiceMessageMetadata>) => {
    const existing = dashboardRef.current.conversation.find(message => message.id === id);
    if (!existing?.voice) return;
    const updated = {...existing, voice:{...existing.voice,...metadata}};
    dashboardRef.current = {...dashboardRef.current,conversation:dashboardRef.current.conversation.map(message => message.id === id ? updated : message)};
    setDashboardState(dashboardRef.current);
    void remember([updated]);
  }, [remember]);

  /**
   * Switching chats waits for the turn in flight: its reply belongs to the chat
   * it was asked in. Returns why it could not switch, or null.
   */
  const busy = () => requestInFlight.current || briefingLock.current ? "Wait for the current reply to finish." : null;
  const newChat = useCallback((temporary = false): string | null => {
    const reason = busy(); if (reason) return reason;
    void endChatModelScope();
    setChatSession(newChatSession(temporary));
    dashboardRef.current = { ...dashboardRef.current, conversation: [] };
    setDashboardState(dashboardRef.current);
    setOpeningBriefing(null);
    setChatError(null);
    return null;
  }, [setChatSession]);
  const openChat = useCallback(async (id: string, title: string): Promise<string | null> => {
    const reason = busy(); if (reason) return reason;
    let messages;
    try { messages = await loadConversation(id); }
    catch (error) { return `That chat could not be opened (${errorMessage(error)}).`; }
    const again = busy(); if (again) return again;
    void endChatModelScope();
    setChatSession({ id, title, temporary: false });
    dashboardRef.current = { ...dashboardRef.current, conversation: messages };
    setDashboardState(dashboardRef.current);
    setOpeningBriefing(null);
    setChatError(null);
    return null;
  }, [setChatSession]);
  const renameChat = useCallback(async (id: string, title: string) => {
    await renameConversation(id, title);
    if (sessionRef.current.id === id) setChatSession({ ...sessionRef.current, title: title.trim().replace(/\s+/g, " ") });
  }, [setChatSession]);
  /** Removes the chat from Olympus; its vault note and memory stay (the UI says so). */
  const deleteChat = useCallback(async (id: string) => {
    if (sessionRef.current.id === id && busy()) throw new Error("Wait for the current reply to finish.");
    await deleteConversation(id);
    if (sessionRef.current.id === id) newChat();
  }, [newChat]);
  /** A title the backend gave the chat since it opened (a rename, the memory pass). */
  const syncChatTitle = useCallback((id: string, title: string) => {
    if (sessionRef.current.id === id && title && sessionRef.current.title !== title) setChatSession({ ...sessionRef.current, title });
  }, [setChatSession]);



  // Not folded into the conversation save path: an observation is a deliberate,
  // approved vault write, not a side effect of chatting.

  /**
   * Everything the Ctrl+R registry label promises, and anything subscribed to
   * `subscribeToRefresh`. Settled, not awaited in sequence: one failing source
   * must not hold the others back.
   */
  const refreshAll = useCallback(async () => {
    emitRefreshRequested();
    await Promise.allSettled([
      refreshProjects(),
      refreshActionQueue(),
      refreshDelegationRuns(),
      refreshPantheon(),
      refreshVaultGraph(),
      refreshVaultWrites()
    ]);
    emitInstrumentEvent("poll");
  }, [refreshProjects]);

  return useMemo(
    () => ({
      settings: dashboardState.settings,
      settingsReady: hydrated,
      tools: dashboardState.tools.filter((tool) => tool.id !== "tool-prompt-builder"),
      quickApps: dashboardState.quickApps,
      projects: dashboardState.projects,
      sessionBoundary,
      openingBriefing, requestBriefing, briefingPending, previousBriefing, briefingNoUpdate, briefingCompared, cancelBriefing,
      projectScan,
      /** True in the browser preview: projects and conversation are seed fixtures. */
      demoData: DEMO_DATA,
      /** Kept for existing callers; the same value as `projectScan.error`. */
      projectsError,
      rescanProjects: refreshProjects,
      projectNoteWarnings,
      chat: dashboardState.conversation,
      chatSession, newChat, openChat, renameChat, deleteChat, syncChatTitle,
      chatPending,
      chatProgress, cancelChat,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      chatCapability,
      sendChatMessage,
      updateVoiceMessage,
      updateVoicePreferences,
      refreshAll
    }),
    [
      dashboardState,
      hydrated,
      sessionBoundary,
      openingBriefing, requestBriefing, briefingPending, previousBriefing, briefingNoUpdate, briefingCompared, cancelBriefing,
      projectScan,
      projectsError,
      refreshProjects,
      projectNoteWarnings,
      chatSession, newChat, openChat, renameChat, deleteChat, syncChatTitle,
      chatPending,
      chatProgress, cancelChat,
      chatError,
      chatModel,
      chatProducing,
      chatFellBackFrom,
      chatCapability,
      sendChatMessage,
      updateVoiceMessage,
      updateVoicePreferences,
      refreshAll
    ]
  );
}
import {briefingOutcome, briefingFailure} from '../services/briefingOutcome';
