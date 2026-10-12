Status, 2026-10-12: the reference for the native Gmail source, released from 0.16.0 and part of the installed 0.30.0. Analysis of mail is covered in [COMMUNICATION-INTELLIGENCE-V3.md](COMMUNICATION-INTELLIGENCE-V3.md) (thread triage, graph `communication-intelligence/v4`), [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md) (situation understanding) and [EMAIL-ATTENTION.md](EMAIL-ATTENTION.md) (attention suggestions, quota pacing, optional local analysis model).

# Native Gmail source

Implemented 2026-09-12. This is a read-only source in the native desktop app, not a browser connector.

The 2026-09-12 acceptance pass is recorded in [GMAIL-ACCEPTANCE.md](archive/GMAIL-ACCEPTANCE.md): OAuth connection and a 206-message initial import succeeded. That pass also found the local database unencrypted, with an ACL granting read access to a local CodexSandboxUsers group, and could not verify full-disk encryption.

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
8. Use the installed desktop app, or `npm run tauri dev` from a checkout. The browser dev server (`npm run dev`) is a visual preview and cannot connect Gmail.
9. Open **Preferences → Gmail connection → Connect Gmail**. Read the local disclosure, complete Google's consent in your system browser, and return to Olympus. Olympus attempts to focus its window after verifying the account and starts the initial sync. Do not bypass an unexpected Google block; check audience, test-user membership, client type, API enablement, and scope.
10. Confirm the account address, last sync and saved message count; the latest run is under **Sync details**. The default range is the recent 90 days of Inbox and Sent. Choose 30 or 7 days if the bounded sync reports a size limit.

These console paths follow Google's [Gmail Desktop setup guide](https://developers.google.com/workspace/gmail/api/quickstart/python) and [consent configuration guide](https://developers.google.com/workspace/guides/configure-oauth-consent). External Testing refresh tokens normally expire after seven days for this scope; Olympus will ask for reconnection rather than claiming a successful sync. See [Google's token-expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).

## Authority and privacy

Gmail owns mailbox facts. `gmail_messages` contains normalized local snapshots. `gmail_candidates` contains deterministic, generated interpretations with the source fingerprint. Neither writes tasks, decisions, curated memory, project status, or approvals.

“Friday is mentioned in a message” is communication evidence, not Kevin's commitment. Git remains primary for implementation state; operator notes remain primary for intent. Assistant prompts explicitly preserve these boundaries and treat message contents as untrusted data, never instructions.

Sync itself performs no model calls. Background situation understanding, which the operator can pause in Communications, sends changed in-scope threads to its configured route: the OpenAI primary route by default, or an opt-in local Ollama model ([EMAIL-ATTENTION.md](EMAIL-ATTENTION.md)); see [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md). Consecutive background failures back off from five minutes to four hours. A user question routed to communication retrieval supplies bounded excerpts to the selected reasoning provider under the existing Olympus model/storage contract. Thread triage (Communications → Browse email → Thread triage history) and **Draft reply** run only on request and use the fixed OpenAI primary route; triage may request bounded expansion within the same selected cached threads. Preferences discloses this. Mailbox search and local candidate review do not contact a reasoning provider. Quoted excerpts may remain in subsequent conversation context just like other saved chat history.

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
- Limits: 20 list pages; 2,000 reconciled IDs per batch; 1,800-second (30-minute) fetch budget; 4 MB API response; 1 MB normalized text per message (longer text is truncated and marked partial); 32 MB aggregate canonical/clean body text per batch. Exceeding a list, ID, budget or aggregate limit fails with no cursor advancement. More than 20 history pages or 2,000 changed IDs falls back to bounded reconciliation, as an expired cursor does. Reducing horizon also invalidates the cursor and requests a fresh bounded run. No resumable staging is implemented.
- Message reads run on four workers sharing one request slot spaced 250 ms apart: at most four reads per second, about 4,800 of Google's 6,000 per-minute quota units. A 429 or rate-limit 403 holds every worker for at least 60 seconds (a 5xx for at least 5 seconds) and doubles the spacing, up to one second, for the rest of the run. A Retry-After above 60 seconds ends the run as rate-limited; the next cadence retries. See [EMAIL-ATTENTION.md](EMAIL-ATTENTION.md#gmail-quota-repair).
- A body that cannot be decoded degrades rather than failing the batch: unknown charsets fall back to UTF-8 or Windows-1252, invalid bytes become replacement characters, and malformed base64, oversized parts, excess MIME depth or parts, and HTML conversion failures drop only that part. The snapshot records `body_partially_decoded` or `body_undecodable`. A message without a readable ID or timestamp (internalDate, then the Date header) is skipped and counted in the run receipt as `skipped_unreadable_messages:N`. Spam, Trash, drafts and archived mail are not body-decoded at all.
- HTTP calls have 25-second timeouts. 401 refreshes/retries; 429/5xx use bounded retries; 403, offline, malformed responses and invalid grants are visible safe error codes. A 403 maps only allowlisted Google reason codes to rate-limit, exhausted-quota, disabled-API, insufficient-scope or domain-policy messages; other reasons stay generic. No response bodies or token material are used as error messages.
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

