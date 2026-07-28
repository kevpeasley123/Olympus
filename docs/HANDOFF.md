# Olympus — Planning Handoff

Originally written 2026-07-27 at `1af8092`, then vision-synced on the isolated
`codex/vision-foundation` branch. **For planning, not for coding.** Read
`OLYMPUS-MANUAL.md` first; it is now the canonical product and operating policy.

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

**[V]** Rust: 150 tests pass. **[V]** `npm run build` passes.

**[V] `tauri build` now succeeds** — run twice this session, ~2m24s, producing
MSI and NSIS bundles at `C:/Users/kevpe/dev-target/olympus/release/bundle/`. This
corrects an earlier claim that it had never been run. **[V]** The NSIS installer
is what fixes the taskbar pin: pinning the dev binary breaks on every rebuild
because cargo deletes and recreates the file, so Windows sees a new identity.

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
- **[V] The day arc has never drawn real ticks.** The data is proven — 5 commits
  in 24h with valid timestamps, and the tick *styles* were confirmed by injecting
  sample geometry — but the browser cannot render real data, and nobody has
  looked at the desktop app.
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
- **[A]** `save_attachment_to_vault` has never successfully run;
  `02 - Research/_attachments/` does not exist.
- **[A]** `open_vault_note` compiles and is registered; nobody has clicked the
  empty-state prompt and watched Obsidian open.
- **[A]** The write gate's divergence-under-append branch.
- **[V]** Whether the **built executable launches** is untested. Producing
  bundles and running are separate questions.

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

### Command mode is the ambient instrument

Command should read from across the room: one full-size omega instrument, one
active-project next-action sentence, quiet tier counts, and right-column chat.
The ring, vault graph, and day arc are the content—not supporting decoration.
Cards, lists, and scrolling project detail belong in Project mode.

The design failure that established this boundary was structural: adding a
multi-project briefing forced the omega to shrink. Once a centre-column panel
needs the instrument's space, the instrument becomes decoration by default even
if the copy still calls it primary.

### The omega ring is an instrument, not decoration

Outer arcs are **project tiers**: arc length is count, and status is carried by
lightness and stroke weight moving together. **[V]** Four stroke weights alone
are not separable at this size — the step from scaffold to unclassified was 1px
on a 500px ring, which is why the ramp uses two correlated channels and a 5px
floor.

### Explicitly rejected — and one of them is currently in the code

- **Dots as poll-freshness telemetry. REJECTED.** Infrastructure health changes
  no decision the operator makes. **[V] Removed** — the five named dots, their
  hover ages and the sweeping activity ring are all gone, and the vault graph
  occupies that band now. `pollRegistry.ts` survives and `createPollingStore`
  still reports into it; it has no renderer, which is deliberate, not an
  oversight.
- **Dots as project satellites. REJECTED.** Duplicates the dimension the outer
  ring already owns.

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

### 1. Commit approved vault writes, with attribution

**Decided, not built.** After a gated write succeeds, beside the existing
`processing_logs` insert: stage and commit that write.

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

### 3. Look at the graph renderer in the desktop app

**Built.** `services/vaultGraph.ts` (pure layout and gate),
`hooks/useVaultGraph.ts`, `components/panels/VaultGraph.tsx`, mounted in
`CommandInstrument`. **[V]** Layout verified against the real vault payload
through the browser harness below — determinism, band radii, glyph and tier
clearance, no overlapping nodes. **[A] Nobody has seen it drawing real data in
the real app**, because the browser has no `invoke`; what was seen was the real
geometry injected into the live DOM.

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

### 4. Then the library dependencies

In the order they unblock each other: research bodies reaching the assistant →
`04 - Decisions` becoming visible → decomposing `LibraryPanel.tsx` → writing
`next_step` from the UI.

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

- **[A] The assistant sees research as metadata only — titles, never bodies.**
  Fifty sources could be added and nothing about its thinking would change. **The
  curriculum decision in section 2 is therefore aspirational, not implemented.**
- **[A] `04 - Decisions` is entirely invisible to the assistant**, absent from
  both `STABLE_NOTES` and the Pantheon index. **Contradiction detection is
  impossible until this changes**, which blocks the cooperative-adversary intent
  and the Daily Brief question.

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
- **[A] The repo lives inside OneDrive**, which does not read `.gitignore`. Build
  output is redirected via a **gitignored** `.cargo/config.toml`; a fresh
  checkout silently builds back into OneDrive.

**Verification environment**

- **[V] The Tauri window cannot be screenshotted** — `PrintWindow` returns blank
  for WebView2. Chrome against `127.0.0.1:31420` renders the same React tree and
  is the only way an agent can see the UI.
- **[V] The browser has no `invoke`**, so anything vault-backed shows its failure
  or empty state there. This is why several features can only be verified by a
  human.
- **[V] A hidden or minimised Chrome tab throttles `requestAnimationFrame` to
  zero**, freezing every `motion` animation mid-fade. It looks exactly like a
  broken component. Check `document.visibilityState` before diagnosing.

---

# 6 · Working method that has been productive

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
const M = await import('/src/services/vaultGraph.ts');
M.layoutVaultGraph(payload, 220);
```

straight from the browser console, against real data dumped by
`debug_dump_the_real_vault_graph_as_json` in `vault_graph.rs`. **[V]** That
combination — real Rust payload, real pure frontend module — is what caught the
`localeCompare` determinism bug, which no amount of reading the code had found.
Keep layout and gate logic pure and out of components so it stays reachable this
way. Do not append `?v=…` to the import: Vite then fails to transform the file
and throws a parse error that looks like a syntax error in your source.

**Measure rather than reason about layout.** Every visual bug this session was
found by reading computed values out of the live DOM — a 1px stroke that was
never applied, five measure copies all reporting the widest sibling's width, a
sentence box 8px too short, an animation still running under reduced motion.
None was visible by reading the CSS.

**Say which thing you actually did.** Compilation, unit tests, DOM measurement,
and a human looking at the running app are four different levels of confidence.
Name the one you reached.
