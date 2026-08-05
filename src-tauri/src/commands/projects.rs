use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use super::get_vault_path;
use super::project_notes::{load_project_notes, ProjectNote, ProjectNoteIndex, ProjectStatus};

static PROJECTS_CACHE: Lazy<Mutex<Option<CachedProjectsResponse>>> = Lazy::new(|| Mutex::new(None));
const PROJECTS_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, Deserialize)]
pub struct ProjectsRequest {
    #[serde(rename = "rootPath")]
    pub root_path: String,
    /// The previous durable Olympus launch boundary. When absent, the scan
    /// reports no "since last session" commits rather than inventing a window.
    #[serde(rename = "sinceSession")]
    pub since_session: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct LinkedWorktree {
    pub path: String,
    pub branch: String,
    pub head: String,
    #[serde(rename = "lastCommitAt")]
    pub last_commit_at: Option<String>,
    #[serde(rename = "changedFiles")]
    pub changed_files: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackedProjectPayload {
    pub id: String,
    pub name: String,
    pub path: String,
    /// Declared in the note when there is one; `unclassified` otherwise.
    pub status: String,
    /// `declared` when a note said so, `inferred` when nothing did. The UI has
    /// to be able to tell "the operator called this active" from "Olympus has
    /// no idea", and the status alone cannot carry that.
    #[serde(rename = "statusSource")]
    pub status_source: String,
    pub promoted: Option<String>,
    pub branch: String,
    #[serde(rename = "lastCommit")]
    pub last_commit: String,
    /// ISO 8601 committer date, for ordering. `None` for a folder with no
    /// commits — which is exactly the set that cannot be ordered by recency.
    #[serde(rename = "lastCommitAt")]
    pub last_commit_at: Option<String>,
    #[serde(rename = "repoState")]
    pub repo_state: String,
    /// Commits from the last 24 hours, newest first. Feeds the day arc's tick
    /// marks, which need *when work happened* rather than only the latest
    /// commit — `last_commit_at` answers a different question.
    #[serde(rename = "recentCommits")]
    pub recent_commits: Vec<RecentCommit>,
    /// Commits across every ref since the last persisted Olympus launch.
    #[serde(rename = "sinceSessionCommits")]
    pub since_session_commits: Vec<RecentCommit>,
    /// Linked worktrees other than the project's primary checkout. These are
    /// where delegated agents work and may hold progress before a commit exists.
    #[serde(rename = "linkedWorktrees")]
    pub linked_worktrees: Vec<LinkedWorktree>,
    pub summary: String,
    /// The project's current purpose, declared in the vault and deliberately
    /// reviewable rather than treated as permanent doctrine.
    pub vision: String,
    #[serde(rename = "visionReviewedAt")]
    pub vision_reviewed_at: Option<String>,
    /// The operator's own words, or empty. Never invented — see the note on
    /// `build_project_payload`.
    #[serde(rename = "nextStep")]
    pub next_step: String,
    #[serde(rename = "notePath")]
    pub note_path: Option<String>,
    pub warnings: Vec<String>,
}

/// The scan's whole result. `warnings` holds problems with the notes folder
/// itself — an alias claimed by two notes, for instance — which belong to no
/// single project. Attaching those to an arbitrary project would tell the
/// operator the wrong thing about that project.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectsResponse {
    pub projects: Vec<TrackedProjectPayload>,
    pub warnings: Vec<String>,
}

#[derive(Clone)]
struct CachedProjectsResponse {
    root_path: String,
    since_session: Option<String>,
    payload: ProjectsResponse,
    fetched_at: Instant,
}

#[tauri::command]
pub async fn scan_tracked_projects(
    request: ProjectsRequest,
) -> Result<ProjectsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || scan_tracked_projects_blocking(request))
        .await
        .map_err(|error| format!("Project scan task panicked: {error}"))?
}

