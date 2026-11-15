-- Improvements the weekly vision review proposes, and Kevin's decision on each
-- (docs/VISION-REVIEW.md). An accepted instruction becomes standing guidance
-- for its skill; other kinds wait for a coding session.
CREATE TABLE IF NOT EXISTS vision_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('instruction', 'setting', 'check', 'build')),
  skill TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  expectation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'dismissed', 'done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at TEXT,
  UNIQUE (run_id, position)
);
