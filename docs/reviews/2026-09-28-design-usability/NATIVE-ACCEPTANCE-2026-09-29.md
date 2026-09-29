# Native acceptance — 2026-09-29

**Result: not run.** Two isolation defects were found in the acceptance profile before any launch. Following the rule "if you find an isolation defect, do not launch", nothing was launched. Separately, this session ran in a Linux cloud container, where Windows and WebView2 are unavailable. N1–N17 are all **not tested**.

## Source and environment

| | |
| --- | --- |
| Branch | `claude/blissful-lamport-2l4o96` (read-only fetch) |
| Revision | `f073af6` "Refuse the acceptance profile under the production identifier". This is still the branch head, so there are no commits since the handoff. |
| Checkout | A detached, disposable worktree in the session scratchpad. The session's own checkout (`claude/practical-cori-1rvhrd` = `master` = `9036e5e`) was not switched. |
| Windows checkouts | Not reachable from this container. `C:\Users\kevpe\OneDrive\Desktop\Projects\Olympus` and the "Olympus Memory Worktree" were not inspected. |
| Platform | Linux x86_64, Node 22.22.2, Rust stable, Tauri 2.10.3, wry 0.54.4, WebKitGTK 2.52.6 dev headers (installed to compile). No Windows, WebView2, GPU or display. |

## Verification actually reached

| Check | Command | Result |
| --- | --- | --- |
| Rust library | `cd src-tauri && cargo test --lib` | 415 passed, 0 failed, 15 ignored |
| Ignored tests, by kind | (from the run above) | 2 paid (`live_olympus_behavior`, `live_openai_routes`); 9 real-vault; 4 acceptance-fixture |
| Acceptance tests against a fresh fixture and a seeded scratch DB | `OLYMPUS_TEST_ACCEPTANCE_FIXTURE=<fx> OLYMPUS_TEST_ACCEPTANCE_DB=<db> cargo test --lib acceptance -- --include-ignored` | 13 passed, 0 failed (includes all 4 acceptance-fixture tests) |
| Frontend | `npm ci`, then `npm run build` | passed |
| Node scripts | every `scripts/test-*.mjs` | 16 of 16 passed |
| Fixture builder | `node scripts/acceptance/build-fixtures.mjs <new dir>`, then again into the same dir | Built. The second run was refused: "exists and is not empty" |
| Seeder refusals | `seed-db.mjs` against scratch DBs built from `schema.sql` | Refused: production-named path (both `commandstation` and `CommandStation`), a missing default DB, a missing fixture, a DB without tables, and a second run. **Accepted a symlink to a production-named directory** (defect 3). |
| Seeded DB integrity | `PRAGMA integrity_check`, `PRAGMA foreign_key_check` | `ok`, 0 violations |
| Seeded verification command | `npm run build` in the seeded worktree | Prints `acceptance build ok`. See below. |

This confirms the historical 415/0 count at `f073af6`. None of it is native Windows behaviour.

## Isolation review (source level)

