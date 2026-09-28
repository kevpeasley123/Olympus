# Findings — Olympus 0.19.0 (`e4669c9`)

All paths are relative to the repository root at `e4669c9`, and line numbers are for that commit.

**Confidence:**
- **CONFIRMED:** the code path was traced end to end. Items marked **(reproduced)** were also exercised in isolation in the container.
- **PLAUSIBLE:** the defective code is certain, but the trigger or impact is inferred.

**ID prefixes:**

| Prefix | Area |
| --- | --- |
| S | Security and trust boundary |
| G | Gmail |
| M | Medium defects across areas |
| L | Low |
| Q | Quality and testing |

---

## High

### S-1 Research notes can execute script in the app webview
**CONFIRMED (reproduced in isolation).**

- **Location:**
  - `src-tauri/tauri.conf.json:25` (`"csp": null`)
  - `src/components/panels/LibraryPanel.tsx:21,711-716` (`rehypePlugins={[rehypeRaw]}`, no sanitizer)
  - `LibraryPanel.tsx:5,964-965,1068-1085` (`matter(content)`)
  - `node_modules/gray-matter/lib/engines.js:36-43` (`return eval(str)`)
- **Evidence:**
  - Rust (`pantheon.rs:82-104`) strips the first frontmatter block and sends the rest to the webview as `body`. `prepareEntry` then calls gray-matter on that body.
  - Two independent routes run script:
    - **gray-matter:** a body that itself begins with `---js … ---` is `eval`ed. This happens when the list is prepared, so no click is needed, and it runs in Project and Research modes because LibraryPanel mounts there.
    - **rehype-raw:** in the probe, `react-markdown` + `rehype-raw` rendered `<iframe srcDoc="<script>parent.alert(2)</script>">` unchanged. A `srcdoc` frame is same-origin with its parent.
  - With CSP disabled, neither route is blocked. `<style>` and remote `<img>` beacons also pass.
- **Failure scenario:** a clipped article, a pasted transcript ("Insert into body"), a PDF extraction, or any file synced into `02 - Research` with the `olympus/research` tag carries the payload. Script then runs with access to `__TAURI_INTERNALS__.invoke` (see S-2).
- **Fix:**
  - Remove `rehype-raw`. Render `[[wikilinks]]` through a remark plugin or a `components` mapping. `preprocessWikilinks` currently builds an unescaped HTML string at `LibraryPanel.tsx:1550-1557`.
  - Remove `gray-matter` and return `sourceLabel` from Rust, which already parses the frontmatter. This also removes js-yaml and esprima from the 1.25 MB main chunk.
  - Set a CSP, for example: `default-src 'self'; script-src 'self'; frame-src 'none'; object-src 'none'; img-src 'self' data: asset:; connect-src 'self' ipc: http://ipc.localhost`. Add the realtime and WebRTC endpoints the voice path actually needs, and verify them in the desktop app.

### S-2 Any webview script reaches every command, including ones that act as the operator
**CONFIRMED.**

This is the blast radius of S-1, or of any future XSS.

- **Write gate:** `resolve_vault_write` (`write_confirm.rs:141-157`) can be called by script. Gate IDs are sequential (`write-N`, `:89`), and the `vault-write-pending` event can be listened to, so script can approve its own writes.
- **`save_attachment_to_vault`** (`attachments.rs:121-158`) takes any `source_path` and checks only that it `exists()` and `is_file()`. The extension allowlist applies to the *target* name. Script can copy `.env`, `olympus.sqlite` or `~/.ssh/*` into `02 - Research/_attachments/`, which is committed to vault git and synced to OneDrive. `extract_pdf_text` (`:99-107`) has the same shape.
- **`write_memory_artifact`** (`lib.rs:109-200`) takes `folder` and `file_name` from the webview. For a new file, `decide(RegenerateDerived, None, _)` returns `Proceed` with no dialog. `validate_components` (`vault_write.rs:288-322`) does not reject `.git` or `.obsidian`. So `folder=".git/hooks", file_name="pre-commit"` silently creates a hook that runs on the next vault commit. The only legitimate callers write two fixed dashboard artifacts (`src/services/obsidian.ts:198,227`).
- **Delegation:** `prepare_delegation_run` / `start_delegation_run` are webview calls. The approval is bound to the exact subject, but not to proof that a human was present. This was already identified in `docs/OPERATOR-APPROVAL-DESIGN.md`.
- **Fix:**
  - `pick_attachment_file` stores the chosen path in Rust state and returns a one-use token, which the copy and extract commands accept in place of a path.
  - `write_memory_artifact` takes an enum of the known artifacts, and Rust chooses the path.
  - `resolve_within` rejects `.git` and `.obsidian` components, case-insensitively.
  - `resolve_vault_write` returns whether the ID was still live (see M-22).

