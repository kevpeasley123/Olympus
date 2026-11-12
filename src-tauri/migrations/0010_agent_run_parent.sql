-- A hand-off: the run that asked for this one (docs/SKILL-RUNNER.md, "Hand-offs").
ALTER TABLE agent_runs ADD COLUMN parent_run TEXT;
CREATE INDEX IF NOT EXISTS agent_runs_parent ON agent_runs(parent_run);
