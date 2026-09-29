# Desktop acceptance — design-review implementation

Revised 2026-09-29. Applies to branch `claude/blissful-lamport-2l4o96`. Section 2 is implemented, and sections 3 and 4 need this branch at the commit that adds `scripts/acceptance/`, or later. Nothing here has been run in the desktop app yet.

Evidence so far is build, unit tests and Chromium against a synthetic IPC mock. None of that counts as desktop acceptance.

**Ground rules for every step:**
- Leave the installed application, production data and your credentials untouched.
- Do not edit, rename or blank `.env` or saved credentials.
- Do not rely on choosing Keep at write dialogs for isolation.

## 1. Why an ordinary dev launch is not isolated

These facts come from reading the code at `1ec2998`:

| What | Where | Consequence for a normal `npm run tauri dev` |
| --- | --- | --- |
| Database | `open_database` (`src-tauri/src/lib.rs`): `app_data_dir()/olympus.sqlite`, where `app_data_dir` derives from the identifier `com.projectolympus.commandstation` | It opens **your production database** and writes to it automatically at startup, with no dialog: schema application, `INSERT INTO operator_sessions`, marking interrupted `model_requests`, recovery routines, preferences, conversation, session boundary. |
| Webview storage | WebView2 profile keyed by the same identifier | It uses the **production webview profile**: localStorage (mode, library section state) is read and written. |
| API keys | `load_olympus_env` reads the repo's `.env` via `dotenvy` (won't override variables already set) | Keys load automatically. PowerShell deletes a variable set to `""`, so blanking a key in the shell does not work reliably. Any chat, voice or verification request would be a **paid call**. |
| Gmail | `gmail::start_cadence` (5 s after start) syncs whenever the stored account is enabled; the refresh token is in Windows Credential Manager (`Olympus.Gmail.ReadOnly`) | It **syncs your real mailbox**, writes the cache and touches the keyring. |
| Background understanding | `gmail::situations::start_cadence` (20 s after start) | It runs **paid model calls** for changed threads whenever an account is enabled. |
| Vault | `VAULT_PATH` is a hardcoded constant (`src-tauri/src/commands/mod.rs`) | It reads and writes the **real vault**. Some writes need no confirmation: research entries are created uniquely (CreateUnique, no dialog), the attachment copy, and vault git commits. |
| Projects root | Seed default `C:\Users\kevpe\OneDrive\Desktop\Projects` (`src/data/seed.ts`), stored in the DB `settings` table; Preferences cannot edit it | It scans your **real repositories**. `git status` can refresh `.git/index`, so the scan is not strictly read-only. |
| Delegation | Worktrees and cargo targets under `app_data_dir` | A misclick could start a paid, code-running run. |

**Conclusion (at `1ec2998`):** the app could not be isolated. The database and webview profile can be separated with configuration. The vault, projects root, API keys, Gmail and background understanding could not, which is what section 2b now closes. An ordinary dev launch, without `OLYMPUS_ACCEPTANCE_DIR` and the acceptance config, still behaves as this table describes.

## 2. Isolated configuration (implemented 2026-09-29)

Approved as proposed and implemented on this branch. Evidence is compilation, `cargo test --lib`, `npm run build`, the `scripts/test-*.mjs` harnesses, and the two scripts run against a scratch directory and a scratch database built from `schema.sql` (section 2c). **None of it has run in the desktop app.**

### 2a. Configuration: a separate identifier

`scripts/acceptance/tauri.acceptance.json`:

```json
{ "identifier": "com.projectolympus.acceptance", "productName": "Olympus Acceptance" }
```

This gives a separate `app_data_dir` (database, delegation worktrees and targets, situation imports) and a separate WebView2 profile. The installed app and its data are never opened.

`scripts/acceptance/tauri.acceptance-nowebgl.json` adds the whole `app.windows` array from `src-tauri/tauri.conf.json`, with `--disable-webgl` appended to `additionalBrowserArgs`. Tauri merges `--config` files as a JSON merge patch, which replaces arrays, so the window object is restated in full.

Checked with the installed `@tauri-apps/cli` 2.10.1:
- A relative `--config` path resolves against the **working directory**, not `src-tauri`. A file present only at the repository root was read, and a missing path was rejected at argument parsing. `npm run tauri` runs from the repository root, so the commands in section 3 work as written. From anywhere else, pass an absolute path.
- Both files pass the CLI's config validation: `tauri dev --config <file>` got past validation to `BeforeDevCommand`. A deliberately invalid value was rejected at the same point.

### 2b. Code: `OLYMPUS_ACCEPTANCE_DIR`, debug builds only

