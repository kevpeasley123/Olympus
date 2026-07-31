import { ChevronRight, Compass, NotebookPen } from "lucide-react";
import { useState } from "react";
import type { ConversationMessage } from "../../types";
import type { ObsidianActionResult } from "../../services/obsidian";
import { OBSERVATION_MAX_CHARS } from "../../services/observations";

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  onRecordObservation: (text: string) => Promise<ObsidianActionResult>;
  pending?: boolean;
  error?: string | null;
  /**
   * Command mode only: show the last exchange rather than the whole
   * transcript. Defaults off, so Project and Research are untouched — a wall of
   * transcript is correct in the modes you lean into, and the loudest thing on
   * screen in the one that is deliberately sparse.
   */
  compact?: boolean;
}

/** The last user turn and everything after it — one exchange, not one message. */
function lastExchange(messages: ConversationMessage[]): ConversationMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages.slice(index);
    }
  }
  return messages.slice(-1);
}

/** One claim per entry, so the gate's capped diff preview shows all of it. */
function collapse(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

export function ChatPanel({
  messages,
  onSendMessage,
  onRecordObservation,
  pending = false,
  error = null,
  compact = false
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  // Local, so leaving Command and coming back re-collapses it. That is right
  // for a mode meant to be glanced at.
  const [expanded, setExpanded] = useState(false);
  // null closes the composer; "" opens it empty. Distinguishing the two is what
  // lets an assistant message prefill it without also opening it on every edit.
  const [observation, setObservation] = useState<string | null>(null);
  const [observationStatus, setObservationStatus] = useState<ObsidianActionResult | null>(null);
  const [recording, setRecording] = useState(false);

  function submit() {
    if (!draft.trim() || pending) return;
    onSendMessage(draft);
    setDraft("");
    // Sending is the moment you start caring about the reply.
    setExpanded(true);
  }

  const collapsed = compact && !expanded;
  const visibleMessages = collapsed ? lastExchange(messages) : messages;
  const hiddenCount = messages.length - visibleMessages.length;

  function openComposer(seed: string) {
    setObservation(collapse(seed).slice(0, OBSERVATION_MAX_CHARS));
    setObservationStatus(null);
  }

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
    // Dense: the thread is prose, and the background image must not read
    // behind it.
    <section
      className={`dashboard-panel conversation-panel surface-dense ${
        collapsed ? "conversation-panel--collapsed" : ""
      }`}
    >
      <div className="panel-head">
        <span className="panel-head__icon">
          <Compass size={15} />
        </span>
        <p className="panel-head__title">Chat</p>
        <span className="panel-head__meta" />
        <div className="panel-head__actions">
          <button
            type="button"
            className="ghost-icon-action"
            title="Record an observation in the vault"
            aria-label="Record an observation in the vault"
            onClick={() => (observation === null ? openComposer("") : setObservation(null))}
          >
            <NotebookPen size={15} />
          </button>
        </div>
      </div>
      <div className="conversation-thread">
        {collapsed && hiddenCount > 0 ? (
          <button
            type="button"
            className="conversation-expand"
            onClick={() => setExpanded(true)}
          >
            Show {hiddenCount} earlier {hiddenCount === 1 ? "message" : "messages"}
          </button>
        ) : null}
        {visibleMessages.map((message) => (
          <ConversationBubble
            key={message.id}
            message={message}
            onNoteThis={() => openComposer(message.content)}
          />
        ))}
        {pending && (
          <article className="conversation-bubble assistant conversation-pending">
            <p>Thinking...</p>
          </article>
        )}
        {error && (
          <article className="conversation-bubble assistant conversation-error">
            <p>{error}</p>
          </article>
        )}
      </div>

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
              if (event.key === "Escape") {
                setObservation(null);
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

      <div className="conversation-input-shell">
        <input
          placeholder={pending ? "Waiting for a reply..." : "Ask Olympus anything..."}
          value={draft}
          disabled={pending}
          onFocus={() => setExpanded(true)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button className="send-button" onClick={submit} disabled={!draft.trim() || pending}>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

function ConversationBubble({
  message,
  onNoteThis
}: {
  message: ConversationMessage;
  onNoteThis: () => void;
}) {
  return (
    <article className={`conversation-bubble ${message.role}`}>
      <p>{message.content}</p>
      {/* Appended below the text, never in place of it. Text that streamed is
          text that happened; retracting it would leave no way to tell a misread
          from a broken app. The distinct treatment is the point — this is
          Olympus speaking about the turn, not the assistant. */}
      {message.notice && (
        <p className={`conversation-notice conversation-notice--${message.notice.kind}`}>
          {message.notice.message}
        </p>
      )}
      <div className="conversation-bubble-footer">
        {message.role === "assistant" && (
          <button type="button" className="observation-seed" onClick={onNoteThis}>
            Note this
          </button>
        )}
        <small className="tabular-data">{message.timestamp}</small>
      </div>
    </article>
  );
}
