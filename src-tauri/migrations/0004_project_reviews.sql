CREATE TABLE project_review_runs (
 id INTEGER PRIMARY KEY, project TEXT NOT NULL, source TEXT NOT NULL, revision TEXT,
 scheduled_day TEXT, previous TEXT, outcome TEXT NOT NULL, detail TEXT NOT NULL,
 observed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX project_review_source ON project_review_runs(source,id);
CREATE UNIQUE INDEX scheduled_project_review ON project_review_runs(project,scheduled_day);
