-- Additive journal. Existing snapshots are not fabricated into historical events.
CREATE TABLE communication_situation_changes (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 account_id TEXT NOT NULL,
 situation_id TEXT NOT NULL,
 revision TEXT NOT NULL,
 input_digest TEXT NOT NULL,
 previous_revision TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('initial','reconciled','operator_feedback')),
 event_time INTEGER,
 observed_at TEXT NOT NULL,
 claim_status TEXT NOT NULL,
 source_refs_json TEXT NOT NULL,
 feedback_refs_json TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 UNIQUE(account_id,situation_id,revision)
);
CREATE INDEX communication_situation_changes_scope ON communication_situation_changes(account_id,situation_id,sequence);
