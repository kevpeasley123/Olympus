# Gmail acceptance record — 2026-09-12

## LIVE ACCEPTANCE RESULT

**PARTIAL — native startup verified; Google acceptance blocked by missing Desktop OAuth configuration.** No live-accepted date is assigned. Repository remains `agent/curated-memory`, with prior work preserved. No product code, version, commit, push, merge or installed release was changed in this validation pass.

## OAUTH

Expected client file remains absent at `C:\Users\kevpe\AppData\Roaming\com.projectolympus.commandstation\gmail-oauth-client.json`. Git ignore checks passed for `gmail-oauth-client.json` and `client_secret_fixture.json`; the intended configuration path is outside the repository. Current Google console setup documentation was rechecked. No real Google consent/callback/token exchange was attempted.

## NATIVE RUNTIME

Ran `npm run tauri -- dev` with `CARGO_TARGET_DIR=C:\Users\kevpe\dev-target\olympus-memory`. Vite serves port 31420 and the freshly built native executable is `C:\Users\kevpe\dev-target\olympus-memory\debug\project-olympus.exe`. Its startup log confirms native environment and database initialization. Native development acceptance is distinct from browser fixtures and the installed executable under `C:\Program Files\Project Olympus`.

The installed app was also running. A graceful close request returned false; it was not forcibly terminated. Close the older installed window before live acceptance so two versions do not concurrently use the same operational database. This session's tools cannot inspect/control native UI directly; Google consent and native UI observations require operator participation.

## CREDENTIAL CONTAINMENT

Static inspection confirms native-only token exchange, explicit Windows keyring feature, safe IPC status fields, no token columns in Gmail tables, and no Gmail module logging/model calls. The initialized database contains zero Gmail accounts/messages/candidates/sync receipts. No live credential was issued, so a post-authorization Credential Manager roundtrip or token-value containment sweep cannot be claimed. No credentials were read or printed.

## REAL SYNC

Not exercised. Native startup created the Gmail schema, with zero accounts and zero source messages. No real pagination, message samples, Gmail history ID, sync duration or mailbox evidence is available.

## RESTART

Not live-tested with a connected account. Synthetic persistence/restart tests passed; they do not establish native token refresh after restart.

## INCREMENTAL SYNC

Not exercised against Gmail. Operator must send the controlled unique test message after connection. No message was sent by Codex or Olympus.

## ASSISTANT RETRIEVAL

No paid/live Gmail-grounded question was submitted. Source routing/context/persistence were inspected and existing deterministic tests rerun. Actual answer quality and conversational follow-up retrieval remain unverified.

## SOURCE AUTHORITY

Native context labels mail as untrusted communication evidence and preserves Git/operator decision authority. Synthetic tests passed. No live contradictory-email test or real model behavior was exercised.

## CANDIDATE QUALITY

No real-mail baseline exists. Current candidates use exact project-name/phrase/question heuristics; false positives from quoted text and missed synonyms remain expected limitations. No tuning or new linking capability was implemented.

## FAILURE / RECOVERY

Expired-cursor, transaction rollback, interruption, disconnect and cache removal remain **deterministic-tested**, not live-accepted. No network adapter was disabled, credential revoked, history cursor corrupted, or real cache removed.

## SECURITY OBSERVATIONS

**Classification: should be addressed soon.** This is not an observed exfiltration, but the current access boundary is broader than a private credential vault.

Read-only inspection of `C:\Users\kevpe\AppData\Roaming\com.projectolympus.commandstation\olympus.sqlite` confirmed the ordinary `SQLite format 3` header: SQLite itself is unencrypted. Schema stores canonical/clean email bodies, sender/recipient/subject/date/labels, attachment metadata, provider IDs/fingerprints and an FTS copy; conversation evidence can retain excerpts after cache removal. Refresh credentials are designed to reside separately in Credential Manager.

The DB ACL grants full control to the Windows user, SYSTEM and Administrators, and read/execute to `ODIN\CodexSandboxUsers`. Therefore “only the operator can read the database” would be inaccurate. BitLocker inspection returned access denied; full-disk encryption is **unknown**, not assumed enabled. Disk encryption would protect offline disk access, not reads by an already authorized local process. No ACL/encryption changes were made.

