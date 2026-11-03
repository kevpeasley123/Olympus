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
pub fn run_project_review(
    db: tauri::State<'_, Db>,
    project: String,
    scheduled: Option<bool>,
) -> Result<ProjectReview, String> {
    run(&db, &project, scheduled.unwrap_or(false))
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
    let (source, read) = match resolve(db, name) {
        Ok(path) => {
            let result = git_command(&path, &["rev-parse", "--verify", "HEAD^{commit}"])
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
    }
}
