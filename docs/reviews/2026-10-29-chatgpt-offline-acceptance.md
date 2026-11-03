# Isolated ChatGPT connection acceptance

Supersedes the partial implementation status in the earlier offline-progress note.
Kevin's implementation/offline-test approval remains valid. No installation, push,
merge, real consent, real credential writes, billing changes or generation occurred.

## Implemented and exercised

- Authorization preparation with state, nonce, PKCE and one-use bound callback.
- Signature/issuer/audience/nonce/expiry/account validation and plan-scope checks.
- Windows secure-store adapter (not invoked against real credentials); synthetic
  persistence only under the debug acceptance directory. Tokens never cross IPC.
- Serialized refresh/store and fixed-origin bounded OAuth transport; tests use
  local signed fixtures and injected refresh responses, not provider network calls.
- Native IPC controller, strictly disabled outside the isolated acceptance profile.
  Synthetic account consent calls the callback and token validator, then persists
  the synthetic session. Cancel/back, repeated connect, expiry, account mismatch,
  restart, renewal failure and disconnect/revocation failure are covered.
- Usable Connect/test controls in the isolated profile; production button disabled.
  All states disclose synthetic identity and generation remains blocked.

The synthetic controller is not the production OAuth browser/listener controller.
Actual consent, live JWKS/token exchange, OS credential persistence and remote
revocation have not been accepted. No claim of a working subscription conversation
or end-to-end native WebView2 acceptance is made. Do not ask Kevin to grant access
until the production consent/listener wiring and spending verification are ready.

## Final verification

- Full Rust suite: 620 passed, 24 ignored, no failures. Evidence:
  `output/chatgpt-plan-final-rust.txt`.
- Frontend build passed: `output/chatgpt-plan-final-build.txt`.
- Dedicated static browser check passed at 1280 and 420 widths: connect, back,
  expiry, mismatch, renewal/failure and revocation/failure. External requests were
  blocked. Screenshots: `output/chatgpt-connection-browser/connection-*.png`.
  Narrow screenshot visually inspected: readable controls/text, no overflow.
- Engine usage fixtures and guidance/diff checks passed.
- Original Vite-based browser harness timed out at navigation. The visual runner
  also had an unbounded fetch inside its readiness loop; each fetch now has an
  abort timeout. Static bundles render successfully, narrowing the remaining stall
  to the development-server path without claiming its optimizer cause proven.
- Full visual scenarios run through `scripts/visual-review-static.mjs`; see
  `output/chatgpt-plan-final-visual.txt` and its report for final status. This is
  browser regression evidence, not native installed-app acceptance.

Final broad visual result was not green: 17 scenarios produced results (16 passed;
`mission-active@1440x960` reported Chromium `ERR_NO_BUFFER_SPACE`), then the
bounded fallback's initial four-minute ceiling ended the run before narrow and
functional/Organizer coverage. That ceiling is now ten minutes for a future run;
no further broad retry was performed. The focused changed-panel tests passed in
both widths. Do not infer a product regression or a proven host-resource cause
from the Chromium error alone. Native acceptance remains unperformed.

## Files

Backend: `commands/chatgpt_plan.rs` and its `tokens`, `transport`, `controller`
modules plus the synthetic public-key/token fixture; registration in `mod.rs` and
`lib.rs`; direct ring dependency uses the existing locked package offline.
Frontend: `ChatGPTPlanConnection.tsx`, `EngineSettings.tsx`, `services/chatgptPlan.ts`.
Tests: connection browser fixture and bounded static visual runner; readiness
timeout correction in the existing visual runner. Existing concurrent work stays.
