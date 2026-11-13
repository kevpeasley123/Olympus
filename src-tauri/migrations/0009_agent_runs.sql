-- Skill runs on the harness (docs/SKILL-RUNNER.md). One row per attempt.
CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    skill_version INTEGER NOT NULL,
    engine TEXT NOT NULL,
    agent TEXT NOT NULL,
    status TEXT NOT NULL,
    request TEXT,
    model TEXT,
    output_json TEXT,
    error TEXT,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS agent_runs_skill ON agent_runs(skill_id, started_at);
