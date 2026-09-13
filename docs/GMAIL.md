See the adopted [v2 architecture critique](COMMUNICATION-ARCHITECTURE-CRITIQUE.md) for the current skill boundaries and workflow.

# Manual local Communication Intelligence

See [Communication Intelligence](COMMUNICATION-INTELLIGENCE.md). Communications now leads with a manual, local evidence-backed brief. Two active typed skills use shared GraphNode / SkillContract definitions. The v2 graph has five nodes; project relevance uses a bounded deterministic matcher, not a discovery loop. Analytics remains collapsed. No model calls, Gmail writes, project changes or memory promotion are added. Earlier implementation entries below are historical.

# Native Gmail source — V1

Implementation date: 2026-09-12. This is a read-only source in the native desktop app, not a browser connector. A subsequent live session connected Gmail and verified a successful 206-message initial import; full end-to-end acceptance remains pending. The installed 0.15.0 release was not replaced by this development pass.

## Acceptance session status

See [GMAIL-ACCEPTANCE.md](GMAIL-ACCEPTANCE.md) for the 2026-09-12 validation pass. Native development startup, OAuth connection and a 206-message initial import succeeded. See the latest dated acceptance follow-ups; earlier missing-configuration notes are historical. The local database is unencrypted and its ACL permits CodexSandboxUsers read access; full-disk encryption remains unverified. No product changes or release install occurred.

## Operator setup

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or select a project for your private Olympus installation.
2. Under **APIs & Services → Library**, enable **Gmail API**.
3. Open **Google Auth platform → Branding → Get started** (if not already configured). Set an app name such as “Olympus personal”, support email and developer contact email. Review Google's policy yourself.
4. For a personal Gmail account choose **External** audience and keep publishing status **Testing**. Under **Audience → Test users**, add the exact Google account you will connect. Internal is only appropriate for an eligible Google Workspace organization and its users.
5. In **Data Access**, add only `https://www.googleapis.com/auth/gmail.readonly`. Do not add send, compose, modify, settings, or full-mail scopes.
6. In **Clients → Create client**, choose **Desktop app**, name it, create it, and download its JSON. Do not create a Web application client or configure an out-of-band redirect.
7. Save the downloaded JSON locally as:

   ```text
   C:\Users\kevpe\AppData\Roaming\com.projectolympus.commandstation\gmail-oauth-client.json
   ```

   For another Windows user this is `%APPDATA%\com.projectolympus.commandstation\gmail-oauth-client.json`. Olympus resolves its native app-config directory and shows the exact path in Preferences. Create that directory if necessary. Keep the downloaded `installed` JSON structure intact. This public Desktop client configuration is distinct from user tokens. Never paste it or tokens into chat. The repository ignores `gmail-oauth-client.json` and `client_secret_*.json`; the intended location is outside the repository.
8. Run the updated native development build (`npm run tauri -- dev`, from this worktree), or install an updated build through the normal Olympus release workflow. A browser at port 31429 is a visual preview and cannot connect Gmail.
9. Open **Preferences → Gmail · read-only source → Connect Gmail**. Read the local disclosure, complete Google's consent in your system browser, and return to Olympus. Olympus attempts to focus its window after verifying the account and starts the initial sync. Do not bypass an unexpected Google block; check audience, test-user membership, client type, API enablement, and scope.
10. Confirm the account address, successful sync receipt and message count. Start with recent 90 days of Inbox/Sent. Choose 30 or 7 days if the bounded sync reports a size limit.

These console paths follow Google's [Gmail Desktop setup guide](https://developers.google.com/workspace/gmail/api/quickstart/python) and [consent configuration guide](https://developers.google.com/workspace/guides/configure-oauth-consent). External Testing refresh tokens normally expire after seven days for this scope; Olympus will ask for reconnection rather than claiming a successful sync. See [Google's token-expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).

## Authority and privacy

Gmail owns mailbox facts. `gmail_messages` contains normalized local snapshots. `gmail_candidates` contains deterministic, generated interpretations with the source fingerprint. Neither writes tasks, decisions, curated memory, project status, or approvals.

“Friday is mentioned in a message” is communication evidence, not Kevin's commitment. Git remains primary for implementation state; operator notes remain primary for intent. Assistant prompts explicitly preserve these boundaries and treat message contents as untrusted data, never instructions.

