# Project Olympus — Session Handoff

_Current as of 2026-07-25, branch `claude/olympus-project-overview-b949xw` @ `1fa39e3`+.
Read `ARCHITECTURE.md` alongside this; it is the authority on anything they disagree about._

## What it is

A local-first AI command station: a desktop dashboard for projects, research,
workflows, and memory. The dashboard is the primary surface; the AI is one panel
in it, not the frame around it.

- **Shell:** Tauri 2 (Rust) + React 18 + TypeScript + Vite, Windows 11
- **Persistence:** SQLite via Tauri commands (`localStorage` in browser dev)
- **Memory layer:** an Obsidian vault at `Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`
- **Model:** `claude-opus-5`, `effort: medium`, called from Rust so the API key never reaches the webview

North star, from the vault Charter: *"aware of active projects, durable research,
preferences, workflows, and the next useful move."* The principle that has driven
recent work: **AI-generated actions should ask before risky writes.**

## The distinction that matters in this codebase

**"It compiles" and "the tests pass" have repeatedly meant less here than they look.**
Until 2026-07-25 the entire project had only ever been verified by compilation
and unit tests from a headless container. The first real launch immediately
surfaced defects nothing had caught.

Five tests were found this session that ran green while asserting nothing:

| Test | Why it could not fail |
|---|---|
| `pantheon::debug_parse_real_vault` | parser returns `Ok(empty)` when the vault is absent |
| `tasks::debug_parse_real_vault` | same |
| `vault_context::debug_load_real_vault_memory` | print-only; every read degrades to `""` |
| `profile::debug_load_real_profile` | print-only; every failure degrades to defaults |
| `vault_write::rejects_a_junction...` | skipped silently — symlinks need elevation on Windows |

All five now assert their preconditions. **Treat "the test passed" and "the test
ran" as separate questions.** The same pattern produced two real bugs: a UTF-8
BOM made every scaffold-created note invisible to the Pantheon scanner, and a
vault-path split was masked only by the absence of a settings UI.

## Verified at runtime vs. test-only

**Verified against the real app and vault:**

- Env loading, SQLite init, markets (Yahoo + FRED), weather (Open-Meteo), Git project scan
- Pantheon vault scan, Action Queue scan, assistant chat against the live API
- Operator profile parsing from the real note (all four fields, zero warnings)
- **The write gate, end to end**: prompt → approve → write → fingerprint stored in
  SQLite → next write compares, matches, proceeds silently. Confirmed from both
  the UI and the database.

**Still test-only — nobody has run these:**

- `save_attachment_to_vault` — has *never* successfully run; `02 - Research/_attachments/` does not exist
- `write_pantheon_entry` since the containment guard landed
- The gate's **divergence** branch — a file edited by hand then rewritten. Only the
  *no-recorded-fingerprint* branch has been exercised.
- Any release build. `tauri build` has never been run; `tauri dev` only.

## What shipped 2026-07-25

Ordered; each is one commit.

| Commit | |
|---|---|
| `46abf6f` | Six blocking commands moved off the event loop via `spawn_blocking`; markets client given a timeout |
| `e8f7688` | Market source corrected in docs — Yahoo Finance, never Finnhub |
| `4692512` | Bundle icon config |
| `62c957e` | Vault path unified — Rust is the sole source of truth |
| `abce522` | Docs: recorded what actually writes to the vault; removed an unimplemented safety claim |
| `5870f10` | Typed operator settings from profile frontmatter; fixed the BOM bug in the shared parser |
| `a1e3cbc` | Every vault write routed through one containment guard; `safe_join` replaced |
| `c62018a` | The write gate: fingerprints, confirmation channel, modal |
| `014f41c` | Process-spawn audit recorded |
| `d894aaa` | A declined overwrite no longer reports as a failure |

## Next work

**Task 4 — observations write path.** Append-only `09 - System/Profile Observations.md`,
dated entries, routed through the gate. Two decisions already made:

- It must be **structurally separate** from `User Profile.md` and must **not** be
  added to `STABLE_NOTES` in `vault_context.rs`. If model inferences feed back
  into the assistant's context, they become indistinguishable from the operator's
  stated preferences on the next turn.
- Append is not atomic. Write to a temp file in the same directory and
  `fs::rename` over the target — atomic on one volume, and it sidesteps a
  partial-append left by a mid-write OneDrive sync.

This is the **first appender in the codebase**, so it is the first real exercise
of the `AppendAuthored` tier.

**Housekeeping.**

- Delete the inert `vaultPath` row from the SQLite `settings` table. Nothing reads
  it since `62c957e`; a stale row that looks like live config invites the next
  two-sources-of-truth bug.
- **Hazard to record:** the vault path is now compile-time (`commands/mod.rs:12`).
  Reintroducing a settings UI requires un-hardcoding it *and* requires the write
  gate to already exist.
- **Hazard:** `settings.projectsRootPath` is still webview-supplied and reaches
  `git -C` (`projects.rs:162`). Read-only today, so not a data-loss risk — but it
  is the same pattern `62c957e` removed for the vault path, and git honours
  repo-local config keys that execute programs.

**Held for its own session:** project status tiering (`active | watching | scaffold
| archived`). Touches the Projects panel, the Git scan, and vault frontmatter at
once, and it is the prerequisite that makes a Daily Brief coherent rather than a
flat report on eleven equally-weighted repos.

## Constraints a new session will otherwise violate

- **Opus 5 payload contract:** `temperature`, `top_p`, `top_k`, and `budget_tokens`
  are rejected with a 400; `effort` nests inside `output_config`; thinking is on by
  default and counts against `max_tokens`. A unit test pins these out of the
  payload — do not break it.
- **The system prompt is split** into a cached stable block and a volatile block.
  Caching is a prefix match: nothing may be inserted ahead of or inside the stable
  block, and volatile state (Git status, research index) must stay after the
  breakpoint.
- **Declared intent, not inferred.** Every vault write declares a `WriteIntent`;
  the gate never guesses from the filesystem operation. `CreateUnique` is safe only
  because both creating writers guarantee a unique path.
- **Out-of-vault writes reject, never confirm.** A confirm path would mean the
  mechanism exists and one misclick authorizes it.
- Rust tests pass (83); keep them passing. No frontend test infrastructure exists —
  do not stand one up without being asked.
- React StrictMode double-invokes effects in dev. No gated write is currently
  effect-reachable; if one becomes so, it will produce duplicate dialogs.

## Open questions from the vault's own User Profile

- What sources should feed the daily operator brief?
- Which project stacks should become reusable scaffold recipes?
- What agents should exist first?

Note that `09 - System/User Profile.md` carries `status: assumed` — the four values
in its `olympus:` block were placed by tooling, not chosen by the operator.
`active_project_cap: 5` is known to be wrong. When the operator sets them
deliberately, that status becomes `active`.
