# Next session

## Olympus 0.49.0

Repair branch `codex/local-analysis-reliability`, based on master `fa6fd6c`.
Olympus 0.48 is installed. Version 0.49 is in release verification; installation
and installed local-inference acceptance are still pending.

## Changes

- Optional `OLYMPUS_LOCAL_DEVICE=cpu` uses zero GPU layers and a bounded five-minute
  local deadline. Default `auto` keeps the existing two-minute deadline.
- Local Qwen3 8B is configured privately for email analysis and briefs. GPU inference
  timed out under shared desktop load; CPU completed. A larger 14B model also
  failed semantic review; a compact local output format corrected the reviewed case.
- Excerpts discard layout padding before truncation, preserving useful source dates.
  Instructions preserve explicit dates, unknown sender timezones, conditional
  security advice and completion evidence.
- Brief evidence tolerates no-change sync, but a new reply, cancellation, deletion
  or source/scope change invalidates in-flight output before publication.
- Expired tomorrow-delivery forecasts are omitted without claiming delivery.
  Explicit requests and recognized delivery problems stay eligible.
- Project selection omits recognized housekeeping without acknowledging it, leaving
  room for behavior changes. Security and actual dependency-related fixes remain.
- Local transport failures keep allowlisted diagnostic codes.
- Analysis fixes its lower horizon cutoff for each run, avoiding time-only source
  invalidation while still detecting new/changed/deleted mail and context edits.
- Compact local generation keeps text and citations together instead of eliciting
  repetitive or speculative explanation fields. Current time uses the PC offset.
- Conditional routine sign-in notices share one retrieval slot; explicit suspicious
  or blocked activity remains eligible.
- Gmail plugin lifecycle is exercised with a synthetic account: connect, disconnect,
  retained/canceled cache removal, confirmed removal and re-add.
- Background settings describe the configured provider instead of claiming Claude.

## Verification - November 8

- Native suite: 780 passed, 31 intentionally ignored. New regressions were
  reproduced failing before their fixes. Independent code review has no remaining
  important finding. Subject/phrase selection remains heuristic.
- Real installed Gmail authorization and automatic sync succeeded repeatedly,
  including 15:31, 15:36, 15:51, 16:08, 16:28, 16:46 and 17:02 Phoenix, without reconnection.
- Private real-mail CPU analysis completed in 211 seconds. CPU brief calls completed
  in 111, 157 and 179 seconds. Semantic review drove the source/selection fixes;
  the 173-second preview and a 291-second 14B preview failed semantic review.
  A compact text-and-citations format then produced a native saved brief in 123
  seconds with correct autopay, conditional sign-in and concrete code-change wording.
  A synthetic holdout preserved a revised deadline, delivered shipment and answered
  request, but echoed an embedded override. Native publication now rejects that
  observed pattern and credential requests, including benign negations. This is
  conservative rejection, not general injection protection. Final native regressions passed; schema alone is not semantic proof.
  The final real brief repeated successfully in 126 seconds. Repeated analysis
  exposed one cached message aging over the seven-day cutoff during 172 seconds
  of inference; the pinned-window regression now passes. The real-data rerun
  completed in 211 seconds and saved its observations. The newly processed
  routine notices and promotions were correctly left without action items.
  Installed acceptance remains pending.
- Final frontend build, including the settings copy change, passed.
- All 85 release scripts have passing results. Project-dock assessment focus failed
  once in the broad run, then passed unchanged on two isolated reruns. One isolated
  Vite server had slow dependency startup. Full visual regression passed: 21
  captures, 14 functional checks and 22 Organizer checks. The changed settings
  disclosure was separately captured and visually inspected.
- No paid inference, mailbox mutations or fresh live OAuth revoke/re-add performed.
  Fixtures are not live integration or semantic-quality proof.

## Acceptance boundaries and follow-on work

Useful briefs should identify changes, practical consequences and actual requests,
with source evidence, handled corrections and uncertainty. Reuse existing native
context/feedback stores. Local selection currently covers bounded mail and Git
changes, not a complete mailbox/calendar/task audit or all cross-chat memory.

Background work requires Olympus open and the PC awake. Opening briefing is an
opt-in once-per-launch feature; New briefing is the on-demand path. Calendar,
offline-PC operation, configurable scheduled briefs and multi-day OAuth durability
are not established. Kevin does not know whether the Google OAuth app is Testing
or Production; its publishing status remains unverified. Google documents a
seven-day refresh-token lifetime for external Testing grants with Gmail scope.
Do not change account settings or assert durable authorization without checking.
Pause background understanding in Communications settings;
manage Gmail connection and retained data through Armory > Plugins > Gmail.

Preserve the registered desktop checkout's human edits; implementation uses this
isolated checkout. Keep credentials, mailbox copies and previews outside Git.

After this repair is installed and verified, Kevin requested a codebase review of
https://github.com/garrytan/gbrain for useful Olympus memory/agent architecture
ideas. Review source and license before proposing code reuse or architectural work.
