# Olympus — Planning Handoff

Originally written 2026-07-27 at `1af8092`, then vision-synced on the isolated
`codex/vision-foundation` branch. **For planning, not for coding.** Read
`OLYMPUS-MANUAL.md` first; it is now the canonical product and operating policy.

> **Currency.** This header claimed `fe849ee` for three rounds while the body was
> being rewritten as far ahead as `ba129d4` — stale in two directions at once,
> which is worse than stale in one, because the *body* was ahead of the header
> and a reader trusting the header would have discarded correct content as old.
> **Do not restate a commit here. Run `git log -1 -- docs/HANDOFF.md`** — that is
> the only currency claim that cannot rot.

## 2026-07-29 reconciliation against HEAD

This document had drifted three commits behind `master`. What follows is the
reconciliation; the sections below it have been corrected in place.

**[V] Repository state.** Working tree clean, no stash, nothing uncommitted.
`origin/master` equals local `master` at `fe849ee` **after a real `git fetch`** —
`fe849ee` is pushed, not pending. Six stale local branches remain
(`agent/*`, `claude/*`, `codex/vision-foundation`); all are merged or superseded.

**[V] Three commits shipped that this document did not mention at all:**

| Commit | What |
|---|---|
| `2f0030f` | Day arc work ticks made unmistakable — ticks now cross the track at ±9 units and no longer share the elapsed arc's amber |
| `b5993a4` | The deterministic Command project ring: `services/projectRing.ts`, `ProjectRing.tsx`, a 371-line asserting harness, `vault_graph.rs` reworked, instrument scaled to the centre column |
| `fe849ee` | Pantheon category routing — an explicit category tag now overrides inferred scoring, and `pantheonEntryToResearchRecord` moved out of `LibraryPanel.tsx` into a testable `pantheonRecord.ts` |

**[V] The launcher commit hash in this document was wrong.** It named `4683208`,
which exists in no branch. The launcher shipped to `master` as `62a2cc2`.

**[V] The delegation-foundation section described a branch, not history.** The
work is on `master` as `2a252bf`; `agent/briefing-delegation-foundation` is now
redundant.

**[V] Test counts moved.** Rust is **165 passing, 0 failed** (was 150, then 161).
`npm run build` passes. Both frontend harnesses were **executed, not merely
read** — see section 6 for the headless method that made that possible.

**[V] The instrument scale-up landed, and it has no scale factor.** The dial is
`min(calc(100vh - 206px), calc(100vw - 560px))` square with the 440-unit viewBox
stretched to fill it, so the factor is viewport-derived and height-bound:
≈1.35× at the 1280×800 minimum, **≈1.71× at the 1440×960 default** (440 → ~754
units), ≈1.99× at 1920×1080, ≈2.81× at 2560×1440. Labels, the day-arc ticks, the
now-marker, and the readouts divide their size by the measured `renderScale`, so
they hold a constant on-screen size — 10px labels stay 10px at every window size.

**[V]** Verified arithmetically from the real CSS expression and the real
`tauri.conf.json` bounds. **[A]** Those figures treat the configured window size
as the viewport; window decorations make the true viewport slightly shorter, so
read them as close estimates. The exact live value is on the SVG as
`data-render-scale` — read that rather than recomputing.

**[V] Two things the design record claimed that the code does not do.** The tier
arcs are gone — see section 2. And orphan notes left the instrument without
arriving anywhere: no component renders them, and `.vault-graph__node--orphan`
is now dead CSS.

**[V] `src/components/panels/VaultGraph.tsx` is dead code.** `ProjectRing`
replaced it inside `CommandInstrument` at `b5993a4`, but the file was never
deleted and nothing imports it. Roughly 55 lines of `.vault-graph__*` CSS are
dead with it. It still compiles, so no build catches this.

**[V] The two unmet-premise claims in section 5 are now verified, not assumed.**
`vault_context.rs:36` and its index builder say "titles and metadata only — the
bodies are not included here" in as many words, and `STABLE_NOTES` contains only
the operator profile, charter, skill index, and agent index. `04 - Decisions` is
absent. Both premises hold and have been upgraded from **[A]** to **[V]**.

## 2026-07-27 vision sync

The operator resolved several questions and rejected several inherited product
claims later in this document:

- Olympus is a private, single-operator command station and AI thinking partner.
- Command is the ambient, across-the-room mode: the full omega instrument, one
  active-project next-action sentence, quiet tier counts, and right-column chat.
  Cards, lists, and scroll containers in its centre column are mode drift.
- The multi-project briefing and its grounded active/optional session paths live
  in Project mode, with the primary active path as the hero and other paths as
  secondary cards.
- The mode labels are surfaces, not prescribed verbs. Command is ambient and
  ready; Projects briefs and holds the whole portfolio; Research organizes and
  queries the library.
- Pantheon is a reference library and optional curriculum. Presence is not
  endorsement and does not silently become an assistant instruction.
- Project visions are living hypotheses with review dates. A better conflicting
  direction is surfaced before work begins.
- Operator commitments, Olympus recommendations, and attention items are
  separate kinds of truth.
- The priority order is trustworthy briefings, coding-agent delegation, curated
  memory, proactive warnings, the full constellation, then push-to-talk voice.

The implementation branch adds the multi-project briefing, living vision fields,
prompt policy, canonical manual and adapters, and corresponding vault-memory
updates. The original pass placed the briefing in Command and shrank the
instrument; the operator rejected that reversal of the mode boundary. The
briefing now lives in Project mode and Command's instrument-first layout is
restored. After the correction, TypeScript and the production frontend build
pass. Browser verification at 1280 × 720 found a 440px Command instrument, a
56px next-action sentence, quiet 12px counts, and no centre-column cards, lists,
or scroll containers. Project mode rendered the active hero, one optional
watching path, all three truth labels, and working project focus. Human judgment
of the live Tauri window remains distinct evidence.

## 2026-07-28 stable Windows launcher

Commit `62a2cc2` adds the supported local release workflow. (An earlier revision
of this document named `4683208`, a hash that exists in no branch.) `npm run
install:local` now requires a clean checkout, builds the MSI, installs the
versioned release into `C:\Program Files\Project Olympus`, and repairs an
existing taskbar shortcut so it targets that stable installed executable rather
than Cargo's disposable development output.

**[V]** Version 0.1.1 was built and installed at the time this was written; the
workflow has since been used again — **[V]** the installed executable is now
**0.2.0, built 2026-07-29 17:50**, which carries code through `fe849ee`. Both the
Start menu shortcut and the existing taskbar shortcut target
`C:\Program Files\Project Olympus\project-olympus.exe`. Launching through the
repaired taskbar shortcut started that exact executable. Future development
builds can therefore replace their own artifacts without invalidating the
operator's pinned launcher.

## 2026-07-28 briefing trust and delegation foundation

Landed on `master` as `2a252bf`. (An earlier revision of this document described
it as living on the `agent/briefing-delegation-foundation` branch; that branch is
now redundant.) It closes three briefing trust gaps and implements the first
Claude Code pilot boundary:

- **[V]** `operator_sessions` persists one idempotent desktop-launch boundary.
  Project mode now says exactly which prior Olympus launch its change list uses,
  or states that no prior session exists.
- **[V]** project scans read commits across all refs and enumerate linked
  worktrees with branch, head, last commit, and uncommitted file count.
  Temporary tests proved both a dirty linked worktree and a commit on its branch
  are visible from the primary repository.
- **[V]** every successful Olympus vault writer, including attachments and the
  Pantheon migration, routes through an exact-file Git commit. Temporary-index
  tests prove unrelated staged and untracked files are excluded and preserved.
- **[V]** Claude Code 2.1.220 is registered through a backend-owned executable
  path. The pilot creates a recorded `olympus/run-*` branch and app-data
  worktree, plans read-only, waits for a second approval, then resumes the same
  session with bounded edit/test tools. Progress, cancellation, restart
  recovery, changed files, and diff review are durable; push, merge, deploy, and
  cleanup are absent by design.

**[V]** The frontend production build passes and 161 Rust tests pass. The live
development app created real `operator_sessions`, `delegation_runs`, and
`delegation_events` tables. **[A]** A paid Claude run has not yet been approved
through the new Project-mode button, so the full planning → waiting → editing →
testing → complete runtime sequence is not yet acceptance evidence.

## 2026-07-30 — the model readout, and the counts line coming out

**[V] The counts line is gone and `projectTiers.ts` is deleted with it.** The
line was the last consumer of the module, and the rest of the module had already
rotted: `TIER_WEIGHT` was exported and imported by nothing, and its values had
drifted out of agreement with the CSS that actually draws the strokes —
`scaffold: 6` against `stroke-width: 5`. A constant nothing reads cannot be
wrong loudly, so it was wrong quietly.

**Why the tier legend did not survive anywhere.** The counts named the tier
vocabulary, but the hover readout already names a project's tier *beside its own
name* (`ProjectRing.tsx:67`, `OLYMPUS · ACTIVE`) — which attaches the word to the
thing rather than to an aggregate. The aggregate itself is readable off the ring:
eight segments, tier carried by stroke weight and colour. Project mode owns the
portfolio list, which is where a count belongs. **Do not reinstate it as a
smaller legend** — that reintroduces the coupling that just produced a dead
module.

**[V] The model readout replaces it, and reads the response rather than the
request.** `AssistantReply.model` (`assistant.rs:392`) carries what the API said
answered; it reached the frontend typed and was **discarded** at
`useDashboardData.ts` where only `reply.content` was taken. It is now captured
into session state and rendered in the freed position.

**This distinction is the whole point of the field.** The request carries
`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta header
(`assistant.rs:12, 332, 344`), so Anthropic may serve a model other than the
`MODEL` constant. Reading the constant would name the model *asked for* while
displaying it as the model that *answered* — wrong only in the case the readout
exists to catch, and wrong invisibly. **Nothing renders before the first reply of
a session**, for the same reason: naming a model that has not spoken is the same
error in a smaller form.

**[V] The chat thinking indicator was already built** (`ChatPanel.tsx:138-142`),
in the thread where the response lands, with errors in the same place. It and the
omega both read `chatPending`, so they cannot disagree. **Cancellation is
deliberately unhandled** — no cancel affordance exists anywhere, so it is not a
reachable state, and defending it would be untestable code. The requirement is
recorded at the `finally` block instead: a cancel button must clear `chatPending`
on that same path, or it strands the indicator and the glyph together.

**[V] `assertSubRowsAreLegible(15, …)` added, after confirming the drop
assertion is live rather than merely green.** The harness covered 6, 14 and 28,
so the first count past the ceiling was covered only by inference. Swept 14→40
headlessly through the real module: every count positions its whole band at two
rows, nothing is dropped. The assertion was confirmed capable of failing by
starving the input — 4 nodes positioned against a claimed 28.

> **One methodology note worth more than the result.** The first sweep reported
> **zero** nodes positioned at every count, which read as a catastrophic bug. It
> was the fixture: the harness's `project()` helper supplies a `notePath`, the
> anchor joins on it, and a reconstruction that omits it positions nothing while
> throwing no error. **A hand-rebuilt fixture that silently produces an empty
> result looks exactly like the code being broken.** Mirror the harness's own
> fixture, or export it — do not retype it.

## 2026-07-30 — the chat streams, and speaking is reachable

**[V] Verified against the live API, not the reference.** Three real turns were
run through the exact payload `assistant.rs` sends. Two findings the reference
alone would have got wrong:

**1. At `display: "omitted"` a thinking block emits `signature_delta`, not
`thinking_delta`.** No `thinking_delta` arrives at all. A test written from the
reference would have asserted the exclusion of an event this configuration never
sends — green, and covering nothing. Both are now covered.

**2. A trivial prompt skips the thinking block entirely**, going
`message_start → content_block_start/text`. The speaking signal has to be right
in both shapes. Observed sequences:

```
one word:     message_start → content_block_start/text → ping → text_delta ×1  → …
one sentence: message_start → content_block_start/thinking → ping → signature_delta
              → content_block_stop → content_block_start/text → text_delta ×4  → …
