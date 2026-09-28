import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../Modal";
import { PANTHEON_ORIGINS, PANTHEON_STANCES } from "../../../hooks/usePantheon";
import { formatWhen } from "../../../services/time";
import { useViewSlice, type ResearchEntryDraft } from "../../../state/viewState";
import type { LibraryProject } from "./EntryDetail";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  attachmentDisplayPath,
  blankDraft,
  changedDraftFields,
  draftRequest,
  isDraftDirty,
  type EntryDraftFields,
  type WritePantheonEntryRequest
} from "./libraryModel";

/** The IPC the form uses, injectable so the harness can fail a write on purpose. */
export interface AddEntryClient {
  pickAttachment(): Promise<{ token: string; fileName: string } | null>;
  extractPdfText(token: string): Promise<string>;
  saveAttachment(token: string): Promise<string>;
  writeEntry(request: WritePantheonEntryRequest): Promise<string>;
}

export const tauriAddEntryClient: AddEntryClient = {
  pickAttachment: () => invoke("pick_attachment_file"),
  extractPdfText: (token) => invoke("extract_pdf_text", { token }),
  saveAttachment: (token) => invoke("save_attachment_to_vault", { token }),
  writeEntry: (req) => invoke("write_pantheon_entry", { req })
};

const STANCE_TEXT: Record<string, string> = {
  endorsed: "Endorsed",
  provisional: "Provisional",
  disputed: "Disputed",
  unevaluated: "Unevaluated"
};

const ORIGIN_TEXT: Record<string, string> = {
  collected: "Collected",
  "olympus-found": "Found by Olympus"
};

interface AddEntryDialogProps {
  projects: LibraryProject[];
  onClose: () => void;
  onSaved: (path: string) => void;
  client?: AddEntryClient;
}

type Confirm = null | "close";

