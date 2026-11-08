# Gmail and local briefing recovery — November 8, 2026

## Cause and changes

The installed account could refresh its existing grant and read a real message.
The current catch-up failure was a transient transport/quota problem, not proof
that the owner needed to reconnect again. Bounded idempotent-read retries recover
transport failures without advancing a partially fetched batch.

Email understanding was independently blocked by its provider route. The owner
approved local analysis. Ollama and Qwen models were provisioned on this PC.
Qwen3 8B is the background extraction/understanding model; Qwen3 14B handles
smaller opening-brief packets. Both use loopback-only inference with fixed model
validation, bounded context/output, no cloud fallback, and serialized inference.
The 14B analysis comparison exceeded the batch timeout; it is not the analysis
configuration shipped on this machine.

Strict structured schemas now prevent irrelevant observations from carrying
situation findings and constrain per-thread and per-situation identifiers.
Existing semantic validation is retained.

The local brief uses a native reservation, fresh scoped records, source-bound
model output and exact-content persistence. Changing or revoking the selected
conversation invalidates the reservation. Feedback can refer to a native brief
before a background attention record exists; follow-up references are recovered
only through exact server-written response receipts.

## Verification

- Final native suite: 760 passed, 30 ignored. Qualification tests include source
  mutation, wrong account, privacy, stale scope, native persistence, receipt
  integrity, explicit feedback, clarification and subsequent correction.
- All 85 JavaScript script checks passed. Eight browser checks required rerunning
  after fixture-server setup was corrected; their final logs pass.
- Visual regression passed: 21 captures, 14 functional and 22 Organizer checks.
  Inspected Command idle/conversation screenshots: layout remains legible with
  the existing spherical constellation and no new panel overlap. Real native
  Communications showed the cleared analysis warning. This is distinct from
  long-term runtime verification.
- Frontend production build passed. Release MSI build is separately recorded in
  the installation handoff.
- Real account: grant refresh, message read, catch-up (168 messages, 24 removals)
  and repeated scheduled sync succeeded. No Gmail message mutation was performed.
- Real development app: Communications analysis completed in about 33 seconds,
  clearing the prior analysis failure. Opening synthesis produced and saved
  concrete project changes and current mail evidence.
- Final isolated-copy local brief persisted with provenance in about 17 seconds.
- Existing offline speech round trip passed: Kokoro generated WAV, Whisper
  transcribed it in about eight seconds overall. Local speech preference and
  installed-runtime paths were configured on this PC.
- Focused review found no remaining blocker in the native feedback receipt chain.

## Limits

The local packet is a bounded selection of recent mail and registered Git changes,
not complete mailbox, task or run coverage. The saved brief states this boundary.
Multi-day Google grant durability and long suspend/network recovery have not been
proven. Background sync requires Olympus to be running. Revoked consent still
requires Google sign-in.

The pre-existing ElevenLabs auto-speak setting was discovered during desktop
acceptance and changed to Local. Local inference tests made no paid model call;
that earlier speech playback must not be described as wholly offline validation.
Subscription reasoning gates remain unchanged.

## Integration and installation handoff

PR #25 merged at `c30637c`; version 0.47.0 MSI built. The updater initially hit
a locked Vite native module; the completed-test fixture server was stopped and
the normal updater then built successfully. Windows administrator consent is now
pending. Installed registry version remains 0.46.0 until approval; no installed
0.47 acceptance claim is made. A fresh operational database backup passed integrity
verification before installation. The owner was asked to approve Windows' prompt.

After approval, verify the installed executable and perform the real restart/sync,
local analysis and brief checks. The tested development app was closed cleanly.
