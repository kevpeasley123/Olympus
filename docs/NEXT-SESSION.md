# Next session

## Olympus 0.47.0

Gmail recovery and offline briefing release from
`codex/gmail-local-brief-recovery`, based on master `2fdd1b8` (0.46.0).
Release integration and installation are being verified in this session.

## Included

- Idempotent Gmail reads retry bounded transient transport failures. The live
  grant refreshed without reconnecting; catch-up and scheduled sync succeeded.
- Local Ollama analysis uses Qwen3 8B. Strict schema output matches the parser's
  relevant/irrelevant rules; the real Communications refresh succeeded and
  cleared the previous failure warning.
- Opening briefs use Qwen3 14B locally with a bounded selection of recent inbox
  messages and registered Git changes. Source scope, freshness, exact saved
  text and delivery receipts remain native-validated. Mail and project output
  are separated into readable paragraphs. See `docs/BRIEFING-SYNTHESIS.md`.
- Explicit handled/correction statements can refer to a native brief before
  background attention analysis exists. Clarification and acknowledgment chains
  retain the original source through server-written receipts.
- Local speech is selected in this computer's saved preferences. The existing
  Ollama startup entry and downloaded models are machine setup, not repo files.

## Verification (November 8)

- Final native suite: 760 passed, 30 ignored.
- All 85 script checks passed, including reruns of eight browser checks after
  correcting fixture-server setup. Frontend build passed.
- Real development app: automatic Gmail sync and local analysis completed;
  a saved local brief named specific Olympus and other project changes plus
  current mail evidence. No reconnect was necessary.
- Offline Kokoro/Whisper synthesis-to-transcription check passed. Detailed
  evidence and limits: `docs/reviews/2026-11-08-gmail-local-brief.md`.
- Visual regression passed: 21 captures, 14 functional checks and 22 Organizer
  checks. Command idle/conversation and real Communications screens inspected.
- Installed-app restart checks pending.

## Remaining boundaries

- Local generation uses a bounded recent-source selection, not a complete
  mailbox review or a universal personal assistant. Tasks and runs are not in
  the local synthesis packet; important task/run states retain the existing
  factual briefing path. Coverage is stated in the saved brief.
- Gmail background work runs while Olympus is open. Multi-day grant durability
  and suspend/network recovery over days remain unverified. Revoked Google
  consent still requires the owner to sign in again.
- Subscription reasoning and the older aggregate synthesis route remain gated.
  This release does not authorize paid inference or Gmail mutations.
- The registered desktop Olympus checkout has pre-existing uncommitted work and
  an older local master. Its remote refs were refreshed for project evidence;
  its working files were not overwritten. Preserve that work.
- The Obsidian memory audit, research ingestion and OAuth-binding prototype are
  separate unfinished work. Do not merge or describe them as completed here.
