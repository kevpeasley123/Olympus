import { useState } from 'react';
import { Modal } from '../Modal';
import { parseRecipients, type ParsedRecipients } from '../../services/recipients';
import type { CommsReplyDraft } from '../../state/viewState';

/**
 * A local reply draft in the inspector column (review U3). The text lives in
 * session view state, so a mode switch or a poll never loses it; closing with
 * unsaved changes asks first. Nothing here sends mail.
 */

export const draftChanged = (draft: CommsReplyDraft) =>
  !draft.saved || draft.saved.to !== (draft.to ?? '') || draft.saved.subject !== draft.subject || draft.saved.body !== draft.body;

export function SituationDraftEditor({ draft, situationTitle, threadSubject, busy, onChange, onSave, onClose }: {
  draft: CommsReplyDraft;
  situationTitle: string;
  threadSubject: string;
  busy: boolean;
  onChange: (patch: Partial<CommsReplyDraft>) => void;
  /** Resolves true when the draft was saved. */
  onSave: (emails: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [recipients, setRecipients] = useState<ParsedRecipients>(() => parseRecipients(draft.to ?? ''));
  const [problem, setProblem] = useState('');
  const [confirming, setConfirming] = useState(false);
  const changed = draftChanged(draft);

  // Parsed when the operator leaves the field, never while typing.
  const check = (): ParsedRecipients => {
    const parsed = parseRecipients(draft.to ?? '');
    setRecipients(parsed);
    return parsed;
  };
  async function save(): Promise<boolean> {
    const parsed = check();
    if (!parsed.emails.length || parsed.invalid.length) {
      setProblem(parsed.invalid.length ? `Not an email address: ${parsed.invalid.join(', ')}.` : 'Add at least one recipient address.');
      return false;
    }
    if (parsed.emails.length > 8) { setProblem('A local draft can address at most 8 recipients.'); return false; }
    setProblem('');
    return onSave(parsed.emails);
  }
  const close = () => { if (changed) setConfirming(true); else onClose(); };

  return <section className="situation-draft" aria-label="Local reply draft">
    <header>
      <div>
        <h4>Local reply draft · not sent</h4>
        <p className="draft-context">For <strong>{situationTitle}</strong> · replying in “{threadSubject || '(No subject)'}”</p>
      </div>
      <button type="button" onClick={close}>Close draft</button>
    </header>
    <p>Review the recipient and edit the message. Saving keeps it in Olympus; Gmail sending comes later.</p>
    {draft.stale && <p className="draft-stale">Correspondence changed since this draft was created. Review the source before using it.</p>}
    <label>To<input aria-label="Draft recipients" value={draft.to ?? ''} onChange={e => onChange({ to: e.target.value })} onBlur={check} aria-describedby="draft-recipients-note" /></label>
    <small id="draft-recipients-note" className="draft-recipients">
      {recipients.invalid.length ? <span role="alert">Not an email address: {recipients.invalid.join(', ')}</span>
        : recipients.emails.length ? <>Addresses: {recipients.emails.join(', ')}</> : 'Separate addresses with commas. Names are kept as typed.'}
    </small>
    <label>Subject<input aria-label="Draft subject" maxLength={300} value={draft.subject} onChange={e => onChange({ subject: e.target.value })} /></label>
    <label>Message<textarea aria-label="Draft message" maxLength={24000} rows={9} value={draft.body} onChange={e => onChange({ body: e.target.value })} /></label>
    {problem && <p role="alert" className="draft-problem">{problem}</p>}
    <div className="draft-actions">
      <button type="button" disabled={busy || !changed} title={changed ? undefined : 'No changes since the last save'} onClick={() => void save()}>Save local draft</button>
      <small>{changed ? 'Unsaved changes' : 'Saved in Olympus · not sent'}</small>
    </div>
    <Modal open={confirming} onClose={() => setConfirming(false)} title="Close this draft?" role="alertdialog" className="draft-close-dialog"
      description="This draft has changes that are not saved in Olympus.">
      <div className="draft-close-actions">
        <button type="button" className="ghost-action" autoFocus onClick={() => setConfirming(false)}>Keep editing</button>
        <button type="button" className="ghost-action" disabled={busy} onClick={() => void save().then(ok => { if (ok) { setConfirming(false); onClose(); } else setConfirming(false); })}>Save and close</button>
        <button type="button" className="ghost-action destructive-action" onClick={() => { setConfirming(false); onClose(); }}>Discard changes</button>
      </div>
    </Modal>
  </section>;
}