### S-3 Profile Observations append can replace the whole note while promising it removes nothing
**CONFIRMED (read).**

- **Location:** `src-tauri/src/commands/observations.rs:219-221` (`read_note` returns `fs::read_to_string(path).ok()`), `:236-241`, `:272-287`
- **Evidence:** any read error becomes `None`, and `compose(None, entry)` produces header plus entry. The post-approval recheck compares `read_note(..).map(fingerprint)` on both sides, so a note that is unreadable twice gives `None == None` and passes. `atomic_replace` then writes the new content over the note.
- **Failure scenario:** any of these causes the operator's accumulated observations to be replaced by a single line:
  - one invalid UTF-8 byte in the note, for example from pasted cp1252 text
  - a Windows sharing violation, which the code itself anticipates at `rename_over`
  - a OneDrive placeholder that fails to hydrate

  The confirmation dialog shows an additions-only diff throughout.
- **Fix:** treat only `ErrorKind::NotFound` as absent and fail closed on every other error. Recheck exact bytes, not a normalized fingerprint. `memory_promotion.rs:47-53,87-88` already does this correctly.

### S-4 Coding Delegate's "bounded" tools permit arbitrary code execution with API keys present
**CONFIRMED (mechanism); PLAUSIBLE (that an agent does it).**

The containment limits were partly acknowledged in `docs/AGENT-INVENTORY-AUDIT.md:134-160`. `docs/AGENT-DELEGATION.md` still claims a stronger boundary.

- **Location:** `src-tauri/src/commands/delegation.rs:32`, `:504-527`, `:580-584`; `delegation_review.rs:88-115,156-167`
- **Evidence:**
  - `IMPLEMENTATION_TOOLS` grants `Edit,Write` plus `Bash(npm run build:*)`, `Bash(npm test:*)`, `Bash(cargo test:*)`, `Bash(git diff:*)`, under `--permission-mode dontAsk`.
  - No `--tools`, `--setting-sources` or `--strict-mcp-config` is passed. `USERPROFILE` is forwarded, so user and project `.claude/settings*.json` (hooks, MCP servers, allow rules) are merged in.
  - `ANTHROPIC_API_KEY` is forwarded explicitly (`:517`).
  - The operator-triggered check runner does not call `env_clear`, so it inherits every dotenv variable, including `OPENAI_API_KEY`.
- **Failure scenario:** the agent, through model error or prompt injection from repository content, can gain arbitrary execution as the operator with network access and the whole filesystem. Any of these works:
  - edit the `build` script in `package.json`, then run `npm run build`
  - edit `build.rs`, then run `cargo test`
  - `cargo test --config "target.'cfg(all())'.runner='…'"`
  - `git diff --output=<path>` to write outside the worktree

  When the operator later presses "Frontend build" or "Rust tests", the same code runs again with the OpenAI key in its environment. The worktree is a directory, not a sandbox.
- **Fix:**
  - Pass an exact `--tools` list, `--setting-sources` limited to none or a pinned project, and `--strict-mcp-config` with an empty config.
  - Remove `Bash(git diff:*)`, since Olympus collects the diff itself.
  - Add `env_clear()` plus an allowlist to `command_for`.
  - Label check buttons "runs code written by the agent".
  - For real containment, use Windows Sandbox or an AppContainer.

### G-1 The Gmail cache grows without bound; Analyze and run history fail permanently past 2,000 rows
**CONFIRMED (read).**

- **Location:** `src-tauri/src/commands/gmail/intelligence.rs:113-124` (`signature`); `intelligence_v3.rs:25,435`; `store.rs:303,367-376`; `sync.rs:493-505`
- **Evidence:**
  - `signature()` selects every row for the account, with no `in_scope` or `available` filter, using `LIMIT 2001`, and returns `intelligence_cache_budget_exceeded` when there are more than 2,000.
  - Rows are only ever upserted. Messages that age out just get `in_scope=0`, and the only delete is the manual `remove_cache` (`store.rs:206-220`).
  - Incremental sync stores full snapshots for everything history touches, including drafts (a new ID per autosave), spam and archived mail.
- **Failure scenario:** with a 90-day horizon and ordinary volume, the table passes 2,000 rows within months. From then on, Analyze fails at the snapshot step, and `communication_runs` (the saved-brief history) errors on every load. It never recovers.
- **Fix:**
  - Compute the signature over `available=1 AND in_scope=1 AND internal_date>=cutoff`, the same filter `thread_signatures` uses.
  - Prune or tombstone out-of-scope rows older than the horizon at commit time.
  - Do not keep bodies for out-of-scope messages.

