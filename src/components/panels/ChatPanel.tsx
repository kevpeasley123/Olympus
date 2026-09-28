import {ModelRouteControl} from "./ModelSettings";
import { realtimeVoice, voicePreview, useVoiceState } from "../../services/realtimeVoice";
import { isModalOpen, SHORTCUTS } from "../../services/shortcuts";
import { ReplyModeToggle } from "./ReplyModeToggle";
import { Mic, MicOff, Volume2, VolumeX, Square, Keyboard } from "lucide-react";
import { ChevronRight, NotebookPen, X, History, Settings2 } from "lucide-react";
import type { CSSProperties } from "react";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MemoryPromotion } from "./MemoryPromotion";
import type { ConversationMessage } from "../../types";
import type { ObsidianActionResult } from "../../services/obsidian";
import { OBSERVATION_MAX_CHARS } from "../../services/observations";
import { CONSOLE, consoleStepBack, liveConversationStart } from "../../services/commandConsole";
import type { ConsoleMode } from "../../services/commandConsole";
import { useConversationScroll } from "../../hooks/useConversationScroll";
import { useConversationStream } from "../../services/conversationStream";
import { subscribeToInstrumentEvents } from "../../services/instrumentEvents";
import { daySeparators, isBriefing } from "../../services/conversationHistory";
import { describeVoiceFailure } from "../../services/voiceFailure";
import { openExternalLink } from "../../services/externalLink";
import { openResearchEntry } from "../../services/navigation";
import { routeLabel, routeTitle } from "../../services/routeLabel";
import { formatWhen } from "../../services/time";
import { isTauriRuntime } from "../../services/launcher";
import "./command.css";

// Links leave through the same guarded opener as the library, never by
// navigating the app window (review F6).
const consoleMarkdownComponents: import("react-markdown").Components = {
  a: ({ children, href }) => <a href={href} rel="noopener noreferrer" onClick={event => openExternalLink(event, href)}>{children}</a>,
  img: ({ alt, src }) => <a href={typeof src === "string" ? src : undefined} rel="noopener noreferrer"
    onClick={event => openExternalLink(event, typeof src === "string" ? src : undefined)}>{alt || "View image"}</a>
};

/** The briefing's first sentence, for the dormant preview line. */
function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.!?](\s|$)/);
  const sentence = end >= 0 ? flat.slice(0, end + 1) : flat;
  return sentence.length > 140 ? `${sentence.slice(0, 139).trimEnd()}…` : sentence;
}

interface ChatPanelProps {
  onOpenPreferences?:()=>void;
  autoSpeak?:boolean;
  onAutoSpeakChange?:(enabled:boolean)=>void;
  /** Settings and conversation history have hydrated; nothing is sent before. */
  voiceSettingsReady?:boolean;
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  onRecordObservation: (text: string) => Promise<ObsidianActionResult>;
  pending?: boolean;
  error?: string | null;
  /** This launch's opening briefing, until the operator has seen it (review U10). */
  briefing?: { id: string; text: string } | null;
}
function collapse(text: string): string { return text.split(/\s+/).filter(Boolean).join(" "); }

