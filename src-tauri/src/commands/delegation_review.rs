//! Verification evidence and explicit operator review; agent output is not completion.
use super::{
    approvals::ApprovalState,
    delegation::{self, DelegationProcesses, DelegationRun, RunRequest},
    persistence::Db,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::{
    io::Read,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager, State};

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
pub fn fetch_delegation_review(
    db: State<Db>,
    request: RunRequest,
) -> Result<ReviewDetails, String> {
    let (criteria, plan) = delegation::contract(db.inner(), &request.run_id)?;
    let evidence = checks(db.inner(), &request.run_id)?;
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    let mut query=connection.prepare("SELECT stage || ' · ' || approved_at || ' · record ' || id FROM operator_approvals WHERE run_id=?1 ORDER BY rowid").map_err(|e|e.to_string())?;
    let approvals = query
        .query_map([&request.run_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(ReviewDetails {
        criteria,
        plan,
        checks: evidence,
        approvals,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRequest {
    pub run_id: String,
    pub check_id: String,
}

fn command_for(id: &str) -> Result<Command, String> {
    match id {
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
            Ok(c)
        }
        "rust-tests" => {
            let mut c = Command::new("cargo");
            c.args(["test", "--lib", "--manifest-path", "src-tauri/Cargo.toml"]);
            Ok(c)
        }
        _ => Err("Select a registered verification check.".into()),
    }
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
    let before =
        delegation::workspace_hash(std::path::Path::new(&run.workspace), &run.base_commit)?;
    let mut command = command_for(&request.check_id)?;
    command
        .current_dir(&run.workspace)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let started_at = chrono::Utc::now().to_rfc3339();
    let mut child = command.spawn().map_err(|e| e.to_string())?;
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
    db.0.lock().map_err(|e|e.to_string())?.execute("UPDATE delegation_runs SET phase='testing',process_id=?2,milestone='Running an Olympus verification check' WHERE id=?1",params![run.id,child.id()]).map_err(|e|e.to_string())?;
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
    let after = delegation::workspace_hash(std::path::Path::new(&run.workspace), &run.base_commit);
    let fingerprint = match after {
        Ok(hash) if hash == before => hash,
        _ => {
            output.push_str("\n[Workspace changed during verification; this check cannot establish the current result]");
            String::new()
        }
    };
    let evidence = CheckEvidence {
        id: delegation::run_id(),
        check_name: request.check_id,
        exit_code,
        output,
        workspace_hash: fingerprint,
        started_at,
        finished_at: chrono::Utc::now().to_rfc3339(),
    };
    let mut connection = db.0.lock().map_err(|e| e.to_string())?;
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO delegation_checks(id,run_id,check_name,exit_code,output,workspace_hash,started_at,finished_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",params![evidence.id,run.id,evidence.check_name,evidence.exit_code,evidence.output,evidence.workspace_hash,evidence.started_at,evidence.finished_at]).map_err(|e|e.to_string())?;
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
pub fn delegation_review_fingerprint(db: State<Db>, request: RunRequest) -> Result<String, String> {
    let run = delegation::load_run(db.inner(), &request.run_id)?;
    delegation::workspace_hash(std::path::Path::new(&run.workspace), &run.base_commit)
}

#[tauri::command]
pub fn complete_delegation_review(
    app: tauri::AppHandle,
    db: State<Db>,
    request: CompleteRequest,
) -> Result<DelegationRun, String> {
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
        assert!(command_for("npm test && del files").is_err());
        assert!(command_for("rust-tests").is_ok());
    }
}
