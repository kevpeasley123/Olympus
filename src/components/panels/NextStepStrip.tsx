import { ArrowDown } from 'lucide-react';

/**
 * One line above the map that states the useful next step (review U8).
 *
 * Laptop layouts give the inspector ~300px, so the briefing's next step can sit
 * below its fold; this line keeps it visible on arrival and jumps to the full
 * text. Wide layouts, where the briefing has room, hide it in CSS.
 */
export function NextStepStrip({ action, scope, text, onJump }: { action: string; scope?: string; text: string; onJump: () => void }) {
  return <button type="button" className="situation-next-strip" onClick={onJump} title={`${action}${scope ? ` · ${scope}` : ''} — ${text}`}
    aria-label={`Useful next step: ${action}${scope ? ` · ${scope}` : ''} — ${text}. Show in briefing`}>
    <strong>{action}</strong>{scope && <span className="next-strip-scope">· {scope}</span>}<span className="next-strip-text">— {text}</span>
    <ArrowDown size={14} aria-hidden="true" />
  </button>;
}

/** Scrolls the inspector to its next-step section and moves focus there, after the briefing has rendered. */
export function jumpToNextStep(inspector: HTMLElement | null, selector: string) {
  requestAnimationFrame(() => {
    const target = inspector?.querySelector<HTMLElement>(selector);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
    target.focus({ preventScroll: true });
  });
}
