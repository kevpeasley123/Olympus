# Handoff — 2026-07-27

Current as of `16f9280`. Read `OLYMPUS-BRIEF.md` for the longer history; this
covers the state a fresh session would otherwise get wrong, and the decisions it
would otherwise undo by being helpful.

**Confirm anything here against the code before acting on it.** That instruction
is not boilerplate — the brief has been wrong in every session that has read it.

---

## Decisions that will be undone unless the reasoning survives

These are recorded with their reasoning because the reasoning *is* the decision.
A summary of the conclusion alone invites a fresh session to reverse it.

### The graph gate: do not seed links to open it

The vault graph renders only when **two or more project notes each have at least
one edge** (`connected_project_count` in `commands/vault_graph.rs`). Today:

```
projects=8   connectedProjects=1   hop1=13   →  graph correctly OFF
```

The obvious way to switch it on is to write `[[wikilinks]]` into the project
notes. **Do not.** Nothing in the vault references any of those seven projects.
Every link would be one invented to make a picture appear, and the graph's whole
claim is that radius means distance from real work. Seeded links would make it
say something false while looking correct — which is worse than it being off.

The gate opens as the operator uses the vault and real links accumulate. That is
a consequence of use, **not a task to complete.**

The earlier version of this gate counted anchors and read a *global* hop-one
count that one note already satisfied. Adding a second project note would have
walked through it and rendered a bare dot beside the real cluster — the empty
picture the gate exists to prevent, through a door nobody checked.

### Project classification: six notes carry today's date on purpose

All eight projects in `01 - Projects/` are now declared — zero unclassified.

| Project | status | created | why |
|---|---|---|---|
| Olympus | `active` | 2026-04-25 | the one active project, and the only `next_step` |
| Pokedex | `watching` | 2026-03-24 | first commit date; 328 commits, real history, not current work |
| Obsidian Visual Project | `scaffold` | 2026-07-27 | repo exists, **zero commits** — a stub, not work in progress |
| Agentic AI Scaffolder | `scaffold` | 2026-07-27 | folder only |
| AI Learning Course | `scaffold` | 2026-07-27 | folder only |
| Fidelity Agentic AI Development | `scaffold` | 2026-07-27 | folder only |
| Fruit Organizer | `scaffold` | 2026-07-27 | folder only |
| Health app | `scaffold` | 2026-07-27 | folder only |

**Six carry today's date because there is no commit to date them by.** That is
honest, not sloppy — do not "fix" it by inventing earlier dates from folder
mtimes, which is exactly the inference the tiering work removed when `status`
used to come from a folder's modification time.

`next_step` is deliberately absent from the seven non-active notes. It only
affects the active project's centre sentence, and placeholder text would render
as advice while carrying no information.

---

## The day arc filters to TODAY, not the last 24 hours

`buildTicks` in `services/dayArc.ts` keeps only events from the current
**calendar day**. The ring shows one day: an event from yesterday evening would
land at the same angle as this evening and read as something that has not
happened yet.

**The expected tick count therefore moves as the date rolls.** At the time of
writing there were 5 commits in the last 24 hours but only 2 from today, so the
arc showed 2. A session reading an older report that said "expect 4" and seeing
2 would call it a bug. It is the filter.

Write ticks come from `processing_logs` where `event_type = 'vault-write'`. That
table is currently **empty** — no gated write has been approved since the
logging landed — so zero write ticks is correct, not a failure.

---

## State

**Verified this session**

- **Reduced motion, against the real OS setting.** With it on, `.day-arc__now`,
  `.instrument-activity`, `.instrument-arc.is-dirty`, `.instrument-dot` and the
  header's `.ring-outer/.middle/.inner` all report `animation: none`; arcs, dots,
  ticks and hover labels stay present and clickable; parallax transform is
  `none`. **The OS setting was restored to `1`** (animations on), its original
  value.
  The bug this found: the media block sat mid-file while every animation added
  after it lived further down. A media query adds no specificity, so those rules
  had only ever won by source order — and had been losing for three rounds.
  **The block is now last in `styles.css` and anything added below it is
  unguarded.**
- **`tauri build` succeeds.** MSI and NSIS bundles at
  `C:/Users/kevpe/dev-target/olympus/release/bundle/`. **The NSIS installer is
  what fixes the taskbar pin** — pinning the dev binary breaks on every rebuild
  because cargo deletes and recreates the file, so Windows sees a new identity.
- **Commit ticks**, by a test that asserts against this repository and fails on
  an empty result rather than passing on one.
- **The scaffold-exclusion rule**, against the real vault: 18 files excluded,
  and both the "Test entry" and the stray `Design Inspirations/README.md` kept.
  Scaffolding is excluded because it was never meant to link; debris is a real
  finding and stays.

**Not verified, and one of them cannot be by an agent**

- **The write pulse has never fired.** Approving a gated write requires a click
  in the Tauri window, which an agent cannot drive — the app is only observable
  through Chrome against the dev server, where `invoke` does not exist. Agent
  file writes go straight to disk and bypass the gate entirely, so they will
  never trigger it. **Pantheon → Add Entry is the way to close this**, and it
  exercises the omega pulse and the day arc's first write tick together.
- The day arc drawing **real** commit and write ticks. The data layer is proven;
  the browser cannot render it because it has no `invoke`.
- The graph rendering at all, since its gate is correctly closed.
- Whether the built executable **launches**. `tauri build` producing bundles and
  the app running are separate questions, which is the distinction this project
  keeps relearning.

---

## Vault notes are not in this repository

`01 - Projects/*.md` lives in the Obsidian vault at
`Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`, which is **not a git
repository**. The eight project notes written this session are therefore not
version-controlled anywhere. Committing them requires `git init` in the vault
first — a decision about the operator's memory layer, not a housekeeping step,
and one that interacts with OneDrive sync.

---

## Next

Nothing in the six-task redesign brief is outstanding. The real remaining work
is the set of dependencies that make the library function:

- **The assistant reads research titles, never bodies.** Under the curriculum
  framing that is the premise unmet. Needs a tool-use loop (`read_vault_note` /
  `search_vault`). Research chat must not be general chat with vault context
  bolted on — an assistant that paraphrases notes it never opened teaches the
  operator not to trust the mode.
- **`04 - Decisions` is invisible to the assistant**, in both `STABLE_NOTES` and
  the Pantheon index. Contradiction detection is impossible until it isn't.
- **Decompose `LibraryPanel.tsx`** (~1400 lines).
- **Writing `next_step` from the UI.** Booked as its own session: it is the first
  use of the modify-existing-lines tier on a file Olympus did not author, so it
  needs a `WriteIntent` arm and gate wording done properly. The argument for it
  is the YAML colon hazard — a field that serialises correctly beats hand-editing
  frontmatter and losing a key silently.
