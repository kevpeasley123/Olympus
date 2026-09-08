import { ChevronRight, NotebookPen, X, History } from "lucide-react";
import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

const consoleMarkdownComponents: import("react-markdown").Components = {
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  img: ({ alt, src }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || "View image"}</a>
};

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  onRecordObservation: (text: string) => Promise<ObsidianActionResult>;
  pending?: boolean;
  error?: string | null;
}
function collapse(text: string): string { return text.split(/\s+/).filter(Boolean).join(" "); }

export function ChatPanel({ messages, onSendMessage, onRecordObservation, pending = false, error = null }: ChatPanelProps) {
  const [mode, setMode] = useState<ConsoleMode>("dormant");
  const [draft, setDraft] = useState("");
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
  const status = pending ? (streamText ? "RESPONDING" : "PROCESSING") : error ? "RESPONSE ERROR" : responseReady ? "RESPONSE READY" : "OLYMPUS READY";

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
  function submit() {
    if (!draft.trim() || pending) return;
    waitingForReply.current = true;
    showLive(); onSendMessage(draft); setDraft("");
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
    const focusConsole = () => inputRef.current?.focus();
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.altKey) {
        if (document.querySelector('[aria-modal="true"]')) return;
        event.preventDefault(); focusConsole();
      }
    };
    window.addEventListener("olympus:focus-console", focusConsole);
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("olympus:focus-console", focusConsole); window.removeEventListener("keydown", shortcut); };
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
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
            {visibleMessages.map(message => <ConversationBubble key={message.id} message={message}
              onNoteThis={noteMessage} onSaveMemory={saveMessage} />)}
            {pending && <article className="conversation-bubble assistant console-stream" data-message-id="stream">
              <p className="console-message-label">OLYMPUS</p>
              {streamText ? <div className="console-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={consoleMarkdownComponents}>{streamText}</ReactMarkdown></div> : <p className="console-processing">Processing command…</p>}
            </article>}
            {error && <p className="console-error" role="alert">{error}</p>}
            {visibleMessages.length === 0 && !pending && <p className="console-empty">The console is ready for your command.</p>}
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
          <span role="status" className="console-status">{status}</span>
          <button type="button" className="ghost-icon-action" aria-label="Open conversation history" title="Conversation history" onClick={showHistory}><History size={14} /></button>
        </div>
        <div className="console-input-row">
          <textarea ref={inputRef} aria-label="Command to Olympus" rows={1} placeholder="Ask Olympus anything…" value={draft}
            onFocus={() => { if (mode === "dormant") showLive(); }} onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
          <button type="button" className="send-button" aria-label="Send command" onClick={submit} disabled={!draft.trim() || pending}><ChevronRight size={18} /></button>
        </div>
      </div>
    </section>
  );
}

const ConversationBubble = memo(function ConversationBubble({
  message,
  onNoteThis,
  onSaveMemory
}: {
  message: ConversationMessage;
  onNoteThis: (message: ConversationMessage) => void;
  onSaveMemory: (message: ConversationMessage) => void;
}) {
  return (
    <article className={`conversation-bubble ${message.role}`} data-message-id={message.id}>
      <p className="console-message-label">{message.role === "user" ? "COMMAND" : message.role === "assistant" ? "OLYMPUS" : "SYSTEM"}</p>
      {message.role === "user" ? <p className="console-command-text"><span aria-hidden="true">› </span>{message.content}</p> :
        <div className="console-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={consoleMarkdownComponents}>{message.content}</ReactMarkdown></div>}
      {/* Appended below the text, never in place of it. Text that streamed is
          text that happened; retracting it would leave no way to tell a misread
          from a broken app. The distinct treatment is the point — this is
          Olympus speaking about the turn, not the assistant. */}
      {message.notice && (
        <p className={`conversation-notice conversation-notice--${message.notice.kind}`}>
          {message.notice.message}
        </p>
      )}
      {message.research && message.research.length > 0 && <details className="section-copy">
        <summary>Research supplied to this reply ({message.research.length})</summary>
        <p>These are source excerpts supplied to Olympus, not a claim that every source supports its answer.</p>
        {message.research.map(source => <details key={source.sourceFile}>
          <summary>{source.title} — {source.stance}</summary>
          <p>{source.sourceDate ?? "Undated"} · {source.origin ?? "Origin unspecified"} · {source.truncated ? "Partial excerpt" : "Full body"}</p>
          <p>{source.sourceFile}</p>
          <blockquote>{source.excerpt}</blockquote>
        </details>)}
      </details>}
      <div className="conversation-bubble-footer">
        {message.role !== "system" && <button type="button" className="observation-seed" onClick={() => onSaveMemory(message)}>Save memory</button>}
        {message.role === "assistant" && (
          <button type="button" className="observation-seed" onClick={() => onNoteThis(message)}>
            Note observation
          </button>
        )}
        <small className="tabular-data">{message.timestamp}</small>
      </div>
    </article>
  );
});
