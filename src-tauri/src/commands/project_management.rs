use super::{
    persistence::Db,
    project_registry as store,
    projects::{ProjectsRequest, ProjectsResponse},
};
use serde::Deserialize;
use tauri::{AppHandle, Manager};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkRequest {
    pub kind: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub name: String,
    pub project_id: Option<String>,
}

pub fn scan(app: &AppHandle, request: ProjectsRequest) -> Result<ProjectsResponse, String> {
    let db = app.state::<Db>();
    let members = {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        store::list(&c)?
    };
    let revisions = members
        .iter()
        .map(|m| (m.project.id.clone(), m.revision))
        .collect();
    let raw = super::projects::scan_tracked_projects_blocking(request);
    let success = raw.is_ok();
    let mut response = raw.unwrap_or_else(|e| ProjectsResponse {
        projects: vec![],
        warnings: vec![e],
    });
    let db = app.state::<Db>();
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let initialized: bool = c
        .query_row(
            "SELECT initialized FROM project_membership_state WHERE id=1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !success && !initialized && store::list(&c)?.is_empty() {
        return Err(response.warnings.join(" "));
    }
    drop(c);
    for member in members.iter().filter(|m| m.visibility == "visible") {
        if !member.project.path.is_empty()
            && !response
                .projects
                .iter()
                .any(|p| store::path_key(&p.path) == store::path_key(&member.project.path))
        {
            match super::projects::build_project_payload(
                std::path::PathBuf::from(&member.project.path),
                &super::project_notes::ProjectNoteIndex::default(),
                None,
            ) {
                Ok(mut p) if std::path::Path::new(&member.project.path).is_dir() => {
                    p.id = member.project.id.clone();
                    response.projects.push(p)
                }
                _ => {
                    let mut p = member.project.clone();
                    p.warnings =
                        vec!["Linked folder is unavailable. Relink it or try again.".into()];
                    response.projects.push(p)
                }
            }
        }
    }
    c = db.0.lock().map_err(|e| e.to_string())?;
    response.projects =
        store::reconcile_guarded(&mut c, response.projects, success, Some(&revisions))?;
    Ok(response)
}
#[tauri::command]
pub fn project_members(db: tauri::State<Db>) -> Result<Vec<store::Member>, String> {
    store::list(&*db.0.lock().map_err(|e| e.to_string())?)
}
#[tauri::command]
pub async fn link_project(app: AppHandle, request: LinkRequest) -> Result<store::Member, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        store::add(
            &mut c,
            &request.kind,
            &request.location,
            &request.name,
            request.project_id.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn set_project_visibility(
    app: AppHandle,
    id: String,
    visibility: String,
) -> Result<store::Member, String> {
    // Same execution lock as delegation approval: removal cannot race a new run.
    let state = app.state::<super::approvals::ApprovalState>();
    let _guard = state.execution.lock().map_err(|e| e.to_string())?;
    let db = app.state::<Db>();
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    store::visibility(&mut c, &id, &visibility)
}
#[tauri::command]
pub fn save_project_intake(
    db: tauri::State<Db>,
    id: String,
    revision: i64,
    intake: serde_json::Value,
) -> Result<store::Member, String> {
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let mut value = store::get(&c, &id)?.intake;
    for key in ["purpose", "priority", "constraints"] {
        let text = intake[key].as_str().unwrap_or("");
        if text.len() > 4000 {
            return Err("Keep each answer within 4,000 bytes.".into());
        }
        value[key] = serde_json::json!(text);
    }
    store::save_intake(&mut c, &id, revision, value)
}
#[tauri::command]
pub async fn pick_project_folder() -> Result<Option<String>, String> {
    Ok(rfd::AsyncFileDialog::new()
        .set_title("Link a project folder")
        .pick_folder()
        .await
        .map(|p| p.path().to_string_lossy().into_owned()))
}
