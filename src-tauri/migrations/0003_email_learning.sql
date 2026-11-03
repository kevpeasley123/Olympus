-- Explicit, source-scoped feedback. Original mailbox records remain authoritative.
CREATE TABLE email_learning (
    account_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (account_id, thread_id)
);
