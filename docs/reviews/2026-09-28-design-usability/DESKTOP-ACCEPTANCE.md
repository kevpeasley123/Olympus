# Desktop acceptance — design-review implementation

Revised 2026-09-29. Applies to branch `claude/blissful-lamport-2l4o96` at `1ec2998` or later. Nothing here has been run in the desktop app yet.

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

**Conclusion:** the app cannot be isolated as it stands. The database and webview profile can be separated with configuration. The vault, projects root, API keys, Gmail and background understanding cannot.

## 2. Proposed isolated configuration

This is a proposal only. Nothing below has been implemented.

### 2a. No code change: a separate identifier

Tauri CLI 2 merges `--config <file>` into `tauri.conf.json` as a JSON merge patch. The file `scripts/acceptance/tauri.acceptance.json` (to be added) would contain:

```json
{ "identifier": "com.projectolympus.acceptance", "productName": "Olympus Acceptance" }
```

This gives a separate `app_data_dir` (database, delegation worktrees and targets, situation imports) and a separate WebView2 profile. The installed app and its data are never opened.

A second file, `tauri.acceptance-nowebgl.json`, would also restate the window with `"additionalBrowserArgs": "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required --disable-webgl"`. It forces the 2D fallback. Merge patch replaces the `windows` array, so the whole window object is restated.

### 2b. Smallest required code change

**One environment variable, `OLYMPUS_ACCEPTANCE_DIR`, honoured only in debug builds** (`cfg(debug_assertions)`). The installed release build ignores it. When it is set:

| # | Change | Place |
| --- | --- | --- |
| 1 | Skip `load_olympus_env()`, and `remove_var` `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for this process only. Every provider path then fails with its existing "needs OPENAI_API_KEY" error, and no network request is made. `.env` is never read or modified. | `lib.rs` `run()` |
| 2 | `get_vault_path()` returns `<dir>/vault`. | `commands/mod.rs` |
| 3 | `scan_tracked_projects` uses `<dir>/projects` whatever root the webview sends. | `commands/projects.rs` |
| 4 | Do not start `gmail::start_cadence` or `situations::start_cadence`. `gmail::auth::entry()` refuses, so the keyring is never touched. `gmail_connect`, `gmail_sync` and `gmail_disconnect` return "Disabled in the acceptance profile". | `lib.rs`, `gmail/auth.rs`, `gmail/mod.rs` |
| 5 | `prepare_delegation_run`, `prepare_delegation_resume`, `start_delegation_run` and `resume_delegation_run` refuse. Reading plans and reviews and running the local checks stay available; checks run in synthetic worktrees only. | `commands/delegation.rs` |
| 6 | Log `[Olympus::Acceptance] profile <dir>` at startup, and add a read-only `acceptance_profile` command. The header then shows a persistent "Acceptance profile — synthetic data; providers and Gmail disabled" label, so the run cannot be mistaken for production. | `lib.rs`, `HeaderBar.tsx` |

**Tests:** unit tests for each switch, including that `.env` is not loaded and that the Gmail entry point refuses. No schema or behaviour change without the variable.

**Estimated size:** about 60–90 lines of Rust plus a small header label. The database needs no code: its separation comes from 2a.

**Two fixture scripts**, not app code:
- `scripts/acceptance/build-fixtures.mjs <dir>` writes:
  - a synthetic vault with the ten folders, project notes (active, watching and archived statuses, next steps, vision review dates), research notes with wikilinks, a `_attachments/` PDF and a decision log;
  - `<dir>/projects/` with git repos: clean, dirty, commits since a session boundary, a linked worktree, and a plain folder.
- `scripts/acceptance/seed-db.mjs <dir>` runs after the first launch has created the database, using Node's built-in `node:sqlite`. It inserts:
  - a synthetic, enabled Gmail account row (safe because of switch 4);
  - one situation, via the existing `scripts/import-situation-context.py --db` with a synthetic pack;
  - a delegation run in `awaiting_review` pointing at a synthetic worktree whose `package.json` build script only echoes;
  - conversation rows across several days, including a reply with research provenance;
  - one row marked as imported from localStorage, to exercise the import-date defect.

**Approval needed before implementation:** switches 1–6, the two config files and the two scripts. Nothing in 2b has been written.

## 3. Launch, verification, cleanup and rollback

These steps assume 2a and 2b are in place. PowerShell, from the repository checkout.

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
1. The terminal shows `[Olympus::Acceptance] profile …\olympus-acceptance-…`, `[Olympus::Db] opened …\com.projectolympus.acceptance\olympus.sqlite`, and **no** `[Olympus::Env] loaded .env` line.
2. The header shows the Acceptance profile label.
3. The project names are the synthetic ones.
4. Preferences › Gmail says disabled.

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
| N17 | Timestamps | Transcript over the seeded days | Day separators read Today, Yesterday and dates. **Known defect:** the seeded "imported" row shows its import moment as a plain date. It should say "Imported …". Record what appears. |

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
