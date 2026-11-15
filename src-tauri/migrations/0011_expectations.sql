-- Kevin's expectations of Olympus, from his own words, and each recorded check
-- against them (docs/VISION-REVIEW.md).
CREATE TABLE IF NOT EXISTS expectations (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  kevin_said TEXT NOT NULL,
  said_on TEXT NOT NULL,
  source TEXT NOT NULL,
  checks_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'retired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS expectation_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (check_id, run_id)
);
CREATE INDEX IF NOT EXISTS expectation_checks_when ON expectation_checks(created_at);