| Requirement | Finding | Evidence at `f073af6` |
| --- | --- | --- |
| Guard runs before any database is opened or migrated | **Yes** for SQLite. `check_identifier` is the first statement in `setup`, ahead of `open_database` and every `recover`/`INSERT`. | `lib.rs` 347–352 |
| Guard runs before the production webview profile is touched | **No — defect 1.** | See below |
| Database and webview profile are separate from production, with the config | Yes. The identifier `com.projectolympus.acceptance` gives `app_data_dir` (DB, config dir, delegation targets) and the WebView2 folder `%LOCALAPPDATA%\com.projectolympus.acceptance`. | `lib.rs` 78–86; Tauri `manager/webview.rs` 504–521 |
| The config without the variable fails safe | **No — defect 2.** | See below |
| Vault and projects cannot fall back to live paths | Yes while the variable is set. `get_vault_path()` returns `<dir>/vault` with no fallback. `scan_tracked_projects` overrides the webview's root. There are no other `VAULT_PATH` reads. Vault commits require the vault to be its own git top level. The scan only runs git where `.git` exists. | `commands/mod.rs` 37; `projects.rs` 119–121, 211; `vault_git.rs` |
| No `.env` loading or provider keys | Yes while the variable is set. `.env` is skipped, and both keys are removed before the builder. Only `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are read anywhere in the backend. | `lib.rs` 325–339 |
| No keyring access, Gmail network or background work | Yes while the variable is set. `auth::entry` refuses before `keyring::Entry::new`. Connect, sync and disconnect refuse, and neither cadence starts. | `gmail/auth.rs` 45–53; `lib.rs` 366–369 |
| No live delegation | Yes. The four launch commands and `spawn_claude` refuse first. | `delegation.rs` 577, 1494, 1514, 1531, 1625 |
| Restart path | Preserves isolation. `restart_olympus` → `app.restart()` re-executes the same debug binary, which inherits the environment. The identifier is compiled in (see defect 2). Under `tauri dev` the dev server may already be gone, which fails safe. | `lib.rs` 286–289 |
| No-WebGL config | Same identifier. It only restates `app.windows` with `--disable-webgl`, so its isolation is identical, including both defects. | `scripts/acceptance/tauri.acceptance-nowebgl.json` |
| Fixture paths contained | Builder: yes. It writes only under `<dir>`, refuses a non-empty `<dir>`, and sets git identity and `commit.gpgsign=false` per repository. It does not refuse an empty `<dir>` inside the real vault or projects tree. The documented `$env:TEMP` location avoids that. | `build-fixtures.mjs` 27–31, 71–78 |
| Seeder paths contained | Mostly. The `commandstation` check is lexical, so a junction or symlink passed through `--db` defeats it (**defect 3, low**). The default path is safe. | `seed-db.mjs` 76–79; reproduced with a symlink |
| Seeded verification command is harmless | Yes. The row's workspace is `<dir>/delegations/<run-id>`. The build script is `node -e "console.log('acceptance build ok')"`, with no `pre`/`post` hooks. It runs as `cmd.exe /D /S /C npm run build` with the allowlisted environment and no API keys. | `seed-db.mjs` 232–245; `delegation_review.rs` 200–230 |
| The header label proves isolation | No. It only reflects the variable, and the database path log line is the only identifier evidence. Both must be checked (DESKTOP-ACCEPTANCE §3). | `acceptanceProfile.ts` |

### Defect 1 — a refused launch still opens the production webview profile

With `OLYMPUS_ACCEPTANCE_DIR` set but no `--config`, the binary carries the production identifier. In Tauri 2.10.3, `App::run` handles `RuntimeRunEvent::Ready` by calling `setup()` (`app.rs` 2370–2384). That function builds every configured window **before** calling the application's setup hook. Building the window resolves the WebView2 data directory from the identifier and creates it if absent (`manager/webview.rs` 504–521). The WebView2 environment for `%LOCALAPPDATA%\com.projectolympus.commandstation` is therefore opened, and navigation to the dev URL begins, before `check_identifier` refuses and Tauri panics with "Failed to setup app".

The SQLite database is not opened, so the documented claim holds for the database only. Page script probably never runs, because the panic follows immediately. That is inferred, not observed. If the installed app is running at the same time, WebView2 may also contend for the folder.

### Defect 2 — the acceptance config without the variable is not refused

`--config` is merged at **compile time**: the Tauri CLI passes `TAURI_CONFIG` to `generate_context!` (`tauri-codegen` `lib.rs` 83). A binary built with the acceptance config therefore always runs as `com.projectolympus.acceptance`. `check_identifier` refuses only "variable set + production identifier". Launch the acceptance build without the variable — a relaunch from a new PowerShell window after seeding (§3 step 7, or N15), or `src-tauri\target\debug\*.exe` run directly — and the result is:

- `.env` is loaded from the checkout (`load_olympus_env`).
- The vault is the real `VAULT_PATH`, and the projects root is whatever the acceptance DB's settings hold. On a first launch that is the seed default, `C:\Users\kevpe\OneDrive\Desktop\Projects`.
- Both cadences start. After seeding, the account is enabled. Gmail sync at 5 s fails on the missing client config under the acceptance config dir, which is `ApiError::Other`, so the status is set to `sync_error` (`gmail/mod.rs` 123–128, 194–196, 249). The situation worker at 20 s does not skip `sync_error`. The seeded situation has `briefing_json = '{}'` and `last_attempt = 0`, so it is dirty. The worker calls the **paid** Primary route with the synthetic situation **and excerpts from the real vault's research notes** (`situations.rs` 403–419; `situations/engine.rs` 171–183 and the `research(&entries, &query)` input).
- The header shows no acceptance label, so §3's check would catch it, but only after these startup actions have run.

### Defect 3 — the seeder's production guard is lexical (low)

`--db <link>\olympus.sqlite`, where `<link>` is a junction or symlink to `…\com.projectolympus.commandstation`, is accepted. This was reproduced with a symlink on Linux: the production-named scratch DB was seeded. Using it needs an explicit `--db`.

### Proposed focused fix (prepared, not applied)

`proposed-isolation-fix-2026-09-29.patch`, beside this report. It is three files and about 50 lines:

1. `acceptance.rs`: add `ACCEPTANCE_IDENTIFIER`. `check_identifier` also refuses "acceptance identifier + variable unset". Tests pin both configs to the constant, and pin that `run()` checks before `tauri::Builder::default()`.
2. `lib.rs`: `run()` calls `generate_context!()` first and checks `context.config().identifier` **before** `prepare_environment()` and the builder. The check leaves `setup`. A refused launch loads no `.env`, creates no window and opens no webview profile or database.
3. `seed-db.mjs`: also refuse when `realpathSync.native(dbPath)` contains `commandstation`.

Verified in a second disposable worktree: `cargo test --lib` 417 passed, 0 failed, 15 ignored, and the patched seeder refuses the symlinked path. It has not been compiled for Windows or launched.

Until a fix lands, two things lower the risk (they are not isolation): run from a fresh worktree that has no `.env`, and confirm the variable in the same shell (`echo $env:OLYMPUS_ACCEPTANCE_DIR`) before every launch. OS-level `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` variables, if they exist, would still be inherited in defect 2.

## N1–N17

| # | Area | Outcome | Reason |
| --- | --- | --- | --- |
| N1 | Loading | not tested | No launch: isolation defects 1–2 and no Windows host |
| N2 | Ready | not tested | same |
| N3 | Empty | not tested | same |
| N4 | Failed | not tested | same. Which state appears (SCAN FAILED or NO PROJECTS) is still unconfirmed. |
| N5 | Stale | not tested | same |
| N6 | Skip to console | not tested | same |
| N7 | Preferences focus/Escape | not tested | same |
| N8 | Ctrl+R | not tested | same |
| N9 | Review notes survive a check | not tested | same. The seeded check itself was run outside the app: exit 0, `acceptance build ok`. |
| N10 | Drafts survive mode switches | not tested | same |
| N11 | Research navigation | not tested | same |
| N12 | Evidence disclosures | not tested | same. Also: `open_vault_note` builds `obsidian://open?vault=vault&…` from the fixture folder name, so Obsidian opens the note only if the fixture vault is registered in Obsidian (which writes Obsidian's own config, outside `$Acc`). Otherwise it reports an unknown vault, which is expected and not a product failure. |
| N13 | Communications 1280×800 / 1440×900 | not tested | same |
| N14 | GPU rendering | not tested | same, and needs a real GPU |
| N15 | 2D fallback | not tested | same. The no-WebGL config shares both defects. |
| N16 | Windows text | not tested | same |
| N17 | Timestamps / imported label | not tested | same. The seeded imported row exists (`conversation_imports`, original time 14:10) and `debug_load_the_seeded_acceptance_database` passed. |

