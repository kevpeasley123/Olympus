import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Observation } from '../../services/situations';
import type { MailMessage } from '../../services/gmail';
import { askAboutThread } from '../../services/communications';
import { formatWhen } from '../../services/time';

/**
 * "Review source" in the inspector column (review U5): what Olympus generated,
 * the exact words it quoted, and the whole cached thread — labelled so the
 * three can never be mistaken for one another.
 */

export interface SourceRecommendation { explanation: string; suggestedAction: string }

/** Where `quote` occurs in `text`, tolerating only whitespace differences. */
export function findQuote(text: string, quote: string): [number, number] | null {
  const needle = quote.trim();
  if (!needle) return null;
  const exact = text.indexOf(needle);
  if (exact >= 0) return [exact, exact + needle.length];
  const pattern = needle.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(pattern).exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
}

type Detail = Observation['details'][number];

export function SituationSourceReview({ observation, recommendation, loadThread, onBack }: {
  observation: Observation;
  recommendation?: SourceRecommendation;
  loadThread?: (threadId: string) => Promise<MailMessage[]>;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MailMessage[] | null>(null);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState<Detail | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const marks = useRef(new Map<string, HTMLElement>());

  useEffect(() => { heading.current?.focus(); }, [observation.threadId]);
  useEffect(() => {
    let live = true;
    setMessages(null); setError(''); setFocus(null);
    if (!loadThread) { setMessages([]); return; }
    loadThread(observation.threadId)
      .then(next => { if (live) setMessages(next); })
      .catch(() => { if (live) { setMessages([]); setError('The cached thread could not be loaded. It may have left the cache or the connection is busy.'); } });
    return () => { live = false; };
  }, [observation.threadId, loadThread]);

  const locate = (detail: Detail) => {
    const message = messages?.find(m => m.id === detail.messageId);
    return message && findQuote(message.cleanText || message.canonicalText, detail.quote) ? message : null;
  };
  useLayoutEffect(() => {
    if (!focus) return;
    const mark = marks.current.get(focus.messageId);
    mark?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    mark?.focus({ preventScroll: true });
  }, [focus]);

  const body = (message: MailMessage) => {
    const text = message.cleanText || message.canonicalText || '';
    if (!text) return 'Body not available in the cache.';
    const range = focus && focus.messageId === message.id ? findQuote(text, focus.quote) : null;
    if (!range) return text;
    return <>{text.slice(0, range[0])}<mark tabIndex={-1} ref={node => { if (node) marks.current.set(message.id, node); }}>{text.slice(range[0], range[1])}</mark>{text.slice(range[1])}</>;
  };

  return <section className="source-review" aria-label="Source review">
    <header className="inspector-panel-header">
      <button className="inspector-back" onClick={onBack}><ArrowLeft size={14} aria-hidden="true"/> Briefing</button>
      <h4 ref={heading} tabIndex={-1}>{observation.subject || '(No subject)'}</h4>
      <small>Cached thread · {observation.people.map(p => p.name).join(', ') || 'Participants not recorded'}</small>
    </header>

    <section className="source-block source-generated" aria-labelledby="source-generated">
      <h5 id="source-generated">{recommendation ? 'Recommendation' : 'Olympus interpretation'} <span className="source-kind">Generated</span></h5>
      {recommendation ? <><p>{recommendation.explanation}</p><p className="source-action">{recommendation.suggestedAction}</p></> : <p>{observation.summary}</p>}
      <small>Generated from the cached thread; check it against the source below.</small>
    </section>

    <section className="source-block source-quoted" aria-labelledby="source-quoted">
      <h5 id="source-quoted">Quoted from source <span className="source-kind verbatim">Verbatim</span></h5>
      {observation.details.length ? <ul>{observation.details.map((detail, i) => {
        const found = messages ? locate(detail) : null;
        return <li key={i}>
          <strong>{detail.label}</strong>{detail.value && <span> · {detail.value}</span>}
          <blockquote>{detail.quote}</blockquote>
          {detail.kind === 'portal' && <small>Address from email · not verified</small>}
          {messages === null ? <small>Loading the thread to locate this quote…</small>
            : found ? <button className="source-jump" aria-pressed={focus === detail} onClick={() => setFocus(detail)}>Show in message</button>
            : <small>Not located in the cached thread text.</small>}
        </li>;
      })}</ul> : <p>No quoted details were recorded for this thread. Read the full thread below.</p>}
    </section>

    <section className="source-block source-thread" aria-labelledby="source-thread">
      <h5 id="source-thread">Full thread <span className="source-kind">Cached source</span></h5>
      <button className="ghost-action source-ask" onClick={() => askAboutThread(observation.threadId, observation.subject)}>Ask Olympus about this thread <ArrowUpRight size={14} aria-hidden="true"/></button>
      <small>Prepares a question in the console. Sending it retrieves up to four cached messages for your reasoning provider.</small>
      {error && <p role="alert">{error}</p>}
      {messages === null ? <p role="status">Loading thread…</p> : !messages.length && !error ? <p>No cached messages are available for this thread.</p> : messages.map(message =>
        <article className="comms-source" key={message.id} data-highlighted={focus?.messageId === message.id || undefined}>
          <strong>{message.sender}</strong>
          <small>To: {message.recipients} · {formatWhen(message.internalDate)}</small>
          <pre>{body(message)}</pre>
          {message.attachments.map((a, i) => <p key={i}>Attachment: {a.filename || 'Unnamed part'} · {a.mimeType} · content not downloaded</p>)}
          <details><summary>Inspect source</summary><p>Gmail · message {message.id} · thread {message.threadId}</p><p>Body status: {message.bodyStatus.replace(/_/g, ' ')}</p></details>
        </article>)}
    </section>
  </section>;
}
