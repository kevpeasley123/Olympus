# Conversations and memory

Approved by Kevin on 2026-10-13: Olympus keeps every conversation and remembers
automatically, the way ChatGPT and Claude do. You never approve a memory; you
can read and edit everything Olympus remembers, in Obsidian, at any time. This
replaced the earlier "not every exchange earns a vault note" decision.

Released in 0.33.0 (2026-10-13). Verified in a Linux container only: not yet
run in the desktop app, against Kevin's database, or with a real paid memory
request (see `docs/RELEASES.md`).

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
  learned, in five sections: About Kevin, Preferences, Projects, In progress,
  Other. Olympus updates it in the background after a chat goes quiet. Kevin can
  edit it in Obsidian, and his edits are read back and kept.
- **Recall.** Each turn brings back up to three earlier chats that share words
  with the question, with their summaries and the matching lines, labelled as
  recall.
- **Controls** (Preferences > Memory):
  - **Save chats to Obsidian**, **Learn from chats** and **Use what Olympus
    remembers**, all on by default.
  - Turning learning off stops new updates; it does not delete the note.
  - The panel shows how many chats are saved, when Olympus last learned from a
    chat, and any chats it stopped retrying.
  - It offers to learn from the chats kept before this change, after saying how
    many paid requests that is.

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

1. **Learn**, when learning is on. One structured request on the primary route
   sends:
   - today's date;
   - the current memory note;
   - the chat's earlier summary;
   - its unseen messages, oldest first and bounded (4,000 characters a message,
     48,000 a pass; a longer chat continues in later passes, and nothing is
     skipped).

   It returns a title (kept if Kevin renamed the chat), a summary of the whole
   chat, and the complete updated memory sections. The request has 16,000
   output tokens, double a chat answer's, since it returns the whole note, and
   is recorded with purpose `memory` in Model diagnostics.
   - If only Olympus spoke since the last pass (a briefing added to a reopened
     chat), the messages are marked seen and no request is made.
   - A failure is recorded on the chat and retried after 30 minutes, then 60,
     then 120. After four failures in a row the chat stops retrying until Kevin
     turns learning off and on.
2. **Save the note**, when saving is on. A note written before the pass is
   saved again after it, so it carries the new title and summary.

If the vault is not reachable, nothing is attempted, so no paid request is spent.

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

- the memory note (at most 12,000 characters), as **learned memory, lower
  authority**: Kevin's own notes, what he says now and the current project
  vision outrank it;
- **earlier chats matching this question**: keyword recall from
  `conversation_search`, labelled as possibly unrelated.

Recall reads SQLite rather than the vault memory index, because the index
declines unscoped resumption questions ("what did we decide…") until a project
is named. The project scope a follow-up inherits comes from the open chat only.

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

The memory pass is a paid OpenAI request, about one per chat that goes quiet
with new messages from Kevin; a long chat can take more than one, and a failing
chat at most four in a row. It uses the same route as
chat. Turning off "Learn from chats" stops it. Learning from earlier chats is
one request per chat, started only from Preferences.
