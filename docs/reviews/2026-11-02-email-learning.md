# Email correction learning review

Dated November 2, 2026, America/Phoenix. Baseline 2e223c9.
Branch codex/gmail-learning-intelligence. This is an unreleased local milestone.

Independent review found important edge cases in feedback and delivery; the final
fix pass reproduced each with a failing test before implementing its repair:

- Snoozing discarded the active correction when the delay ended. Feedback now
  preserves compatible correction content independently of attention disposition.
- The legacy action endpoint adopted the latest revision, allowing stale callers
  to overwrite newer feedback. It now refuses calls after learning exists; current
  UI supplies the expected revision through email_learning_change.
- New source feedback erased older forgetting tombstones. Redacted suppression
  signatures now survive outside reversible history. Returning old evidence stays
  suppressed; new explicit same-source feedback may deliberately replace suppression.
- Undo across source revisions could reuse a pre-feedback display digest. The
  thread mutation revision now enters selection independently of whether its old
  correction content is still applicable.
- Poll failure discarded unsaved text. This was upgraded from Minor because it
  loses user-authored work. The interface retains last-checked source state and
  the correction editor, with an explicit refresh-failure warning. Successful
  account changes still clear old account state.

Decisions: native/live provider quality, sync recovery, production database backup
and migration, tray operation, cross-thread inference and physical byte erasure
remain outside acceptance. Forget is logical, permanent feedback/history redaction
with a bounded suppression record. Existing mailbox, conversations and backups have
separate retention. Undo is available only for non-forgotten reversible history.
At the suppression-record bound, new forgetting fails rather than evicting prior
suppression. No new provider permission, credential operation or paid fallback.

See ../NEXT-SESSION.md for dated verification and continuation. Browser fixture
screenshots verify layout and interactions; they do not exercise native WebView2,
Tauri IPC, real mail or an authorized analyzer.