`src-tauri/src/commands/acceptance.rs`. The release build compiles `acceptance_dir()` as `None`, so the installed app cannot read the variable at all. A blank value counts as unset. A relative path is anchored to the working directory once at startup, and the value is read once. When it is set:

| # | Behaviour | Place |
| --- | --- | --- |
| 1 | `load_olympus_env()` is skipped, and `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are removed from this process only, before the builder starts. Every provider path then fails with its existing "needs …_API_KEY" error. `.env` is never opened or modified. | `lib.rs` `prepare_environment()` |
| 2 | `get_vault_path()` returns `<dir>/vault`. Every vault reader and writer resolves through it. | `commands/mod.rs` |
| 3 | `scan_tracked_projects` scans `<dir>/projects`, whatever root the webview sends. The vault exclusion still applies. | `commands/projects.rs` |
| 4 | Neither `gmail::start_cadence` nor `situations::start_cadence` starts. `gmail::auth::entry()` refuses before the platform check, so the keyring is never opened. `gmail_connect`, `gmail_sync` (and the sync worker) and `gmail_disconnect` refuse with `gmail_acceptance_profile_disabled`, which reads "Disabled in the acceptance profile. Gmail is not contacted and no credential is read." Cached reads keep working on the acceptance database: `gmail_status`, `gmail_workspace`, `gmail_thread`, `gmail_search`, `gmail_cache_counts` and `situation_snapshot`. Model-backed Gmail paths (analysis, situation refresh and drafts) fail because no key is present. | `lib.rs`, `gmail/auth.rs`, `gmail/mod.rs` |
| 5 | `prepare_delegation_run`, `prepare_delegation_resume`, `start_delegation_run` and `resume_delegation_run` refuse first, and so does `spawn_claude`, the one place a process is started. Reading runs, plans and reviews, `fetch_delegation_diff`, `run_delegation_check`, `cancel_delegation_run` and `complete_delegation_review` stay available; checks run in the synthetic worktree. | `commands/delegation.rs` |
| 6 | Startup logs `[Olympus::Acceptance] profile <dir>`. The read-only `acceptance_profile` command returns `{active, dir}` or `null`. The header shows "Acceptance profile — synthetic data; providers and Gmail disabled" in every mode, and Preferences › Gmail says it is disabled. | `lib.rs`, `acceptance.rs`, `HeaderBar.tsx`, `GmailSettings.tsx` |

**Tests:** in `acceptance.rs`, the variable's parsing, the startup plan (no `.env`, both keys removed), path redirection and the refusals. The profile is injected per test thread, and the suite never reads the real variable. Also: `projects.rs` (scan root and vault exclusion under the profile), `gmail/tests.rs` (every keyring call refuses), `delegation.rs` (each launch command and `spawn_claude` refuses first). Without the variable, behaviour is unchanged and every existing test passes.

**Deviation:** Gmail refusals return the code `gmail_acceptance_profile_disabled` instead of the literal text. The webview maps every Gmail error code to a sentence, and that sentence starts "Disabled in the acceptance profile".

### 2c. Fixture scripts

- **`node scripts/acceptance/build-fixtures.mjs <dir>`** refuses a directory that exists and is not empty. It writes:
  - `<dir>/vault`: the ten folders. `01 - Projects` holds five project notes (active, watching, archived; one with no next step; one whose vision review is 200 days old). `02 - Research` holds three notes in the Add Entry format, as Paper, Guide and Article, with headings, a wikilink to another entry, an unresolved wikilink, `![[_attachments/sample.pdf]]` and a valid one-page PDF. There is also a task note, `04 - Decisions/Decision Log.md`, and in `09 - System` the `User Profile.md` and `Olympus Charter.md`. The vault is a git repository, so gated writes can commit.
  - `<dir>/projects`: `acceptance-clean`, `acceptance-dirty` (a modified and an untracked file), `acceptance-history` (six commits over four days, two within 24 hours), `acceptance-worktree` (a linked worktree in `<dir>/worktrees` with uncommitted files) and `acceptance-plain` (not git). `Project Acceptance Archive` has a note and no folder.
  - Git identity is set per repository. No global configuration is touched.
- **`node scripts/acceptance/seed-db.mjs <dir> [--db <path>]`** runs after the first launch, with the app closed. It uses Node's `node:sqlite`: Node 22.13 or later runs it directly; 22.5–22.12 get `--experimental-sqlite`, which the script adds by re-running itself. The default database is `%APPDATA%\com.projectolympus.acceptance\olympus.sqlite`. It refuses:
  - any path containing `commandstation`;
  - a default path outside the acceptance identifier;
  - a missing database, or one without the current tables;
  - a second run (it records an `acceptance-seed` row in `processing_logs`);
  - an existing enabled Gmail account.

  It inserts:
  - an enabled synthetic Gmail account;
  - the situation "Office move (synthetic)" with document context from two invented files in `<dir>/situation-docs`. The pack is validated with a port of `import-situation-context.py`'s `validate()` and inserted directly, so no Python is needed. Against a scratch database, the rows are identical to what that script writes for the same pack.
  - a delegation run `awaiting_review` in a git worktree of `acceptance-history` under `<dir>/delegations`. Its `package.json` build only prints `acceptance build ok`, it has no test script, and it has an empty `node_modules` so the build check is available.
  - eight messages over four days. One reply has research provenance for `Evidence Before Authority.md`, fingerprinted as `pantheon.rs` does.
  - one message marked as imported from localStorage (original time 14:10).
  - a commit in `acceptance-history` made at seed time, i.e. after the first launch.

Verified here: both scripts ran; the Rust scan, research parser (including the PDF), conversation load, review read, real build check and situation snapshot read their output through `#[ignore]`d tests; the seeded database passes `PRAGMA foreign_key_check` and `integrity_check`. To repeat:

