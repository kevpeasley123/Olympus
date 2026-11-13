-- One normalized activity stream for every agent run (docs/AGENT-EVENTS.md).
-- run_id is the owning run's id in its own table (a delegation run today);
-- it is not a foreign key because later run kinds live in other tables.
CREATE TABLE IF NOT EXISTS agent_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    engine TEXT NOT NULL,
    agent TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT,
    tool TEXT,
    path TEXT,
    subagent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS agent_events_run ON agent_events(run_id, id);
