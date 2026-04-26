import { ChevronRight, Compass } from "lucide-react";
import { useState } from "react";
import type { ConversationMessage } from "../../types";

interface ChatPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ messages, onSendMessage }: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  function submit() {
    if (!draft.trim()) return;
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
      </div>
      <div className="conversation-input-shell">
        <input
          placeholder="Ask Chat about Pantheon knowledge..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button className="send-button" onClick={submit} disabled={!draft.trim()}>
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
