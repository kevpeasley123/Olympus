# Project Olympus — Session Handoff

_Current as of 2026-07-26. `master` @ `55e11f8`. The visual system (`58206a1`) is
merged; `claude/visual-system`, `claude/project-status-tiering`, and
`claude/olympus-project-overview-b949xw` are all ancestors of `master` and safe
to delete. Read `ARCHITECTURE.md` alongside this; it is the authority on
anything they disagree about._

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
- **The project scan against the real projects root** — 8 projects, the vault
  excluded, `Project Olympus.md` joining the `Olympus` directory through its
  alias, ordering by real commit dates. Pinned by
  `projects::debug_scan_the_real_projects_root`, which prints the merged table.
- **The observation path, end to end.** `09 - System/Profile Observations.md` was
  seeded from nothing, appended to, and survived a hand-edit in Obsidian. The
  atomic rename works over OneDrive, which unit tests against a temp directory
  could not establish.
- **The Pantheon schema migration**, against all four real entries. Each kept its
  own `written_by` value, none gained an invented `why_kept`, no temp files were
  left, and the parser stopped warning about legacy origins.
- **The visual system, in Chrome against the dev server.** Parallax measured at
  `+9.95px` / `−9.89px` at the pointer extremes; density tiers and the uniform
  24px padding read back from the live DOM.

**Still test-only — nobody has run these:**

- `save_attachment_to_vault` — has *never* successfully run; `02 - Research/_attachments/` does not exist
- `write_pantheon_entry` since the containment guard landed
- The gate's **divergence** branch — a file edited by hand then rewritten. Only the
  *no-recorded-fingerprint* branch has been exercised.
- The gate's **divergence** branch under an append — a note edited by hand *then*
  appended to. The observation path exercised the no-recorded-fingerprint branch
  and the migration exercised divergence under `ModifyAuthored`, but not the two
  together.
- **Reduced motion.** `MotionConfig reducedMotion="user"` and a 23-selector CSS
  block are in, but nobody has toggled the OS setting and watched motion stop.
- **The visual system against the real background image**, at the real window
  size, with real data. Everything above was a browser at a different aspect.
  Contrast over the photograph is the most likely thing to need adjusting — the
  veil alpha in `.background-image` is the dial.
- Any release build. `tauri build` has never been run; `tauri dev` only.

**A note on why the visual work was verified in a browser.** `PrintWindow`
returns a blank white client area for WebView2, so the Tauri window cannot be
screenshotted. Driving Chrome against `127.0.0.1:31420` renders the same React
tree and is the only way to actually see the UI from a tool. Two real bugs were
caught that way and by nothing else: the background veil had been deleted rather
than reduced, and a `@media (max-width: 1280px)` rule silently reset the icon
rail to a 220px column.

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
| `87bad79` | The observations write path — the first appender (below) |

## What shipped 2026-07-26

| Commit | |
|---|---|
| `c77838e` | **Project status tiering** — vault notes supply intent, Git supplies truth |
| `58206a1` | **The visual system** — one panel construction, tiered translucency, parallax |
| `f290e66` | Rust build output moved out of OneDrive — see the hazard under Housekeeping |
| `6a70f3a` | **The Pantheon capture schema** — stance, why_kept, origin, written_by |
| `55e11f8` | The migration trigger, and the migration run against the real vault |

### Tiering (`c77838e`)

`01 - Projects/*.md` supplies `status`, `promoted`, and `next_step`; Git supplies
branch, dirty state, and commits. Joined in the Rust scan, because
`split_frontmatter` already strips the BOM that once made every scaffolded note
invisible. Neither source writes the other's fields.

Three things the scan was getting wrong, now fixed: `status` came from the
**project folder's mtime**, `next_step` was one of **three canned sentences**,
and the Obsidian vault — which lives inside the projects root — was scanned as a
project. Notes must declare `type: project` or the `olympus/project` tag, or
`Design Evolution.md` would render as a project with no repository.

