//! Verification evidence and explicit operator review; agent output is not completion.
use super::{
    approvals::ApprovalState,
    delegation::{self, DelegationProcesses, DelegationRun, RunRequest},
    persistence::Db,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::Read,
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

const CHECKS: [(&str, &str); 3] = [
    ("frontend-build", "Frontend build"),
    ("rust-tests", "Rust tests"),
    ("npm-test", "npm test"),
];
// Enough for npm, node, cargo and the MSVC toolchain lookup. Never an API key: checks run
// scripts the agent may have written.
const CHECK_ENVIRONMENT: [&str; 22] = [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "SystemDrive",
    "windir",
    "ComSpec",
    "TEMP",
    "TMP",
    "TMPDIR",
    "USERPROFILE",
    "HOMEDRIVE",
    "HOMEPATH",
    "HOME",
    "APPDATA",
    "LOCALAPPDATA",
    "ProgramData",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
    "CARGO_HOME",
    "RUSTUP_HOME",
];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckEvidence {
    pub id: String,
    pub check_name: String,
    pub exit_code: Option<i32>,
    pub output: String,
    pub workspace_hash: String,
    pub started_at: String,
    pub finished_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDetails {
    pub criteria: Vec<String>,
    pub plan: String,
    pub checks: Vec<CheckEvidence>,
    pub approvals: Vec<String>,
    pub available_checks: Vec<CheckOption>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckOption {
    pub id: String,
    pub label: String,
    /// Why this check cannot run in this worktree; `None` when it can.
    pub unavailable: Option<String>,
}

fn checks(db: &Db, run_id: &str) -> Result<Vec<CheckEvidence>, String> {
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    let mut query=connection.prepare("SELECT id,check_name,exit_code,output,workspace_hash,started_at,finished_at FROM delegation_checks WHERE run_id=?1 ORDER BY rowid DESC").map_err(|e|e.to_string())?;
    let rows = query
        .query_map([run_id], |r| {
            Ok(CheckEvidence {
                id: r.get(0)?,
                check_name: r.get(1)?,
                exit_code: r.get(2)?,
                output: r.get(3)?,
                workspace_hash: r.get(4)?,
                started_at: r.get(5)?,
                finished_at: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_delegation_review(
    app: AppHandle,
    request: RunRequest,
) -> Result<ReviewDetails, String> {
    delegation::blocking(app, move |app| {
        review(app.state::<Db>().inner(), &request.run_id)
    })
    .await
}

fn review(db: &Db, run_id: &str) -> Result<ReviewDetails, String> {
    let (criteria, plan) = delegation::contract(db, run_id)?;
    let evidence = checks(db, run_id)?;
    let workspace = delegation::load_run(db, run_id)?.workspace;
    let available_checks = CHECKS
        .iter()
        .map(|(id, label)| {
            Ok(CheckOption {
                id: (*id).into(),
                label: (*label).into(),
                unavailable: unavailable(id, Path::new(&workspace))?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    let mut query=connection.prepare("SELECT stage || ' · ' || approved_at || ' · record ' || id FROM operator_approvals WHERE run_id=?1 ORDER BY rowid").map_err(|e|e.to_string())?;
    let approvals = query
        .query_map([run_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(ReviewDetails {
        criteria,
        plan,
        checks: evidence,
        approvals,
        available_checks,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRequest {
    pub run_id: String,
    pub check_id: String,
}

fn rust_manifest(workspace: &Path) -> Option<&'static str> {
    ["src-tauri/Cargo.toml", "Cargo.toml"]
        .into_iter()
        .find(|manifest| workspace.join(manifest).is_file())
}

/// Why a registered check cannot run in this worktree. Such a check records nothing, so it
/// never blocks completion; a check that runs and fails still does.
fn unavailable(id: &str, workspace: &Path) -> Result<Option<String>, String> {
    Ok(match id {
        "frontend-build" | "npm-test" => {
            let script = if id == "frontend-build" {
                "build"
            } else {
                "test"
            };
            let declared = std::fs::read_to_string(workspace.join("package.json"))
                .ok()
                .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
                .is_some_and(|package| package["scripts"][script].is_string());
            if !declared {
                Some(format!(
                    "Not applicable: this worktree's package.json declares no {script} script."
                ))
            } else if !workspace.join("node_modules").is_dir() {
                Some("Dependencies not installed: this worktree has no node_modules. Olympus does not install them, because install scripts run code from the agent's package.json.".into())
            } else {
                None
            }
        }
        "rust-tests" => rust_manifest(workspace)
            .is_none()
            .then(|| "Not applicable: no Cargo.toml at the worktree root or in src-tauri.".into()),
        _ => return Err("Select a registered verification check.".into()),
    })
}

fn command_for(id: &str, workspace: &Path, cargo_target: &Path) -> Result<Command, String> {
    let mut command = match id {
        "frontend-build" | "npm-test" => {
            #[cfg(windows)]
            let mut c = {
                let mut c = Command::new("cmd.exe");
                c.args(["/D", "/S", "/C"]);
                c
            };
            #[cfg(not(windows))]
            let mut c = Command::new("npm");
            #[cfg(windows)]
            c.arg("npm");
            if id == "frontend-build" {
                c.args(["run", "build"]);
            } else {
                c.arg("test");
            }
            c
        }
        "rust-tests" => {
            let manifest = rust_manifest(workspace).ok_or("No Cargo.toml in this worktree.")?;
            let mut c = Command::new("cargo");
            c.args(["test", "--lib", "--manifest-path", manifest]);
            c
        }
        _ => return Err("Select a registered verification check.".into()),
    };
    check_environment(&mut command, |key| std::env::var_os(key));
    // Shared per project so each fresh worktree does not start from a cold build.
    command.env("CARGO_TARGET_DIR", cargo_target);
    Ok(command)
}

fn check_environment(command: &mut Command, lookup: impl Fn(&str) -> Option<OsString>) {
    command.env_clear();
    for key in CHECK_ENVIRONMENT {
        if let Some(value) = lookup(key) {
            command.env(key, value);
        }
    }
}

/// Closes out checks that were running when Olympus stopped; an interrupted check has no
/// exit code, so it blocks completion until that check is rerun.
pub(crate) fn interrupt_checks(
    connection: &rusqlite::Connection,
    run_id: &str,
) -> Result<usize, String> {
    connection
        .execute(
            "UPDATE delegation_checks SET output = output || ?2, finished_at = ?3 \
             WHERE run_id = ?1 AND finished_at = ''",
            params![
                run_id,
                "\n[Interrupted: Olympus stopped before this check finished. Rerun it.]",
                chrono::Utc::now().to_rfc3339()
            ],
        )
        .map_err(|e| e.to_string())
}

fn capture(mut reader: impl Read) -> String {
    let mut collected = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut omitted = false;
    while let Ok(n) = reader.read(&mut chunk) {
        if n == 0 {
            break;
        }
        let keep = n.min(30_000usize.saturating_sub(collected.len()));
        collected.extend_from_slice(&chunk[..keep]);
        omitted |= keep < n;
    }
    let mut text = String::from_utf8_lossy(&collected).into_owned();
    if omitted {
        text.push_str("\n[additional output omitted]");
    }
    text
}

#[tauri::command]
pub async fn run_delegation_check(
    app: tauri::AppHandle,
    request: CheckRequest,
) -> Result<CheckEvidence, String> {
    tauri::async_runtime::spawn_blocking(move || check_blocking(app, request))
        .await
        .map_err(|e| e.to_string())?
}

fn check_blocking(app: tauri::AppHandle, request: CheckRequest) -> Result<CheckEvidence, String> {
    let state = app.state::<ApprovalState>();
    let transition = state.execution.lock().map_err(|e| e.to_string())?;
    let db = app.state::<Db>();
    let run = delegation::load_run(db.inner(), &request.run_id)?;
    if run.phase != "awaiting_review" {
        return Err("Verification is available only for a run awaiting review.".into());
    }
    let workspace = Path::new(&run.workspace);
    if let Some(reason) = unavailable(&request.check_id, workspace)? {
        return Err(reason);
    }
    let before = delegation::workspace_hash(workspace, &run.base_commit)?;
    let cargo_target = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("delegation-targets")
        .join(&run.project_id);
    let mut command = command_for(&request.check_id, workspace, &cargo_target)?;
    delegation::hide_console(&mut command)
        .current_dir(workspace)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let started_at = chrono::Utc::now().to_rfc3339();
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let job = delegation::process_identity::Job::contain(&child);
    let stdout = child.stdout.take().ok_or("Missing check stdout")?;
    let stderr = child.stderr.take().ok_or("Missing check stderr")?;
    let out = thread::spawn(move || capture(stdout));
    let err = thread::spawn(move || capture(stderr));
    let (sender, receiver) = mpsc::channel();
    app.state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(run.id.clone(), sender);
    let evidence_id = delegation::run_id();
    {
        // Recorded before it runs, so a restart mid-check leaves an interrupted row to settle.
        let mut connection = db.0.lock().map_err(|e| e.to_string())?;
        let tx = connection.transaction().map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO delegation_checks(id,run_id,check_name,exit_code,output,workspace_hash,started_at,finished_at) VALUES (?1,?2,?3,NULL,'','',?4,'')",params![evidence_id,run.id,request.check_id,started_at]).map_err(|e|e.to_string())?;
        tx.execute("UPDATE delegation_runs SET phase='testing',process_id=?2,milestone='Running an Olympus verification check' WHERE id=?1",params![run.id,child.id()]).map_err(|e|e.to_string())?;
        delegation::record_process(&tx, &run.id, child.id()).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    drop(transition);
    let timer = Instant::now();
    let mut interrupted = false;
    let mut cancelled;
    let exit_code = loop {
        cancelled = receiver.try_recv().is_ok();
        if cancelled || timer.elapsed() > Duration::from_secs(600) {
            interrupted = true;
            delegation::terminate_process_tree(child.id());
            let _ = child.kill();
            let _ = child.wait();
            break None;
        }
        match child.try_wait() {
            Ok(Some(s)) => break s.code(),
            Ok(None) => thread::sleep(Duration::from_millis(120)),
            Err(_) => {
                interrupted = true;
                delegation::terminate_process_tree(child.id());
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };
    // Stop leftover descendants before joining, or one holding the pipes open would block.
    drop(job);
    let mut output = format!(
        "{}\n{}",
        out.join().unwrap_or_default(),
        err.join().unwrap_or_default()
    );
    if interrupted {
        output.push_str("\n[Verification cancelled, timed out, or could not be observed]");
    }
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    app.state::<DelegationProcesses>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&run.id);
    let after = delegation::workspace_hash(workspace, &run.base_commit);
    let fingerprint = match after {
        Ok(hash) if hash == before => hash,
        _ => {
            output.push_str("\n[Workspace changed during verification; this check cannot establish the current result]");
            String::new()
        }
    };
    let evidence = CheckEvidence {
        id: evidence_id,
        check_name: request.check_id,
        exit_code,
        output,
        workspace_hash: fingerprint,
        started_at,
        finished_at: chrono::Utc::now().to_rfc3339(),
    };
    let mut connection = db.0.lock().map_err(|e| e.to_string())?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    tx.execute("UPDATE delegation_checks SET exit_code=?2,output=?3,workspace_hash=?4,finished_at=?5 WHERE id=?1",params![evidence.id,evidence.exit_code,evidence.output,evidence.workspace_hash,evidence.finished_at]).map_err(|e|e.to_string())?;
    tx.execute(
        "UPDATE delegation_runs SET phase=?2,process_id=NULL,milestone=?3 WHERE id=?1",
        params![
            run.id,
            if cancelled {
                "cancelled"
            } else {
                "awaiting_review"
            },
            if cancelled {
                "Verification cancelled; workspace preserved"
            } else {
                "Verification recorded; operator review required"
            }
        ],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    drop(connection);
    app.emit(
        "delegation-run-updated",
        delegation::load_run(db.inner(), &run.id)?,
    )
    .ok();
    Ok(evidence)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CriterionEvidence {
    pub criterion: String,
    pub note: String,
    pub check_id: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteRequest {
    pub run_id: String,
    pub workspace_hash: String,
    pub evidence: Vec<CriterionEvidence>,
    pub unresolved_issues: String,
}

fn validate_review(
    criteria: &[String],
    evidence: &[CriterionEvidence],
    checks: &[CheckEvidence],
    hash: &str,
) -> Result<(), String> {
    if criteria.is_empty() || criteria.len() != evidence.len() {
        return Err("Every acceptance criterion needs evidence.".into());
    }
    for (criterion, item) in criteria.iter().zip(evidence) {
        if criterion != &item.criterion
            || item.note.trim().chars().count() < 20
            || item.note.chars().count() > 2_000
        {
            return Err(
                "For each exact criterion, describe the observed evidence (20–2,000 characters)."
                    .into(),
            );
        }
        if let Some(id) = &item.check_id {
            if !checks
                .iter()
                .any(|c| &c.id == id && c.exit_code == Some(0) && c.workspace_hash == hash)
            {
                return Err(
                    "Selected check is missing, failed, or describes a different workspace.".into(),
                );
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    for check in checks {
        if seen.insert(&check.check_name)
            && (check.exit_code != Some(0) || check.workspace_hash != hash)
        {
            return Err("A latest verification check failed or is stale. Resolve it and rerun that check before completion.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn delegation_review_fingerprint(
    app: AppHandle,
    request: RunRequest,
) -> Result<String, String> {
    delegation::blocking(app, move |app| {
        let run = delegation::load_run(app.state::<Db>().inner(), &request.run_id)?;
        delegation::workspace_hash(Path::new(&run.workspace), &run.base_commit)
    })
    .await
}

#[tauri::command]
pub async fn complete_delegation_review(
    app: AppHandle,
    request: CompleteRequest,
) -> Result<DelegationRun, String> {
    delegation::blocking(app, move |app| complete(app, request)).await
}

fn complete(app: &AppHandle, request: CompleteRequest) -> Result<DelegationRun, String> {
    let db = app.state::<Db>();
    let state = app.state::<ApprovalState>();
    let _transition = state.execution.lock().map_err(|e| e.to_string())?;
    let run = delegation::load_run(db.inner(), &request.run_id)?;
    if run.phase != "awaiting_review" || !request.unresolved_issues.trim().is_empty() {
        return Err("Only a reviewed run with no unresolved issues can be completed.".into());
    }
    let hash = delegation::workspace_hash(std::path::Path::new(&run.workspace), &run.base_commit)?;
    if hash != request.workspace_hash {
        return Err("The workspace changed during review; inspect a fresh diff.".into());
    }
    let (criteria, _) = delegation::contract(db.inner(), &run.id)?;
    validate_review(
        &criteria,
        &request.evidence,
        &checks(db.inner(), &run.id)?,
        &hash,
    )?;
    let mut connection = db.0.lock().map_err(|e| e.to_string())?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO delegation_reviews(run_id,session_id,criteria_evidence_json,workspace_hash) VALUES (?1,?2,?3,?4)",params![run.id,state.session_id,serde_json::to_string(&request.evidence).map_err(|e|e.to_string())?,hash]).map_err(|e|e.to_string())?;
    tx.execute("UPDATE delegation_runs SET phase='complete',milestone='Operator reviewed each criterion against recorded evidence' WHERE id=?1",[&run.id]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    drop(connection);
    let updated = delegation::load_run(db.inner(), &run.id)?;
    app.emit("delegation-run-updated", &updated).ok();
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn completion_requires_exact_criteria_and_real_or_explicit_manual_evidence() {
        let criteria = vec!["Works".into()];
        assert!(validate_review(&criteria, &[], &[], "hash").is_err());
        let mut evidence = vec![CriterionEvidence {
            criterion: "Works".into(),
            note: "Observed the expected output in the preserved artifact.".into(),
            check_id: Some("invented".into()),
        }];
        assert!(validate_review(&criteria, &evidence, &[], "hash").is_err());
        evidence[0].check_id = None;
        assert!(validate_review(&criteria, &evidence, &[], "hash").is_ok());
        let check = CheckEvidence {
            id: "c".into(),
            check_name: "rust-tests".into(),
            exit_code: Some(1),
            output: "failure".into(),
            workspace_hash: "hash".into(),
            started_at: String::new(),
            finished_at: String::new(),
        };
        assert!(validate_review(&criteria, &evidence, &[check], "hash").is_err());
    }
    #[test]
    fn arbitrary_shell_text_is_not_a_check() {
        let root = std::env::temp_dir().join(format!("olympus-checks-{}", delegation::run_id()));
        std::fs::create_dir_all(root.join("src-tauri")).unwrap();
        std::fs::write(root.join("src-tauri/Cargo.toml"), "[package]").unwrap();
        assert!(command_for("npm test && del files", &root, &root).is_err());
        assert!(unavailable("npm test && del files", &root).is_err());
        assert!(command_for("rust-tests", &root, &root).is_ok());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn checks_apply_per_worktree_and_missing_dependencies_are_named() {
        let root = std::env::temp_dir().join(format!("olympus-checks-{}", delegation::run_id()));
        std::fs::create_dir_all(&root).unwrap();
        for (id, _) in CHECKS {
            assert!(unavailable(id, &root)
                .unwrap()
                .unwrap()
                .starts_with("Not applicable"));
        }
        std::fs::write(root.join("Cargo.toml"), "[package]").unwrap();
        assert_eq!(unavailable("rust-tests", &root).unwrap(), None);
        assert_eq!(rust_manifest(&root), Some("Cargo.toml"));
        std::fs::write(
            root.join("package.json"),
            r#"{"scripts":{"build":"vite build"}}"#,
        )
        .unwrap();
        assert!(unavailable("npm-test", &root)
            .unwrap()
            .unwrap()
            .starts_with("Not applicable"));
        assert!(unavailable("frontend-build", &root)
            .unwrap()
            .unwrap()
            .starts_with("Dependencies not installed"));
        std::fs::create_dir_all(root.join("node_modules")).unwrap();
        assert_eq!(unavailable("frontend-build", &root).unwrap(), None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_environment_is_an_allowlist_without_keys() {
        assert!(!CHECK_ENVIRONMENT
            .iter()
            .any(|key| ["KEY", "TOKEN", "SECRET"]
                .iter()
                .any(|s| key.to_uppercase().contains(s))));
        let mut command = Command::new("cargo");
        check_environment(&mut command, |key| {
            Some(OsString::from(format!("value of {key}")))
        });
        let keys: Vec<_> = command
            .get_envs()
            .map(|(key, _)| key.to_string_lossy().into_owned())
            .collect();
        assert_eq!(keys.len(), CHECK_ENVIRONMENT.len());
        assert!(!keys.iter().any(|key| key.contains("API_KEY")));
    }

    #[test]
    fn an_interrupted_check_is_recorded_as_failed_and_blocks_completion() {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection
            .execute_batch(include_str!("../../schema.sql"))
            .unwrap();
        connection.execute("INSERT INTO delegation_checks(id,run_id,check_name,exit_code,output,workspace_hash,started_at,finished_at) VALUES ('c','run','rust-tests',NULL,'','','2026-09-28T00:00:00Z','')",[]).unwrap();
        assert_eq!(interrupt_checks(&connection, "run").unwrap(), 1);
        assert_eq!(interrupt_checks(&connection, "run").unwrap(), 0);
        let db = Db(std::sync::Mutex::new(connection));
        let recorded = checks(&db, "run").unwrap();
        assert!(recorded[0].output.contains("Interrupted"));
        assert!(!recorded[0].finished_at.is_empty());
        let evidence = vec![CriterionEvidence {
            criterion: "Works".into(),
            note: "Observed the expected output in the preserved artifact.".into(),
            check_id: None,
        }];
        assert!(validate_review(&["Works".into()], &evidence, &recorded, "").is_err());
    }
}
