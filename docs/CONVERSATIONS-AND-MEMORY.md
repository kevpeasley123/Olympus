# Conversations and memory

Approved by Kevin on 2026-10-13: Olympus keeps every conversation and remembers
automatically, the way ChatGPT and Claude do. You never approve a memory; you
can read and edit everything Olympus remembers, in Obsidian, at any time. This
replaced the earlier "not every exchange earns a vault note" decision.

## What Kevin sees

- **Separate chats.** Each launch opens a new chat. The console's chat list
  shows earlier chats newest first, with titles, and searches every message.
  A chat can be reopened, renamed or deleted.
- **Temporary chat.** A toggle for a throwaway chat: it is never saved, never
  written to the vault, and neither uses nor creates memory.
- **Chats in Obsidian.** Each saved chat becomes one note in
  `10 - Conversations/<year>/<month>/`, with its title, date, summary and full
  transcript. Olympus rewrites the note as the chat continues.
- **Automatic memory.** `09 - System/Olympus Memory.md` holds what Olympus has
  learned: about Kevin, his preferences, each project, and what is in progress.
  Olympus updates it in the background after a chat goes quiet. Kevin can edit
  it in Obsidian; his edits are read back and win.
- **Recall.** Saved chats join the memory index, so a relevant past chat comes
  back on its own, labelled with its source.
- **Controls** (Preferences > Memory): save chats to Obsidian, learn from chats,
  use what Olympus remembers. Turning learning off stops new updates; it does not
  delete the note.

## How it works

**Storage.** SQLite stays the working store. Migration 2 adds a
`conversations` table, a `conversation_id` on every message, and a
`conversation_search` full-text index. Existing history is split into chats at
gaps of more than four hours; rows imported from the browser era form one chat.

**Writing to the vault.** Both notes are Olympus-authored. They go through the
write gate with a new intent, `MaintainAuthored`: Olympus reads the note's
current bytes, folds any edits Kevin made into its new version, and replaces
the file only if those bytes are unchanged at write time. It never asks first.
Every write gets its own vault Git commit, so any change can be seen and undone.

**The memory pass.** A background worker runs while Olympus is open. When a
saved chat has been quiet for ten minutes and has messages the pass has not
seen, it:

1. sends the current memory note, the chat's new messages (bounded) and today's
   date to the primary model route as one structured request;
2. receives a chat title (unless Kevin renamed it), a one-paragraph summary, and
   the complete updated memory, organised by section, with time-sensitive facts
   rewritten ("going to Singapore in July" becomes "went to Singapore in July
   2026");
3. writes the memory note and the chat note, and records the request with
   purpose `memory` in the model diagnostics.

One request per quiet chat. Earlier chats from before this change are saved to
the vault but not learned from automatically; Preferences > Memory offers to
learn from them, with the count shown first.

**Using memory.** Each request includes the memory note in its own section,
labelled as learned from conversations: Kevin's own notes, his current
instructions and the current project vision outrank it. Temporary chats skip
it, and skip recall.

## Safety rule change

Until 2026-10-13, Olympus kept every model inference out of the assistant's
context, because an inference read back looks like an instruction. The new rule:
learned memory reaches the model only through its labelled, lower-authority
section; it is always visible and editable as a plain note; every change is a
Git commit; and Temporary chat bypasses it. `09 - System/Profile Observations.md`
stays excluded.

## Cost

The memory pass is a paid OpenAI request, about one per chat that goes quiet. It
uses the same route as chat. Turning off "Learn from chats" stops it.