```bash
OLYMPUS_TEST_ACCEPTANCE_FIXTURE=<dir> OLYMPUS_TEST_ACCEPTANCE_DB=<db> cargo test --lib acceptance -- --include-ignored
```

## 3. Launch, verification, cleanup and rollback

PowerShell, from the repository root. The `--config` paths are relative to the working directory (section 2a).

```powershell
# Launch
git fetch origin; git switch claude/blissful-lamport-2l4o96; git pull
npm ci
$Acc = Join-Path $env:TEMP "olympus-acceptance-$(Get-Date -Format yyyyMMdd-HHmmss)"
node scripts/acceptance/build-fixtures.mjs $Acc
$env:OLYMPUS_ACCEPTANCE_DIR = $Acc          # this PowerShell session only
npm run tauri -- dev --config scripts/acceptance/tauri.acceptance.json
# First launch creates the acceptance database. Close the app, then:
node scripts/acceptance/seed-db.mjs $Acc
npm run tauri -- dev --config scripts/acceptance/tauri.acceptance.json
```

**Verify the isolation before testing anything:**
1. The terminal shows `[Olympus::Acceptance] profile …\olympus-acceptance-…`, `[Olympus::Db] opened …\com.projectolympus.acceptance\olympus.sqlite`, and **no** `[Olympus::Env] loaded .env` line (nor the "no .env file found" line).
2. The header shows "Acceptance profile — synthetic data; providers and Gmail disabled".
3. The project names are the synthetic ones (`acceptance-…` and `Project Acceptance Archive`).
4. Preferences › Gmail says "Disabled in the acceptance profile". After seeding, it lists the synthetic `acceptance.operator@example.invalid` account.

If any of these fails, close the app and stop.

**Cleanup:**
```powershell
Remove-Item Env:OLYMPUS_ACCEPTANCE_DIR
Remove-Item -Recurse -Force $Acc
Remove-Item -Recurse -Force "$env:APPDATA\com.projectolympus.acceptance"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\com.projectolympus.acceptance"
```
The last path is the WebView2 profile; confirm the exact folder name on first run.

**Rollback:**
- Production data and the installed app are never opened, so there is nothing to restore.
- To abandon the branch, run `git switch -` (or `git switch master`) and then `npm ci`.
- To remove the acceptance switch after acceptance, revert its commit. It is inert in release builds either way.

## 4. First native pass

This pass is safe: synthetic profile, no providers, no Gmail, no delegation launches.

