use super::{persistence::Db, projects::git_command, repository_inspection::resolve};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::sync::Mutex;

static REVIEW_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectReview {
    id: i64,
    project: String,
    source: String,
    revision: Option<String>,
    previous: Option<String>,
    outcome: String,
    detail: String,
    observed_at: String,
}
fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectReview> {
    Ok(ProjectReview {
        id: row.get(0)?,
        project: row.get(1)?,
        source: row.get(2)?,
        revision: row.get(3)?,
        previous: row.get(4)?,
        outcome: row.get(5)?,
        detail: row.get(6)?,
        observed_at: row.get(7)?,
    })
}
const FIELDS: &str = "id,project,source,revision,previous,outcome,detail,observed_at";

#[tauri::command]
pub fn project_review_history(db: tauri::State<'_, Db>) -> Result<Vec<ProjectReview>, String> {
    let conn = db.0.lock().map_err(|_| "Review history unavailable")?;
    let mut query = conn
        .prepare(&format!(
            "SELECT {FIELDS} FROM project_review_runs ORDER BY id DESC LIMIT 50"
        ))
        .map_err(|e| e.to_string())?;
    let rows = query.query_map([], from_row).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Keep the last meaningful change eligible across repeated unchanged observations.
#[tauri::command]
pub fn project_review_findings(db: tauri::State<'_, Db>) -> Result<Vec<ProjectReview>, String> {
    let conn = db.0.lock().map_err(|_| "Review history unavailable")?;
    findings(&conn)
}

fn findings(conn: &Connection) -> Result<Vec<ProjectReview>, String> {
    let mut query = conn
        .prepare(&format!(
            "SELECT {FIELDS} FROM project_review_runs r
        WHERE r.outcome='changed' AND NOT EXISTS (
            SELECT 1 FROM project_review_runs newer WHERE newer.source=r.source AND newer.id>r.id
            AND newer.outcome='changed')
        ORDER BY r.id DESC LIMIT 50"
        ))
        .map_err(|e| e.to_string())?;
    let rows = query.query_map([], from_row).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn require_git_root(path: &std::path::PathBuf) -> Result<(), String> {
    let selected = path
        .canonicalize()
        .map_err(|_| "Registered project folder unavailable")?;
    let reported = git_command(path, &["rev-parse", "--show-toplevel"])
        .map_err(|_| "Registered folder is not a Git repository")?;
    let root = std::path::PathBuf::from(reported)
        .canonicalize()
        .map_err(|_| "Git root unavailable")?;
    if root != selected {
        return Err("Registered folder no longer identifies its own Git repository".into());
    }
    Ok(())
}

/// Read registered project IDs only. Never refresh or update portfolio membership.
#[tauri::command]
pub async fn brief_project_changes(
    db: tauri::State<'_, Db>,
    project_id: String,
    since: String,
) -> Result<Vec<super::projects::RecentCommit>, String> {
    let initial =
        chrono::DateTime::parse_from_rfc3339(&since).map_err(|_| "Invalid observation boundary")?;
    let (project, cursor) = {
        let conn = db.0.lock().map_err(|_| "Project registry unavailable")?;
        let member = super::project_registry::list(&conn)?
            .into_iter()
            .find(|m| m.project.id == project_id && m.visibility == "visible")
            .ok_or("Project membership changed")?;
        let cursor: Option<(i64, String)> = conn
            .query_row(
                "SELECT observed_ms,oids FROM project_brief_cursors WHERE source=?",
                [&member.project.path],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        (member.project, cursor)
    };
    let acceptance = super::acceptance::projects_root();
    tauri::async_runtime::spawn_blocking(move || {
        if project.path.is_empty()
            || !matches!(project.repo_state.as_str(), "git-active" | "git-pending")
            || project.last_commit_at.is_none()
        {
            return Ok(Vec::new());
        }
        let path = std::path::PathBuf::from(project.path);
        if let Some(root) = acceptance {
            if !path
                .canonicalize()
                .map_err(|_| "Project unavailable")?
                .starts_with(root.canonicalize().map_err(|_| "Fixture unavailable")?)
            {
                return Err("Project outside fixture".into());
            }
        }
        let (at, oids) = match cursor {
            Some((at, values)) => (
                at,
                serde_json::from_str::<Vec<String>>(&values)
                    .map_err(|_| "Project cursor unreadable")?,
            ),
            None => (initial.timestamp_millis(), Vec::new()),
        };
        let boundary =
            chrono::DateTime::<chrono::Utc>::from_timestamp_millis(at.saturating_sub(1000))
                .ok_or("Invalid stored project cursor")?;
        let commits = super::projects::checked_commits_since(&path, &boundary.to_rfc3339())
            .map_err(|_| "Project Git activity unavailable")?;
        Ok(commits
            .into_iter()
            .filter(|commit| {
                chrono::DateTime::parse_from_rfc3339(&commit.at).is_ok_and(|date| {
                    let observed = date.timestamp_millis();
                    observed > at
                        || (observed == at
                            && commit.oid.as_ref().is_none_or(|oid| !oids.contains(oid)))
                })
            })
            .collect())
    })
    .await
    .map_err(|_| "Project activity unavailable")?
}

fn save(
    conn: &mut Connection,
    project: &str,
    source: &str,
    scheduled: bool,
    read: Result<(String, String), String>,
) -> Result<ProjectReview, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let previous: Option<String>=tx.query_row("SELECT revision FROM project_review_runs WHERE source=? AND revision IS NOT NULL ORDER BY id DESC LIMIT 1",[source],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    let (revision, outcome, detail) = match read {
        Ok((rev, subject)) => {
            let outcome = match previous.as_deref() {
                None => "baseline",
                Some(old) if old == rev.as_str() => "unchanged",
                Some(_) => "changed",
            };
            (Some(rev), outcome, subject)
        }
        Err(reason) => (None, "unavailable", reason),
    };
    tx.execute("INSERT INTO project_review_runs(project,source,revision,previous,outcome,detail,scheduled_day) VALUES(?,?,?,?,?,?,CASE WHEN ? THEN date('now','localtime') END)",params![project,source,revision,previous,outcome,detail,scheduled]).map_err(|e|e.to_string())?;
    let record = tx
        .query_row(
            &format!("SELECT {FIELDS} FROM project_review_runs WHERE id=?"),
            [tx.last_insert_rowid()],
            from_row,
        )
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(record)
}

#[tauri::command]
pub async fn run_project_review(
    app: tauri::AppHandle,
    project: String,
    scheduled: Option<bool>,
) -> Result<ProjectReview, String> {
    use tauri::Manager;
    tauri::async_runtime::spawn_blocking(move || {
        run(&app.state::<Db>(), &project, scheduled.unwrap_or(false))
    })
    .await
    .map_err(|_| "Project review worker unavailable")?
}

fn project_path(db: &Db, name: &str) -> Result<std::path::PathBuf, String> {
    let members = {
        let conn = db.0.lock().map_err(|_| "Project registry unavailable")?;
        super::project_registry::list(&conn)?
    };
    let matching: Vec<_> = members.iter().filter(|m| m.project.name == name).collect();
    if matching.is_empty() {
        return resolve(db, name);
    }
    if matching.len() != 1 || matching[0].visibility != "visible" {
        return Err("Choose one visible registered project.".into());
    }
    let path = std::path::PathBuf::from(&matching[0].project.path);
    if !path.is_absolute() || super::repository_inspection::linked(&path) {
        return Err("Registered project folder unavailable.".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| "Registered project folder unavailable")?;
    if let Some(root) = super::acceptance::projects_root() {
        if !canonical.starts_with(
            root.canonicalize()
                .map_err(|_| "Fixture root unavailable")?,
        ) {
            return Err("Project outside the acceptance fixture.".into());
        }
    }
    if !canonical.join(".git").exists() {
        return Err("This project has no Git repository.".into());
    }
    Ok(canonical)
}

fn run(db: &Db, project: &str, scheduled: bool) -> Result<ProjectReview, String> {
    let _lock = REVIEW_LOCK.lock().map_err(|_| "Review unavailable")?;
    let name = project.trim();
    if name.is_empty()
        || name.len() > 255
        || name.chars().any(char::is_control)
        || name.contains(['/', '\\', ':'])
        || name.starts_with('.')
    {
        return Err("Choose a project folder name.".into());
    }
    if scheduled {
        let conn = db.0.lock().map_err(|_| "Review storage unavailable")?;
        let prior=conn.query_row(&format!("SELECT {FIELDS} FROM project_review_runs WHERE project=? AND scheduled_day=date('now','localtime')"),[name],from_row).optional().map_err(|e|e.to_string())?;
        if let Some(prior) = prior {
            return Ok(prior);
        }
    }
    let (source, read) = match project_path(db, name) {
        Ok(path) => {
            let result = require_git_root(&path)
                .and_then(|_| git_command(&path, &["rev-parse", "--verify", "HEAD^{commit}"]))
                .ok()
                .filter(|s| matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit()))
                .ok_or_else(|| "Unable to read a committed revision.".to_string())
                .and_then(|rev| {
                    git_command(
                        &path,
                        &["log", "-1", "--no-show-signature", "--format=%s", &rev],
                    )
                    .map(|subject| (rev, subject.chars().take(240).collect()))
                    .map_err(|_| "Commit subject unavailable.".to_string())
                });
            (path.to_string_lossy().into_owned(), result)
        }
        Err(message) => (name.to_owned(), Err(message)),
    };
    let mut conn = db.0.lock().map_err(|_| "Review storage unavailable")?;
    save(&mut conn, name, &source, scheduled, read)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn review_reads_real_git_and_daily_runs_are_idempotent() {
        let root = std::env::temp_dir().join(format!(
            "olympus-review-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let repo = root.join("Fixture");
        std::fs::create_dir_all(&repo).unwrap();
        let git = |args: &[&str]| git_command(&repo, args).unwrap();
        git(&["init"]);
        let nested = repo.join("formerly-a-checkout");
        std::fs::create_dir(&nested).unwrap();
        assert!(require_git_root(&nested).is_err());

        git(&["config", "user.name", "Fixture"]);
        git(&["config", "user.email", "fixture@example.invalid"]);
        git(&[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--allow-empty",
            "-m",
            "First observation",
        ]);
        let conn = Connection::open_in_memory().unwrap();
        super::super::migrations::apply(&conn).unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings(key,value) VALUES('projectsRootPath',?)",
            [root.to_string_lossy()],
        )
        .unwrap();
        let db = Db(Mutex::new(conn));
        let baseline = run(&db, "Fixture", false).unwrap();
        assert_eq!(baseline.outcome, "baseline");
        git(&[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--allow-empty",
            "-m",
            "Review ready",
        ]);
        let changed = run(&db, "Fixture", true).unwrap();
        assert_eq!(changed.outcome, "changed");
        assert_eq!(changed.detail, "Review ready");
        assert_eq!(changed.previous, baseline.revision);
        assert_eq!(run(&db, "Fixture", true).unwrap().id, changed.id);
        assert_eq!(run(&db, "Fixture", false).unwrap().outcome, "unchanged");
        assert_eq!(run(&db, "Missing", false).unwrap().outcome, "unavailable");
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn failed_observation_preserves_last_successful_revision() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../migrations/0004_project_reviews.sql"))
            .unwrap();
        let mut review = |rev: Result<&str, &str>| {
            save(
                &mut conn,
                "Test",
                "source",
                false,
                rev.map(|v| (v.to_string(), "Observed commit".into()))
                    .map_err(String::from),
            )
            .unwrap()
        };
        assert_eq!(review(Ok("a")).outcome, "baseline");
        assert_eq!(review(Err("inaccessible")).outcome, "unavailable");
        assert_eq!(review(Ok("a")).outcome, "unchanged");
        let changed = review(Ok("b"));
        assert_eq!(changed.previous.as_deref(), Some("a"));
        assert_eq!(changed.outcome, "changed");
        let id = changed.id;
        assert_eq!(
            review(Err("temporarily inaccessible")).outcome,
            "unavailable"
        );
        assert_eq!(review(Ok("b")).outcome, "unchanged");
        let retained = findings(&conn).unwrap();
        assert_eq!(retained.len(), 1);
        assert_eq!(retained[0].id, id);
    }
}