### G-2 One undecodable message permanently stops Gmail sync
**CONFIRMED (read).**

- **Location:** `src-tauri/src/commands/gmail/mime.rs:52-69` (`decode`); `sync.rs:564-567` (`normalize(..).map_err(ApiError::Other)?`); `store.rs:302` (scope is checked only after normalize)
- **Evidence:** each of these is a hard error that aborts the whole batch without advancing the cursor:
  - an unknown charset label (`unsupported_mime_charset`)
  - any invalid byte sequence (`malformed_mime_text`)
  - a part body over 2 MB
  - more than 100 parts, or nesting depth over 20
  - a missing `internalDate`

  Spam and drafts reach `normalize` because scope is decided afterwards.
- **Failure scenario:** a spam message declares `charset=unknown-8bit`. Every 5-minute run replays the same `startHistoryId`, fails on the same message, and syncs no new mail, indefinitely. `docs/GMAIL.md:68` says the batch fails but not that the failure is permanent.
- **Fix:**
  - Decode lossily, with a fallback charset.
  - Store a degraded snapshot (`body_status: "body_undecodable"`) instead of failing.
  - Check `labelIds` before decoding bodies, and skip bodies for out-of-scope messages.

---

## Medium

### M-1 A persistence load error overwrites real settings with seed defaults
**CONFIRMED path; PLAUSIBLE trigger.** Found independently by two reviewers.

- **Location:** `src-tauri/src/commands/persistence.rs:265-286`; `src/services/storage.ts:45-59`; `src/hooks/useDashboardData.ts:104-138`
- **Evidence:**
  - One `conversation_mail`, `conversation_research` or `conversation_voice` row that fails `serde_json::from_str` maps to `rusqlite::Error::InvalidQuery`, and `collect::<Result<Vec<_>>>` fails the whole load. The `request` field, by contrast, is tolerant (`.ok()`).
  - `loadState` catches the error and returns `readLocalState()`, which on desktop is `seedState`.
  - `setHydrated(true)` then triggers `persistPreferences(seed)`.
- **Failure scenario:** a future change to `Excerpt` or `ResearchExcerpt` without `#[serde(default)]`, or one corrupt row, silently resets `projectsRootPath`, the voice preferences and the tool flags, and hides history. The hydration gate exists to prevent exactly this.
- **Fix:** tolerate bad side-rows (log them and skip). On a desktop load failure, show an error and do not mark state hydrated for saving.

### M-2 An Anthropic stream error or truncation is recorded as a completed answer
**CONFIRMED.**

- **Location:** `src-tauri/src/commands/assistant.rs:500-541` (no `"error"` arm; `message_stop` is never required), `:703-745`, `:782`
- **Failure scenario:** a mid-stream `overloaded_error`, or a clean early close, returns the partial text as `Ok`. It is persisted with no truncation notice, and diagnostics record `completed`. The OpenAI adapter already handles this case (`responses.rs:356-363`).
- **Fix:** capture `error.type` into the record. If the stream ends without `message_stop` or `stop_reason`, return a truncated notice when there is text and `Err` when there is none. Pin this with a test.

### M-3 Anthropic SSE decoding corrupts multi-byte characters split across chunks
**CONFIRMED.**

- **Location:** `assistant.rs:650` (`String::from_utf8_lossy(&chunk)` per network chunk)
- **Failure scenario:** an em dash or curly quote that straddles a chunk boundary becomes `��` in the persisted reply. The OpenAI decoder buffers bytes and has a test for this (`responses.rs:265-290,535`).
- **Fix:** reuse the byte-buffered decoder and add a split-codepoint test.

### M-4 Untrusted email and repository text is placed in the highest-priority prompt channel
**PLAUSIBLE.**

- **Location:** `assistant.rs:320` (Gmail context), `:355-379` (vision, last commit, next step), `:393` (command board), `:772` (all blocks joined into Responses `instructions`)
- **Evidence:** the content is JSON-escaped and labelled untrusted data, which is good. It still sits at developer priority. There are no tools, so the impact is limited to steering answers, emitting allowlisted voice navigation, and content later offered for promotion.
- **Fix:** move evidence (Gmail, research excerpts, commits, the board) into a delimited user-role input item before the latest turn. Keep only the handling rules in `instructions`.

### M-5 `max_output_tokens: 8000` is shared by Sol and high-effort Astra
**PLAUSIBLE.**

