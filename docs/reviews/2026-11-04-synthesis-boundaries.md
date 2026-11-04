# Synthesis boundary review — 2026-11-04

Isolated branch codex/olympus-brief-synthesis; uncommitted, uninstalled. No real model calls, account changes, credentials, or production writes.

## Independent review and fixes

The review found that one combined citation could consume receipts/cursors for undisplayed constituents. Combined items now remain context-only to synthesis and their complete original text remains displayed. This is conservative interim protection; generalized concise synthesis still needs constituent-level citations and delivery accounting.

Long subjects previously caused the generic 260-character bound to cut off operator resolutions. Subjects are now separately bounded to 80 characters and the complete correction is preserved. A failing synthetic regression was reproduced and passes after the fix. Combined evidence regression, existing 26 intelligence checks, delivery checks, and TypeScript check also pass.

## Remaining live-use blockers

- Both useDashboardData message constructors discard PreparedBrief.provenance. Persist origin, actual provider/model/request ID, and cited source revisions alongside the saved brief before enabling synthesis. This change needs the conversation persistence contract, not just a UI property.
- Backend packet authority and IDs are caller-supplied, not reloaded/authenticated from native sources. Establish a native source builder with scope and revision checks before generation. Snapshot observation time is not source event time.
- Citation membership does not establish semantic entailment. Context retrieval currently takes recent memory/corrections, without a qualified relevance stage. Synthetic injected responses prove the contract only; they do not prove prompt-injection resistance, valid causal links, or intelligent prioritization.
- Empty output is not durable resolution state. Explicit user confirmations need source-bound resolution records, with re-opening only for materially changed evidence.
- Preserve the existing generation gate until spending protection, provider isolation, privacy scope, saved provenance, and actual model quality are qualified. This patch does not enable production inference.

## Supported spending controls (official documentation checked Nov 4)

Claude: https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans states disabling Usage credits under Settings > Usage limits access to included plan usage, and the feature applies to Claude Code. Verify this saved setting on the actual subscription account, and ensure the runner uses that subscription with no API credential/fallback. Disabling auto-reload alone does not prevent spending an existing credit balance. No account was inspected or changed; no authenticated machine-readable enforcement has been established.

OpenAI: https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites documents a separate app credit-use preference, off by default, and that an app limit below 100% prevents credit use. Applicability to Olympus's exact eligible Sign in with ChatGPT integration must be verified; do not assume these partner controls govern Codex CLI. https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-personal-plans distinguishes credit consumption from automatic purchases. No connection or consent was created.

These provide concrete account-level mechanisms to investigate, not proof of Kevin's current settings. A balance snapshot or local budget flag alone is insufficient for included-only execution.

## Native Gmail observation

Read-only Olympus database transaction observed at 2026-11-04T06:17:50.926474Z: enabled, connected; attempt 06:15:45.7379622Z; success 06:15:46.6566343Z; last_error null; next sync 06:20:46.6566368Z. Latest three runs succeeded incrementally at approximately 06:05, 06:10, 06:15. No trigger was issued. Automatic attribution follows cadence; runs do not record trigger origin. No natural interruption occurred in these three runs, so retry/recovery is not newly proven. Network recovery, seven-day boundary (earliest Nov 11 04:52 UTC), and useful live model brief remain unverified.

Other Communications thread remains active on the celestial-observatory interface; its workspace was not modified.
