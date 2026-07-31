# Brief: architectural review of Olympus

**For an external reviewing model with read access to this repository.**
Disposable — delete once the review is answered. Written 2026-07-31 against
`eff5a64` on `claude/visual-judgment-setup-dvrr7v`.

---

## 1 · What Olympus is

A private, local-first AI command station and thinking partner for a single
operator. Tauri + React + TypeScript desktop shell, Rust backend, SQLite
persistence, an Obsidian vault as the knowledge layer.

The load-bearing claim is the negative one, from `OLYMPUS-MANUAL.md`:

> Olympus is not primarily a chat client. Chat and voice are ways to *operate* a
> system that maintains project truth, memory, decisions, and delegated work.

So it is a **system of record about the operator's own work**, with a
conversational front door — not an assistant with a dashboard attached.

**Four sources of truth, reconciled and never collapsed.** Git owns branch and
commit facts. Project-local files own implementation context. The Obsidian vault
owns distilled vision, decisions and commitments. SQLite owns the conversation
log, write fingerprints and session boundaries. **A disagreement between them is
surfaced, never silently resolved.** Most of the apparent complexity in this
codebase descends from that one rule.

**Three surfaces, deliberately non-overlapping.** Command is ambient and
glanceable — the omega instrument *is* the mode, "one glyph, one sentence,
readable across the room"; a card or scroll container in its centre column is
mode drift. Projects is the lean-in portfolio briefing. Research/Pantheon is a
reference library where presence is not endorsement.

**Operating policies:** cooperative adversary (specific cited pushback, not
constant objection); autonomy scales with reversibility; project visions are
living hypotheses with review dates; and an evidence standard requiring you to
name which tier of evidence you reached.

Read in this order: `OLYMPUS-MANUAL.md` (canonical, 189 lines), then
`ARCHITECTURE.md` (209). Both are short and current.

---

## 2 · The question

**Does the implementation match the stated vision, and where does it not?**

Not "find bloat." A pure size sweep returns the longest files, which in this
repository is close to the least useful reading — several long files are long
because something failed quietly once and the fix was to assert it exhaustively.

Three specific sub-questions:

1. **Surface area that serves no stated goal.** Which code exists that the
   manual's purpose statement and six-item priority list do not cover?
2. **Effort allocation against stated priority.** The manual's order is:
   trustworthy briefings → delegating to coding agents → curated memory →
   proactive warnings → full constellation → voice. Where does invested effort
   invert that order?
3. **Structural fitness.** Where would the *next* three features be hard to add
   because of how the current code is arranged? Name the arrangement, not the
   line count.

---

## 3 · Settled — do not relitigate

These were decided by the operator with reasoning recorded. Re-deriving them is
a known failure mode here, not a contribution. Treat each as a constraint.

- **Command's instrument does not shrink to make room for a panel.** Two prior
  revisions did this. Content needing centre-column space belongs in Project mode.
- **The next-action sentence was removed from Command deliberately.** Do not
  propose adding it back.
- **Tier counts were removed and `projectTiers.ts` deleted with them.** Do not
  propose reinstating them as a smaller legend.
- **Depth-1 constellation edges stay.** They were measured at ~85% redundant ink,
  removed, and restored the same day because removal looked worse. Ink redundancy
  measures information content; those edges carry *grouping*. **If you find
  yourself computing edge redundancy and concluding they should go, you have
  re-derived a tested and reverted conclusion.**
- **Equal ring segment widths and fixed bearings by stable code-point `project.id`
  order.** The ring's whole claim is that a status change cannot move anything.
- **Segments-become-panel-windows** is a settled design direction with no code.
  Do not design it further and do not propose starting it.
- **`thinking.display` stays `omitted`**; there is **no non-streaming fallback
  path** (two paths means one gets pinned and the other drifts — this project has
  four documented instances of exactly that).
- **The write gate's shape.** Out-of-vault writes are rejected, never confirmed.
  Every call site *declares* its `WriteIntent`; the gate never infers one.

Also out of scope: research-mode force graph, model switching, semantic zoom,
idle/wake dimming — all deferred deliberately.

---

## 4 · Evidence standard

This project distinguishes tiers of evidence and requires you to name yours.
Tag every factual claim:

- **[V]** — verified: you read the code, ran the command, or measured the output.
- **[A]** — assumed: inferred, or carried from a document you did not re-check.