**`unclassified` is a tier, and it is not `scaffold`.** Absence of a declaration
is not a judgement. Eight of nine projects have no note, so treating absence as
`scaffold` would have collapsed Pokedex — git-active, dirty tree — into a muted
row. It sorts directly under `active`, ordered by commit recency.

### Visual system (`58206a1`)

The audit found the inconsistency was not where it was expected: radius was
already uniform at zero, and the base was already dark navy. What varied was
padding (seven values) and header rows (seven constructions, four title
treatments). One `.panel-head` and one `--panel-pad` now; 21 orphaned rules gone.

Translucency is tiered by density — chrome `0.55`, panel `0.82`, prose and
numerals `0.94` — where before every panel was `0.96` over a blur that
transmitted about 4%. The image moved off `body` onto a transformed layer so
parallax is GPU-composited. Also landed: the 44px icon rail, empty panels
collapsing to one line, and Update Canvas demoted out of the Projects header.

## The Pantheon capture schema (`6a70f3a`, `55e11f8`)

The library is the assistant's **curriculum, not a reading pile**. There is
deliberately no read/unread/processed state, and no fixed category taxonomy —
tags stay open-ended and repairable.

Four fields, added because a schema cannot be backfilled across a library built
over a year:

- **`stance`** — `endorsed` | `provisional` | `disputed` | `unevaluated`. Always
  populated. Absent or unreadable degrades to `unevaluated`, **never** to
  `endorsed`; that is the one direction it must not fail in, and a test pins it.
  This is the field that makes disagreement possible.
- **`why_kept`** — optional. Blank writes no key at all and surfaces as "no
  stated purpose". Never invented: it is the one field whose whole value is that
  the operator wrote it.
- **`origin`** — `collected` | `olympus-found`. Everything collected is
  pre-filtered by his taste, so a library reasoning only from it is a well-read
  version of him.
- **`written_by`** — what `origin` used to hold.

**The repurpose hazard, and why it is closed.** `origin` was already populated
with writer provenance (`"Olympus dashboard"`). `extract_enum` drops any value
outside the enum with a warning, so an un-migrated note reports *no* origin
rather than reporting its writer as one.

`stance`, `origin`, and `why_kept` are rendered into the research index the model
receives, and the stable prompt explains how to read them — including that
disagreement should be **rare and cited**. A stance nothing reads is decoration.

## The observations write path

`append_profile_observation` (`commands/observations.rs`) appends one dated line
to `09 - System/Profile Observations.md`. Both prior decisions held:

- The note is **absent from `STABLE_NOTES`**, and `observations.rs` carries a test
  asserting that absence, so a future edit to `vault_context.rs` fails here rather
  than quietly feeding the model its own inferences back as the operator's stated
  preferences.
- The write is **atomic**: full file composed in memory → dot-prefixed temp file in
  the same directory → `sync_all` → `fs::rename` over the target, with a short
  retry for the Windows sharing violation OneDrive and Obsidian can cause.

Three things the task description did not anticipate:

- **The dialog was lying about appends.** Its title and buttons were hardcoded to
  overwrite language. `WriteIntent` now derives a `WriteOperation` that rides along
  in `PendingWrite`, and the webview picks its wording from it. A gate the operator
  learns to disbelieve is worse than no gate.
- **The gate can hold for 120 seconds, and the append is a full-file replace.** So
  the note is re-fingerprinted after approval; if it changed while the dialog was
  open, the write is refused rather than silently discarding whatever landed.
- **An over-long observation is rejected, not truncated** (500 chars). Storing half
  of what was approved is the exact failure the gate exists to prevent.

Entry point: the Chat panel — a header button, or *Note this* on any assistant
message, which prefills the composer. Both are click handlers, so nothing gated
is effect-reachable and StrictMode still cannot double-fire a dialog.

**Verified end to end on 2026-07-26** — seeded, appended, and a hand-edit in
Obsidian survived a subsequent append.

One thing that surfaced doing it: **Obsidian rewrites frontmatter indentation
whenever it opens a note** (`  - tag` becomes `- tag`). Files on disk will
routinely differ from what Olympus wrote, so the gate can flag divergence on a
note that was merely *viewed*. That is the gate working, but it reads like a
false positive — expect it before concluding something is broken.