fn scan_tracked_projects_blocking(
    request: ProjectsRequest,
) -> Result<ProjectsResponse, String> {
    if let Some(cached) = PROJECTS_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .filter(|entry| {
            entry.root_path == request.root_path
                && entry.since_session == request.since_session
                && entry.fetched_at.elapsed() < PROJECTS_CACHE_TTL
        })
    {
        return Ok(cached.payload);
    }

    let root = PathBuf::from(&request.root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Projects root path does not exist or is not a directory.".to_string());
    }

    // Intent, read once per scan rather than once per project.
    let notes = load_project_notes();

    let mut projects = Vec::new();
    let mut matched_notes: Vec<String> = Vec::new();

    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !path.is_dir() || is_excluded_directory(&path) {
            continue;
        }

        let payload = build_project_payload(path, &notes, request.since_session.as_deref())?;

        if let Some(note_path) = &payload.note_path {
            matched_notes.push(note_path.clone());
        }

        projects.push(payload);
    }

    // A note whose repository is missing still renders. Deleting a folder
    // should not silently delete the project the operator declared in it.
    for note in notes.notes() {
        if !matched_notes.contains(&note.note_path) {
            projects.push(orphaned_note_payload(note));
        }
    }

    projects.sort_by(compare_projects);

    let response = ProjectsResponse {
        projects,
        warnings: notes.warnings.clone(),
    };

    *PROJECTS_CACHE.lock().map_err(|error| error.to_string())? = Some(CachedProjectsResponse {
        root_path: request.root_path,
        since_session: request.since_session,
        payload: response.clone(),
        fetched_at: Instant::now(),
    });

    Ok(response)
}

/// Builds one project from Git plus whatever the vault says about it.
///
/// The division is the point. Git contributes branch, dirty state, and commits;
/// the note contributes status, promotion date, and next step. Nothing is
/// inferred across that line — in particular `next_step` is **empty** when no
/// note supplies one. It used to be one of three canned sentences chosen from
/// repo state, which read as advice while carrying no information, and this
/// field is about to become the largest sentence on the screen.
fn build_project_payload(
    path: PathBuf,
    notes: &ProjectNoteIndex,
    since_session: Option<&str>,
) -> Result<TrackedProjectPayload, String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Failed to determine project folder name.".to_string())?
        .to_string();

    let note = notes.lookup(&name);
    let (status, status_source) = resolve_status(note);

    let is_git_repo = path.join(".git").exists()
        || git_command(&path, &["rev-parse", "--is-inside-work-tree"]).is_ok();

    let mut payload = TrackedProjectPayload {
        id: project_id(&name),
        name,
        path: path.to_string_lossy().to_string(),
        status: status.as_str().to_string(),
        status_source: status_source.to_string(),
        promoted: note.and_then(|note| note.promoted.clone()),
        branch: "N/A".to_string(),
        recent_commits: Vec::new(),
        since_session_commits: Vec::new(),
        linked_worktrees: Vec::new(),
        last_commit: "Folder only".to_string(),
        last_commit_at: None,
        repo_state: "folder-only".to_string(),
        summary: "Project folder present but not initialized as a Git workspace.".to_string(),
        vision: note
            .and_then(|project_note| project_note.vision.clone())
            .unwrap_or_default(),
        vision_reviewed_at: note.and_then(|project_note| project_note.vision_reviewed.clone()),
        next_step: note
            .and_then(|note| note.next_step.clone())
            .unwrap_or_default(),
        note_path: note.map(|note| note.note_path.clone()),
        warnings: note.map(|note| note.warnings.clone()).unwrap_or_default(),
    };

    if !is_git_repo {
        return Ok(payload);
    }

    let branch =
        git_command(&path, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|_| "HEAD".to_string());

    // `%cI` rides along on the commit read that already happens, so ordering by
    // real commit recency costs no extra process spawn. The previous ordering
    // input was the *folder's* mtime, which changes when entries are added or
    // removed and not when their contents change.
    let commit = git_command(&path, &["log", "--all", "-1", "--pretty=format:%h|%cI|%s"]).ok();
    let (last_commit, last_commit_at) = match commit.as_deref().map(parse_commit_line) {
        Some((summary, at)) => (summary, at),
        None => ("No commits yet".to_string(), None),
    };

    let dirty = git_command(&path, &["status", "--porcelain"])
        .map(|output| !output.trim().is_empty())
        .unwrap_or(false);

    payload.branch = branch;
    payload.repo_state = if dirty || last_commit_at.is_none() {
        "git-pending".to_string()
    } else {
        "git-active".to_string()
    };
    payload.summary = "Live project snapshot derived from the local folder and Git state.".to_string();
    payload.last_commit = last_commit;
    payload.last_commit_at = last_commit_at;
    payload.recent_commits = recent_commits(&path);
    payload.since_session_commits = since_session
        .map(|boundary| commits_since(&path, boundary))
        .unwrap_or_default();
    payload.linked_worktrees = linked_worktrees(&path);

    Ok(payload)
}