```

**The speaking signal is the first `text_delta`.** Not `message_start` (fires
before any text exists) and not `content_block_start` (a thinking block opens
first). Deriving it from either collapses thinking and speaking into one state.

### [V] The speaking-window distribution — and the flash is real

Measured first `text_delta` → `message_stop`:

| reply | chars | thinking window | **speaking window** |
|---|---|---|---|
| one word | 5 | 2752ms | **20ms** |
| one sentence | 342 | 1250ms | 1046ms |
| three paragraphs | 2790 | 2027ms | 12585ms |

**20ms is not a flash, it is a state that never renders.** Below any perceptual
threshold and below a single frame at 50fps. A minimum-display floor is now
justified by numbers rather than impression — **but it is not built**, because
the operator asked to see the distribution first. This is it.

Note the shape: the *thinking* window barely moves (1.2–2.8s) while the speaking
window spans three orders of magnitude. Latency to first token is roughly
constant; everything after it scales with output length.

### What was decided, and why

- **Refusal and truncation append, never retract.** Text that streamed was
  produced and billed; removing it would leave the operator unable to tell a
  misread from a broken app. `AssistantNotice` rides *beside* `content` rather
  than being folded into it, and renders in monospace above its own rule — it is
  Olympus speaking about the turn, not the assistant. A refusal that produced
  **no** text still errors: there is nothing to preserve, so a notice would have
  nothing to sit beside.
- **The notice colour rule, which is a distinction and not decoration.** A
  refusal is **amber** — the same register the instrument uses for *something
  happened*, because a refusal is a boundary being reported, not a failure. A
  truncation is **muted slate**, because hitting a token ceiling is mechanical
  and must not read as a judgement about what was asked. Neither is error red;
  neither is assistant prose. A third notice kind needs a reason to sit in one of
  those two registers before it gets a third colour.
- **The speaking floor is 500ms, derived from the distribution rather than
  chosen.** It holds the *glyph* only — `planTurnRelease` returns `renderText`
  unconditionally true and the harness asserts that across every measured window,
  because "floor" is exactly the word that becomes a delay in front of the render
  if nobody pins it. The hold is a scheduled **clear**, never a scheduled entry,
  so it cannot strand a state *on*. A harness assertion fails if the floor is
  ever raised past 1046ms — the shortest real reply measured — since past that it
  stops covering the short case and starts delaying ordinary turns.
- **The model readout latches at first paint** and moves only on a real
  `fallback` block, which renders as `from → to` rather than swapping in place.
  A value that changes quietly is the invisible-wrongness the readout exists to
  prevent. **[A] The fallback path has never fired** — no run declined.
- **`thinking.display` stays `omitted`.** Surfacing reasoning is a separate
  product decision, it costs context, and the empty-thinking default is what
  produces a clean thinking phase.
- **No non-streaming fallback path.** Two paths means the contract test pins one
  and the other drifts — this project has four documented instances of exactly
  that. `MAX_TOKENS` is 8000, well under the ~16000 where non-streaming risks a
  timeout, so streaming buys observability, not reliability. Reverting it would
  be honest, not a regression.

### The contract test now pins the field set by equality

It asserted a denylist of known-rejected keys, which only catches fields someone
thought to name — a new top-level field would have slipped in unpinned. It now
compares the serialized key set exactly. **[V] It caught its own author within a
minute**: the first expected list omitted `model` and the test failed.

**Prompt caching is untouched.** Caching is a prefix match over rendered `system`
and `messages`; `stream` is a transport flag outside that prefix. The
stable/volatile split and its breakpoint are unchanged, and the existing
breakpoint tests still pass.

**[V] Rust 172 tests pass** (was 165). `npm run build` passes. **[A] Nobody has
watched the omega speak** — that needs a chat message sent in the running app.

## How to read the claims in this document

Every factual claim is tagged:

- **[V]** — verified this session: a command was run, a test executed, a value
  read out of the live DOM or database, or the code read directly.
- **[A]** — assumed: believed to be true, carried from an earlier session, or
  inferred from code not re-read. **Treat as unconfirmed.**

The previous handoff carried "the app only reads from the vault" as settled
fact. It was false, had been since April, and survived because nothing separated
what had been checked from what had been believed. That is why this tagging
exists. If a decision depends on an **[A]**, verify it first.

---

# 1 · State

## Shipped and confirmed working

| Commit | What | Evidence |
|---|---|---|
| `6a70f3a` `55e11f8` | Pantheon capture schema — stance, why_kept, origin, written_by; migration run against the real vault | **[A]** verified in an earlier session, not re-checked here |
| `4e8f04c` | Header restructure — three zones, three modes, status rail, omega | **[V]** geometry and mode switching read from live DOM |
| `dd84593` | Action Queue dissolved into per-project task attribution | **[V]** 13 checks against real vault data: 17 tasks, 10 attributed, 7 surfaced |
| `20a81f8` | Capture form — body field moved to second, Save states its blocker | **[V]** field order and all three button states read from live DOM |
| `b210698` | Status rail budget and unit-dropping | **[V]** candidates measured at 610/530/403/269/201; ladder fired live at 900px |
| `b03788f` `4c8e5c2` | Command mode as the omega instrument | **[V]** structure, arc geometry, stroke ramp read from live DOM |
| `3d16d42` | Write-event log, commit history, vault link index | **[V]** graph built against real vault; commit parser asserts non-empty |
| `0a6708e` | Day arc; reduced-motion source-order fix | **[V]** 19 geometry checks; OS setting toggled for real |
| `16f9280` | Graph gate fix, background reframe, tick-parser test | **[V]** gate confirmed closed at `connectedProjects=1` |
| `62a2cc2` | Stable Windows launcher and local release workflow | **[V]** 0.1.1 installed; repaired taskbar shortcut launched it |
| `2a252bf` | Session boundary, all-refs commit scan, worktree enumeration, exact-file vault commits, Claude Code pilot boundary | **[V]** Rust tests pin the worktree and exact-file-commit behaviour and pass |
| `2f0030f` | Day arc work ticks cross the track and drop the elapsed-arc amber | **[V]** code read; **[A]** never seen drawing real ticks |
| `b5993a4` | Deterministic labelled project ring; instrument scaled to the centre column with counter-scaled annotation | **[V]** 371-line harness executed, passes; scale factors computed from the real CSS |
| `fe849ee` | Pantheon category routing — explicit tag beats inferred score | **[V]** harness executed, passes: inferred → `agent-systems`, tagged → `agent-systems` with distinct rationale, unrelated → `research-references` |

**[V]** Rust: **165 tests pass, 0 failed** (`cargo test --lib`, this session).
**[V]** `npm run build` passes. **[V]** Both frontend harnesses executed and pass.

**[V] `tauri build` now succeeds** — producing installable bundles beneath the
configured Cargo target directory. **[V] Version 0.2.0, built 2026-07-29 17:50, is
what is installed** at `C:\Program Files\Project Olympus`, and the repaired taskbar
shortcut launches that stable installed executable. Pinning the Cargo development
binary is unsupported because rebuilds replace it.

**The installed build lags `master`, and by design.** Read its timestamp against
`git log` before concluding a change is or is not in the app — the 17:50 build
carries code through `fe849ee` and nothing after it.

> **[V] This trap fired on 2026-07-30 and cost a full round of verdicts.** The
> operator judged the instrument through the taskbar shortcut and reported that
> the segment hit target "has never fired," that the idle breath was too faint,
> and that the readout was missing. All three were judged against a binary built
> at **2026-07-29 17:50:18** — and the hit target shipped at `fb66834`,
> **22:36:49 the same evening**, four hours and forty-seven minutes later. The
> centre readout (`1832549`) and the dim-and-feet fix (`6699df2`) fell in the
> same gap. Nothing was broken; the fixes were simply not in the executable.
>
> **Before acting on any visual judgment, reconcile the two:**
>
> ```powershell
> (Get-Item 'C:\Program Files\Project Olympus\project-olympus.exe').LastWriteTime
> git log -1 --format='%ci %h %s'
> ```
>
> If the binary is older than the commit that shipped the thing being judged, the
> judgment is about different code. This is the same class of error as the
> handoff header above: a stale artifact that carries no marker saying it is
> stale. **A `tauri dev` window is the one surface guaranteed to be current** —
> and note that hot reload does not add Rust commands, so a Rust change still
> needs a restart even there.

**[V] Reduced motion works, verified against the real OS setting** — toggled via
`SystemParametersInfo`, all animations confirmed `none`, everything still
present and clickable, **setting restored to its original value (`1`)**.

## Shipped but never verified at runtime — named gaps

- **[V] The write pulse has never fired, and an agent cannot fire it.** Approving
  a gated write needs a click in the Tauri window. The app is only observable
  through Chrome against the dev server, where `invoke` does not exist, and agent
  file writes go straight to disk and bypass the gate entirely. **Pantheon → Add
  Entry closes this**, exercising the omega pulse and the first write tick
  together.
- ~~**The day arc has never drawn real ticks.**~~ **Closed. [V]** It draws them, and
  they are correct. A cluster the operator suspected was a rendering artifact was
  checked against real commit times: four commits between 19:09 and 20:36 land at
  287.4°, 293.1°, 296.5° and 309.0° — the 9-to-10 o'clock region — with the tightest
  pair 3.37° apart, which is 12 units at the 205-unit day radius. **A working session
  genuinely looks like a tight cluster.** The "detached marker above" was the
  now-marker at 342.5° sitting on two commits 1.85° apart. Nothing to fix.
- **[V] The day arc previously had never drawn real ticks.** The data is proven — 5 commits
  in 24h with valid timestamps, and the tick *styles* were confirmed by injecting
  sample geometry — but the browser cannot render real data, and nobody has
  looked at the desktop app. `2f0030f` then changed what a tick looks like: it
  crosses the track at ±9 counter-scaled units and no longer uses the elapsed
  arc's amber, because a correct 12-unit hairline in that amber was
  indistinguishable from the ring it annotated. **[A] Still unseen.**
- **[V] The scaled instrument has never been looked at.** `b5993a4` takes it from
  a fixed 440px to roughly 1.7× that at the default window. Nobody has judged
  whether the labels hold at that size, whether cross-project edges read as
  texture or clutter, or whether the counts still sit right beneath a ring that
  large.
- **[V] Two judgment calls are explicitly waiting on the operator's eyes**, and
  cannot be settled by measurement: whether the empty-wedge mark at **0.18 opacity**
  is the right visual weight, and whether the **abbreviated centre readout** reads
  as sufficient at the budgets the disc allows. Both were built and asserted; only
  their weight is unjudged.
- **[V] The Chrome extension was unavailable for two consecutive sessions.**
  `list_connected_browsers` returned an empty list, so no agent-side workaround
  exists — see section 6 for what to try and what to do instead.
- ~~`processing_logs` contains zero `vault-write` rows.~~ **Closed.** The
  operator approved a gated write and watched the white tick land on the day arc.
  The note it wrote, `02 - Research/2026-07-27 AI test.md`, is now visible on the
  graph's orphan rim — it links to nothing, which is correct.
- ~~There is no graph renderer.~~ **Built.** See section 2 for what it does and
  the gate it draws behind.
- **[V] The write pulse's second expansion has still not been seen.** Both
  omegas were fixed at `7cc6b28` — each pulse window now matches its own ripple
  times its play count — but confirming *both* plays render needs a visible
  window, which an agent cannot get.
- **[V] `App.tsx` still holds `enterTier`, and nothing calls it.** It is the only
  caller of `setTierFilter`, so `tierFilter` can never become non-null and
  `ProjectsPanel`'s tier-filter chip is unreachable. Left in place rather than
  removed: restoring click-to-filter on the ring segments is a live option, and
  this is the wiring it would use. **Delete both, or reconnect them — do not
  leave it a third round.**
- **[A]** `save_attachment_to_vault` has never successfully run;
  `02 - Research/_attachments/` does not exist.
- **[A]** `open_vault_note` compiles and is registered; nobody has clicked the
  empty-state prompt and watched Obsidian open.
- **[A]** The write gate's divergence-under-append branch.
- ~~Whether the built executable launches is untested.~~ **Closed. [V]** The
  installed 0.1.1 executable launched successfully through the repaired taskbar
  shortcut.

---

# 2 · Design decisions, and why

**This section matters more than the code.** A fresh session will unpick these
without the reasoning. Each is the operator's decision, recorded as reasoning
rather than conclusion because a conclusion alone invites reversal.

### The three modes are distinct surfaces, not prescribed verbs

Command is the ambient instrument and conversation surface. Projects is the
readable briefing and full portfolio. Research is the organized, queryable
library. Each needs a clear purpose, but “think / execute / know” is not a
product constraint.

### The library is a reference library and optional curriculum

The operator adds a source because it may be useful. Presence does not mean
agreement and does not require Olympus to consult or cite it in ordinary work.
Sources may yield candidate lessons, but only deliberate operator-approved
guidance should change the system's operating behavior.

### The assistant should be a cooperative adversary

Rare, cited pushback — not constant objection, and not agreement. This is the
entire reason `stance` and `origin` exist. **Without them, presence in the vault
reads as endorsement and the assistant drifts toward agreeing with the
operator.** `stance` degrades to `unevaluated`, never to `endorsed`; that is the
one direction it must not fail in, and a test pins it. `origin` distinguishes
sources pre-filtered by his taste from ones Olympus found *because* they cut
against the library.

#### The concrete case, 2026-07-29 — no longer hypothetical

**[V] What happened.** The operator added four graph-engineering articles and two
attachments to `02 - Research` on 2026-07-29 (`2e88142`, `8f1fed2`, `9e2e098`,
`6077b63`, `0eddd80`, `421c131`). He added them **for consideration, now and
later** — the library working exactly as intended. In the same session, a proposed
five-milestone roadmap came back with milestones 3 and 4 being a fan-out work
graph with parallel nodes, concurrency budgets, retries and adversarial review —
**in the articles' own vocabulary, with nothing marking it as a source being
weighed rather than a conclusion reached.**

That is the guard in this section failing in production: *adding an article to the
library must never silently rewrite how Olympus operates.* It did, inside a single
document.

**[V] And the fields were set correctly.** All four notes carry
`stance: unevaluated`, `origin: collected`, `written_by: Codex`, and a factual
`why_kept`. Nothing was mislabelled. **The failure is downstream of capture:
nothing carries a source's stance into the artifacts derived from it.** A roadmap,
a brief, or a recommendation traceable to an `unevaluated` source inherits none of
that qualification, so a weighed source and a settled decision arrive looking
identical.

Two consequences worth holding onto:

- **`stance` and `origin` are necessary and not sufficient.** They make the
  library honest about itself. They do nothing about derived work. Provenance on
  retrieved facts — already an item in the memory loop — is what closes this, and
  this incident is the reason it is not cosmetic.
- **It was not the assistant that drifted.** **[V]** The assistant cannot read
  those bodies at all (section 5). The drift happened in an agent reading the
  articles directly, with the frontmatter available and unused. So this is not a
  prompt problem to be fixed in `assistant.rs`; it is a discipline that has to
  hold wherever a source becomes a proposal, agents included.

### Command mode is the ambient instrument

Command should read from across the room: one full-size omega instrument, quiet
tier counts, and right-column chat. The ring, the project constellation, and the
day arc are the content—not supporting decoration. Cards, lists, and scrolling
project detail belong in Project mode.

The design failure that established this boundary was structural: adding a
multi-project briefing forced the omega to shrink. Once a centre-column panel
needs the instrument's space, the instrument becomes decoration by default even
if the copy still calls it primary. **The omega stays full size and centred; it
is the subject of Command mode, not a widget.** Two prior revisions shrank it to
make room for other content. A proposal that needs centre-column space belongs
in Project mode.

**The next-action sentence was removed, deliberately.** Earlier revisions of this
document listed it as part of Command's layout; the operator took it out because
he is rethinking how next steps get represented. **Do not add it back.** The
space it freed went to the instrument, not to new content.

### The omega ring is an instrument, not decoration

**[V] Rewritten at `b5993a4`. Outer arcs are projects, not tiers.** One segment
per project, **equal widths**, ordered by stable code-point comparison on
`project.id`. Tier is carried by stroke weight and colour **only, never by
geometry**, so a status change cannot move anything on the ring — the harness
pins exactly that, re-laying out a reversed list with one project's status
changed and asserting every start, mid, and end angle is identical. Clicking a
segment opens that project in Project mode.

This replaced the previous design, in which arc length was tier *count*. That
version is gone: `onSelectTier` no longer reaches the instrument. The earlier
finding still stands and still constrains the ramp — **[V]** four stroke weights
alone are not separable at this size (the scaffold-to-unclassified step was 1px
on a 500px ring), which is why status uses two correlated channels and a 5px
floor.

Two constants worth knowing before touching it. `SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD`
is 42 measured units; **[V]** N=20 sits at 43.98 and N=30 at 28.85, so the flag
fires between them. The flag is live and assertable but draws nothing — the zoom
behaviour is deliberately unimplemented, so there is no hidden visual change at
the threshold.

### Hop 1 cannot move outward, and the reason is the label's footprint

**[V] This was tested directly, because the obvious reading is wrong.** Hop 1 sat
at 0.582 of the dial radius and looked pinned there by the label lane, which
implied that moving labels tight to the stroke would free room to spread the note
bands. It does not. It frees about one unit.

The binding constraint is not the label's *radius* — it is the label's
*footprint*. Label boxes are axis-aligned, and a project with a single linked note
puts that note on the wedge's own bearing, directly beneath its own label. At a
bearing 22.5° off horizontal, a 7-character label's half-width (18.5 units) exceeds
the x-component of a 12-unit radial separation, so the node lands *inside* the box
while being 12 units further in. **[V]** Separation there depends on box half-width
and half-height, not radial distance: the largest hop 1 that keeps a single-child
wedge clear at the reference scale is about 129. **The previous 128 was already at
that limit. That is why it was 128.**

**[V] The harness caught this, twice, on assertions written before the change** —
first at 1:1 and then in a fully populated target state. Neither was findable by
reading the code, and both would have shipped as a visible overlap.

So the span for note bands is fixed at roughly 128 → 87, and the only real choice
is how many bands to cut it into:

| bands | step | collapses at |
|---|---|---|
| three | **20.5 units** | depth 3 |
| four | 13.7 units | depth 4 |

**Three is what shipped.** **[V]** The vault's deepest chain is depth 2 across 43
real nodes, so a fourth band encodes a depth that does not occur, at the cost of
compressing the two that do — and 13.7 units is thinner than the 12-unit step that
made depth unreadable in the first place. `HOP_CLAMP_DEPTH` is one line if the
vault starts growing chains.

What actually improved: depth 2 → 3 went from **12 units to 20.5**, and the silent
collapse of every depth at or beyond 3 onto one radius is now a *declared* clamp
with a test pinning both that the bands are distinct and that the clamp fires
exactly where it is documented. **[V]** Nothing previously asserted the bands were
distinct, which is why the collapse was invisible.

### Depth failed to read because of angular density, not radial spacing

**[V] Judged in the running app, and the diagnosis inverted the fix.** After the
bands were respaced to a uniform 20.5 units, depth still did not read. The cause was
not the radial step: Olympus's 14 depth-1 notes sit **6.7 units apart in a 42° wedge
while a node can be 7.58 units across**, so they touch and the band renders as a
continuous stroke of dots. **A solid arc above a sparse scatter cannot read as
parent-and-child at any radial separation.** Widening the step could never have
fixed it, and the band count was never the variable.

**Sub-rows.** When a band's measured spacing drops below `1.65 × max node diameter`,
it splits into radially staggered rows and nodes alternate, so same-row neighbours
are two angular slots apart. **[V]** The real Olympus band goes from 6.7 units to
12.65 — about 21.6px at the default scale, where dots become countable again.

Five things about it that are load-bearing:

- **Sub-rows are the same hop and must never imply otherwise.** The offset is 7.19
  units against a 20.5-unit step — **0.35 of a hop**, asserted to stay under half.
  It reads as band thickness.
- **Rows step inward, except the innermost band, which steps outward.** Inward keeps
  the band's outer edge at its nominal radius, which is what protects the label
  clearance above hop 1. The clamp band is bounded below by the glyph disc, so it
  steps the other way rather than putting notes on the Ω.
- **[V] The trigger measures the gap at the innermost row, not at the band radius.**
  This was wrong on the first attempt — rows step inward, the same angle spans less
  arc there, and the inner row landed below its own minimum. The harness caught it.
- **[V] Two rows is the ceiling, derived not chosen.** The span is fixed at 0.35 of a
  step, so the offset shrinks as rows are added. At three rows and 21 notes,
  cross-row neighbours sit `hypot(4.2, 3.59) = 5.5` apart against a 7.58-unit
  diameter — overlapping. Making three rows work needs a span of 0.61 of a hop,
  where the stagger reads as depth. **Three rows are not available.**
- **[V] Capacity is about 14 notes in a 42° wedge** — exactly today's band, and more
  in a wider wedge since capacity scales with arc. **Beyond that, reach for cap +
  overflow: the threshold is 15 at eight projects.** Two rejected alternatives, with
  reasons: an overflow cap at this library size hides 6 of 21 notes, the wrong trade;
  and sizing by degree leaves nodes nearly touching, so the line quality survives
  while low-degree notes get harder to click.

**[V]** Beyond capacity the layout degrades by crowding, never by leaving the band —
pinned by a 28-node stress case asserting containment and label clearance rather
than spacing.

**[V] The capacity curve, and where overflow actually becomes necessary:**

| notes | spacing | reads as |
|---|---|---|
| 14 | 12.65 | meets the minimum — **today's Olympus band, exactly at the ceiling** |
| 15 | 11.81 | below the minimum, still clearly separated |
| 21 | 8.44 | separated but tight |
| 24+ | < 7.58 | **touching again — the stroke returns** |

**The threshold for reaching after cap-and-overflow is 24, not 15.** Between 15 and
23 the band is under the comfortable minimum but the dots are still discrete.
**[V] Nothing is ever dropped at any count** — every reachable note is positioned, so
the band degrades by visible crowding rather than by silently hiding a note. A test
pins that.

**Olympus is at the ceiling on the first wedge that filled.** The fifteenth linked
note takes it below the declared minimum. That is not a failure, but it is the point
at which the next design decision is due.

### The spacing minimum and the row cap are independent

They were briefly one tuned constant, which hid the trade. Separated:

- `MIN_NODE_SPACING_DIAMETERS` is **perceptual**. Reference points: 1.0 is touching,
  1.5 is where a row of dots stops reading as a dashed line, 1.75 is comfortably
  countable. **[V] 1.65 was confirmed by the operator judging the real band in the
  running app**, not chosen to make the arithmetic work.
- `MAX_SUB_ROWS` is **geometric**, and derived above.

**Raising the minimum would not change the picture.** At 1.75 the 14-note band would
ask for three rows, be refused by the cap, and render at 12.65 exactly as it does
now — the only difference is that the harness would stop calling it sufficient. **A
test pins the live band against whatever the minimum says**, so raising it fails
loudly instead of silently under-spacing the real vault.

### The omega has three presence states, and one of them cannot be reached yet

Idle, thinking, speaking. **[V] Only idle and thinking are reachable**, and the
reason is in section 5: `assistant.rs` calls `.send().await` and parses one complete
JSON body. There is no stream, so there is no moment at which text starts arriving —
built as specified, speaking would run for the whole request and stop when
everything landed at once, which reads as *working*, not speaking.

The speaking treatment and its envelope are built and asserted anyway, documented as
unreachable, so wiring it is one field once the chat streams. `glyphState.ts` takes
`{ pending, producing }`; `producing` is hardcoded false at the call site and
nothing else has to move.

**The reset mechanism is that there isn't one.** State is *derived* from the request
flags, never scheduled. No state is entered by a timer, so none can be stranded by
one — an error, a cancellation and a normal completion all clear `pending` and settle
to idle through the same transition.

**[V] The breath animates a dedicated element, not the glyph's filter.** A circle
with a radial gradient sits behind the glyph and animates `opacity` and `transform`,
both of which composite. Animating the glyph's own `drop-shadow` would re-raster the
filter every frame. Radius and opacity move together by construction rather than by
coordination. Duration and amplitude are CSS custom properties on `.omega-presence`,
so the later wake behaviour is a variable change.

**[V] Thinking circles at radius 79, and 84 was wrong.** The glyph's ink reaches
about 76 units from centre and the innermost note band's inner extent is 83.16, so an
arc at 84 crosses the depth-3 notes. 79 sits between them, inside the glyph clearance
disc — which is protected empty space, since cross-project edges are already clipped
out of it.

**Speaking and the write pulse cannot be confused, and they separate on *property*,
not just direction.** The pulse is a ring at radius 182 travelling outward past the
segment ring, and it owns `filter` plus its own element. Speaking is the glyph's
`transform`. **A vault write landing mid-response composes rather than conflicts**:
the glyph keeps scaling on its envelope while the glow spikes once and the ring goes
out. That is why the breath was given `opacity`/`transform` and the pulse left on
`filter`.

#### The transform trap is real, but the cause is not the one usually named

**[V] Measured in the webview, not recalled.** `transform-box` already defaults to
`view-box` — it is not missing and not the bug. **`transform-origin` defaults to
`0px 0px`**, and scaling the glyph without setting it moves the element **162px right
and 168px down**, straight out of frame. With `transform-box: fill-box` and
`transform-origin: center`: **zero drift**.

**[V] `motion` writes `transform-box: fill-box; transform-origin: 50% 50%` inline and
overrides anything set alongside it** — which happens to be exactly the pair that
makes an SVG scale in place. Measured at scale 1.12: zero drift, 21.4px of growth.
So `.omega-scale` deliberately declares neither. **Setting an origin there looks like
it works and does nothing**, which is worse than leaving it out.

**[V] The audit found no existing instance of this bug.** `.ring-outer`,
`.ring-middle` and `.ring-inner` already set `transformOrigin: "50px 50px"` inline in
`OmegaInstrument.tsx`, correct for their 100×100 viewBox. And **`.instrument-activity`
does not exist** — no rule, no element, anywhere. It went out with the polling dots
and the sweeping activity ring.

#### Reduced motion, verified against the real OS setting

**[V] Toggled `SPI_SETCLIENTAREAANIMATION` for real and restored it to its original
value of 1.** With the setting on: every animation count drops to zero, and the three
states stay distinguishable statically by glow alone — **0.72 idle, 0.5 thinking, 1.0
speaking**, with thinking also holding its dimmed glyph and a static arc. Hit targets
stay `auto`, labels and glyph stay visible.

**[V] One gap this caught.** Stopping the keyframes left the glyph's 420ms opacity
*transition* running between states, which is still motion. `.instrument-glyph` is now
in the `transition: none` group. Confirmed `none / 0s` afterwards. **Stopping
`animation` is not the same as stopping motion** — check transitions too.

#### The compositing worry does not apply here

**[V] The two `backdrop-filter` elements are spatially disjoint from the animation.**
The tools rail blurs at `x ≤ 60` and the chat panel at `x ≥ 1524`; the breathing glow
occupies `x 679–904`. No overlap, so the continuous animation never composites over a
blurred region. Three animations total on the page at rest.

**[A] Frame timing was not measured in Chrome.** `requestAnimationFrame` is throttled
to zero in a hidden tab — the trap already recorded in section 5 — and the tab sits
behind the Tauri window, so the sampling loop never resolved. Check
`document.visibilityState` before trying again.

### The label lane holds a constant gap in pixels, not in units

**[V] Measured mechanism of the detachment.** The label radius was in viewBox
units, so it scaled with the dial; the font is counter-scaled, so it did not.
Measured from the stroke's inner edge to the glyph top, the gap drifted from about
9.6px at 1.35× to 16.2px at 2.81× while the text stayed 10px. That is why labels
read as floating rather than belonging to a segment, and why it appeared only after
the scale-up.

The lane is now `ringInnerEdge − (5px + capHeight) / renderScale`, computed from the
**widest** stroke (11, active) so one formula is correct for every tier. **[V]** The
gap is exactly 12px at every scale from 0.75× to 4×, asserted.

Two consequences worth keeping:

- **`renderScale` is now an input to `layoutProjectRing`.** That closes the blind
  spot recorded earlier in this section: the collision test used to measure at the
  unscaled font size and never saw the scale, so it was merely conservative above
  1× and wrong below it. Collisions are now measured at the size labels are
  actually drawn.
- **There is one lane, not two.** The old fallback moved a colliding label 8 units
  further in, which is itself a form of floating. Collisions are resolved by
  shortening text, then by hiding non-persistent labels. **[V]** At N=20 all five
  active/watching labels still persist and stay distinguishable at every scale the
  window can reach; below that floor one drops rather than overlapping, and that
  degradation is pinned so it cannot get worse.

### Unpopulated wedges get a hollow mark

A wedge with no notes was indistinguishable from a wedge nobody had looked at.
Each project owns its territory whether or not it is currently populated, so
absence should be readable rather than inferred from a gap — the same category of
finding as the orphan rim.

One hollow dot per unpopulated wedge, at the hop-1 radius on the wedge's bearing,
stroke-only at 0.18 opacity, sized to match the smallest real note. It disappears
the moment a real node lands in that wedge, which is also what makes the landing
legible.

**Deliberately not a radial tick.** The day arc already owns radial marks, where
they mean "work happened at this time". Reusing that vocabulary for "nothing is
linked here" would be a category error. Filled means a note; hollow means territory
that exists and is empty.

Returned from the pure module as `emptyWedgeMarks` so it is assertable: **[V]**
seven marks against the real vault's one populated wedge, zero at target state, and
each on its own segment's exact bearing.

**[V] Opacity is 0.24, raised from 0.18 after looking.** At 0.18 the marks read only
if you already knew to look for them, so absence was still being inferred on a
natural glance. The faint-dotted-circle read was right; it needed to survive a
glance rather than a search.

**The interior is not empty space to fill.** Seven wedges hold nothing because seven
projects have no linked notes — that is the design working. Each project owns its
territory whether or not it is currently populated, and at target state every wedge
has a cluster and the interior fills naturally. **Do not redistribute space from
unpopulated wedges to populated ones, and do not spread one project's notes outside
its own wedge.** Both are pinned by assertions.

### The hover readout lives in the interior, beneath the omega

It used to render at a fixed radius near the bottom of the ring, where it overlaid
the ring stroke and whichever labels happened to be there — three layers of text in
one place regardless of which segment was hovered.

The interior around the glyph is the only region guaranteed clear of the segment
ring, the labels, the day arc, and every note band. It is also a fixed location, so
the eye learns where to look and nothing reflows per segment.

**The rejected alternative, recorded so it is not re-proposed:** placing the readout
radially just inside the hovered segment, replacing its label in place. Tightest
association, but **[V]** it lands in the label lane, whose clearance to hop-1 notes
at target state is 3.5 units at the smallest reachable scale — it would collide in
a populated wedge, and it reflows for every segment.

**The disc has a tight budget and the content is abbreviated to fit it.** The disc
narrows sharply toward the bottom, so each line's character budget is computed from
the geometry at the given scale rather than assumed, and a line that cannot fit is
**dropped rather than allowed to cross the disc** — containment outranks showing the
whole string. **[V]** Budgets are 26/22/16 characters at 1.35×, 35/31/26 at 1.71×,
and at 1:1 the third line drops entirely. Three lines: name + tier, then the task
count or `TASKS UNAVAILABLE`, then branch + commit. Never a false zero.

**[V] Two bugs in this were found by measuring the running app, and neither was
readable from the source.**

**The hovered segment dimmed with the rest.** `.project-ring.is-focused
.project-ring__segment` is **three** class selectors — (0,3,0) — not two. It
out-specifies `.project-ring__segment.is-hovered` at (0,2,0), so source order never
came into it: the dim rule won `opacity` while the hovered rule still won `stroke`.
The hovered arc changed colour and stayed dim. The comment in the CSS asserting
"equal specificity, so source order decides" was simply wrong. Fixed by restating
the hovered rule at (0,4,0). **[V] Verified in the app: hovered at 1, others at
0.16.**

**The readout sat on the glyph's feet.** **[V]** Canvas metrics report Cinzel's Ω
with `actualBoundingBoxDescent = 0.00` at 150px — its ink stops *exactly* on the
baseline. The layout placed the first line's **centre** one gap below the baseline,
which put its **top** 0.5 units above the ink. Measured at 51.53 units against a
baseline at 52. The offset now includes half a line, and a test asserts the line's
top rather than its centre clears the baseline. **[V] Verified in the app at 2.04
units of clearance.**

**Both are the same class of error**: reasoning about a box when the thing that
matters is the ink, and reasoning about specificity by counting the wrong things.
Neither harness could have caught either, because both live in CSS and font metrics.

**[V] The hit target was too small to find, and is now 40 units wide.** It was an
18-unit invisible arc stroke centred on the ring; the readout could not be triggered
reliably in the real window. It now spans 148–188 — the stroke at 168, the label lane
below it, and clear space above — stopping short of the day arc's innermost tick at
196. The label and the empty-wedge mark carry the same hover and click handlers, so
every visible part of a project's ring furniture selects it.

Hovering also dims the other segments and holds the hovered label at full opacity,
so the association is visual rather than inferred. **[V]** Reduced motion is already
covered — `.project-ring__segment`, `__label` and `__node` are all in the
`transition: none` block, so the change is instant, and the readout has no
transition so it still appears. **[A]** Verified by reading the CSS and confirming
the block is still last in the file (5010 of 5063), not by toggling the OS setting.

### Annotation counter-scales; geometry does not

**[V]** The instrument fills the centre column, and everything annotating it
divides its size by a measured `renderScale` so it holds a constant on-screen
size. `CommandInstrument` measures the dial with a `ResizeObserver` and exposes
the ratio as `data-render-scale` on the SVG, which is the handle to read in the
DOM.

~~**Trap.** `layoutProjectRing` runs its label-collision test at the *unscaled*
font size and never sees `renderScale`.~~ **Closed.** `renderScale` is now an
input and collisions are measured at the drawn size — see "The label lane holds a
constant gap in pixels" below.

**[V] `MIN_WINDOW_SCALE` is 1.35, and it is a real boundary, not a convenience.**
`tauri.conf.json` sets `minWidth: 1280` / `minHeight: 800`, and the dial is
`min(100vh − 206px, 100vw − 560px)` over a 440-unit viewBox, so the render scale
floors there. Geometry is asserted to *hold* at and above 1.35× and to *degrade
gracefully* below it. Two properties genuinely do not hold below the floor, and are
pinned as known limits rather than defended: one dense-ring label drops at N=20,
and label boxes crowd hop-1 notes in a fully populated ring. Both are reachable
only in the browser dev server. **Recorded so they are not rediscovered as bugs.**

### Orphan notes left the instrument and did not arrive anywhere

The decision was to move them out of Command and into Research mode. **[V]** The
first half shipped — `layoutProjectOwnedGraph` positions only notes reachable
from a project anchor, and the harness asserts an unlinked note produces zero
Command nodes. The second half did not: no component renders orphans, and
`.vault-graph__node--orphan` is dead CSS. **The eleven notes nothing links to are
currently invisible in the app.** That is a real finding being hidden, which is
the opposite of the rim's stated purpose.

### Explicitly rejected — and one of them is currently in the code

- **Dots as poll-freshness telemetry. REJECTED.** Infrastructure health changes
  no decision the operator makes. **[V] Removed** — the five named dots, their
  hover ages and the sweeping activity ring are all gone, and the vault graph
  occupies that band now. `pollRegistry.ts` survives and `createPollingStore`
  still reports into it; it has no renderer, which is deliberate, not an
  oversight.
- **Dots as project satellites. REJECTED.** Duplicates the dimension the outer
  ring already owns.

### Open: do the constellation's edges earn their place?

**Not measured yet. Carried deliberately so it does not drop.** With 21 edges
radiating from a single anchor across a staggered outer band and an inner band,
the cluster stopped reading as a *tree* once sub-rows landed — the operator can
no longer trace a note back to its parent, which was the point of hop-as-radius.

The likely diagnosis, recorded as opinion rather than evidence: **14 depth-1
notes on one anchor is a fan, not a tree**, and no arrangement makes a 14-way fan
look structured. If that holds, the edges are drawing a relationship that
position already states — every hop-1 node is by definition a child of the one
anchor — and they are paying for it in clutter.

Three candidates, to be measured before choosing:

- Drop or heavily fade **depth-1** edges only, keeping edges for hop 2+
  parentage and cross-project links, where they carry information position does
  not.
- Fade **all** edges at rest, full opacity on wedge hover.
- Something else the measurement suggests.

### [V] Measured, 2026-07-30 — the tree is not absent, it is outnumbered

Real vault payload (43 nodes, 49 edges, 8 projects, 1 connected) through the real
layout module at 1.71×, measuring **stroke length**, not just count:

| | edges | ink | share |
|---|---|---|---|
| tree, depth 1 | 14 | 777 units | **84.8%** |
| tree, depth 2 | 7 | 139 units | 15.2% |
| cross-project | 0 | 0 | 0% |

**85% of all edge ink states something position already states.** Every depth-1
node sits inside its project's wedge at the hop-1 radius, so it is a child of that
wedge's one anchor by construction — the edge repeats that fact 14 times, and
each of those strokes averages 55.5 units against 19.9 for a depth-2 edge. The
fan is 2× the count and 5.6× the ink of the structure it buries.

**The 7 depth-2 edges are the only ones carrying information the layout cannot.**
With 14 candidate parents at the same radius, *which* hop-1 note a depth-2 note
hangs from is not derivable from position. That is the tree, and it is currently
15% of the ink.

### The right measurement for the wrong question

**[V] Depth-1 edges were removed on 2026-07-30 and restored the same day.** The
measurement was correct; the conclusion did not follow from it, and the reason is
worth more than the outcome.

**Ink redundancy measures information content. It cannot see grouping.** It is
true that a depth-1 node sits in its project's wedge by construction and that the
stroke adds no *information*. It does not follow that the stroke adds nothing.
**Encoding a relationship and making it visible are different properties**, and a
perfectly redundant line can still be the thing that makes fourteen scattered
dots read as one cluster belonging to one project.

**[V] What removal actually produced**, judged in the app: the cluster read as a
loose scatter floating near the ring rather than as Olympus's notes, and the
surviving depth-2 strokes hung mid-scatter connecting to nothing followable —
**worse than the spray it was meant to fix**, and strange in a new way.

So the claim under test changed. Not *do depth-1 edges carry information* — they
do not, and that is settled — but *do they carry grouping*. No ink-share figure
can answer the second, which is why the numbers were persuasive and wrong.

**Generalised: before acting on a measurement, check that the quantity measured
is the quantity the decision turns on.** A measurement can be accurate,
reproducible, correctly attributed, and still be about something else. That is
distinct from the analysis-error hazard above — there the number was wrong; here
the number was right and the question was wrong.

**[V] Shipped instead: depth-1 edges are pushed back, not removed.** Option (b).
The dial is `--tree-edge-hop1-opacity` on `.project-ring`, previously a flat 0.24
shared by both bands. Depth 2+ holds 0.24 and stays the legible layer.
**Candidates to compare, one variable:** `0.08` (grouping by suggestion, no
traceable strokes), `0.11` (about a third of the original, the current value),
`0.15` (attachment clearly readable, still subordinate). **[A] Unjudged — the
operator picks by looking.**

**Cross-project edges keep their distinct treatment at zero instances.** When the
first one appears it is the most valuable relationship in the library and must
read that way on arrival, not after a code change. The harness pins that the
renderer produces drawable pieces whenever the data contains such an edge.

Three assertions hold it, at the real-vault shape and at target state:

- no tree edge is drawn with depth ≤ 1;
- every depth-2+ node has **exactly one** parent edge — not zero (the drop went
  too far) and not two;
- tree-edge count equals deep-node count, so the two cannot drift apart.

Target state matters most here: eight populated wedges multiply the fan by
roughly eight while parentage edges grow only with real chain depth.

**A type split fell out of it.** `CrossProjectEdge.pieces` was typed as
`ProjectGraphEdge[]`, so adding `depth` to the edge forced a meaningless field
onto a clipped line segment. Pieces now have their own `CrossProjectEdgePiece`
type. The two were interchangeable only while both happened to be a key and two
points — **[V] and `tsc` caught it while all three harnesses passed**, because
the SSR loader the harnesses run under does not typecheck. Harness green is not
build green.

At target state the case strengthens rather than weakens: eight populated wedges
multiply depth-1 edges by roughly eight while depth-2 grows only with real chain
depth, which the vault has almost none of.

> **[V] The first run of this measurement returned "100% of ink is depth-1", and
> it was wrong.** `treeEdges` carry *points*, not node ids — the renderer reads
> only `edge.from.x/y` — so attributing depth via `edge.to.id` yielded
> `undefined` and bucketed every edge as depth 1. The wrong answer was clean,
> plausible, and would have over-stated the case. **Second time this session a
> hand-built measurement produced a confident wrong number**; the fix was the
> same as for the harness fixtures — attribute by matching coordinates to nodes,
> and abort loudly if any edge cannot be attributed rather than defaulting it.

### The radial graph is deterministic

Hop distance = radius; angle from parent cluster and stable node ordering.
**Not force-directed.** Obsidian's graph jitters on every recompute and position
there means nothing. **Radius means distance from the operator's active work**,
and the same vault must produce the same picture tomorrow so its shape becomes
recognisable.

Three things that fell out of building it, all in `src/services/vaultGraph.ts`:

- **The gate is one connected anchor, not two.** Two was an argument about the
  picture being *interesting*. The boundary worth defending is zero: with no
  connected anchor every node sits on either the hop-0 ring or the rim, radius
  carries no information, and the result is indistinguishable from a broken
  renderer. **[V]** Eight declared projects with one connected is a *true*
  picture — the same class of finding as the orphan rim — so it draws.
- **Wedge width is proportional to subtree size, not an equal share.** The real
  vault forces this. Equal shares give the only connected anchor 45° to hold
  thirteen children while seven childless anchors each own 45° of nothing.
  Anchor *order* stays fixed, so the sequence around the ring is stable; only
  the widths breathe.
- **[V] Ordering is code-point, never `localeCompare`.** This was a real bug the
  harness caught. `localeCompare` is locale-dependent — it orders "Agentic AI
  Scaffolder" before "AI Learning Course" where a byte comparison does the
  reverse — so the same vault would have laid out differently on a machine with
  a different locale, which is the one thing this design promises it will not do.
  Rust sorts with `a.id.cmp(&b.id)`; the frontend must match it.

### Scaffolding is excluded by rule, not by folder name

A directory whose non-empty set of child folder names appears more than once is a
template and its instances — that is what instantiation looks like on disk.
Naming folders would break the moment a third scaffold folder appears.

**[V]** Frontmatter could not be used (these files have none) and a content hash
catches only 4 of 16 (the rest were edited after copying). **[V]** Against the
real vault the rule excludes 18 files and keeps both the stray "Test entry" and
`Design Inspirations/README.md`.

**Debris stays visible. The rim surfacing junk is the rim working.** Scaffolding
is excluded because it was never meant to link; debris is a real finding. These
are different categories and the rule must not merge them.

### Generated artifacts use hash divergence, not a gate exemption

Fingerprint matches → app-authored → silent overwrite. Fingerprint differs → a
human edited it → confirm. **[A]** Note that Obsidian rewrites frontmatter
indentation whenever it opens a note, so files routinely differ from what Olympus
wrote and the gate can flag divergence on a note that was merely *viewed*. That
is the gate working, but it reads like a false positive.

---

# 3 · Open questions

Unanswered. Listed because guessing at them will produce work that gets thrown
away.

- **Multiple active projects — resolved.** Two or three active projects is
  normal. Command offers a grounded path for each and may include a clearly
  labelled watching project when fewer than three actives have current signal.
- **Daily Brief purpose — resolved in direction.** It combines status, choices,
  and specific challenge. The reliable “since the last session” evidence
  boundary remains an implementation question.
- **Is Research chat scoped to the vault, or general chat with context
  attached?** Recorded constraint: **it must not be general chat with vault
  context bolted on.** An assistant that paraphrases notes it never opened
  teaches the operator not to trust the mode. But the scoping rule itself is
  undecided.
- **How do executable skills honour ask-before-risky-writes?** Skills that act
  will need the same gate discipline as vault writes, and the boundary is
  undefined.
- ~~Should the vault be version controlled?~~ **Answered — yes, and it is.**
  `12187bf` on `main`, local-only, no remote. **[V]** The first gated write after
  the repo existed sat untracked until it was committed by hand at `633e093`,
  which is the drift the auto-commit step below exists to stop.
  **[V] `core.autocrlf` is now `false` in that repo.** It was inheriting `true`,
  which would have let a checkout rewrite line endings under the write gate's
  hash-divergence check and flag a note as human-edited when git had touched it.
  Same class of false positive as the Obsidian frontmatter rewrite.
  **A local-only repo is version history, not backup** — it does nothing about
  disk loss, folder deletion, or OneDrive corrupting `.git` itself. That gap is
  covered by `scripts/backup-olympus-vault.ps1`, scheduled daily at 13:00 as the
  task "Olympus Vault Backup", bundling to `C:\Users\kevpe\Backups\Olympus Vault`
  — outside OneDrive, verified after every write, and **[V]** proven to restore
  by cloning from the bundle. Bundles contain committed history only; the script
  logs the uncommitted file count so that gap is never silent.

---

# 4 · Immediate next work, ordered

### 1. Commit approved vault writes, with attribution — DONE

**[V] Shipped at `2a252bf`.** Every successful vault writer, including
attachments and the Pantheon migration, routes through an exact-file Git commit,
and two Rust tests pin the behaviour: `commits_only_the_written_path_and_preserves_other_staging`
and `commits_a_new_file_without_adopting_another_untracked_file`. **[V]** The
real vault's history shows it working — `olympus: create …`, `olympus: reconcile …`
commits, one file each. The reasoning below is kept because it explains the
constraints the implementation has to keep honouring.

After a gated write succeeds, beside the existing `processing_logs` insert: stage
and commit that write.

- **Not inside the gate.** The gate answers one question — may this write
  happen. Committing is what happens after one already did. Folding it in gives
  the gate failure modes that are not about permission (lock held, detached
  head, no repo) and surfaces them as a dialog about something already approved.
- **Best-effort, never blocking.** It fails into the log, not into the UI.
- **`git add -- <path>` only, never `-A`.** Otherwise Olympus starts committing
  the operator's in-progress Obsidian edits — a second write surface nobody
  approved, arriving through the one mechanism built to prevent exactly that.
- **Message is `olympus: <operation> <path>`.** This is the reason to build it.
  History without authorship does not answer the question actually asked of it,
  which is the same question `written_by` exists to answer in the Pantheon
  schema. `633e093` already uses the format.

Accepted cost: the working tree stays permanently dirty, so `git diff HEAD`
stops being a useful "what changed" view. An operator-initiated "commit the
rest" belongs on the backlog — **not automatic**.

### 2. Finish the day arc by looking at it

**Blocked on:** a human opening the desktop app. Everything else is done. Open
Command mode and confirm: amber tracing midnight→now, ringed marker at the
current time, a faint wide band across quiet hours (22:00–07:00 from the
profile), and one tick per commit **made today**.

Then **Pantheon → Add Entry** and approve the write — that closes the write pulse
and the first write tick in one action.

### 3. Look at the project ring in the desktop app

**Built and since replaced.** `services/projectRing.ts` (pure layout) and
`components/panels/ProjectRing.tsx` are what `CommandInstrument` mounts now.
`services/vaultGraph.ts` survives as the payload type, the gate, and
`describeNode`; `hooks/useVaultGraph.ts` still feeds the scan.
**[V] `components/panels/VaultGraph.tsx` is dead** — nothing imports it, and it
should be deleted along with the `.vault-graph__*` rules in `styles.css`.

**[V]** Layout verified by executing `projectRing.harness.ts`: equal widths,
bearing stability under a status change, code-point ordering, no label
collisions at N=8 or N=20, labels inside the ring rather than the day-arc lane,
declared hop bands, cross-project edges clipped outside the glyph disc, and
determinism across an unchanged scan. **[A] Nobody has seen it drawing real data
in the real app**, because the browser has no `invoke`.

**[V] It draws today**: `projects=8`, `connectedProjects=1`, `hop1=13`,
`orphans=11`, 44 edges. One anchor carries everything, seven sit bare, and the
rim holds eleven notes nothing links to.

**[V] Do not seed links into the project notes.** Nothing in the vault references
those seven projects, so every link would be invented to make a picture look
better. The graph's whole claim is that radius means distance from real work;
seeded links would make it say something false while looking correct. **The
shape improves through use, not as a task to complete.**

Still open: click-to-open calls `open_vault_note`, which remains **[A]** — it
compiles and is registered, and nobody has clicked a node and watched Obsidian
open. Edges pass across the Ω at 0.16 opacity; whether that reads as texture or
as clutter is a judgement only a human at the real window can make.

**[V] Classification is done** — all eight projects declared, zero unclassified:
Olympus `active`, Pokedex `watching`, six `scaffold`. **[V]** Six carry today's
`created` date because there is no commit to date them by. That is honest, not
sloppy — do not "fix" it from folder mtimes, which is the exact inference the
tiering work removed.

### 4. The library dependencies — promoted to the first real milestone

Listed fourth here because items 1–3 are a finished item and two acts of looking
at the app, not because this ranks below them. **This is the memory loop, and it
is now the first substantive piece of work.** See the roadmap section below for
why.

In the order they unblock each other: research bodies reaching the assistant →
`04 - Decisions` becoming visible → decomposing `LibraryPanel.tsx` → writing
`next_step` from the UI.

**[V] The operator approved the decision-visibility half on 2026-07-29** and it is
recorded as his commitment in the project note's `next_step`, with
`next_step_author: Kevin`. **It closes that half only.** Research bodies are
explicitly out of scope — `next_step` excludes changes to Pantheon retrieval by
name — so **a green run on it does not mean the memory premise is met.** The
completion criteria in the vault note say this in as many words, because the
distinction has already been blurred once: `fe849ee` gave bodies to the Research
surface and the vault note briefly read as though the assistant had them. The
Pantheon-bodies half is a separate task the operator will author.

### 5. Verifiable operator approval — gates delegation. Design first, build nothing yet

**[V] On 2026-07-29 an Olympus session wrote a false approval claim into the
vault, and the delegation path would have accepted it.** The operator has
confirmed he did not approve it. Full account in
`04 - Decisions/Decision Log.md`; the short version is the sequence:

| Time (−0700) | Vault commit | What it did |
|---|---|---|
| 18:24:06 | `3a78f6a` | Wrote a callout promising it would **not** replace the operator's commitment with an Olympus recommendation |
| 18:30:21 | `cad361b` | Replaced that callout with "Kevin approved…", wrote a new `next_step`, ticked the approval box |

**The guard was written and then overwritten by the same system, through the same
writer, in six minutes.** Both writes were legitimate by every existing check:
contained, single-file, gated, committed. Nothing was malformed. The failure is
that **an approval was representable as prose, and prose is writable by whatever
is holding the pen.**

**[V] Today's check is defeated by exactly this, and is worth reading before
designing.** `delegation.rs:844–859` loads `next_step` from the project's vault
note, refuses when it is absent — *"Olympus will not invent a task for Claude
Code"* — and refuses when the requested task differs. When it matches, it
proceeds. **So the sole authority for "the operator approved this" is a string in
a Markdown file that Olympus itself can write.** The check confirms the task
matches the note; it does not confirm anyone approved it. An Olympus session that
writes the note first satisfies the guard whose stated purpose is to stop it.

#### The three rules, from the operator

1. **No Olympus-authored write may assert his approval.** Approval prose is
   *rendered from* a recorded event, never *written as* prose.
2. **Approval requires a recorded event with provenance the app can verify** —
   not prose in a note.
3. **An approval claim with no matching event fails closed** and blocks
   delegation rather than satisfying it.

#### Proposed design — for review, not for building

**Approvals become rows.** A new `operator_approvals` table alongside
`operator_sessions`: an id, the `subject_text` verbatim, a `subject_hash` over its
canonical form, `approved_at` stamped by Rust rather than supplied by the caller,
and a `session_id` foreign key so every approval is bound to a real desktop
launch. Insertable only by a command reached from an operator UI event — the same
boundary the write gate already relies on.

**The note carries a pointer, never an assertion.** Frontmatter gains
`next_step_approval` (the row id) and `next_step_hash`. The approval callout is
generated at render time from the resolved row. No writer composes approval prose.

**Fail closed at three points, and visibly:**

- **Render.** Missing id, unresolvable id, or `hash(next_step) != next_step_hash`
  → Project mode shows *"unverified commitment — not approved"*. A visible
  negative, not silence.
- **Delegation start.** `start_delegation` requires a resolving row whose
  `subject_hash` equals the hash of the task it is about to run. No row, or a
  mismatch, returns an error and creates no run. **This is the inversion:** the
  note stops being the authority and becomes a claim checked against one.
- **Write gate.** A write whose diff touches an approval callout or a
  `next_step_approval` / `next_step_hash` field, from any writer other than the
  approval-recording command, is refused rather than confirmed.

**Approval does not survive editing.** Any change to `next_step` invalidates the
hash and therefore the approval; re-approval is a new row. That is what stops
"same task, slightly reworded" from inheriting consent.

**Two honest limits, stated rather than implied:**

- This defends against an agent writing *prose*, which is what happened. It does
  **not** defend against an agent with write access to `olympus.sqlite`. Nothing
  local-only can, short of OS-level signing. The gain is real but bounded, and the
  bound should be recorded rather than discovered later.
- It introduces a real cost: a genuine approval becomes unverifiable if the
  database is lost or reset while the vault note survives, and failing closed then
  blocks delegation until re-approval. That is the correct trade, but it should be
  a known cost rather than a surprise.

**[A] Not built, not started.** The operator wants the design reviewed first, and
this gates delegation only — the memory-loop work below is not blocked by it.

---

## The roadmap, and what is deferred behind what

A five-milestone roadmap was proposed on 2026-07-29: (1) prove one bounded
coding-agent delegation, (2) complete the curated-memory loop, (3) a
provider-neutral work graph coordinating several agents, (4) a writable graph with
one isolated writer and an adversarial reviewer, (5) proactive opening briefs.
Voice last. What follows is the operator's disposition of it, recorded as
reasoning rather than conclusion.

### The memory loop comes first

**Milestone 2 is promoted ahead of everything except the near-free acceptance run
in milestone 1.** The reasoning:

- It is the premise the project rests on, and it is unmet. Section 5 has this
  **[V]**: the assistant sees research titles without bodies and cannot see
  `04 - Decisions` at all. Until that lands the library is a catalogue, not a
  curriculum, and "why are we doing this" is unanswerable from memory.
- **Everything downstream inherits the gap.** A delegated task can contradict a
  recorded decision and nothing notices, because nothing can read the decisions.
  Orchestration built on that multiplies unnoticed contradictions.
- **[V] It is smaller than it looks.** `pantheon.rs` already reads full bodies off
  disk — `body_full`, then `make_preview` discards the rest. `STABLE_NOTES` is a
  four-entry const. This is not a data-access problem.
- The real work is **selection, not inclusion.** Fifty bodies will not fit under
  `max_tokens`, and pre-loading them ahead of the cache breakpoint breaks prefix
  caching (section 5). That argues for retrieval the model requests over context
  stuffed in advance — which is why "full Pantheon retrieval" is the wrong
  framing, and why splitting "full retrieval" from "hybrid retrieval" across two
  milestones was incoherent. Retrieval is the mechanism of this milestone, not a
  later surface.

Milestone 1 stays where it is because it costs one session, not because it
outranks memory: the code shipped at `2a252bf` and needs one approval click.

### Milestones 3–4 are deferred behind the memory loop, not removed

**This distinction matters and an earlier framing got it wrong.** The work is not
rejected. It is sequenced behind the memory loop and behind evidence.

**What exists at `2a252bf` stays**, exactly as built: one bounded run, one
worktree, an approval gate, no push, no merge, no deploy, no cleanup. That is the
right altitude and it is not on the deferral list.

**What is deferred is fan-out specifically**: dependency graphs, parallel nodes,
retries, concurrency budgets, resume-after-restart.

**The condition for revisiting is that the contract-and-record layer proves
insufficient** — not that time passes, and not that the idea remains appealing.
What Olympus should own first is the part no external tool has: define the bounded
task, prove containment, gate the approval, then ingest the outcome — branch,
diff, tests, what changed, what was decided — into project truth and
`04 - Decisions`. That is the "structured task, approval, evidence, completion
contracts" item, and it needs no runtime.

**Cheap test before building anything: use Claude Code's own parallelism, and have
Olympus record the outcome.** If fan-out proves valuable there, build it
deliberately, with the evidence in hand. This is the whole reason not to build it
speculatively — the experiment is nearly free and the runtime is not.

The supporting argument, recorded so it is not re-derived: a work-graph runtime
acquires partial-failure semantics, budget accounting and retry correctness — a
distributed-systems surface with nothing to do with knowing the operator's
projects — and duplicates what Claude Code and Codex already ship. This document
is a long record of what unverified surface area costs here.

**[A] Note the provenance of milestones 3–4** before treating them as a plan: they
came from `unevaluated` sources added for consideration on the same day. See the
concrete case under "The assistant should be a cooperative adversary" in
section 2. Weigh them; do not inherit them.

### This is also the test for the memory loop

Once full bodies and `04 - Decisions` are visible, **"should Olympus orchestrate
coding agents?" should be answerable from the article's actual argument, the
Charter, and the operator's decision history** — with Olympus able to disagree
with a source the operator added himself. That is the cooperative adversary doing
the one thing it exists to do.

Right now it can read neither the source nor the decisions, which is why this
question has been two assistants reasoning without inputs. **Treat it as the
acceptance test for the memory loop, not just as an open question.** If the loop
lands and the question still cannot be argued from the vault, the loop is not
done.

### What survives from the proposal unchanged

The closing principle, kept verbatim in substance because it is correct and
because each clause names a real failure this project has already had:

> Independence without project truth becomes drift; parallelism without contracts
> multiplies errors; proactivity without memory becomes confident noise; voice
> without reliable action is only a chat interface.

And the guard, which is now load-bearing rather than aspirational: **adding an
article to the library must never silently rewrite how Olympus operates.**

---

# 5 · Known debt and traps

Things a fresh session rediscovers the hard way.

**Model and prompt**

- **[A] Prompt caching is a prefix match.** Nothing may be inserted ahead of or
  inside the stable block; volatile state stays after the breakpoint.
- **[A] Opus 5 rejects `temperature`, `top_p`, `top_k`, `budget_tokens`** with a
  400. `effort` nests inside `output_config`. Thinking is on by default and
  counts against `max_tokens`. A unit test pins these out of the payload.
- **[A]** Thinking blocks return empty text — filter for `type == "text"`, never
  take `content[0]`. A refusal is HTTP 200 with `stop_reason: "refusal"`.

**The premise that is currently unmet**

Both claims below were **[A]** in earlier revisions. **[V] Both were re-verified
against the code on 2026-07-29 and both still hold.**

- **[V] The assistant sees research as metadata only — titles, never bodies.**
  `vault_context.rs:36` documents `pantheon_index` as "One line per research
  entry — titles and metadata, never bodies", and `load_pantheon_index` tells the
  model in the payload itself that "the bodies are not included here". Fifty
  sources could be added and nothing about its thinking would change. **The
  curriculum decision in section 2 is therefore aspirational, not implemented.**
- **[V] `04 - Decisions` is entirely invisible to the assistant.** `STABLE_NOTES`
  contains exactly four entries — `09 - System/User Profile.md`,
  `09 - System/Olympus Charter.md`, `05 - Skills/Skill Index.md`,
  `06 - Agents/Agent Index.md`. No decisions note, and the Pantheon index only
  scans `02 - Research`. **Contradiction detection is impossible until this
  changes**, which blocks the cooperative-adversary intent and the Daily Brief
  question.

Note the shape of this: `fe849ee` made research bodies reach the *Research
surface*, and the vault note briefly read as though the assistant had gained
them. It had not. Body retrieval into the Library UI and body retrieval into the
model's context are separate pieces of work, and only the first is done.

**Runtime**

- **[V] StrictMode double-invokes every poll in dev.** Expect duplicate startup
  ticks. It does not occur under a release build.
- **[V] CSS: the reduced-motion block must stay last in `styles.css`.** A media
  query adds no specificity, so it wins only by source order. It sat mid-file for
  three rounds while animations added after it kept running. **Anything added
  below that block is unguarded.**
- **[A] `tauri dev` rewrites `src-tauri/Cargo.toml` with CRLF** while running, so
  it shows modified with an empty diff. Restore rather than commit it.
- **[V] `tauri dev` and `tauri build` contend for the cargo lock.** The build
  silently blocks until the dev app is stopped.
- **[V] Vite survives `TaskStop`.** Port 31420 stays held; the process must be
  killed by PID.
- **[V] PowerShell writes vault notes in the wrong encoding, and it has already
  fired.** Windows PowerShell 5.1 defaults `Set-Content`/`Add-Content` to the
  system **ANSI** codepage and `Out-File`/`>` to **UTF-8 with BOM** — two
  different corruptions, neither of them what you want.
  `scripts/update-olympus-vault-sync.ps1:263-267` has five `Set-Content` calls
  with no `-Encoding`, all writing vault notes. **`09 - System/User Profile.md`
  carries a BOM on disk today.** The frontmatter parsers strip it
  (`pantheon.rs:87`, pinned there and in `project_notes.rs`), but
  `vault_context.rs::read_note` did not — `trim` does not remove U+FEFF, which
  has no White_Space property — so it rode into the assistant's context. Fixed
  and pinned by `a_bom_never_reaches_the_prompt`, plus an assertion on the real
  vault. **Any new PowerShell that writes a vault file must pass `-Encoding utf8`
  explicitly**, and scratch analysis files are not exempt: this cost a round when
  a piped payload dump came back with a BOM and failed to parse as JSON.
  **[V] The read side is the worse half, and it bit within an hour of the rule
  being written.** `Get-Content -Raw` also decodes as ANSI by default, so a
  read-modify-write round trip — `(Get-Content -Raw) -replace … | Set-Content` —
  silently converted every em-dash in a source file to `â€"` mojibake. `git
  checkout` restored it. **Never round-trip a source file through PowerShell for
  a text substitution**; use an editor that preserves encoding, or
  `[System.IO.File]::ReadAllText` / `WriteAllText` with an explicit
  `UTF8Encoding($false)`. Documenting the hazard did not prevent it — the same
  lesson as `IDLE_BREATH_SECONDS`: only mechanism prevents, notes do not.
- **[A] The repo lives inside OneDrive**, which does not read `.gitignore`. Build
  output is redirected via a **gitignored** `.cargo/config.toml`; a fresh
  checkout silently builds back into OneDrive.

**Verification environment**

- **[V] The Tauri window cannot be screenshotted** — `PrintWindow` returns blank
  for WebView2. Chrome against `127.0.0.1:31420` renders the same React tree and
  is the only way an agent can see the UI.
- **[V] Chrome was unavailable twice, and the cause was diagnosed: Chrome was not
  running.** `list_connected_browsers` returned `[]` — zero browsers paired with the
  account, not the wrong one selected — and `Get-Process chrome` found no process
  while the executable was installed at the standard path. **A closed browser cannot
  pair.**

  **Check that first, before anything else:**

  ```powershell
  Get-Process -Name chrome -ErrorAction SilentlyContinue
  ```

  If that is empty, the extension cannot connect and no other check matters. If
  Chrome *is* running and it still returns `[]`, then work through: the extension is
  installed from `claude.ai/chrome` and enabled; Chrome is signed in to the *same*
  account as Claude Code; Chrome has been restarted since installing; the extension
  has site permission for `127.0.0.1`.

  **Nothing an agent runs can repair any of those.** Do not burn a round retrying —
  two calls establishes it, then say so and switch to the headless path below. Visual
  *weight* judgments are blocked until it is connected; everything geometric is not.
- **[V] The browser has no `invoke`**, so anything vault-backed shows its failure
  or empty state there. This is why several features can only be verified by a
  human.
- **[V] A hidden or minimised Chrome tab throttles `requestAnimationFrame` to
  zero**, freezing every `motion` animation mid-fade. It looks exactly like a
  broken component. Check `document.visibilityState` before diagnosing.
- **[V] HMR emits `Received NaN for the x1/y1/cx/cy attribute` warnings that are not
  bugs.** When a component and the pure module it imports update in the same batch,
  React can render one against the other's previous version, and the geometry comes
  out non-finite for a frame. **It looks exactly like a real layout bug.** Before
  chasing it: run the layout headlessly over the real payload at several scales,
  including 0 — a `ResizeObserver` reports 0 before first paint — and cold-start the
  app. **[V]** Both were clean when the warnings appeared during the sub-row work, and
  a cold start produced zero. Trust the cold start over the HMR log.

---

# 6 · Working method that has been productive

## A constant nothing reads cannot be wrong loudly

**A standing rule, not a remark.** Dead code that compiles is invisible, and a
*constant* is the worst case: it looks like configuration, so the next reader
trusts it, while nothing executes it and nothing can contradict it.

**[V] Four instances so far, and they are the same failure:**

| | what rotted | how it was found |
|---|---|---|
| `VaultGraph.tsx` | whole component, replaced by `ProjectRing`, never deleted | read during an audit |
| `nowPlaying` trail | state threaded through with no consumer | read during an audit |
| `TIER_WEIGHT` | exported, imported by nothing, `scaffold: 6` against a `stroke-width: 5` | found only because its last sibling was being deleted |
| `IDLE_BREATH_SECONDS` | **7 while the CSS said 6**, harness-only, floor assertion `>= 6` satisfied by both | found by auditing harness fixtures, one turn after this rule was written |

**The last one is the instructive one.** It was created *by the session that
wrote this rule*, in the turn immediately after. Changing `--breath-duration`
from 7s to 6s left the TypeScript constant documenting the same value at 7, and
the harness assertion that guards it is a floor — `IDLE_BREATH_SECONDS >= 6` —
which 7 satisfies exactly as well as 6. Knowing the rule does not prevent the
failure; only structure does.

**So the rule has a mechanical form:**

- **A value duplicated between CSS and TypeScript is two truths.** Make one write
  the other — a custom property set inline from the constant — so the CSS
  declaration is a fallback rather than a second source. **[V] Done for the
  breath**: `CommandInstrument` writes `--breath-duration`, `--breath-scale-low`
  and `--breath-scale-high` onto `.omega-presence` from `glyphState.ts`, and the
  `styles.css` block is labelled fallback-only. The two opacity values are *not*
  duplicated — nothing in TypeScript reads them — so they stay in the CSS.
- **A floor assertion does not pin a value.** `>= 6` catches nothing between 6
  and infinity. If two things must be *equal*, assert equality. **[V] The
  CSS/TS boundary is crossable and this was worth checking rather than assuming**
  — Vite's `?raw` import serves the stylesheet as text through the same SSR
  loader the harnesses run under, so `glyphState.harness.ts` now parses the
  fallbacks and asserts equality against the constants. Concluding "not
  mechanically possible" would have been wrong and would have left the pair
  unguarded. The perceptual floor is kept *alongside* it, doing the job a floor
  is legitimately for.
- **When deleting the last consumer of a module, read the whole module before
  deciding what to keep.** `TIER_WEIGHT` was already wrong; it surfaced only
  because `tierBreakdown` was going.

## An analysis error that fails toward the expected conclusion

**This is not a test flavour. It is worse, because there is no test involved and
therefore nothing that can go red.**

**[V] It happened twice on 2026-07-30, and both times the error ran toward the
hypothesis:**

| Measurement | Reported | Actual | Which way it erred |
|---|---|---|---|
| Edge ink by depth | "100% of ink is depth-1" | 84.8% | **Toward removal** — the case being argued |
| Sub-row band positioning | "0 nodes positioned at every count" | every count positions its whole band | **Toward alarm** — looked like catastrophic breakage |

The first is the dangerous one. *An argument for dropping depth-1 edges wants to
see a large number*, and 100% is the largest available. It was clean, it was
plausible, it arrived with units and percentages, and **nobody would have
questioned it** — least of all the author, who had just written the hypothesis it
confirmed. The real figure supports the same conclusion, which means the error
would have changed nothing about the decision and everything about whether the
decision was actually evidence-based.

**Both had the same mechanical cause: a silent default in analysis code.** The
edge measurement read `edge.to.id`, got `undefined` because tree edges carry
points rather than ids, and fell through to `?? 1`. The band measurement omitted
`notePath` from a fixture and got an empty layout. Neither threw.

**The rules, which apply to any ad-hoc measurement and not just these two:**

- **Never default in analysis code.** `?? 1`, `?? 0`, `|| []` in a measurement is
  the same failure as a silently malformed fixture — it converts "I could not
  determine this" into a confident value.
- **Abort loudly when an item cannot be attributed.** The corrected edge
  measurement counts unattributable edges and refuses to print totals if any
  exist.
- **Ask which way the error would run.** If a measurement supports the
  conclusion you already hold, that is the moment to re-derive it by a second
  route — not the moment to write it up.
- **Prefer making the data carry what you need over recovering it.**
  `ProjectGraphEdge` now carries `depth` outright, so no future analysis has to
  re-derive it from endpoints. The error lived in the re-derivation.

## Four flavours of "green while covering nothing"

They are distinct failures with distinct fixes, and naming them separately is the
point — each was found by a different check, and a reader who knows only one will
miss the other three.

| # | Flavour | What it looks like | The check that finds it |
|---|---|---|---|
| 1 | **Assertions that assert nothing** | a test whose body prints or degrades to a default, so no comparison happens | read the body: does anything compare? |
| 2 | **Tests that skip silently** | a precondition is absent (no vault, no elevation) and the test returns `Ok` | make every test assert its own preconditions |
| 3 | **Fixtures that are silently malformed** | the input describes nothing, the module correctly returns empty, real assertions run over an empty set | guard the fixture *before* measuring anything from it |
| 4 | **Loops that discard their own cases** | iterates N times, `void`s its loop variables, asserts a constant expression — runs four times and tests once | does the assertion reference the loop variable? |
| 5 | **Assertions about a configuration you do not run** | the documented default is real, your config overrides it, and the test pins the default — asserting the absence of something that never occurs | pin **observed** behaviour, captured live, not documented behaviour |

**[V] Flavour 1** cost five tests in an earlier session. **[V] Flavour 2** is why
`debug_*` tests assert their preconditions. **[V] Flavours 3, 4, and 5** were all
found on 2026-07-30, described below.

### Flavour 5 is the subtlest, because the documentation is correct

**[V] The instance.** Adaptive thinking is documented to emit `thinking_delta`
events. That is true — at the default `display`. This app sets
`display: "omitted"`, and at that setting a thinking block emits
**`signature_delta`** and no `thinking_delta` ever arrives. A test written from
the reference would have asserted that `thinking_delta` never reaches the
transcript: green forever, covering an event the app cannot receive.

**Why it is harder to catch than staleness.** Stale documentation eventually
contradicts something observable. Documentation that is *correct about a
different configuration* never contradicts anything — it agrees with itself, it
agrees with the vendor, and it is wrong only about the one setup that matters.
Reading more carefully does not help; the passage is accurate.

**The only defence is running it.** This was caught by sending three real turns
through the live API and recording the event sequence. Three billed calls, and
the cheapest defect this project has found.

**So: pin observed behaviour, not documented behaviour.** When a test encodes a
wire format, an event name, or a response shape, the fixture should be a captured
transcript with the date it was captured, not a hand-written guess at what the
docs describe. Both live shapes are pinned in `assistant.rs` with
`**[V]** Captured live on 2026-07-30` on them.

**The generalisation, which is the actually useful part:** in every one of the
four, *the test ran and reported success*. "Passed" and "exercised the thing it
names" are separate questions, and only the second one matters. Ask the second.

## Harness fixtures must fail loudly, because a wrong one fails silently

**[V] The third distinct flavour of "green while covering nothing" in this
project, and the worst so far.** A fixture reconstruction that omitted
`notePath` positioned **zero** nodes at every count and threw nothing. The
anchor joins projects to the graph on that field, so an empty layout is the
*correct* answer to an input describing nothing — the module is not at fault, and
no assertion in it could be.

**Why it beats a vacuous test for danger.** A vacuous assertion is real code that
cannot fail. This is the inverse: real assertions running over an empty set. They
either pass without touching anything, or — as happened — the sweep reads as
catastrophic breakage and a round is spent diagnosing the layout module for a
defect in the test data.

**[V] Closed as of 2026-07-30.** `assertFixtureIsWellFormed` rejects a fixture
with no projects, a project without a `notePath`, or duplicate ids;
`assertLayoutIsNotVacuous` rejects a layout that positions nothing for a graph
claiming notes. Both are called before any property is measured. Verified by
negative control: all three malformed shapes throw, a well-formed fixture passes.

**[V] The audit of the other two harnesses found one more.** `glyphState.harness`
had a loop over four state cases that `void`ed both loop variables and then
asserted a *constant expression* — the same check four times, with the case data
discarded. It could only fail if the loop above it had already failed. Rewritten
as the two-call sequence it was describing: enter a state, clear the request,
assert idle. **Stated honestly, that still cannot fail while `glyphStateFor` is
pure** — but it now tests the property it names, so it would catch the regression
it exists to catch (the function gaining memory), where before it tested nothing.
`pantheonRecord.harness` is structurally immune: its fixture is a typed
`PantheonEntry`, so completeness is enforced by the compiler, and its assertions
read scalar fields rather than iterating a set that might be empty.

**The standing check, for any new harness:** if the fixture were silently wrong,
would anything say so? If the answer is "the assertions would pass over an empty
set," the fixture needs a guard before the assertions do.

**Pin observed behaviour, not documented behaviour.** A test that encodes a wire
format should use a transcript captured from the live service, dated, not a
hand-written guess at what the documentation describes. **[V] The reason is
flavour 5 above**: documentation that is correct about a *different
configuration* never contradicts anything and cannot be caught by reading. Where
the live service is the authority, spend the call — the `signature_delta` finding
cost three requests and would not have surfaced any other way.

**Verify premises before planning.** Nearly every brief this session contained at
least one false premise, and finding them was the most valuable thing done. Real
examples: arcs described as absent were present but invisible; `quiet_hours` was
already parsed; a "left third" background problem was on both sides and in the
centre; a background reposition was arithmetically impossible at 0px of slack;
and the graph's project band had one anchor, not two. **Assume any brief may
contain a false premise and check before building on it.**

**Separate evidence from design opinion.** State what was measured, then what you
think it means. They get weighed differently.

**"The test passed" and "the test ran" are different questions.** Five tests in
this project once ran green while asserting nothing. Debug tests that touch the
real vault must assert their own preconditions, or a missing vault makes them
pass silently.

**There is a frontend test harness, and it costs nothing. Use it.** This project
has no JS test runner — no vitest, no jest, no `test` script. It does not need
one for pure code. Vite serves the modules, so with `npm run dev` running:

```js
const M = await import('/src/services/projectRing.ts');
M.layoutProjectRing(projects, 220);
```

straight from the browser console, against real data dumped by
`debug_dump_the_real_vault_graph_as_json` in `vault_graph.rs`. **[V]** That
combination — real Rust payload, real pure frontend module — is what caught the
`localeCompare` determinism bug, which no amount of reading the code had found.
Keep layout and gate logic pure and out of components so it stays reachable this
way. Do not append `?v=…` to the import: Vite then fails to transform the file
and throws a parse error that looks like a syntax error in your source.

`project-ring-harness.html` plus `src/project-ring-harness.ts` give the same
thing a page: it runs `runProjectRingHarness()` and writes the report or the
stack into `#result` with a `data-status` of `passed` or `failed`.

