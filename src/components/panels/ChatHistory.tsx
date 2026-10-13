import { Fragment, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, History, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { chatsAvailable, listConversations, searchConversations } from "../../services/conversations";
import type { ChatSession, ConversationSearchHit, ConversationSummary } from "../../services/conversations";
import { formatWhen } from "../../services/time";
import "./chatHistory.css";

export interface ChatControls {
  session: ChatSession;
  /** Starts a fresh chat; returns why it could not, or null. */
  onNew: (temporary?: boolean) => string | null;
  onOpen: (id: string, title: string) => Promise<string | null>;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** The list knows a newer title for the open chat (a rename, the memory pass). */
  onTitleSeen?: (id: string, title: string) => void;
}

/** The open chat's name and the controls that change which chat is open. */
export function ChatSessionBar({ chats, title, disabled, open, onToggle, onOpened }: {
  chats: ChatControls; title: string; disabled: boolean; open: boolean;
  onToggle: () => void; onOpened: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const temporary = chats.session.temporary;
  const start = (asTemporary: boolean) => { const reason = chats.onNew(asTemporary); setNotice(reason); if (!reason) onOpened(); };
  return <div className="chat-session-bar" data-temporary={temporary || undefined}>
    <p className="chat-session-title" title={title}>{temporary && <EyeOff size={12} aria-hidden="true" />}<span>{title}</span>
      {temporary && <small>Not saved · no memory</small>}</p>
    <div className="chat-session-actions">
      <button type="button" className="ghost-icon-action" aria-pressed={open} aria-label="Chats" title="Chats · search earlier conversations" onClick={onToggle}><History size={14} /></button>
      <button type="button" className="ghost-icon-action" aria-label="New chat" title="New chat" disabled={disabled} onClick={() => start(false)}><MessageSquarePlus size={14} /></button>
      <button type="button" className="ghost-icon-action" aria-pressed={temporary} aria-label="Temporary chat"
        title={temporary ? "Leave temporary chat (it is discarded)" : "Temporary chat · not saved, not written to Obsidian, no memory"}
        disabled={disabled} onClick={() => start(!temporary)}><EyeOff size={14} /></button>
    </div>
    {notice && <p className="chat-session-notice" role="status">{notice}</p>}
  </div>;
}

/** Earlier chats, newest first, and a search over every stored message. */
export function ChatHistory({ chats, disabled, onClose, onOpened }: {
  chats: ChatControls; disabled: boolean; onClose: () => void; onOpened: () => void;
}) {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ConversationSearchHit[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const available = chatsAvailable();
  const { onTitleSeen } = chats;
  const currentId = chats.session.id;

  const refresh = () => listConversations().then(rows => {
    setList(rows); setError(null);
    const current = rows.find(row => row.id === currentId);
    if (current?.title) onTitleSeen?.(current.id, current.title);
  }).catch(reason => setError(`Chats could not be read (${String(reason)}).`));
  useEffect(() => { void refresh(); searchRef.current?.focus(); }, []);
  useEffect(() => {
    if (!query.trim()) { setHits(null); return; }
    let stale = false;
    const timer = window.setTimeout(() => {
      searchConversations(query).then(found => { if (!stale) setHits(found); })
        .catch(reason => { if (!stale) setError(`Search failed (${String(reason)}).`); });
    }, 180);
    return () => { stale = true; window.clearTimeout(timer); };
  }, [query]);

  async function open(id: string, title: string) {
    if (id === currentId) { onOpened(); return; }
    const reason = await chats.onOpen(id, title);
    if (reason) setError(reason); else onOpened();
  }
  async function rename(id: string, title: string) {
    try { await chats.onRename(id, title); setRenaming(null); await refresh(); }
    catch (reason) { setError(String(reason)); }
  }
  async function remove(id: string) {
    try { await chats.onDelete(id); setConfirming(null); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  return <section className="chat-history" aria-label="Chats">
    <header className="chat-history-head">
      <input ref={searchRef} type="search" aria-label="Search chats" placeholder="Search chats…" value={query} disabled={!available}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); } }} />
      <button type="button" className="ghost-icon-action" aria-label="Close chats" onClick={onClose}><X size={14} /></button>
    </header>
    {!available && <p className="chat-history-empty">Chats are kept in the desktop app. This preview has one local conversation.</p>}
    {error && <p className="chat-history-error" role="alert">{error}</p>}
    {hits ? <ol className="chat-history-list" aria-label="Search results">
      {hits.length === 0 && <li className="chat-history-empty">Nothing matches.</li>}
      {hits.map(hit => <li key={hit.messageId}>
        <button type="button" className="chat-history-open" disabled={disabled} onClick={() => void open(hit.conversationId, hit.title)}>
          <strong>{hit.title || "Untitled chat"}</strong>
          <span className="chat-history-snippet">{hit.role === "user" ? "You: " : ""}<Snippet text={hit.snippet} /></span>
          <time dateTime={hit.at}>{formatWhen(hit.at, { withDate: true })}</time>
        </button>
      </li>)}
    </ol> : <ol className="chat-history-list" aria-label="Earlier chats">
      {available && list?.length === 0 && <li className="chat-history-empty">No saved chats yet.</li>}
      {list?.map(chat => <li key={chat.id} data-current={chat.id === currentId || undefined}>
        {renaming === chat.id ? <form className="chat-history-rename" onSubmit={event => { event.preventDefault(); void rename(chat.id, new FormData(event.currentTarget).get("title") as string); }}>
          <input name="title" aria-label="Chat title" defaultValue={chat.title} maxLength={120} autoFocus
            onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setRenaming(null); } }} />
          <button type="submit" className="ghost-action">Save</button>
          <button type="button" className="ghost-action" onClick={() => setRenaming(null)}>Cancel</button>
        </form> : <Fragment>
          <button type="button" className="chat-history-open" disabled={disabled && chat.id !== currentId} onClick={() => void open(chat.id, chat.title)}
            aria-current={chat.id === currentId || undefined}>
            <strong>{chat.title || "Untitled chat"}</strong>
            {chat.summary && <span className="chat-history-snippet">{chat.summary}</span>}
            <time dateTime={chat.updatedAt}>{formatWhen(chat.updatedAt, { withDate: true })} · {chat.messageCount} messages</time>
          </button>
          <div className="chat-history-row-actions">
            <button type="button" className="ghost-icon-action" aria-label={`Rename ${chat.title || "chat"}`} title="Rename" onClick={() => { setConfirming(null); setRenaming(chat.id); }}><Pencil size={12} /></button>
            <button type="button" className="ghost-icon-action" aria-label={`Delete ${chat.title || "chat"}`} title="Delete" onClick={() => { setRenaming(null); setConfirming(chat.id); }}><Trash2 size={12} /></button>
          </div>
        </Fragment>}
        {confirming === chat.id && <div className="chat-history-confirm" role="group" aria-label="Confirm delete">
          <p>Delete this chat from Olympus? Its Obsidian note, and anything Olympus learned from it, stay until you remove them there.</p>
          <button type="button" className="ghost-action destructive-action" onClick={() => void remove(chat.id)}>Delete</button>
          <button type="button" className="ghost-action" onClick={() => setConfirming(null)}>Cancel</button>
        </div>}
      </li>)}
    </ol>}
  </section>;
}

/** The FTS5 snippet with its match markers (U+0002 … U+0003) shown as marks. */
function Snippet({ text }: { text: string }) {
  return <>{text.split(/(\u0002[^\u0003]*\u0003)/).map((part, index) => part.startsWith("\u0002")
    ? <mark key={index}>{part.slice(1, -1)}</mark> : <Fragment key={index}>{part}</Fragment>)}</>;
}