Before substantial sensitive-mail ingestion, review the intended local-process/sandbox read boundary and verify device encryption through Windows settings. If those local readers are outside the operator's intended trust boundary, address that before importing mail. For application-level encryption later, whole-database encryption can preserve SQL/FTS behavior, but requires a compatible SQLite build, secure key lifecycle/recovery, transactional export/migration, encrypted backup handling, and validation of journals/temp files. Migration cost is moderate across the shared operational database; losing its key would affect more than Gmail. Field-level body encryption would additionally require redesigning plaintext FTS. Cryptographic I/O and key unlock add overhead; actual performance must be measured. Secure removal of old plaintext files/backups needs separate planning. Do not implement this as an unreviewed acceptance-session change.

## PRIVACY / MODEL BOUNDARY

Code inspection found no model call in Gmail sync/normalization/candidate work. New mail is not automatically submitted for LLM analysis. The assistant adds bounded Gmail evidence only when communication retrieval is selected, and the existing Responses request sets `store:false`. Previously discussed email text may remain in normal conversation history and be sent on later turns; this is distinct from a new mailbox retrieval. Post-consent live transmission was not observed.

## DEFECTS FIXED

None. This pass updates validation documentation only. No new Gmail capability was introduced.

## TESTS

Fresh `npm run build` passed. Fresh `cargo test --lib --manifest-path src-tauri/Cargo.toml --target-dir C:\Users\kevpe\dev-target\olympus-memory`: **262 passed, 0 failed, 2 ignored**, including 30 Gmail tests. Existing dependency/chunk and unused-field warnings remain. Gmail browser fixture passed 17 checks; knowledge fixture passed 12. Instrument fixture initially failed the fixed 900 ms pointer-settling assertion; inspection afterward showed parallax had settled near zero. The isolated rerun passed all **82 checks** without a code change; the initial timing failure remains recorded as intermittent. Browser fixtures simulate native responses and are not proof of live Gmail behavior. Voice code was not touched.

## STILL UNVERIFIED

Real OAuth consent/callback, Credential Manager storage, initial mailbox sync/MIME samples, authenticated restart, controlled incremental/no-change sync, real assistant answers, authority-conflict behavior, candidate quality, native offline recovery, disconnect/reconnect and real local-cache removal. BitLocker state is unknown.

## NEXT RECOMMENDATION

Finish the local Google setup in [GMAIL.md](GMAIL.md), then execute the controlled live checklist. Do not advance to project linking yet. The existing account/message/thread IDs, snapshots, fingerprints, candidate separation and briefing disclosure are reusable; accepted/dismissed feedback, stable project IDs, relationship lifecycle, stale-source handling and quality evidence are missing. Operator-reviewed linking remains a plausible next feature, not a conclusion established from real mail.


## Live sync diagnostic follow-up — 2026-09-12

The operator saved a structurally valid Desktop client file and reported successful connected identity followed by an initial import exceeding the 2,000-message limit. With a seven-day horizon the native receipt reported `gmail_access_or_quota_denied` (HTTP 403). Mail sync is not accepted yet. This supersedes the earlier missing-configuration blocker; it does not establish the remaining live acceptance items.

A narrow defect fix now reads a bounded error payload and maps only allowlisted Google reason codes to rate-limit, exhausted quota, disabled API, insufficient scope, or domain-policy messages. Unknown reasons remain generic. Google free-text errors, token values and response bodies are neither logged nor returned to React. Transient 403 rate limits now use bounded retries. See https://developers.google.com/workspace/gmail/api/guides/handle-errors .

Fresh build passed; Rust suite: 263 passed, 0 failed, 2 ignored (31 Gmail tests). The latest observed post-reload sync was cancelled; the specific reason for the prior Google denial is still unknown. A manual seven-day retry is requested. No mailbox writes, scope expansion, commit, push or release install occurred.

Post-fix browser regressions: Gmail 17, knowledge 12, instrument 82 checks passed.


## Rate-limit pacing and initial import — 2026-09-12

Operator reported a classified rate-limit error. Added 250 ms spacing between Gmail request starts, 5/10-second transient retry backoff and numeric Retry-After handling (waits above 60 seconds defer to a later sync). Cancellation stays responsive during waits. Latest real native SQLite receipt now records succeeded / bounded_full / 206 changes / no error. This establishes an initial import, not complete production acceptance; MIME review, controlled incremental/restart, grounded answers and disconnect remain pending. Fresh Rust suite: 264 passed, 0 failed, 2 ignored. Frontend build passed. No commit, push or install. Earlier entries below are historical.


Fresh browser regressions after pacing change: Gmail 17, knowledge 12, instrument 82 checks completed successfully. Read-only native metadata also confirms 206 cached messages; successful run began 2026-09-13T01:16:57Z. No mail bodies or credentials were printed during this verification.
