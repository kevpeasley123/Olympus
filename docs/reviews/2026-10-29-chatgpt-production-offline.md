# ChatGPT production connection offline implementation — October 28, 2026 MST

Supersedes the partial status in the earlier offline acceptance record. Base HEAD
316f72b8305e2e8b09a7cd1d3254a90a2404baee, branch codex/subscription-conversation;
source changes remain uncommitted with all concurrent work preserved. Exact source hashes are in `output/chatgpt-production-source-receipt.json`.

## Implemented

Production loopback listener binds before opening the browser. State, nonce, PKCE,
exact callback origin, one-use exchange, expiry, signed identity, account binding
and required plan scopes are validated. Provider transport uses fixed HTTPS origin,
no redirects, bounded response sizes/timeouts and sanitized errors. Windows keyring
adapter is compiled but was not called with real credentials.

The native dispatcher has a closed consent gate before filesystem, browser, network
or keyring effects. Behind it, background connection state allows cancellation while
consent is pending. Saved single-account registration is selected after restart;
unknown or ambiguous registration fails closed. Renewal and disconnect are wired.
Tokens remain backend-only; local disconnect survives malformed stored credentials
and unconfirmed remote revocation. Metadata is persisted before credentials so a
metadata write failure cannot orphan newly stored credentials. Metadata alone does
not authorize generation. Generation has a separate closed gate.

The acceptance profile uses its synthetic controller rather than the provider.
The test signing key is deliberately generated synthetic RSA material included only
under cfg(test), paired with fixture.json; it is not an account credential.

## Review and verification

A fresh read-only reviewer identified incomplete native account management and
pending-consent cancellation, slow-header deadline bypass, and corrupted-credential
removal failure. These were fixed. The corrupted-store regression failed before its
fix (`output/chatgpt-review-red.txt`). Saved-registration and partial-header deadline
regressions now pass. No claim that every test was observed failing first is made.

- Full final host Rust suite: 625 passed, 24 ignored, zero failed;
  `output/chatgpt-production-reviewed-rust.txt`.
- Final frontend build: `output/chatgpt-production-reviewed-build.txt`, passed.
- Connection browser fixture: `output/chatgpt-production-reviewed-browser.txt`;
  synthetic lifecycle at 1280/420 widths plus production-mode cancel/labels.
- Guidance/diff checks passed. No provider/model calls, real consent, credential
  writes, billing changes, installation, push or merge.
- Earlier restricted-runner tests failed/stalled on synthetic Git/loopback operations;
  the bounded host rerun passed. Do not report restricted-runner failures as a product
  failure or a green run.
- Prior broad visual run ended after 17 results, with ERR_NO_BUFFER_SPACE in mission
  active. A single serial host retry passed (`output/chatgpt-visual-host-retry.txt`).
  Restricted retry failed readiness before browser launch. Resource exhaustion is
  not proven. The final serial narrow batch passed all four cases, 14 functional checks and 22 Organizer workflow checks (`output/chatgpt-visual-narrow-final.txt`). Combined batches cover the default scenario matrix; this was not a single all-green full run. Final-source changed-panel tests also passed. Narrow connection screenshot was visually inspected: readable text and controls, no horizontal overflow.

## Native acceptance limit

Debug unbundled build using scripts/acceptance/tauri.claude-acceptance.json succeeded;
`output/chatgpt-native-final-build.txt`. This executable preceded the final review
fixes and is not final-source acceptance. Test PID 42312, window 724440, title
Olympus Claude Acceptance — isolated test. CUA observed the synthetic banner,
fixture vault and Preferences; stderr confirms a separate database under
com.projectolympus.claudeacceptance. Installed app window 330448 was untouched.

After native input, the tool reported user input and then a minimized window. Its
available API did not restore it; no unsupported UI automation or force termination
was used. Kevin was asked to restore only the test window. Synthetic Connect IPC
has not been exercised through WebView2. Test window/process was left in place.
Before final native acceptance, close only this test instance normally, rebuild
reviewed source under the same isolated identifier, and repeat Connect/cancel/
expiry/mismatch/renew/disconnect. Do not launch the installed production app.

## Remaining actions

Offline production code is implemented; end-to-end native and real-account acceptance
are not complete. Real consent requires separate approval and later enabling of the
closed gate; it is not requested while native verification is unfinished. Before
any generation, verify the Olympus-specific ChatGPT grant and other-app credit use
is disabled. No supported machine-readable spend guarantee has been established;
quota readings and successful consent alone do not authorize no-extra-spend claims.
Claude's prior authentication/isolation blockers remain separate and unchanged.

Changed areas: commands/chatgpt_plan.rs and submodules, native command registration,
ChatGPTPlanConnection/EngineSettings and native client, fixture/browser scripts,
Cargo ring dependency and architecture/handoff documentation. Full dirty-tree state
also contains prior subscription safeguard work; none was discarded.