/// The merge table, in one place.
///
/// A note that exists but says nothing still counts as `declared`: the operator
/// has a note for this project, so the missing status is an omission in a file
/// they own rather than an absence of any record at all.
fn resolve_status(note: Option<&ProjectNote>) -> (ProjectStatus, &'static str) {
    match note {
        Some(note) => (
            note.status.unwrap_or(ProjectStatus::Unclassified),
            "declared",
        ),
        None => (ProjectStatus::Unclassified, "inferred"),
    }
}

/// A note whose repository is gone. Git contributes nothing, and saying so is
/// more useful than dropping the project the operator declared.
fn orphaned_note_payload(note: &ProjectNote) -> TrackedProjectPayload {
    let name = note
        .note_path
        .rsplit('/')
        .next()
        .unwrap_or(&note.note_path)
        .trim_end_matches(".md")
        .to_string();

    TrackedProjectPayload {
        id: project_id(&name),
        name,
        path: String::new(),
        recent_commits: Vec::new(),
        since_session_commits: Vec::new(),
        linked_worktrees: Vec::new(),
        status: note
            .status
            .unwrap_or(ProjectStatus::Unclassified)
            .as_str()
            .to_string(),
        status_source: "declared".to_string(),
        promoted: note.promoted.clone(),
        branch: "N/A".to_string(),
        last_commit: "No repository".to_string(),
        last_commit_at: None,
        repo_state: "no-repo".to_string(),
        summary: "Declared in the vault, but no matching folder was found under the projects root."
            .to_string(),
        vision: note.vision.clone().unwrap_or_default(),
        vision_reviewed_at: note.vision_reviewed.clone(),
        next_step: note.next_step.clone().unwrap_or_default(),
        note_path: Some(note.note_path.clone()),
        warnings: note.warnings.clone(),
    }
}

/// `%h|%cI|%s`. The subject can contain `|`, so the split is bounded to two.
fn parse_commit_line(raw: &str) -> (String, Option<String>) {
    let mut parts = raw.splitn(3, '|');

    match (parts.next(), parts.next(), parts.next()) {
        (Some(hash), Some(committed_at), Some(subject)) if !committed_at.is_empty() => (
            format!("{hash} {subject}"),
            Some(committed_at.to_string()),
        ),
        // A repository with no commits: `git log` fails and we never get here,
        // but a format change should degrade rather than render a mangled line.
        _ => (raw.to_string(), None),
    }
}

/// Directories under the projects root that are not projects.
///
/// The Obsidian vault lives inside the projects root, so without this it is
/// scanned and rendered as a project. Matching on the resolved path rather than
/// the folder's name means renaming the vault does not resurrect the bug.
fn is_excluded_directory(path: &Path) -> bool {
    if path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
    {
        return true;
    }

    let Ok(candidate) = path.canonicalize() else {
        return false;
    };

    match get_vault_path().canonicalize() {
        Ok(vault) => candidate == vault || vault.starts_with(&candidate),
        Err(_) => false,
    }
}