Failure states the fixture cannot exercise are unchanged from DESKTOP-ACCEPTANCE §4: N4 depends on backend behaviour for a missing root, and N5 needs a manual rename while the app runs. No pass has been manufactured for either.

## Merge readiness

**Not ready for merge consideration.** The acceptance profile's isolation guarantee has two confirmed defects, and the native pass (N1–N17) has not run. Build and unit evidence is green at `f073af6`.

## Outstanding beyond the synthetic pass (separate decisions)

- **Live provider (P):** U6 time to first visible text with Voice on (Sol and Claude), voice 429 handling, opening-briefing autoplay in WebView2, and a thread-grounded answer. U6 stays partial.
- **Real Gmail (G), destructive (X), delegation (E):** unchanged from DESKTOP-ACCEPTANCE §5.
- **Release:** the release build ignores the variable (`#[cfg(not(debug_assertions))]` returns `None`). A Windows release compile and installed-app acceptance are still owed.
- **Known, unchanged:** narrow Communications with the console open (U8) is unresolved. The Skip to console link replaces the ≤15-Tab target. Drafts are lost on restart. Pre-fix imported rows are ambiguous. hybrid-core timing needs a GPU. P1–P6 are deferred.

## Local steps for the native pass (after the fix is applied and pushed)

Use a separate worktree so the existing checkouts, their `node_modules` and their `.env` stay untouched. Run everything in one PowerShell window.

