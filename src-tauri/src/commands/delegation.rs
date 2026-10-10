//! Recoverable Claude Code delegation pilot.
//!
//! The webview proposes a tracked project and task, then confirms a backend proposal. It
//! never supplies an executable, workspace, branch, shell command, or raw argv.
//! Olympus resolves the project, creates a dedicated worktree, runs a fixed
//! Claude Code adapter, and preserves the result for review without push/merge.

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use super::approvals::{ApprovalState, Proposal, Subject};
use super::persistence::Db;

const EVENT_NAME: &str = "delegation-run-updated";
const MAX_TASK_CHARS: usize = 4_000;
const MAX_DIFF_CHARS: usize = 120_000;
const MODEL: &str = super::models::CODING_MODEL;
// Claude Code applies this per launch. Planning, implementation and each resume launch
// separately, and Olympus keeps no aggregate spend ledger across them.
const MAX_BUDGET_USD: &str = "5";
// A hung CLI would otherwise block new runs for its project indefinitely.
const MAX_LAUNCH_DURATION: Duration = Duration::from_secs(45 * 60);
const PLAN_TOOLS: &str = "Read,Glob,Grep";
// `--tools` is the complete built-in inventory; `--allowedTools` pre-approves within it and
// `dontAsk` denies the rest. Olympus collects the diff itself, so git diff is not granted.
const IMPLEMENTATION_BUILTINS: &str = "Read,Glob,Grep,Edit,Write,Bash";
const IMPLEMENTATION_TOOLS: &str = "Read,Glob,Grep,Edit,Write,Bash(git status:*),Bash(npm run build:*),Bash(npm test:*),Bash(cargo test:*),Bash(cargo check:*)";
// Load no user, project or local settings (hooks, MCP servers, allow rules), and no MCP servers.
const NO_SETTING_SOURCES: &str = "";
const EMPTY_MCP_CONFIG: &str = r#"{"mcpServers":{}}"#;
const PROCESS_EVENT: &str = "process";
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct DelegationProcesses(pub Mutex<HashMap<String, mpsc::Sender<()>>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDelegationRequest {
    pub proposal_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareDelegationRequest {
    pub project_id: String,
    pub task: String,
    pub criteria: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelegationRun {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub task: String,
    pub driver: String,
    pub model: String,
    pub phase: String,
    pub workspace: String,
    pub branch: String,
    pub base_commit: String,
    pub agent_session_id: String,
    pub process_id: Option<u32>,
    pub milestone: String,
    pub checkpoint: Option<String>,
    pub outcome: Option<String>,
    pub changed_files: Vec<String>,
    pub diff_summary: Option<String>,
    pub error: Option<String>,
    pub started_at: String,
    pub updated_at: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Plan,
    Implement,
}

/// Without a console of its own (release builds), each console child would open a window.
pub(crate) fn hide_console(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
}

pub(crate) fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = hide_console(&mut Command::new("git"))
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            detail
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .trim_end_matches(&['\r', '\n'][..])
        .to_string())
}

fn project_id(name: &str) -> String {
    format!("project-{}", name.to_lowercase().replace(' ', "-"))
}

fn configured_projects_root(db: &Db) -> Result<PathBuf, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    let root = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'projectsRootPath'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "The projects root is not configured.".to_string())?;
    drop(connection);

    PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("The projects root is unavailable: {error}"))
}

fn resolve_project(db: &Db, requested_id: &str) -> Result<(String, PathBuf), String> {
    let root = configured_projects_root(db)?;

    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if project_id(name) != requested_id {
            continue;
        }

        let canonical = path.canonicalize().map_err(|error| error.to_string())?;
        if canonical.parent() != Some(root.as_path()) {
            return Err(
                "The selected project is not a direct child of the configured root.".to_string(),
            );
        }
        git(&canonical, &["rev-parse", "--is-inside-work-tree"])
            .map_err(|_| "The selected project is not a Git repository.".to_string())?;
        return Ok((name.to_string(), canonical));
    }

    Err("The selected project is not tracked under the configured projects root.".to_string())
}

pub(crate) fn run_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let digest = Sha256::digest(format!("{nanos}:{}:{sequence}", std::process::id()).as_bytes());
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15]
    )
}

/// Where Claude Code may be installed, most specific first: an explicit
/// `OLYMPUS_CLAUDE_CODE` path, then `claude.exe` on `PATH` (the native
/// installer), then the native installer's and npm's known locations. Only
/// real executables qualify; npm's `claude.cmd` shim cannot be spawned directly.
fn claude_candidates(
    var: impl Fn(&str) -> Option<std::ffi::OsString>,
) -> Vec<PathBuf> {
    let name = if cfg!(windows) { "claude.exe" } else { "claude" };
    let mut candidates = Vec::new();
    if let Some(explicit) = var("OLYMPUS_CLAUDE_CODE").filter(|value| !value.is_empty()) {
        candidates.push(PathBuf::from(explicit));
    }
    if let Some(path) = var("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|dir| dir.join(name)));
    }
    if let Some(home) = var("USERPROFILE").or_else(|| var("HOME")) {
        candidates.push(PathBuf::from(home).join(".local").join("bin").join(name));
    }
    if let Some(app_data) = var("APPDATA") {
        candidates.push(
            PathBuf::from(app_data)
                .join("npm")
                .join("node_modules")
                .join("@anthropic-ai")
                .join("claude-code")
                .join("bin")
                .join(name),
        );
    }
    candidates
}

pub(crate) fn claude_executable() -> Result<PathBuf, String> {
    let candidates = claude_candidates(|key| std::env::var_os(key));
    candidates
        .iter()
        .find(|candidate| candidate.is_file())
        .cloned()
        .ok_or_else(|| {
            "Claude Code was not found on PATH, in the native installer's location or in the npm global install. Set OLYMPUS_CLAUDE_CODE to its full path.".to_string()
        })
}

fn claude_version(executable: &Path) -> Result<String, String> {
    let output = hide_console(&mut Command::new(executable))
        .arg("--version")
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("Claude Code did not return a version.".to_string());
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        return Err("Claude Code returned an empty version.".to_string());
    }
    Ok(version)
}

fn active_run_for_project(db: &Db, project_id: &str) -> Result<Option<String>, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT id FROM delegation_runs WHERE project_id = ?1 AND phase IN \
             ('approved', 'preparing', 'planning', 'editing', 'testing', 'reviewing', 'waiting', 'awaiting_review') \
             ORDER BY started_at DESC LIMIT 1",
            params![project_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
fn insert_run(db: &Db, run: &DelegationRun) -> Result<(), String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    insert_run_connection(&connection,run)
}
fn insert_run_connection(connection:&rusqlite::Connection,run:&DelegationRun)->Result<(),String>{
    connection
        .execute(
            "INSERT INTO delegation_runs \
             (id, project_id, project_name, task, driver, model, phase, workspace, branch, \
              base_commit, agent_session_id, process_id, milestone, checkpoint, outcome, \
              changed_files_json, diff_summary, error) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                run.id,
                run.project_id,
                run.project_name,
                run.task,
                run.driver,
                run.model,
                run.phase,
                run.workspace,
                run.branch,
                run.base_commit,
                run.agent_session_id,
                run.process_id,
                run.milestone,
                run.checkpoint,
                run.outcome,
                serde_json::to_string(&run.changed_files).unwrap_or_else(|_| "[]".to_string()),
                run.diff_summary,
                run.error
            ],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn row_to_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<DelegationRun> {
    let changed_json: String = row.get(15)?;
    Ok(DelegationRun {
        id: row.get(0)?,
        project_id: row.get(1)?,
        project_name: row.get(2)?,
        task: row.get(3)?,
        driver: row.get(4)?,
        model: row.get(5)?,
        phase: row.get(6)?,
        workspace: row.get(7)?,
        branch: row.get(8)?,
        base_commit: row.get(9)?,
        agent_session_id: row.get(10)?,
        process_id: row.get(11)?,
        milestone: row.get(12)?,
        checkpoint: row.get(13)?,
        outcome: row.get(14)?,
        changed_files: serde_json::from_str(&changed_json).unwrap_or_default(),
        diff_summary: row.get(16)?,
        error: row.get(17)?,
        started_at: row.get(18)?,
        updated_at: row.get(19)?,
    })
}

const RUN_SELECT: &str = "SELECT id, project_id, project_name, task, driver, model, phase, \
workspace, branch, base_commit, agent_session_id, process_id, milestone, checkpoint, outcome, \
changed_files_json, diff_summary, error, started_at, updated_at FROM delegation_runs";

pub(crate) fn load_run(db: &Db, id: &str) -> Result<DelegationRun, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    connection
        .query_row(
            &format!("{RUN_SELECT} WHERE id = ?1"),
            params![id],
            row_to_run,
        )
        .map_err(|error| error.to_string())
}

