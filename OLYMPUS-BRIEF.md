# Project Olympus — Session Handoff

_Current as of 2026-07-26. `master` @ `4c8e5c2`. The visual system (`58206a1`) is
merged; `claude/visual-system`, `claude/project-status-tiering`, and
`claude/olympus-project-overview-b949xw` are all ancestors of `master` and safe
to delete. Read `ARCHITECTURE.md` alongside this; it is the authority on
anything they disagree about._

_**Check this file against the code before trusting it.** It has been wrong in
every session that has read it: it said the visual system was unmerged when it
was, that task 6b had no data when 10 of 17 tasks were attributable, that the
test count was 133 when it was 145, and — for three rounds — that task 6b was
the only thing left, after 6b and two further rounds had shipped. Line numbers
quoted here drift constantly. **Confirm the current state of anything you are
about to change**; every correction above came from checking rather than from
reading._

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
- **The header restructure, in Chrome against the dev server.** Band 96px, sigil
  56px, wordmark 32px, switcher centred at x=960 in a 1920 viewport, rail flush
  right. All three modes switched and their layouts confirmed; both overlays
  opened and closed by button and by Escape; Ctrl+\ cycled and wrapped;
  `focusMode: "true"` migrated to Project with the legacy key removed, and a
  garbage value landed on Command. **At 1184px the icon rail held at 44px and the
  header held at 96px with no overflow** — the media query that shipped a bug
  once did not this time. The omega's poll pulse was watched: event ring appears,
  holds 700ms, clears.

**Still test-only — nobody has run these:**

- `save_attachment_to_vault` — has *never* successfully run; `02 - Research/_attachments/` does not exist
- `write_pantheon_entry` since the containment guard landed
- The gate's **divergence** branch — a file edited by hand then rewritten. Only the
  *no-recorded-fingerprint* branch has been exercised.
- The gate's **divergence** branch under an append — a note edited by hand *then*
  appended to. The observation path exercised the no-recorded-fingerprint branch
  and the migration exercised divergence under `ModifyAuthored`, but not the two
  together.
- **The omega's vault-write pulse.** The poll tick is confirmed and shares the
  same subscriber path, but the write branch needs the Tauri gate and has never
  fired. Watch it during an approval dialog.
- **The instrument against real portfolio data.** Arc ramp, hover labels, dirty
  breath, named dots and the doubled sentence are all confirmed in the live DOM,
  but with seed data — the browser has no `invoke`, so all five dots sit in
  their `is-cold` state and the tier mix is not the real one.
- **`open_vault_note`.** Compiles and is registered; nobody has clicked the
  empty-state prompt and watched Obsidian open. It needs a `tauri dev` restart
  to exist at all, since hot reload does not add Rust commands.
- **Reduced motion, at the OS level.** Every selector in the block is confirmed
  to match live elements, and applying those declarations unconditionally flips
  all four from animating to `none` — so the CSS is right and covers what is on
  screen. What nobody has done is toggle **Settings → Accessibility → Visual
  effects → Animation effects** and watch it happen for real.
- **The visual system against the real background image**, at the real window
  size, with real data. Everything above was a browser at a different aspect.
  Contrast over the photograph is the most likely thing to need adjusting — the
  veil alpha in `.background-image` is the dial.
- Whether a release build **runs**. `tauri build` now succeeds — 2m24s on
  2026-07-26, MSI and NSIS bundles at `C:/Users/kevpe/dev-target/olympus/release/bundle/`
  — but nobody has launched the produced executable. Compiling and running are
  the separate questions this project keeps relearning.

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
| `4e8f04c` | **The header restructure** — three zones, three modes, status rail, omega |
| `dd84593` | **The Action Queue dissolved** into per-project task attribution |
| `20a81f8` | The capture form's body field moved where it can be found |
| `b210698` | The status rail given a budget, so it drops units instead of overlapping |
| `b03788f` | **Command mode became the omega instrument** |
| `4c8e5c2` | **The instrument made readable** — arc ramp, hover, named poll dots, sizing |

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

### The header restructure (`4e8f04c`)

Tasks 2, 3, and 4 shipped as one change, because all three wanted the same
140px band. It is now a three-zone bar at 96px — omega instrument left, mode
switcher centre, status rail right. Sigil 100px → 56px, wordmark 56px → 32px.