```powershell
cd C:\Users\kevpe\OneDrive\Desktop\Projects\Olympus
git status --short                       # expect clean; do not switch a dirty checkout
git fetch origin claude/blissful-lamport-2l4o96
$Wt  = Join-Path $env:TEMP "olympus-acc-src-$(Get-Date -Format yyyyMMdd-HHmmss)"
git worktree add --detach $Wt origin/claude/blissful-lamport-2l4o96
cd $Wt; git log -1 --oneline             # record the revision; confirm it contains the fix
Test-Path .env                           # must be False
npm ci
$Acc = Join-Path $env:TEMP "olympus-acceptance-$(Get-Date -Format yyyyMMdd-HHmmss)"
node scripts/acceptance/build-fixtures.mjs $Acc
$env:OLYMPUS_ACCEPTANCE_DIR = $Acc
echo $env:OLYMPUS_ACCEPTANCE_DIR         # confirm before every launch
npm run tauri -- dev --config scripts/acceptance/tauri.acceptance.json
```

Before touching anything, check the terminal and the window:
- `[Olympus::Acceptance] profile <$Acc>` and `[Olympus::Db] opened …\AppData\Roaming\com.projectolympus.acceptance\olympus.sqlite` both appear.
- No `[Olympus::Env]` line appears.
- The header shows the acceptance label, and the project names are all `acceptance-…`.

If any of these is wrong, close the window and stop.

Then close the app, run `node scripts/acceptance/seed-db.mjs $Acc` in the same window, relaunch with the same command, and run N1–N17 (DESKTOP-ACCEPTANCE §4). For N15, relaunch with `--config scripts/acceptance/tauri.acceptance-nowebgl.json`. With the fix in place, a new shell that lacks the variable should be refused before any window opens. Checking that is worth one deliberate attempt.

Cleanup, after `Get-Item` confirms each resolved path is under `$env:TEMP\olympus-acceptance-*` or is `com.projectolympus.acceptance`:
`Remove-Item Env:OLYMPUS_ACCEPTANCE_DIR`; remove `$Acc`, `$env:APPDATA\com.projectolympus.acceptance` and `$env:LOCALAPPDATA\com.projectolympus.acceptance`. Then run `git worktree remove $Wt` from the original checkout. Never target `com.projectolympus.commandstation`.

## Cleanup record (this session)

Everything was created under the session scratchpad (`/tmp/claude-0/…/scratchpad`) and nowhere else: worktrees `acc` and `fix` (detached, `f073af6`), fixtures `fixture-20260929-042716`, `fixture-link` and `fixture-link2`, scratch databases under `db/`, and logs. No Windows path, production database, credential or `.env` was touched. The container is disposable. To remove the two worktrees from the session checkout's metadata: `git worktree remove --force <scratchpad>/acc` and `…/fix`, run only against those two paths.
