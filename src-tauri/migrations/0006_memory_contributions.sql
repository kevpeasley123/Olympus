-- Prepared results survive a crash between the vault write and the watermark.
CREATE TABLE memory_contributions (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 from_watermark INTEGER NOT NULL,
 through_watermark INTEGER NOT NULL,
 source_revision TEXT NOT NULL,
 source_refs_json TEXT NOT NULL,
 provider TEXT NOT NULL,
 route_binding_json TEXT NOT NULL,
 request_id TEXT,
 state TEXT NOT NULL CHECK(state IN ('claimed','prepared','applied','failed','superseded')),
 attempts INTEGER NOT NULL DEFAULT 1,
 before_note TEXT,
 result_note TEXT,
 answer_json TEXT,
 error TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX memory_contributions_recovery ON memory_contributions(conversation_id,from_watermark,source_revision,state);
