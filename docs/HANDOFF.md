# Olympus — Planning Handoff

Written 2026-07-27 at `1af8092`. **For planning, not for coding.** Intent and
decisions first; implementation detail only where it constrains what comes next.

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
- **[V] `processing_logs` contains zero `vault-write` rows** (read from the
  SQLite file). No gated write has been approved since the logging landed, so
  zero write ticks is correct rather than broken.
- **[V] There is no graph renderer.** `fetch_vault_graph` has **zero frontend
  consumers**. The Rust data layer is built and tested; nothing draws it, and the
  render gate is currently a field in a payload nobody reads.
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

### The three modes are three verbs, not three layouts

Project = **execute**. Command = **think**. Research = **know**. A change that
makes two modes differ only in which panels are visible has missed the point.
This is why Command mode was rebuilt: it and Project were rendering the same
screen with a different tab lit, which meant Command had no reason to exist.

### The library is a curriculum, not a reading pile

The operator adds a source because he has judged it worth Olympus absorbing.
**There is deliberately no read/unread/processed state anywhere**, and no fixed
category taxonomy. A source is in the library because it should shape the
assistant's thinking, not because it is queued for attention.

### The assistant should be a cooperative adversary

Rare, cited pushback — not constant objection, and not agreement. This is the
entire reason `stance` and `origin` exist. **Without them, presence in the vault
reads as endorsement and the assistant drifts toward agreeing with the
operator.** `stance` degrades to `unevaluated`, never to `endorsed`; that is the
one direction it must not fail in, and a test pins it. `origin` distinguishes
sources pre-filtered by his taste from ones Olympus found *because* they cut
against the library.

### Command mode is ambient, readable across the room

**Any version of Command containing a scrolling list is Project mode with a
different tab lit.** The sentence is what earns the mode — the next action
rendered large is the highest-value fact in the app. The ring is supporting.

### The omega ring is an instrument, not decoration

Outer arcs are **project tiers**: arc length is count, and status is carried by
lightness and stroke weight moving together. **[V]** Four stroke weights alone
are not separable at this size — the step from scaffold to unclassified was 1px
on a 500px ring, which is why the ramp uses two correlated channels and a 5px
floor.

### Explicitly rejected — and one of them is currently in the code

- **Dots as poll-freshness telemetry. REJECTED.** Infrastructure health changes
  no decision the operator makes.
  **[V] This is what is shipped today.** `CommandInstrument.tsx` renders five
  named poll sources with "time since last success" on hover. It was built and
  approved in an earlier round and has since been rejected. **A fresh session
  will find working code implementing a design the operator no longer wants** —
  it needs removing or repurposing, not preserving.
- **Dots as project satellites. REJECTED.** Duplicates the dimension the outer
  ring already owns.

### The radial graph is deterministic

Hop distance = radius; angle from parent cluster and stable node ordering.
**Not force-directed.** Obsidian's graph jitters on every recompute and position
there means nothing. **Radius means distance from the operator's active work**,
and the same vault must produce the same picture tomorrow so its shape becomes
recognisable.

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

- **Multiple active projects.** **[V]** The *implemented* behaviour: the most
  recently committed active project's `next_step` renders, the rest are counted
  as `+N more active`, and if the winner states nothing it shows a prompt rather
  than borrowing another project's step. Tested. **The product question is still
  open** — whether that is the right answer, or whether multiple actives should
  be prevented, ranked differently, or displayed differently.
- **What is the Daily Brief FOR?** A status report, or the venue where Olympus is
  allowed to tell the operator he is wrong? These are different products. The
  second is the one that makes the cooperative-adversary decision real, and it
  would need `04 - Decisions` visible (see debt).
- **Is Research chat scoped to the vault, or general chat with context
  attached?** Recorded constraint: **it must not be general chat with vault
  context bolted on.** An assistant that paraphrases notes it never opened
  teaches the operator not to trust the mode. But the scoping rule itself is
  undecided.
- **How do executable skills honour ask-before-risky-writes?** Skills that act
  will need the same gate discipline as vault writes, and the boundary is
  undefined.
- **Should the vault be version controlled?** **[V]** It is not a git repository
  today, so the eight project notes written this session are versioned nowhere.
  It lives in OneDrive, and a `.git` there syncs too — which is the pattern that
  forced Rust build output out of OneDrive in `f290e66`.

---

# 4 · Immediate next work, ordered

### 1. Decide what replaces the poll dots

Blocking nothing technically, but the shipped instrument contains a rejected
design. Cheapest correct move is removal; the ring is legible without them.

### 2. Finish the day arc by looking at it

**Blocked on:** a human opening the desktop app. Everything else is done. Open
Command mode and confirm: amber tracing midnight→now, ringed marker at the
current time, a faint wide band across quiet hours (22:00–07:00 from the
profile), and one tick per commit **made today**.

Then **Pantheon → Add Entry** and approve the write — that closes the write pulse
and the first write tick in one action.

### 3. Build the graph renderer

**[V] It does not exist.** The Rust data layer is complete and tested; no
frontend component consumes `fetch_vault_graph`.

**Blocked on data, not code.** **[V]** Current state: `projects=8`,
`connectedProjects=1`, `hop1=13`. The gate requires **two anchors that each have
an edge**, and only Olympus has any.

**[V] Do not seed links into the project notes to open it.** Nothing in the vault
references those seven projects, so every link would be invented to make a
picture appear. The graph's whole claim is that radius means distance from real
work; seeded links would make it say something false while looking correct. **The
gate opens through use, not as a task to complete.**

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

**Measure rather than reason about layout.** Every visual bug this session was
found by reading computed values out of the live DOM — a 1px stroke that was
never applied, five measure copies all reporting the widest sibling's width, a
sentence box 8px too short, an animation still running under reduced motion.
None was visible by reading the CSS.

**Say which thing you actually did.** Compilation, unit tests, DOM measurement,
and a human looking at the running app are four different levels of confidence.
Name the one you reached.