**Markets and Weather are residents of the rail, not rewrites of it.** One
monospace line; a click opens the unchanged panel as an overlay. The rail
summarises those panels and must never reimplement them, or the two drift. The
weather label reads `state.data?.label` with no literal fallback.

**`focusMode` is gone, not siblinged.** Project mode subsumes it; keeping both
would have made a 2×3 state matrix. `olympus.focusMode` migrates (`"true"` →
Project, anything unrecognised → Command) and the old key is **deleted** rather
than left as inert config. Ctrl+\ cycles as an accelerator; the segmented
control is the affordance.

**The omega is the next-action sentence plus event animation.** The sentence is
a real `next_step` or nothing — never generated. It pulses on poll ticks and on
approved vault writes. Rust emits nothing on write *completion*, only
`vault-write-pending`, so approval is the honest moment and the pulse is a
frontend bus (`services/instrumentEvents.ts`). Tier arcs were dropped: three
numbers lose to a text line.

**Research mode gives the centre column to the library.** `LibraryPanel` takes a
`resident` prop and swaps only the *wrapper* around the database surface — in
place instead of a portal — so the 270 lines inside cannot drift between the two
presentations. Search now covers tags.

Two things nothing but running it would have found:

- **`.topbar` carries `min-height: 140px`, and a min-height beats a height.** The
  band stayed 140px while every zone inside it measured correctly. Anything
  changing the header's height must override `min-height` too.
- **The overlay's close button collided with the panel's own header actions.**
  Absolutely positioned top-right, it landed on `WeatherPanel`'s Retry —
  invisible, and swallowing its own click. It has its own row now. Both of these
  panels put actions in that corner; don't float anything over it.

### Tasks, attributed to their projects (`dd84593`)

The Action Queue is gone. A task renders under the project whose note holds its
checkbox, joined on plain string equality — `tasks.rs` writes a vault-relative
`source_file` and `project_notes.rs` builds `note_path` the same way. Matching
on project *names* would mis-attribute the moment two notes shared a word.

The join lives in `services/taskAttribution.ts` rather than in the panel, so it
can be checked against real vault data: the browser has no `invoke`, renders
zero tasks, and can never exercise it. Against the real vault — 17 open tasks,
10 joining `Project Olympus.md`, 7 joining nothing.

**Those 7 are surfaced, not hidden**, in a dashed card, expanded, grouped by
source note. A bucket that quietly dropped 41% of the open work would be worse
than the panel it replaced, so it is deliberately not behind a toggle.

### The status rail's budget (`b210698`)

The rail was over its zone at **every** width, maximised included: 872px of
content in 741px at 1920. Segments carried `min-width: 0` so the boxes shrank
while their `nowrap` text did not, and nothing clipped it — the Dow value
painted through the weather segment.

Two things were wrong, and fixing only the first made it worse: sizing the
rail's track `auto` stopped the overflow but let it take content width ahead of
the `1fr` beside it, starving the left zone to nothing at 1100px. **The rail
cannot measure its own container**, because that container is sized by the rail.

So `HeaderBar` computes the budget — header content box, less the switcher,
less a 280px floor for the omega — and hands it down. The rail renders every
candidate composition off-layout, measures them, and takes the richest that
fits. Measurement, not breakpoints: a five-digit Dow is wider than a four-digit
one and a viewport width cannot know that. `overflow: hidden` is the backstop.

Priority is **per unit, not per category**. The leading index is never dropped
and weather never falls below its temperature; between those, weather's location
and temperature outrank the tail of the index list, because 141px for a complete
outdoor state beats 161px for one more number. Tickers instead of full labels
buy back ~97px.

Measured candidates with real market text: 610, 530, 403, 269, 201. 1440 and up
keep three indices and full weather; 1280 drops the weather condition.

**The measure copies need `width: max-content`.** As block-level boxes in a
shrink-to-fit parent they each report the widest sibling's width, every
candidate "fits", and the richest always wins — the mechanism silently becomes
decorative.

### Command mode as an instrument (`b03788f`, `4c8e5c2`)

Command and Project used to render the same screen, differing only in which tab
was lit. Command is now the omega instrument and nothing else: icon rail left,
chat right, the whole centre column drawing directly on the background image —
the only mode where that image is visible, which is the point of the mode. **If
a scrolling list ever appears here, it has become Project mode with a different
tab lit.**

