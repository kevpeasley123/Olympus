//! Manual fixed graph over bounded local cache. No model or Gmail network capabilities.
use super::{communication_skills as skill, store};
use crate::commands::{persistence::Db, vault_write::content_fingerprint, workflow::GraphNode};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::BTreeSet, fs, io::Read, path::Path};
use tauri::{Manager, State};
const GRAPH: &str = "communication-intelligence/v2";
const DAY: i64 = 86_400_000;
fn now() -> String {
    Utc::now().to_rfc3339()
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub fn definition() -> Vec<GraphNode> {
    [
        ("snapshot", "cache_read", vec![]),
        ("select", "candidate_selection", vec!["snapshot"]),
        ("assess", "communication-assess@1", vec!["select"]),
        ("project", "project-relevance@2", vec!["select"]),
        (
            "synthesize",
            "validated_join_and_policy",
            vec!["assess", "project"],
        ),
    ]
    .into_iter()
    .map(|(id, kind, deps)| GraphNode {
        id: id.into(),
        kind: kind.into(),
        depends_on: deps.into_iter().map(str::to_string).collect(),
        max_iterations: 1,
    })
    .collect()
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub id: String,
    pub days: u32,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub thread_id: String,
    pub subject: String,
    pub sender: String,
    pub triage: skill::Triage,
    pub summary: skill::Summary,
    pub project: skill::Relevance,
    pub recommendation: skill::Recommendation,
}
fn event(c: &Connection, id: &str, node: &str, state: &str, result: Value) -> Result<(), String> {
    c.execute(
        "INSERT INTO communication_events(run_id,node,state,at,result_json) VALUES(?1,?2,?3,?4,?5)",
        params![id, node, state, now(), result.to_string()],
    )
    .map_err(err)?;
    Ok(())
}
fn step<T: Serialize>(
    c: &Connection,
    id: &str,
    node: &str,
    done: &mut BTreeSet<String>,
    f: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let def = definition()
        .into_iter()
        .find(|n| n.id == node)
        .ok_or("unknown_graph_node")?;
    if def.depends_on.iter().any(|d| !done.contains(d)) {
        return Err("graph_dependency_not_completed".into());
    }
    event(
        c,
        id,
        node,
        "running",
        json!({"skill":def.kind,"model":null,"usage":null,"attempt":1}),
    )?;
    match f() {
        Ok(result) => {
            event(
                c,
                id,
                node,
                "completed",
                serde_json::to_value(&result).map_err(err)?,
            )?;
            done.insert(node.into());
            Ok(result)
        }
        Err(e) => {
            event(
                c,
                id,
                node,
                "failed",
                json!({"error":e,"stopReason":"failed_closed"}),
            )?;
            Err(e)
        }
    }
}
fn signature(c: &Connection, account: &str) -> Result<String, String> {
    let mut stmt=c.prepare("SELECT id||':'||fingerprint||':'||available||':'||in_scope FROM gmail_messages WHERE account_id=?1 ORDER BY id LIMIT 2001").map_err(err)?;
    let values = stmt
        .query_map([account], |r| r.get::<_, String>(0))
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    // Includes cache removals and scope changes. More than the sync cap fails closed.
    if values.len() > 2000 {
        return Err("intelligence_cache_budget_exceeded".into());
    }
    Ok(content_fingerprint(&values.join("\n")))
}
fn projects(root: &Path) -> Result<Vec<skill::Project>, String> {
    let folder = root.join("01 - Projects");
    let canonical = folder
        .canonicalize()
        .map_err(|_| "project_context_unavailable")?;
    let mut files = fs::read_dir(&folder)
        .map_err(|_| "project_context_unavailable")?
        .map(|e| e.map(|e| e.path()).map_err(err))
        .collect::<Result<Vec<_>, _>>()?;
    files.retain(|p| p.extension().is_some_and(|e| e == "md"));
    files.sort();
    if files.len() > 24 {
        return Err("project_index_budget_exceeded".into());
    }
    let mut output = Vec::new();
    for path in files {
        if !path.canonicalize().map_err(err)?.starts_with(&canonical) {
            return Err("project_context_outside_root".into());
        }
        let mut raw = String::new();
        fs::File::open(&path)
            .map_err(err)?
            .take(16385)
            .read_to_string(&mut raw)
            .map_err(err)?;
        if raw.len() > 16384 {
            return Err("project_note_budget_exceeded".into());
        }
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("project_name_invalid")?;
        let source = format!(
            "01 - Projects/{}",
            path.file_name().unwrap().to_string_lossy()
        );
        if let Some((note, keys)) =
            crate::commands::project_notes::parse_project_note(&raw, stem, &source)
        {
            if keys.len()>12 {return Err("project_alias_budget_exceeded".into())}
            output.push(skill::Project {
                name: stem.into(),
                aliases: keys,
                description: note.vision.unwrap_or_default().chars().take(2000).collect(),
                source,
                fingerprint: content_fingerprint(&raw),
            })
        }
    }
    Ok(output)
}
fn project_signature(context: &[skill::Project]) -> String {
    content_fingerprint(
        &context
            .iter()
            .map(|p| format!("{}:{}", p.source, p.fingerprint))
            .collect::<Vec<_>>()
            .join("\n"),
    )
}
fn selected(
    c: &Connection,
    account: &str,
    days: u32,
    time: i64,
) -> Result<Vec<skill::ThreadInput>, String> {
    let cutoff = time - i64::from(days) * DAY;
    let mut q=c.prepare("SELECT m.thread_id FROM gmail_messages m WHERE m.account_id=?1 AND m.available=1 AND m.in_scope=1 AND m.internal_date BETWEEN ?2 AND ?3 AND EXISTS (SELECT 1 FROM gmail_candidates g WHERE g.account_id=m.account_id AND g.message_id=m.id AND g.source_fingerprint=m.fingerprint) GROUP BY m.thread_id ORDER BY max(m.internal_date) DESC,m.thread_id LIMIT 12").map_err(err)?;
    let ids = q
        .query_map(params![account, cutoff, time], |r| r.get::<_, String>(0))
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    ids.into_iter().map(|id|{
  let mails=store::thread_messages(c,account,&id,4)?;
  let mut messages=Vec::new();
  for m in mails.into_iter().filter(|m|m.internal_date>=cutoff&&m.internal_date<=time){
   let mut stmt=c.prepare("SELECT kind FROM gmail_candidates WHERE account_id=?1 AND message_id=?2 AND source_fingerprint=?3 ORDER BY kind").map_err(err)?;
   let candidates=stmt.query_map(params![account,m.id,m.fingerprint],|r|r.get::<_,String>(0)).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
   messages.push(skill::Message{evidence:skill::Evidence{message_id:m.id,thread_id:m.thread_id,fingerprint:m.fingerprint,timestamp:m.internal_date},sender:m.sender.chars().take(300).collect(),subject:m.subject.chars().take(300).collect(),text:m.clean_text.chars().take(2000).collect(),sent:m.labels.iter().any(|s|s=="SENT"),body_available:!m.clean_text.trim().is_empty(),candidates});
  }
  let input=skill::ThreadInput{messages};input.validate()?;Ok(input)
 }).collect()
}
fn synthesize(
    inputs: &[skill::ThreadInput],
    assessments: &[skill::Assessment],
    relevance: &[skill::Relevance],
) -> Result<Vec<Item>, String> {
    if inputs.len() != assessments.len() || inputs.len() != relevance.len() {
        return Err("join_missing_branch_output".into());
    }
    let mut items = Vec::new();
    for ((input, assessment), project) in inputs.iter().zip(assessments).zip(relevance) {
        input.validate()?;
        let refs = input.refs();
        let expected = skill::artifact(input)?
            .parts
            .into_iter()
            .map(|p| p.source)
            .collect::<Vec<_>>();
        if serde_json::to_value(&refs).map_err(err)?
            != serde_json::to_value(&assessment.triage.evidence_refs).map_err(err)?
            || serde_json::to_value(&refs).map_err(err)?
                != serde_json::to_value(&assessment.summary.evidence_refs).map_err(err)?
            || expected != project.evidence_refs
        {
            return Err("join_source_identity_mismatch".into());
        }
        let recommendation = skill::recommend(&assessment.triage, project)?;
        let last = input.messages.last().unwrap();
        if recommendation.priority != "background" {
            items.push(Item {
                thread_id: last.evidence.thread_id.clone(),
                subject: last.subject.clone(),
                sender: last.sender.clone(),
                triage: assessment.triage.clone(),
                summary: assessment.summary.clone(),
                project: project.clone(),
                recommendation,
            })
        }
    }
    items.sort_by_key(|i| match i.recommendation.priority.as_str() {
        "attention_candidate" => 0,
        "review_candidate" => 1,
        _ => 2,
    });
    items.truncate(5);
    Ok(items)
}
pub fn analyze(c: &Connection, root: &Path, request: Request) -> Result<Value, String> {
    if request.id.is_empty()
        || request.id.len() > 80
        || !request
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
        || ![7, 30, 90, 180, 365].contains(&request.days)
    {
        return Err("invalid_intelligence_request".into());
    }
    let account = store::account(c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected")?;
    if let Some(existing) = c
        .query_row(
            "SELECT payload_json FROM communication_runs WHERE id=?1",
            [&request.id],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(err)?
    {
        let run: Value = serde_json::from_str(&existing).map_err(err)?;
        if run["accountId"] != account.id || run["requestedDays"] != request.days {
            return Err("intelligence_request_id_conflict".into());
        }
        return Ok(run);
    }
    let time = Utc::now().timestamp_millis();
    let days = request.days.min(account.horizon_days);
    let mut run = json!({"id":request.id,"accountId":account.id,"graph":GRAPH,"definition":definition(),"skills":skill::registry(),"requestedDays":request.days,"days":days,"status":"running","startedAt":now(),"finishedAt":null,"durationMs":null,"model":null,"usage":null,"items":[],"error":null,"stale":false});
    c.execute("INSERT INTO communication_runs(id,account_id,days,status,payload_json) VALUES(?1,?2,?3,'running',?4)",params![request.id,account.id,days,run.to_string()]).map_err(err)?;
    let mut done = BTreeSet::new();
    let outcome = (|| -> Result<Vec<Item>, String> {
        let snapshot = step(c, &request.id, "snapshot", &mut done, || {
            let sig = signature(c, &account.id)?;
            let counts = super::communications::workspace(c, days, "attention", "", 0, time)?;
            Ok(
                json!({"signature":sig,"cachedThreads":counts["threads"],"candidateMessages":counts["attention"],"scope":"available, in-scope cache only"}),
            )
        })?;
        run["snapshot"] = snapshot;
        let mut inputs = Vec::new();
        step(c, &request.id, "select", &mut done, || {
            inputs = selected(c, &account.id, days, time)?;
            Ok(
                json!({"selectedThreads":inputs.len(),"threadLimit":12,"messageLimitPerThread":4,"textLimitPerMessage":2000,"evidenceRefs":inputs.iter().flat_map(|i|i.refs()).collect::<Vec<_>>()}),
            )
        })?;
        let assessments = step(c, &request.id, "assess", &mut done, || {
            inputs
                .iter()
                .map(skill::assess)
                .collect::<Result<Vec<_>, _>>()
        })?;
        let mut project_stamp = None;
        let relevance = step(c, &request.id, "project", &mut done, || {
            if inputs.is_empty() {
                return Ok(Vec::new());
            }
            let catalog = projects(root)?;
            event(c,&request.id,"project","catalog_snapshot",json!({"sources":catalog.iter().map(|p|json!({"source":p.source,"fingerprint":p.fingerprint,"name":p.name,"aliases":p.aliases})).collect::<Vec<_>>(),"method":"bounded_name_alias_match","discoveryIterations":0}))?;
            project_stamp = Some(project_signature(&catalog));
            inputs
                .iter()
                .map(|i| {
                    crate::commands::project_relevance::match_projects(
                        &skill::artifact(i)?,
                        &catalog,
                    )
                })
                .collect::<Result<Vec<_>, String>>()
        })?;
        run["projectSignature"] = json!(project_stamp);
        step(c, &request.id, "synthesize", &mut done, || {
            // Check the project snapshot again before publishing; no discovery/retrieval loop.
            if let Some(stamp) = &project_stamp {
                if &project_signature(&projects(root)?) != stamp {
                    return Err("project_context_changed_during_run".into());
                }
            }
            synthesize(&inputs, &assessments, &relevance)
        })
    })();
    match outcome {
        Ok(items) => {
            run["items"] = serde_json::to_value(items).map_err(err)?;
            run["status"] = json!("completed")
        }
        Err(e) => {
            run["status"] = json!("failed");
            run["error"] = json!(e);
            for n in definition().into_iter().filter(|n| !done.contains(&n.id)) {
                let failed:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM communication_events WHERE run_id=?1 AND node=?2 AND state='failed')",params![request.id,n.id],|r|r.get(0)).map_err(err)?;
                if failed {
                    continue;
                }
                event(
                    c,
                    &request.id,
                    &n.id,
                    "stopped",
                    json!({"stopReason":"upstream_failure","retry":"manual_new_run"}),
                )?;
            }
        }
    }
    run["finishedAt"] = json!(now());
    run["durationMs"] = json!(Utc::now().timestamp_millis() - time);
    c.execute(
        "UPDATE communication_runs SET status=?2,payload_json=?3 WHERE id=?1",
        params![request.id, run["status"].as_str(), run.to_string()],
    )
    .map_err(err)?;
    Ok(run)
}
pub fn recover(c: &Connection) -> Result<(), String> {
    c.execute("UPDATE communication_runs SET status='interrupted',payload_json=json_set(payload_json,'$.status','interrupted','$.error','Application restarted. Retry with a new run; prior evidence is retained.','$.finishedAt',?1) WHERE status='running'",[now()]).map_err(err)?;
    Ok(())
}
#[tauri::command]
pub async fn analyze_communications(
    app: tauri::AppHandle,
    request: Request,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let c = db.0.lock().map_err(|_| "database_busy")?;
        analyze(&c, &crate::commands::get_vault_path(), request)
    })
    .await
    .map_err(err)?
}
#[tauri::command]
pub fn communication_skills() -> Value {
    skill::registry()
}
#[tauri::command]
pub fn communication_runs(db: State<'_, Db>, days: u32) -> Result<Vec<Value>, String> {
    let c = db.0.lock().map_err(|_| "database_busy")?;
    let a = store::account(&c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected")?;
    let mut stmt=c.prepare("SELECT payload_json FROM communication_runs WHERE account_id=?1 AND days=?2 ORDER BY rowid DESC LIMIT 10").map_err(err)?;
    let raw = stmt
        .query_map(params![a.id, days.min(a.horizon_days)], |r| {
            r.get::<_, String>(0)
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    let sig = signature(&c, &a.id)?;
    let project_stamp = projects(&crate::commands::get_vault_path())
        .ok()
        .map(|p| project_signature(&p));
    raw.into_iter()
        .map(|r| {
            let mut run: Value = serde_json::from_str(&r).map_err(err)?;
            let age = run["startedAt"]
                .as_str()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|d| Utc::now().timestamp_millis() - d.timestamp_millis())
                .unwrap_or(i64::MAX);
            run["stale"] = json!(
                run["graph"] != GRAPH
                    || run["snapshot"]["signature"] != sig
                    || age > 15 * 60 * 1000
                    || (run["projectSignature"].is_string()
                        && run["projectSignature"].as_str() != project_stamp.as_deref())
            );
            Ok(run)
        })
        .collect()
}
#[tauri::command]
pub fn communication_run_events(db: State<'_, Db>, id: String) -> Result<Vec<Value>, String> {
    let c = db.0.lock().map_err(|_| "database_busy")?;
    authorized(&c, &id)?;
    let mut q=c.prepare("SELECT node,state,at,result_json FROM communication_events WHERE run_id=?1 ORDER BY sequence LIMIT 200").map_err(err)?;
    let raw = q
        .query_map([id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    raw.into_iter().map(|(node,state,at,result)|Ok(json!({"node":node,"state":state,"at":at,"result":serde_json::from_str::<Value>(&result).map_err(err)?}))).collect()
}
fn authorized(c: &Connection, id: &str) -> Result<(), String> {
    let a = store::account(c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected")?;
    let yes: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM communication_runs WHERE id=?1 AND account_id=?2)",
            params![id, a.id],
            |r| r.get(0),
        )
        .map_err(err)?;
    if yes {
        Ok(())
    } else {
        Err("intelligence_run_unavailable".into())
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Feedback {
    Opened,
    FalseResponse,
    FalseDeadline,
    ProjectDismissed,
}
#[tauri::command]
pub fn communication_feedback(
    db: State<'_, Db>,
    id: String,
    thread_id: String,
    event: Feedback,
) -> Result<(), String> {
    let c = db.0.lock().map_err(|_| "database_busy")?;
    authorized(&c, &id)?;
    let raw: String = c
        .query_row(
            "SELECT payload_json FROM communication_runs WHERE id=?1",
            [&id],
            |r| r.get(0),
        )
        .map_err(err)?;
    let run: Value = serde_json::from_str(&raw).map_err(err)?;
    if !run["items"]
        .as_array()
        .is_some_and(|items| items.iter().any(|i| i["threadId"] == thread_id))
    {
        return Err("recommendation_not_in_run".into());
    }
    let name = match event {
        Feedback::Opened => "opened",
        Feedback::FalseResponse => "false_response",
        Feedback::FalseDeadline => "false_deadline",
        Feedback::ProjectDismissed => "project_dismissed",
    };
    c.execute(
        "INSERT INTO communication_evaluations(run_id,thread_id,event,at) VALUES(?1,?2,?3,?4)",
        params![id, thread_id, name, now()],
    )
    .map_err(err)?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../../schema.sql"))
            .unwrap();
        store::connect(&c, "fixture", "operator@example.invalid", 7).unwrap();
        c
    }
    fn request(id: &str) -> Request {
        Request {
            id: id.into(),
            days: 7,
        }
    }
    #[test]
    fn fixed_graph_closed_dependencies_join_and_node_failure() {
        let c = db();
        c.execute(
            "INSERT INTO communication_runs VALUES('x','fixture',7,'running','{}')",
            [],
        )
        .unwrap();
        let mut done = BTreeSet::new();
        assert!(step(&c, "x", "synthesize", &mut done, || Ok(1)).is_err());
        assert!(step(&c, "x", "send", &mut done, || Ok(1)).is_err());
        assert!(step::<Value>(&c, "x", "snapshot", &mut done, || Err(
            "synthetic failure".into()
        ))
        .is_err());
        assert!(done.is_empty());
        assert_eq!(
            definition()
                .iter()
                .find(|n| n.id == "synthesize")
                .unwrap()
                .depends_on,
            vec!["assess", "project"]
        );
        assert!(definition()
            .iter()
            .filter(|n| ["assess", "project"].contains(&n.id.as_str()))
            .all(|n| n.depends_on == vec!["select"]));
    }
    #[test]
    fn empty_run_is_inspectable_idempotent_and_closed_request() {
        let c = db();
        let run = analyze(&c, Path::new("unused"), request("empty")).unwrap();
        assert_eq!(run["status"], "completed");
        assert_eq!(run["items"], json!([]));
        assert!(run["durationMs"].is_i64());
        let count: i64 = c
            .query_row("SELECT count(*) FROM communication_events", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 10);
        analyze(&c, Path::new("unused"), request("empty")).unwrap();
        let again: i64 = c
            .query_row("SELECT count(*) FROM communication_events", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, again);
        assert!(
            serde_json::from_value::<Request>(json!({"id":"x","days":7,"graph":["send"]})).is_err()
        );
    }
    #[test]
    fn restart_preserves_events_and_manual_retry_is_new_run() {
        let c = db();
        c.execute(
            "INSERT INTO communication_runs VALUES('old','fixture',7,'running','{\"id\":\"old\"}')",
            [],
        )
        .unwrap();
        event(&c, "old", "snapshot", "running", json!({})).unwrap();
        recover(&c).unwrap();
        let status: String = c
            .query_row(
                "SELECT status FROM communication_runs WHERE id='old'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(status, "interrupted");
        assert_eq!(
            analyze(&c, Path::new("unused"), request("retry")).unwrap()["status"],
            "completed"
        );
        assert_eq!(
            c.query_row(
                "SELECT count(*) FROM communication_events WHERE run_id='old'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
    }
    #[test]
    fn disconnect_denies_runs() {
        let c = db();
        c.execute("UPDATE gmail_accounts SET enabled=0", [])
            .unwrap();
        assert!(analyze(&c, Path::new("unused"), request("x")).is_err());
    }
    #[test]
    fn cache_change_changes_signature() {
        let c = db();
        let first = signature(&c, "fixture").unwrap();
        c.execute(
            "INSERT INTO gmail_messages VALUES('fixture','a','t',0,1,1,'hash','{}')",
            [],
        )
        .unwrap();
        assert_ne!(first, signature(&c, "fixture").unwrap());
    }
    #[test]
    fn synthesis_rejects_reordered_evidence_and_missing_branch() {
        let input=skill::ThreadInput{messages:vec![skill::Message{evidence:skill::Evidence{message_id:"a".into(),thread_id:"t".into(),fingerprint:"source-hash".into(),timestamp:1},sender:"fixture".into(),subject:"Atlas".into(),text:"Review?".into(),sent:false,body_available:true,candidates:vec!["possible_response_needed".into()]}]};
        let assessment=skill::assess(&input).unwrap();
        let matched=crate::commands::project_relevance::match_projects(&skill::artifact(&input).unwrap(),&[]).unwrap();
        assert_eq!(synthesize(&[input.clone()],&[assessment.clone()],&[matched.clone()]).unwrap().len(),1);
        assert!(synthesize(&[input.clone()],&[],&[matched.clone()]).is_err());
        let mut wrong=assessment;wrong.summary.evidence_refs[0].message_id="other".into();
        assert!(synthesize(&[input.clone()],&[wrong],&[matched.clone()]).is_err());
        let mut wrong_project=matched;wrong_project.evidence_refs[0].source_type="document".into();
        assert!(synthesize(&[input.clone()],&[skill::assess(&input).unwrap()],&[wrong_project]).is_err());
    }
    #[test]
    fn v2_does_not_rewrite_historical_v1_record() {
        let c=db();let historical=json!({"id":"history","graph":"communication-intelligence/v1","accountId":"fixture","requestedDays":7,"status":"completed","definition":[{"id":"triage","kind":"communication-triage@1"}],"items":[]});
        c.execute("INSERT INTO communication_runs VALUES('history','fixture',7,'completed',?1)",[historical.to_string()]).unwrap();
        let replay=analyze(&c,Path::new("unused"),request("history")).unwrap();assert_eq!(replay,historical);
        assert_eq!(analyze(&c,Path::new("unused"),request("new-version")).unwrap()["graph"],"communication-intelligence/v2");
        let saved:String=c.query_row("SELECT payload_json FROM communication_runs WHERE id='history'",[],|r|r.get(0)).unwrap();assert_eq!(saved,historical.to_string());
    }

}