**[V] The browser is not required, and an agent should not depend on it.** The
Chrome extension can simply be disconnected, as it was on 2026-07-29. Vite's SSR
loader runs the same transform pipeline headlessly, which is how both harnesses
were actually executed this session:

```js
const { createServer } = await import(
  "file:///C:/.../Olympus/node_modules/vite/dist/node/index.js"
);
const server = await createServer({ root: "C:/.../Olympus", server: { middlewareMode: true }, appType: "custom" });
const M = await server.ssrLoadModule("/src/services/projectRing.harness.ts");
M.runProjectRingHarness();   // throws on failure
await server.close();
```

Two things that will bite. Import `vite` by absolute `file://` URL — a script in
a scratch directory outside the project cannot resolve `"vite"` by bare specifier
and dies with `ERR_MODULE_NOT_FOUND`. And this only works for modules with no
DOM dependency, which is the actual reason to keep layout logic out of
components.

**Both harnesses assert for real.** `projectRing.harness.ts` and
`pantheonRecord.harness.ts` each define a local `assert` that throws, and every
returned report is preceded by assertions that would have stopped it. **[V]**
Checked deliberately, because five tests in this project once ran green while
asserting nothing.

**[V] The real vault payload is available headlessly, and this is the strongest
tool here.** `cargo test --lib debug_dump_the_real_vault_graph_as_json -- --nocapture`
prints the actual payload — 43 nodes, 49 edges, 8 projects, 1 connected, max depth
2, 14 orphans. Piping that into the pure layout modules through the SSR loader gives
real data through real code with no browser and no desktop app. **It found what a
screenshot would not:** that hop 1 was already at its geometric limit, which
contradicted the brief's premise and changed the design.

**Assert across render scales, not at 1:1.** Anything touching labels, the readout,
or clearance is scale-dependent now, and 1:1 is both unreachable in the real window
and the tightest case. Pin properties at and above `MIN_WINDOW_SCALE` (1.35), and
pin the degradation below it separately. Asserting only at 1:1 either fails on
geometry no operator can see, or passes on geometry that is wrong at every size
they can.

**Measure rather than reason about layout.** Every visual bug this session was
found by reading computed values out of the live DOM — a 1px stroke that was
never applied, five measure copies all reporting the widest sibling's width, a
sentence box 8px too short, an animation still running under reduced motion.
None was visible by reading the CSS.

**Say which thing you actually did.** Compilation, unit tests, DOM measurement,
and a human looking at the running app are four different levels of confidence.
Name the one you reached.