- **Outer ring.** Arc length is count; status is carried by lightness *and*
  stroke weight moving together in one amber-to-slate ramp, floor 5px. Four
  weights a pixel apart are not separable at 500px — the first version had
  `unclassified` at 3px and 0.45 opacity over a photograph, which read as 87% of
  the ring being empty track. It was never absent, only invisible.
- **`unclassified` gets its own arc.** Leaving it out would draw a ring
  representing one of eight projects while looking like the whole portfolio.
  When it shrinks to nothing, that is the ring reporting success.
- **Arcs are clickable**, entering Project mode filtered to that tier; the panel
  shows a dismissable chip naming the filter, because a filtered list that does
  not say so looks like a list that lost most of its projects.
- **Hover hangs a label at the arc's own mid-angle** rather than lighting a
  permanent legend.
- **A tier containing uncommitted work breathes.** `repo_state` conflates dirty
  with never-committed, so dirty is derived as `git-pending` **with a commit date
  present** — a folder that was never initialised belongs to the scaffold tier,
  not to an urgent pulse. The breath is 0.78→1, never dimmer than the tier below
  it, or the pulse inverts the ranking it sits inside.
- **The dots are named poll sources**, one each for git, tasks, pantheon,
  markets and weather, lighting on their own landing with source and age on
  hover. A dot that stops lighting is a dead scan.
- **The sentence is the point of the mode**, not the ring. 62px, clamped to two
  lines, full text on hover. It is **not** the display face — Cinzel rendered it
  as five lines of serif capitals, which is a wordmark treatment and unreadable
  as prose.
- **The ring is a fixed 505px and does not scale to fit text.** Scaling would
  either drop the strokes back under the readable floor or shift the visual
  ratios, and an instrument sized by something it does not measure is worse than
  a clipped sentence. A next step needing five lines is two next steps.
- **The empty state is a prompt, not a confession.** "No next step set", opening
  the note where it would be set. The previous copy reported an empty
  frontmatter field as the largest text on screen.
- **Command's header drops to the wordmark alone**, so there is one omega on
  screen rather than two — which also hands the rail its width back in the mode
  where it is most visible.

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

**The six-task redesign brief is finished.** All of it shipped, plus two rounds
of corrections on top of it. Nothing in that brief is outstanding.

Research mode shipped thin, as agreed: Pantheon resident in the centre column,
chat still right, search over title and tags. No links, provenance, or
contradiction views — those get designed once entries exist. **Ctrl+K does not
open the library and never has** — it is gated on the database already being
open (`LibraryPanel.tsx`) and only focuses the search box. The shortcut popover
used to claim otherwise; it now says what the key does.

### The operator's own next steps

Three things wait on him, not on code:

- **Classify the seven unclassified projects.** The ring is built and correct
  but has almost nothing to say while 7 of 8 projects carry no declared status.
  One file per project in `01 - Projects/`, named exactly the project folder
  (or with the folder name under `aliases:`), carrying `type: project` or the
  `olympus/project` tag, and `status:` one of `active`, `watching`, `scaffold`,
  `archived`. **Quote any value containing a colon** or YAML reads it as a
  nested key and the field vanishes silently.
- **Set `next_step` on `Project Olympus.md`.** Until then Command mode shows its
  empty-state prompt rather than a sentence.
- **Replace the background image.** See the note under Housekeeping — the
  reposition stopgap is dead, and it is the only remaining fix.

### Then: the dependencies of the library working

These were flagged and deliberately not built. They are now the real next work.

- **The assistant sees research as metadata only** — titles, never bodies. Under
  the curriculum framing that is the premise unmet: fifty sources could be added
  and nothing about its thinking would change. It needs a tool-use loop
  (`read_vault_note` / `search_vault`) so the model opens a note it names.
  **Research chat must not be built as general chat with vault context bolted
  on** — an assistant that paraphrases notes it never opened teaches the
  operator not to trust the mode.
- **`04 - Decisions` is invisible to the assistant**, including metadata.
  Contradiction detection is impossible until it isn't.
- **Decompose `LibraryPanel.tsx`** (~1400 lines) — worth doing alone, and the
  real prerequisite for anything richer in Research mode.
