# Curated memory — implementation and verification

Status: included in installed release 0.3.0 (`5cdc397`), integrated into local `master`. See `HANDOFF.md` for installation evidence and remaining desktop acceptance.

## Behavior

For each assistant turn, Rust uses the latest user question to select relevant Pantheon body excerpts. Matching is local and lexical, with a small normalization vocabulary for agents and orchestration. Title matches weigh more than body matches. A body-only match generally needs two distinct query terms; unrelated questions and empty queries supply no body excerpts. Ties break by source path.

The selection is limited to three sources and 4,000 Unicode characters per body. Long sources are windowed around relevant text, not always truncated at the beginning. Partial excerpts are labelled. Source title, vault path, available date, stance, origin, and full-body fingerprint travel with the excerpt. The index remains available separately; selection does not make the entire library standing context.

Research evidence is serialized as quoted JSON data after the prompt-cache breakpoint. Prompt policy explicitly rejects source instructions, distinguishes unevaluated/disputed sources from endorsed guidance, and requires attribution when deriving advice. This is an authority boundary in the prompt, not a guarantee that a language model cannot misinterpret a source.

Replies return a research snapshot separately from model prose. Chat exposes it in a disclosure labelled **Research supplied to this reply** (since 2026-09-28 each source there has **Open in library**; see below). SQLite's new `conversation_research` table stores the snapshot alongside the message; existing databases gain the table through the existing idempotent schema application. Old messages deserialize with no research snapshot. The snapshot says what was supplied, not what the model necessarily used or endorsed.

## Deliberate promotion

**Save memory** opens an editable title and memory text, seeded from a chat message. Title is limited to 120 characters; memory text to 2,000. Oversized text is rejected, never silently shortened.

The backend resolves the source message from SQLite by ID. It appends to the fixed Decision Log path, includes the original message role, ID, content fingerprint, a labelled source excerpt, and supplied research provenance. User-entered text and source content are quoted separately from app-authored provenance. The entry states that it is historical memory, not a task commitment or delegation approval.

The existing write gate previews the entire proposed addition. Decline, timeout, or a lost confirmation denies the write. Changes to the source message or note while review is open reject it. Read errors are not treated as missing files. App-internal promotions are serialized; the append preserves existing bytes and stages a unique sibling file before replacement. External editors do not participate in an OS-wide lock, so a concurrent external write at the final replace remains a narrow filesystem race.

Successful writes enter the vault-write log and receive an exact-file Git commit. A Git failure is reported as “saved, but commit failed,” so it does not encourage a duplicate submission. Promotion grants no process-launch authority and never writes `next_step`.

On the next assistant turn, the new entry enters the existing bounded historical Decision Log context. Profile Observations remain excluded. Model/API selection is unchanged.

## Verification on 2026-09-06

- Production TypeScript/Vite build passed.
- 185 Rust tests passed, including new retrieval, late Unicode excerpt, irrelevant-query, source exclusion, prompt authority, real-vault retrieval, persisted provenance, missing source, append preservation, concurrent edit, and read-error cases.
- Existing `projectRing`, `pantheonRecord`, and `glyphState` frontend harnesses passed.
- Browser review exercised the memory composer, disabled empty-title submission, populated title, desktop-only fallback, and scroll access to save/cancel controls at a 1280×720 viewport. The initial clipping defect was corrected.
- The installed 0.2.1 app was launched at the operator's request and its native window was verified responding. It is not this branch's runtime acceptance evidence.
- Existing build warnings remain (browser `buffer` externalization, a large bundle, dependency `eval`, and one unused Rust field). Rustfmt was unavailable in the installed toolchain.

## Remaining acceptance work

Run this branch in a desktop development build with its own database/identifier before installing it. Use a disposable test vault for write exercises; the current backend vault path is fixed, so a test build must deliberately isolate that configuration rather than pretending browser fallback is desktop verification.

1. Ask “Should Olympus orchestrate coding agents?” Verify the answer can cite actual supplied arguments, distinguish source stance, and compare them with the Charter and decisions.
2. Inspect source disclosure and restart; confirm the same source snapshot is retained.
3. Save a real persisted message as memory. Review all added text, decline once, then approve a separate attempt. Verify both outcomes and exact-file Git attribution.
4. Ask a subsequent question about the promoted memory; verify historical framing and provenance.
5. Exercise a note/source edit while confirmation is pending; confirm rejection preserves the newer content.

No live model answer or desktop promotion was exercised this session. Unit tests prove selection and write helpers, not the quality of a model's reasoning or the complete desktop flow.

## Research library and the evidence path — September 28, 2026

Design-review items U3, U5, U7 and F3. Code: `LibraryPanel.tsx` and
`src/components/panels/library/` (`libraryModel.ts` holds the pure rules, tested by
`scripts/test-library.mjs`); `pantheon.rs` for the new entry fields. The retrieval
and promotion behaviour above is unchanged.

