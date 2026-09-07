//! Backend-owned, one-use review proposals. Markdown never grants authority.
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::Mutex};

pub const PROPOSAL_SECONDS: i64 = 600;

pub fn digest(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Subject {
    pub project_id: String,
    pub project_name: String,
    pub repository: String,
    pub base_commit: String,
    pub driver: String,
    pub model: String,
    pub stage: String,
    pub task: String,
    pub criteria: Vec<String>,
    pub scope: String,
    pub run_id: String,
    pub workspace: String,
    pub workspace_hash: String,
    pub plan: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Proposal {
    pub id: String,
    pub session_id: String,
    pub expires_at: i64,
    pub subject: Subject,
}

pub struct ApprovalState {
    pub session_id: String,
    pub pending: Mutex<HashMap<String, Proposal>>,
    // Serialize preparation/launch/cancellation transitions, not an entire agent run.
    pub execution: Mutex<()>,
}

impl ApprovalState {
    pub fn new(session_id: String) -> Self {
        Self {
            session_id,
            pending: Mutex::new(HashMap::new()),
            execution: Mutex::new(()),
        }
    }

    pub fn prepare(&self, id: String, subject: Subject) -> Result<Proposal, String> {
        let now = chrono::Utc::now().timestamp();
        let proposal = Proposal {
            id: id.clone(),
            session_id: self.session_id.clone(),
            expires_at: now + PROPOSAL_SECONDS,
            subject,
        };
        let mut pending = self.pending.lock().map_err(|e| e.to_string())?;
        pending.retain(|_, p| {
            p.expires_at > now && p.subject.project_id != proposal.subject.project_id
        });
        if pending.len() >= 32 {
            return Err("Too many pending reviews. Close an earlier review first.".into());
        }
        pending.insert(id, proposal.clone());
        Ok(proposal)
    }

    pub fn get(&self, id: &str) -> Result<Proposal, String> {
        self.pending.lock().map_err(|e| e.to_string())?.get(id).cloned()
            .ok_or_else(|| "This review is missing, cancelled, or belongs to an earlier desktop session. Prepare a new review.".into())
    }

    pub fn consume(
        &self,
        connection: &mut Connection,
        id: &str,
        actual: &Subject,
    ) -> Result<String, String> {
        // Remove before validation. Failed or replayed requests require fresh review.
        let proposal = self
            .pending
            .lock()
            .map_err(|e| e.to_string())?
            .remove(id)
            .ok_or_else(|| "No pending operator review exists for this request.".to_string())?;
        record_approval(
            connection,
            &proposal,
            &self.session_id,
            actual,
            chrono::Utc::now().timestamp(),
        )?;
        Ok(proposal.id)
    }

    pub fn revoke_run(&self, connection: &Connection, run_id: &str) -> Result<(), String> {
        self.pending
            .lock()
            .map_err(|e| e.to_string())?
            .retain(|_, p| p.subject.run_id != run_id);
        connection.execute("INSERT INTO approval_revocations (approval_id, session_id, reason) SELECT id, ?2, 'Run cancelled' FROM operator_approvals WHERE run_id = ?1 AND id NOT IN (SELECT approval_id FROM approval_revocations)", params![run_id, self.session_id]).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn record_approval(
    connection: &mut Connection,
    proposal: &Proposal,
    session: &str,
    actual: &Subject,
    now: i64,
) -> Result<(), String> {
    if proposal.session_id != session || proposal.expires_at <= now || proposal.subject != *actual {
        return Err("The task, plan, scope, workspace, or desktop session changed, or the review expired. Prepare a fresh review.".into());
    }
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let exists: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM operator_sessions WHERE id = ?1)",
            [session],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("The backend desktop session is not recorded.".into());
    }
    transaction.execute("INSERT INTO operator_approvals (id, session_id, run_id, stage, task_text, task_hash, subject_json, subject_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![proposal.id, session, actual.run_id, actual.stage, actual.task, digest(&actual.task), serde_json::to_string(actual).map_err(|e| e.to_string())?, digest(&serde_json::to_string(actual).map_err(|e| e.to_string())?)])
        .map_err(|e| format!("Approval could not be recorded; it may already have been consumed: {e}"))?;
    transaction
        .execute(
            "INSERT INTO approval_consumptions (approval_id, run_id, stage) VALUES (?1, ?2, ?3)",
            params![proposal.id, actual.run_id, actual.stage],
        )
        .map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_delegation_proposal(
    state: tauri::State<ApprovalState>,
    proposal_id: String,
) -> Result<(), String> {
    state
        .pending
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&proposal_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn subject() -> Subject {
        Subject {
            project_id: "olympus".into(),
            project_name: "Olympus".into(),
            repository: "C:/repo".into(),
            base_commit: "abc".into(),
            driver: "Claude fixed".into(),
            model: "sonnet".into(),
            stage: "plan".into(),
            task: "Exact  task\ntext".into(),
            criteria: vec!["Test passes".into()],
            scope: "plan-v1".into(),
            run_id: "run".into(),
            workspace: "C:/worktree".into(),
            workspace_hash: "clean".into(),
            plan: String::new(),
        }
    }
    fn db() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        db.execute("INSERT INTO operator_sessions(id) VALUES ('session')", [])
            .unwrap();
        db
    }
    #[test]
    fn exact_subject_session_expiry_and_replay_are_enforced() {
        let mut db = db();
        let original = subject();
        let p = Proposal {
            id: "approval".into(),
            session_id: "session".into(),
            expires_at: 100,
            subject: original.clone(),
        };
        assert!(record_approval(&mut db, &p, "other", &original, 50).is_err());
        assert!(record_approval(&mut db, &p, "session", &original, 100).is_err());
        for field in [
            "task",
            "projectId",
            "repository",
            "baseCommit",
            "driver",
            "model",
            "stage",
            "scope",
            "workspace",
            "workspaceHash",
            "plan",
            "runId",
        ] {
            let mut json = serde_json::to_value(&original).unwrap();
            json[field] = serde_json::json!("changed");
            let changed = serde_json::from_value(json).unwrap();
            assert!(
                record_approval(&mut db, &p, "session", &changed, 50).is_err(),
                "{field}"
            );
        }
        record_approval(&mut db, &p, "session", &original, 50).unwrap();
        assert!(record_approval(&mut db, &p, "session", &original, 50).is_err());
        let stored: String = db
            .query_row("SELECT task_text FROM operator_approvals", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored, original.task);
        assert_ne!(digest("a  b"), digest("a b"));
    }
    #[test]
    fn missing_cancelled_and_previous_session_proposals_cannot_be_consumed() {
        let state = ApprovalState::new("session".into());
        let mut db = db();
        assert!(state
            .consume(&mut db, "fabricated-markdown-approval", &subject())
            .is_err());
        state.prepare("p".into(), subject()).unwrap();
        state.revoke_run(&db, "run").unwrap();
        assert!(state.consume(&mut db, "p", &subject()).is_err());
        let restarted = ApprovalState::new("new-session".into());
        assert!(restarted.get("p").is_err());
    }
    #[test]
    fn immutable_approval_and_consumption_records_reject_edits() {
        let mut db = db();
        let s = subject();
        let p = Proposal {
            id: "p".into(),
            session_id: "session".into(),
            expires_at: 100,
            subject: s.clone(),
        };
        record_approval(&mut db, &p, "session", &s, 0).unwrap();
        assert!(db
            .execute("UPDATE operator_approvals SET task_text = 'forged'", [])
            .is_err());
        assert!(db.execute("DELETE FROM approval_consumptions", []).is_err());
    }
}