/// One commit inside the day arc's window.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentCommit {
    /// ISO 8601 committer date.
    #[serde(rename = "at")]
    pub at: String,
    pub subject: String,
}

/// Commits in the last 24 hours, newest first.
///
/// A second `git log` rather than a wider first one: the existing call answers
/// "what is the tip and when", which orders the project list, and widening it
/// would make every caller pay for history none of them read.
fn recent_commits(path: &PathBuf) -> Vec<RecentCommit> {
    commits_since(path, "24.hours")
}

fn commits_since(path: &PathBuf, since: &str) -> Vec<RecentCommit> {
    let since_argument = format!("--since={since}");
    let Ok(raw) = git_command(
        path,
        &["log", "--all", &since_argument, "--pretty=format:%cI|%s"],
    ) else {
        return Vec::new();
    };

    raw.lines()
        .filter_map(|line| {
            let (at, subject) = line.split_once('|')?;
            let at = at.trim();
            if at.is_empty() {
                return None;
            }
            Some(RecentCommit {
                at: at.to_string(),
                subject: subject.trim().to_string(),
            })
        })
        .collect()
}

fn linked_worktrees(path: &PathBuf) -> Vec<LinkedWorktree> {
    let Ok(raw) = git_command(path, &["worktree", "list", "--porcelain"]) else {
        return Vec::new();
    };
    let primary = path.canonicalize().unwrap_or_else(|_| path.clone());
    let mut linked = Vec::new();

    for block in raw.split("\n\n") {
        let mut worktree_path: Option<PathBuf> = None;
        let mut head = String::new();
        let mut branch = "HEAD".to_string();

        for line in block.lines() {
            if let Some(value) = line.strip_prefix("worktree ") {
                worktree_path = Some(PathBuf::from(value.trim()));
            } else if let Some(value) = line.strip_prefix("HEAD ") {
                head = value.trim().chars().take(8).collect();
            } else if let Some(value) = line.strip_prefix("branch ") {
                branch = value
                    .trim()
                    .strip_prefix("refs/heads/")
                    .unwrap_or(value.trim())
                    .to_string();
            } else if line.trim() == "detached" {
                branch = "detached HEAD".to_string();
            }
        }

        let Some(worktree_path) = worktree_path else {
            continue;
        };
        let canonical = worktree_path
            .canonicalize()
            .unwrap_or_else(|_| worktree_path.clone());
        if canonical == primary {
            continue;
        }

        let changed_files = git_command(&worktree_path, &["status", "--porcelain"])
            .map(|status| status.lines().filter(|line| !line.trim().is_empty()).count())
            .unwrap_or(0);
        let last_commit_at =
            git_command(&worktree_path, &["log", "-1", "--pretty=format:%cI"]).ok();

        linked.push(LinkedWorktree {
            path: worktree_path.to_string_lossy().to_string(),
            branch,
            head,
            last_commit_at,
            changed_files,
        });
    }

    linked.sort_by(|left, right| left.branch.cmp(&right.branch));
    linked
}

