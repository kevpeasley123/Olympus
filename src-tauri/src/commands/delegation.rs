//! Recoverable Claude Code delegation pilot.
//!
//! The webview supplies a tracked project ID and the already-recorded task. It
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
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager, State};

use super::persistence::Db;
use super::project_notes::load_project_notes;

const EVENT_NAME: &str = "delegation-run-updated";
const MAX_TASK_CHARS: usize = 1_000;
const MAX_DIFF_CHARS: usize = 120_000;
const MODEL: &str = "sonnet";
const MAX_BUDGET_USD: &str = "5";
const IMPLEMENTATION_TOOLS: &str = "Read,Glob,Grep,Edit,Write,Bash(git status:*),Bash(git diff:*),Bash(npm run build:*),Bash(npm test:*),Bash(cargo test:*),Bash(cargo check:*)";
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct DelegationProcesses(pub Mutex<HashMap<String, mpsc::Sender<()>>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDelegationRequest {
    pub project_id: String,
    pub task: String,
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

fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
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

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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
            return Err("The selected project is not a direct child of the configured root.".to_string());
        }
        git(&canonical, &["rev-parse", "--is-inside-work-tree"])
            .map_err(|_| "The selected project is not a Git repository.".to_string())?;
        return Ok((name.to_string(), canonical));
    }

    Err("The selected project is not tracked under the configured projects root.".to_string())
}

fn run_id() -> String {
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

fn claude_executable() -> Result<PathBuf, String> {
    let app_data = std::env::var_os("APPDATA")
        .ok_or_else(|| "APPDATA is unavailable; Claude Code cannot be located.".to_string())?;
    let executable = PathBuf::from(app_data)
        .join("npm")
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code")
        .join("bin")
        .join("claude.exe");

    if !executable.is_file() {
        return Err(format!(
            "The registered Claude Code executable is missing at {}.",
            executable.display()
        ));
    }
    Ok(executable)
}

fn claude_version(executable: &Path) -> Result<String, String> {
    let output = Command::new(executable)
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
             ('approved', 'preparing', 'planning', 'editing', 'testing', 'reviewing', 'waiting') \
             ORDER BY started_at DESC LIMIT 1",
            params![project_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn insert_run(db: &Db, run: &DelegationRun) -> Result<(), String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
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

fn load_run(db: &Db, id: &str) -> Result<DelegationRun, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    connection
        .query_row(&format!("{RUN_SELECT} WHERE id = ?1"), params![id], row_to_run)
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
        "complete" => 7,
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
                | "complete"
        )
    };

    if linear(current) && linear(requested) && phase_rank(current) > phase_rank(requested) {
        current.to_string()
    } else {
        requested.to_string()
    }
}

fn progress(
    app: &AppHandle,
    id: &str,
    phase: &str,
    milestone: &str,
    checkpoint: Option<&str>,
) {
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

fn inspect_stream_line(
    app: &AppHandle,
    id: &str,
    stage: Stage,
    line: &str,
    result: &Arc<Mutex<String>>,
) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };

    if value.get("type").and_then(Value::as_str) == Some("result") {
        if let Some(summary) = value.get("result").and_then(Value::as_str) {
            if let Ok(mut stored) = result.lock() {
                *stored = summary.trim().to_string();
            }
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
        "ANTHROPIC_API_KEY",
    ];
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
    let executable = claude_executable()?;
    let mut command = Command::new(executable);
    command
        .current_dir(&run.workspace)
        .args(["--print", "--output-format", "stream-json", "--verbose"])
        .args(["--max-budget-usd", MAX_BUDGET_USD, "--model", MODEL])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match stage {
        Stage::Plan => {
            command
                .args(["--session-id", &run.agent_session_id])
                .args(["--permission-mode", "plan"])
                .args(["--tools", "Read,Glob,Grep"])
                .arg(plan_prompt(&run));
        }
        Stage::Implement => {
            command
                .args(["--resume", &run.agent_session_id])
                .args(["--permission-mode", "dontAsk"])
                .args(["--allowedTools", IMPLEMENTATION_TOOLS])
                .arg(implementation_prompt(&run));
        }
    }
    allowed_environment(&mut command);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start Claude Code: {error}"))?;
    let process_id = child.id();
    if let Ok(connection) = app.state::<Db>().0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET process_id = ?2, updated_at = \
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![run.id, process_id],
        );
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

    let result = Arc::new(Mutex::new(String::new()));
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
            cancel_receiver,
            stdout_thread,
            stderr_thread,
            result,
            stderr_text,
        );
    });
    Ok(())
}