fn phase_rank(phase: &str) -> u8 {
    match phase {
        "proposed" => 0,
        "approved" => 1,
        "preparing" => 2,
        "planning" => 3,
        "editing" => 4,
        "testing" => 5,
        "reviewing" => 6,
        "awaiting_review" => 7,
        "complete" => 8,
        _ => 0,
    }
}

fn effective_phase(current: &str, requested: &str) -> String {
    let linear = |candidate: &str| {
        matches!(
            candidate,
            "proposed"
                | "approved"
                | "preparing"
                | "planning"
                | "editing"
                | "testing"
                | "reviewing"
                | "awaiting_review"
                | "complete"
        )
    };

    if linear(current) && linear(requested) && phase_rank(current) > phase_rank(requested) {
        current.to_string()
    } else {
        requested.to_string()
    }
}

fn progress(app: &AppHandle, id: &str, phase: &str, milestone: &str, checkpoint: Option<&str>) {
    let db = app.state::<Db>();
    let current = load_run(db.inner(), id).ok();
    let effective_phase = current
        .as_ref()
        .map(|run| effective_phase(&run.phase, phase))
        .unwrap_or_else(|| phase.to_string());

    if let Ok(connection) = db.0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET phase = ?2, milestone = ?3, checkpoint = ?4, \
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, effective_phase, milestone, checkpoint],
        );
        let _ = connection.execute(
            "INSERT INTO delegation_events (run_id, phase, milestone) VALUES (?1, ?2, ?3)",
            params![id, effective_phase, milestone],
        );
    }

    if let Ok(run) = load_run(db.inner(), id) {
        let _ = app.emit(EVENT_NAME, run);
    }
}

fn fail(app: &AppHandle, id: &str, error: &str) {
    let db = app.state::<Db>();
    if let Ok(connection) = db.0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET phase = 'failed', milestone = 'Claude Code stopped', \
             checkpoint = NULL, process_id = NULL, error = ?2, updated_at = \
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, error],
        );
    }
    if let Ok(run) = load_run(db.inner(), id) {
        let _ = app.emit(EVENT_NAME, run);
    }
}

fn cancellation(app: &AppHandle, id: &str, milestone: &str) {
    let db = app.state::<Db>();
    if let Ok(connection) = db.0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET phase = 'cancelled', milestone = ?2, checkpoint = NULL, \
             process_id = NULL, error = NULL, updated_at = \
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, milestone],
        );
    }
    if let Ok(run) = load_run(db.inner(), id) {
        let _ = app.emit(EVENT_NAME, run);
    }
}

fn parse_agent_result(value: &Value) -> Result<String, String> {
    if value.get("is_error").and_then(Value::as_bool) == Some(true) {
        return Err(
            "Claude Code reported an error result; no successful outcome was established.".into(),
        );
    }
    let summary = value
        .get("result")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if summary.chars().count() > 20_000 {
        return Err("The agent result exceeds the review limit; preserve the workspace and prepare a smaller task.".into());
    }
    Ok(summary.to_string())
}

fn inspect_stream_line(
    app: &AppHandle,
    id: &str,
    stage: Stage,
    line: &str,
    result: &Arc<Mutex<Result<String, String>>>,
) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };

    if value.get("type").and_then(Value::as_str) == Some("result") {
        if let Ok(mut stored) = result.lock() {
            *stored = parse_agent_result(&value);
        }
        return;
    }

    let Some(content) = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_array)
    else {
        return;
    };

    for block in content {
        if block.get("type").and_then(Value::as_str) != Some("tool_use") {
            continue;
        }
        let name = block.get("name").and_then(Value::as_str).unwrap_or("tool");
        let input = block.get("input").cloned().unwrap_or(Value::Null);
        match name {
            "Edit" | "Write" | "NotebookEdit" => {
                let file = input
                    .get("file_path")
                    .and_then(Value::as_str)
                    .and_then(|path| Path::new(path).file_name())
                    .and_then(|name| name.to_str())
                    .unwrap_or("a project file");
                progress(app, id, "editing", &format!("Editing {file}"), None);
            }
            "Bash" => {
                let command = input.get("command").and_then(Value::as_str).unwrap_or("");
                let testing = ["test", "build", "check", "lint"]
                    .iter()
                    .any(|word| command.to_ascii_lowercase().contains(word));
                progress(
                    app,
                    id,
                    if testing { "testing" } else { "editing" },
                    if testing {
                        "Running project verification"
                    } else {
                        "Running a bounded workspace command"
                    },
                    None,
                );
            }
            "Read" | "Glob" | "Grep" => progress(
                app,
                id,
                "planning",
                if stage == Stage::Plan {
                    "Inspecting the project and forming a plan"
                } else {
                    "Inspecting the implementation context"
                },
                None,
            ),
            _ => {}
        }
    }
}

fn allowed_environment(command: &mut Command) {
    let keys = [
        "APPDATA",
        "LOCALAPPDATA",
        "USERPROFILE",
        "HOMEDRIVE",
        "HOMEPATH",
        "PATH",
        "PATHEXT",
        "TEMP",
        "TMP",
        "SystemRoot",
        "ComSpec",
    ];
    // No API key or token: Claude Code prefers `ANTHROPIC_API_KEY` and
    // `ANTHROPIC_AUTH_TOKEN` over its subscription login, so passing either
    // would bill the API for every delegated run (docs/ARMORY-PLAN.md, 0b).
    let values: Vec<(String, std::ffi::OsString)> = keys
        .iter()
        .filter_map(|key| std::env::var_os(key).map(|value| ((*key).to_string(), value)))
        .collect();
    command.env_clear();
    for (key, value) in values {
        command.env(key, value);
    }
}

fn plan_prompt(run: &DelegationRun) -> String {
    format!(
        "You are planning one approved, bounded task for Project Olympus's delegation pilot.\n\
         Task: {}\n\n\
         Inspect the repository in this isolated worktree. Do not edit files, commit, push, merge, \
         deploy, or change product direction. Return a concise implementation plan, verification \
         plan, risks, and one meaningful decision checkpoint for the operator. Do not expose chain \
         of thought.",
        run.task
    )
}

fn implementation_prompt(run: &DelegationRun) -> String {
    format!(
        "The operator approved the plan for this bounded task:\n{}\n\n\
         Implement it in this isolated worktree. You may inspect and edit files and run only the \
         pre-approved local verification commands. Do not commit, push, merge, deploy, delete human \
         work, or expand the task. If architecture, product direction, visual language, or a material \
         ambiguity arises, stop and state the decision needed. Finish with a concise outcome, tests \
         run, changed areas, and remaining risks. Do not expose chain of thought.",
        run.task
    )
}

fn spawn_claude(app: AppHandle, run: DelegationRun, stage: Stage) -> Result<(), String> {
    // The commands refuse first; this is the one place a process is started.
    super::acceptance::refuse_delegation()?;
    let executable = claude_executable()?;
    let (criteria, approved_plan) = contract(app.state::<Db>().inner(), &run.id)?;
    let evidence_contract = format!(
        "\n\nAcceptance criteria:\n{}",
        criteria
            .iter()
            .map(|c| format!("- {c}"))
            .collect::<Vec<_>>()
            .join("\n")
    );
    let prompt = match stage {
        Stage::Plan => format!("{}{}", plan_prompt(&run), evidence_contract),
        Stage::Implement => format!(
            "{}{}\n\nApproved plan:\n{}",
            implementation_prompt(&run),
            evidence_contract,
            approved_plan
        ),
    };
    let guidance = guidance_scope();
    // Persist the exact prepared payload before launching; failure prevents execution.
    // This records delivery intent, never a claim that the model followed it.
    {
        let db = app.state::<Db>();
        let connection = db.0.lock().map_err(|e| e.to_string())?;
        connection.execute(
            "INSERT INTO delegation_events(run_id,phase,milestone) VALUES(?1,'guidance_prepared',?2)",
            params![run.id, format!("{}\n{}", if stage == Stage::Plan { "Planning" } else { "Implementation" }, guidance)],
        ).map_err(|e| format!("Could not persist guidance evidence: {e}"))?;
    }
    let prompt = format!("{prompt}\n\nReviewed engineering guidance:\n{guidance}");
    let mut command = claude_command(&executable, &run, stage, prompt);
    allowed_environment(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Claude Code: {error}"))?;
    // Kill-on-close: if Olympus exits or crashes, the Claude process tree goes with it.
    let job = process_identity::Job::contain(&child);
    let process_id = child.id();
    if let Ok(connection) = app.state::<Db>().0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET process_id = ?2, updated_at = \
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![run.id, process_id],
        );
        let _ = record_process(&connection, &run.id, process_id);
    }
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Claude Code stdout was unavailable.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Claude Code stderr was unavailable.".to_string())?;
    let (cancel_sender, cancel_receiver) = mpsc::channel();
    app.state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(run.id.clone(), cancel_sender);

    let result = Arc::new(Mutex::new(Err(
        "Claude Code returned no result record.".to_string()
    )));
    let stderr_text = Arc::new(Mutex::new(String::new()));
    let stdout_app = app.clone();
    let stdout_id = run.id.clone();
    let stdout_result = result.clone();
    let stdout_thread = thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            inspect_stream_line(&stdout_app, &stdout_id, stage, &line, &stdout_result);
        }
    });
    let stderr_store = stderr_text.clone();
    let stderr_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        let _ = reader.read_to_string(&mut buffer);
        if let Ok(mut stored) = stderr_store.lock() {
            *stored = buffer;
        }
    });

    progress(
        &app,
        &run.id,
        if stage == Stage::Plan {
            "planning"
        } else {
            "editing"
        },
        if stage == Stage::Plan {
            "Claude Code is planning in the isolated worktree"
        } else {
            "Claude Code is implementing the approved plan"
        },
        None,
    );

    thread::spawn(move || {
        monitor_child(
            app,
            run,
            stage,
            &mut child,
            job,
            cancel_receiver,
            stdout_thread,
            stderr_thread,
            result,
            stderr_text,
        );
    });
    Ok(())
}

