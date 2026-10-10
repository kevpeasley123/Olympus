use super::organizer_store::*;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultRecord {
    pub id: String,
    pub run_id: String,
    pub task_id: String,
    pub summary: String,
    pub workspace_hash: String,
    pub manifest: serde_json::Value,
    pub review_state: String,
    pub created_at: String,
    pub accepted_at: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub sequence: i64,
    pub kind: String,
    pub payload: serde_json::Value,
    pub created_at: String,
    pub acknowledged: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    pub task: Task,
    pub results: Vec<ResultRecord>,
    pub events: Vec<Event>,
    pub run_ids: Vec<String>,
    pub display_status: String,
}
pub fn reconcile(c: &mut Connection) -> OResult<()> {
    let tx = c.transaction()?;
    let rows = {
        let mut q=tx.prepare("SELECT l.task_id,r.id,r.phase,COALESCE(r.outcome,''),r.workspace,r.base_commit,r.changed_files_json,l.contract_snapshot_json,COALESCE(v.workspace_hash,''),r.updated_at,l.task_revision FROM organizer_run_links l JOIN delegation_runs r ON r.id=l.run_id LEFT JOIN delegation_reviews v ON v.run_id=r.id")?;
        let items = q
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                    r.get::<_, String>(8)?,
                    r.get::<_, String>(9)?,
                    r.get::<_, i64>(10)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        items
    };
    for (task, run, phase, outcome, workspace, base, files, snapshot, hash, updated, revision) in
        rows
    {
        let kind = match phase.as_str() {
            "awaiting_review" | "complete" => "result_ready",
            "waiting" => "needs_you",
            "failed" => "failed",
            _ => "progress",
        };
        let event_key = if kind == "result_ready" {
            format!("ready:{run}")
        } else {
            format!("phase:{run}:{kind}:{updated}")
        };
        event(
            &tx,
            &task,
            kind,
            &json(&serde_json::json!({"runId":run,"phase":phase}))?,
            Some(&event_key),
        )?;
        if ["awaiting_review", "complete"].contains(&phase.as_str()) {
            let current = get(&tx, &task)?;
            let manifest = json(
                &serde_json::json!({"workspace":workspace,"baseCommit":base,"changedFiles":serde_json::from_str::<serde_json::Value>(&files).unwrap_or_default(),"taskSnapshot":serde_json::from_str::<serde_json::Value>(&snapshot).unwrap_or_default()}),
            )?;
            tx.execute("INSERT INTO organizer_results(id,run_id,task_id,summary,workspace_hash,manifest_json,review_state,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(run_id) DO UPDATE SET workspace_hash=excluded.workspace_hash WHERE organizer_results.review_state='pending'",params![new_id(),run,task,outcome,hash,manifest,if revision==current.revision{"pending"}else{"superseded"},now()])?;
        }
    }
    tx.commit()?;
    Ok(())
}
pub fn detail(c: &Connection, id: &str) -> OResult<Detail> {
    let task = get(c, id)?;
    let results = {
        let mut q=c.prepare("SELECT id,run_id,task_id,summary,workspace_hash,manifest_json,review_state,created_at,accepted_at FROM organizer_results WHERE task_id=?1 ORDER BY rowid DESC")?;
        let rows = q
            .query_map([id], |r| {
                Ok(ResultRecord {
                    id: r.get(0)?,
                    run_id: r.get(1)?,
                    task_id: r.get(2)?,
                    summary: r.get(3)?,
                    workspace_hash: r.get(4)?,
                    manifest: serde_json::from_str(&r.get::<_, String>(5)?).unwrap_or_default(),
                    review_state: r.get(6)?,
                    created_at: r.get(7)?,
                    accepted_at: r.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let events = {
        let mut q=c.prepare("SELECT sequence,kind,payload_json,created_at,acknowledgement_at IS NOT NULL FROM organizer_events WHERE task_id=?1 ORDER BY sequence DESC LIMIT 100")?;
        let rows = q
            .query_map([id], |r| {
                Ok(Event {
                    sequence: r.get(0)?,
                    kind: r.get(1)?,
                    payload: serde_json::from_str(&r.get::<_, String>(2)?).unwrap_or_default(),
                    created_at: r.get(3)?,
                    acknowledged: r.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let runs = {
        let mut q=c.prepare("SELECT r.id,r.phase,l.task_revision FROM organizer_run_links l JOIN delegation_runs r ON r.id=l.run_id WHERE l.task_id=?1 ORDER BY l.rowid DESC")?;
        let rows = q
            .query_map([id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let phase = runs
        .first()
        .filter(|r| r.2 == task.revision)
        .map(|r| r.1.as_str());
    let display_status = match task.state.as_str() {
        "completed" => "Completed",
        "cancelled" => "Cancelled",
        _ => {
            if task.intent == "proposed" {
                "Proposed"
            } else {
                match phase {
                    Some("waiting") => "Needs you",
                    Some("awaiting_review" | "complete") => "Result ready",
                    Some("failed") => "Failed",
                    Some(
                        "preparing" | "planning" | "editing" | "testing" | "reviewing" | "approved",
                    ) => "In progress",
                    _ => "Planned",
                }
            }
        }
    }
    .into();
    Ok(Detail {
        task,
        results,
        events,
        run_ids: runs.into_iter().map(|r| r.0).collect(),
        display_status,
    })
}
pub fn accept(
    c: &mut Connection,
    id: &str,
    revision: i64,
    result_id: &str,
    current_hash: &str,
) -> OResult<Task> {
    let tx = c.transaction()?;
    let result = detail(&tx, id)?
        .results
        .into_iter()
        .find(|r| r.id == result_id)
        .ok_or_else(|| error("not_found", "Result not found for this task."))?;
    let current = get(&tx, id)?;
    if result.review_state == "accepted" && current.state == "completed" {
        return Ok(current);
    }
    let t = check_revision(&tx, id, revision)?;
    check_editable(&tx, &t)?;
    if t.state != "open"
        || result.review_state != "pending"
        || current_hash.is_empty()
        || result.workspace_hash != current_hash
    {
        return Err(error(
            "conflict",
            "Result evidence changed or is not reviewed. Review the current workspace first.",
        ));
    }
    let valid:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM delegation_runs r JOIN delegation_reviews v ON r.id=v.run_id JOIN organizer_run_links l ON l.run_id=r.id WHERE r.id=?1 AND r.phase='complete' AND v.workspace_hash=?2 AND l.task_id=?3 AND l.task_revision=?4)",params![result.run_id,current_hash,id,revision],|r|r.get(0))?;
    if !valid {
        return Err(error(
            "validation",
            "Complete the existing criterion review before accepting this result.",
        ));
    }
    tx.execute(
        "UPDATE organizer_results SET review_state='accepted',accepted_at=?2 WHERE id=?1",
        params![result_id, now()],
    )?;
    tx.execute("UPDATE organizer_tasks SET state='completed',revision=revision+1,updated_at=?2 WHERE id=?1",params![id,now()])?;
    event(
        &tx,
        id,
        "completed",
        &json(&serde_json::json!({"resultId":result_id}))?,
        Some(&format!("accept:{result_id}")),
    )?;
    tx.commit()?;
    get(c, id)
}
pub fn finish(
    c: &mut Connection,
    id: &str,
    revision: i64,
    action: &str,
    reason: &str,
) -> OResult<Task> {
    if !["complete_manual", "cancel"].contains(&action)
        || !(20..=2000).contains(&reason.trim().chars().count())
    {
        return Err(error(
            "validation",
            "Choose complete_manual or cancel and provide a 20–2,000-character reason.",
        ));
    }
    let tx = c.transaction()?;
    let t = check_revision(&tx, id, revision)?;
    check_editable(&tx, &t)?;
    tx.execute(
        "UPDATE organizer_tasks SET state=?2,revision=revision+1,updated_at=?3 WHERE id=?1",
        params![
            id,
            if action == "cancel" {
                "cancelled"
            } else {
                "completed"
            },
            now()
        ],
    )?;
    event(
        &tx,
        id,
        if action == "cancel" {
            "cancelled"
        } else {
            "completed_manual"
        },
        &json(&serde_json::json!({"reason":reason,"verification":"operator statement"}))?,
        None,
    )?;
    tx.commit()?;
    get(c, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c.execute("INSERT INTO projects(id,name,status,signal,description,payload_json) VALUES('p','P','active','','','{}')",[]).unwrap();
        c
    }
    fn input() -> TaskInput {
        TaskInput {
            project_id: "p".into(),
            title: "Task".into(),
            objective: "Deliver a result".into(),
            criteria: vec!["Works".into()],
            steps: vec![],
            sources: vec![],
            priority: "normal".into(),
            priority_reason: "".into(),
            due_date: None,
            intent: "committed".into(),
        }
    }
    fn run(c: &Connection, t: &Task) {
        c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone,outcome) VALUES('run','p','P','Task','test','test','awaiting_review','C:/fixture','test','base','session','Ready','Result summary')",[]).unwrap();
        bind_proposal(c, "proposal", "run", t).unwrap();
        link_started_run(c, "proposal", "run").unwrap();
    }
    #[test]
    fn organizer_result_reconciliation_is_idempotent_and_requires_acceptance() {
        let mut c = db();
        let t = create(&mut c, input()).unwrap();
        run(&c, &t);
        reconcile(&mut c).unwrap();
        reconcile(&mut c).unwrap();
        let d = detail(&c, &t.id).unwrap();
        assert_eq!(d.results.len(), 1);
        assert_eq!(d.display_status, "Result ready");
        assert_eq!(d.task.state, "open");
        assert_eq!(
            d.events.iter().filter(|e| e.kind == "result_ready").count(),
            1
        );
        assert!(accept(&mut c, &t.id, 1, &d.results[0].id, "hash").is_err());
    }
    #[test]
    fn organizer_accept_rejects_stale_hash_and_repeat_is_safe() {
        let mut c = db();
        let t = create(&mut c, input()).unwrap();
        run(&c, &t);
        c.execute("INSERT INTO operator_sessions(id) VALUES('s')", [])
            .unwrap();
        c.execute("INSERT INTO delegation_reviews(run_id,session_id,criteria_evidence_json,workspace_hash) VALUES('run','s','[]','hash')",[]).unwrap();
        c.execute(
            "UPDATE delegation_runs SET phase='complete' WHERE id='run'",
            [],
        )
        .unwrap();
        reconcile(&mut c).unwrap();
        let d = detail(&c, &t.id).unwrap();
        let result = d.results.first().expect("result");
        assert!(accept(&mut c, &t.id, 1, &result.id, "changed").is_err());
        let done = accept(&mut c, &t.id, 1, &result.id, "hash").unwrap();
        assert_eq!(done.state, "completed");
        assert_eq!(
            accept(&mut c, &t.id, 1, &result.id, "hash").unwrap().id,
            t.id
        );
        assert_eq!(
            detail(&c, &t.id)
                .unwrap()
                .events
                .iter()
                .filter(|e| e.kind == "completed")
                .count(),
            1
        );
    }
    #[test]
    fn organizer_failure_and_manual_completion_are_distinct() {
        let mut c = db();
        let t = create(&mut c, input()).unwrap();
        run(&c, &t);
        assert!(finish(
            &mut c,
            &t.id,
            1,
            "complete_manual",
            "Verified by the operator manually"
        )
        .is_err());
        c.execute(
            "UPDATE delegation_runs SET phase='failed' WHERE id='run'",
            [],
        )
        .unwrap();
        reconcile(&mut c).unwrap();
        assert_eq!(detail(&c, &t.id).unwrap().display_status, "Failed");
        assert!(finish(&mut c, &t.id, 1, "complete_manual", "short").is_err());
        assert_eq!(
            finish(
                &mut c,
                &t.id,
                1,
                "complete_manual",
                "Verified by the operator manually"
            )
            .unwrap()
            .state,
            "completed"
        );
        assert!(detail(&c, &t.id)
            .unwrap()
            .events
            .iter()
            .any(|e| e.kind == "completed_manual"));
    }
    #[test]
    fn organizer_backup_restore_retains_review_boundary_and_links() {
        let mut c = db();
        let mut request = input();
        request.sources.push(Source {
            kind: "url".into(),
            reference: "https://x.com/leerob/status/2108650243365736855/video/1".into(),
            captured_text: Some("Research reference, not approval".into()),
            sha256: None,
            line: None,
        });
        let t = create(&mut c, request).unwrap();
        run(&c, &t);
        c.execute("INSERT INTO operator_sessions(id) VALUES('s')", [])
            .unwrap();
        c.execute("INSERT INTO delegation_reviews(run_id,session_id,criteria_evidence_json,workspace_hash) VALUES('run','s','[]','hash')",[]).unwrap();
        c.execute(
            "UPDATE delegation_runs SET phase='complete' WHERE id='run'",
            [],
        )
        .unwrap();
        reconcile(&mut c).unwrap();
        let path = std::env::temp_dir().join(format!("organizer-backup-{}.sqlite", new_id()));
        c.execute("VACUUM INTO ?1", [path.to_string_lossy().as_ref()])
            .unwrap();
        drop(c);
        let mut restored = Connection::open(&path).unwrap();
        reconcile(&mut restored).unwrap();
        let d = detail(&restored, &t.id).unwrap();
        assert_eq!(d.task.state, "open");
        assert_eq!(d.results.len(), 1);
        assert_eq!(d.run_ids, vec!["run"]);
        assert!(d.task.sources[0].reference.contains("2108650243365736855"));
        accept(&mut restored, &t.id, 1, &d.results[0].id, "hash").unwrap();
        drop(restored);
        let mut reopened = Connection::open(&path).unwrap();
        reconcile(&mut reopened).unwrap();
        assert_eq!(
            detail(&reopened, &t.id).unwrap().results[0].review_state,
            "accepted"
        );
        assert_eq!(
            reopened
                .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r
                    .get::<_, i64>(
                    0
                ))
                .unwrap(),
            0
        );
        drop(reopened);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn organizer_historical_result_keeps_its_review_target() {
        let mut c = db();
        let t = create(&mut c, input()).unwrap();
        run(&c, &t);
        c.execute(
            "UPDATE delegation_runs SET phase='complete',started_at='2000-01-01' WHERE id='run'",
            [],
        )
        .unwrap();
        for n in 0..25 {
            c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone,started_at) VALUES(?1,'p','P','Other','test','test','complete','fixture','b','base','','Done','2026-01-01')",[format!("other-{n}")]).unwrap();
        }
        assert!(super::super::delegation::stored_runs(&c)
            .unwrap()
            .iter()
            .any(|r| r.id == "run"));
    }

    #[test]
    fn organizer_accept_cannot_close_a_newer_active_attempt() {
        let mut c = db();
        let t = create(&mut c, input()).unwrap();
        run(&c, &t);
        c.execute("INSERT INTO operator_sessions(id) VALUES('s')", [])
            .unwrap();
        c.execute("INSERT INTO delegation_reviews(run_id,session_id,criteria_evidence_json,workspace_hash) VALUES('run','s','[]','hash')",[]).unwrap();
        c.execute(
            "UPDATE delegation_runs SET phase='complete' WHERE id='run'",
            [],
        )
        .unwrap();
        reconcile(&mut c).unwrap();
        let result = detail(&c, &t.id).unwrap().results[0].id.clone();
        c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone) VALUES('new','p','P','Task','test','test','waiting','fixture','b','base','','Waiting')",[]).unwrap();
        bind_proposal(&c, "new-proposal", "new", &t).unwrap();
        link_started_run(&c, "new-proposal", "new").unwrap();
        assert!(accept(&mut c, &t.id, 1, &result, "hash").is_err());
        assert_eq!(get(&c, &t.id).unwrap().state, "open");
    }
}
