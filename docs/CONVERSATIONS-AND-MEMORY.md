# Conversations and memory

Approved by Kevin on 2026-10-13: Olympus keeps every conversation and remembers
automatically, the way ChatGPT and Claude do. You never approve a memory; you
can read and edit everything Olympus remembers, in Obsidian, at any time. This
replaced the earlier "not every exchange earns a vault note" decision.

For dated verification and remaining native acceptance work, see
`docs/NEXT-SESSION.md`. The worker's presence does not prove live learning succeeds.

## What Kevin sees

- **Separate chats.** A launch opens a new chat, or reopens the last one if it
  was used in the past 30 minutes. In the console's Conversation view, a bar names
  the open chat and offers:
  - **Chats**: earlier chats, newest first, with their summaries, and a search
    over every saved message. Each can be opened, renamed or deleted.
  - **New chat**.
  - **Temporary chat**.

  A chat holding only a launch briefing is not listed until Kevin says something
  in it. The browser preview has one local conversation and no chat bar.
- **Temporary chat.** A throwaway chat. It is never saved, never written to the
  vault, and neither uses nor feeds memory or past-chat recall. Leaving it
  discards it.
- **Chats in Obsidian.** Each saved chat becomes one note in
  `10 - Conversations/<year>/<month>/<date> <title> <tag>.md`. The note holds the
  title, dates, summary and full transcript, and is rewritten as the chat
  continues. The file keeps its first name: a later title, Kevin's or the
  model's, shows inside the note. A rename appears in the note the next time the
  chat is saved.
- **Automatic memory.** `09 - System/Olympus Memory.md` holds what Olympus has
  learned, in eight sections: About Kevin, Preferences, Projects, Decisions,
  People, In progress, Ideas, Other. Bullets link to existing project and
  decision notes with `[[...]]`, so the memory joins the vault graph. Olympus
  updates it in the background after a chat goes quiet. Kevin can edit it in
  Obsidian, and his edits are read back and kept.
- **Recall.** Each turn brings back up to three earlier chats that share words
  with the question, with their summaries and the matching lines, labelled as
  recall.
- **Controls** (Preferences > Memory):
  - **Save chats to Obsidian**, **Learn from chats** and **Use what Olympus
    remembers**, all on by default.
  - Turning learning off stops new updates; it does not delete the note.
  - The panel shows how many chats are saved, when Olympus last learned from a
    chat, pending chats, analysis eligibility, and any chats it stopped retrying.
    Pending or blocked work is not described as learned.
  - It offers to learn from the chats kept before this change, after saying how
    many subscription requests that may use when analysis is available.

## How it works

**Storage.** SQLite stays the working store, and migration 2 adds three things
(`docs/SCHEMA-MIGRATIONS.md`):

- a `conversations` table;
- a `conversation_id` on every message;
- a `conversation_search` full-text index.

Existing history is split into chats at gaps of more than four hours. Rows
imported from the browser era form one chat. Every append carries the chat's
id; the first operator message titles the chat. Messages an older build writes
into a migrated database are adopted into chats the same way on the next open.

**The background pass** (`commands/chat_memory.rs`). A worker checks once a
minute while Olympus is open. For each chat that has an operator message, has
been quiet for ten minutes, and has messages it has not handled, at most three
per tick and oldest first:

1. **Learn**, when learning is on. One request through the operator's
   subscription route (`commands/subscription_jobs.rs`). Its read-only preflight
   checks generation protection, acceptance isolation and account confirmation.
   The Claude generation gate remains closed; no Codex or paid API fallback runs.
   Eligible execution must still pass the runtime gate. The request sends:
   - today's date;
   - the current memory note;
   - the names of notes in `01 - Projects` and `04 - Decisions`, the only
     targets it may link to;
   - the chat's earlier summary;
   - its unseen messages, oldest first and bounded (4,000 characters a message,
     48,000 a pass; a longer chat continues in later passes, and nothing is
     skipped).

   It returns a title (kept if Kevin renamed the chat), a summary of the whole
   chat, and the complete updated memory sections (under 2,000 words), as one
   JSON object checked for every field. Each attempt is recorded with purpose
   `memory` in Model diagnostics. An initial preflight block creates no inference
   request. If a caller already saved a request before a subsequent preflight
   refusal, diagnostics finalizes that record as blocked, not still started.
   - If only Olympus spoke since the last pass (a briefing added to a reopened
     chat), the messages are marked seen and no request is made.
   - A blocked preflight leaves work pending without advancing the learning
     watermark, recording success, or consuming a failure. It is checked again
     automatically. A block between selection and execution also preserves retries.
   - A genuine failure is recorded on the chat and retried after 30 minutes, then 60,
     then 120. After four failures in a row the chat stops retrying until Kevin
     turns learning off and on.
