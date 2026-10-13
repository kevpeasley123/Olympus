import { OlympusSignal } from "./OlympusSignal";
import { SpokenRepliesControl } from "./SpokenRepliesControl";
import { SIGNAL_STATUS, signalStateFor } from "../../services/olympusSignal";
import type { VoiceSnapshot } from "../../services/realtimeVoice";
import "./olympusSignal.css";

/**
 * Olympus's voice beneath the Omega: the energy signal, a status word only when
 * something is happening, and the spoken-replies switch.
 */
export function OlympusVoiceDock({ voice, spokenReplies, onToggle, ready, assistantPending, active }: {
  voice?: VoiceSnapshot; spokenReplies: boolean; onToggle?: () => void; ready: boolean; assistantPending: boolean; active: boolean;
}) {
  const state = signalStateFor(voice, spokenReplies, assistantPending);
  const muted = !!voice?.muted;
  const status = state === "error" ? "Speech unavailable · see reply details" : state === "speaking" && muted ? "Speaking · muted" : SIGNAL_STATUS[state];
  return <div className="olympus-voice-dock" data-state={state}>
    <OlympusSignal state={state} active={active} live={!muted} />
    <p className="olympus-voice-dock__status" aria-live="polite" data-tone={state === "error" ? "error" : undefined}>{status}</p>
    <SpokenRepliesControl voice={voice} enabled={spokenReplies} onToggle={onToggle} ready={ready} />
  </div>;
}