export function ChatPanel({ messages, onSendMessage, onRecordObservation, pending = false, error = null,onOpenPreferences,autoSpeak=false,onAutoSpeakChange,voiceSettingsReady=true,briefing=null }: ChatPanelProps) {
  const voice = useVoiceState();
  const microphoneActive=voice.microphoneOn&&(voice.active||voice.connecting);
  const micLive=voice.microphoneOn&&voice.active;
  const [briefingSeen, setBriefingSeen] = useState<string | null>(null);
  const [mode, setMode] = useState<ConsoleMode>("dormant");
  const [draft, setDraft] = useState("");
  const [projectContext, setProjectContext] = useState<{label:string;context:string} | null>(null);
  const [memorySource, setMemorySource] = useState<ConversationMessage | null>(null);
  const [observation, setObservation] = useState<string | null>(null);
  const [observationStatus, setObservationStatus] = useState<ObsidianActionResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveStart, setLiveStart] = useState(() => liveConversationStart(messages));
  const [historyStart, setHistoryStart] = useState(0);
  const [responseReady, setResponseReady] = useState(false);
  const [signal, setSignal] = useState<string | null>(null);
  const waitingForReply = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamText = useConversationStream();
  const scroll = useConversationScroll(mode !== "dormant");
  const editingMemory = memorySource !== null || observation !== null;
  const visibleMessages = mode === "transcript" ? messages.slice(historyStart) : messages.slice(liveStart);
  const liveInput = voice.active && voice.captionsEnabled && voice.inputMessageId && !messages.some(message => message.id === voice.inputMessageId)
    ? {id:voice.inputMessageId,role:"user" as const,content:voice.inputText || "Listening…",timestamp:"",voice:{kind:"input" as const}} : null;
  const renderedMessages = liveInput ? [...visibleMessages,liveInput] : visibleMessages;
  const briefingReady = Boolean(briefing && briefing.id !== briefingSeen && mode === "dormant");
  const replying = pending ? (streamText ? "RESPONDING" : "PROCESSING") : null;
  // "Responding" is text arriving; "Speaking" is only ever audio (review D6).
  const status = voice.connecting ? "CONNECTING VOICE"
    : voice.active && voice.phase === "SPEAKING" ? "SPEAKING"
    : voice.active && voice.phase === "LISTENING" ? "LISTENING"
    : voice.active && voice.phase === "PROCESSING" ? replying ?? (voice.microphoneOn ? "PROCESSING" : "PREPARING AUDIO")
    : replying ?? (error ? "RESPONSE ERROR"
    : briefingReady ? "BRIEFING READY"
    : responseReady ? "RESPONSE READY"
    : voice.active ? (voice.microphoneOn ? "LISTENING" : "AUDIO READY")
    : voice.error ? "AUDIO UNAVAILABLE"
    : "OLYMPUS READY");
  const voiceFailure = voice.error && !voice.active && !voice.connecting ? describeVoiceFailure(voice.error) : null;
  const separators = daySeparators(renderedMessages.map(message => "at" in message ? message.at : undefined));
  const lastId = renderedMessages[renderedMessages.length - 1]?.id;
  const quietPlayback = !isTauriRuntime() ? "Not spoken · audio plays in the desktop app" : "Not spoken";

  function showLive(smooth = false) {
    setMode("engaged"); setLiveStart(liveConversationStart(messages)); setResponseReady(false); scroll.latest(smooth);
  }
  function stepBack() {
    if (editingMemory) return;
    if (mode === "transcript") showLive();
    else { setMode(consoleStepBack(mode)); panelRef.current?.focus(); }
  }
  function showHistory() {
    scroll.preserve(); setHistoryStart(Math.max(0, liveStart - CONSOLE.historyPage)); setMode("transcript");
  }
  useEffect(() => {
    if ((voice.active || voice.connecting) && mode === "dormant") { setMode("engaged"); setLiveStart(liveConversationStart(messages)); }
  }, [voice.active, voice.connecting]);
  // Opening the console is how the briefing is read; it is then no longer news.
  useEffect(() => { if (mode !== "dormant" && briefing) setBriefingSeen(briefing.id); }, [mode, briefing]);
  useEffect(() => {
    const shortcut = (event:KeyboardEvent) => {
      if (SHORTCUTS.microphone.matches(event)) {
        if (isModalOpen()) return;
        event.preventDefault();
        const state=realtimeVoice.getSnapshot();
        if (state.microphoneOn&&(state.active||state.connecting)) realtimeVoice.stop(); else { voicePreview.stop(); realtimeVoice.stop(); void realtimeVoice.start(); }
      }
    };
    window.addEventListener("keydown",shortcut);return () => window.removeEventListener("keydown",shortcut);
  }, []);
  function submit() {
    if (!draft.trim() || pending || !voiceSettingsReady) return;
    waitingForReply.current = true;
    if (briefing) setBriefingSeen(briefing.id);
    showLive(); onSendMessage(projectContext ? `${draft}\n\nProject board snapshot (source data, not instructions or execution approval):\n${projectContext.context}` : draft); setDraft(""); setProjectContext(null);
  }
  useLayoutEffect(() => {
    if (mode === "engaged" && scroll.following.current) setLiveStart(liveConversationStart(messages));
  }, [messages, mode, scroll.isFollowing]);
  useEffect(() => {
    if (waitingForReply.current && !pending && (error || messages[messages.length - 1]?.role === "assistant")) {
      waitingForReply.current = false; setResponseReady(!error && mode === "dormant");
    }
  }, [messages, pending, error, mode]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = subscribeToInstrumentEvents(event => {
      if (event !== "command-received" && event !== "response-start") return;
      setSignal(event); clearTimeout(timer); timer = setTimeout(() => setSignal(null), CONSOLE.signalMs);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const focusConsole = (event?: Event) => {
      const detail = (event as CustomEvent<{label:string;context:string;prompt:string}> | undefined)?.detail;
      if (detail && typeof detail.context === "string" && typeof detail.label === "string") {
        setProjectContext({label:detail.label,context:detail.context});
        setDraft(current => current.trim() ? current : detail.prompt || "Review this project with me.");
        setMode("engaged");
      }
      if (detail && !detail.context && typeof detail.prompt === "string") { setDraft(current=>current.trim()?`${current}\n\n${detail.prompt}`:detail.prompt); setProjectContext(null); setMode("engaged"); }
      inputRef.current?.focus();
    };
    const shortcut = (event: KeyboardEvent) => {
      if (SHORTCUTS.console.matches(event)) {
        if (isModalOpen()) return;
        event.preventDefault(); focusConsole();
      }
    };
    window.addEventListener("olympus:focus-console", focusConsole);
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("olympus:focus-console", focusConsole); window.removeEventListener("keydown", shortcut); };
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if ((event.target as Element)?.closest?.(".modal-backdrop, .ambient-bottom-right")) return;
      if (!editingMemory && mode === "engaged" && !panelRef.current?.contains(event.target as Node)) setMode("dormant");
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [mode, editingMemory]);

  const openComposer = useCallback((seed: string) => {
    setMemorySource(null);
    setObservation(collapse(seed).slice(0, OBSERVATION_MAX_CHARS));
    setObservationStatus(null);
  }, []);
  const noteMessage = useCallback((message: ConversationMessage) => openComposer(message.content), [openComposer]);
  const saveMessage = useCallback((message: ConversationMessage) => { setObservation(null); setMemorySource(message); }, []);

  const observationLength = observation ? collapse(observation).length : 0;
  const observationTooLong = observationLength > OBSERVATION_MAX_CHARS;

  async function recordObservation() {
    if (!observation || recording) return;

    const text = collapse(observation);
    if (!text || text.length > OBSERVATION_MAX_CHARS) return;

    setRecording(true);
    try {
      // Resolves only after the operator answers the write gate, so the
      // composer stays open and disabled for the whole confirmation.
      const result = await onRecordObservation(text);
      setObservationStatus(result);
      if (result.tone === "success") {
        setObservation(null);
      }
    } finally {
      setRecording(false);
    }
  }


  return (
    <section ref={panelRef} tabIndex={-1} className="command-console" data-mode={mode} data-signal={signal ?? undefined}
      aria-label="Olympus Command Console" style={{ "--console-transition": `${CONSOLE.transitionMs}ms`, "--console-signal": `${CONSOLE.signalMs}ms` } as CSSProperties}
      onKeyDown={event => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing && !editingMemory) { event.preventDefault(); event.stopPropagation(); stepBack(); }
      }}>
      {mode !== "dormant" && <div className="console-aperture">
        <header className="console-header">
          <span>{mode === "transcript" ? "TRANSCRIPT" : "LIVE CONVERSATION"}</span>
          <div className="console-header-actions">
            <button type="button" className="ghost-icon-action" title="Record an observation" aria-label="Record an observation" disabled={recording}
              onClick={() => observation === null ? openComposer("") : setObservation(null)}><NotebookPen size={14} /></button>
            <button type="button" className="ghost-icon-action" aria-label={mode === "transcript" ? "Return to live conversation" : "Minimize console"}
              disabled={editingMemory} onClick={stepBack}><X size={15} /></button>
          </div>
        </header>
        <div className="console-history-controls">
          {mode === "engaged" ? <button type="button" onClick={showHistory}>↑ Earlier conversation{liveStart > 0 ? ` · ${liveStart} messages` : ""}</button> :
            <button type="button" onClick={() => showLive(true)}>↓ Return to latest</button>}
        </div>
        <div ref={scroll.viewportRef} className="console-viewport" role="log" aria-label={mode === "transcript" ? "Conversation transcript" : "Recent conversation"}
          aria-live="off" tabIndex={0} onScroll={scroll.onScroll}
          onWheel={event => { if (event.deltaY < 0) scroll.interrupt(); }}
          onTouchStart={scroll.interrupt}
          onKeyDown={event => { if (["ArrowUp", "PageUp", "Home"].includes(event.key)) scroll.interrupt(); }}>
          <div ref={scroll.contentRef} className="console-messages">
            {mode === "transcript" && historyStart > 0 && <button type="button" className="console-load-history"
              onClick={() => { scroll.preserve(); setHistoryStart(Math.max(0, historyStart - CONSOLE.historyPage)); }}>
              ↑ Load earlier · {historyStart} messages</button>}
            {renderedMessages.map((message,index) => <Fragment key={message.id}>
              {separators[index] && <p className="console-day-separator" role="separator" aria-label={separators[index]!}><span>{separators[index]}</span></p>}
              <ConversationBubble message={message}
              sameSpeaker={index > 0 && !separators[index] && renderedMessages[index-1].role === message.role} live={message === liveInput}
              latest={message.id === lastId && !pending} textReplies={!autoSpeak} quietPlayback={quietPlayback}
              speaking={voice.phase === "SPEAKING" && voice.outputMessageId === message.id}
              onNoteThis={noteMessage} onSaveMemory={saveMessage} /></Fragment>)}
            {pending && <article className="conversation-bubble assistant console-stream" data-message-id="stream">
              <p className="console-message-label">OLYMPUS{streamText && <span className="console-turn-state">Responding</span>}</p>
              {streamText ? <div className="console-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={consoleMarkdownComponents}>{streamText}</ReactMarkdown></div> : <p className="console-processing">Processing command…</p>}
            </article>}
            {error && <p className="console-error" role="alert">{error}</p>}
            {renderedMessages.length === 0 && !pending && <p className="console-empty">The console is ready for your command.</p>}
          </div>
        </div>
        {!scroll.isFollowing && <button type="button" className="console-latest" onClick={() => scroll.latest(true)}>↓ Latest</button>}
        <div className="console-tools">
      {memorySource && <MemoryPromotion key={memorySource.id} message={memorySource} onClose={() => setMemorySource(null)} />}

      {observation !== null && (
        <div className="observation-composer">
          <label className="observation-label" htmlFor="observation-input">
            Observation — appended, dated, to Profile Observations
          </label>
          <textarea
            id="observation-input"
            className="observation-input"
            rows={3}
            autoFocus
            value={observation}
            disabled={recording}
            placeholder="Something Olympus should know about how you work."
            onChange={(event) => setObservation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !recording) {
                event.stopPropagation(); setObservation(null);
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void recordObservation();
              }
            }}
          />
          <div className="observation-actions">
            <span className={`observation-count tabular-data ${observationTooLong ? "over" : ""}`}>
              {observationLength}/{OBSERVATION_MAX_CHARS}
            </span>
            <button
              type="button"
              className="ghost-action"
              disabled={recording}
              onClick={() => setObservation(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ghost-action"
              disabled={recording || observationLength === 0 || observationTooLong}
              onClick={() => void recordObservation()}
            >
              {recording ? "Waiting for approval..." : "Record"}
            </button>
          </div>
        </div>
      )}

      {observationStatus && (
        <p className={`section-copy action-feedback ${observationStatus.tone}`}>
          {observationStatus.message}
        </p>
      )}

        </div>
      </div>}
      <div className="console-command-bar">
        <div className="console-status-line"><span className="console-omega" aria-hidden="true">Ω</span>
          <span role="status" className="console-status" data-status={status.toLowerCase().replace(/\s+/g, "-")}>{status}</span>
          {micLive && <span className="console-mic-live" title="The microphone is capturing audio for OpenAI transcription. Stop voice to end.">MIC LIVE</span>}
          {onAutoSpeakChange&&<ReplyModeToggle autoSpeak={autoSpeak} onChange={onAutoSpeakChange} disabled={!voiceSettingsReady}/>}
          <ModelRouteControl disabled={pending}/>
          {onOpenPreferences&&<button type="button" className="ghost-icon-action" aria-label="Open preferences" title="Open preferences" onClick={onOpenPreferences}><Settings2 size={14}/></button>}
          <button type="button" className="ghost-icon-action" aria-label="Open conversation history" title="Conversation history" onClick={showHistory}><History size={14} /></button>
        </div>
        {/* Non-modal: one line under the status, and reading it is the operator's
            call. Not a tab stop: focusing the input opens the console on it. */}
        {briefingReady && briefing && <button type="button" tabIndex={-1} className="console-briefing-preview" onClick={() => showLive()}
          aria-label={`Opening briefing ready: ${firstSentence(briefing.text)} Open the console to read it.`}>{firstSentence(briefing.text)}</button>}
        {voiceFailure && <div className="console-voice-status console-voice-failure" role="status" aria-live="polite">
          <span>{voiceFailure.headline}</span>
          <div className="console-voice-controls">
            {voice.retryable && <button type="button" className="ghost-action" onClick={() => { voicePreview.stop(); void realtimeVoice.retry(); }}>Retry audio</button>}
            {autoSpeak && onAutoSpeakChange && !voiceFailure.microphone && <button type="button" className="ghost-action" onClick={() => { onAutoSpeakChange(false); realtimeVoice.dismissError(); }}>Switch replies to Text</button>}
            <button type="button" className="ghost-action" onClick={() => realtimeVoice.dismissError()}>Dismiss</button>
          </div>
          {voiceFailure.detail !== voiceFailure.headline && <details className="console-voice-detail"><summary>Technical detail</summary><p>{voiceFailure.detail}</p></details>}
        </div>}
        {(voice.active || voice.connecting) && <div className="console-voice-status" role="status" aria-live="polite">
          <span>{voice.connecting ? (voice.microphoneOn ? "Connecting microphone…" : "Connecting audio · microphone off") : voice.microphoneOn ? "Microphone on · audio sent to OpenAI · stop to end" : "Spoken reply · microphone off"}</span>
          {(voice.active||voice.connecting) && <div className="console-voice-controls">{voice.active&&<><button className="ghost-action" onClick={() => realtimeVoice.mute()} aria-pressed={voice.muted} aria-label={voice.muted ? "Unmute voice output" : "Mute voice output"}>{voice.muted ? <VolumeX size={13}/> : <Volume2 size={13}/>} {voice.muted ? "Unmute" : "Mute"}</button><button className="ghost-action" onClick={() => realtimeVoice.interrupt()}><Square size={12}/> Interrupt</button></>}<button className="ghost-action" onClick={() => realtimeVoice.stop()}>Stop voice</button></div>}
        </div>}

        {projectContext && <details className="console-project-context"><summary>{projectContext.label} context attached</summary><pre>{projectContext.context}</pre><button className="ghost-action" onClick={() => setProjectContext(null)}>Remove context</button></details>}
        <div className="console-input-row">
          <textarea ref={inputRef} id="olympus-console-input" aria-label="Command to Olympus" rows={1} placeholder="Ask Olympus anything…" value={draft}
            onFocus={() => { if (mode === "dormant") showLive(); }} onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
          <button type="button" className="voice-mic-button" aria-label={microphoneActive ? "Stop voice and microphone" : "Start voice conversation"} aria-pressed={microphoneActive} data-live={micLive || undefined} title={microphoneActive ? "Microphone live · Ctrl+Shift+M to stop" : "Microphone · Ctrl+Shift+M"} onClick={() => { if (microphoneActive) realtimeVoice.stop(); else { voicePreview.stop(); realtimeVoice.stop(); void realtimeVoice.start(); } }}>{microphoneActive ? <MicOff size={16}/> : <Mic size={16}/>}</button>
          <button type="button" className="send-button" aria-label="Send command" onClick={submit} disabled={!draft.trim() || pending || !voiceSettingsReady}><ChevronRight size={18} /></button>
        </div>
      </div>
    </section>
  );
}

