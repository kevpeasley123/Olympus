# Curated memory — implementation and verification

Status: included in installed release 0.3.0 (`5cdc397`), integrated into local `master`. See `HANDOFF.md` for installation evidence and remaining desktop acceptance.

## Behavior

For each assistant turn, Rust uses the latest user question to select relevant Pantheon body excerpts. Matching is local and lexical, with a small normalization vocabulary for agents and orchestration. Title matches weigh more than body matches. A body-only match generally needs two distinct query terms; unrelated questions and empty queries supply no body excerpts. Ties break by source path.

The selection is limited to three sources and 4,000 Unicode characters per body. Long sources are windowed around relevant text, not always truncated at the beginning. Partial excerpts are labelled. Source title, vault path, available date, stance, origin, and full-body fingerprint travel with the excerpt. The index remains available separately; selection does not make the entire library standing context.

Research evidence is serialized as quoted JSON data after the prompt-cache breakpoint. Prompt policy explicitly rejects source instructions, distinguishes unevaluated/disputed sources from endorsed guidance, and requires attribution when deriving advice. This is an authority boundary in the prompt, not a guarantee that a language model cannot misinterpret a source.

Replies return a research snapshot separately from model prose. Chat exposes it in a disclosure labelled **Research supplied to this reply**. SQLite's new `conversation_research` table stores the snapshot alongside the message; existing databases gain the table through the existing idempotent schema application. Old messages deserialize with no research snapshot. The snapshot says what was supplied, not what the model necessarily used or endorsed.

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

## Subsequent work

Review `OPERATOR-APPROVAL-DESIGN.md` before implementing approval provenance. Then implement evidence-based completion and perform the real delegation acceptance run. Neither the memory implementation nor a test passing authorizes the pilot automatically.
