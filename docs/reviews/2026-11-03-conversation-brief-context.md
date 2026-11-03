# Conversation context briefing review

Date: November 3, 2026 UTC. Base 9c76ca2, local unreleased work on
codex/gmail-learning-intelligence. One fresh-context read-only review by
GPT-6 Astra at high reasoning, as required by the inline execution skill.

## Findings and one repair pass

No Critical or separate Minor findings. Three Important findings were reproduced
with failing tests and repaired in one pass:

1. A 260-character clip could retain an obsolete proposal and drop the final
   correction. Remembered summaries now preserve all bounded native text. The
   TypeScript pipeline asserts the complete three-sentence summary, and the real
   ChatPanel fixture checks that the final correction fits its reading area at
   desktop and narrow widths.
2. Selecting a single chat before receipt suppression starved unseen eligible
   chats. All native candidates now enter selection; receipts apply first, stable
   native recency ordering is preserved, and only one context highlight can be
   selected among three total highlights. A fixture delivers three chats across
   successive openings, including a newest ID that sorts last lexically.
3. A display digest containing the learning watermark resurfaced identical context
   after assistant-only bookkeeping. The digest now tracks title, summary and
   user evidence. The full projection still detects incomplete/new learning for
   publication. The actual worker fixture appends an assistant-only briefing,
   proves no analyzer is invoked, confirms identical display identity after the
   worker advances its watermark, then feeds that output through TypeScript
   receipt suppression. Subsequent user correction still invalidates old context.

Before review, failing/passing regressions also repaired unreadable memory-setting
handling, private delivery receipts and inaccurate project-only/no-model
attribution. The history annotation preserves lower authority of remembered context.

## Judgments and scope

- Keep clearly labelled recalled summaries alongside independent email/project
  evidence; no name-based semantic fusion. This proves the plumbing, not useful
  live model reasoning, and can still surface context that is not relevant enough.
- Retain ignored local evidence because cloud skill helper scripts are not locally
  available. The cost is manual bookkeeping and local disk usage.
- Live analyzer quality, semantic fusion and cross-source identity inference remain
  gated follow-on work. Cost: live understanding has not been demonstrated.
- Native WebView2/Tauri acceptance and real Gmail recovery remain unverified.
  Cost: browser fixtures do not establish desktop behavior or account recovery.
- Obsidian note/index capture, correction reconciliation and retrieval quality stay
  in Kevin's requested later audit. Cost: SQLite summary consumption does not prove
  that Obsidian's broader knowledge is informing briefs.
- Natural conversational correction wiring remains the next implementation work.
  Cost: this milestone preserves corrections already in summaries but does not
  connect ordinary corrections to the email feedback API.

No deferred minor findings. No second review was dispatched; the fixes are verified
by failing/passing regressions and the full offline suite.

## Evidence and verification boundary

Evidence is retained under output/conversation-brief and
output/briefing-memory-browser. The native fixture uses an in-memory database,
a temporary Git vault and a synthetic analyzer, then actual recall, projection,
TypeScript preparation, invalidation and receipt handling. Real ChatPanel rendering
uses synthetic browser data and blocks external requests. It adds no product
controls or categorization workflow.

Final full-suite results are recorded in ../NEXT-SESSION.md. Source completion
is separate from installation and live acceptance. No generation gate, production
operational database, credential or startup setting was changed.
