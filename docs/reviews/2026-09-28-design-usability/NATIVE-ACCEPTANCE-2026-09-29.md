# Native acceptance — 2026-09-29

**Result: N1–N17 not tested.** Part 1 records two isolation defects found at `f073af6` before any launch. Following the rule "if you find an isolation defect, do not launch", nothing was launched then. **The acceptance setup at `f073af6` must not be launched.**

Part 2 records the fix, applied on the branch in "Check the acceptance identity before anything starts" (the commit after `d111df4`). It was verified in a Linux container: unit tests, a Windows type check, and the compiled debug and release binaries run under Xvfb in a scratch home directory. That is not Windows or WebView2 evidence, so the native pass is still owed.

# Part 1 — findings at `f073af6`

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

The first proposed fix was recorded as a patch in `d111df4`. The applied fix in Part 2 supersedes it; git history keeps the draft.

# Part 2 — the fix and what verifies it

## What changed

| File | Change |
| --- | --- |
| `src-tauri/src/lib.rs` | `run()` starts with `generate_context!()` and `acceptance::check_startup(cfg!(debug_assertions), acceptance_dir(), context.config().identifier)`. A refusal exits there, before `prepare_environment()` (`.env`), the builder, the window and its webview profile, the database, the keyring and the workers. The check in `setup` is gone. `setup` now records the acceptance launch in `processing_logs`. |
| `src-tauri/src/commands/acceptance.rs` | `check_startup` replaces `check_identifier`. It refuses the variable with any identifier other than the exact acceptance one, and the variable naming something that is not a directory. It refuses the acceptance identifier in any letter case without the variable, and in a release build always, with a release-specific message. `refuse_startup` prints the reason, shows it in a message box in a Windows release build (no console), and exits with code 2. `record_launch` writes `acceptance-profile-launch` with `{dir, identifier}`. |
| `scripts/acceptance/seed-db.mjs` | Resolves the fixture directory and the database through symlinks and junctions (`realpathSync.native`). It refuses a resolved path containing `commandstation`, and a default path whose resolved folder is not `com.projectolympus.acceptance`. It also refuses any database without a launch record whose directory resolves to this fixture. All refusals happen before any write. |
| `scripts/test-acceptance-seed.mjs` | New regression script: 17 checks. |

## Verification (Linux x86_64, this container)

| Check | Result | What it shows |
| --- | --- | --- |
| `cargo test --lib` | 418 passed, 0 failed, 15 ignored (2 paid, 9 real-vault, 4 acceptance-fixture) | No regression. The count is 415 at `f073af6`, minus 1 replaced test, plus 4 new. |
| `OLYMPUS_TEST_ACCEPTANCE_FIXTURE=… OLYMPUS_TEST_ACCEPTANCE_DB=… cargo test --lib acceptance -- --include-ignored` | 16 passed, 0 failed. This includes the 4 fixture tests enabled explicitly, run against the database the real app created and the new seeder seeded. | The fixture and seed still read correctly through the backend. |
| `startup_accepts_only_the_matching_pairs` | pass | **Helper only:** every build × variable × identifier pairing, including case variants and a missing directory. |
| `run_checks_the_identity_before_the_environment_and_the_builder` | pass | **Source order only:** in `run()`, `check_startup(` precedes `prepare_environment()` and `tauri::Builder::default()`. |
| `both_acceptance_configs_use_the_acceptance_identifier`, `the_launch_marker_names_the_fixture_directory` | pass | The configs match the constant, and the marker round-trips. |
| `node scripts/test-acceptance-seed.mjs` | 17 checks pass (links exercised as **symlinks**). It fails on the `f073af6` seeder at the symlink bypass. | The production directory is refused by name, through a link, and as a linked default location. Refused too: no launch record, a record for another fixture, and an unreadable record, each with nothing written. A fixture reached through a link seeds, and a second seed is refused. |
| `npm run build`; all 17 `scripts/test-*.mjs` | pass | |
| `cargo check --lib --tests --target x86_64-pc-windows-gnu`, and `cargo check --release --lib --target x86_64-pc-windows-gnu` (real mingw C toolchain) | 0 errors, 0 warnings | The Windows-only message-box branch compiles. Nothing Windows was executed. |

**Startup order, observed in the compiled binaries.** Debug builds were compiled with the production and acceptance configs, the latter via `TAURI_CONFIG` as the CLI passes it; the embedded identifier was confirmed with `strings`. Release builds were compiled with `--features tauri/custom-protocol`. Each binary ran with a scratch `HOME`/`XDG_*`, first with no display and then under Xvfb. For the refusal cases, a canary `.env` with fake values sat where `load_olympus_env` looks. It was removed before any run that started fully.

