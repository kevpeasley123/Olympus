CREATE TABLE IF NOT EXISTS working_checkpoints (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    revision INTEGER NOT NULL,
    through_watermark INTEGER NOT NULL,
    checkpoint_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(conversation_id, scope)
);
