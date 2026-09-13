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

CREATE TABLE IF NOT EXISTS conversation_research (
  message_id TEXT PRIMARY KEY,
  sources_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_approvals (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES operator_sessions(id),
  run_id TEXT NOT NULL, stage TEXT NOT NULL, task_text TEXT NOT NULL, task_hash TEXT NOT NULL,
  subject_json TEXT NOT NULL, subject_hash TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS approval_consumptions (
  approval_id TEXT PRIMARY KEY REFERENCES operator_approvals(id), run_id TEXT NOT NULL, stage TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS approval_revocations (
  approval_id TEXT PRIMARY KEY REFERENCES operator_approvals(id), session_id TEXT NOT NULL, reason TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TRIGGER IF NOT EXISTS approvals_no_update BEFORE UPDATE ON operator_approvals BEGIN SELECT RAISE(ABORT, 'Approvals are immutable'); END;
CREATE TRIGGER IF NOT EXISTS approvals_no_delete BEFORE DELETE ON operator_approvals BEGIN SELECT RAISE(ABORT, 'Approvals are immutable'); END;
CREATE TRIGGER IF NOT EXISTS consumption_no_update BEFORE UPDATE ON approval_consumptions BEGIN SELECT RAISE(ABORT, 'Consumption is immutable'); END;
CREATE TRIGGER IF NOT EXISTS consumption_no_delete BEFORE DELETE ON approval_consumptions BEGIN SELECT RAISE(ABORT, 'Consumption is immutable'); END;
CREATE TRIGGER IF NOT EXISTS revocation_no_update BEFORE UPDATE ON approval_revocations BEGIN SELECT RAISE(ABORT, 'Revocation is immutable'); END;
CREATE TRIGGER IF NOT EXISTS revocation_no_delete BEFORE DELETE ON approval_revocations BEGIN SELECT RAISE(ABORT, 'Revocation is immutable'); END;
CREATE TABLE IF NOT EXISTS delegation_contracts (
  run_id TEXT PRIMARY KEY, criteria_json TEXT NOT NULL, plan TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS delegation_checks (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, check_name TEXT NOT NULL, exit_code INTEGER,
  output TEXT NOT NULL, workspace_hash TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delegation_reviews (
  run_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, criteria_evidence_json TEXT NOT NULL,
  workspace_hash TEXT NOT NULL, reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversation_voice (message_id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL);

-- Request provenance is independent of chat contents and never stores prompts.
CREATE TABLE IF NOT EXISTS model_requests (id TEXT PRIMARY KEY, record_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conversation_model (message_id TEXT PRIMARY KEY, request_id TEXT NOT NULL);

-- Generated operational reports. No approval, commitment, or memory authority.
CREATE TABLE IF NOT EXISTS knowledge_audit_runs (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_audit_single_active
  ON knowledge_audit_runs(status) WHERE status='running';
CREATE TABLE IF NOT EXISTS knowledge_audit_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
  node TEXT NOT NULL, state TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES knowledge_audit_runs(id)
);
CREATE INDEX IF NOT EXISTS knowledge_audit_events_run ON knowledge_audit_events(run_id,sequence);

-- Gmail is an external source cache; user tokens live in Windows Credential Manager.
CREATE TABLE IF NOT EXISTS gmail_accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL, scopes TEXT NOT NULL, connected_at TEXT NOT NULL,
 horizon_days INTEGER NOT NULL DEFAULT 90, history_id TEXT,
 last_attempt TEXT, last_success TEXT, last_error TEXT, next_sync TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS gmail_one_enabled ON gmail_accounts(enabled) WHERE enabled=1;
CREATE TABLE IF NOT EXISTS gmail_messages (
 account_id TEXT NOT NULL, id TEXT NOT NULL, thread_id TEXT NOT NULL, internal_date INTEGER NOT NULL,
 available INTEGER NOT NULL, in_scope INTEGER NOT NULL, fingerprint TEXT NOT NULL,
 snapshot_json TEXT NOT NULL, PRIMARY KEY(account_id,id)
);
CREATE INDEX IF NOT EXISTS gmail_thread ON gmail_messages(account_id,thread_id,internal_date);
CREATE INDEX IF NOT EXISTS gmail_workspace_scope ON gmail_messages(account_id,available,in_scope,internal_date DESC,id);
CREATE VIRTUAL TABLE IF NOT EXISTS gmail_search USING fts5(account_id UNINDEXED,message_id UNINDEXED,subject,sender,body,tokenize='unicode61');
CREATE TABLE IF NOT EXISTS gmail_sync_runs (
 id TEXT PRIMARY KEY,account_id TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,
 status TEXT NOT NULL,mode TEXT NOT NULL,changes INTEGER NOT NULL DEFAULT 0,error TEXT
);
CREATE TABLE IF NOT EXISTS gmail_candidates (
 account_id TEXT NOT NULL,message_id TEXT NOT NULL,source_fingerprint TEXT NOT NULL,
 kind TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(account_id,message_id,kind)
);
CREATE TABLE IF NOT EXISTS conversation_mail (message_id TEXT PRIMARY KEY,sources_json TEXT NOT NULL);

-- Manual local intelligence. Generated evidence, never an execution authorization.
CREATE TABLE IF NOT EXISTS communication_runs (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, days INTEGER NOT NULL,
 status TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS communication_single_active ON communication_runs(status) WHERE status='running';
CREATE TABLE IF NOT EXISTS communication_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL,
 node TEXT NOT NULL, state TEXT NOT NULL, at TEXT NOT NULL, result_json TEXT NOT NULL,
 FOREIGN KEY(run_id) REFERENCES communication_runs(id)
);
CREATE INDEX IF NOT EXISTS communication_events_run ON communication_events(run_id,sequence);
CREATE TABLE IF NOT EXISTS communication_evaluations (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, thread_id TEXT NOT NULL,
 event TEXT NOT NULL, at TEXT NOT NULL,
 FOREIGN KEY(run_id) REFERENCES communication_runs(id)
);
