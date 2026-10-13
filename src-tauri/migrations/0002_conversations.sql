-- Migration 2: separate conversations (docs/CONVERSATIONS-AND-MEMORY.md).
-- Existing messages are assigned to conversations by the Rust step that runs
-- after this file, in the same transaction.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  -- Who chose the title: derived from the first message, written by the memory
  -- pass, or typed by the operator. The memory pass never overwrites 'operator'.
  title_source TEXT NOT NULL DEFAULT 'auto' CHECK (title_source IN ('auto', 'model', 'operator')),
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- Split out of the single pre-2026-10-13 history; not learned from automatically.
  legacy INTEGER NOT NULL DEFAULT 0,
  vault_path TEXT,
  -- Highest message rowid already written to the vault note / seen by the memory pass.
  vault_watermark INTEGER NOT NULL DEFAULT 0,
  memory_watermark INTEGER NOT NULL DEFAULT 0,
  memory_attempted_at TEXT,
  memory_error TEXT,
  -- Failed memory passes in a row. Retries back off and stop at a limit, since
  -- each one is a paid request.
  memory_failures INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

ALTER TABLE conversation_messages ADD COLUMN conversation_id TEXT REFERENCES conversations(id);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
  ON conversation_messages(conversation_id, created_at);

CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search USING fts5(
  content,
  message_id UNINDEXED,
  conversation_id UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
