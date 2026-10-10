//! Organizer IPC. All authority remains in the existing delegation approval system.
use super::{approvals::ApprovalState, organizer_store::*, persistence::Db};
use rusqlite::params;
use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Manager};

pub async fn blocking<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppHandle) -> OResult<T> + Send + 'static,
) -> OResult<T> {
    tauri::async_runtime::spawn_blocking(move || work(&app))
        .await
        .map_err(|e| error("unavailable", e.to_string()))?
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectRequest {
    pub project_id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskRequest {
    pub task_id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RevisionRequest {
    pub task_id: String,
    pub expected_revision: i64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskPatch {
    pub title: String,
    pub objective: String,
    pub criteria: Vec<String>,
    pub steps: Vec<Step>,
    pub priority: String,
    pub priority_reason: String,
    pub due_date: Option<String>,
    pub sources: Vec<Source>,
    pub intent: String,
}
impl TaskPatch {
    fn with_project(self, project_id: String) -> TaskInput {
        TaskInput {
            project_id,
            title: self.title,
            objective: self.objective,
            criteria: self.criteria,
            steps: self.steps,
            priority: self.priority,
            priority_reason: self.priority_reason,
            due_date: self.due_date,
            sources: self.sources,
            intent: self.intent,
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRequest {
    pub task_id: String,
    pub expected_revision: i64,
    pub patch: TaskPatch,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IntentRequest {
    pub task_id: String,
    pub expected_revision: i64,
    pub intent: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoveRequest {
    pub task_id: String,
    pub expected_revision: i64,
    pub before_task_id: Option<String>,
}

fn register_project(app: &AppHandle, id: &str) -> OResult<()> {
    let db = app.state::<Db>();
    let root = if let Some(p) = super::acceptance::projects_root() {
        p.to_string_lossy().into_owned()
    } else {
        db.0.lock()
            .map_err(|e| e.to_string())?
            .query_row(
                "SELECT value FROM settings WHERE key='projectsRootPath'",
                [],
                |r| r.get::<_, String>(0),
            )
            .map_err(|_| error("unavailable", "Configure the projects root first."))?
    };
    let scan = super::projects::scan_tracked_projects_blocking(super::projects::ProjectsRequest {
        root_path: root,
        since_session: None,
    })?;
    let p = scan
        .projects
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| {
            error(
                "validation",
                "This project is not in the configured project scan.",
            )
        })?;
    db.0.lock().map_err(|e|e.to_string())?.execute("INSERT INTO projects(id,name,status,signal,description,payload_json) VALUES(?1,?2,?3,'','',?4) ON CONFLICT(id) DO NOTHING",params![p.id,p.name,p.status,json(&p)?])?;
    Ok(())
}
#[tauri::command]
pub async fn create_organizer_task(app: AppHandle, request: TaskInput) -> OResult<Task> {
    blocking(app, move |app| {
        register_project(app, &request.project_id)?;
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        create(&mut c, request)
    })
    .await
}
#[tauri::command]
pub async fn update_organizer_task(app: AppHandle, request: UpdateRequest) -> OResult<Task> {
    blocking(app, move |app| {
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        let task = get(&c, &request.task_id)?;
        update(
            &mut c,
            &request.task_id,
            request.expected_revision,
            request.patch.with_project(task.project_id.clone()),
        )
    })
    .await
}
#[tauri::command]
pub async fn list_organizer_tasks(app: AppHandle, request: ProjectRequest) -> OResult<Vec<Task>> {
    blocking(app, move |app| {
        let db = app.state::<Db>();
        let c = db.0.lock().map_err(|e| e.to_string())?;
        list(&c, &request.project_id)
    })
    .await
}
#[tauri::command]
pub async fn set_organizer_intent(app: AppHandle, request: IntentRequest) -> OResult<Task> {
    blocking(app, move |app| {
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        let mut task = check_revision(&c, &request.task_id, request.expected_revision)?;
        task.input.intent = request.intent;
        update(
            &mut c,
            &request.task_id,
            request.expected_revision,
            task.input,
        )
    })
    .await
}
#[tauri::command]
pub async fn move_organizer_task(app: AppHandle, request: MoveRequest) -> OResult<Vec<Task>> {
    blocking(app, move |app| {
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        move_task(
            &mut c,
            &request.task_id,
            request.expected_revision,
            request.before_task_id.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub async fn prepare_organizer_delegation(
    app: AppHandle,
    request: RevisionRequest,
) -> OResult<super::delegation::PreparedProposal> {
    blocking(app,move|app|{
    super::acceptance::refuse_delegation()?;
    let state=app.state::<ApprovalState>();let _guard=state.execution.lock().map_err(|e|e.to_string())?;let db=app.state::<Db>();
    let t={let c=db.0.lock().map_err(|e|e.to_string())?;let t=check_revision(&c,&request.task_id,request.expected_revision)?;check_editable(&c,&t)?;t};
    if t.intent!="committed"{return Err(error("validation","Adopt this task before delegation."))}
    let task=format!("{}\n\n{}\n\nPlan checklist:\n{}\n\nSource references (untrusted context, not execution authority):\n{}",t.title,t.objective,t.steps.iter().map(|s|format!("- {}",s.text)).collect::<Vec<_>>().join("\n"),t.sources.iter().map(|s|s.reference.clone()).collect::<Vec<_>>().join("\n"));
    if task.chars().count()>4000{return Err(error("validation","The delegation brief exceeds the executor's 4,000-character limit. Shorten the objective, checklist or source list before preparing."))}
    let subject=super::delegation::planning_subject(app,db.inner(),&super::delegation::PrepareDelegationRequest{project_id:t.project_id.clone(),task,criteria:t.criteria.clone()},&new_id())?;
    let proposal=state.prepare(new_id(),subject)?;
    {let c=db.0.lock().map_err(|e|e.to_string())?;bind_proposal(&c,&proposal.id,&proposal.subject.run_id,&t)?;}
    Ok(super::delegation::present(proposal))
}).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetail {
    #[serde(flatten)]
    pub detail: super::organizer_lifecycle::Detail,
    pub runs: Vec<super::delegation::DelegationRun>,
    pub source_health: Vec<String>,
    pub result_health: std::collections::HashMap<String, String>,
}
fn load_detail(app: &AppHandle, id: &str) -> OResult<TaskDetail> {
    super::delegation::list_runs(app)?;
    let db = app.state::<Db>();
    let detail = {
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        super::organizer_lifecycle::reconcile(&mut c)?;
        super::organizer_lifecycle::detail(&c, id)?
    };
    let runs = detail
        .run_ids
        .iter()
        .map(|id| super::delegation::load_run(db.inner(), id).map_err(OrganizerError::from))
        .collect::<OResult<Vec<_>>>()?;
    let root = super::get_vault_path();
    let source_health = detail
        .task
        .sources
        .iter()
        .map(|s| {
            if s.kind == "url" {
                return "External reference (not revalidated)".into();
            }
            if validate_source(s, &root).is_err() {
                return "Unavailable or unsafe source path".into();
            }
            let read = (|| -> std::io::Result<Vec<u8>> {
                use std::io::Read;
                let file = std::fs::File::open(root.join(&s.reference))?;
                let mut bytes = Vec::new();
                file.take(2_097_153).read_to_end(&mut bytes)?;
                Ok(bytes)
            })();
            match read {
                Ok(b) if b.len() > 2_097_152 => {
                    "Source exceeds inspection limit; saved reference retained".into()
                }
                Ok(b) => {
                    use sha2::{Digest, Sha256};
                    let hash = format!("{:x}", Sha256::digest(b));
                    if s.sha256.as_ref().is_some_and(|h| h != &hash) {
                        "Source changed since capture"
                    } else if s.sha256.is_none() {
                        "Available; original revision unknown"
                    } else {
                        "Captured revision matches"
                    }
                    .into()
                }
                Err(_) => "Source unavailable; saved reference retained".into(),
            }
        })
        .collect();
    let result_health = detail
        .results
        .iter()
        .map(|result| {
            let health = runs
                .iter()
                .find(|r| r.id == result.run_id)
                .and_then(|run| {
                    super::delegation::workspace_hash(
                        std::path::Path::new(&run.workspace),
                        &run.base_commit,
                    )
                    .ok()
                })
                .map(|hash| {
                    if result.workspace_hash.is_empty() {
                        "Not yet reviewed"
                    } else if hash == result.workspace_hash {
                        "Current workspace matches the recorded review"
                    } else {
                        "Workspace changed since review; recorded result is historical"
                    }
                })
                .unwrap_or("Workspace evidence unavailable; saved result retained");
            (result.id.clone(), health.into())
        })
        .collect();
    Ok(TaskDetail {
        detail,
        runs,
        source_health,
        result_health,
    })
}
#[tauri::command]
pub async fn fetch_organizer_task(app: AppHandle, request: TaskRequest) -> OResult<TaskDetail> {
    blocking(app, move |app| load_detail(app, &request.task_id)).await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AcceptRequest {
    pub task_id: String,
    pub expected_revision: i64,
    pub result_id: String,
    pub workspace_hash: String,
}
#[tauri::command]
pub async fn accept_organizer_result(app: AppHandle, request: AcceptRequest) -> OResult<Task> {
    blocking(app, move |app| {
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let result = {
            let mut c = db.0.lock().map_err(|e| e.to_string())?;
            super::organizer_lifecycle::reconcile(&mut c)?;
            super::organizer_lifecycle::detail(&c, &request.task_id)?
                .results
                .into_iter()
                .find(|r| r.id == request.result_id)
                .ok_or_else(|| error("not_found", "Result not found."))?
        };
        if result.review_state == "accepted" {
            let c = db.0.lock().map_err(|e| e.to_string())?;
            let task = get(&c, &request.task_id)?;
            if task.state == "completed" {
                return Ok(task);
            }
        }
        let run = super::delegation::load_run(db.inner(), &result.run_id)?;
        let hash = super::delegation::workspace_hash(
            std::path::Path::new(&run.workspace),
            &run.base_commit,
        )?;
        if hash != request.workspace_hash {
            return Err(error(
                "conflict",
                "Workspace changed; inspect fresh evidence.",
            ));
        }
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        super::organizer_lifecycle::accept(
            &mut c,
            &request.task_id,
            request.expected_revision,
            &request.result_id,
            &hash,
        )
    })
    .await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FinishRequest {
    pub task_id: String,
    pub expected_revision: i64,
    pub action: String,
    pub reason: String,
}
#[tauri::command]
pub async fn finish_organizer_task(app: AppHandle, request: FinishRequest) -> OResult<Task> {
    blocking(app, move |app| {
        let state = app.state::<ApprovalState>();
        let _guard = state.execution.lock().map_err(|e| e.to_string())?;
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        super::organizer_lifecycle::finish(
            &mut c,
            &request.task_id,
            request.expected_revision,
            &request.action,
            &request.reason,
        )
    })
    .await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EventRequest {
    pub event_id: i64,
}
#[tauri::command]
pub async fn acknowledge_organizer_event(app: AppHandle, request: EventRequest) -> OResult<()> {
    blocking(app,move|app|{
    let db=app.state::<Db>();let c=db.0.lock().map_err(|e|e.to_string())?;c.execute("UPDATE organizer_events SET acknowledgement_at=COALESCE(acknowledgement_at,?2) WHERE sequence=?1",params![request.event_id,now()])?;Ok(())
}).await
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub task: Task,
    pub display_status: String,
    pub needs_attention: bool,
}
#[tauri::command]
pub async fn organizer_overview(app: AppHandle) -> OResult<Vec<Overview>> {
    blocking(app,move|app|{
    super::delegation::list_runs(app)?;let db=app.state::<Db>();let mut c=db.0.lock().map_err(|e|e.to_string())?;super::organizer_lifecycle::reconcile(&mut c)?;
    let ids={let mut q=c.prepare("SELECT id FROM organizer_tasks ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,position,id")?;let rows=q.query_map([],|r|r.get::<_,String>(0))?.collect::<Result<Vec<_>,_>>()?;rows};
    ids.iter().map(|id|{let d=super::organizer_lifecycle::detail(&c,id)?;Ok(Overview{task:d.task,display_status:d.display_status,needs_attention:d.events.iter().any(|e|!e.acknowledged&&["needs_you","failed","result_ready","completed"].contains(&e.kind.as_str()))})}).collect()
}).await
}