fn claude_command(executable: &Path, run: &DelegationRun, stage: Stage, prompt: String) -> Command {
    let mut command = Command::new(executable);
    hide_console(&mut command)
        .current_dir(&run.workspace)
        .args(["--print", "--output-format", "stream-json", "--verbose"])
        .args(["--max-budget-usd", MAX_BUDGET_USD, "--model", MODEL])
        .args(["--setting-sources", NO_SETTING_SOURCES])
        .args(["--strict-mcp-config", "--mcp-config", EMPTY_MCP_CONFIG])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    match stage {
        Stage::Plan => command
            .args(["--session-id", &run.agent_session_id])
            .args(["--permission-mode", "plan"])
            .args(["--tools", PLAN_TOOLS]),
        Stage::Implement => command
            .args(["--resume", &run.agent_session_id])
            .args(["--permission-mode", "dontAsk"])
            .args(["--tools", IMPLEMENTATION_BUILTINS])
            .args(["--allowedTools", IMPLEMENTATION_TOOLS]),
    };
    // `--tools`, `--allowedTools` and `--mcp-config` are variadic; without `--` the CLI
    // reads the prompt as one more tool name and exits with no input.
    command.arg("--").arg(prompt);
    command
}

#[cfg(target_os = "windows")]
pub(crate) fn terminate_process_tree(process_id: u32) -> bool {
    hide_console(&mut Command::new("taskkill"))
        .args(["/PID", &process_id.to_string(), "/T", "/F"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn terminate_process_tree(_process_id: u32) -> bool {
    false
}

/// A PID alone is not an identity: Windows reuses them. Olympus records the process
/// creation time beside the PID and acts on a PID only while both still match.
pub(crate) mod process_identity {
    #[cfg(windows)]
    mod os {
        use std::ffi::c_void;
        use std::os::windows::io::AsRawHandle;
        use std::process::Child;

        type Handle = *mut c_void;
        const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
        const STILL_ACTIVE: u32 = 259;
        const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x2000;
        const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

        #[repr(C)]
        #[derive(Default)]
        struct FileTime {
            low: u32,
            high: u32,
        }
        // JOBOBJECT_BASIC_LIMIT_INFORMATION / JOBOBJECT_EXTENDED_LIMIT_INFORMATION.
        #[repr(C)]
        #[derive(Default)]
        struct BasicLimits {
            per_process_user_time_limit: i64,
            per_job_user_time_limit: i64,
            limit_flags: u32,
            minimum_working_set_size: usize,
            maximum_working_set_size: usize,
            active_process_limit: u32,
            affinity: usize,
            priority_class: u32,
            scheduling_class: u32,
        }
        #[repr(C)]
        #[derive(Default)]
        struct ExtendedLimits {
            basic: BasicLimits,
            io_counters: [u64; 6],
            process_memory_limit: usize,
            job_memory_limit: usize,
            peak_process_memory_used: usize,
            peak_job_memory_used: usize,
        }
        // The kernel rejects a length that differs from the SDK structure.
        const _: () = assert!(
            std::mem::size_of::<ExtendedLimits>()
                == if cfg!(target_pointer_width = "64") {
                    144
                } else {
                    112
                }
        );

        #[link(name = "kernel32")]
        extern "system" {
            fn OpenProcess(access: u32, inherit: i32, process_id: u32) -> Handle;
            fn CloseHandle(handle: Handle) -> i32;
            fn GetExitCodeProcess(process: Handle, code: *mut u32) -> i32;
            fn GetProcessTimes(
                process: Handle,
                creation: *mut FileTime,
                exit: *mut FileTime,
                kernel: *mut FileTime,
                user: *mut FileTime,
            ) -> i32;
            fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> Handle;
            fn SetInformationJobObject(
                job: Handle,
                class: i32,
                information: *const c_void,
                length: u32,
            ) -> i32;
            fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
        }

        unsafe fn live_creation_time(process: Handle) -> Option<u64> {
            let mut code = 0u32;
            if GetExitCodeProcess(process, &mut code) == 0 || code != STILL_ACTIVE {
                return None;
            }
            let mut times: [FileTime; 4] = Default::default();
            let [creation, exit, kernel, user] = &mut times;
            if GetProcessTimes(process, creation, exit, kernel, user) == 0 {
                return None;
            }
            Some((u64::from(times[0].high) << 32) | u64::from(times[0].low))
        }

        pub fn creation_time(process_id: u32) -> Option<u64> {
            unsafe {
                let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
                if process.is_null() {
                    return None;
                }
                let created = live_creation_time(process);
                CloseHandle(process);
                created
            }
        }

        /// `None` when the PID no longer names the recorded process; nothing is stopped then.
        pub fn terminate_if(process_id: u32, identity: u64) -> Option<bool> {
            unsafe {
                let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
                if process.is_null() {
                    return None;
                }
                // The open handle keeps the PID from being reused while taskkill runs.
                let stopped = (live_creation_time(process) == Some(identity))
                    .then(|| super::super::terminate_process_tree(process_id));
                CloseHandle(process);
                stopped
            }
        }

        /// Closing the last job handle kills every process in it, including when Olympus
        /// exits or crashes, so a delegated tree cannot outlive the app that supervises it.
        pub struct Job(Handle);
        unsafe impl Send for Job {}
        impl Job {
            pub fn contain(child: &Child) -> Option<Job> {
                unsafe {
                    let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                    if handle.is_null() {
                        return None;
                    }
                    let job = Job(handle);
                    let mut limits = ExtendedLimits::default();
                    limits.basic.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    let configured = SetInformationJobObject(
                        job.0,
                        JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                        &limits as *const ExtendedLimits as *const c_void,
                        std::mem::size_of::<ExtendedLimits>() as u32,
                    ) != 0;
                    (configured
                        && AssignProcessToJobObject(job.0, child.as_raw_handle() as Handle) != 0)
                        .then_some(job)
                }
            }
        }
        impl Drop for Job {
            fn drop(&mut self) {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    // Linux reads the start time from /proc so the matching logic is testable in CI.
    #[cfg(not(windows))]
    mod os {
        use std::process::Child;

        pub fn creation_time(process_id: u32) -> Option<u64> {
            let stat = std::fs::read_to_string(format!("/proc/{process_id}/stat")).ok()?;
            // Fields follow the parenthesised command name, which may contain spaces.
            let fields: Vec<&str> = stat.rsplit_once(')')?.1.split_whitespace().collect();
            if fields.first() == Some(&"Z") {
                return None;
            }
            fields.get(19)?.parse().ok()
        }

        pub fn terminate_if(process_id: u32, identity: u64) -> Option<bool> {
            (creation_time(process_id) == Some(identity))
                .then(|| super::super::terminate_process_tree(process_id))
        }

        pub struct Job;
        impl Job {
            pub fn contain(_child: &Child) -> Option<Job> {
                None
            }
        }
    }

    pub use os::{creation_time, terminate_if, Job};
}

pub(crate) fn record_process(
    connection: &rusqlite::Connection,
    run_id: &str,
    process_id: u32,
) -> rusqlite::Result<usize> {
    // delegation_runs has no identity column; the append-only event log carries it.
    let identity = process_identity::creation_time(process_id)
        .map(|created| created.to_string())
        .unwrap_or_else(|| "unknown".into());
    connection.execute(
        "INSERT INTO delegation_events (run_id, phase, milestone) VALUES (?1, ?2, ?3)",
        params![
            run_id,
            PROCESS_EVENT,
            format!("pid {process_id} created {identity}")
        ],
    )
}

/// The recorded PID and identity, only while that PID still names the process Olympus
/// started. A legacy run without a recorded identity is never treated as running.
fn live_process(connection: &rusqlite::Connection, run: &DelegationRun) -> Option<(u32, u64)> {
    let process_id = run.process_id?;
    let recorded: String = connection
        .query_row(
            "SELECT milestone FROM delegation_events WHERE run_id = ?1 AND phase = ?2 \
             ORDER BY id DESC LIMIT 1",
            params![run.id, PROCESS_EVENT],
            |row| row.get(0),
        )
        .ok()?;
    let identity: u64 = recorded
        .strip_prefix(&format!("pid {process_id} created "))?
        .parse()
        .ok()?;
    (process_identity::creation_time(process_id) == Some(identity))
        .then_some((process_id, identity))
}

#[derive(Debug, PartialEq, Eq)]
enum Stop {
    Cancelled,
    TimedOut,
}

/// Waits for the child, stopping its process tree once on cancel or at the deadline.
fn supervise(
    child: &mut Child,
    cancel_receiver: &mpsc::Receiver<()>,
    limit: Duration,
) -> (Result<std::process::ExitStatus, String>, Option<Stop>, bool) {
    let started = Instant::now();
    let mut stop = None;
    let mut process_tree_stopped = false;
    let status = loop {
        if stop.is_none() {
            if cancel_receiver.try_recv().is_ok() {
                stop = Some(Stop::Cancelled);
            } else if started.elapsed() >= limit {
                stop = Some(Stop::TimedOut);
            }
            if stop.is_some() {
                process_tree_stopped = terminate_process_tree(child.id());
                if !process_tree_stopped {
                    let _ = child.kill();
                }
            }
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => thread::sleep(Duration::from_millis(120)),
            Err(error) => break Err(error.to_string()),
        }
    };
    (status, stop, process_tree_stopped)
}

#[allow(clippy::too_many_arguments)]
fn monitor_child(
    app: AppHandle,
    run: DelegationRun,
    stage: Stage,
    child: &mut Child,
    job: Option<process_identity::Job>,
    cancel_receiver: mpsc::Receiver<()>,
    stdout_thread: thread::JoinHandle<()>,
    stderr_thread: thread::JoinHandle<()>,
    result: Arc<Mutex<Result<String, String>>>,
    stderr_text: Arc<Mutex<String>>,
) {
    let (status, mut stop, process_tree_stopped) =
        supervise(child, &cancel_receiver, MAX_LAUNCH_DURATION);
    // Stop leftover descendants before joining, or one holding the pipes open would block.
    drop(job);

    let _ = stdout_thread.join();
    let _ = stderr_thread.join();
    let approval_state = app.state::<ApprovalState>();
    let Ok(_transition) = approval_state.execution.lock() else {
        return;
    };
    // Cancel holds this lock while it signals, so a request that landed as the process
    // exited is visible here and still wins over the result.
    if stop.is_none() && cancel_receiver.try_recv().is_ok() {
        stop = Some(Stop::Cancelled);
    }
    if let Ok(mut active) = app.state::<DelegationProcesses>().0.lock() {
        active.remove(&run.id);
    }
    if let Ok(connection) = app.state::<Db>().0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET process_id = NULL WHERE id = ?1",
            params![run.id],
        );
    }

    match stop {
        Some(Stop::Cancelled) => {
            cancellation(
                &app,
                &run.id,
                if process_tree_stopped {
                    "Cancelled; Claude process tree stopped and isolated worktree preserved"
                } else {
                    "Cancelled; Claude stopped and worktree preserved, but child-process status could not be verified"
                },
            );
            return;
        }
        Some(Stop::TimedOut) => {
            fail(
                &app,
                &run.id,
                if process_tree_stopped {
                    "Claude Code exceeded the 45-minute launch limit; its process tree was stopped and the isolated worktree preserved."
                } else {
                    "Claude Code exceeded the 45-minute launch limit and was stopped; child-process status could not be verified. The isolated worktree is preserved."
                },
            );
            return;
        }
        None => {}
    }

    let status = match status {
        Ok(status) => status,
        Err(error) => {
            fail(&app, &run.id, &error);
            return;
        }
    };
    if !status.success() {
        let detail = stderr_text
            .lock()
            .map(|text| text.trim().to_string())
            .unwrap_or_default();
        fail(
            &app,
            &run.id,
            if detail.is_empty() {
                "Claude Code exited without completing the run."
            } else {
                &detail
            },
        );
        return;
    }

    let summary = match result
        .lock()
        .map_err(|e| e.to_string())
        .and_then(|value| value.clone())
    {
        Ok(summary) => summary,
        Err(error) => {
            fail(&app, &run.id, &error);
            return;
        }
    };

    if stage == Stage::Plan {
        if summary.is_empty() {
            fail(
                &app,
                &run.id,
                "The planning process returned no plan. Prepare a fresh planning review.",
            );
            return;
        }
        let saved = app
            .state::<Db>()
            .0
            .lock()
            .map_err(|e| e.to_string())
            .and_then(|connection| {
                connection
                    .execute(
                        "UPDATE delegation_contracts SET plan = ?2 WHERE run_id = ?1",
                        params![run.id, summary],
                    )
                    .map_err(|e| e.to_string())
            });
        if !matches!(saved, Ok(1)) {
            fail(
                &app,
                &run.id,
                "The plan could not be saved; implementation is blocked.",
            );
            return;
        }
        let checkpoint = if summary.is_empty() {
            "Review the proposed plan, then approve implementation or cancel the preserved run."
                .to_string()
        } else {
            summary
        };
        progress(
            &app,
            &run.id,
            "waiting",
            "Plan ready; waiting for your decision",
            Some(&checkpoint),
        );
        return;
    }

    progress(
        &app,
        &run.id,
        "reviewing",
        "Collecting the reviewable workspace diff",
        None,
    );
    match collect_review(&run) {
        Ok((files, diff_summary)) => {
            let db = app.state::<Db>();
            if let Ok(connection) = db.0.lock() {
                let outcome = if summary.is_empty() {
                    "Claude Code exited successfully; the outcome is unverified until review."
                        .to_string()
                } else {
                    summary
                };
                let _ = connection.execute(
                    "UPDATE delegation_runs SET phase = 'awaiting_review', milestone = 'Reviewable result \
                     ready; nothing pushed or merged', checkpoint = NULL, outcome = ?2, \
                     changed_files_json = ?3, diff_summary = ?4, process_id = NULL, error = NULL, \
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
                    params![
                        run.id,
                        outcome,
                        serde_json::to_string(&files).unwrap_or_else(|_| "[]".to_string()),
                        diff_summary
                    ],
                );
            }
            if let Ok(updated) = load_run(db.inner(), &run.id) {
                let _ = app.emit(EVENT_NAME, updated);
            }
        }
        Err(error) => fail(&app, &run.id, &error),
    }
}

pub(crate) fn untracked_files(workspace: &Path) -> Result<Vec<String>, String> {
    Ok(git(
        workspace,
        &["ls-files", "--others", "--exclude-standard", "-z"],
    )?
    .split('\0')
    .filter(|p| !p.is_empty())
    .map(str::to_string)
    .collect())
}

pub(crate) fn collect_review(run: &DelegationRun) -> Result<(Vec<String>, String), String> {
    let workspace = PathBuf::from(&run.workspace);
    let mut files: Vec<String> = git(
        &workspace,
        &[
            "diff",
            "--no-ext-diff",
            "--name-only",
            "-z",
            &run.base_commit,
        ],
    )?
    .split('\0')
    .filter(|p| !p.is_empty())
    .map(str::to_string)
    .collect();
    files.extend(untracked_files(&workspace)?);
    files.sort();
    files.dedup();
    let summary = git(
        &workspace,
        &["diff", "--no-ext-diff", "--stat", &run.base_commit],
    )?;
    Ok((
        files,
        if summary.is_empty() {
            "No tracked diff; inspect any new files below.".into()
        } else {
            summary
        },
    ))
}

pub(crate) fn workspace_hash(workspace: &Path, base: &str) -> Result<String, String> {
    let mut hash = Sha256::new();
    hash.update(git(workspace, &["rev-parse", "HEAD"])?);
    hash.update(git(
        workspace,
        &["diff", "--no-ext-diff", "--no-textconv", "--binary", base],
    )?);
    let root = workspace.canonicalize().map_err(|e| e.to_string())?;
    for name in untracked_files(workspace)? {
        hash.update(name.as_bytes());
        hash.update([0]);
        let path = workspace
            .join(&name)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if !path.starts_with(&root) {
            return Err("An untracked file points outside the workspace.".into());
        }
        let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
        let mut buffer = [0u8; 8192];
        loop {
            let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            hash.update(&buffer[..n]);
        }
        hash.update([0]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

pub(crate) fn contract(db: &Db, id: &str) -> Result<(Vec<String>, String), String> {
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    let (criteria, plan): (String, String) = connection
        .query_row(
            "SELECT criteria_json, plan FROM delegation_contracts WHERE run_id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| {
            "This legacy run has no verifiable task contract; preserve it and prepare a new run."
                .to_string()
        })?;
    Ok((
        serde_json::from_str(&criteria).map_err(|e| e.to_string())?,
        plan,
    ))
}

pub(crate) fn planning_subject(
    app: &AppHandle,
    db: &Db,
    request: &PrepareDelegationRequest,
    id: &str,
) -> Result<Subject, String> {
    if request.task.trim().is_empty() || request.task.chars().count() > MAX_TASK_CHARS {
        return Err("A task of 1–4,000 characters is required.".into());
    }
    if request.criteria.is_empty()
        || request.criteria.len() > 8
        || request
            .criteria
            .iter()
            .any(|c| c.trim().is_empty() || c.chars().count() > 400)
    {
        return Err("Provide 1–8 acceptance criteria, each up to 400 characters.".into());
    }
    if active_run_for_project(db, &request.project_id)?.is_some() {
        return Err("Review or cancel the project's existing run first.".into());
    }
    let (project_name, repository) = resolve_project(db, &request.project_id)?;
    if !git(&repository, &["status", "--porcelain"])?.is_empty() {
        return Err(
            "The primary checkout has uncommitted work. Commit or stash it before preparing a run."
                .into(),
        );
    }
    let base_commit = git(&repository, &["rev-parse", "HEAD"])?;
    let driver = format!("Claude Code {}", claude_version(&claude_executable()?)?);
    let workspace = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("delegations")
        .join(id);
    Ok(Subject {
        project_id: request.project_id.clone(),
        project_name,
        repository: repository.to_string_lossy().into(),
        workspace_hash: workspace_hash(&repository, &base_commit)?,
        base_commit,
        driver,
        model: MODEL.into(),
        stage: "plan".into(),
        task: request.task.clone(),
        criteria: request.criteria.clone(),
        scope: plan_scope(),
        run_id: id.into(),
        workspace: workspace.to_string_lossy().into(),
        plan: String::new(),
    })
}

fn resume_subject(db: &Db, id: &str) -> Result<Subject, String> {
    {let c=db.0.lock().map_err(|e|e.to_string())?;super::organizer_store::validate_linked_run(&c,id).map_err(|e|e.message)?;}

    let run = load_run(db, id)?;
    if run.phase != "waiting" {
        return Err("Only a waiting run can be reviewed for resumption.".into());
    }
    let detached = live_process(&*db.0.lock().map_err(|e| e.to_string())?, &run);
    if detached.is_some() {
        return Err("A detached process is still running; cancel it before recovery.".into());
    }
    let (criteria, plan) = contract(db, id)?;
    let (project_name, repository) = resolve_project(db, &run.project_id)?;
    if git(&repository, &["rev-parse", "HEAD"])? != run.base_commit {
        return Err("The project's base changed. Preserve this run and prepare a new task.".into());
    }
    let workspace = PathBuf::from(&run.workspace)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let actual_common = git(
        &workspace,
        &["rev-parse", "--path-format=absolute", "--git-common-dir"],
    )?;
    let expected_common = git(
        &repository,
        &["rev-parse", "--path-format=absolute", "--git-common-dir"],
    )?;
    if PathBuf::from(actual_common)
        .canonicalize()
        .map_err(|e| e.to_string())?
        != PathBuf::from(expected_common)
            .canonicalize()
            .map_err(|e| e.to_string())?
    {
        return Err("The preserved workspace no longer belongs to this repository.".into());
    }
    Ok(Subject {
        project_id: run.project_id,
        project_name,
        repository: repository.to_string_lossy().into(),
        workspace_hash: workspace_hash(&workspace, &run.base_commit)?,
        base_commit: run.base_commit,
        driver: format!("Claude Code {}", claude_version(&claude_executable()?)?),
        model: MODEL.into(),
        stage: if plan.is_empty() { "plan" } else { "implement" }.into(),
        task: run.task,
        criteria,
        scope: if plan.is_empty() {
            plan_scope()
        } else {
            implementation_scope()
        },
        run_id: run.id,
        workspace: run.workspace,
        plan,
    })
}

// Olympus-authored adaptation, pinned and included in every approval subject.
const HEPHAESTUS_GUIDANCE: &str = include_str!("hephaestus-guidance.txt");
fn guidance_scope() -> String {
    format!("Superpowers pilot v1; guidance-sha256={:x}\n{}", Sha256::digest(HEPHAESTUS_GUIDANCE.as_bytes()), HEPHAESTUS_GUIDANCE)
}

const LAUNCH_LIMITS: &str =
    "no settings, hooks or MCP servers; $5 budget per launch, not per run; 45-minute launch limit";

fn plan_scope() -> String {
    format!("plan-v3: {PLAN_TOOLS}; no edits; {LAUNCH_LIMITS}\n{}", guidance_scope())
}

fn implementation_scope() -> String {
    format!("implement-v3: {IMPLEMENTATION_TOOLS}; {LAUNCH_LIMITS}; no commit/push/merge\n{}", guidance_scope())
}

/// A proposal as the review surface receives it. The approval binds `subject` alone;
/// the fields beside it are display derived from the same constants, never authority.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedProposal {
    #[serde(flatten)]
    pub proposal: Proposal,
    /// `None` for a scope this build does not issue; the surface then shows it raw.
    pub permitted: Option<PermittedActions>,
    /// The primary checkout's branch at `baseCommit`, when it is on one.
    pub base_branch: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermittedActions {
    /// Built-in tools Claude Code is offered for the launch.
    pub tools: Vec<String>,
    /// Command prefixes pre-approved inside `Bash`; any other command is denied.
    pub commands: Vec<String>,
    pub edits: bool,
    pub budget_usd: String,
    pub launch_limit_minutes: u64,
    /// What the scope rules out.
    pub excluded: Vec<String>,
}

/// Describes a scope only when it is byte-for-byte one this build issues, so the
/// words shown beside Approve cannot drift from the scope being approved.
fn permitted_actions(scope: &str) -> Option<PermittedActions> {
    let launch_limit_minutes = MAX_LAUNCH_DURATION.as_secs() / 60;
    let isolation = "settings, hooks and MCP servers".to_string();
    if scope == plan_scope() {
        return Some(PermittedActions {
            tools: PLAN_TOOLS.split(',').map(str::to_string).collect(),
            commands: Vec::new(),
            edits: false,
            budget_usd: MAX_BUDGET_USD.into(),
            launch_limit_minutes,
            excluded: vec!["edits".into(), "shell commands".into(), isolation],
        });
    }
    if scope == implementation_scope() {
        let mut tools = Vec::new();
        let mut commands = Vec::new();
        for entry in IMPLEMENTATION_TOOLS.split(',') {
            match entry
                .strip_prefix("Bash(")
                .and_then(|rest| rest.strip_suffix(":*)"))
            {
                Some(command) => commands.push(command.to_string()),
                None => tools.push(entry.to_string()),
            }
        }
        return Some(PermittedActions {
            tools,
            commands,
            edits: true,
            budget_usd: MAX_BUDGET_USD.into(),
            launch_limit_minutes,
            excluded: vec!["commit".into(), "push".into(), "merge".into(), isolation],
        });
    }
    None
}

/// The branch to show beside `base_commit`: only one checked out with its tip at
/// exactly that commit. Otherwise "branch @ hash" would name a commit the branch
/// no longer points at, so the surface shows the hash alone. Display only.
fn branch_at(repository: &Path, base_commit: &str) -> Option<String> {
    let head = git(repository, &["rev-parse", "HEAD"]).ok()?;
    if head != base_commit {
        return None;
    }
    git(repository, &["rev-parse", "--abbrev-ref", "HEAD"])
        .ok()
        .filter(|branch| !branch.is_empty() && branch != "HEAD")
}

pub(crate) fn present(proposal: Proposal) -> PreparedProposal {
    let base_branch = branch_at(
        Path::new(&proposal.subject.repository),
        &proposal.subject.base_commit,
    );
    PreparedProposal {
        permitted: permitted_actions(&proposal.subject.scope),
        base_branch,
        proposal,
    }
}

/// Git, worktree and process work must not run on the thread that services the window.
pub(crate) async fn blocking<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || work(&app))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn prepare_delegation_run(
    app: AppHandle,
    request: PrepareDelegationRequest,
) -> Result<PreparedProposal, String> {
    super::acceptance::refuse_delegation()?;
    blocking(app, move |app| {
        let db = app.state::<Db>();
        let state = app.state::<ApprovalState>();
        let _transition = state.execution.lock().map_err(|e| e.to_string())?;
        state
            .prepare(
                run_id(),
                planning_subject(app, db.inner(), &request, &run_id())?,
            )
            .map(present)
    })
    .await
}

#[tauri::command]
pub async fn prepare_delegation_resume(
    app: AppHandle,
    request: RunRequest,
) -> Result<PreparedProposal, String> {
    super::acceptance::refuse_delegation()?;
    blocking(app, move |app| {
        let db = app.state::<Db>();
        let state = app.state::<ApprovalState>();
        let _transition = state.execution.lock().map_err(|e| e.to_string())?;
        state
            .prepare(run_id(), resume_subject(db.inner(), &request.run_id)?)
            .map(present)
    })
    .await
}

#[tauri::command]
pub async fn start_delegation_run(
    app: AppHandle,
    request: StartDelegationRequest,
) -> Result<DelegationRun, String> {
    super::acceptance::refuse_delegation()?;
    blocking(app, move |app| start_run(app, request)).await
}

fn start_run(app: &AppHandle, request: StartDelegationRequest) -> Result<DelegationRun, String> {
    let db = app.state::<Db>();
    let state = app.state::<ApprovalState>();
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    let recorded={let c=db.0.lock().map_err(|e|e.to_string())?;super::organizer_store::recorded_start(&c,&request.proposal_id,&state.session_id).map_err(|e|e.message)?};
    if let Some(id)=recorded{return load_run(db.inner(),&id)}
    let proposal = state.get(&request.proposal_id)?;
    if proposal.subject.stage != "plan" || !proposal.subject.plan.is_empty() {
        return Err("This is not a planning proposal.".into());
    }
    let subject = planning_subject(
        app,
        db.inner(),
        &PrepareDelegationRequest {
            project_id: proposal.subject.project_id.clone(),
            task: proposal.subject.task.clone(),
            criteria: proposal.subject.criteria.clone(),
        },
        &proposal.subject.run_id,
    )?;
    let run = DelegationRun {
        id: subject.run_id.clone(),
        project_id: subject.project_id.clone(),
        project_name: subject.project_name.clone(),
        task: subject.task.clone(),
        driver: subject.driver.clone(),
        model: subject.model.clone(),
        phase: "preparing".into(),
        workspace: subject.workspace.clone(),
        branch: format!("olympus/run-{}", &subject.run_id[..8]),
        base_commit: subject.base_commit.clone(),
        agent_session_id: subject.run_id.clone(),
        process_id: None,
        milestone: "Approval consumed; preparing isolated workspace".into(),
        checkpoint: None,
        outcome: None,
        changed_files: Vec::new(),
        diff_summary: None,
        error: None,
        started_at: String::new(),
        updated_at: String::new(),
    };
    // Approval, attempted run, contract and Organizer binding share one transaction.
    {
        let mut connection=db.0.lock().map_err(|e|e.to_string())?;
        super::organizer_store::validate_binding(&connection,&request.proposal_id,&subject.run_id).map_err(|e|e.message)?;
        state.consume_with(&mut connection,&request.proposal_id,&subject,|tx|{
            insert_run_connection(tx,&run)?;
            tx.execute("INSERT INTO delegation_contracts(run_id,criteria_json) VALUES(?1,?2)",params![run.id,serde_json::to_string(&subject.criteria).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
            super::organizer_store::link_started_run(tx,&request.proposal_id,&run.id).map_err(|e|e.message)
        })?;
    }
    let preparation = (|| -> Result<(), String> {
        fs::create_dir_all(
            Path::new(&run.workspace)
                .parent()
                .ok_or("Missing workspace parent")?,
        )
        .map_err(|e| e.to_string())?;
        git(
            Path::new(&subject.repository),
            &[
                "worktree",
                "add",
                "-b",
                &run.branch,
                &run.workspace,
                &run.base_commit,
            ],
        )?;
        spawn_claude(app.clone(), run.clone(), Stage::Plan)
    })();
    if let Err(error) = preparation {
        fail(app, &run.id, &error);
        return Err(format!(
            "{error}. Approval was consumed; the failed attempt and any workspace are preserved."
        ));
    }
    load_run(db.inner(), &run.id)
}

#[tauri::command]
pub async fn resume_delegation_run(
    app: AppHandle,
    request: StartDelegationRequest,
) -> Result<DelegationRun, String> {
    super::acceptance::refuse_delegation()?;
    blocking(app, move |app| resume_run(app, request)).await
}

fn resume_run(app: &AppHandle, request: StartDelegationRequest) -> Result<DelegationRun, String> {
    let db = app.state::<Db>();
    let state = app.state::<ApprovalState>();
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    let proposal = state.get(&request.proposal_id)?;
    let subject = resume_subject(db.inner(), &proposal.subject.run_id)?;
    {
        let mut connection = db.0.lock().map_err(|e| e.to_string())?;
        state.consume(&mut connection, &request.proposal_id, &subject)?;
    }
    let mut run = load_run(db.inner(), &subject.run_id)?;
    let stage = if subject.stage == "plan" {
        Stage::Plan
    } else {
        Stage::Implement
    };
    if stage == Stage::Plan {
        run.agent_session_id = run_id();
        db.0.lock()
            .map_err(|e| e.to_string())?
            .execute(
                "UPDATE delegation_runs SET agent_session_id=?2 WHERE id=?1",
                params![run.id, run.agent_session_id],
            )
            .map_err(|e| e.to_string())?;
    }
    spawn_claude(app.clone(), run.clone(), stage).map_err(|e| {
        fail(app, &run.id, &e);
        e
    })?;
    load_run(db.inner(), &run.id)
}

#[tauri::command]
pub async fn cancel_delegation_run(
    app: AppHandle,
    request: RunRequest,
) -> Result<DelegationRun, String> {
    blocking(app, move |app| cancel_run(app, request)).await
}

fn cancel_run(app: &AppHandle, request: RunRequest) -> Result<DelegationRun, String> {
    let db = app.state::<Db>();
    let state = app.state::<ApprovalState>();
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    {
        let connection = db.0.lock().map_err(|e| e.to_string())?;
        state.revoke_run(&connection, &request.run_id)?;
    }
    let run = load_run(db.inner(), &request.run_id)?;
    if matches!(run.phase.as_str(), "complete" | "failed" | "cancelled") {
        return Ok(run);
    }

    let sender = app
        .state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .get(&request.run_id)
        .cloned();
    let detached = live_process(&*db.0.lock().map_err(|e| e.to_string())?, &run);
    if let Some(sender) = sender {
        let _ = sender.send(());
    } else if let Some((process_id, identity)) = detached {
        // Recheck identity at the moment of termination; a mismatch stops nothing.
        let stopped = process_identity::terminate_if(process_id, identity) == Some(true);
        cancellation(
            app,
            &request.run_id,
            if stopped {
                "Cancelled; detached Claude process tree stopped and isolated worktree preserved"
            } else {
                "Cancellation recorded and worktree preserved, but the detached process tree could not be verified"
            },
        );
    } else {
        cancellation(
            app,
            &request.run_id,
            "Cancelled; no Claude process was running and the isolated worktree is preserved",
        );
    }
    load_run(db.inner(), &request.run_id)
}

#[tauri::command]
pub async fn list_delegation_runs(app: AppHandle) -> Result<Vec<DelegationRun>, String> {
    blocking(app, list_runs).await
}

pub(crate) fn stored_runs(connection:&rusqlite::Connection)->Result<Vec<DelegationRun>,String>{
    let mut query = connection
        .prepare(&format!("{RUN_SELECT} WHERE phase NOT IN ('complete','failed','cancelled') OR id IN (SELECT run_id FROM organizer_run_links) OR id IN (SELECT id FROM delegation_runs ORDER BY started_at DESC LIMIT 20) ORDER BY started_at DESC"))
        .map_err(|error| error.to_string())?;
    let runs = query
        .query_map([], row_to_run)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(query);

    Ok(runs)
}

pub(crate) fn list_runs(app: &AppHandle) -> Result<Vec<DelegationRun>, String> {
    let db = app.state::<Db>();
    let state = app.state::<ApprovalState>();
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    let active: Vec<String> = app
        .state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .keys()
        .cloned()
        .collect();
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    let mut runs=stored_runs(&connection)?;

    for run in &mut runs {
        if matches!(
            run.phase.as_str(),
            "preparing" | "planning" | "editing" | "testing" | "reviewing"
        ) && !active.contains(&run.id)
        {
            recover_run(&connection, run)?;
        }
    }
    Ok(runs)
}

/// Settles a run whose supervising monitor no longer exists in this app instance.
fn recover_run(connection: &rusqlite::Connection, run: &mut DelegationRun) -> Result<(), String> {
    let detached_running = live_process(connection, run).is_some();
    // `testing` with a recorded outcome can only be an Olympus verification check; the
    // implementation result stands and only the check was lost.
    if !detached_running && run.phase == "testing" && run.outcome.is_some() {
        super::delegation_review::interrupt_checks(connection, &run.id)?;
        let milestone =
            "Olympus stopped during a verification check; the check is recorded as interrupted";
        connection
            .execute(
                "UPDATE delegation_runs SET phase = 'awaiting_review', milestone = ?2, \
                 checkpoint = NULL, process_id = NULL, \
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
                params![run.id, milestone],
            )
            .map_err(|error| error.to_string())?;
        run.phase = "awaiting_review".to_string();
        run.milestone = milestone.to_string();
        run.checkpoint = None;
        run.process_id = None;
        return Ok(());
    }
    let milestone = if detached_running {
        "Olympus restarted; a detached Claude process is still running"
    } else {
        "Previous process ended; isolated worktree preserved"
    };
    let checkpoint = if detached_running {
        "Cancel the detached process tree before deciding whether to resume the preserved run."
    } else {
        "Inspect the preserved workspace, then continue or cancel."
    };
    connection
        .execute(
            "UPDATE delegation_runs SET phase = 'waiting', milestone = ?2, checkpoint = ?3, \
             process_id = ?4, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') \
             WHERE id = ?1",
            params![
                run.id,
                milestone,
                checkpoint,
                if detached_running {
                    run.process_id
                } else {
                    None
                }
            ],
        )
        .map_err(|error| error.to_string())?;
    run.phase = "waiting".to_string();
    run.milestone = milestone.to_string();
    run.checkpoint = Some(checkpoint.to_string());
    if !detached_running {
        run.process_id = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_delegation_diff(app: AppHandle, request: RunRequest) -> Result<String, String> {
    blocking(app, move |app| {
        diff_for(app.state::<Db>().inner(), &request.run_id)
    })
    .await
}

fn diff_for(db: &Db, run_id: &str) -> Result<String, String> {
    let run = load_run(db, run_id)?;
    let workspace = PathBuf::from(&run.workspace);
    if !workspace.is_dir() {
        return Err("The delegated worktree is missing.".to_string());
    }

    let mut diff = git(
        &workspace,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            &run.base_commit,
        ],
    )?;
    let root = workspace.canonicalize().map_err(|e| e.to_string())?;
    for path in untracked_files(&workspace)? {
        let target = workspace
            .join(&path)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if !target.starts_with(&root) {
            return Err("A new file points outside the workspace.".into());
        }
        if target.is_file() {
            let contents = fs::read_to_string(&target)
                .unwrap_or_else(|_| "[binary or unreadable file]".to_string());
            diff.push_str(&format!(
                "\n\n--- /dev/null\n+++ b/{path}\n@@ new file @@\n{}",
                contents
            ));
        }
    }

    if diff.chars().count() > MAX_DIFF_CHARS {
        diff = diff.chars().take(MAX_DIFF_CHARS).collect();
        diff.push_str("\n\n[diff truncated by Olympus]");
    }
    Ok(if diff.trim().is_empty() {
        "No diff is present in the preserved worktree.".to_string()
    } else {
        diff
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_run_ids_are_valid_version_four_uuids() {
        let id = run_id();
        assert_eq!(id.len(), 36);
        assert_eq!(&id[14..15], "4");
        assert!(matches!(&id[19..20], "8" | "9" | "a" | "b"));
        assert_eq!(id.matches('-').count(), 4);
    }

    #[test]
    fn project_ids_match_the_scanner_contract() {
        assert_eq!(project_id("Project Olympus"), "project-project-olympus");
        assert_eq!(project_id("Olympus"), "project-olympus");
    }

    #[test]
    fn phase_progress_never_orders_editing_before_planning() {
        assert!(phase_rank("planning") < phase_rank("editing"));
        assert!(phase_rank("editing") < phase_rank("testing"));
        assert!(phase_rank("testing") < phase_rank("reviewing"));
        assert!(phase_rank("reviewing") < phase_rank("complete"));
    }

    /// The launch commands take an `AppHandle`, which the suite cannot build,
    /// so this pins that each one refuses before touching it, and that the one
    /// process spawn refuses too.
    #[test]
    fn launches_refuse_first_under_the_acceptance_profile() {
        let source = include_str!("delegation.rs").replace("\r\n", "\n");
        for name in [
            "pub async fn prepare_delegation_run(",
            "pub async fn prepare_delegation_resume(",
            "pub async fn start_delegation_run(",
            "pub async fn resume_delegation_run(",
            "fn spawn_claude(",
        ] {
            let at = source.find(name).unwrap_or_else(|| panic!("{name} missing"));
            let body = &source[at..];
            let first = body[body.find("{\n").unwrap() + 2..]
                .lines()
                .map(str::trim)
                .find(|line| !line.starts_with("//"))
                .unwrap_or_default();
            assert_eq!(first, "super::acceptance::refuse_delegation()?;", "{name} must refuse first");
        }
        let dir = std::env::temp_dir().join("olympus-acceptance-delegation");
        super::super::acceptance::with_profile(&dir, || {
            let refused = super::super::acceptance::refuse_delegation().unwrap_err();
            assert!(refused.starts_with("Disabled in the acceptance profile"));
        });
    }

    #[test]
    fn checkpoints_are_reachable_and_resumable() {
        assert_eq!(effective_phase("planning", "waiting"), "waiting");
        assert_eq!(effective_phase("waiting", "editing"), "editing");
        assert_eq!(effective_phase("testing", "planning"), "testing");
    }
}

#[cfg(test)]
mod result_boundary_tests {
    use super::*;
    #[test]
    fn agent_errors_and_oversized_results_are_not_plans() {
        assert!(
            parse_agent_result(&serde_json::json!({"is_error":true,"result":"failed"})).is_err()
        );
        assert!(parse_agent_result(&serde_json::json!({"result":"x".repeat(20_001)})).is_err());
        assert_eq!(
            parse_agent_result(&serde_json::json!({"is_error":false,"result":" reviewed plan "}))
                .unwrap(),
            "reviewed plan"
        );
    }
}

#[cfg(test)]
mod workspace_evidence_tests {
    use super::*;
    #[test]
    fn fingerprints_include_committed_edits_and_new_file_contents() {
        let root = std::env::temp_dir().join(format!("olympus-evidence-{}", run_id()));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init"]).unwrap();
        git(&root, &["config", "user.name", "Olympus test"]).unwrap();
        git(&root, &["config", "user.email", "test@example.invalid"]).unwrap();
        fs::write(root.join("tracked.txt"), "before").unwrap();
        git(&root, &["add", "."]).unwrap();
        git(&root, &["commit", "-m", "base"]).unwrap();
        let base = git(&root, &["rev-parse", "HEAD"]).unwrap();
        let initial = workspace_hash(&root, &base).unwrap();
        fs::write(root.join("tracked.txt"), "after").unwrap();
        git(&root, &["commit", "-am", "change"]).unwrap();
        let committed = workspace_hash(&root, &base).unwrap();
        assert_ne!(initial, committed);
        fs::write(root.join(" new file.txt"), "new evidence").unwrap();
        assert_eq!(untracked_files(&root).unwrap(), vec![" new file.txt"]);
        let new_file = workspace_hash(&root, &base).unwrap();
        assert_ne!(committed, new_file);
        fs::write(root.join(" new file.txt"), "changed evidence").unwrap();
        assert_ne!(new_file, workspace_hash(&root, &base).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn the_base_names_a_branch_only_while_its_tip_is_that_commit() {
        let root = std::env::temp_dir().join(format!("olympus-base-branch-{}", run_id()));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-b", "main"]).unwrap();
        git(&root, &["config", "user.name", "Olympus test"]).unwrap();
        git(&root, &["config", "user.email", "test@example.invalid"]).unwrap();
        fs::write(root.join("tracked.txt"), "before").unwrap();
        git(&root, &["add", "."]).unwrap();
        git(&root, &["commit", "-m", "base"]).unwrap();
        let base = git(&root, &["rev-parse", "HEAD"]).unwrap();
        assert_eq!(branch_at(&root, &base).as_deref(), Some("main"));

        // The branch moved on: "main @ base" would be false, so no branch.
        fs::write(root.join("tracked.txt"), "after").unwrap();
        git(&root, &["commit", "-am", "later"]).unwrap();
        assert_eq!(branch_at(&root, &base), None);

        // Detached at the base itself: there is no branch to name.
        git(&root, &["checkout", "--detach", &base]).unwrap();
        assert_eq!(branch_at(&root, &base), None);
        fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(test)]
mod process_boundary_tests {
    use super::*;
    use rusqlite::Connection;

    fn run(phase: &str, outcome: Option<&str>, process_id: Option<u32>) -> DelegationRun {
        DelegationRun {
            id: "run".into(),
            project_id: "project-x".into(),
            project_name: "X".into(),
            task: "Task".into(),
            driver: "Claude Code".into(),
            model: MODEL.into(),
            phase: phase.into(),
            workspace: "workspace".into(),
            branch: "olympus/run-x".into(),
            base_commit: "base".into(),
            agent_session_id: "session".into(),
            process_id,
            milestone: "m".into(),
            checkpoint: None,
            outcome: outcome.map(str::to_string),
            changed_files: Vec::new(),
            diff_summary: None,
            error: None,
            started_at: String::new(),
            updated_at: String::new(),
        }
    }

    fn database(run: &DelegationRun) -> Db {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(include_str!("../../schema.sql"))
            .unwrap();
        let db = Db(Mutex::new(connection));
        insert_run(&db, run).unwrap();
        db
    }

    fn args(command: &Command) -> Vec<String> {
        command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn launches_pin_tools_settings_and_mcp_and_end_options_before_the_prompt() {
        for stage in [Stage::Plan, Stage::Implement] {
            let args = args(&claude_command(
                Path::new("claude"),
                &run("approved", None, None),
                stage,
                "--tools Bash prompt".into(),
            ));
            let at = |flag: &str| args.iter().position(|a| a == flag).unwrap();
            assert_eq!(args[at("--setting-sources") + 1], "");
            assert_eq!(args[at("--mcp-config") + 1], EMPTY_MCP_CONFIG);
            assert!(args.contains(&"--strict-mcp-config".to_string()));
            assert_eq!(args[args.len() - 2], "--");
            assert_eq!(args.last().unwrap(), "--tools Bash prompt");
            let tools = &args[at("--tools") + 1];
            assert_eq!(
                tools,
                if stage == Stage::Plan {
                    PLAN_TOOLS
                } else {
                    IMPLEMENTATION_BUILTINS
                }
            );
            assert!(!args.iter().any(|a| a.contains("git diff")));
        }
        assert!(plan_scope().contains("per launch"));
    }

    #[test]
    fn permitted_actions_describe_exactly_the_issued_scopes() {
        let plan = permitted_actions(&plan_scope()).unwrap();
        assert_eq!(plan.tools, ["Read", "Glob", "Grep"]);
        assert!(plan.commands.is_empty() && !plan.edits);
        assert_eq!(plan.budget_usd, MAX_BUDGET_USD);
        assert_eq!(plan.launch_limit_minutes, 45);

        let implement = permitted_actions(&implementation_scope()).unwrap();
        assert_eq!(implement.tools, ["Read", "Glob", "Grep", "Edit", "Write"]);
        assert_eq!(
            implement.commands,
            [
                "git status",
                "npm run build",
                "npm test",
                "cargo test",
                "cargo check"
            ]
        );
        assert!(implement.edits);
        for action in ["commit", "push", "merge"] {
            assert!(implement.excluded.iter().any(|item| item == action));
            assert!(implementation_scope().contains(action));
        }
        // The words beside Approve come from the same constants the launch uses.
        for command in &implement.commands {
            assert!(IMPLEMENTATION_TOOLS.contains(&format!("Bash({command}:*)")));
        }

        // Anything else, including a scope one character off, is shown raw.
        assert_eq!(permitted_actions(&format!("{} ", plan_scope())), None);
        assert_eq!(permitted_actions("implement-v1: Read"), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_launch_is_stopped_at_its_deadline_or_on_cancel() {
        let (_sender, receiver) = mpsc::channel();
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let (status, stop, _) = supervise(&mut child, &receiver, Duration::from_millis(200));
        assert!(status.is_ok());
        assert_eq!(stop, Some(Stop::TimedOut));

        let (sender, receiver) = mpsc::channel();
        sender.send(()).unwrap();
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let (_, stop, _) = supervise(&mut child, &receiver, MAX_LAUNCH_DURATION);
        assert_eq!(stop, Some(Stop::Cancelled));

        let (_sender, receiver) = mpsc::channel();
        let mut child = Command::new("true").spawn().unwrap();
        let (status, stop, _) = supervise(&mut child, &receiver, MAX_LAUNCH_DURATION);
        assert!(status.unwrap().success());
        assert_eq!(stop, None);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn a_recorded_pid_counts_only_while_it_names_the_same_process() {
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let recorded = run("editing", None, Some(child.id()));
        let db = database(&recorded);
        let connection = db.0.lock().unwrap();
        assert_eq!(live_process(&connection, &recorded), None);
        record_process(&connection, "run", child.id()).unwrap();
        assert!(live_process(&connection, &recorded).is_some());
        // A reused PID has a different creation time and is neither reported nor stopped.
        connection
            .execute(
                "INSERT INTO delegation_events (run_id, phase, milestone) VALUES ('run', ?1, ?2)",
                params![PROCESS_EVENT, format!("pid {} created 1", child.id())],
            )
            .unwrap();
        assert_eq!(live_process(&connection, &recorded), None);
        assert_eq!(process_identity::terminate_if(child.id(), 1), None);
        child.kill().unwrap();
        child.wait().unwrap();
    }

    #[test]
    fn recovery_returns_an_interrupted_check_to_review_and_other_phases_to_waiting() {
        let mut testing = run("testing", Some("Implemented"), Some(u32::MAX));
        let db = database(&testing);
        let connection = db.0.lock().unwrap();
        connection.execute("INSERT INTO delegation_checks(id,run_id,check_name,exit_code,output,workspace_hash,started_at,finished_at) VALUES ('c','run','rust-tests',NULL,'','','2026-09-28T00:00:00Z','')",[]).unwrap();
        recover_run(&connection, &mut testing).unwrap();
        assert_eq!(testing.phase, "awaiting_review");
        assert_eq!(testing.process_id, None);
        let (exit, finished): (Option<i32>, String) = connection
            .query_row(
                "SELECT exit_code, finished_at FROM delegation_checks WHERE id='c'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(exit, None);
        assert!(!finished.is_empty());
        drop(connection);
        assert_eq!(load_run(&db, "run").unwrap().phase, "awaiting_review");

        let mut implementing = run("testing", None, None);
        let db = database(&implementing);
        recover_run(&db.0.lock().unwrap(), &mut implementing).unwrap();
        assert_eq!(implementing.phase, "waiting");
    }
    /// Subscription billing depends on this: Claude Code uses an API key or
    /// token ahead of its login, so neither may reach a delegated child.
    #[test]
    fn delegated_children_never_receive_provider_credentials() {
        let mut command = Command::new("claude");
        allowed_environment(&mut command);
        let passed: Vec<String> = command
            .get_envs()
            .map(|(key, _)| key.to_string_lossy().into_owned())
            .collect();
        for key in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] {
            assert!(!passed.iter().any(|name| name == key), "{key} must not be passed");
        }
        let source = include_str!("delegation.rs");
        let allowlist = &source[source.find("fn allowed_environment").unwrap()..];
        let allowlist = &allowlist[..allowlist.find("];").unwrap()];
        assert!(!allowlist.contains("API_KEY") && !allowlist.contains("AUTH_TOKEN"));
    }

    #[test]
    fn claude_code_is_looked_for_in_every_install_location_in_order() {
        let env = |key: &str| -> Option<std::ffi::OsString> {
            match key {
                "OLYMPUS_CLAUDE_CODE" => Some("C:/explicit/claude.exe".into()),
                "PATH" => Some(std::env::join_paths(["/first", "/second"]).unwrap()),
                "USERPROFILE" => Some("C:/Users/kev".into()),
                "APPDATA" => Some("C:/Users/kev/AppData/Roaming".into()),
                _ => None,
            }
        };
        let name = if cfg!(windows) { "claude.exe" } else { "claude" };
        let candidates = claude_candidates(env);
        assert_eq!(candidates[0], PathBuf::from("C:/explicit/claude.exe"));
        assert_eq!(candidates[1], PathBuf::from("/first").join(name));
        assert_eq!(candidates[2], PathBuf::from("/second").join(name));
        assert_eq!(candidates[3], PathBuf::from("C:/Users/kev").join(".local").join("bin").join(name));
        assert!(candidates[4].ends_with(PathBuf::from("npm/node_modules/@anthropic-ai/claude-code/bin").join(name)));
        assert!(claude_candidates(|_| None).is_empty());
    }
}

#[cfg(test)]
mod hephaestus_guidance_tests {
    use super::*;
    #[test]
    fn approval_scope_binds_reviewed_hephaestus_guidance() {
        assert!(plan_scope().contains("Superpowers"));
        assert!(implementation_scope().contains("guidance-sha256="));
        assert!(permitted_actions(&plan_scope()).is_some());
        assert!(permitted_actions(&(plan_scope()+" changed")).is_none());
    }
}