- **Location:** `src-tauri/src/commands/responses.rs:253`. On the Anthropic route, `MAX_TOKENS = 8000` covers thinking and text together.
- **Failure scenario:** a Deep Analysis request uses the budget on reasoning and ends `incomplete`, showing either a truncated answer or "OpenAI response failed (max_output_tokens)". This lands on exactly the requests the operator chose to pay more for.
- **Fix:** put a per-route output budget in the `Route` catalog in `models.rs`.

### M-6 Vault commits fail for any filename with non-ASCII characters, after the file is written
**CONFIRMED (reproduced with git).**

- **Location:** `src-tauri/src/commands/vault_git.rs:106-117`
- **Evidence:** `git diff-tree --name-only` printed `"Caf\303\251 [1].md"` for `Café [1].md` in the container. That string does not equal `relative_text`, so the code returns "Refusing a vault commit…".
- **Failure scenario:** a research entry titled with é or an em dash is written, the command reports failure, and the operator retries. `ensure_unique_path` then writes a "(2)" copy, and neither copy is committed. Separately, `[` and `]` (allowed by `pantheon.rs:373`) are glob characters in the pathspecs at `:83,97,127`.
- **Fix:** run git as `git -c core.quotePath=false --literal-pathspecs …`, or use `-z` and split on NUL.

### M-7 `open_vault_note` splits the Obsidian URI at `&` in `cmd /C start`
**CONFIRMED (read; Windows only).**

- **Location:** `src-tauri/src/lib.rs:223-234`
- **Evidence:** `Command::new("cmd").args(["/C","start","",&uri])`. Rust quotes an argument only when it contains a space or tab, and the URL-encoded URI has neither. `cmd` therefore treats `&` as a command separator.
- **Failure scenario:** the vault opens without the note. cmd then tries to run `file=…` as a program, which executes if a `file.bat`, `file.cmd` or `file.exe` exists in the working directory or on PATH. The payload is limited to URL-safe characters.
- **Fix:** use the opener plugin, which is already used at `gmail/auth.rs:165`.

### M-8 `write_memory_artifact` and `pantheon_migrate` treat read errors as "absent" and skip the post-approval recheck
**CONFIRMED.**

- **Location:** `lib.rs:130` (`fs::read_to_string(..).ok()`), `:140-176` (a direct, non-atomic `fs::write` after approval); `pantheon_migrate.rs:216-221` (`_ =>` writes anyway)
- **Failure scenario:** a locked, cloud-only or non-UTF-8 existing file is overwritten without a dialog. Separately, an Obsidian edit made during the up-to-120 s dialog is lost, because the operator approved a diff of the older contents.
- **Fix:** follow the same pattern as S-3: separate `NotFound` from other errors, re-read after approval and compare bytes, and write via temp file plus rename.

### M-9 Coding Delegate completion is counted with the wrong phase string, so the catalog always reads UNPROVEN
**CONFIRMED (read).**

- **Location:** `src-tauri/src/commands/command_agents.rs:56` and `research_verification.rs:1226` count `phase='completed'`. The only writer, `delegation_review.rs:354`, sets `phase='complete'`, and the state machine uses `complete` throughout (`delegation.rs:329,346,1250`).
- **Failure scenario:** after the first real reviewed completion, the Command HUD still shows "UNPROVEN · Potentially dormant" and `completedRuns: 0`. These are exactly the acceptance signals `COMMAND-AGENT-CATALOG.md` promises. The tests cover only an empty database.
- **Fix:** use `'complete'` in both places, and add a test that inserts a `complete` row and asserts RECORDED.

### M-10 Crash recovery trusts a bare PID; Cancel can force-kill an unrelated process tree
**CONFIRMED.**

- **Location:** `delegation.rs:689-699` (`process_is_running` only checks that `tasklist` lists the PID), `:1307-1343`, `:1263-1264` (`taskkill /PID n /T /F`)
- **Failure scenario:** after a crash or reboot, Windows reuses the PID. The run shows a detached process as "still running", and Cancel kills whatever program now holds that PID, along with its children.
- **Fix:** store the process creation time (or image path) with the PID and require both to match. Preferably, assign the child to a Job Object.

### M-11 Automated checks cannot pass in a fresh delegation worktree
**CONFIRMED; the timeout part is PLAUSIBLE.**

- **Location:** `delegation_review.rs:88-115,185`; the worktree is created at `delegation.rs:1178-1188`
- **Evidence:** `git worktree add` copies no `node_modules`. `rust-tests` hardcodes `src-tauri/Cargo.toml`. Each worktree gets a cold `target/` and a 600 s kill.
- **Failure scenario:** checks fail or time out, and a failed latest check blocks completion (`:311-318`). Only the manual-evidence path remains, which undercuts the "evidence-based completion" claim.
- **Fix:** define checks per project, add an approved dependency-install step or a shared `CARGO_TARGET_DIR`, and report "not applicable" instead of failing.

