import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Modal } from "../../Modal";

export interface XImportPreview {
  token: string; kind: "article" | "post"; title: string; author: string; handle: string;
  created: string | null; sourceUrl: string; markdown: string; imageCount: number;
  evaluation: { kind: string; kindLabel: string; summary: string; topics: string[]; audience: string; imageNotes: string[]; model: string; imagesSeen: number } | null;
  evaluationError: string | null;
}
export interface XImportClient {
  preview: (url: string) => Promise<XImportPreview>;
  save: (token: string, whyKept: string | null) => Promise<string>;
}
const tauriClient: XImportClient = {
  preview: url => invoke("x_import_preview", { url }),
  save: (token, whyKept) => invoke("x_import_save", { token, whyKept, project: null }),
};

/**
 * Paste an X post or article link; Olympus reads it, Claude classifies it from
 * the text and images, and nothing is written until Save (docs/X-IMPORT.md).
 */
export function XImportDialog({ onClose, onSaved, client = tauriClient }: { onClose: () => void; onSaved: (path: string) => void; client?: XImportClient }) {
  const [url, setUrl] = useState("");
  const [why, setWhy] = useState("");
  const [preview, setPreview] = useState<XImportPreview | null>(null);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    if (!url.trim() || busy) return;
    setBusy("reading"); setError(null); setPreview(null);
    try { setPreview(await client.preview(url.trim())); }
    catch (e) { setError(String(e)); }
    finally { setBusy(null); }
  }
  async function save() {
    if (!preview || busy) return;
    setBusy("saving"); setError(null);
    try { onSaved(await client.save(preview.token, why.trim() || null)); }
    catch (e) { setError(String(e)); setBusy(null); }
  }
  const e = preview?.evaluation;

  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Import from X" showTitle={false} className="library-add-entry x-import" initialFocus="#x-import-url" dismissOnBackdrop={!busy}>
    <header className="pantheon-modal-header">
      <div className="pantheon-modal-title-group">
        <h2 className="pantheon-modal-title">Import from X</h2>
        <span className="pantheon-modal-meta">An article or post, with its images and code</span>
      </div>
      <button type="button" className="pantheon-modal-close" onClick={onClose} aria-label="Close" title="Close (Esc)" disabled={!!busy}>×</button>
    </header>
    <div className="pantheon-modal-body pantheon-modal-body--form">
      <form className="x-import-link" onSubmit={event => { event.preventDefault(); void read(); }}>
        <label className="form-label" htmlFor="x-import-url">Link to the post</label>
        <div>
          <input id="x-import-url" className="form-input" type="url" placeholder="https://x.com/name/status/…" value={url} onChange={event => setUrl(event.target.value)} disabled={!!busy} spellCheck={false}/>
          <button type="submit" className="form-button form-button--ghost" disabled={!url.trim() || !!busy}>{busy === "reading" ? "Reading…" : preview ? "Read again" : "Read"}</button>
        </div>
        {busy === "reading" && <span className="form-helper" role="status">Reading the post and having Claude look over its text and images. This can take a minute.</span>}
      </form>
      {error && <p className="pantheon-error" role="alert">{error}</p>}
      {preview && <section className="x-import-preview" aria-label="Preview">
        <p className="x-import-byline">{preview.kind === "article" ? "Article" : "Post"} by {preview.author || preview.handle} <span>@{preview.handle}{preview.created ? ` · ${preview.created}` : ""} · {preview.imageCount} image{preview.imageCount === 1 ? "" : "s"}</span></p>
        <h3>{preview.title}</h3>
        {e ? <div className="x-import-evaluation">
          <span className="x-import-kind">{e.kindLabel}</span>
          <p>{e.summary}</p>
          {e.topics.length > 0 && <ul aria-label="Topics">{e.topics.map(topic => <li key={topic}>{topic}</li>)}</ul>}
          <small>{e.audience ? `For ${e.audience}. ` : ""}Classified by {e.model} from the text and {e.imagesSeen} of {preview.imageCount} images.</small>
        </div> : <p className="x-import-unclassified" role="status">Not classified: {preview.evaluationError ?? "the evaluation did not complete"}. You can still save it.</p>}
        <details className="x-import-body"><summary>What will be saved</summary><pre>{preview.markdown}</pre></details>
        <div className="form-field">
          <label className="form-label" htmlFor="x-import-why">Why keep it <span className="form-optional">(optional)</span></label>
          <input id="x-import-why" className="form-input" value={why} onChange={event => setWhy(event.target.value)} disabled={!!busy}/>
        </div>
      </section>}
    </div>
    <footer className="pantheon-modal-footer library-add-footer">
      <span className="pantheon-modal-footer-hint">{preview ? "Saves the note and its images to 02 - Research." : "Nothing is saved until you choose Save."}</span>
      <button type="button" className="form-button form-button--primary" onClick={() => void save()} disabled={!preview || !!busy}>{busy === "saving" ? "Saving…" : "Save to research"}</button>
    </footer>
  </Modal>;
}