Sync performs no model calls. Only a user question routed to communication retrieval supplies bounded excerpts to the configured reasoning provider under the existing Olympus model/storage contract. Preferences discloses this. Mailbox search and local candidate review do not contact a reasoning provider. Quoted excerpts may remain in subsequent conversation context just like other saved chat history.

Refresh tokens live in **Windows Credential Manager**, service `Olympus.Gmail.ReadOnly`, keyed by a fingerprint of normalized account email. Access tokens remain in a short-lived Rust client. The Gmail profile supplies account email, not a Google OpenID subject; no extra identity scopes are requested. User tokens, callback codes and OAuth response payloads are never returned to React or logged.

Mail text and cited excerpts are stored in the existing **unencrypted local SQLite database**, protected by the Windows user profile and any disk encryption the operator enables. They are not stored in the credential vault or Obsidian. This pass does not add application-level database encryption or certify a distribution security posture.

## Native authentication

`src-tauri/src/commands/gmail/auth.rs` implements the [installed-app flow](https://developers.google.com/identity/protocols/oauth2/native-app): system browser, authorization code, S256 PKCE, two independent cryptographic 32-byte values for verifier/state, exact state validation, one temporary `127.0.0.1` listener on an ephemeral port, 180-second authorization deadline, bounded callback reading, and cancellation. Google authorization/token/API URLs are fixed in Rust; client JSON cannot redirect tokens to another endpoint. HTTP redirects are disabled.

Only `gmail.readonly` is requested, and a grant with different scopes is rejected. `gmail.metadata` would not provide the bodies required for retrieval. API client routes allow only profile, message listing, message reads and history reads; there are no mailbox-write commands.

`keyring` 3.6 with explicit `windows-native` feature supplies Credential Manager access. Unsupported operating systems fail closed. The secret-store interface supports deterministic fixtures. Account persistence compensates by restoring the prior credential if its SQLite write fails. Cancellation/disconnect serialize with final account/cache commits, preventing an in-flight operation from re-enabling a disconnected account. A credential-removal failure stops sync but explicitly reports that removal must be retried.

Other new dependencies are base64 for Gmail/PKCE encoding, getrandom for state/verifier generation, html2text for inert text conversion, and encoding_rs for MIME charsets. Existing reqwest, SHA-256, SQLite, Tauri runtime, opener, and model routing are reused.

## Sync and bounded recovery

- Default recent 90 days; selectable 7/30/90/180/365. Inbox or Sent, excluding Spam/Trash. These are local ingestion bounds, not narrower Google authorization: the OAuth scope allows reading Gmail.
- A full run captures profile history ID **before** listing messages, follows list pagination, fetches full message payloads and reconciles previously in-scope IDs. A change arriving during the list will still be covered by the next incremental run.
- Incremental runs page through `history.list`, deduplicate changed IDs, apply current message reads and deletion tombstones. IDs are account-qualified. Cache, FTS, current candidates, and history cursor commit in one SQLite transaction.
- A history 404 triggers bounded reconciliation without first deleting good cache. Successful fallback is recorded as `expired_cursor_full`. If fallback fails, the old durable cursor/cache remain and the next attempt retries recovery.
- Limits: 20 list/history pages; 2,000 changed/reconciled IDs per batch; 600-second fetch budget; 4 MB API response; 1 MB normalized text per message; 32 MB aggregate canonical/clean body text per batch. Exceeding a limit fails with no cursor advancement. Reducing horizon also invalidates the cursor and requests a fresh bounded run. A malformed message fails the batch rather than silently skipping it. No resumable staging is implemented yet.
- HTTP calls have 25-second timeouts. 401 refreshes/retries; 429/5xx use bounded retries; 403, offline, malformed responses and invalid grants are visible safe error codes. No response bodies or token material are used as error messages.
- Native cadence starts about five seconds after launch and repeats about every five minutes while open. Successful connection and manual Sync now also run sync. One native operation runs at a time. There is no external scheduler, Pub/Sub, webhook, or closed-app wakeup. The current knowledge-audit graph is a specific research workflow, not a general scheduler; deterministic mailbox sync remains outside its agent graph.
- Startup marks unfinished sync receipts interrupted and preserves the last committed cursor. A crash after cache commit but before receipt finalization may leave an interrupted receipt alongside a successful account timestamp; no mail history is skipped.

## Normalization and storage

Tables appended idempotently to `src-tauri/schema.sql`:

| Table | Ownership |
|---|---|
| `gmail_accounts` | Safe account identity, scope, horizon, health and cursor; no credentials |
| `gmail_messages` | Account/message key, thread, timestamp, scope/availability and canonical normalized JSON snapshot |
| `gmail_search` | SQLite FTS5 subject/sender/plain-text body index |
| `gmail_sync_runs` | Operational receipts and safe error codes |
| `gmail_candidates` | Current generated interpretations plus source fingerprint |
| `conversation_mail` | Exact bounded mail evidence supplied to each persisted assistant reply |

On this Windows installation the operational database is `%APPDATA%\com.projectolympus.commandstation\olympus.sqlite`. No generalized live-external-source/cache primitive existed to reuse; research remains file-backed and knowledge-audit reports retain their own source snapshots.

Snapshots retain provider/account/message/thread/history IDs, sender/recipients/CC, subject, Gmail internal timestamp, RFC Message-ID/In-Reply-To/References, labels, normalized canonical text, separately named clean text, snippet, attachment metadata, retrieval timestamp, body status and fingerprint. Canonical text is the MIME-selected text representation, not raw RFC822 or raw HTML. Plain text wins multipart alternatives; nested multiparts and charset decoding are supported. HTML is converted to text and never mounted as markup. Signatures and quoted replies are deliberately retained; clean text currently only trims whitespace.

Attachments are metadata-only. A body stored by Gmail as a separate attachment is reported unavailable/partial, not downloaded or fabricated. Gmail disappearance marks cached availability false. Scope expiration removes a message from current retrieval but retains its snapshot until explicit cache removal. Current cache/candidates can change; already cited assistant evidence remains an independent historical snapshot.

## Retrieval, analysis and UI

Communication cues such as email/Gmail/inbox, “what did …”, “who said”, or “closing documents” activate backend retrieval. Other questions get no automatic mail packet. Explicit Preferences search can query directly. Search is lexical SQLite FTS5 (prefix terms joined by AND), not semantic/vector search; aliases, misspellings and implicit conversational follow-ups may need the user's query reformulated.

Assistant context includes at most two relevant threads and four messages per thread. It retains the matching message even if newer replies exist, chooses bounded text around query terms, and includes sender/date/subject/message/thread/account IDs, fingerprint, retrieval time, body status, connection state and last successful sync. Missing results are not represented as proof of no email. Both configured reasoning routes use the same backend-built packet; the frontend cannot inject that packet. Replies persist supplied provenance and expose it in the chat disclosure. An explicit cached thread view supports up to 100 in-scope messages, so it is labelled as a subset rather than a complete Gmail conversation.

The first analysis pass is intentionally deterministic: exact active-project-name mentions suggest a project relationship; questions and deadline/due-by phrases in project-related or Gmail-important incoming mail suggest response/deadline candidates. Quotes can trigger false positives because they are preserved. These signals are labelled possible/needs-review, tied to source fingerprints and displayed in Preferences and a collapsed **Mail attention** section in Project briefing. They never turn all unread mail into NEEDS_YOU, modify the Command instrument, or create authoritative tasks.

Preferences exposes connection health, identity, Connect/Reconnect, Cancel, Sync now, Disconnect, horizon, last/next sync, latest receipt, cached search, thread text and generated candidates. The browser preview explicitly says the desktop application is required.

## Disconnect, revoke, delete

- **Disconnect:** disable native access and remove the local refresh credential. Retain cache and historical chat evidence. Local disconnect does not revoke Google's authorization.
- **Revoke:** use [Google Account connections](https://myaccount.google.com/connections) to remove Olympus's authorization. A subsequent native refresh will require authentication.
- **Remove cached mailbox:** after disconnect, separately confirm removal of the current account's message cache, FTS, candidates and sync receipts. Safe identity metadata remains. Previously cited chat excerpts/answers remain until conversation removal. This is logical SQLite deletion, not a secure-erase guarantee. If switching accounts, remove an old account's cache before switching if desired.

## Google policy and distribution

`gmail.readonly` is a [restricted scope](https://developers.google.com/workspace/gmail/api/auth/scopes). Personal/testing use can qualify for verification exceptions and test-user limitations; that does **not** mean Olympus has passed production verification. Before distribution, review branding, scope justification, consent/privacy disclosures, Google verification and any applicable assessment requirements. Restricted data sent through a third-party reasoning server must be included in that review; local caching alone does not exempt the full architecture. See [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and the [Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy). No claim of verification, CASA assessment, policy certification or general-distribution readiness is made here.

## Verification and live acceptance

Verification on 2026-09-12: `npm run build` passed; `cargo test --lib --manifest-path src-tauri/Cargo.toml --target-dir C:\Users\kevpe\dev-target\olympus-memory` passed **262 tests, 0 failed, 2 paid tests ignored**, including **30 Gmail tests**. Gmail UI: **17 checks**; knowledge-audit UI: **12**; hybrid instrument UI: **82**. Existing typedVoice (21), voicePreferences (35), realtimeVoice (20), projectCommandBoard (15), ambientMotion (12,000 samples), and commandConsole harnesses passed. Build retains existing dependency/chunk warnings and the unused Rust ContentBlock field warning.

Deterministic fixtures contain only synthetic addresses/content. Native tests cover OAuth state/PKCE, MIME/HTML, attachment boundaries, full/history pagination, duplicate events, history expiry, atomic rollback, idempotence, restart, credential-store compensation, failed credential deletion, cache removal, SQLite reopen, domain routing, older thread matches and persisted provenance. `gmail-harness.html?run` tests connection hydration, search/thread text, offline errors, disconnect and confirmed cache removal without native credentials.

Live acceptance still required after setup:

1. Authorize in the system browser; verify readonly scope, identity, initial sync receipt and count.
2. Ask a specific Gmail-grounded question; inspect sender/message/thread IDs and text in the reply evidence disclosure.
3. Restart Olympus; verify credential refresh and incremental sync. Use an ordinary mail change made directly in Gmail to check incremental updates; Olympus must perform no mailbox write.
4. Disconnect; verify sync stops and cached mail is retained. Reconnect; verify bounded reconciliation. Test Google-side revocation separately.
5. Confirm acceptable volume/latency, false-positive candidate rate and scope before expanding usage.

No live mailbox, live OAuth consent, real Credential Manager roundtrip, or paid Gmail-grounded model answer was exercised during this pass. Synthetic/native tests cannot substitute for those acceptance steps.

## Deliberately deferred

Sending, drafts, label/read/archive/delete actions, attachment downloading/content indexing, Pub/Sub/cloud services, multi-account management UI, automatic tasks/decisions/replies, unbounded mailbox ingestion, semantic/vector retrieval, LLM background analysis, and promoting mail analysis into curated memory. The next useful addition after real read-only experience is operator-reviewed project linking with accepted/dismissed feedback and source freshness checks, before increasing autonomy.


## Live sync diagnostic follow-up — 2026-09-12

The operator saved a structurally valid Desktop client file and reported successful connected identity followed by an initial import exceeding the 2,000-message limit. With a seven-day horizon the native receipt reported `gmail_access_or_quota_denied` (HTTP 403). Mail sync is not accepted yet. This supersedes the earlier missing-configuration blocker; it does not establish the remaining live acceptance items.

A narrow defect fix now reads a bounded error payload and maps only allowlisted Google reason codes to rate-limit, exhausted quota, disabled API, insufficient scope, or domain-policy messages. Unknown reasons remain generic. Google free-text errors, token values and response bodies are neither logged nor returned to React. Transient 403 rate limits now use bounded retries. See https://developers.google.com/workspace/gmail/api/guides/handle-errors .

Fresh build passed; Rust suite: 263 passed, 0 failed, 2 ignored (31 Gmail tests). The latest observed post-reload sync was cancelled; the specific reason for the prior Google denial is still unknown. A manual seven-day retry is requested. No mailbox writes, scope expansion, commit, push or release install occurred.


## Communications mode

See [COMMUNICATIONS.md](COMMUNICATIONS.md) for the fourth dashboard mode, deterministic analytics, grouping, lazy source inspector, scoped questions and synthetic visual harness. This is local read-only intelligence over the existing cache. View range does not change sync history; candidate interpretations remain distinct from source counts and operator commitments. No historical comparison or semantic topic extraction is claimed.


### Communications UI refinement

The inbox now leads, with an 80px metric strip, a secondary Signals rail and collapsed Analytics. The center workspace scrolls above a reserved console row. List previews derive from stored Gmail snippets instead of HTML-converted body notation; canonical source, fingerprints and assistant retrieval are preserved. See the leading refinement section in [COMMUNICATIONS.md](COMMUNICATIONS.md).