### M-12 A crash during a check strands the run in `waiting`
**CONFIRMED.**

- **Location:** `delegation_review.rs:178` (`phase='testing'`); recovery at `delegation.rs:1308-1343` turns `testing` into `waiting`; `resume_subject` at `:1072` maps it to stage `implement`
- **Failure scenario:** after a restart, the only options are a new paid implementation launch over finished work, or Cancel. "Review result" appears only for `awaiting_review` (`DelegationPanel.tsx:270`).
- **Fix:** in recovery, map `testing` with a recorded outcome to `awaiting_review`, and record the interrupted check.

### M-13 The Claude process has no wall-clock limit and is not stopped when the app exits
**CONFIRMED (acknowledged in the audit).**

- **Location:** `delegation.rs:720-733` (a `try_wait` loop with no deadline); no `RunEvent::Exit` handling in `lib.rs`
- **Failure scenario:** a hung CLI blocks new runs for that project indefinitely. Quitting Olympus leaves `claude.exe` still editing. `--max-budget-usd` applies per launch, not per run.
- **Fix:** add a deadline in `monitor_child`, use a Job Object with kill-on-close, and keep a per-run spend ledger.

### M-14 An html2text panic leaves the Gmail account stuck in `syncing`
**PLAUSIBLE.**

- **Location:** `gmail/mime.rs:96` (`from_read`, which calls `.expect` inside html2text 0.12); `gmail/mod.rs:215-221`; `situations/engine.rs:172-174`
- **Failure scenario:** deeply nested blockquotes or tables push the width below html2text's minimum and it panics. The worker fails before writing its receipt, so the account shows "Synchronizing…" until restart, and the situation engine skips every cycle.
- **Fix:** use `config::plain().string_from_read` and map its `Err` to a degraded body. Also consider `catch_unwind`.

### M-15 Over 20 history pages (or over 2,000 changed IDs) fails incremental sync permanently
**CONFIRMED.**

- **Location:** `gmail/sync.rs:511-513,551`
- **Failure scenario:** after a few days offline on a busy mailbox, every retry replays a growing history. The error code has no UI mapping in `src/services/gmail.ts`.
- **Fix:** handle it like a 404: fall back to the existing bounded full reconciliation.

### M-16 Background situation analysis repeats a paid call every 5 minutes on failures that will always recur
**CONFIRMED.**

- **Location:** `gmail/situations/engine.rs:262-265,283,311`
- **Failure scenario:** with 24 active situations, a `new:` proposal fails the limit check *after* the discovery call. No observations are saved, so the next cycle repeats the call, about 288 failed calls a day. Repeatable contract or parse failures and `unknown_situation` behave the same way.
- **Fix:** check the limit before calling (or pass `allowNew=false`), persist the observations anyway, and back off after consecutive failures.

### M-17 One thread with more than 24 participants stalls situation discovery
**CONFIRMED.**

- **Location:** `situations/engine.rs:46-47,241`
- **Fix:** mark such threads as observed and skipped, or cap the participant list rather than failing the batch.

### M-18 Label and `historyId` changes trigger paid re-analysis
**CONFIRMED logic; PLAUSIBLE cost.**

- **Location:** `gmail/mime.rs:157,169-174,195-196`; `situations.rs:70-99`; `intelligence_v3.rs:18-28`
- **Failure scenario:** reading a message in Gmail removes `UNREAD`. That changes its fingerprint, so background discovery and briefing re-run, and any in-flight Analyze fails with `intelligence_cache_changed`.
- **Fix:** fingerprint content only, and track the scope labels separately.

### M-19 "Remove cached mailbox" leaves email-derived content behind, with no way to delete it
**CONFIRMED.**

- **Location:** `gmail/store.rs:206-220`; `schema.sql:229-279`
- **Evidence:** situation sources (verbatim quotes of up to 500 characters and addresses), local reply drafts, briefings, `communication_runs` and `communication_events` all survive removal. No code path deletes them. `docs/GMAIL.md:106` does not mention this.
- **Fix:** add an account-scoped purge, or a separate confirmed action, and document it.

### M-20 A large initial Gmail sync exceeds the 600 s budget and discards its work each time
**PLAUSIBLE.**