const PLAYBACK_LABEL: Record<string, string> = {
  interrupted: "Playback interrupted · some words may not have played",
  unavailable: "Audio unavailable · text preserved",
  pending: "Preparing audio",
  completed: "Played",
  skipped: "Not spoken (Text replies)"
};

const ConversationBubble = memo(function ConversationBubble({
  message,
  onNoteThis,
  onSaveMemory, sameSpeaker = false, live = false, speaking = false, latest = false, textReplies = false, quietPlayback = "Not spoken"
}: {
  message: ConversationMessage;
  sameSpeaker?: boolean; live?: boolean; speaking?: boolean;
  /** The newest settled message stays open: it is what the operator is reading. */
  latest?: boolean;
  textReplies?: boolean;
  /** Receipt for an output that has no playback attempt recorded. */
  quietPlayback?: string;
  onNoteThis: (message: ConversationMessage) => void;
  onSaveMemory: (message: ConversationMessage) => void;
}) {
  const output = message.voice?.kind === "output" ? message.voice : undefined;
  const spoken = output?.spokenResponse;
  const briefing = isBriefing(message);
  // The written answer leads; the spoken abstraction is a caption beneath it
  // (review U6). Nothing that was attempted is ever reported as unconfirmed.
  const playback = speaking ? "Playing" : output?.playback ? PLAYBACK_LABEL[output.playback] ?? quietPlayback
    : textReplies ? "Not spoken (Text replies)" : quietPlayback;
  return (
    <article className={`conversation-bubble ${message.role}`} data-message-id={message.id} data-same-speaker={sameSpeaker} data-live={live || undefined}
      data-kind={briefing ? "briefing" : undefined} aria-label={message.role === "user" ? "You" : briefing ? "Olympus opening briefing" : message.role === "assistant" ? "Olympus" : "System event"}>
      <p className="console-message-label">
        {message.role === "assistant" && <span className="console-omega" aria-hidden="true">Ω</span>}
        {message.role === "user" ? "YOU" : message.role === "assistant" ? "OLYMPUS" : "SYSTEM"}
        {briefing ? <span className="console-briefing-label">Opening briefing · from project state, no model</span>
          : <span className="console-modality" title={message.voice ? "Voice message" : "Typed message"}>{message.voice ? <Mic size={10} aria-label="Voice"/> : <Keyboard size={10} aria-label="Text"/>}</span>}
        {live && <span className="console-turn-state">Listening</span>}
        {speaking && <span className="console-turn-state">Speaking</span>}
      </p>
      {message.role === "user" ? <p className="console-command-text">{message.content}</p> : <ResponseText text={message.content} unrestricted={briefing || latest}/>}
      {output && <div className="console-audio-footer">
        {spoken && <ReplayVoice text={spoken} messageId={message.id}/>}
        <small className="console-playback">{playback}</small>
        {spoken && spoken.trim() !== message.content.trim() && <details className="console-spoken-summary"><summary>Spoken summary</summary><p>{spoken}</p></details>}
        {output.audioTranscript && output.audioTranscript.trim() !== spoken?.trim() && <details><summary>Playback details</summary><p>{output.audioTranscript}</p></details>}
      </div>}
      {message.voice?.requiresConfirmation && <p className="conversation-notice">Authorization required. Review and confirm the exact scope in the project’s existing approval controls.</p>}
      {message.notice && (
        <p className={`conversation-notice conversation-notice--${message.notice.kind}`}>
          {message.notice.message}
        </p>
      )}
      {message.mail && message.mail.length>0 && <details className="section-copy">
        <summary>Gmail evidence supplied ({message.mail.length})</summary>
        <p>Cached communication evidence; may include only part of a thread. Claims are attributable to the sender, not operator commitments.</p>
        {message.mail.map(source=><details key={`${source.accountId}-${source.messageId}`}><summary>{source.sender} · {source.subject}</summary><p>{formatWhen(source.timestamp)}</p><pre className="gmail-evidence">{source.excerpt}</pre>
          <details className="console-technical"><summary>Source identifiers</summary><p>Gmail message {source.messageId} · thread {source.threadId}</p><p>Retrieved {formatWhen(source.retrievedAt, { withDate: true })} · fingerprint {source.fingerprint} · {source.bodyStatus}</p></details></details>)}
      </details>}
      {message.research && message.research.length > 0 && <details className="section-copy console-research">
        <summary>Research supplied to this reply ({message.research.length})</summary>
        <p>These are source excerpts supplied to Olympus, not a claim that every source supports its answer.</p>
        {message.research.map(source => <div className="console-research-source" key={source.sourceFile}>
          <details>
            <summary>{source.title} — {source.stance}</summary>
            <p>{source.sourceDate ?? "Undated"} · {source.origin ?? "Origin unspecified"} · {source.truncated ? "Partial excerpt" : "Full body"}</p>
            <p className="console-research-path">{source.sourceFile}</p>
            <blockquote>{source.excerpt}</blockquote>
          </details>
          {/* The fingerprint is the one stored with this reply, so the library
              can say when the entry has changed since. */}
          <button type="button" className="ghost-action console-research-open" aria-label={`Open ${source.title} in the library`}
            onClick={() => openResearchEntry({ sourceFile: source.sourceFile, excerpt: source.excerpt, fingerprint: source.fingerprint })}>Open in library</button>
        </div>)}
      </details>}
      {!live && <div className="conversation-bubble-footer">
        <small className="tabular-data console-message-meta">
          {message.at ? <time dateTime={message.at} title={formatWhen(message.at, { withDate: true })}>{formatWhen(message.at)}</time> : message.timestamp}
          {message.request && <span className="message-model" title={routeTitle(message.request)}> · {routeLabel(message.request)}</span>}
        </small>
        <span className="console-quiet-actions">
          {message.role !== "system" && <button type="button" className="observation-seed" onClick={() => onSaveMemory(message)}>Save memory</button>}
          {message.role === "assistant" && (
            <button type="button" className="observation-seed" onClick={() => onNoteThis(message)}>
              Note observation
            </button>
          )}
        </span>
      </div>}
    </article>
  );
});

function ReplayVoice({text,messageId}:{text:string;messageId:string}) {
  const voice=useVoiceState();
  return <button type="button" className="console-replay" disabled={!text || voice.connecting || voice.phase === "PROCESSING"} title="Replay this spoken summary; the microphone stays off unless already enabled" onClick={() => {voicePreview.stop();void realtimeVoice.replay(text,messageId);}}><Volume2 size={12} aria-hidden="true"/>Replay</button>;
}

function ResponseText({text, unrestricted = false}:{text:string; unrestricted?:boolean}) {
  const [expanded,setExpanded]=useState(false);
  const [overflows,setOverflows]=useState(false);
  const content=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=content.current;if(!node)return;
    const measure=()=>setOverflows(node.scrollHeight>220);
    measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[text]);
  return <><div ref={content} className="console-markdown console-response-preview" data-collapsed={!unrestricted && !expanded || undefined}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={consoleMarkdownComponents}>{text}</ReactMarkdown>
  </div>{!unrestricted && overflows && <button className="console-expand-response" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded ? "Show less ↑" : "View full response ↓"}</button>}</>;
}