| # | Area | Steps | Expected |
| --- | --- | --- | --- |
| N1 | Loading | Launch and watch the first seconds, with a screen recording if possible | Ring reads SCANNING… and the board shows a skeleton. No example or seed project appears at any moment. |
| N2 | Ready | After the scan | Synthetic projects on ring and board. The freshness line reads "Projects scanned … ago". The briefing, header and board agree. |
| N3 | Empty | Close. Move everything out of `$Acc\projects` and empty `$Acc\vault\01 - Projects`. Relaunch. | Ring reads NO PROJECTS. The board says no projects were found and names the path. The briefing says "No projects are tracked yet." |
| N4 | Failed | Close. Rename `$Acc\projects` to `projects-off`. Relaunch. | Either SCAN FAILED with Retry and no rows, or NO PROJECTS naming the path. Which one happens is unconfirmed; record it. Surfaces agree. |
| N5 | Stale | With a good scan showing, rename `$Acc\projects` while the app runs, then press Ctrl+R | Genuine rows stay. The banner reads "Last successful scan … Latest refresh failed …" with Retry. Ring shows STALE · HH:MM. Rename back, Retry, and it returns to ready. |
| N6 | Skip to console | In each mode, press Tab once from a fresh focus | "Skip to console" is visible, 13px with the focus ring. Enter focuses the console input. |
| N7 | Preferences | Open Preferences, Tab around, press Escape | Focus stays inside. Escape closes and returns focus to the gear. Ctrl+\ does nothing while it is open. |
| N8 | Ctrl+R | Press it in each mode, including while typing in the console | The window never reloads, the draft remains, and data refreshes (freshness line updates). |
| N9 | Review notes survive a check | Project mode › seeded run › Review result. Type notes on both criteria and tick reviewed. Run "Frontend build · runs agent code" (the synthetic echo script). | Notes remain after the check and after a poll. Ticked state and evidence selections clear only if the workspace hash changed, with a notice. |
| N10 | Drafts survive mode switches | Leave work open: a run draft on a synthetic project, a library search with an entry open, an Add Entry draft, a Communications reply draft. Cycle Command → Project → Research → Communications → back. | Everything is restored. Closing a changed draft asks Keep editing / Discard (or Save for reply drafts). |
| N11 | Research navigation | Library, Questions and Audits segments. Open an entry deep in the list, then Back. `/` from outside a field. | List position and row focus are restored. `/` focuses search and does nothing while typing. |
| N12 | Evidence disclosures | Seeded chat reply › "Research supplied to this reply" › Open in library. Edit that note's body in `$Acc\vault`, then repeat. | First: Unchanged, with the excerpt highlighted. After the edit: Changed since this reply. Wikilinks open library entries. The attachment row opens only `_attachments` files. |
| N13 | Communications, console open | Resize the window to exactly 1280×800 and then 1440×900. Check `innerWidth` in devtools, or use a window-sizing tool. Open the seeded situation. Engage the console. | The next-step strip is visible on arrival. With the console engaged, **record** how much the map and inspector shrink (known unresolved U8 limitation, about 370px at 1440). No map text is under 12px. |
| N14 | GPU rendering | Normal launch, Command mode | The 2D ring appears first, then the 3D instrument. There is no stutter when switching modes. Leaving Command pauses the scene. |
| N15 | 2D fallback | Relaunch with `--config scripts/acceptance/tauri.acceptance-nowebgl.json` | The 2D instrument stays, and the ring, labels and project clicks work. A styled "Retry 3D view" appears. |
| N16 | Windows text | At 1280×800 and at your normal size, at 100% and at your usual display scaling | Console status, board owner chips and filters, and library text are readable. The console control row stays on one line. |
| N17 | Timestamps | Transcript over the seeded days | Day separators read Today, Yesterday and dates. The seeded imported row reads "Imported {when} · original time 14:10". It neither opens a day nor splits one (fix of 2026-09-29, unit- and harness-tested only). Record what appears. |

Record results per row as pass, fail or observed, with a screenshot for each fail.

## 5. Later passes: not automatic, each needs a separate decision

| Group | Needs | Checks |
| --- | --- | --- |
| **P — Paid provider** | Normal launch, or the acceptance profile without switch 1; restored provider credit | U6: typed reply with Voice on, Sol and Claude routes — time to first visible text versus spoken summary. Voice 429 behaviour. Opening-briefing audio under WebView2 autoplay. "Ask Olympus about this thread" answer grounded in the thread. |
| **G — Real Gmail account** | Production profile | Sync, error states (auth, sync, understanding, backoff with real retry times), removal counts, disconnect and revoke. Uses your mailbox and possibly paid understanding calls. |
| **X — Destructive or data-changing** | Production profile, with a database backup first | Cache removal (irreversible), history narrowing (prunes), research entry and attachment commit into the real vault, profile observation append. |
| **E — Delegation** | Production profile, API credit, throwaway project | Prepare/approve a planning run, real `permitted` and `baseBranch` text, Stop run ending `claude.exe`, the Job Object killing children on exit. Runs code and costs money. |

## 6. Known environment-only failure

`hybrid-core-harness` "Voice signature follows changing speech energy" fails in the cloud container on `e4669c9`, `d47f95f` and `056e91f` alike (13 of 13 runs). SwiftShader renders about one frame every three seconds there, so the check is not evidence either way. It needs a GPU browser run:

```bash
npm run dev
```

Then open `http://127.0.0.1:31420/hybrid-core-harness.html?run` on your machine. This touches no application data.