- **Location:** `gmail/auth.rs:332-336`; `gmail/sync.rs:560-562`
- **Evidence:** fetches are serial `format=full` requests paced at 250 ms or more. At roughly 1,700–2,000 messages the run exceeds 600 s, nothing is committed, and it retries every 5 minutes. The error `gmail_sync_budget_reduce_horizon` is not mapped in the UI.
- **Fix:** use batch or bounded-concurrency fetches, or commit in stages with a resumable page token.

### M-21 Links in research notes navigate the whole app window away
**CONFIRMED code; PLAUSIBLE runtime.**

- **Location:** `LibraryPanel.tsx:711-716` has no `components.a` (compare `ChatPanel.tsx:20-22`). There is no `on_navigation` guard in `lib.rs`.
- **Failure scenario:** clicking a source link replaces Olympus with the external site. There is no back control, and pending UI state, including an open write-gate dialog, is lost.
- **Fix:** add an `a` override that routes to a Rust command, which validates `https:` and calls `opener().open_url`. Also add `on_navigation` to deny off-origin top-level navigation.

### M-22 The write-gate dialog shows one pending request and reports expired approvals as successful
**CONFIRMED.** Found independently by two reviewers.

- **Location:** `src/components/panels/WriteConfirmDialog.tsx:53,70-72,97-107`; `write_confirm.rs:88-128,141-157`
- **Failure scenario:**
  - A second pending write replaces the first on screen, and the first is silently denied at 120 s.
  - Approve pressed after 120 s emits the "vault-write" pulse even though Rust denied the write. `resolve_vault_write` returns `Ok` for unknown IDs, so the UI implies a write that never landed.
- **Fix:** queue pending writes by ID, and have `resolve_vault_write` return `{accepted}` (or emit `vault-write-expired`). Pulse only on accept.

### M-23 Rendering cost: a 3 s poll re-renders the App tree, and the 3D scene remounts on resize and on project data changes
**CONFIRMED.**

- **Location:**
  - `hooks/useDelegationRuns.ts:5-8`, `hooks/createPollingStore.ts:41-58` (notifies on every poll, even when nothing changed)
  - `HybridCommandCore.tsx:13-14,49` (`JSON.stringify(props.layout)` as the scene key; the layout embeds whole `TrackedProject` objects and a continuously varying `labelScale`)
  - `CommandInstrument.tsx:111,154-167`
- **Failure scenario:**
  - Every 3 s the whole tree re-renders, including two unmemoized `buildProjectCommandBoard` calls.
  - Resizing the window, or any `repoState` or commit change on the 60 s scan, rebuilds the WebGL context, PMREM, shaders and bloom. This causes jank and risks "context lost".
- **Fix:**
  - Skip `notify` when the result is unchanged.
  - Build the scene key only from the geometry the scene reads, with `labelScale` quantized, and memoize it.
  - Update label textures in place instead of remounting.

### M-24 Hidden Command instrument keeps working in other modes
**CONFIRMED.** Low–Medium.

- **Location:** `App.tsx:162-178`; `hooks/useAmbientMotion.ts:19-44` (ignores `active`); `hybridScene.ts:282,379-390` (a 250 ms fallback loop that still does node math and SVG writes)
- **Fix:** pass `active` through to the motion hook, and stop the loop while the instrument is hidden.

### M-25 Synchronous delegation and Gmail status commands run on the UI thread
**CONFIRMED.** Low–Medium.

- **Location:**
  - `delegation.rs:1086-1394`: `prepare_*`, `start_*`, `resume_*`, `cancel_*`, `list_delegation_runs` (polled every 3 s, and runs `tasklist`), `fetch_delegation_diff`
  - `delegation_review.rs:322-360`
  - `gmail_status` (polled every 2 s) and `gmail_workspace` (every 10 s)
- **Failure scenario:** `git worktree add` on a large repo freezes the window while it runs.
- **Fix:** make them `async` and move the work into `spawn_blocking`, as `run_delegation_check` and `scan_tracked_projects` already do.

---

## Low

