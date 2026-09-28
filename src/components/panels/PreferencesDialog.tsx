import { Power, X } from "lucide-react";
import { useState } from "react";
import { Modal } from "../Modal";
import { GmailSettings } from "./GmailSettings";
import { ModelDiagnostics } from "./ModelSettings";
import { ReplyModeToggle } from "./ReplyModeToggle";
import { VoiceSettings } from "./VoiceSettings";
import { useDelegationRuns } from "../../hooks/useDelegationRuns";
import { restartDesktopApp } from "../../services/launcher";
import { useVoiceState } from "../../services/realtimeVoice";
import type { VoicePreferences } from "../../services/voicePreferences";
import type { DelegationPhase } from "../../services/delegation";

/**
 * Preferences, as a real dialog (review U9) that opens below the header.
 *
 * Ordered by how often each is touched: how Olympus replies and whether it
 * briefs on open first; the voice lab, Gmail and diagnostics behind their own
 * disclosures; Restart last, behind a confirmation (review U4).
 */

interface PreferencesDialogProps {
  open: boolean;
  onClose: () => void;
  preferences: VoicePreferences;
  onPreferences: (patch: Partial<VoicePreferences>) => void;
  settingsReady: boolean;
  /** A reply is being generated right now. */
  chatPending: boolean;
}

export function PreferencesDialog({ open, onClose, preferences, onPreferences, settingsReady, chatPending }: PreferencesDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Olympus Preferences" labelledBy="preferences-title" showTitle={false}
      placement="below-header" className="preferences-dialog" initialFocus='.preferences-section [aria-pressed="true"]:not(:disabled)'>
      <div className="panel-header compact preferences-dialog__header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2 id="preferences-title">Olympus Preferences</h2>
        </div>
        <button className="ghost-icon-action" type="button" aria-label="Close preferences" title="Close preferences (Esc)" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <section className="preferences-section" aria-labelledby="preferences-replies">
        <h3 id="preferences-replies" className="preferences-section__title">Replies &amp; briefing</h3>
        <div className="voice-setting-row">
          <span>Replies</span>
          <ReplyModeToggle autoSpeak={preferences.autoSpeak} disabled={!settingsReady}
            onChange={autoSpeak => onPreferences({ autoSpeak })} />
        </div>
        <label className="voice-setting-row">
          Opening Briefing
          <input type="checkbox" checked={preferences.briefOnOpen} disabled={!settingsReady}
            onChange={event => onPreferences({ briefOnOpen: event.target.checked })} />
        </label>
        <p className="voice-settings-hint">
          Voice speaks a short summary of each reply and keeps the written answer; typed messages never turn the
          microphone on. Opening Briefing shows a short project briefing once when Olympus opens, and speaks it
          when replies are set to Voice.
        </p>
      </section>

      <section className="preferences-section">
        <VoiceSettings preferences={preferences} onChange={onPreferences} ready={settingsReady} replyControls={false} />
      </section>
      <section className="preferences-section">
        <GmailSettings />
      </section>
      <section className="preferences-section">
        <ModelDiagnostics />
      </section>
      <RestartSection chatPending={chatPending} />
    </Modal>
  );
}

/** Phases in which a delegated run's process is doing work a restart would kill. */
const RUNNING_PHASES: DelegationPhase[] = ["approved", "preparing", "planning", "editing", "testing", "reviewing"];

function RestartSection({ chatPending }: { chatPending: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const voice = useVoiceState();
  const { data: runs } = useDelegationRuns();

  // Only what Olympus can actually see. Drafts live in each panel and are not
  // counted, so the sentence names them without a number.
  const running = runs.filter(run => RUNNING_PHASES.includes(run.phase)).length;
  const live = [
    chatPending ? "a reply is being generated" : null,
    voice.active || voice.connecting ? "a voice session is open" : null,
    running ? `${running} delegated ${running === 1 ? "run is" : "runs are"} in progress` : null
  ].filter((item): item is string => item !== null);

  async function restart() {
    setRestarting(true);
    try {
      if (await restartDesktopApp() === "unsupported") {
        setNotice("Restart is available only in the desktop app.");
        setRestarting(false);
        setConfirming(false);
      }
    } catch (error) {
      setNotice(`Olympus could not restart: ${String(error)}`);
      setRestarting(false);
    }
  }

  return (
    <section className="preferences-section preferences-restart" aria-labelledby="preferences-restart">
      <h3 id="preferences-restart" className="preferences-section__title">Restart Olympus</h3>
      {!confirming ? (
        <button type="button" className="ghost-action" onClick={() => { setNotice(null); setConfirming(true); }}>
          <Power size={14} aria-hidden="true" /> Restart Olympus…
        </button>
      ) : (
        <div className="preferences-restart__confirm" role="group" aria-label="Confirm restart">
          <p>
            Restarting closes and reopens the desktop app. Unsent drafts and any in-progress reply, voice
            session, pending write confirmation or delegated run will be interrupted. A pending write is
            denied, so the file is kept.
          </p>
          {live.length > 0 ? <p className="preferences-restart__live">Right now: {live.join("; ")}.</p> : null}
          <div className="preferences-restart__actions">
            <button type="button" className="ghost-action" autoFocus onClick={() => setConfirming(false)} disabled={restarting}>
              Keep working
            </button>
            <button type="button" className="ghost-action preferences-restart__go" onClick={() => void restart()} disabled={restarting}>
              <Power size={14} aria-hidden="true" /> {restarting ? "Restarting…" : "Restart now"}
            </button>
          </div>
        </div>
      )}
      {notice ? <p className="section-copy action-feedback warning" role="status">{notice}</p> : null}
    </section>
  );
}
