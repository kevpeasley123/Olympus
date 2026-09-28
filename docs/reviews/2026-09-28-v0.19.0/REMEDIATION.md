# Remediation status — review of 0.19.0

Fixes were applied on `claude/blissful-lamport-2l4o96`, on top of `e4669c9` (0.19.0). The version number is unchanged; packaging and release remain the operator's decision.

## Verification

| Check | Result |
| --- | --- |
| `npm run build` | Passes. The `gray-matter` eval warning is gone. The main chunk dropped from 1,248 kB to about 760 kB. |
| `cargo test --lib` (Linux) | 383 passed, 0 failed, 11 ignored. The 11 ignored are 9 real-vault checks, now `#[ignore]` and run with `-- --ignored` on the owner's machine, plus the 2 existing paid smoke tests. |
| `cargo check --lib --tests --target x86_64-pc-windows-gnu` | Passes with no warnings. This is a type-check only: C compilation was stubbed and no Windows code ran. |
| Browser harnesses (Playwright, dev server) | communications 58, command-agent 35, project-ring, project-board, console, ambient-motion: all pass. `hybrid-core-harness` fails its "voice signature" timing check, but it fails the same check on the unmodified 0.19.0 under headless SwiftShader. |
| XSS probe | The real LibraryPanel markdown pipeline renders `<iframe srcdoc>`, `<script>`, `<style>` and `<img onerror>` as escaped text. |

**Not done:** launching the desktop app, installing, any live OpenAI, Anthropic or Gmail call, or running any Windows-only path. The following have been type-checked and nothing more:
- the Job Object
- process-identity matching
- `CREATE_NO_WINDOW`
- the keyring
- the opener
- the CSP inside WebView2

## Status by finding

**Legend:** Fixed = implemented with tests where testable. Partial = the defect is addressed but a residual risk remains, as described. Deferred = not changed.

| ID | Status | Notes |
| --- | --- | --- |
| S-1 | Fixed | `rehype-raw` and `gray-matter` are removed, and wikilinks render through a remark plugin. A CSP is set with no `unsafe-eval` and `frame-src 'none'`; see *Behaviour changes* for scope. The source label now comes from Rust frontmatter (`source`, `source_name`, `channel`, `publisher`). |
| S-2 | Partial | Attachments now use one-use tokens held in Rust. `write_memory_artifact` takes an artifact enum, and `.git`/`.obsidian` path components are rejected. **Residual:** a script in the webview could still resolve the write gate and prepare delegation. The CSP and the S-1 fixes close the known way in; proving a human approved an action is still a design item in `OPERATOR-APPROVAL-DESIGN.md`. |
| S-3 | Fixed | Only NotFound counts as absent. The recheck compares exact bytes after approval. Temp files are `create_new`, and a writer mutex is added. |
| S-4 | Partial | Each stage gets an exact `--tools` list, with `--setting-sources ""`, `--strict-mcp-config` and an empty MCP config. `Bash(git diff:*)` is removed. Checks run with an allowlisted environment and no API keys, and are labelled "runs agent code". Two CLI bugs were found and fixed: `--tools` was swallowing the prompt until `--` was added, and planning launches were probably failing because of it. **Residual:** the allowed `npm run build`/`cargo test` still run code the agent can edit, and there is no OS sandbox. This is documented in `AGENT-DELEGATION.md`. |
| G-1 | Fixed | The signature is filtered to in-scope rows within the horizon. Out-of-scope rows past the horizon are pruned, and out-of-scope messages keep no body. |
| G-2 | Fixed | Decoding is lossy with a fallback charset. Degraded body statuses replace batch failures, scope is checked before the body is decoded, and a missing `internalDate` falls back to the Date header or skips the message. |
| M-1 | Fixed | Unreadable side rows are logged and skipped. A desktop load error leaves the app unhydrated and shows the reason in chat; seed data is never saved over real settings. |
| M-2 | Fixed | `error` events are recorded. A stream with no `stop_reason` is treated as truncated, or as an error if no text arrived. |
| M-3 | Fixed | The SSE decoder buffers bytes. A split em-dash test is added. |
| M-4 | Partial | Gmail, research, commits, the command board and the library index now travel in a delimited user-role `<olympus_evidence>` message before the latest turn. The Decision Log deliberately stays in the cached system block: it is operator-authored, reaches the vault only through the gate, and is the largest cached section. |
| M-5 | Fixed | Output budget per route: Sol 8k, Astra 32k, Claude 64k. See *Behaviour changes*. |
| M-6 | Fixed | Vault git runs with `-c core.quotePath=false --literal-pathspecs` and reads `-z` output. Tested with a `Café — notes [1].md` commit. |
| M-7 | Fixed | `open_vault_note` uses the opener plugin. |
| M-8 | Fixed | Shared `read_existing` / `replace_if_unchanged` helpers; the path is re-resolved after approval. `pantheon_migrate` now fails closed. |
| M-9 | Fixed | The phase is `'complete'` in both counts. Tests added. |
| M-10 | Fixed (type-checked only on Windows) | PID plus creation time is checked before a process is reported as running or killed. The handle is held during `taskkill`. `tasklist` is no longer used. |
| M-11 | Partial | Checks are detected per worktree. Not-applicable and missing-dependency results no longer block completion. `CARGO_TARGET_DIR` is shared per project. **Deferred:** there is no dependency-install step. |
| M-12 | Fixed | Recovery moves a run from `testing` back to `awaiting_review`, and the interrupted check blocks completion until it is rerun. |
| M-13 | Partial | A 45-minute limit applies per launch, and a Job Object with kill-on-close covers app exit (type-checked only). The docs now say "$5 per launch". **Deferred:** a per-run spend ledger. |
| M-14 | Fixed | html2text runs through `config::plain().allow_width_overflow()` inside `catch_unwind`. |
| M-15 | Fixed | The page and ID limits fall back to full reconciliation. |
| M-16 | Fixed | A situation over the limit is saved as a deferred observation, so no repeat call is made; closing, dismissing or merging re-queues it. Background failures back off from 5 minutes to 4 hours. The planned pre-call limit check was dropped because it would also have blocked mapping mail to existing situations. |
| M-17 | Fixed | A thread over the participant bound is recorded as skipped. |
| M-18 | Fixed | Fingerprints cover content only. |
| M-19 | Fixed | `remove_cache` purges the account's communication tables in one transaction. The background-pause preference is kept. |
| M-20 | Fixed | Four bounded workers share one pacing slot; spacing is 100 ms (about 10 requests/s). |
| M-21 | Fixed | Library links open through the new `open_external_link` command (http and https only). An `on_navigation` guard refuses off-origin top-level navigation. |
| M-22 | Fixed | The dialog shows a FIFO queue. `resolve_vault_write` returns whether the request was accepted, and the UI shows "Nothing was written" when it expired. |
| M-23 | Partial | The polling store skips unchanged results. The scene key is built only from geometry, and resize is debounced. The command board is memoized and App handlers are stable. **Deferred:** updating label textures in place. |
| M-24 | Fixed | Ambient motion and the scene loop stop while hidden, and resume on visibility or resize. |
| M-25 | Fixed | The delegation and Gmail status/workspace commands run on `spawn_blocking`. |
| L-1 | Fixed | The cancel channel is re-checked after the monitor loop. |
| L-2 | Fixed | |
| L-3 | Fixed | |
| L-4 | Fixed | |
| L-5 | Fixed | |
| L-6 | Fixed | |
| L-7 | Partial | Fixed in `write_memory_artifact`. `append_profile_observation`, `write_pantheon_entry`, `save_attachment_to_vault` and `pantheon_migrate` still commit before logging. |
| L-8 | Fixed | |
| L-9 | Fixed | `PRAGMA foreign_keys=ON` is set in `schema.sql`. Existing rows are not re-checked, and no production code deletes parent rows. |
| L-10 | Fixed | 15 s connect timeout, plus idle timeouts per request and per chunk. |
| L-11 | Fixed | |
| L-12 | Fixed | |
| L-13 | Fixed | |
| L-14 | Fixed | 12k-character index, 120k-character history. |
| L-15 | Fixed | |
| L-16 | Fixed | Revocation is best-effort, runs in the background, and can be lost if the app exits immediately. |
| L-17 | Fixed | |
| L-18 | Fixed | |
| L-19 | Fixed | |
| L-20 | Fixed | |
| L-21 | Fixed | |
| L-22 | Fixed | GUI subsystem in release builds. Every console child gets `CREATE_NO_WINDOW` and a null stdin. |
| L-23 | Fixed | `useDelegationRuns` listens for `delegation-run-updated`; the poll is now 10 s. |
| L-24 | Fixed | Deleted `AmbientOrbits`, `ProjectBriefing`, `GmailAttention` (orphaned by the previous deletion) and `services/tauri.ts`, and removed the duplicate `isTauriRuntime`. |
| L-25 | Partial | The research-verification tables are now in `schema.sql`. The six unused tables are left in place. |
| L-26 | Deferred | `LibraryPanel.tsx` and `projectRing.ts` are not split. |
| Q-1 | Fixed | |
| Q-2 | Fixed | Regression tests were added for every listed case. |

