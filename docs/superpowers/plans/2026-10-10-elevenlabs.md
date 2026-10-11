# ElevenLabs speech implementation plan

> Execute inline using superpowers:executing-plans, with a fresh final review.

**Goal:** Speak Olympus answers using the owner's ElevenLabs voice while preserving reasoning, transcription, readable history and interruption.

**Approved spec:** Explicit speech provider; voice `NOpBlnGInO9m6vDvFkFC`, model `eleven_v4`, English. Native credential storage and network. Preview, replay, Auto Speak and stop remain. No silent fallback or automatic paid retries. Help the owner configure the key after implementation.

**Architecture:** Rust owns credentials and bounded synthesis requests; React selects the provider and plays transient MP3 data. Existing realtime microphone transcription remains separate. Windows credential entry never exposes the key to the webview.

**Constraints:** Preserve other session's edits; no dependency/version churn. Browser fixture checks are separate from native/live-provider acceptance.

## Tasks
- [x] Add failing frontend route/cancellation tests and native validation/credential-boundary tests.
- [x] Implement native ElevenLabs commands, cancellable bounded HTTP, diagnostics, Windows credential prompt and connection check.
- [x] Integrate speech playback into existing voice lifecycle; provider preference migration and Settings controls.
- [x] Run focused tests, Rust tests, build, browser visual review and inspect screenshots. Fresh review and fixes.
- [ ] Save implementation, record memory milestone, launch native dev and guide local key setup.

## Review focus
Cancellation before/after HTTP completion; late stale audio; muted/failed playback receipts; provider changes during reasoning; unavailable credentials/model/voice without fallback.

## Execution ledger
Ruling: use the established hash-guarded staging directory for this shared checkout. Changes are prepared separately and applied only against captured bytes; no overwrite of concurrent release work.
Ruling: use a Windows credential dialog (native FFI), because this repository requires the webview never to receive provider keys. No frontend password input or environment-file editing.

Tests: initial migration test failed before implementation; native validation/cancellation contracts failed before implementation. Green: 15 ElevenLabs lifecycle assertions, 21 typed voice, 35 voice preferences, 20 realtime lifecycle, 18 console checks, 7 native ElevenLabs tests. Full Rust regression before the last two added tests: 488 passed, 18 ignored; subsequent 7-provider-test run passed. Frontend build passed. Browser settings: 27 checks at 1280, 1440 and 1920 widths, inspected screenshots. Two full visual reviews passed (21 scenario captures, 57 functional assertions and 14 Organizer assertions each).

Fresh review identified an idle timeout interrupting long output and a watchdog armed too late for stalled play promises. Both reproduced with failing tests and fixed. Screenshot inspection found inherited checkbox width shrinking text inputs; a geometry test reproduced it, scoped CSS fixed it, and recaptured screenshots show readable IDs.

Native launch note: use port 31420, the app's allowed debug origin. An independent browser test server on 31448 is not a valid native navigation destination. Separate WebView cache avoids collision with the installed app. Credential entry, live synthesis and listening quality remain user acceptance steps after local key setup.
