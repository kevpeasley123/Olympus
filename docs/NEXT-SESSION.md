# Next session

## Olympus 0.51.0

Repair branch `codex/brief-signin-linewrap`, based on master `a4ffc6a`.
Olympus 0.50 installed and refreshed Gmail, but its actual brief exposed a wrapped
Google sign-in condition missed by the filter. Version 0.51 normalizes whitespace
before classification. The sanitized regression reproduced the installed failure.
Release verification passed; installation and final installed checks follow.

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
- All 86 release scripts have passing results. Cold navigation timed out in the
  disclosure check; it now waits for DOM and explicit scene readiness. An unchanged
  project-dock test passed on isolated rerun after its broad-run timeout.
- Visual gate: 20/21 captures passed initially, with one chats readiness timeout
  recording ERR_NO_BUFFER_SPACE. That scenario passed unchanged in isolation.
  All 14 functional and 22 Organizer checks passed in the full run. No UI changed
  in this follow-up; the 0.50 disclosure was inspected collapsed and expanded.
- Independent read-only code review found no remaining blocking issue.
- Same private real-mail snapshot: 8B remained stiff; 14B produced a better brief
  in about 183 seconds. Synthetic cases exposed settled-receipt filler and an
  estimate promoted to certainty. Final prompt passed both plus appointment,
  autopay and explicit blocked-sign-in checks. This is bounded quality evidence,
  not a guarantee of broad reasoning quality.
- Final native real-mail rerun passed in 198 seconds with source-bound saved prose:
  automatic payment, a new credit and a code-update summary; no routine sign-in
  or spoken coverage disclaimer. Gmail refreshed at 18:16 Phoenix without reconnecting.
  Installed 0.50 used14B and saved a brief, but repeated a wrapped Google notice.
  Its automatic syncs succeeded at18:24 and18:29; 8B analysis completed at18:31.
  The 0.51 sanitized regression failed before whitespace normalization and passed
  after it. Native inspection of a fresh private installed snapshot excluded the
  actual wrapped notice and retained seven sources. Installed0.51 checks follow.
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