| Binary | Variable | Old (`f073af6`) | Fixed |
| --- | --- | --- | --- |
| debug, production id | set | `profile` logged. Tauri created `data/com.projectolympus.commandstation` (the webview profile) and then panicked "Failed to setup app" (**defect 1 reproduced**) | exit 2, refused, **no directory created**, no `.env` line |
| debug, acceptance id | unset | loaded `.env`, opened `…/com.projectolympus.acceptance/olympus.sqlite` and ran (**defect 2 reproduced**) | exit 2, refused, no directory, no `.env` line |
| debug, acceptance id | blank, or a missing directory | — | exit 2, refused, no directory |
| debug, acceptance id | fixture | — | `profile` logged, no `.env` line, DB under `com.projectolympus.acceptance`, launch record written. After seeding and a 35 s relaunch: 0 Gmail sync runs, 0 situation runs, 0 model requests. |
| debug, production id | unset | — | `.env` loaded (canary) with no display. Under Xvfb, DB under `com.projectolympus.commandstation` in the scratch home: ordinary startup |
| release, acceptance id | set or unset | — | exit 2, "This release build was compiled with the acceptance identifier…", no directory created |
| release, production id | set or unset | — | ordinary startup, and the variable is ignored as documented. `.env` absent; the scratch-home DB was opened |

## Limitations

- **No Windows or WebView2 execution.** The `%LOCALAPPDATA%` profile claim, the Windows message box, and junction handling in the seeder are all unexecuted. `test-acceptance-seed.mjs` creates real junctions when run on Windows, but so far it has run only on Linux, with symlinks.
- The Xvfb runs had no dev server, so the frontend never loaded in the debug runs. They show the backend startup order, not UI behaviour.
- A release build compiled with the acceptance config now refuses to start. It never reads production resources, because the check runs before anything else.

## Merge readiness

Build and unit evidence is green, and the isolation defects are fixed at source and binary level on Linux. **Still not ready for merge consideration** until the first isolated Windows pass runs N1–N17. That pass should include one deliberate launch without the variable, to see the refusal under WebView2.

# Current status

## N1–N17

| # | Area | Outcome | Reason |
| --- | --- | --- | --- |
| N1 | Loading | not tested | No Windows host. (At `f073af6`, the isolation defects also blocked launching.) |
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
| N15 | 2D fallback | not tested | same. The no-WebGL config carries the same identifier, so the same startup check covers it. |
| N16 | Windows text | not tested | same |
| N17 | Timestamps / imported label | not tested | same. The seeded imported row exists (`conversation_imports`, original time 14:10) and `debug_load_the_seeded_acceptance_database` passed. |

Failure states the fixture cannot exercise are unchanged from DESKTOP-ACCEPTANCE §4: N4 depends on backend behaviour for a missing root, and N5 needs a manual rename while the app runs. No pass has been manufactured for either.

## Outstanding beyond the synthetic pass (separate decisions)

- **Live provider (P):** U6 time to first visible text with Voice on (Sol and Claude), voice 429 handling, opening-briefing autoplay in WebView2, and a thread-grounded answer. U6 stays partial.
- **Real Gmail (G), destructive (X), delegation (E):** unchanged from DESKTOP-ACCEPTANCE §5.
- **Release:** the release build ignores the variable, and refuses to start if it was compiled with the acceptance identifier (Part 2). A Windows release build and installed-app acceptance are still owed.
- **Known, unchanged:** narrow Communications with the console open (U8) is unresolved. The Skip to console link replaces the ≤15-Tab target. Drafts are lost on restart. Pre-fix imported rows are ambiguous. hybrid-core timing needs a GPU. P1–P6 are deferred.

## First isolated Windows pass

Follow DESKTOP-ACCEPTANCE §3 (fresh worktree, no `.env`, one PowerShell window) and §4, then fill in the N1–N17 table above. Before N1, confirm:
- the refusal: in a new window without the variable, `npm run tauri -- dev --config scripts/acceptance/tauri.acceptance.json` must print `refused to start` and show no window;
- the profile, database and `.env` lines in the terminal, and the header label;
- `node scripts/test-acceptance-seed.mjs` reports junctions on `win32`.

## Cleanup record (this session)

Everything was created under the session scratchpad (`/tmp/claude-0/…/scratchpad`) and nowhere else:
- worktrees `acc` (the branch) and `fix` (detached at `f073af6`);
- fixtures `fixture-*`, `fx-run` and link fixtures;
- scratch databases under `db/`;
- per-run scratch homes under `runs/` and binaries under `bins/`;
- logs.

The canary `.env` files were deleted before the full-start runs. The only packages installed were container build dependencies: the WebKitGTK/GTK dev packages and the mingw-w64 cross compiler. No Windows path, production database, credential or `.env` was touched. The container is disposable. To remove the two worktrees from the session checkout's metadata: `git worktree remove --force <scratchpad>/acc` and `…/fix`, run only against those two paths.
