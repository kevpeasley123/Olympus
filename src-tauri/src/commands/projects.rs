use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

static PROJECTS_CACHE: Lazy<Mutex<Option<CachedProjectsResponse>>> = Lazy::new(|| Mutex::new(None));
const PROJECTS_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Debug, Deserialize)]
pub struct ProjectsRequest {
    #[serde(rename = "rootPath")]
    pub root_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackedProjectPayload {
    pub id: String,
    pub name: String,
    pub path: String,
    pub status: String,
    pub branch: String,
    #[serde(rename = "lastCommit")]
    pub last_commit: String,
    #[serde(rename = "repoState")]
    pub repo_state: String,
    pub summary: String,
    #[serde(rename = "nextStep")]
    pub next_step: String,
}

#[derive(Clone)]
struct CachedProjectsResponse {
    root_path: String,
    payload: Vec<TrackedProjectPayload>,
    fetched_at: Instant,
}

#[tauri::command]
pub fn scan_tracked_projects(request: ProjectsRequest) -> Result<Vec<TrackedProjectPayload>, String> {
    if let Some(cached) = PROJECTS_CACHE
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .filter(|entry| entry.root_path == request.root_path && entry.fetched_at.elapsed() < PROJECTS_CACHE_TTL)
    {
        return Ok(cached.payload);
    }

    let root = PathBuf::from(&request.root_path);
    if !root.exists() || !root.is_dir() {
        return Err("Projects root path does not exist or is not a directory.".to_string());
    }

    let mut projects = Vec::new();

    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        projects.push(build_project_payload(path)?);
    }

    projects.sort_by_key(project_sort_key);

    *PROJECTS_CACHE.lock().map_err(|error| error.to_string())? = Some(CachedProjectsResponse {
        root_path: request.root_path,
        payload: projects.clone(),
        fetched_at: Instant::now(),
    });

    Ok(projects)
}

fn build_project_payload(path: PathBuf) -> Result<TrackedProjectPayload, String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Failed to determine project folder name.".to_string())?
        .to_string();

    let is_git_repo = path.join(".git").exists() || git_command(&path, &["rev-parse", "--is-inside-work-tree"]).is_ok();
    let modified_at = fs::metadata(&path)
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if !is_git_repo {
        return Ok(TrackedProjectPayload {
            id: project_id(&name),
            name,
            path: path.to_string_lossy().to_string(),
            status: "watching".to_string(),
            branch: "N/A".to_string(),
            last_commit: "Folder only".to_string(),
            repo_state: "folder-only".to_string(),
            summary: "Project folder present but not initialized as a Git workspace.".to_string(),
            next_step: "Decide whether this should become an active project and initialize Git when it does.".to_string(),
        });
    }

    let branch = git_command(&path, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|_| "HEAD".to_string());
    let last_commit = git_command(&path, &["log", "-1", "--pretty=format:%h %s"])
        .unwrap_or_else(|_| "No commits yet".to_string());
    let dirty = git_command(&path, &["status", "--porcelain"])
        .map(|output| !output.trim().is_empty())
        .unwrap_or(false);

    let repo_state = if dirty || last_commit == "No commits yet" {
        "git-pending"
    } else {
        "git-active"
    };

    let status = if last_commit == "No commits yet" {
        "watching"
    } else if is_recent(modified_at, 14) {
        "active"
    } else {
        "watching"
    };

    let next_step = match repo_state {
        "git-pending" if last_commit == "No commits yet" => {
            "Create the first meaningful commit so Olympus can start tracking real project momentum."
        }
        "git-pending" => {
            "Review the current working tree and decide what should become the next clean commit."
        }
        _ => "Review the latest shipped state and define the next focused milestone.",
    };

    Ok(TrackedProjectPayload {
        id: project_id(&name),
        name,
        path: path.to_string_lossy().to_string(),
        status: status.to_string(),
        branch,
        last_commit,
        repo_state: repo_state.to_string(),
        summary: "Live project snapshot derived from the local folder and Git state.".to_string(),
        next_step: next_step.to_string(),
    })
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

fn is_recent(modified_at: SystemTime, window_days: u64) -> bool {
    match SystemTime::now().duration_since(modified_at) {
        Ok(elapsed) => elapsed <= Duration::from_secs(window_days * 24 * 60 * 60),
        Err(_) => true,
    }
}

fn project_sort_key(project: &TrackedProjectPayload) -> (u8, String) {
    let rank = match project.status.as_str() {
        "active" => 0,
        "watching" => 1,
        _ => 2,
    };

    (rank, project.name.to_lowercase())
}