## Next work — the dashboard redesign

The operator wrote a six-task redesign brief on 2026-07-26. Tasks 1, 5, and the
visual parts of 6 are built. **Tasks 2, 3, 4, and 6b are next**, planned and
approved in `~/.claude/plans/distributed-forging-charm.md` but not started.

**Tasks 2, 3, and 4 are one header restructure, not three.** `.olympus-header`
(`styles.css` l.419) is a centered 140px ceremonial band with no side slots; all
three want to live in it. Agreed shape: a three-zone bar at ~96px — emblem and
wordmark left, mode switcher centre, status rail right. Sigil 100px → 56px,
wordmark 56px → 32px.

**Research mode ships thin**: Pantheon resident in the centre column replacing
Projects, chat stays right, search over title and tags, modal stays for Ctrl+K.
No links, provenance, or contradiction views — those get designed once entries
exist.

The four decisions settled earlier still hold:

- **Task 2 — status rail.** Collapse Markets and Weather into one monospace line
  in the header band; clicking a segment opens the existing panel as an overlay.
  Both components stay intact — this is residency, not a rewrite. The weather
  location comes from Rust constants (`weather.rs`), and `WeatherPanel` now
  renders `state.data.label` with no hardcoded fallback. The rail must do the
  same, or it bakes in a location that may not be the one fetched.
- **Task 3 — mode switcher.** Command / Project / Research, as a visible
  segmented control; the keyboard shortcut is an accelerator, never the only
  affordance. **Replace `focusMode` rather than adding a sibling** — Project mode
  subsumes it, and keeping both makes a 2×3 state matrix. `focusMode` currently
  lives in `App.tsx` and raw `localStorage` under `olympus.focusMode`; migrate
  `"true"` → `project`, and fall back to Command on an unrecognised value.
- **Task 4 — the omega instrument.** Ships as **the next-action sentence plus
  event animation only** — vault-write pulse and poll tick. The brief's outer
  ring of count-proportional tier arcs was dropped: with ~8 projects across 3–4
  tiers it encodes three numbers, and three numbers lose to a text line. Events
  are the part a static list genuinely cannot show. Note that the poll tick will
  **fire twice at startup in dev** — StrictMode's double-invoke was confirmed in
  the logs, with weather, markets, and the Pantheon scan each fetching twice.
- **Task 6b — dissolve the Action Queue.** Attribute tasks to projects by which
  note the checkbox lives under. `tasks.rs` already records `source_folder` and a
  vault-relative `source_file`, so `01 - Projects/<note>.md` is the join. **The
  "no data yet" claim was wrong** — as of 2026-07-26 there are 17 open tasks: 10
  in `01 - Projects/Project Olympus.md` and therefore attributable, 6 in
  `03 - Tasks/Olympus Next Actions.md`, 1 in a daily brief. The unattributed
  bucket is 41%, not 100%. Surface it, do not hide it.

Task 5's translucency tiering only pays off once 2 and 3 exist — the open
Command-mode centre is what the background is meant to read through.

**Flagged by the operator, deliberately not built.** These are dependencies of
the library actually working, recorded so they are not rediscovered as bugs.

- **The assistant sees research as metadata only** — titles, never bodies. Under
  the curriculum framing that is the premise unmet: fifty sources could be added
  and nothing about its thinking would change. What it needs is a tool-use loop
  (`read_vault_note` / `search_vault`) so the model opens a note it names.
  **Research chat must not be built as general chat with vault context bolted
  on** — an assistant that paraphrases notes it never opened teaches the operator
  not to trust the mode.
- **`04 - Decisions` is invisible to the assistant**, including metadata — absent
  from `STABLE_NOTES` and from the Pantheon index. Contradiction detection is
  impossible without it: nothing can be told that a new source undercuts an April
  decision if the decisions cannot be seen.