| ID | Finding | Location | Fix |
| --- | --- | --- | --- |
| L-1 | Cancel landing as the process exits still finishes the run as `awaiting_review` | `delegation.rs:720-733` | Re-check the cancel channel after the loop |
| L-2 | Research Verification fails the whole run on the 257th `.md` file or on one malformed note | `research_verification.rs:316,324,332-333` | Filter by tag before counting; skip and warn on bad files |
| L-3 | `write_pantheon_entry` writes tags and source type as unquoted YAML, so a newline injects keys | `pantheon.rs:431-433,524-527`; `escape_yaml_string` at `:417` | Quote values and reject control characters |
| L-4 | CreateUnique writers check a name is free, then write with a call that overwrites | `pantheon.rs:389-414,595`; `attachments.rs:55-83,157` | `OpenOptions::create_new` in a loop |
| L-5 | Research, verification and knowledge-audit rows can stay `running` after a task panic and block new runs until restart | `research_verification.rs:1117-1126,1185-1190`; `knowledge_audit.rs:217-226,653-658` | Treat a `running` row past its deadline as stale |
| L-6 | Containment gaps: a dangling file symlink passes `exists()`; no re-resolve after the 120 s dialog; trailing dot or space and `CONIN$`/`CONOUT$` are accepted; the `\\?\` prefix leaks into displayed paths | `vault_write.rs:255-286,324-333`; `lib.rs:121,176` | `symlink_metadata`; re-resolve after approval; reject these names; strip the prefix for display |
| L-7 | `write_memory_artifact` returns `Err` on a commit failure before `log_vault_write`, which its own comment says every writer must call | `lib.rs:188-194` | Log first |
| L-8 | The observations temp file name is fixed and has no writer mutex | `observations.rs` | `create_new` temp file plus a mutex, as in `memory_promotion` |
| L-9 | No `PRAGMA foreign_keys=ON`, so `REFERENCES` in the approval tables is not enforced (the immutability triggers are the real protection) | `schema.sql:157,161` | Enable it per connection |
| L-10 | Request timeouts bound the whole streamed body (120 s Anthropic, 240 s OpenAI) | `assistant.rs:20,612-615`; `responses.rs:473` | Use `connect_timeout` plus a per-chunk idle timeout |
| L-11 | Conversation side tables upsert `ON CONFLICT DO UPDATE` with webview-supplied provenance, so "append-only" is really upsert | `persistence.rs:348-366` | `DO NOTHING`, or bind provenance from Rust by request ID |
| L-12 | A message sent before hydration finishes vanishes from the UI, and the model receives seed history | `useDashboardData.ts:122,188-191`; `ChatPanel.tsx:89-93` | Disable send until `settingsReady` |
| L-13 | A refused voice turn is reported as "could not complete" and ends the mic session | `assistant.rs:776`; `realtimeVoice.ts:251` | Return a minimal voice payload that carries the notice |
| L-14 | The Pantheon index in context and the 40-message history have no character budget | `vault_context.rs:172-229`; `assistant.rs:414` | Cap both |
| L-15 | Analyze during a background situation run shows a raw `UNIQUE constraint failed` | `schema.sql:233`; `intelligence_v3.rs:427` | Map the conflict to an error code |
| L-16 | Disconnect does not revoke the Google token (this is documented) | `gmail/auth.rs` | Call `oauth2.googleapis.com/revoke` before deleting the keyring entry |
| L-17 | Project scans are not coalesced, so a slow scan of an old root can land last | `useDashboardData.ts:140-171,344-347` | Track a request sequence and drop stale results |
| L-18 | `refresh()` after a write can join a fetch that started before the write, so the new entry is missing for up to 5 min | `createPollingStore.ts:43` | Add `refresh({force:true})` that marks dirty and refetches |
| L-19 | Accessibility: no focus trap or focus restore in the write gate; its Escape also reaches the Library's global handler; Ctrl+\ changes mode under an open dialog; Library dialogs lack `aria-modal`; an unsaved Add Entry form is discarded on backdrop click; inert `role="button"` rows in ToolBelt; tablist without arrow keys | `WriteConfirmDialog.tsx:110-141`; `LibraryPanel.tsx:164-197,1239`; `AmbientDock.tsx:44-67`; `ToolBelt.tsx:37-49`; `ModeSwitcher.tsx:16-29` | One shared modal primitive; global shortcuts yield while an `aria-modal` dialog is open |
| L-20 | A voice-set project filter is re-applied when ProjectsPanel remounts | `ProjectsPanel.tsx:57-58`; `App.tsx:70,189` | Consume the filter by revision |
| L-21 | `localStorage` access is unguarded; in the browser runtime the whole unbounded conversation is serialized | `useDashboardMode.ts:47-54`; `LibraryPanel.tsx:1021,1032`; `storage.ts:229` | Wrap in try/catch |
| L-22 | Release build has no `windows_subsystem = "windows"`, so a console window appears and child processes inherit stdin | `src-tauri/src/main.rs` | Add the attribute; use `Stdio::null()` for children |
| L-23 | The `delegation-run-updated` event is emitted but nothing listens for it | `delegation.rs` | Listen and slow the poll, or remove the emit |
| L-24 | Dead code: `AmbientOrbits.tsx` and `ProjectBriefing.tsx` have no importers; `services/tauri.ts` has an unused `writeMemoryArtifact`; `obsidian.ts:18-20` duplicates `isTauriRuntime`; three Rust warnings | — | Remove. (`DelegationPanel.tsx` is **not** dead: `ProjectsPanel.tsx` imports it.) |
| L-25 | Six declared tables are never read or written (`projects`, `tasks`, `research_items`, `skill_recipes`, `dashboard_modules`, `operator_briefs`), and two research-verification tables are created outside `schema.sql` | `schema.sql:82-130`; `research_verification.rs:137` | Mark as reserved or drop; move the verification tables into the schema |
| L-26 | `LibraryPanel.tsx` (1,561 lines) and `projectRing.ts` (1,092) mix several concerns | — | Split out the Add Entry modal, the entry renderer and the ring and graph layouts |

## Quality and testing

### Q-1 `cargo test --lib` passes only on the owner's machine
**CONFIRMED (run).** Ten non-ignored tests fail anywhere else:

- 9 assert that the real vault exists at the hardcoded Windows path:
  - `knowledge_audit::real_vault_readonly_audit_…`
  - `pantheon::debug_parse_real_vault`
  - `profile::debug_load_real_profile`
  - `project_notes::debug_join_…`
  - `projects::debug_scan_…`
  - `projects::the_vault_directory_is_excluded_from_the_scan`
  - `research_retrieval::debug_…`
  - `tasks::debug_parse_real_vault`
  - `vault_context::debug_load_real_vault_memory`
- 1 (`vault_write::rejects_absolute_and_unc_paths`) relies on Windows path semantics.

The claim "`cargo test --lib` passes on this branch" in `CLAUDE.md` holds only on the owner's machine, and continuous integration is impossible as it stands.

- **Fix:** mark the real-vault tests `#[ignore]` (or gate them on `OLYMPUS_REAL_VAULT_TESTS=1`), and make the path test `#[cfg(windows)]`.

