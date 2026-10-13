# Curated memory — implementation and verification

Shipped in 0.3.0 (`5cdc397`). Two later changes govern how to read this file:

- Since 0.26.0 (`2dcdeec`) the default request path is indexed memory retrieval, described in [MEMORY-RETRIEVAL.md](MEMORY-RETRIEVAL.md). The per-turn research selection and the bounded Decision Log context described under Behavior run only when `OLYMPUS_MEMORY_MODE=legacy` is set.
- Chat promotion to the Decision Log has been removed; see the last section.

## Behavior (legacy memory mode)

For each assistant turn, Rust uses the latest user question to select relevant Pantheon body excerpts. Matching is local and lexical, with a small normalization vocabulary for agents and orchestration. Title matches weigh more than body matches. A body-only match generally needs two distinct query terms; unrelated questions and empty queries supply no body excerpts. Ties break by source path.

The selection is limited to three sources and 4,000 Unicode characters per body. Long sources are windowed around relevant text, not always truncated at the beginning. Partial excerpts are labelled. Source title, vault path, available date, stance, origin, and full-body fingerprint travel with the excerpt. The index remains available separately; selection does not make the entire library standing context.

Research evidence is serialized as quoted JSON data after the prompt-cache breakpoint. Prompt policy explicitly rejects source instructions, distinguishes unevaluated/disputed sources from endorsed guidance, and requires attribution when deriving advice. This is an authority boundary in the prompt, not a guarantee that a language model cannot misinterpret a source.

Replies return a research snapshot separately from model prose. Chat exposes it in a disclosure labelled **Research supplied to this reply** (since 2026-09-28 each source there has **Open in library**; see below). SQLite's new `conversation_research` table stores the snapshot alongside the message; existing databases gain the table through the existing idempotent schema application. Old messages deserialize with no research snapshot. The snapshot says what was supplied, not what the model necessarily used or endorsed. In the default indexed mode the snapshot is empty, so the disclosure appears only on legacy-mode replies; indexed evidence is shown in the reply's model attribution disclosure (see MEMORY-RETRIEVAL.md).

## Chat promotion (removed)

Chat has no promotion button. Since 2026-10-13 chats and learned memory reach
the vault automatically instead; see
[CONVERSATIONS-AND-MEMORY.md](CONVERSATIONS-AND-MEMORY.md). The Save memory button went in 0.28.0
(`74fd5de`) and the Observation button in 0.30.0 (`a155cd5`), both at Kevin's
direction; their backend commands, `promote_chat_memory` and
`append_profile_observation`, were deleted on 2026-10-12. Entries already in
`04 - Decisions/Decision Log.md` still reach the model: through the bounded
historical context in legacy mode, or when indexed retrieval selects them.
`09 - System/Profile Observations.md` is never read into context. The design and
verification of the removed path are in this file's history as of `eaae7df`.

## Research library and the evidence path — September 28, 2026

Design-review items U3, U5, U7 and F3. Code: `LibraryPanel.tsx` and
`src/components/panels/library/` (`libraryModel.ts` holds the pure rules, tested by
`scripts/test-library.mjs`); `pantheon.rs` for the new entry fields. The retrieval
behaviour above is unchanged.

**Views.** The Library | Questions (verified) | Audits segmented control was
removed in 0.30.0 (`96c97e8`); Research now opens on the library. A saved
verification run opens in Research only when inspected from an agent's recent runs
in Command's Armory, with **← Research library** to return; knowledge audits have no view in the app.
Migrate is an inline notice rather than a header control.

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
longer appears. The same destination serves Open entry from saved verification runs,
worded for that context. The body fingerprint that
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

Approval provenance followed in 0.3.0 (`OPERATOR-APPROVAL-DESIGN.md`); current next steps are in `docs/NEXT-SESSION.md`. Neither the memory implementation nor a test passing authorizes delegated work.