export function AddEntryDialog({ projects, onClose, onSaved, client = tauriAddEntryClient }: AddEntryDialogProps) {
  const [research, setResearch] = useViewSlice("research");
  const [blank] = useState(() => blankDraft());
  const [form, setForm] = useState<EntryDraftFields>(blank);
  const [restored, setRestored] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const kept = research.addEntryDraft ?? null;
  const offerRestore = Boolean(kept && !restored && isDraftDirty(kept, blankDraft(kept.sourceDate)));
  const changed = useMemo(() => changedDraftFields(form, blank), [form, blank]);
  const dirty = changed.length > 0;

  // A mode switch or navigation can unmount the dialog without a close. Typed
  // work goes to the session's view store rather than being dropped.
  const latest = useRef({ form, dirty, settled: false });
  latest.current = { ...latest.current, form, dirty };
  useEffect(() => () => {
    const { form: last, dirty: wasDirty, settled } = latest.current;
    if (!settled && wasDirty) keep(last);
  }, []);

  function keep(fields: EntryDraftFields) {
    setResearch((current) => ({ ...current, addEntryDraft: { ...fields, keptAt: new Date().toISOString() } }));
  }

  function settle(after: () => void) {
    latest.current.settled = true;
    after();
  }

  function update<K extends keyof EntryDraftFields>(key: K, value: EntryDraftFields[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (confirm) setConfirm(null);
  }

  // Escape, the backdrop, Cancel and × all come here: nothing typed is lost
  // without a choice (review U3).
  function requestClose() {
    if (submitting) return;
    if (confirm) {
      setConfirm(null);
      return;
    }
    if (dirty) {
      setConfirm("close");
      return;
    }
    settle(onClose);
  }

  function keepAndClose() {
    keep(form);
    settle(onClose);
  }

  function discardAndClose() {
    // Discarding a restored draft discards the kept copy too; discarding a
    // fresh form leaves an older kept draft where it was.
    if (restored) setResearch((current) => ({ ...current, addEntryDraft: null }));
    settle(onClose);
  }

  function restore() {
    if (!kept) return;
    const { keptAt: _keptAt, ...fields } = kept as ResearchEntryDraft;
    setForm(fields);
    setRestored(true);
    setError(null);
  }

  function discardKept() {
    setResearch((current) => ({ ...current, addEntryDraft: null }));
  }

  async function handlePickAttachment() {
    setAttachmentError(null);
    try {
      const picked = await client.pickAttachment();
      if (!picked) return;
      const filename = picked.fileName;
      const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        setAttachmentError(`File type not allowed. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}.`);
        return;
      }
      setForm((current) => ({
        ...current,
        attachment: { token: picked.token, originalFilename: filename, extension: ext },
        savedAttachmentPath: null
      }));
      setExtractedText(null);
      setExtractError(null);
      if (ext === "pdf") {
        setExtracting(true);
        try {
          const text = await client.extractPdfText(picked.token);
          if (!text || text.trim().length === 0) {
            setExtractedText("");
            setExtractError("No text extracted (likely a scanned PDF).");
          } else {
            setExtractedText(text);
          }
        } catch (err) {
          setExtractedText(null);
          setExtractError(String(err));
        } finally {
          setExtracting(false);
        }
      }
    } catch (err) {
      setAttachmentError(`Could not choose a file: ${err}`);
    }
  }

  function handleRemoveAttachment() {
    setForm((current) => ({ ...current, attachment: null, savedAttachmentPath: null }));
    setExtractedText(null);
    setExtractError(null);
    setAttachmentError(null);
    setExtracting(false);
  }

  function handleInsertExtracted() {
    if (!extractedText) return;
    const trimmed = form.body.trim();
    update("body", trimmed.length > 0 ? `${trimmed}\n\n${extractedText}` : extractedText);
  }

  const missing = [!form.title.trim() ? "Title" : null, !form.body.trim() ? "Body" : null]
    .filter((value): value is string => value !== null);

  async function handleSave() {
    if (missing.length > 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    let attachmentPath = form.savedAttachmentPath;
    try {
      if (form.attachment && !attachmentPath) {
        try {
          attachmentPath = await client.saveAttachment(form.attachment.token);
        } catch (err) {
          setError(`Attachment not saved: ${err}. The entry was not written. Choose the file again to retry.`);
          return;
        }
        // Kept on the form: the token is spent, and a retry must reuse this
        // copy rather than ask Rust for a second one.
        const saved = attachmentPath;
        setForm((current) => ({ ...current, savedAttachmentPath: saved }));
      }
      const written = await client.writeEntry(draftRequest(form, attachmentPath));
      if (restored) setResearch((current) => ({ ...current, addEntryDraft: null }));
      settle(() => onSaved(written));
    } catch (err) {
      setError(attachmentPath
        ? `Attachment already saved at ${attachmentDisplayPath(attachmentPath)}; entry not written. ${err}`
        : `Entry not written: ${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  const projectOptions = useMemo(() => {
    const names = projects.map((project) => project.name);
    if (form.project && !names.includes(form.project)) names.unshift(form.project);
    return names;
  }, [projects, form.project]);

  return (
    <Modal
      open
      onClose={requestClose}
      title="Add Entry"
      showTitle={false}
      className="library-add-entry"
      initialFocus="#ae-title"
      dismissOnBackdrop
    >
      <header className="pantheon-modal-header">
        <div className="pantheon-modal-title-group">
          <h2 className="pantheon-modal-title">Add Entry</h2>
          <span className="pantheon-modal-meta">New research entry</span>
        </div>
        <button type="button" className="pantheon-modal-close" onClick={requestClose} aria-label="Close" title="Close (Esc)" disabled={submitting}>
          ×
        </button>
      </header>

      <div className="pantheon-modal-body pantheon-modal-body--form">
        <div className="add-entry-form">
          {offerRestore && kept ? (
            <div className="library-notice" role="status">
              <span>
                An unsent entry is kept from {formatWhen(kept.keptAt)}: <strong>{kept.title.trim() || "Untitled"}</strong>.
              </span>
              <span className="library-notice__actions">
                <button type="button" className="ghost-action library-action" onClick={restore}>Restore</button>
                <button type="button" className="ghost-action library-action" onClick={discardKept}>Discard it</button>
              </span>
            </div>
          ) : null}

          <div className="form-field">
            <label className="form-label" htmlFor="ae-title">Title</label>
            <input id="ae-title" type="text" className="form-input" placeholder="Entry title" value={form.title}
              onChange={(event) => update("title", event.target.value)} disabled={submitting} />
          </div>

          {/* Second, not last. This is the entry — the metadata below it
              describes the thing typed here. */}
          <div className="form-field form-field--body">
            <label className="form-label" htmlFor="ae-body">Body</label>
            <textarea id="ae-body" className="form-input form-textarea" rows={10} value={form.body} disabled={submitting}
              placeholder="Write or paste the entry. Markdown supported. An attachment below can be extracted into this field, but typing here is the normal path."
              onChange={(event) => update("body", event.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ae-source-type">Source type</label>
              <select id="ae-source-type" className="form-input" value={form.sourceType} disabled={submitting}
                onChange={(event) => update("sourceType", event.target.value)}>
                <option value="article">Article</option>
                <option value="transcript">Transcript</option>
                <option value="guide">Guide</option>
                <option value="paper">Paper</option>
                <option value="talk">Talk</option>
                <option value="">Other / unspecified</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ae-project">Project <span className="form-optional">(optional)</span></label>
              <select id="ae-project" className="form-input" value={form.project} disabled={submitting}
                onChange={(event) => update("project", event.target.value)}>
                <option value="">No project</option>
                {projectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ae-source-url">Source URL <span className="form-optional">(optional)</span></label>
              <input id="ae-source-url" type="url" className="form-input" placeholder="https://..." value={form.sourceUrl}
                onChange={(event) => update("sourceUrl", event.target.value)} disabled={submitting} />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ae-source-date">Source date <span className="form-optional">(optional)</span></label>
              <input id="ae-source-date" type="date" className="form-input" value={form.sourceDate}
                onChange={(event) => update("sourceDate", event.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="ae-tags">Tags <span className="form-optional">(optional)</span></label>
            <input id="ae-tags" type="text" className="form-input" placeholder="comma, separated, tags" value={form.tagsRaw}
              onChange={(event) => update("tagsRaw", event.target.value)} disabled={submitting} />
            <span className="form-helper">
              <code>olympus/research</code> and <code>{`research/${form.sourceType || "TYPE"}`}</code> are added automatically and are not searched.
            </span>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ae-stance">Stance</label>
              <select id="ae-stance" className="form-input" value={form.stance} disabled={submitting}
                onChange={(event) => update("stance", event.target.value)}>
                {PANTHEON_STANCES.map((value) => <option key={value} value={value}>{STANCE_TEXT[value] ?? value}</option>)}
              </select>
              <span className="form-helper">Saving a source is not agreeing with it. Left alone, this stays unevaluated.</span>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ae-origin">Origin</label>
              <select id="ae-origin" className="form-input" value={form.origin} disabled={submitting}
                onChange={(event) => update("origin", event.target.value)}>
                {PANTHEON_ORIGINS.map((value) => <option key={value} value={value}>{ORIGIN_TEXT[value] ?? value}</option>)}
              </select>
              <span className="form-helper">Who found it. Sources Olympus surfaced stay distinguishable from your own.</span>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="ae-why-kept">Why kept <span className="form-optional">(optional)</span></label>
            <input id="ae-why-kept" type="text" className="form-input" placeholder="What this is for." value={form.whyKept}
              onChange={(event) => update("whyKept", event.target.value)} disabled={submitting} />
            <span className="form-helper">Left blank, the entry reads as having no stated purpose — which is visible rather than guessed at.</span>
          </div>

          <div className="form-field">
            <span className="form-label" id="ae-attachment-label">Attachment <span className="form-optional">(optional)</span></span>
            {form.attachment ? (
              <div className="attachment-staged-row" aria-labelledby="ae-attachment-label">
                <span className="attachment-staged-name">{form.attachment.originalFilename}</span>
                <span className="attachment-staged-ext">{form.attachment.extension.toUpperCase()}</span>
                <button type="button" className="attachment-remove" onClick={handleRemoveAttachment} disabled={submitting}
                  aria-label="Remove attachment" title="Remove attachment">×</button>
              </div>
            ) : (
              <button type="button" className="attachment-dropzone" onClick={() => void handlePickAttachment()} disabled={submitting}
                aria-describedby="ae-attachment-help">
                Choose a file…
              </button>
            )}
            {attachmentError ? (
              <span className="form-helper attachment-error-text" role="alert">{attachmentError}</span>
            ) : form.savedAttachmentPath ? (
              <span className="form-helper" id="ae-attachment-help">
                Already in the vault at <code>{attachmentDisplayPath(form.savedAttachmentPath)}</code>. Saving again reuses it.
                Removing it here leaves that copy in the vault.
              </span>
            ) : (
              <span className="form-helper" id="ae-attachment-help">
                Allowed: {ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}. Files copy into <code>02 - Research/_attachments/</code> when the entry is saved.
              </span>
            )}

            {form.attachment && form.attachment.extension === "pdf" && !form.savedAttachmentPath ? (
              <div className="attachment-preview">
                <div className="attachment-preview-header">
                  <span>PDF text preview</span>
                  {extractedText && extractedText.length > 0 ? (
                    <button type="button" className="attachment-insert-button" onClick={handleInsertExtracted} disabled={submitting}
                      title="Append extracted text to body">Insert into body</button>
                  ) : null}
                </div>
                <div className="attachment-preview-body">
                  {extracting ? <span className="attachment-preview-status">Extracting…</span>
                    : extractError ? <span className="attachment-preview-status attachment-preview-error">{extractError}</span>
                    : extractedText && extractedText.length > 0 ? <pre className="attachment-preview-text">{extractedText}</pre>
                    : <span className="attachment-preview-status">No text yet.</span>}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {confirm === "close" ? (
        <footer className="pantheon-modal-footer library-add-footer">
          <span className="pantheon-modal-footer-hint" role="alert">
            Unsaved: {changed.join(", ")}. Close without saving?
          </span>
          <button type="button" className="form-button form-button--ghost" onClick={() => setConfirm(null)} autoFocus>Keep editing</button>
          <button type="button" className="form-button form-button--ghost" onClick={keepAndClose}
            title="Close now; Add Entry offers it back until it is saved or discarded">Keep as draft</button>
          <button type="button" className="form-button form-button--primary" onClick={discardAndClose}>Discard</button>
        </footer>
      ) : (
        <footer className="pantheon-modal-footer library-add-footer">
          {error ? (
            <span className="library-add-footer__error" role="alert">{error}</span>
          ) : missing.length > 0 && !submitting ? (
            <span className="pantheon-modal-footer-hint">
              {missing.length === 1 ? `${missing[0]} is required` : `${missing.join(" and ")} are required`}
            </span>
          ) : null}
          <button type="button" className="form-button form-button--ghost" onClick={requestClose} disabled={submitting}>Cancel</button>
          <button type="button" className="form-button form-button--primary" onClick={() => void handleSave()}
            disabled={submitting || missing.length > 0}
            title={missing.length > 0 ? `Still needed: ${missing.join(", ")}` : undefined}>
            {submitting ? "Saving…" : error ? "Retry save" : "Save Entry"}
          </button>
        </footer>
      )}
    </Modal>
  );
}