- **Decompose `LibraryPanel.tsx` (1354 lines).** Worth doing on its own merits
  and the real prerequisite for anything richer in Research mode.

**Housekeeping.**

- Delete the inert `vaultPath` row from the SQLite `settings` table. Nothing reads
  it since `62c957e`; a stale row that looks like live config invites the next
  two-sources-of-truth bug.
- **Hazard to record:** the vault path is now compile-time (`commands/mod.rs:17`).
  Reintroducing a settings UI requires un-hardcoding it *and* requires the write
  gate to already exist.
- **Hazard:** `settings.projectsRootPath` is still webview-supplied and reaches
  `git -C` (`projects.rs`). Read-only today, so not a data-loss risk — but it
  is the same pattern `62c957e` removed for the vault path, and git honours
  repo-local config keys that execute programs.
- The Pantheon scan re-reads every research file — including a ~17,000-word note
  — every 60 seconds, twice on mount under StrictMode. If Pantheon becomes a mode
  rather than a resident panel, the cadence is worth revisiting.
- **The repository lives inside OneDrive, which does not read `.gitignore`.**
  Build output was syncing: `src-tauri/target` had reached 16.8 GB across 19,230
  files, and OneDrive takes locks on artifacts mid-sync, which surfaces on Windows
  as intermittent linker `Access is denied` failures. Fixed 2026-07-26 by
  `.cargo/config.toml` redirecting `target-dir` to `C:/Users/kevpe/dev-target/olympus`;
  the old tree was deleted, taking the synced folder from ~17 GB to 219 MB.
  That config is **gitignored, not tracked** — the path is absolute and
  machine-specific, so a second machine needs its own. A checkout without it
  silently builds back into OneDrive. `node_modules` (187 MB) is still synced;
  npm cannot relocate it, and the only real fix is moving the repo out of OneDrive.
- **The tiering has almost no data.** One `active`, seven `unclassified`.
  Classifying a project means hand-editing frontmatter in Obsidian; an in-app
  promote button would be a vault write and would have to go through the gate.

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
- **The gate's wording is derived, not written.** `operation_of(intent)` decides
  whether the dialog says "add to" or "replace". A new `WriteIntent` needs an arm
  there and a `COPY` entry in `WriteConfirmDialog.tsx`, or it silently inherits
  overwrite language.
- **Git supplies truth, the vault supplies intent, and neither writes the other's
  fields.** Branch, dirty state, and commits come from Git; status, promotion
  date, and next step come from a note. A missing `next_step` renders as nothing
  — it used to be one of three canned sentences, which read as advice while
  carrying no information.
- **The animation dependency is `motion`, not `framer-motion`.** Reduced motion
  is handled by `MotionConfig reducedMotion="user"` in `App.tsx`, which covers
  every `motion` component including `AnimatePresence` inside `LibraryPanel`.
  Per-component wiring would leave whatever nobody remembered to touch animating.
- **Check the narrow-width media query when changing the grid.**
  `@media (max-width: 1280px)` carries its own `.main-grid` columns and will
  silently undo a layout change on any smaller window. That bug shipped once.
- Rust tests pass (133); keep them passing. No frontend test infrastructure exists —
  do not stand one up without being asked.
- React StrictMode double-invokes effects in dev. No gated write is currently
  effect-reachable; if one becomes so, it will produce duplicate dialogs. Any
  scan-driven animation will fire twice at startup.
- **`tauri dev` rewrites `src-tauri/Cargo.toml` with CRLF line endings** while
  running, so it shows as modified with an empty diff. Restore it rather than
  committing a line-ending-only delta. Touching anything under `src-tauri/` also
  triggers a rebuild and restarts the app.

## Open questions from the vault's own User Profile

- What sources should feed the daily operator brief?
- Which project stacks should become reusable scaffold recipes?
- What agents should exist first?

Note that `09 - System/User Profile.md` carries `status: assumed` — the four values
in its `olympus:` block were placed by tooling, not chosen by the operator.
`active_project_cap: 5` is known to be wrong. When the operator sets them
deliberately, that status becomes `active`.
