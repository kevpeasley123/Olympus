import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConversationMessage } from "../../types";
import { isTauriRuntime } from "../../services/launcher";

export function MemoryPromotion({ message, onClose }: { message: ConversationMessage; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState(message.content);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState(false);
  const tooLong = Array.from(text.trim()).length > 2_000 || Array.from(title.trim()).length > 120;

  async function save() {
    if (pending || saved || tooLong || !title.trim() || !text.trim()) return;
    if (!isTauriRuntime()) { setStatus("Memory is saved from the desktop app."); return; }
    setPending(true);
    setStatus("");
    try {
      const result = await invoke<{ written: boolean; warning: string | null }>("promote_chat_memory", {
        request: { messageId: message.id, title, text }
      });
      setSaved(result.written);
      setStatus(result.written ? result.warning ?? "Saved to the Decision Log. Available as historical memory on your next turn." : "Nothing was added.");
    } catch (error) {
      setStatus(String(error));
    } finally { setPending(false); }
  }

  return <div className="observation-composer memory-composer">
    <p className="observation-label">Save chat memory</p>
    <p className="section-copy">Review what should be remembered. The Decision Log keeps this text and its conversation source. Saving memory does not authorize agent work.</p>
    <label className="observation-label" htmlFor="memory-title">Title</label>
    <input id="memory-title" className="observation-input" value={title} disabled={pending || saved} onChange={e => setTitle(e.target.value)} autoFocus />
    <label className="observation-label" htmlFor="memory-text">Memory text</label>
    <textarea id="memory-text" className="observation-input" rows={5} value={text} disabled={pending || saved} onChange={e => setText(e.target.value)} />
    <div className="observation-actions">
      <span className="observation-count tabular-data">{Array.from(text.trim()).length}/2,000</span>
      <button type="button" className="ghost-action" disabled={pending} onClick={onClose}>{saved ? "Close" : "Cancel"}</button>
      <button type="button" className="ghost-action" disabled={pending || saved || tooLong || !title.trim() || !text.trim()} onClick={() => void save()}>
        {pending ? "Waiting for review…" : "Review and save"}
      </button>
    </div>
    {tooLong && <p className="section-copy">Use a title up to 120 characters and memory text up to 2,000 characters.</p>}
    {status && <p className="section-copy" role="status">{status}</p>}
  </div>;
}
