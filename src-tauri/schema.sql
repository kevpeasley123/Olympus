CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fingerprint of each generated artifact as the app last wrote it. On rewrite,
-- a file whose fingerprint still matches is app-authored and can be replaced
-- silently; one that diverged was edited by a human and needs confirmation.
-- Lives here rather than in the vault: a sidecar file would litter the
-- operator's notes and sync through OneDrive, and neither .canvas (JSON) nor
-- .base (YAML) has a frontmatter block to hide it in.
CREATE TABLE IF NOT EXISTS artifact_hashes (
  vault_relative_path TEXT PRIMARY KEY,
  content_sha256 TEXT NOT NULL,
  written_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tool_states (
  tool_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at
  ON conversation_messages(created_at);

-- One durable boundary per desktop launch. The briefing describes this
-- precisely as "since Olympus was last opened"; it is not inferred from commit
-- recency or from the wall clock.
CREATE TABLE IF NOT EXISTS operator_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_sessions_started_at
  ON operator_sessions(started_at);

CREATE TABLE IF NOT EXISTS delegation_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  task TEXT NOT NULL,
  driver TEXT NOT NULL,
  model TEXT NOT NULL,
  phase TEXT NOT NULL,
  workspace TEXT NOT NULL,
  branch TEXT NOT NULL,
  base_commit TEXT NOT NULL,
  agent_session_id TEXT NOT NULL,
  process_id INTEGER,
  milestone TEXT NOT NULL,
  checkpoint TEXT,
  outcome TEXT,
  changed_files_json TEXT NOT NULL DEFAULT '[]',
  diff_summary TEXT,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_delegation_runs_updated_at
  ON delegation_runs(updated_at);

CREATE TABLE IF NOT EXISTS delegation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  milestone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(run_id) REFERENCES delegation_runs(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  signal TEXT NOT NULL,
  description TEXT NOT NULL,
  preferred_stack TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  due TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  use_case TEXT NOT NULL,
  approval_required INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboard_modules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  module_order INTEGER NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS operator_briefs (
  id TEXT PRIMARY KEY,
  brief_date TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