Attachments are metadata-only. A body stored by Gmail as a separate attachment is reported unavailable/partial, not downloaded or fabricated. Gmail disappearance marks cached availability false. Scope expiration removes a message from current retrieval. Each commit deletes out-of-scope rows older than the horizon; out-of-scope rows inside it (spam, trash, drafts, archived or deleted mail) keep identity and headers only, with body text and snippet removed. The fingerprint covers content only (headers, body, snippet, attachment name/type/size and body status), not labels or history ID, so reading or relabelling mail does not trigger re-analysis. Fingerprints stored by earlier versions change once, on each message's next fetch. Current cache/candidates can change; already cited assistant evidence remains an independent historical snapshot.

## Retrieval, analysis and UI

Communication cues such as email/Gmail/inbox, “what did …”, “who said”, or “closing documents” activate backend retrieval. Other questions get no automatic mail packet. Explicit Preferences search can query directly. Search is lexical SQLite FTS5 (prefix terms joined by AND), not semantic/vector search; aliases, misspellings and implicit conversational follow-ups may need the user's query reformulated.

Assistant context includes at most two relevant threads and four messages per thread. It retains the matching message even if newer replies exist, chooses bounded text around query terms, and includes sender/date/subject/message/thread/account IDs, fingerprint, retrieval time, body status, connection state and last successful sync. Missing results are not represented as proof of no email. Both configured reasoning routes use the same backend-built packet; the frontend cannot inject that packet. Replies persist supplied provenance and expose it in the chat disclosure. An explicit cached thread view supports up to 100 in-scope messages, so it is labelled as a subset rather than a complete Gmail conversation.

The first analysis pass is intentionally deterministic: exact active-project-name mentions suggest a project relationship; questions and deadline/due-by phrases in project-related or Gmail-important incoming mail suggest response/deadline candidates. Quotes can trigger false positives because they are preserved. These signals are labelled possible/needs-review and tied to source fingerprints. They appear in Preferences (up to 12, under Browse saved email) and in Communications → Browse email as row tags and the Attention, Responses and Projects groups. They never turn all unread mail into NEEDS_YOU, modify the Command instrument, or create authoritative tasks. Model-generated attention suggestions are separate; see [EMAIL-ATTENTION.md](EMAIL-ATTENTION.md).

**Preferences → Gmail connection** shows the account and connection state, Connect/Reconnect, Sync now, Cancel operation (while busy), the email history range, saved message count and last sync. **Sync details** holds the next sync and latest run; **Manage connection & saved data** holds Disconnect and Remove cached mailbox; **Browse saved email** holds cached search, thread text and generated candidates. The browser preview says the desktop application is required.

## Design-review changes — September 28, 2026

Design-review item U12, with F1. Code: `GmailSettings.tsx`, `services/gmail.ts` (`gmailHealth`, `gmailCacheCounts`), `gmail/mod.rs` and `gmail/store.rs` (`gmail_cache_counts`). Communications' side is in [COMMUNICATIONS.md](COMMUNICATIONS.md).