#[cfg(target_os = "windows")]
fn terminate_process_tree(process_id: u32) -> bool {
    Command::new("taskkill")
        .args(["/PID", &process_id.to_string(), "/T", "/F"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn terminate_process_tree(_process_id: u32) -> bool {
    false
}

#[cfg(target_os = "windows")]
fn process_is_running(process_id: u32) -> bool {
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {process_id}"), "/NH"])
        .output()
        .map(|output| {
            output.status.success()
                && String::from_utf8_lossy(&output.stdout).contains(&process_id.to_string())
        })
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn process_is_running(_process_id: u32) -> bool {
    false
}

#[allow(clippy::too_many_arguments)]
fn monitor_child(
    app: AppHandle,
    run: DelegationRun,
    stage: Stage,
    child: &mut Child,
    cancel_receiver: mpsc::Receiver<()>,
    stdout_thread: thread::JoinHandle<()>,
    stderr_thread: thread::JoinHandle<()>,
    result: Arc<Mutex<String>>,
    stderr_text: Arc<Mutex<String>>,
) {
    let mut cancelled = false;
    let mut process_tree_stopped = false;
    let status = loop {
        if cancel_receiver.try_recv().is_ok() {
            cancelled = true;
            process_tree_stopped = terminate_process_tree(child.id());
            if !process_tree_stopped {
                let _ = child.kill();
            }
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => thread::sleep(Duration::from_millis(120)),
            Err(error) => break Err(error.to_string()),
        }
    };

    let _ = stdout_thread.join();
    let _ = stderr_thread.join();
    if let Ok(mut active) = app.state::<DelegationProcesses>().0.lock() {
        active.remove(&run.id);
    }
    if let Ok(connection) = app.state::<Db>().0.lock() {
        let _ = connection.execute(
            "UPDATE delegation_runs SET process_id = NULL WHERE id = ?1",
            params![run.id],
        );
    }

    if cancelled {
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

    let summary = result
        .lock()
        .map(|value| value.trim().to_string())
        .unwrap_or_default();

    if stage == Stage::Plan {
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
                    "Claude Code completed; review the preserved diff before any merge.".to_string()
                } else {
                    summary
                };
                let _ = connection.execute(
                    "UPDATE delegation_runs SET phase = 'complete', milestone = 'Reviewable result \
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

fn collect_review(run: &DelegationRun) -> Result<(Vec<String>, String), String> {
    let workspace = PathBuf::from(&run.workspace);
    let status = git(&workspace, &["status", "--porcelain"])?;
    let mut files: Vec<String> = status
        .lines()
        .filter_map(|line| line.get(3..).map(str::trim))
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect();
    files.sort();
    files.dedup();
    let summary = git(&workspace, &["diff", "--stat", &run.base_commit])?;
    Ok((
        files,
        if summary.trim().is_empty() {
            "No tracked diff; review the changed-file list for new files.".to_string()
        } else {
            summary
        },
    ))
}

#[tauri::command]
pub fn start_delegation_run(
    app: AppHandle,
    db: State<Db>,
    request: StartDelegationRequest,
) -> Result<DelegationRun, String> {
    let task = request.task.split_whitespace().collect::<Vec<_>>().join(" ");
    if task.is_empty() {
        return Err("A committed project task is required.".to_string());
    }
    if task.chars().count() > MAX_TASK_CHARS {
        return Err(format!("Keep the delegated task under {MAX_TASK_CHARS} characters."));
    }
    if let Some(existing) = active_run_for_project(db.inner(), &request.project_id)? {
        return Err(format!(
            "This project already has an active delegated run ({existing}). Review or cancel it first."
        ));
    }

    let (project_name, project_path) = resolve_project(db.inner(), &request.project_id)?;
    let notes = load_project_notes();
    let committed_task = notes
        .lookup(&project_name)
        .and_then(|note| note.next_step.as_deref())
        .map(|task| task.split_whitespace().collect::<Vec<_>>().join(" "))
        .ok_or_else(|| {
            "This project has no committed next action in its vault note, so Olympus will not \
             invent a task for Claude Code."
                .to_string()
        })?;
    if committed_task != task {
        return Err(
            "The proposed task no longer matches the project's committed next action. Refresh \
             Project mode and approve the current task."
                .to_string(),
        );
    }
    let dirty = git(&project_path, &["status", "--porcelain"])?;
    if !dirty.trim().is_empty() {
        return Err(
            "The project's primary checkout has uncommitted work. Protect or commit it before \
             delegation so the run starts from a known base."
                .to_string(),
        );
    }

    let executable = claude_executable()?;
    let version = claude_version(&executable)?;
    let id = run_id();
    let branch = format!("olympus/run-{}", &id[..8]);
    let base_commit = git(&project_path, &["rev-parse", "HEAD"])?;
    let workspace_root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("delegations");
    fs::create_dir_all(&workspace_root).map_err(|error| error.to_string())?;
    let workspace = workspace_root.join(&id);
    let workspace_text = workspace.to_string_lossy().to_string();

    git(
        &project_path,
        &[
            "worktree",
            "add",
            "-b",
            &branch,
            &workspace_text,
            &base_commit,
        ],
    )?;

    let run = DelegationRun {
        id: id.clone(),
        project_id: request.project_id,
        project_name,
        task,
        driver: format!("Claude Code {version}"),
        model: MODEL.to_string(),
        phase: "preparing".to_string(),
        workspace: workspace_text,
        branch,
        base_commit,
        agent_session_id: id,
        process_id: None,
        milestone: "Isolated branch and worktree created".to_string(),
        checkpoint: None,
        outcome: None,
        changed_files: Vec::new(),
        diff_summary: None,
        error: None,
        started_at: String::new(),
        updated_at: String::new(),
    };

    if let Err(error) = insert_run(db.inner(), &run) {
        return Err(format!(
            "The worktree was created at {}, but the run record failed: {error}. It was preserved.",
            run.workspace
        ));
    }
    let stored = load_run(db.inner(), &run.id)?;
    spawn_claude(app.clone(), stored.clone(), Stage::Plan).map_err(|error| {
        fail(&app, &stored.id, &error);
        error
    })?;
    load_run(db.inner(), &stored.id)
}

#[tauri::command]
pub fn resume_delegation_run(
    app: AppHandle,
    db: State<Db>,
    request: RunRequest,
) -> Result<DelegationRun, String> {
    let run = load_run(db.inner(), &request.run_id)?;
    if run.phase != "waiting" {
        return Err("Only a run waiting at a checkpoint can continue.".to_string());
    }
    if !Path::new(&run.workspace).is_dir() {
        return Err("The run's preserved worktree is missing; recovery cannot continue.".to_string());
    }
    if run.process_id.is_some_and(process_is_running) {
        return Err(
            "A detached Claude process is still running for this preserved run. Cancel it before \
             starting recovery."
                .to_string(),
        );
    }
    spawn_claude(app.clone(), run.clone(), Stage::Implement).map_err(|error| {
        fail(&app, &run.id, &error);
        error
    })?;
    load_run(db.inner(), &run.id)
}

#[tauri::command]
pub fn cancel_delegation_run(
    app: AppHandle,
    db: State<Db>,
    request: RunRequest,
) -> Result<DelegationRun, String> {
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
    if let Some(sender) = sender {
        let _ = sender.send(());
    } else if let Some(process_id) = run.process_id.filter(|id| process_is_running(*id)) {
        let stopped = terminate_process_tree(process_id);
        cancellation(
            &app,
            &request.run_id,
            if stopped {
                "Cancelled; detached Claude process tree stopped and isolated worktree preserved"
            } else {
                "Cancellation recorded and worktree preserved, but the detached process tree could not be verified"
            },
        );
    } else {
        cancellation(
            &app,
            &request.run_id,
            "Cancelled; no Claude process was running and the isolated worktree is preserved",
        );
    }
    load_run(db.inner(), &request.run_id)
}

#[tauri::command]
pub fn list_delegation_runs(
    app: AppHandle,
    db: State<Db>,
) -> Result<Vec<DelegationRun>, String> {
    let active: Vec<String> = app
        .state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .keys()
        .cloned()
        .collect();
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    let mut query = connection
        .prepare(&format!("{RUN_SELECT} ORDER BY started_at DESC LIMIT 20"))
        .map_err(|error| error.to_string())?;
    let mut runs = query
        .query_map([], row_to_run)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    drop(query);

    for run in &mut runs {
        if matches!(
            run.phase.as_str(),
            "preparing" | "planning" | "editing" | "testing" | "reviewing"
        ) && !active.contains(&run.id)
        {
            let detached_running = run.process_id.is_some_and(process_is_running);
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
                        if detached_running { run.process_id } else { None }
                    ],
                )
                .map_err(|error| error.to_string())?;
            run.phase = "waiting".to_string();
            run.milestone = milestone.to_string();
            run.checkpoint = Some(checkpoint.to_string());
            if !detached_running {
                run.process_id = None;
            }
        }
    }
    Ok(runs)
}

#[tauri::command]
pub fn fetch_delegation_diff(db: State<Db>, request: RunRequest) -> Result<String, String> {
    let run = load_run(db.inner(), &request.run_id)?;
    let workspace = PathBuf::from(&run.workspace);
    if !workspace.is_dir() {
        return Err("The delegated worktree is missing.".to_string());
    }

    let mut diff = git(&workspace, &["diff", "--no-color", &run.base_commit])?;
    let status = git(&workspace, &["status", "--porcelain"])?;
    for path in status
        .lines()
        .filter(|line| line.starts_with("?? "))
        .filter_map(|line| line.get(3..))
    {
        let target = workspace.join(path);
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

    #[test]
    fn checkpoints_are_reachable_and_resumable() {
        assert_eq!(effective_phase("planning", "waiting"), "waiting");
        assert_eq!(effective_phase("waiting", "editing"), "editing");
        assert_eq!(effective_phase("testing", "planning"), "testing");
    }
}