**Do not cite this document, `docs/HANDOFF.md`, or any other prose as evidence
for a claim about the code.** Briefs in this project have contained false
premises in nearly every round, including ones written by the operator. Verify
against source. If this brief contradicts the code, **the contradiction is the
finding** — report it rather than picking one silently.

### Five ways a check here has passed while covering nothing

Each cost a round. Watch for them in what you *conclude*, not only in what you read:

1. Assertions that assert nothing.
2. Tests that skip silently.
3. Fixtures that are silently malformed — a hand-rebuilt fixture producing an
   empty result looks exactly like the code being broken.
4. Loops that discard their own cases.
5. Tests written from documentation that is correct about a configuration this
   project does not run.

And the one that matters most for a review like this:

> **An analysis error that fails toward the expected conclusion is the one nobody
> questions.** Attribute by coordinate, abort loudly, never default silently.

---

## 5 · Measured baselines

Given so you do not have to re-derive them, and so size alone is not mistaken for
a finding. Measured at `eff5a64`.

| Area | LOC | Note |
|---|---|---|
| `src/` total | 17,052 | |
| `src-tauri/src/` total | 9,730 | |
| `src/styles.css` | 5,208 | one file |
| `LibraryPanel.tsx` | 1,554 | largest component |
| `delegation.rs` | 1,135 | largest Rust file |
| `projectRing.ts` + harness | 1,092 + 1,056 | ~1:1 test-to-code |
| `assistant.rs` | 996 | includes contract tests |
| markets + weather (Rust + panels + types) | ~951 | |
| docs, 9 markdown files | 3,595 | `HANDOFF.md` alone is 1,949 |

**The ~1:1 harness ratio on `projectRing` is deliberate and defended.** Do not
report it as duplication without engaging the reason: the harness has caught
geometry bugs twice on assertions written before the change, neither findable by
reading the code.

Verification commands that work headlessly:

```bash
npm install && npm run build                     # tsc + vite; needs node_modules
cargo test --lib --manifest-path src-tauri/Cargo.toml   # needs GTK/webkit2gtk on Linux
```

The three frontend harnesses (`projectRing`, `pantheonRecord`, `glyphState`) run
through Vite's SSR loader without a browser; `docs/HANDOFF.md` §6 has the method.
All three pass at `eff5a64`, as does `npm run build`.

---

## 6 · Three hypotheses to attack, not confirm

These are the reviewing party's current beliefs. **They are stated so you can try
to refute them.** Confirming them adds little; refuting one is worth more than
agreeing with all three. If you find the evidence supports one, say what would
have changed your mind.

1. **Markets and weather are a different product.** ~951 LOC, two external APIs,
   a `FRED_API_KEY` requirement, two panels and an `AmbientDock` — none of it
   named in the manual's purpose or its six priorities. Hypothesised as residue
   from an earlier personal-dashboard conception. *Refutation would look like:* a
   stated goal it genuinely serves, or a load-bearing dependency on it elsewhere.

2. **Effort inversely tracks stated priority.** Priority #2 (delegation) is the
   largest Rust file and has, per the project's own record, never completed a
   real approved run. Priority #3 (curated memory — promoting a chat decision
   into a vault note) is called the premise the project rests on and is not
   built. The unlisted markets/weather is complete and working. *Refutation would
   look like:* delegation being a prerequisite for the memory loop, or the memory
   loop being substantially present under another name.

3. **The doc layer is bloated in a way the code is not.** 3,595 lines across 9
   files against a 189-line canonical manual, with `HANDOFF.md` doing four jobs
   at once (currency ledger, design record, methodology manual, work queue) and
   three other files overlapping it. Each can go stale independently — the exact
   failure the handoff's own currency header exists to fight. *Refutation would
   look like:* the overlap being smaller than it appears, or the redundancy being
   load-bearing.

---

## 7 · Deliverable

Prose, not a patch. No code changes.

For each finding:

- **Claim**, in one sentence.
- **Evidence** — file and line, or the command you ran. Tagged **[V]** or **[A]**.
- **Cost of leaving it** — what it makes harder, concretely. "Would be cleaner"
  is not a cost.
- **What you would do instead**, and what that would break.

Rank by cost of leaving it, not by size. **A short list you are confident in
beats a long one.** If a section of the codebase is well-arranged, say so and
move on — a review that finds something wrong everywhere is not credible here.

Explicitly flag anything in this brief you found to be false.