- **Where it lives.** The Gmail section of the Preferences dialog reads status once when Preferences opens and polls every 2 s only while the section is expanded. Communications' settings link opens Preferences with the section expanded and focused.
- **Actions follow state.** Sync now is disabled while authentication is required (Reconnect first). Disconnect is shown only while connected. Dates use the shared formatter; Gmail message ids move behind an Inspect source disclosure.
- **Health.** `gmailHealth` states the connection as loading, not connected, connected (read only), syncing, authentication required, or sync failed — never "Connected" alone while an error is recorded — and a sync failure carries the backend's own scheduled `nextSync`, never an estimate.
- **`gmail_cache_counts`.** A read-only command that counts, for the connected account, messages, situations, situation updates, drafts, analysis runs and imported document context (contexts and sources), and optionally how many cached messages are older than a given range (7, 30, 90, 180 or 365 days, validated like `gmail_set_horizon`). It deletes nothing. Unit tests use in-memory databases.
- **Remove cached mailbox.** The confirmation now states the counts ("Deletes 1,842 messages, 3 situations, 12 updates, 2 drafts and imported document context (58 sources).") plus the search index, candidates, sync receipts and analysis runs, says **Cannot be undone**, and gives the recovery path: mail is imported again by reconnecting; imported document context must be re-imported with `scripts/import-situation-context.py` while Olympus is stopped. The confirm button is destructive-styled and Keep cache has focus. If the counts cannot be read, the dialog says so and still lists what removal deletes.
- **Narrowing the history range.** Choosing a shorter range asks first: "N cached messages older than D days will be removed from the cache on the next sync." Situations, updates and drafts are kept, but understanding no longer reads the removed mail; widening later re-imports it on a fresh sync. The options are Keep the current range or Narrow. Widening applies directly and syncs, as before.

Not verified with a real account: the error states, the counts, the next-attempt times and revoke.

## Disconnect, revoke, delete

- **Disconnect:** disable native access, send Google a best-effort revoke request for the refresh token, and remove the local refresh credential. The revoke is neither awaited nor verified, so confirm it in Google Account connections. Retain cache and historical chat evidence.
- **Revoke:** use [Google Account connections](https://myaccount.google.com/connections) to remove Olympus's authorization. A subsequent native refresh will require authentication.
- **Remove cached mailbox:** after disconnect, separately confirm removal (since 2026-09-28 the confirmation states the backend's counts and the recovery path; see above) of the current account's message cache, FTS, candidates and sync receipts, together with everything derived from them in one transaction: situations and briefings, situation sources (verbatim quotes and addresses), situation notes, attached document context, local reply drafts, analysis runs, run events and feedback. Safe identity metadata and the background pause preference remain. Previously cited chat excerpts/answers remain until conversation removal. This is logical SQLite deletion, not a secure-erase guarantee. If switching accounts, remove an old account's cache before switching if desired.

## Google policy and distribution

`gmail.readonly` is a [restricted scope](https://developers.google.com/workspace/gmail/api/auth/scopes). Personal/testing use can qualify for verification exceptions and test-user limitations; that does **not** mean Olympus has passed production verification. Before distribution, review branding, scope justification, consent/privacy disclosures, Google verification and any applicable assessment requirements. Restricted data sent through a third-party reasoning server must be included in that review; local caching alone does not exempt the full architecture. See [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and the [Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy). No claim of verification, CASA assessment, policy certification or general-distribution readiness is made here.

## Verification

Native unit tests (`cargo test --lib`) use only synthetic addresses and content. They cover OAuth state/PKCE, MIME/HTML, attachment boundaries, full/history pagination, duplicate events, history expiry, atomic rollback, idempotence, restart, credential-store compensation, failed credential deletion, cache removal, SQLite reopen, domain routing, older thread matches, persisted provenance and quota pacing. `gmail-harness.html?run` tests connection hydration, search/thread text, offline errors, disconnect and confirmed cache removal without native credentials. Desktop acceptance items that remain open for Gmail are listed in [NEXT-SESSION.md](NEXT-SESSION.md).

## Deliberately deferred

Sending, Gmail drafts (reply drafts stay local), label/read/archive/delete actions, attachment downloading/content indexing, Pub/Sub/cloud services, multi-account management UI, automatic tasks/decisions/replies, unbounded mailbox ingestion, semantic/vector retrieval, and promoting mail analysis into curated memory.

## Communications mode

See [COMMUNICATIONS.md](COMMUNICATIONS.md) for the fourth dashboard mode: Situation maps, Browse email (groups, search, thread inspector, analytics) and scoped console questions. View range does not change sync history; candidate interpretations remain distinct from source counts and operator commitments.
