//! Bounded project evidence and operator-reviewed briefs. Source text never grants authority.
use super::{persistence::Db, project_registry as store};
use serde::{Deserialize, Serialize};
use std::{io::Read, path::Path};
use tauri::{AppHandle, Manager};
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub source: String,
    pub text: String,
    pub fingerprint: String,
}
#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub evidence: Vec<Evidence>,
    pub warnings: Vec<String>,
}
const FILES: &[&str] = &[
    "README.md",
    "README.MD",
    "README.txt",
    "README.rst",
    "README",
    "OLYMPUS-MANUAL.md",
    "PROJECT-BRIEF.md",
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "requirements.txt",
];
pub fn local(root: &Path) -> Result<Assessment, String> {
    let root = root
        .canonicalize()
        .map_err(|_| "The linked folder is unavailable.".to_string())?;
    let mut out = Assessment::default();
    let mut budget = 128 * 1024;
    let mut seen = std::collections::HashSet::new();
    for name in FILES {
        let p = root.join(name);
        if !p.exists() {
            continue;
        }
        let p = p.canonicalize().map_err(|e| e.to_string())?;
        if !p.starts_with(&root) {
            out.warnings
                .push(format!("Skipped {name}: link leaves the project folder."));
            continue;
        }
        if !seen.insert(store::path_key(&p.to_string_lossy())) {
            continue;
        }
        let f = std::fs::File::open(&p).map_err(|e| e.to_string())?;
        let meta = f.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() || meta.len() > 32768 || meta.len() as usize > budget {
            out.warnings
                .push(format!("Skipped {name}: exceeds the text budget."));
            continue;
        }
        let mut bytes = vec![];
        f.take(32769)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() > 32768 || bytes.len() > budget {
            out.warnings
                .push(format!("Skipped {name}: changed during inspection."));
            continue;
        }
        let Ok(text) = String::from_utf8(bytes) else {
            out.warnings
                .push(format!("Skipped {name}: not UTF-8 text."));
            continue;
        };
        if text.contains('\0') {
            continue;
        }
        budget -= text.len();
        out.evidence.push(Evidence {
            source: p.to_string_lossy().into_owned(),
            fingerprint: super::approvals::digest(&text),
            text,
        });
    }
    Ok(out)
}
pub fn remote_endpoint(raw: &str) -> Result<String, String> {
    let raw = store::git_url(raw)?;
    let u = reqwest::Url::parse(&raw).map_err(|e| e.to_string())?;
    let parts: Vec<_> = u.path().trim_matches('/').split('/').collect();
    if parts.iter().any(|s| {
        s.is_empty()
            || !s
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
    }) {
        return Err("Use the repository's root URL.".into());
    }
    match u.host_str(){Some("github.com") if parts.len()==2=>Ok(format!("https://api.github.com/repos/{}/{}/readme",parts[0],parts[1])),Some("gitlab.com") if parts.len()>=2=>Ok(format!("https://gitlab.com/api/v4/projects/{}/repository/files/README.md/raw?ref=HEAD",urlencoding::encode(&parts.join("/")))),_=>Err("Saved link. Link a local folder to inspect this repository; public GitHub and GitLab repositories are supported here.".into())}
}
async fn remote(url: &str) -> Result<Evidence, String> {
    let endpoint = remote_endpoint(url)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client
        .get(endpoint)
        .header("User-Agent", "Olympus-project-inspection")
        .header("Accept", "application/vnd.github.raw+json")
        .send()
        .await
        .map_err(|_| {
            "Repository could not be reached. Link its local folder or retry.".to_string()
        })?;
    if !response.status().is_success() {
        return Err(
            "README unavailable or repository is private. Link a local folder to inspect it."
                .into(),
        );
    }
    if response.content_length().is_some_and(|n| n > 32768) {
        return Err("Remote README exceeds the 32 KiB inspection limit.".into());
    }
    let mut bytes = vec![];
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Repository response interrupted.".to_string())?
    {
        if bytes.len() + chunk.len() > 32768 {
            return Err("Remote README exceeds the 32 KiB inspection limit.".into());
        }
        bytes.extend_from_slice(&chunk)
    }
    let text =
        String::from_utf8(bytes).map_err(|_| "Repository README is not UTF-8 text.".to_string())?;
    Ok(Evidence {
        source: url.into(),
        fingerprint: super::approvals::digest(&text),
        text,
    })
}
#[tauri::command]
pub async fn inspect_project(app: AppHandle, id: String) -> Result<store::Member, String> {
    let member = {
        let db = app.state::<Db>();
        let c = db.0.lock().map_err(|e| e.to_string())?;
        store::get(&c, &id)?
    };
    if member.visibility != "visible" {
        return Err("Restore this project before inspecting it.".into());
    }
    let mut report = Assessment::default();
    // Prefer local evidence when available, avoiding an unnecessary remote request.
    if let Some(source) = member.sources.iter().find(|s| s.kind == "folder") {
        let path = source.location.clone();
        match tauri::async_runtime::spawn_blocking(move || local(Path::new(&path)))
            .await
            .map_err(|e| e.to_string())?
        {
            Ok(value) => report = value,
            Err(e) => report.warnings.push(e),
        }
    } else if let Some(source) = member.sources.iter().find(|s| s.kind == "git") {
        match remote(&source.location).await {
            Ok(e) => report.evidence.push(e),
            Err(e) => report.warnings.push(e),
        }
    }
    if report.evidence.is_empty() {
        report.warnings.push("No readable project documents yet. Tell Olympus the intended outcome, or link another source.".into())
    }
    let mut intake = member.intake;
    intake["assessment"] = serde_json::to_value(report).map_err(|e| e.to_string())?;
    intake["inspectedAt"] = serde_json::json!(super::organizer_store::now());
    let db = app.state::<Db>();
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    store::save_intake(&mut c, &id, member.revision, intake)
}
fn validate_local_sources(member: &store::Member) -> Result<(), String> {
    let Some(source) = member.sources.iter().find(|s| s.kind == "folder") else {
        return Ok(());
    };
    let Some(saved) = member.intake.get("assessment") else {
        return Ok(());
    };
    let saved: Assessment = serde_json::from_value(saved.clone())
        .map_err(|_| "Inspect this project's sources again.".to_string())?;
    let current = local(Path::new(&source.location))?;
    let signature = |report: &Assessment| {
        report
            .evidence
            .iter()
            .map(|e| (e.source.clone(), e.fingerprint.clone()))
            .collect::<Vec<_>>()
    };
    if signature(&saved) != signature(&current) {
        return Err("Project documents changed. Inspect sources again before confirming the brief. Your draft is preserved.".into());
    }
    Ok(())
}
pub fn compose_brief(
    before: Option<&str>,
    name: &str,
    id: &str,
    purpose: &str,
    constraints: &str,
) -> Result<String, String> {
    if purpose.trim().is_empty() || purpose.len() > 4000 || constraints.len() > 4000 {
        return Err("Provide a purpose and keep each answer within 4,000 bytes.".into());
    }
    let quote = |s: &str| serde_json::to_string(s).unwrap();
    let vision = format!(
        "vision: {}\nvision_reviewed: \"{}\"",
        quote(purpose.trim()),
        chrono::Utc::now().format("%Y-%m-%d")
    );
    let mut text = if let Some(before) = before {
        if !before.starts_with("---\n") && !before.starts_with("---\r\n") {
            return Err("This note has no supported frontmatter. Review its structure before updating the brief.".into());
        }
        let normalized = before.replace("\r\n", "\n");
        let end = normalized[4..]
            .find("\n---")
            .map(|n| n + 4)
            .ok_or("Project note frontmatter is incomplete.")?;
        let front = &normalized[4..end];
        let parsed: serde_yaml::Mapping = serde_yaml::from_str(front)
            .map_err(|_| "Project note frontmatter could not be read.".to_string())?;
        for key in ["vision", "vision_reviewed"] {
            if parsed.contains_key(serde_yaml::Value::String(key.into()))
                && !front.lines().any(|l| l.starts_with(&format!("{key}:")))
            {
                return Err("The note uses a nonstandard vision field. Review its formatting before updating the brief.".into());
            }
        }
        let mut lines = vec![];
        let mut skip = false;
        let mut found = false;
        for line in front.lines() {
            if line.starts_with("vision_reviewed:") {
                skip = true;
                continue;
            }
            if line.starts_with("vision:") {
                lines.push(vision.clone());
                found = true;
                skip = true;
                continue;
            }
            if skip && (line.starts_with(' ') || line.starts_with('\t') || line.is_empty()) {
                continue;
            }
            skip = false;
            lines.push(line.to_string());
        }
        if !found {
            lines.push(vision)
        }
        format!("---\n{}{}", lines.join("\n"), &normalized[end..])
    } else {
        format!("---\ntitle: {}\ntype: project\nproject_id: {}\nstatus: unclassified\n{}\n---\n\n# {}\n",quote(name),quote(id),vision,name.replace(['\r','\n']," "))
    };
    text.push_str(&format!(
        "\n\n## Project brief confirmed {}\n\n{}\n\nConstraints: {}\n",
        chrono::Utc::now().format("%Y-%m-%d"),
        purpose.trim(),
        if constraints.trim().is_empty() {
            "Not specified."
        } else {
            constraints.trim()
        }
    ));
    Ok(text)
}
#[derive(Clone)]
struct PendingBrief {
    id: String,
    note: String,
    before: Option<String>,
    after: String,
    purpose: String,
    date: String,
}
fn pending_briefs(c: &rusqlite::Connection) -> Result<Vec<PendingBrief>, String> {
    let mut q=c.prepare("SELECT project_id,note_path,before_text,after_text,purpose,reviewed_at FROM project_brief_writes").map_err(|e|e.to_string())?;
    let rows = q
        .query_map([], |r| {
            Ok(PendingBrief {
                id: r.get(0)?,
                note: r.get(1)?,
                before: r.get(2)?,
                after: r.get(3)?,
                purpose: r.get(4)?,
                date: r.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
fn stage_brief(
    c: &rusqlite::Connection,
    id: &str,
    note: &str,
    before: Option<&str>,
    after: &str,
    purpose: &str,
    date: &str,
) -> Result<(), String> {
    if store::owner(c, &format!("note:{note}"))?.is_some_and(|owner| owner != id) {
        return Err("This note belongs to a different project. Link the correct project before confirming a brief.".into());
    }
    c.execute("INSERT INTO project_brief_writes(project_id,note_path,before_text,after_text,purpose,reviewed_at) VALUES(?1,?2,?3,?4,?5,?6)",rusqlite::params![id,note,before,after,purpose,date]).map_err(|e|format!("Could not reserve the reviewed brief. Reload the project before retrying: {e}"))?;
    Ok(())
}
fn bind_brief(
    c: &mut rusqlite::Connection,
    pending: &PendingBrief,
    confirmed: bool,
) -> Result<store::Member, String> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    let mut member = store::get(&tx, &pending.id)?;
    if store::owner(&tx, &format!("note:{}", pending.note))?
        .is_some_and(|owner| owner != pending.id)
    {
        return Err(
            "The saved note is linked to another project; its recovery record was retained.".into(),
        );
    }
    member.project.note_path = Some(pending.note.clone());
    if confirmed {
        member.project.vision = pending.purpose.clone();
        member.project.vision_reviewed_at = Some(pending.date.clone());
    }
    tx.execute(
        "UPDATE project_members SET payload=?2,revision=revision+1 WHERE id=?1",
        rusqlite::params![
            pending.id,
            serde_json::to_string(&member.project).map_err(|e| e.to_string())?
        ],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("INSERT OR IGNORE INTO project_links(source_key,project_id,kind,location) VALUES(?1,?2,'note',?3)",rusqlite::params![format!("note:{}",pending.note),pending.id,pending.note]).map_err(|e|e.to_string())?;
    tx.execute(
        "DELETE FROM project_brief_writes WHERE project_id=?1",
        [&pending.id],
    )
    .map_err(|e| e.to_string())?;
    member = store::get(&tx, &pending.id)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(member)
}
fn publish_brief(
    c: &mut rusqlite::Connection,
    id: &str,
    actual: &str,
) -> Result<Option<store::Member>, String> {
    let Some(pending) = pending_briefs(c)?.into_iter().find(|p| p.id == id) else {
        return Ok(None);
    };
    if pending.after != actual {
        return Err("The saved note changed. Its reviewed write was not republished.".into());
    }
    bind_brief(c, &pending, true).map(Some)
}
/// Finish a previously approved write only if its exact bytes reached disk.
/// No recovery path writes a file or replays an approval.
pub(crate) fn recover_briefs(c: &mut rusqlite::Connection) -> Result<Vec<String>, String> {
    let mut warnings = vec![];
    for pending in pending_briefs(c)? {
        let target = super::vault_write::resolve_vault_path(Path::new(&pending.note))
            .map_err(|e| e.to_string());
        let actual = target.and_then(|p| super::vault_write::read_existing(&p));
        match actual {
            Ok(Some(ref text)) if text == &pending.after => {
                publish_brief(c, &pending.id, text)?;
                super::projects::clear_cache();
            }
            Ok(ref text) if text == &pending.before => {
                c.execute(
                    "DELETE FROM project_brief_writes WHERE project_id=?1",
                    [&pending.id],
                )
                .map_err(|e| e.to_string())?;
            }
            Ok(Some(_)) => {
                bind_brief(c, &pending, false)?;
                warnings.push(format!("{} changed after its brief review. The project link was recovered; review the current note before confirming new intent.",pending.note));
            }
            Ok(None) => {
                bind_brief(c, &pending, false)?;
                warnings.push(format!("{} is missing. Its project link was retained; a new brief requires a fresh review.",pending.note));
            }
            Err(e) => warnings.push(format!("Brief recovery pending for {}: {e}", pending.note)),
        }
    }
    Ok(warnings)
}
#[tauri::command]
pub async fn confirm_project_brief(
    app: AppHandle,
    id: String,
    revision: i64,
) -> Result<bool, String> {
    use super::{vault_write as vw, write_confirm};
    let member = {
        let db = app.state::<Db>();
        let mut c = db.0.lock().map_err(|e| e.to_string())?;
        recover_briefs(&mut c)?;
        store::get(&c, &id)?
    };
    if member.revision != revision || member.visibility != "visible" {
        return Err("The project changed. Reload before confirming its brief.".into());
    }
    validate_local_sources(&member)?;
    let purpose = member.intake["purpose"].as_str().unwrap_or("");
    let constraints = member.intake["constraints"].as_str().unwrap_or("");
    let relative = member
        .project
        .note_path
        .clone()
        .unwrap_or_else(|| format!("01 - Projects/Linked {}.md", member.project.id));
    let target = vw::resolve_vault_path(Path::new(&relative)).map_err(|e| e.to_string())?;
    let before = vw::read_existing(&target)?;
    let after = compose_brief(
        before.as_deref(),
        &member.project.name,
        &id,
        purpose,
        constraints,
    )?;
    let mut summary = vw::summarise_diff(before.as_deref().unwrap_or(""), &after);
    // Include the complete proposed intent; the shared diff sample alone is capped.
    summary
        .preview
        .push(format!("Purpose (complete):\n{purpose}"));
    summary
        .preview
        .push(format!("Constraints (complete):\n{constraints}"));
    if !write_confirm::request_confirmation(
        &app,
        relative.clone(),
        vw::WriteIntent::ModifyAuthored,
        vw::ConfirmReason::IntentRequiresConfirmation,
        summary,
    )
    .await
    {
        return Ok(false);
    }
    let current_target = vw::resolve_vault_path(Path::new(&relative)).map_err(|e| e.to_string())?;
    if current_target != target {
        return Err("Vault moved while the brief was being reviewed.".into());
    }
    let db = app.state::<Db>();
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let current = store::get(&c, &id)?;
    if current.revision != revision || current.visibility != "visible" {
        return Err("The project changed during review. Its brief was not written.".into());
    }
    validate_local_sources(&current)?;
    stage_brief(
        &c,
        &id,
        &relative,
        before.as_deref(),
        &after,
        purpose,
        &chrono::Utc::now().format("%Y-%m-%d").to_string(),
    )?;
    vw::replace_if_unchanged(&target, before.as_deref(), &after)?;
    publish_brief(&mut c,&id,&after).map_err(|e|format!("The brief was saved in {relative}. Its recovery record is retained; reload to finish updating the dashboard: {e}"))?;
    drop(c);
    super::projects::clear_cache();
    // Logged before the commit, which can fail after the file has landed.
    super::persistence::log_vault_write(db.inner(), &relative, "confirm_project_brief");
    super::vault_git::commit_vault_file(&relative, "update").map_err(|error| {
        format!(
            "The brief was written at {relative}, but its automatic Git commit failed: {error}. \
             The file remains in the vault."
        )
    })?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approved_brief_recovers_after_either_registry_statement_fails() {
        for table in ["project_members", "project_links"] {
            let mut c = rusqlite::Connection::open_in_memory().unwrap();
            c.execute_batch(include_str!("../../schema.sql")).unwrap();
            let m = store::add(&mut c, "idea", "", "Example", None).unwrap();
            let id = &m.project.id;
            let note = format!("01 - Projects/Linked {id}.md");
            let after = compose_brief(None, "Example", id, "Confirmed purpose", "Limits").unwrap();
            stage_brief(
                &c,
                id,
                &note,
                None,
                &after,
                "Confirmed purpose",
                "2026-10-11",
            )
            .unwrap();
            let event = if table == "project_members" {
                "UPDATE"
            } else {
                "INSERT"
            };
            c.execute_batch(&format!("CREATE TRIGGER injected BEFORE {event} ON {table} BEGIN SELECT RAISE(FAIL,'injected failure'); END;")).unwrap();
            assert!(publish_brief(&mut c, id, &after).is_err());
            assert_eq!(
                store::owner(&c, &format!("note:{note}"))
                    .unwrap()
                    .as_deref(),
                Some(id.as_str()),
                "Durable receipt keeps note identity after disk succeeds"
            );
            assert!(
                store::get(&c, id).unwrap().project.note_path.is_none(),
                "Registry publication rolls back as one transaction"
            );
            c.execute_batch("DROP TRIGGER injected;").unwrap();
            let recovered = publish_brief(&mut c, id, &after).unwrap().unwrap();
            assert_eq!(recovered.project.vision, "Confirmed purpose");
            assert_eq!(recovered.project.note_path.as_deref(), Some(note.as_str()));
            assert!(
                publish_brief(&mut c, id, &after).unwrap().is_none(),
                "Recovery is idempotent and never appends another brief"
            );
        }
    }
    #[test]
    fn intake_reads_only_allowlisted_small_text() {
        let root = std::env::temp_dir().join(super::super::organizer_store::new_id());
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("README.md"), "# Project\n\nA useful project.").unwrap();
        std::fs::write(root.join(".env"), "SECRET=never-read").unwrap();
        std::fs::write(root.join("package.json"), vec![b'x'; 32769]).unwrap();
        let report = local(&root).unwrap();
        assert_eq!(report.evidence.len(), 1);
        assert!(!serde_json::to_string(&report).unwrap().contains("SECRET"));
        assert!(!report.warnings.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn remote_endpoints_are_fixed_hosts() {
        assert!(remote_endpoint("https://127.0.0.1/org/repo").is_err());
        assert!(remote_endpoint("https://github.com/org/repo/tree/main").is_err());
        let endpoint = remote_endpoint("https://github.com/org/repo.git").unwrap();
        assert_eq!(endpoint, "https://api.github.com/repos/org/repo/readme");
    }
    #[test]
    fn changed_local_sources_require_reinspection() {
        let root = std::env::temp_dir().join(super::super::organizer_store::new_id());
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("README.md"), "Original").unwrap();
        let original = local(&root).unwrap();
        let mut member = store::Member {
            project: store::blank("p", "P"),
            visibility: "visible".into(),
            revision: 0,
            intake: serde_json::json!({"assessment":original}),
            sources: vec![store::Link {
                kind: "folder".into(),
                location: root.to_string_lossy().into(),
            }],
        };
        assert!(validate_local_sources(&member).is_ok());
        std::fs::write(root.join("README.md"), "Updated").unwrap();
        assert!(validate_local_sources(&member).is_err());
        member.intake = serde_json::json!({});
        assert!(validate_local_sources(&member).is_ok());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn brief_update_preserves_unrelated_note_content() {
        let before="---\ntitle: Example\nvision: old\nnext_step: Keep my choice\n---\n\n# Existing\nHuman writing.\n";
        let after =
            compose_brief(Some(before), "Example", "id", "new purpose", "constraint").unwrap();
        assert!(after.contains("next_step: Keep my choice"));
        assert!(after.contains("Human writing."));
        assert!(after.contains("vision: \"new purpose\""));
    }
}
