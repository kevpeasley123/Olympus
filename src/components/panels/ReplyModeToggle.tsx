import { MessageSquare, Volume2 } from "lucide-react";

/**
 * Text / Voice replies. One component for the console and Preferences, so the
 * same setting never carries two names ("Auto Speak" in one place, "Voice" in
 * the other). `autoSpeak` is the stored preference behind it.
 */
export const REPLY_MODE_COPY = {
  group: "Reply mode",
  text: { label: "Text", ariaLabel: "Text-only replies", title: "Reply in text only" },
  voice: {
    label: "Voice",
    ariaLabel: "Voice and text replies",
    title: "Speak replies and keep the written answer; microphone stays off unless enabled separately"
  }
} as const;

export function ReplyModeToggle({ autoSpeak, onChange, disabled = false, className = "", compact=false }: {
  compact?:boolean;
  autoSpeak: boolean;
  onChange: (autoSpeak: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  if(compact)return <button type="button" className="console-spoken-replies" role="switch" aria-label="Spoken replies" aria-checked={autoSpeak} disabled={disabled} title="Read replies aloud; does not activate the microphone" onClick={()=>onChange(!autoSpeak)}><Volume2 size={12} aria-hidden="true"/>Spoken replies: {autoSpeak?"On":"Off"}</button>;
  return (
    <div className={`console-reply-mode ${className}`.trim()} role="group" aria-label={REPLY_MODE_COPY.group}>
      <button type="button" aria-label={REPLY_MODE_COPY.text.ariaLabel} aria-pressed={!autoSpeak} disabled={disabled}
        title={REPLY_MODE_COPY.text.title} onClick={() => onChange(false)}>
        <MessageSquare size={12} aria-hidden="true" />{REPLY_MODE_COPY.text.label}
      </button>
      <button type="button" aria-label={REPLY_MODE_COPY.voice.ariaLabel} aria-pressed={autoSpeak} disabled={disabled}
        title={REPLY_MODE_COPY.voice.title} onClick={() => onChange(true)}>
        <Volume2 size={12} aria-hidden="true" />{REPLY_MODE_COPY.voice.label}
      </button>
    </div>
  );
}
