import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { isTauriRuntime } from "../../services/launcher";
import { formatWhen } from "../../services/time";

interface ChatMemorySwitches {
  saveChats: boolean;
  learn: boolean;
  useMemory: boolean;
}

interface ChatMemoryStatus extends ChatMemorySwitches {
  savedChats: number;
  earlierWaiting: number;
  earlierQueued: number;
  stoppedChats: number;
  lastLearnedAt: string | null;
  lastError: string | null;
  memoryNote: string;
  chatsFolder: string;
}

/**
 * Preferences > Memory (docs/CONVERSATIONS-AND-MEMORY.md). Three switches, what
 * they cost, and the one-time offer to learn from chats kept before memory existed.
 */
export function MemorySettings() {
  const available = isTauriRuntime();
  const [status, setStatus] = useState<ChatMemoryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => invoke<ChatMemoryStatus>("chat_memory_status").then(setStatus).catch(reason => setError(String(reason)));
  useEffect(() => { if (available) void refresh(); }, [available]);

  async function change(patch: Partial<ChatMemorySwitches>) {
    if (!status) return;
    setBusy(true);
    try {
      const { saveChats, learn, useMemory } = { ...status, ...patch };
      setStatus(await invoke<ChatMemoryStatus>("set_chat_memory", { settings: { saveChats, learn, useMemory } }));
      setError(null);
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  async function learnEarlier() {
    setBusy(true);
    try { await invoke<number>("learn_from_earlier_chats"); setConfirming(false); await refresh(); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }

  const waiting = status?.earlierWaiting ?? 0;
  return <>
    <h3 id="preferences-memory" className="preferences-section__title">Memory</h3>
    {!available && <p className="voice-settings-hint">Chats and memory are kept by the desktop app.</p>}
    {available && <>
      <label className="voice-setting-row">Save chats to Obsidian
        <input type="checkbox" checked={status?.saveChats ?? false} disabled={!status || busy} onChange={event => void change({ saveChats: event.target.checked })} /></label>
      <label className="voice-setting-row">Learn from chats
        <input type="checkbox" checked={status?.learn ?? false} disabled={!status || busy} onChange={event => void change({ learn: event.target.checked })} /></label>
      <label className="voice-setting-row">Use what Olympus remembers
        <input type="checkbox" checked={status?.useMemory ?? false} disabled={!status || busy} onChange={event => void change({ useMemory: event.target.checked })} /></label>
      <p className="voice-settings-hint">
        Each chat becomes a note in <code>{status?.chatsFolder ?? "10 - Conversations"}</code>. After a chat has been quiet for ten minutes,
        Olympus updates <code>{status?.memoryNote ?? "09 - System/Olympus Memory.md"}</code>: one paid OpenAI request per chat. Edit either note
        in Obsidian and your version is kept. Temporary chats are never saved or learned from. Turning learning off stops new updates; it does not delete the note.
      </p>
      {status && <p className="voice-settings-hint" role="status">
        {status.savedChats} {status.savedChats === 1 ? "chat" : "chats"} saved.
        {status.lastLearnedAt ? ` Last learned from a chat ${formatWhen(status.lastLearnedAt, { withDate: true })}.` : " Nothing learned yet."}
        {status.lastError ? ` The last attempt failed (${status.lastError}); it is retried after half an hour, then less often.` : ""}
      </p>}
      {status && status.stoppedChats > 0 && <p className="voice-settings-hint" role="status">
        Stopped retrying {status.stoppedChats} {status.stoppedChats === 1 ? "chat" : "chats"} after repeated failures. Turn Learn from chats off and on to try again.
      </p>}
      {status && status.earlierQueued > 0 && <p className="voice-settings-hint">Learning from {status.earlierQueued} earlier {status.earlierQueued === 1 ? "chat" : "chats"} in the background, oldest first.</p>}
      {status && waiting > 0 && !confirming && <div className="voice-setting-row">
        <span>{waiting} earlier {waiting === 1 ? "chat is" : "chats are"} saved but not learned from.</span>
        <button type="button" className="ghost-action" disabled={busy || !status.learn} title={status.learn ? undefined : "Turn on Learn from chats first"} onClick={() => setConfirming(true)}>Learn from them</button>
      </div>}
      {confirming && <div className="voice-setting-row" role="group" aria-label="Confirm learning from earlier chats">
        <span>Sends each of the {waiting} chats to OpenAI, oldest first: at least {waiting} paid {waiting === 1 ? "request" : "requests"}, more for long chats.</span>
        <span className="memory-confirm-actions"><button type="button" className="ghost-action" disabled={busy} onClick={() => void learnEarlier()}>Learn from {waiting} {waiting === 1 ? "chat" : "chats"}</button>
          <button type="button" className="ghost-action" onClick={() => setConfirming(false)}>Cancel</button></span>
      </div>}
      {error && <p className="voice-settings-hint action-feedback warning" role="alert">{error}</p>}
    </>}
  </>;
}