### Q-2 Regression tests are missing for the confirmed defects
- M-9: a `complete` row should report RECORDED.
- S-3 and M-8: a read error on an existing note must abort the write.
- G-1: more than 2,000 rows with most out of scope.
- G-2: an incremental batch containing an undecodable message.
- M-3: a split UTF-8 codepoint.
- M-2: an `error` event mid-stream.
- M-6: a non-ASCII vault commit.

---

## Verified strengths

- **Delegation approvals:** issued by the backend, single-use (removed before validation), bound to the session, time-limited, and matched against the exact subject (project, repo, base, driver version, task bytes, criteria, scope, workspace fingerprint, plan). Rows are immutable through triggers, and replay, expiry and session mismatch are tested (`approvals.rs:188-258`).
- **Vault containment:** `resolve_within` checks component-wise against the canonical nearest ancestor, rejects `..`, drive and UNC prefixes, `:` and device names, and has a junction test.
- **`memory_promotion`:** fails closed on read errors, checks exact bytes, uses a writer mutex and a `create_new` temp file, and re-resolves after approval. It is the pattern the other writers should follow.
- **Gmail:**
  - OAuth uses S256 PKCE and separate random state. The listener binds 127.0.0.1:0 only and has a deadline. Redirects are disabled, the scope must be exactly `gmail.readonly`, and the refresh token lives only in the keyring.
  - A route allowlist makes mailbox writes unreachable.
  - One transaction covers the cache, FTS, candidates and cursor.
  - Retries are bounded and honour Retry-After.
- **Model routing:**
  - OpenAI Responses uses `store:false`, explicit effort, and strict JSON schema for voice. Its SSE decoder is byte-safe and handles failed, incomplete and error events as terminal.
  - The Anthropic route meets every constraint in `CLAUDE.md` (no sampling parameters, `output_config.effort`, `text_delta` only, refusals checked via `stop_reason`, first message is a user turn).
  - Model IDs are centralized in `models.rs`.
- **Secrets:** no API key reaches the webview. Voice returns only a 60 s client secret, and delegated children get an allowlisted environment (except the check runner, S-4).
- **SQL and injection:** no SQL injection found. FTS terms are tokenized and quoted.
- **Rendering:** no `dangerouslySetInnerHTML`. Chat markdown uses `skipHtml` and safe link and image overrides. The Library panel is the exception (S-1).
- **Frontend:**
  - strict TypeScript with no `any` in production source
  - thorough three.js disposal
  - reduced-motion support at several layers
  - `listen()` cleanup that handles a promise resolving after unmount
  - streaming text batched outside React
  - harnesses and fixtures excluded from the bundle
- **Research/Verification agents:** genuinely read-only. They use no tools, sources are canonicalized under `02 - Research`, fingerprints are rechecked around each dispatch, quotes are verified, and recovery is deterministic.
