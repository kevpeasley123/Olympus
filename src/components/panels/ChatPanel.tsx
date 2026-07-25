import { ChevronRight, Compass } from "lucide-react";
import { useState } from "react";
import type { ConversationMessage } from "../../types";

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
  pending?: boolean;
  error?: string | null;
}

export function ChatPanel({ messages, onSendMessage, pending = false, error = null }: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  function submit() {
    if (!draft.trim() || pending) return;
    onSendMessage(draft);
    setDraft("");
  }

  return (
    <section className="dashboard-panel conversation-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>Chat</h2>
        </div>
        <Compass size={18} className="panel-icon" />
      </div>
      <div className="conversation-thread">
        {messages.map((message) => (
          <ConversationBubble key={message.id} message={message} />
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

function ConversationBubble({ message }: { message: ConversationMessage }) {
  return (
    <article className={`conversation-bubble ${message.role}`}>
      <p>{message.content}</p>
      <small className="tabular-data">{message.timestamp}</small>
    </article>
  );
}
