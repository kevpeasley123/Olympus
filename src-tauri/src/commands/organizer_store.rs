//! Stable, revisioned Organizer state. Source text never grants execution authority.
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Step {
    pub id: String,
    pub text: String,
    pub done: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub kind: String,
    pub reference: String,
    pub captured_text: Option<String>,
    pub sha256: Option<String>,
    pub line: Option<u32>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskInput {
    pub project_id: String,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub revision: i64,
    #[serde(flatten)]
    pub input: TaskInput,
    pub position: i64,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
}
impl std::ops::Deref for Task {
    type Target = TaskInput;
    fn deref(&self) -> &TaskInput {
        &self.input
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizerError {
    pub code: String,
    pub message: String,
    pub current_task: Option<Task>,
}
impl From<String> for OrganizerError {
    fn from(s: String) -> Self {
        error("unavailable", s)
    }
}
impl From<rusqlite::Error> for OrganizerError {
    fn from(e: rusqlite::Error) -> Self {
        e.to_string().into()
    }
}
pub type OResult<T> = Result<T, OrganizerError>;
pub fn error(code: &str, message: impl Into<String>) -> OrganizerError {
    OrganizerError {
        code: code.into(),
        message: message.into(),
        current_task: None,
    }
}
pub fn new_id() -> String {
    super::delegation::run_id()
}
pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
pub fn bind_proposal(c: &Connection, proposal: &str, run: &str, t: &Task) -> OResult<()> {
    if t.state != "open" || t.intent != "committed" {
        return Err(error(
            "validation",
            "Adopt this task before preparing delegation.",
        ));
    }
    c.execute("INSERT INTO organizer_proposal_links(proposal_id,task_id,task_revision,run_id,created_at) VALUES(?1,?2,?3,?4,?5)",params![proposal,t.id,t.revision,run,now()])?;
    Ok(())
}
pub fn validate_binding(c: &Connection, proposal: &str, run: &str) -> OResult<Option<Task>> {
    let link=c.query_row("SELECT task_id,task_revision,run_id FROM organizer_proposal_links WHERE proposal_id=?1",[proposal],|r|Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?))).optional()?;
    if let Some((id, revision, bound_run)) = link {
        if bound_run != run {
            return Err(error("validation", "Proposal belongs to another run."));
        }
        let t = check_revision(c, &id, revision)?;
        if t.state != "open" || t.intent != "committed" {
            return Err(error("validation", "Task is no longer committed and open."));
        }
        Ok(Some(t))
    } else {
        Ok(None)
    }
}
pub fn validate_linked_run(c: &Connection, run: &str) -> OResult<()> {
    let link = c
        .query_row(
            "SELECT task_id,task_revision FROM organizer_run_links WHERE run_id=?1",
            [run],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
        )
        .optional()?;
    if let Some((id, revision)) = link {
        let t = check_revision(c, &id, revision)?;
        if t.state != "open" || t.intent != "committed" {
            return Err(error(
                "validation",
                "Linked Organizer task is no longer open and committed.",
            ));
        }
    }
    Ok(())
}
pub fn link_started_run(c: &Connection, proposal: &str, run: &str) -> OResult<()> {
    if let Some(t) = validate_binding(c, proposal, run)? {
        c.execute("INSERT INTO organizer_run_links(run_id,task_id,task_revision,contract_snapshot_json,linked_at) VALUES(?1,?2,?3,?4,?5)",params![run,t.id,t.revision,json(&t)?,now()])?;
        event(
            c,
            &t.id,
            "run_started",
            &json(&serde_json::json!({"runId":run}))?,
            Some(&format!("start:{run}")),
        )?;
    }
    Ok(())
}
pub fn json<T: Serialize>(v: &T) -> OResult<String> {
    serde_json::to_string(v).map_err(|e| e.to_string().into())
}
fn length(s: &str, min: usize, max: usize, name: &str) -> OResult<()> {
    if !(min..=max).contains(&s.trim().chars().count()) {
        return Err(error(
            "validation",
            format!("{name} must contain {min}–{max} characters."),
        ));
    }
    Ok(())
}
pub fn validate_source(s: &Source, root: &Path) -> OResult<()> {
    length(&s.reference, 1, 4000, "Source reference")?;
    if s.captured_text
        .as_ref()
        .is_some_and(|s| s.chars().count() > 8000)
    {
        return Err(error("validation", "Source excerpt is too long."));
    }
    if s.line == Some(0) {
        return Err(error("validation", "Source lines are one-based."));
    }
    if s.sha256
        .as_ref()
        .is_some_and(|s| s.len() != 64 || !s.bytes().all(|b| b.is_ascii_hexdigit()))
    {
        return Err(error("validation", "Invalid source hash."));
    }
    if s.kind == "url" {
        let u = reqwest::Url::parse(&s.reference)
            .map_err(|_| error("validation", "Invalid source URL."))?;
        if u.scheme() != "https"
            || u.host_str().is_none()
            || !u.username().is_empty()
            || u.password().is_some()
        {
            return Err(error(
                "validation",
                "Sources require an HTTPS URL without credentials.",
            ));
        }
    } else if s.kind == "vault" {
        let p = Path::new(&s.reference);
        if p.is_absolute()
            || s.reference.contains(':')
            || p.components().any(|c| !matches!(c, Component::Normal(_)))
        {
            return Err(error(
                "validation",
                "Use a vault-relative source path without traversal.",
            ));
        }
        // Check nearest existing ancestor so missing files cannot conceal a symlink escape.
        let base = root
            .canonicalize()
            .map_err(|e| error("unavailable", format!("Vault unavailable: {e}")))?;
        let target = base.join(p);
        let mut ancestor = target.as_path();
        while !ancestor.exists() {
            ancestor = ancestor
                .parent()
                .ok_or_else(|| error("validation", "Invalid source path"))?;
        }
        if !ancestor
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(base)
        {
            return Err(error("validation", "Source escapes the vault."));
        }
    } else {
        return Err(error("validation", "Source kind must be vault or url."));
    }
    Ok(())
}
fn validate(c: &Connection, i: &TaskInput) -> OResult<()> {
    if !c.query_row(
        "SELECT EXISTS(SELECT 1 FROM projects WHERE id=?1)",
        [&i.project_id],
        |r| r.get::<_, bool>(0),
    )? {
        return Err(error("validation", "Unknown project."));
    }
    length(&i.title, 1, 160, "Title")?;
    length(&i.objective, 1, 8000, "Objective")?;
    length(&i.priority_reason, 0, 2000, "Priority reason")?;
    if !(1..=12).contains(&i.criteria.len()) || i.steps.len() > 30 || i.sources.len() > 20 {
        return Err(error(
            "validation",
            "Use 1–12 criteria, at most 30 steps and 20 sources.",
        ));
    }
    for s in &i.criteria {
        length(s, 1, 1000, "Criterion")?
    }
    let mut ids = std::collections::HashSet::new();
    for s in &i.steps {
        length(&s.text, 1, 500, "Step")?;
        if !s.id.is_empty() && !ids.insert(&s.id) {
            return Err(error("validation", "Duplicate checklist identity."));
        }
    }
    if !["high", "normal", "low"].contains(&i.priority.as_str())
        || !["proposed", "committed"].contains(&i.intent.as_str())
    {
        return Err(error("validation", "Invalid priority or intent."));
    }
    if let Some(d) = &i.due_date {
        if d.len() != 10 || chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err() {
            return Err(error(
                "validation",
                "Due date must be a real YYYY-MM-DD date.",
            ));
        }
    }
    Ok(())
}
pub fn event(
    c: &Connection,
    id: &str,
    kind: &str,
    payload: &str,
    key: Option<&str>,
) -> OResult<()> {
    c.execute("INSERT OR IGNORE INTO organizer_events(task_id,kind,payload_json,created_at,dedupe_key) VALUES(?1,?2,?3,?4,?5)",params![id,kind,payload,now(),key])?;
    Ok(())
}
fn sources(c: &Connection, id: &str) -> OResult<Vec<Source>> {
    let mut q =
        c.prepare("SELECT source_json FROM organizer_sources WHERE task_id=?1 ORDER BY rowid")?;
    let raw = q
        .query_map([id], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    raw.iter()
        .map(|s| serde_json::from_str(s).map_err(|e| e.to_string().into()))
        .collect()
}
fn save_sources(c: &Connection, t: &Task) -> OResult<()> {
    c.execute("DELETE FROM organizer_sources WHERE task_id=?1", [&t.id])?;
    for s in &t.sources {
        c.execute(
            "INSERT INTO organizer_sources(id,task_id,source_json) VALUES(?1,?2,?3)",
            params![new_id(), t.id, json(s)?],
        )?;
    }
    Ok(())
}
pub fn get(c: &Connection, id: &str) -> OResult<Task> {
    let row=c.query_row("SELECT project_id,revision,title,objective,criteria_json,steps_json,priority,priority_reason,position,due_date,intent,state,created_at,updated_at FROM organizer_tasks WHERE id=?1",[id],|r|{
        Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,String>(5)?,r.get::<_,String>(6)?,r.get::<_,String>(7)?,r.get::<_,i64>(8)?,r.get::<_,Option<String>>(9)?,r.get::<_,String>(10)?,r.get::<_,String>(11)?,r.get::<_,String>(12)?,r.get::<_,String>(13)?))
    }).optional()?.ok_or_else(||error("not_found","Organizer task not found."))?;
    Ok(Task {
        id: id.into(),
        revision: row.1,
        position: row.8,
        state: row.11,
        created_at: row.12,
        updated_at: row.13,
        input: TaskInput {
            project_id: row.0,
            title: row.2,
            objective: row.3,
            criteria: serde_json::from_str(&row.4).map_err(|e| e.to_string())?,
            steps: serde_json::from_str(&row.5).map_err(|e| e.to_string())?,
            priority: row.6,
            priority_reason: row.7,
            due_date: row.9,
            intent: row.10,
            sources: sources(c, id)?,
        },
    })
}
pub fn list(c: &Connection, project: &str) -> OResult<Vec<Task>> {
    let ids = {
        let mut q=c.prepare("SELECT id FROM organizer_tasks WHERE project_id=?1 ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,position,id")?;
        let rows = q
            .query_map([project], |r| r.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    ids.iter().map(|id| get(c, id)).collect()
}
pub fn check_revision(c: &Connection, id: &str, revision: i64) -> OResult<Task> {
    let t = get(c, id)?;
    if t.revision != revision {
        return Err(OrganizerError {
            code: "conflict".into(),
            message: "This task changed. Your draft is preserved; reload before saving.".into(),
            current_task: Some(t),
        });
    }
    Ok(t)
}
pub fn check_editable(c: &Connection, t: &Task) -> OResult<()> {
    if t.state != "open" {
        return Err(error("busy", "This task is closed."));
    }
    let busy:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM organizer_run_links l JOIN delegation_runs r ON r.id=l.run_id WHERE l.task_id=?1 AND r.phase NOT IN ('complete','failed','cancelled'))",[&t.id],|r|r.get(0))?;
    if busy {
        return Err(error("busy","Stop the linked run before changing this task. Your edit has not steered the running agent."));
    }
    Ok(())
}
fn normalize_steps(i: &mut TaskInput, old: Option<&Task>) -> OResult<()> {
    for s in &mut i.steps {
        if s.id.is_empty() {
            s.id = new_id()
        } else if old.is_none_or(|t| !t.steps.iter().any(|p| p.id == s.id)) {
            return Err(error(
                "validation",
                "Unknown checklist identity; new steps require an empty id.",
            ));
        }
    }
    Ok(())
}
// Preserve historical identities without rereading them. New references are
// validated before bounded capture; source content never grants authority.
fn prepare_sources(input: &mut TaskInput, old: Option<&Task>, root: &Path) -> OResult<()> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    for source in &mut input.sources {
        if let Some(saved) = old.and_then(|t| {
            t.sources
                .iter()
                .find(|s| s.kind == source.kind && s.reference == source.reference)
        }) {
            *source = saved.clone();
            continue;
        }
        validate_source(source, root)?;
        if source.kind != "vault" {
            continue;
        }
        source.sha256 = None;
        source.captured_text = None;
        source.line = None;
        // Recheck containment for this read as well as for reference admission.
        validate_source(source, root)?;
        if let Ok(file) = std::fs::File::open(root.join(&source.reference)) {
            let mut bytes = Vec::new();
            if file.take(2_097_153).read_to_end(&mut bytes).is_ok() && bytes.len() <= 2_097_152 {
                source.sha256 = Some(format!("{:x}", Sha256::digest(&bytes)));
                source.captured_text = String::from_utf8(bytes)
                    .ok()
                    .map(|text| text.chars().take(8000).collect());
                source.line = source.captured_text.as_ref().map(|_| 1);
            }
        }
    }
    Ok(())
}
pub fn create(c: &mut Connection, mut i: TaskInput) -> OResult<Task> {
    validate(c, &i)?;
    prepare_sources(&mut i, None, &super::get_vault_path())?;
    normalize_steps(&mut i, None)?;
    let tx = c.transaction()?;
    let id = new_id();
    let stamp = now();
    let position:i64=tx.query_row("SELECT COALESCE(MAX(position),-1)+1 FROM organizer_tasks WHERE project_id=?1 AND priority=?2",params![i.project_id,i.priority],|r|r.get(0))?;
    tx.execute("INSERT INTO organizer_tasks(id,project_id,revision,title,objective,criteria_json,steps_json,priority,priority_reason,position,due_date,intent,state,created_at,updated_at) VALUES(?1,?2,1,?3,?4,?5,?6,?7,?8,?9,?10,?11,'open',?12,?12)",params![id,i.project_id,i.title,i.objective,json(&i.criteria)?,json(&i.steps)?,i.priority,i.priority_reason,position,i.due_date,i.intent,stamp])?;
    let t = Task {
        id,
        revision: 1,
        input: i,
        position,
        state: "open".into(),
        created_at: stamp.clone(),
        updated_at: stamp,
    };
    save_sources(&tx, &t)?;
    event(&tx, &t.id, "created", "{}", None)?;
    tx.commit()?;
    Ok(t)
}
pub fn update(c: &mut Connection, id: &str, revision: i64, mut i: TaskInput) -> OResult<Task> {
    let tx = c.transaction()?;
    let mut t = check_revision(&tx, id, revision)?;
    validate(&tx, &i)?;
    check_editable(&tx, &t)?;
    if i.project_id != t.project_id {
        return Err(error(
            "validation",
            "A task cannot be moved between projects.",
        ));
    }
    normalize_steps(&mut i, Some(&t))?;
    prepare_sources(&mut i, Some(&t), &super::get_vault_path())?;
    t.input = i;
    t.revision += 1;
    t.updated_at = now();
    tx.execute("UPDATE organizer_tasks SET revision=?2,title=?3,objective=?4,criteria_json=?5,steps_json=?6,priority=?7,priority_reason=?8,due_date=?9,intent=?10,updated_at=?11 WHERE id=?1",params![id,t.revision,t.title,t.objective,json(&t.criteria)?,json(&t.steps)?,t.priority,t.priority_reason,t.due_date,t.intent,t.updated_at])?;
    save_sources(&tx, &t)?;
    tx.execute("UPDATE organizer_results SET review_state='superseded' WHERE task_id=?1 AND review_state='pending'",[id])?;
    event(&tx, id, "edited", "{}", None)?;
    tx.commit()?;
    Ok(t)
}
pub fn move_task(
    c: &mut Connection,
    id: &str,
    revision: i64,
    before: Option<&str>,
) -> OResult<Vec<Task>> {
    let tx = c.transaction()?;
    let t = check_revision(&tx, id, revision)?;
    check_editable(&tx, &t)?;
    let mut group: Vec<Task> = list(&tx, &t.project_id)?
        .into_iter()
        .filter(|x| x.priority == t.priority && x.state == "open" && x.id != id)
        .collect();
    let index = if let Some(b) = before {
        group.iter().position(|x| x.id == b).ok_or_else(|| {
            error(
                "validation",
                "Move within the same project and priority group.",
            )
        })?
    } else {
        group.len()
    };
    group.insert(index, t.clone());
    for (n, item) in group.iter().enumerate() {
        if item.position != n as i64 {
            check_editable(&tx, item)?;
            tx.execute("UPDATE organizer_tasks SET position=?2,revision=revision+1,updated_at=?3 WHERE id=?1",params![item.id,n as i64,now()])?;
        }
    }
    event(&tx, id, "reordered", "{}", None)?;
    tx.commit()?;
    list(c, &t.project_id)
}
#[cfg(test)]
#[path = "organizer_store_tests.rs"]
mod tests;

/// Replays are reads of an already-consumed, session-bound attempt, never launches.
pub fn recorded_start(c: &Connection, proposal: &str, session: &str) -> OResult<Option<String>> {
    Ok(c.query_row("SELECT l.run_id FROM organizer_proposal_links p JOIN organizer_run_links l ON l.run_id=p.run_id AND l.task_id=p.task_id AND l.task_revision=p.task_revision JOIN operator_approvals a ON a.id=p.proposal_id AND a.run_id=l.run_id JOIN approval_consumptions x ON x.approval_id=a.id AND x.run_id=l.run_id JOIN delegation_runs r ON r.id=l.run_id WHERE p.proposal_id=?1 AND a.session_id=?2 AND a.stage='plan' AND x.stage='plan'",params![proposal,session],|r|r.get(0)).optional()?)
}