fn git_command(path: &PathBuf, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn project_id(name: &str) -> String {
    format!("project-{}", name.to_lowercase().replace(' ', "-"))
}

/// Declared tier first, then commit recency, then name.
///
/// Recency matters most inside `unclassified`, which is where every project
/// starts: with no note to rank them, the one committed to this morning is the
/// one the operator is working on. ISO 8601 sorts correctly as text, so no date
/// parsing is needed — descending, hence the reversed comparison.
fn compare_projects(left: &TrackedProjectPayload, right: &TrackedProjectPayload) -> Ordering {
    status_rank(&left.status)
        .cmp(&status_rank(&right.status))
        .then_with(|| {
            right
                .last_commit_at
                .as_deref()
                .unwrap_or("")
                .cmp(left.last_commit_at.as_deref().unwrap_or(""))
        })
        .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
}

fn status_rank(status: &str) -> u8 {
    match status {
        "active" => ProjectStatus::Active.rank(),
        "watching" => ProjectStatus::Watching.rank(),
        "scaffold" => ProjectStatus::Scaffold.rank(),
        "archived" => ProjectStatus::Archived.rank(),
        _ => ProjectStatus::Unclassified.rank(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_git_repo(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("olympus-project-scan-{name}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        git_command(&root, &["init"]).unwrap();
        git_command(&root, &["config", "user.name", "Olympus Test"]).unwrap();
        git_command(
            &root,
            &["config", "user.email", "olympus@example.invalid"],
        )
        .unwrap();
        fs::write(root.join("README.md"), "seed\n").unwrap();
        git_command(&root, &["add", "."]).unwrap();
        git_command(&root, &["commit", "-m", "seed"]).unwrap();
        root
    }

    /// The day arc's commit ticks against a repository with a commit created
    /// inside the window. A real checkout is allowed to have a quiet day; using
    /// it as the fixture made the test fail with the passage of time rather than
    /// with a parser regression.
    #[test]
    fn recent_commits_include_a_commit_created_inside_the_window() {
        let root = temp_git_repo("recent-commit");

        let commits = recent_commits(&root);

        assert_eq!(commits.len(), 1, "the fresh fixture has exactly one commit");
        assert_eq!(commits[0].subject, "seed");
        assert!(
            commits[0].at.contains('T'),
            "expected an ISO date, got {:?}",
            commits[0]
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn linked_worktree_changes_are_visible_before_a_commit() {
        let root = temp_git_repo("linked-dirty");
        let linked = root.with_file_name("olympus-project-scan-linked-dirty-worktree");
        let _ = fs::remove_dir_all(&linked);
        let linked_text = linked.to_string_lossy().to_string();
        git_command(
            &root,
            &["worktree", "add", "-b", "agent/test-run", &linked_text],
        )
        .unwrap();
        fs::write(linked.join("agent-progress.txt"), "in progress\n").unwrap();

        let worktrees = linked_worktrees(&root);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].branch, "agent/test-run");
        assert_eq!(worktrees[0].changed_files, 1);

        git_command(&root, &["worktree", "remove", "--force", &linked_text]).unwrap();
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn session_commits_include_linked_worktree_branches() {
        let root = temp_git_repo("linked-commit");
        let linked = root.with_file_name("olympus-project-scan-linked-commit-worktree");
        let _ = fs::remove_dir_all(&linked);
        let linked_text = linked.to_string_lossy().to_string();
        git_command(
            &root,
            &["worktree", "add", "-b", "agent/session-run", &linked_text],
        )
        .unwrap();
        fs::write(linked.join("agent-result.txt"), "complete\n").unwrap();
        git_command(&linked, &["add", "."]).unwrap();
        git_command(&linked, &["commit", "-m", "delegated result"]).unwrap();

        let commits = commits_since(&root, "2000-01-01T00:00:00Z");
        assert!(
            commits
                .iter()
                .any(|commit| commit.subject == "delegated result"),
            "commits across refs must include the linked worktree branch"
        );

        git_command(&root, &["worktree", "remove", "--force", &linked_text]).unwrap();
        let _ = fs::remove_dir_all(root);
    }

    fn payload(name: &str, status: &str, committed_at: Option<&str>) -> TrackedProjectPayload {
        TrackedProjectPayload {
            id: project_id(name),
            name: name.to_string(),
            path: String::new(),
            recent_commits: Vec::new(),
            since_session_commits: Vec::new(),
            linked_worktrees: Vec::new(),
            status: status.to_string(),
            status_source: "inferred".to_string(),
            promoted: None,
            branch: "main".to_string(),
            last_commit: "abc123 something".to_string(),
            last_commit_at: committed_at.map(str::to_string),
            repo_state: "git-active".to_string(),
            summary: String::new(),
            vision: String::new(),
            vision_reviewed_at: None,
            next_step: String::new(),
            note_path: None,
            warnings: Vec::new(),
        }
    }

    fn order(mut projects: Vec<TrackedProjectPayload>) -> Vec<String> {
        projects.sort_by(compare_projects);
        projects.into_iter().map(|project| project.name).collect()
    }

    /// The ordering decision this tier exists for: an unclassified project is
    /// not buried. On a vault where almost nothing is classified yet, ranking
    /// unclassified last would hide most of the operator's real work.
    #[test]
    fn unclassified_outranks_watching_and_below() {
        assert_eq!(
            order(vec![
                payload("archived-one", "archived", None),
                payload("watching-one", "watching", None),
                payload("unclassified-one", "unclassified", None),
                payload("active-one", "active", None),
                payload("scaffold-one", "scaffold", None),
            ]),
            vec![
                "active-one",
                "unclassified-one",
                "watching-one",
                "scaffold-one",
                "archived-one"
            ]
        );
    }

    #[test]
    fn within_a_tier_the_most_recent_commit_comes_first() {
        assert_eq!(
            order(vec![
                payload("stale", "unclassified", Some("2026-01-02T09:00:00+00:00")),
                payload("fresh", "unclassified", Some("2026-07-25T09:00:00+00:00")),
                payload("middling", "unclassified", Some("2026-05-10T09:00:00+00:00")),
            ]),
            vec!["fresh", "middling", "stale"]
        );
    }

    /// A folder with no commits cannot be ranked by recency, so it falls to the
    /// bottom of its tier rather than to the top.
    #[test]
    fn projects_without_commits_sort_below_those_with_them() {
        assert_eq!(
            order(vec![
                payload("no-commits", "unclassified", None),
                payload("committed", "unclassified", Some("2026-01-01T00:00:00+00:00")),
            ]),
            vec!["committed", "no-commits"]
        );
    }

    #[test]
    fn an_unknown_status_string_is_treated_as_unclassified() {
        assert_eq!(status_rank("nonsense"), ProjectStatus::Unclassified.rank());
    }

    #[test]
    fn a_note_supplies_status_and_a_missing_note_does_not() {
        let declared = ProjectNote {
            status: Some(ProjectStatus::Active),
            promoted: None,
            vision: None,
            vision_reviewed: None,
            next_step: None,
            note_path: "01 - Projects/X.md".to_string(),
            warnings: Vec::new(),
        };

        assert_eq!(
            resolve_status(Some(&declared)),
            (ProjectStatus::Active, "declared")
        );
        assert_eq!(
            resolve_status(None),
            (ProjectStatus::Unclassified, "inferred")
        );
    }

    /// A note that exists but omits `status` is still a note. The operator has
    /// a record for this project; they just did not fill in that field.
    #[test]
    fn a_note_without_a_status_still_counts_as_declared() {
        let silent = ProjectNote {
            status: None,
            promoted: None,
            vision: None,
            vision_reviewed: None,
            next_step: None,
            note_path: "01 - Projects/X.md".to_string(),
            warnings: Vec::new(),
        };

        assert_eq!(
            resolve_status(Some(&silent)),
            (ProjectStatus::Unclassified, "declared")
        );
    }

    #[test]
    fn a_commit_line_yields_a_summary_and_a_sortable_date() {
        let (summary, at) = parse_commit_line("a4c4b35|2026-07-25T14:03:11+00:00|Rewrite the brief");

        assert_eq!(summary, "a4c4b35 Rewrite the brief");
        assert_eq!(at.as_deref(), Some("2026-07-25T14:03:11+00:00"));
    }

    /// Commit subjects contain pipes. Splitting greedily would truncate them.
    #[test]
    fn a_commit_subject_may_contain_the_separator() {
        let (summary, at) =
            parse_commit_line("abc1234|2026-07-25T14:03:11+00:00|Fix a || b parsing");

        assert_eq!(summary, "abc1234 Fix a || b parsing");
        assert!(at.is_some());
    }

    #[test]
    fn a_malformed_commit_line_degrades_without_a_date() {
        let (summary, at) = parse_commit_line("unexpected output");

        assert_eq!(summary, "unexpected output");
        assert!(at.is_none());
    }

    /// The vault lives inside the projects root, so without this it is scanned
    /// and rendered as a project of its own.
    #[test]
    fn the_vault_directory_is_excluded_from_the_scan() {
        let vault = get_vault_path();

        assert!(
            vault.exists(),
            "the real vault must be present for this test to mean anything"
        );
        assert!(is_excluded_directory(&vault));

        // Its parent contains the vault, so it is excluded too — that is the
        // `Obsidian vaults` folder in the real projects root.
        if let Some(parent) = vault.parent() {
            assert!(is_excluded_directory(parent));
        }
    }

    #[test]
    fn ordinary_project_directories_are_not_excluded() {
        let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

        assert!(here.exists());
        assert!(!is_excluded_directory(&here));
    }

    #[test]
    fn dot_directories_are_skipped() {
        assert!(is_excluded_directory(Path::new("C:/projects/.git")));
        assert!(is_excluded_directory(Path::new("C:/projects/.vscode")));
    }

    /// The real projects root, through the real scan.
    ///
    /// The unit tests above prove the pieces; this proves they compose against
    /// the operator's actual filesystem — where the vault lives *inside* the
    /// projects root and the one existing note joins by alias. Both of those
    /// are properties of this machine, not of the code, so nothing else can
    /// catch them.
    #[test]
    fn debug_scan_the_real_projects_root() {
        // ...\Projects\Olympus\src-tauri -> ...\Projects
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .expect("the crate lives two levels under the projects root")
            .to_path_buf();

        assert!(
            root.join("Olympus").is_dir(),
            "expected the projects root at {}",
            root.display()
        );

        let response = scan_tracked_projects_blocking(ProjectsRequest {
            root_path: root.to_string_lossy().to_string(),
            since_session: None,
        })
        .expect("the real scan must succeed");

        eprintln!(
            "[projects] {} project(s), {} folder warning(s)",
            response.projects.len(),
            response.warnings.len()
        );
        for project in &response.projects {
            eprintln!(
                "  {:<28} {:<13} {:<9} {}",
                project.name,
                project.status,
                project.status_source,
                project.last_commit_at.as_deref().unwrap_or("-")
            );
        }

        assert!(!response.projects.is_empty(), "the scan found nothing");

        // The vault lives under the projects root. Before the exclusion it was
        // rendered as a project of its own.
        assert!(
            !response
                .projects
                .iter()
                .any(|project| project.name == "Obsidian vaults"),
            "the Obsidian vault must not be scanned as a project"
        );

        let olympus = response
            .projects
            .iter()
            .find(|project| project.name == "Olympus")
            .expect("Olympus must be tracked");

        assert_eq!(olympus.status, "active");
        assert_eq!(
            olympus.status_source, "declared",
            "`Project Olympus.md` must join to the Olympus directory by its alias"
        );
        assert!(olympus.note_path.is_some());

        // The canned next-step sentences are gone. Anything non-empty now came
        // out of a note, and a note is the only thing allowed to supply one.
        for project in &response.projects {
            assert!(
                project.next_step.is_empty() || project.note_path.is_some(),
                "{} has a next step with no note behind it",
                project.name
            );
        }

        // Ordering is only meaningful if it holds on real data.
        let ranks: Vec<u8> = response
            .projects
            .iter()
            .map(|project| status_rank(&project.status))
            .collect();
        assert!(
            ranks.windows(2).all(|pair| pair[0] <= pair[1]),
            "projects came back out of tier order: {ranks:?}"
        );
    }
}
