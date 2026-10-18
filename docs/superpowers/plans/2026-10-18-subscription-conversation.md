# Subscription conversation implementation plan

> Execute inline with the executing-plans and test-driven-development skills. No commits per operator instruction.

**Goal:** Offline-tested Codex text conversation transport behind unchanged billing refusal.

**Architecture:** An explicit session-only provider choice branches at the existing assistant command boundary before API enrichment. Olympus supplies bounded history to a new ephemeral app-server thread each turn. A bounded subprocess transport owns streaming and cleanup; a protocol state machine rejects unexpected tool requests and never retries or falls back.

**Spec:** Parent delegation of 2026-10-18 in this task. No live generation, credential changes, installation, or production launch. Keep preview running. Claude conversation unavailable.

## Tasks
- [x] Add failing Rust protocol tests for handshake/history, deltas, limits, cancellation, malformed/out-of-order events and forbidden tools; observe red.
- [x] Implement subscription.rs protocol and bounded subprocess transport; test with synthetic process streams only.
- [x] Add explicit provider selection and route tests; branch before existing paid API orchestration. Preserve API as explicit legacy selection only.
- [x] Build, run offline Rust suite and focused frontend/browser checks; independent focused review and document limits.

## Review focus
- Missing provider selection must not reach API.
- Cancellation before/after turn ID must stop and reap the process.
- Partial output remains visible with an app-level terminal notice.
- Malformed/oversized streams and tool requests fail without fallback.
- Protocol fields are from installed 0.163.0-alpha.10.2 schema; config isolation is not proven and must remain a separate live-launch blocker.

## Ledger
Ruling: use app-server protocol but keep live transport blocked for both unverified billing and unverified tool/config isolation. Installed app-server lacks exec's ignore-user-config switch. Cost: live acceptance needs additional isolation verification, not just billing screenshots.
Ruling: session-only provider selection defaults to unselected, requiring explicit legacy API choice. Existing API behavior is retained only after that choice.
Task evidence: protocol tests red then green; stalled stdin deadline and prompt EOF regression tests red then green; explicit terminal-event and status-event tests red then green. Independent review found premature slot release on cancellation; cooperative worker-await test red then green fixes it. No commits per instruction.
Verification: full offline Rust suite 552 passed / 18 ignored; TypeScript/Vite build passed (existing chunk-size warning); routing, usage unit/static/browser and guidance checks passed. Wide1440 and narrow900 full scenes inspected. Broader visual run completed with 18/21 captures, 14 functional checks and 22 Organizer checks passing. Three 1280x800 captures exposed composer overflow; short-desktop groups now sit side by side and mission details can scroll. All four affected 1280x800 scenarios then passed, the corrected screenshot was inspected and build/diff checks passed. Evidence: output/visual-subscription-final.txt and output/visual-short-window-final.txt. No remaining failures; the full suite was not redundantly rerun after the targeted CSS fix.