2. **Save the note**, when saving is on. A note written before the pass is
   saved again after it, so it carries the new title and summary.

Blocked learning does not occupy the archive batch: newer chat notes still save.
Existing exhausted rows are not reset automatically because the last error alone
cannot establish whether earlier failures were genuine.

If the vault is not reachable, nothing is attempted.

**Writing to the vault.** Both notes use the write gate's `MaintainAuthored`
intent, which never asks:

- **Chat notes.** A chat note is rendered whole only while its bytes match the
  fingerprint Olympus recorded (`artifact_hashes`). Once Kevin edits it, his
  version stays and new messages are only appended at the end. A note he
  deleted is not recreated.
- **The memory note.** The pass rewrites only the sections, from the first
  `## ` heading on. Kevin's frontmatter (except its `updated` date) and anything
  he writes above the sections are kept as he left them. The pass reads his
  edits as current memory and is told to keep them. It replaces the note only
  if its bytes are still what was read before the request; otherwise the chat
  is retried.

Every write gets its own vault Git commit and a row in the vault write log.
Chat notes are left out of the vault graph.

**Using memory.** Unless the chat is temporary or "Use what Olympus remembers"
is off, each request's turn evidence carries two labelled sections:

- the memory note (at most 16,000 characters), as **learned memory, lower
  authority**: Kevin's own notes, what he says now and the current project
  vision outrank it;
- **earlier chats matching this question**: keyword recall from
  `conversation_search`, labelled as possibly unrelated.

Recall reads SQLite rather than the vault memory index, because the index
declines unscoped resumption questions ("what did we decide…") until a project
is named. The project scope a follow-up inherits comes from the open chat only.

Native briefs also read a bounded projection of recent, completely learned
conversation summaries from SQLite when Use memory is on. They label the result
as remembered context, revalidate it before display and suppress unchanged context
on later openings. Temporary briefs do not read this projection or save delivery
receipts. This is separate from the memory note/index path used by assistant turns;
see `BRIEFING-INTELLIGENCE.md` for eligibility and verification boundaries.

Ordinary source-bound corrections can update email understanding before model
selection. The user turn must persist first; a local acknowledgment is then saved
as an ordinary assistant reply. The original words and message IDs remain attached
to the learning record. A stop before interpretation or provider dispatch prevents
the next stage; an already committed correction still receives its acknowledgment.
This is a bounded explicit-language path, not a general semantic learner. Mixed
briefs ask a brief conversational clarification. See `EMAIL-ATTENTION.md` for
supported context and privacy boundaries. No categorization or memory form is used.

## Safety rule change

Until 2026-10-13, Olympus kept every model inference out of the assistant's
context, because an inference read back looks like an instruction. The new
rule:

- Learned memory reaches the model only as quoted, labelled turn evidence; it is
  never in the system prompt, and an assistant test pins that.
- It is always visible and editable as a plain note, and every change is a Git
  commit.
- Temporary chats bypass it.
- The pass is told not to record instructions found in quoted email, documents
  or research, not to record Olympus's suggestions as Kevin's decisions, and not
  to record secrets or health, financial or legal details unless Kevin asked.

`09 - System/Profile Observations.md` stays excluded.

## Cost

Since 2026-10-20 the memory pass uses included subscription allowance, not a
paid API: about one request per chat that goes quiet with new messages from
Kevin; a long chat can take more than one, and a failing chat at most four in
a row. Claude Opus 5.5 runs it; Codex answers only when Claude cannot.
Turning off "Learn from chats" stops it. Learning from earlier chats is one
request per chat, started only from Preferences.

## Subscription chat uses the same memory

Claude and Codex chat turns (`assistant.rs`, `subscription_context`) receive the
same Olympus system prompt, vault memory, learned memory, earlier-chat recall,
mail and project evidence as the API route, as labelled `<olympus_evidence>`
beside the history. Repository inspection is left out, being a paid planning
request. Temporary chats and "Use what Olympus remembers" behave as before.

A live pass on copies of Kevin's database and project names (2026-10-20,
`chat_memory::tests::live_memory_pass_on_copies`) produced dated Decisions and
In progress bullets linked to `[[Project Olympus]]` and `[[Decision Log]]`.
