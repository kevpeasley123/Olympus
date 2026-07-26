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
  error = null
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  // null closes the composer; "" opens it empty. Distinguishing the two is what
  // lets an assistant message prefill it without also opening it on every edit.
  const [observation, setObservation] = useState<string | null>(null);
  const [observationStatus, setObservationStatus] = useState<ObsidianActionResult | null>(null);
  const [recording, setRecording] = useState(false);

  function submit() {
    if (!draft.trim() || pending) return;
    onSendMessage(draft);
    setDraft("");
  }

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
    <section className="dashboard-panel conversation-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>Chat</h2>
        </div>
        <div className="conversation-header-actions">
          <button
            type="button"
            className="ghost-icon-action"
            title="Record an observation in the vault"
            aria-label="Record an observation in the vault"
            onClick={() => (observation === null ? openComposer("") : setObservation(null))}
          >
            <NotebookPen size={15} />
          </button>
          <Compass size={18} className="panel-icon" />
        </div>
      </div>
      <div className="conversation-thread">
        {messages.map((message) => (
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