## Behaviour changes the operator will notice

- **CSP scope:** the CSP applies to production builds. `tauri dev` loads Vite directly. The voice SDP POST to `api.openai.com` is allowed; WebRTC media is not governed by `connect-src`. **Voice needs a desktop check.**
- **Source labels:** the library shows the source from note frontmatter. Before, it showed "Local source" almost everywhere, because gray-matter was parsing a body that had already been stripped.
- **Failed attachment save:** the file must be picked again, because its token is spent.
- **Gmail re-analysis:** fingerprints change once, on each message's next fetch, causing at most one re-analysis of affected threads. Syncs are faster (four workers, 100 ms pacing).
- **Claude cost:** the Claude comparison route can now spend up to 64k output tokens, which covers thinking and text together. Astra can spend up to 32k.
- **Delegation:** scope strings are now `plan-v2`/`implement-v2`, so approvals prepared under 0.19.0 will not match and must be prepared again. `--setting-sources ""` disables user settings, which breaks `apiKeyHelper` authentication if you rely on it. Both flags are confirmed on CLI 2.1.283 only.
- **Shortcuts:** Ctrl+R and Ctrl+\ do nothing while a modal dialog is open.
- **Console windows:** release builds no longer show one.

## Desktop acceptance to run

1. Open a research entry that contains raw HTML, and check it shows as text. Click a source link and check it opens in the browser, with Olympus staying put.
2. Voice: start a session and speak one turn, to confirm the CSP allows it.
3. Write gate:
   - Trigger two gated writes together and approve both from the queue.
   - Let one expire, approve it, and check that "Nothing was written" appears.
4. Observations: append one observation to a note that contains accented characters.
5. Save a research entry with an accented title. Check it commits and that no "(2)" copy appears.
6. Gmail:
   - Run an incremental sync.
   - Disconnect.
   - Remove the cache and check the Situations view is empty.
7. Delegation: prepare, plan, cancel. Check the Claude process exits, and that no stray `claude.exe` remains after Olympus quits.
8. Check the 60-second project scan produces no console flashes.