**Views.** The Research header has a Library | Questions (verified) | Audits
segmented control. Each view takes the full height; the Questions and Audits
inspectors stay mounted and keep their scroll, and catalog deep links select
Questions. Migrate is an inline notice rather than a header control.

**Reading position.** View, query, section, sort, open entry, arrival context, list
and detail scroll, and the last unsent Add Entry draft live in the session `research`
slice, so a mode switch or refresh returns to the same place. Opening an entry parks
the list scroll, starts the entry at the top and focuses its title; Back or Escape
restores the list scroll and focuses the row it came from. All entries renders 250
rows at a time and extends as the reader nears the end, or on Show all. Session
state is lost on app restart.

**Open in library from chat.** A reply's research source opens the entry by vault
path (`openResearchEntry` with the source file, the supplied excerpt and the
fingerprint stored with the reply). The entry's header then says where it was
opened from and compares fingerprints:

- **Unchanged since this reply** — the stored fingerprint equals the entry's
  current body fingerprint or its whole-file fingerprint. A reply stores the body
  fingerprint; Research Verification stores the whole file's; either matching means
  that text is unchanged.
- **Changed since this reply** — both differ. The text supplied then is shown
  apart from the current file as historical text, open by default.
- **Source no longer in library** — nothing at that path is in the library now
  (moved, renamed, untagged or deleted); the historical excerpt is still shown.
- **Change not checked** — no fingerprint was stored or none is available now; no
  comparison is claimed.

When the excerpt still occurs in the current file, it is highlighted in place with
the CSS Custom Highlight API (nothing is inserted into the article) and the view
jumps to it; **Show excerpt** returns to it. Otherwise the header says the excerpt no
longer appears. The same destination serves Open entry from saved verification runs
and knowledge audits, worded for that context. The body fingerprint that
`fetch_pantheon_entries` now returns is computed as retrieval computes it, survives
frontmatter-only edits and changes with the body (Rust tests).

**Search.** Two tiers. Title and metadata matches come first — title, category,
type, source, stance, origin, why kept, project and the tags the operator chose.
Entries that match only with the body's help follow under "Also mentioned in body
(n)", 100 at a time, with a snippet. Automatic tags (`olympus/research`,
`olympus/pantheon`, `research/…`, `pantheon/…`) are not searched, so "Olympus" no
longer matches the whole library. Every term must match. Sidebar counts follow the
search. `/` focuses the search box outside text fields; Escape in the search box clears it, and elsewhere in the library steps back from an open entry before clearing the search.

**Lists.** Stance marks carry a word and a shape (✓ Endorsed, ◐ Provisional,
▲ Disputed, ◌ Unevaluated), never colour alone. **Recently added** orders by the
entry's `created` date, falling back to the file's modification date; All entries
can also sort by publication date or title. Guide, Paper and Talk keep their type.

**Entry detail.** A metadata rail shows source, link (opened through
`open_external_link`), published, added and modified dates, project, tags, vault
path and Open in Obsidian. Reading text is 15.5px at 1.65 line height and 68
characters wide.

**Wikilinks and attachments.** `[[target]]` opens the matching library entry
(resolved by title or by vault-relative, research-relative or bare file path) and
otherwise renders as plain text. `![[_attachments/…]]` renders as "Attachment ·
name · Open"; Open calls `open_vault_note` and is offered only for a file directly
under `02 - Research/_attachments/` with an allowed extension (pdf, png, jpg, jpeg,
webp, txt, md), never an absolute path, a drive letter or a path containing `..`.
Anything else renders as inert text with its path. Remote images render as links,
not fetches; raw HTML is not rendered as HTML.

**Add Entry.** Closing with any edited field asks Keep editing / Keep as draft /
Discard; Escape, the backdrop, Cancel and × all ask. Keep as draft holds the last
unsent entry in session memory, and Add Entry offers **Restore** (or Discard it) until
it is saved or discarded; the entry being read is never closed by the dialog. A project can be
chosen. If the attachment was copied into the vault but the entry write then
failed, the error names the attachment's vault path and the retry reuses that copy
rather than copying again (the one-use token is already spent).

Verification: build; `scripts/test-library.mjs` (search tiers and tag exclusion,
dirty detection over every field, fingerprint states, wikilink and attachment
resolution, source types, ordering, excerpt location); Rust tests for entry
fingerprints and source URL; mock checks at four sizes. Not verified in the desktop
app, including the `open_vault_note` and `open_external_link` round trips.

## Subsequent work

Review `OPERATOR-APPROVAL-DESIGN.md` before implementing approval provenance. Then implement evidence-based completion and perform the real delegation acceptance run. Neither the memory implementation nor a test passing authorizes the pilot automatically.
