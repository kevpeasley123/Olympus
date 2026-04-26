import { ChevronRight, Compass } from "lucide-react";
import type { ConversationMessage } from "../../types";

interface ChatPanelProps {
  messages: ConversationMessage[];
}

export function ChatPanel({ messages }: ChatPanelProps) {
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
        <input placeholder="Type a message..." disabled />
        <button className="send-button" disabled>
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