- **Writing `next_step` from the UI.** Booked deliberately as its own session:
  it is the first exercise of the modify-existing-lines tier on a file Olympus
  did not author, so it needs a `WriteIntent` arm and `COPY` wording done
  properly rather than tucked into an empty state. The argument for it is the
  colon hazard above — a field that serialises YAML correctly is safer than
  hand-editing frontmatter and losing a key silently.

The **Research mode category sidebar** is a fixed taxonomy where four of five
categories are empty and the fifth holds everything. A taxonomy chosen now will
be wrong in a year; if entries keep landing in General Reference, that is the
schema saying it guessed wrong. Revisit once there are enough entries to see the
real shape.

One detail worth keeping from the earlier version of this list: `04 - Decisions`
is absent from **both** `STABLE_NOTES` and the Pantheon index, so nothing can be
told that a new source undercuts an April decision if the decisions cannot be
seen at all.

**The background image has to be replaced, and repositioning cannot fix it.**

`src/assets/Olympus background asset.png` contains its own rendered interface:
holographic panels with a circular dial and an "ANALYTICS" chart on the left,
two more panels on the right, a ghosted OLYMPUS wordmark on a banner near
centre, and — the real problem — the city is built from large concentric
circular platforms across the full width. Those are rings competing with the
instrument's ring, and one of them sits directly behind the omega.

**Shifting `background-position` does nothing.** The image is 1672×941, exactly
16:9; the background layer at a maximised window is 1968×959. Under `cover` the
image scales to width and the horizontal slack is **0px**. This was verified by
setting it to 88% and looking: the left panels are unchanged. A directional
vignette was also considered and rejected — it addresses the left third and none
of the rest, and darkening enough to hide the rest means having no image at all.

What a replacement needs: no rendered screens, glass panels or HUD elements; no
text or logotype; nothing strongly circular near centre; detail in the outer
thirds with a calm middle where the omega sits; and dark enough that the 0.78
veil is not doing the work. Landscape, atmosphere, architecture without
interface.

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
- ~~The Pantheon scan re-reads every research file every 60 seconds.~~ Fixed in
  `4c8e5c2`: 300s, and the Rust scan holds a path→(mtime, entry) cache, so a scan
  finding nothing new reads no file bodies at all. This mattered because the scan
  now runs in **every** mode rather than only where the library panel was
  mounted — see the polling note under Constraints.
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
- **`.topbar` sets `min-height: 140px`, and `.olympus-header` carries both
  classes.** A `height` alone will not shrink the band — min-height wins. This
  cost a debugging pass; `.olympus-header` now sets `min-height` too.
- **A poll that feeds the instrument must be subscribed at `App`, not inside a
  panel.** `useActionQueue` and `usePantheon` are shared stores whose interval
  starts with the first subscriber; `App` subscribes so they run in every mode.
  Move that subscription back into a panel and the instrument's dots go dark in
  Command — which reads as a dead scan rather than as an unmounted component.
  Anything given a dot has to poll everywhere the dot is shown.
- **The status rail is handed a budget and must never measure its own
  container.** Its grid track is `auto`, so the container is sized *by* the rail;
  observing it makes the budget depend on the decision the budget exists to make.
  `HeaderBar` computes it. And the off-layout measure copies need
  `width: max-content`, or every candidate reports the widest sibling's width and
  the mechanism becomes decorative while still appearing to work.
- **The instrument's ring is a fixed size on purpose.** Scaling it to fit a long
  sentence either scales the arc strokes back under the readable floor or holds
  them and shifts the visual ratios. The sentence clamps; the dial does not move.
- **The next-action sentence must not use `--font-display`.** Cinzel renders it
  as serif capitals — a wordmark treatment that is unreadable as prose at four
  or five lines.
- **Neither status panel tolerates anything floating over its top-right.**
  Markets and Weather both put actions there, so an absolutely positioned control
  in that corner lands on a real button and eats the click.
- **Verifying UI in Chrome needs the window visible and un-maximized.** A hidden
  or background tab has `requestAnimationFrame` throttled to zero, so every
  `motion` animation freezes mid-fade and reads exactly like a broken component.
  Chrome also ignores `resize` on a maximized window, which silently defeats the
  narrow-width check. Confirm `document.visibilityState === "visible"` first.
- Rust tests pass (**145** as of `4c8e5c2`); keep them passing. No frontend test
  infrastructure exists — do not stand one up without being asked. A pure
  frontend function can still be checked by bundling it to a scratch directory
  and running it under node, which adds nothing to the repo.
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
