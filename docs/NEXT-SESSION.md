# Next session

## Olympus 0.50.0

Repair branch `codex/conversational-briefs`, based on master `e2e091c`.
Olympus 0.49 is installed. Automatic Gmail sync and repeated local analysis completed.
Kevin rejected its stiff opening brief; factual correctness did not establish quality.
Version 0.50 passed final native real-mail generation and is ready for installation.
See the dated quality review below.

## Changes

- Local briefs omit routine conditional sign-ins while retaining explicit security
  problems. Latest-source suppression still occurs before filtering.
- Coverage is native, bound metadata shown under About this brief and retained in
  chat context. It is no longer read aloud or appended to saved briefing prose.
  Historical briefs remain unchanged and their provenance stays compatible.
- Local writing guidance prioritizes practical meaning, natural sentences, source
  conditions, estimates and actual deadlines. Settled receipts should not fill slots.
- Private configuration selects local Qwen3 14B for briefs and 8B for background
  email analysis. Both models were already installed with Kevin's approval.
- The CPU route introduced in 0.49 retains a finite five-minute inference deadline.
  It avoids the observed GPU contention; it does not make inference instant.
- Gmail plugin management, startup sync waiting, stable analysis windows, source
  revalidation and exact display receipts remain in place from 0.47–0.49.

## Verification — November 8

- Full native suite: 780 passed, 31 intentionally ignored. Frontend build passed.
- All 86 release scripts have passing results. The new disclosure test needed
  URL normalization and opening the Conversation tab. Two existing browser tests
  require port 31430 despite the runner URL; after server startup one timed out,
  then both passed unchanged. Offline speech passed with synthetic microphone input.
- Full visual gate passed: 21 captures, 14 functional checks, 22 Organizer checks.
  The changed disclosure was separately inspected collapsed and expanded.
- Independent read-only code review found no remaining blocking issue.
- Same private real-mail snapshot: 8B remained stiff; 14B produced a better brief
  in about 183 seconds. Synthetic cases exposed settled-receipt filler and an
  estimate promoted to certainty. Final prompt passed both plus appointment,
  autopay and explicit blocked-sign-in checks. This is bounded quality evidence,
  not a guarantee of broad reasoning quality.
- Final native real-mail rerun passed in 198 seconds with source-bound saved prose:
  automatic payment, a new credit and a code-update summary; no routine sign-in
  or spoken coverage disclaimer. Gmail refreshed at 18:16 Phoenix without reconnecting.
  Installed 0.50 acceptance follows installation.
- No paid inference, mailbox mutations or live OAuth revoke/re-add were performed.
  Native fixtures exercise disconnect/remove/re-add; they are not live OAuth proof.

## Acceptance boundaries and follow-on work

See `docs/reviews/2026-11-08-conversational-briefs.md` for quality failures and
reviewed examples. Briefs cover selected recent mail and Git changes; they do not
establish comprehensive calendar/task/agent-run or cross-chat awareness.

Installed 0.49 refreshed its existing Gmail grant and synced repeatedly without
reconnection. Three automatic local analysis passes completed. Multi-day OAuth
durability is unverified. Kevin does not know the OAuth app's publishing mode;
Google's external Testing grants with Gmail scopes can expire after seven days.
Do not infer or change the Google setting from local connection metadata.

Background work requires Olympus open and the PC awake. Opening briefs are once
per launch; New briefing is on demand. Pause background understanding in
Communications settings; manage Gmail in Armory > Plugins > Gmail.

Explain the GPU timeout to Kevin later, including the observed shared VRAM load,
CPU fallback latency and the limits of the 8B/14B quality evidence. Do not equate
successful inference with strong general analysis. The conservative publication
guard catches observed instruction/secret-request patterns, not every injection.

Preserve the registered desktop checkout's human edits. Keep private mail,
credentials and previews outside Git. npm audit reported two high-severity
build-tool advisories during 0.49 installation; dependency remediation is separate.

After the repair is installed and verified, Kevin requested review of
https://github.com/garrytan/gbrain for useful memory/agent architecture ideas.
Only repository metadata, README and MIT license have been read so far. Source
review and concrete recommendations remain; no code has been copied or installed.
