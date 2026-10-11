//! Durable portfolio membership. Hiding never deletes sources or work history.
use super::projects::TrackedProjectPayload as Project;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
pub type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub kind: String,
    pub location: String,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub project: Project,
    pub visibility: String,
    pub revision: i64,
    pub intake: serde_json::Value,
    pub sources: Vec<Link>,
}
pub fn blank(id: &str, name: &str) -> Project {
    Project {
        id: id.into(),
        name: name.into(),
        path: String::new(),
        status: "unclassified".into(),
        status_source: "inferred".into(),
        promoted: None,
        branch: "N/A".into(),
        last_commit: String::new(),
        last_commit_at: None,
        repo_state: "no-repo".into(),
        recent_commits: vec![],
        since_session_commits: vec![],
        linked_worktrees: vec![],
        summary: String::new(),
        vision: String::new(),
        vision_reviewed_at: None,
        next_step: String::new(),
        note_path: None,
        warnings: vec![],
    }
}
pub fn git_url(raw: &str) -> Result<String> {
    let u = reqwest::Url::parse(raw.trim())
        .map_err(|_| "Enter an HTTPS repository URL.".to_string())?;
    if u.scheme() != "https"
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
        || u.query().is_some()
        || u.fragment().is_some()
        || u.port().is_some()
    {
        return Err(
            "Use an HTTPS repository URL without credentials, ports, query or fragment.".into(),
        );
    }
    let path = u.path().trim_end_matches('/').trim_end_matches(".git");
    if path.split('/').filter(|p| !p.is_empty()).count() < 2 || raw.len() > 2048 {
        return Err("Include the repository owner and name.".into());
    }
    Ok(format!("https://{}{}", u.host_str().unwrap(), path))
}
pub fn path_key(path: &str) -> String {
    let p = std::fs::canonicalize(path).unwrap_or_else(|_| Path::new(path).to_path_buf());
    let s = p
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    format!(
        "folder:{}",
        if cfg!(windows) { s.to_lowercase() } else { s }
    )
}
pub fn folder_key(path: &str) -> String {
    let p = Path::new(path).to_path_buf();
    if let Ok(common) = super::projects::git_command(
        &p,
        &["rev-parse", "--path-format=absolute", "--git-common-dir"],
    ) {
        return format!("git-common:{}", path_key(common.trim()));
    }
    path_key(path)
}
fn keys(p: &Project) -> Vec<(String, Link)> {
    let mut v = vec![];
    if !p.path.is_empty() {
        v.push((
            folder_key(&p.path),
            Link {
                kind: "folder".into(),
                location: p.path.clone(),
            },
        ));
        let key = path_key(&p.path);
        if v[0].0 != key {
            v.push((
                key,
                Link {
                    kind: "folder".into(),
                    location: p.path.clone(),
                },
            ));
        }
    }
    if let Some(note) = &p.note_path {
        v.push((
            format!("note:{note}"),
            Link {
                kind: "note".into(),
                location: note.clone(),
            },
        ));
    }
    if v.is_empty() {
        v.push((
            format!("legacy:{}", p.id),
            Link {
                kind: "legacy".into(),
                location: p.id.clone(),
            },
        ));
    }
    v
}
pub fn list(c: &Connection) -> Result<Vec<Member>> {
    let mut q = c
        .prepare("SELECT payload,visibility,revision,intake,id FROM project_members ORDER BY rowid")
        .map_err(err)?;
    let rows = q
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })
        .map_err(err)?;
    let mut out = vec![];
    for row in rows {
        let (p, visibility, revision, intake, id) = row.map_err(err)?;
        let mut s = c
            .prepare("SELECT kind,location FROM project_links WHERE project_id=?1 ORDER BY rowid")
            .map_err(err)?;
        let sources = s
            .query_map([id], |r| {
                Ok(Link {
                    kind: r.get(0)?,
                    location: r.get(1)?,
                })
            })
            .map_err(err)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(err)?;
        out.push(Member {
            project: serde_json::from_str(&p).map_err(err)?,
            visibility,
            revision,
            intake: serde_json::from_str(&intake).map_err(err)?,
            sources,
        });
    }
    Ok(out)
}
pub fn get(c: &Connection, id: &str) -> Result<Member> {
    list(c)?
        .into_iter()
        .find(|m| m.project.id == id)
        .ok_or("Project no longer available.".into())
}
fn owner(c: &Connection, key: &str) -> Result<Option<String>> {
    c.query_row(
        "SELECT project_id FROM project_links WHERE source_key=?1",
        [key],
        |r| r.get(0),
    )
    .optional()
    .map_err(err)
}
fn insert(c: &Connection, p: &Project, visibility: &str) -> Result<()> {
    c.execute(
        "INSERT INTO project_members(id,visibility,payload) VALUES(?1,?2,?3)",
        params![p.id, visibility, serde_json::to_string(p).map_err(err)?],
    )
    .map_err(err)?;
    Ok(())
}
pub fn reconcile(
    c: &mut Connection,
    projects: Vec<Project>,
    successful_discovery: bool,
) -> Result<Vec<Project>> {
    reconcile_guarded(c, projects, successful_discovery, None)
}
pub fn reconcile_guarded(
    c: &mut Connection,
    projects: Vec<Project>,
    successful_discovery: bool,
    revisions: Option<&std::collections::HashMap<String, i64>>,
) -> Result<Vec<Project>> {
    let tx = c.transaction().map_err(err)?;
    let initialized: bool = tx
        .query_row(
            "SELECT initialized FROM project_membership_state WHERE id=1",
            [],
            |r| r.get(0),
        )
        .map_err(err)?;
    for mut p in projects {
        let aliases = keys(&p);
        let mut existing = None;
        for (key, link) in &aliases {
            if let Some(id) = owner(&tx, key)? {
                let m = get(&tx, &id)?;
                if link.kind != "note" || p.path.is_empty() || m.project.path.is_empty() {
                    existing = Some(id);
                    break;
                }
            }
        }
        if let Some(id) = existing {
            let member = get(&tx, &id)?;
            if revisions.is_some_and(|versions| versions.get(&id) != Some(&member.revision)) {
                continue;
            }
            p.id = id;
            p.name = member.project.name.clone();
            // A note-only observation updates intent without erasing its linked checkout.
            if p.path.is_empty() && !member.project.path.is_empty() {
                let observed = p.clone();
                p = member.project.clone();
                p.vision = observed.vision;
                p.vision_reviewed_at = observed.vision_reviewed_at;
                p.next_step = observed.next_step;
                p.note_path = observed.note_path;
                p.status = observed.status;
                p.status_source = observed.status_source;
                p.promoted = observed.promoted;
            }
            // Confirmed onboarding notes remain linked when raw discovery has no note.
            if p.note_path.is_none() {
                p.note_path = member.project.note_path;
                p.vision = member.project.vision;
                p.vision_reviewed_at = member.project.vision_reviewed_at;
                p.next_step = member.project.next_step;
                p.status = member.project.status;
                p.status_source = member.project.status_source;
                p.promoted = member.project.promoted;
            }
            tx.execute(
                "UPDATE project_members SET payload=?2 WHERE id=?1",
                params![p.id, serde_json::to_string(&p).map_err(err)?],
            )
            .map_err(err)?;
        } else {
            if get(&tx, &p.id).is_ok() {
                p.id = format!("linked-{}", super::organizer_store::new_id());
            }
            insert(&tx, &p, if initialized { "discovered" } else { "visible" })?;
        }
        for (key, source) in aliases {
            tx.execute("INSERT OR IGNORE INTO project_links(source_key,project_id,kind,location) VALUES(?1,?2,?3,?4)",params![key,p.id,source.kind,source.location]).map_err(err)?;
        }
    }
    if successful_discovery {
        tx.execute(
            "UPDATE project_membership_state SET initialized=1 WHERE id=1",
            [],
        )
        .map_err(err)?;
    }
    let out = list(&tx)?
        .into_iter()
        .filter(|m| m.visibility == "visible")
        .map(|m| m.project)
        .collect();
    tx.commit().map_err(err)?;
    Ok(out)
}
pub fn add(
    c: &mut Connection,
    kind: &str,
    location: &str,
    name: &str,
    target: Option<&str>,
) -> Result<Member> {
    let (key, source, default_name) = match kind {
        "folder" => {
            let p = std::fs::canonicalize(location.trim())
                .map_err(|_| "Choose an existing local folder.".to_string())?;
            if !p.is_dir() {
                return Err("Choose a folder, not a file.".into());
            }
            let location = p.to_string_lossy().into_owned();
            (
                folder_key(&location),
                Some(Link {
                    kind: kind.into(),
                    location,
                }),
                p.file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or("Project".into()),
            )
        }
        "git" => {
            let location = git_url(location)?;
            let name = location.rsplit('/').next().unwrap_or("Project").to_string();
            (
                format!("git:{location}"),
                Some(Link {
                    kind: kind.into(),
                    location,
                }),
                name,
            )
        }
        "idea" => (String::new(), None, String::new()),
        _ => return Err("Choose Folder, Git repository or Idea.".into()),
    };
    let name = if name.trim().is_empty() {
        default_name
    } else {
        name.trim().into()
    };
    if name.is_empty() || name.len() > 160 || name.chars().any(char::is_control) {
        return Err("Give the project a name (up to 160 bytes, on one line).".into());
    }
    let tx = c.transaction().map_err(err)?;
    let existing = owner(&tx, &key)?.or(if kind == "folder" {
        owner(&tx, &path_key(&source.as_ref().unwrap().location))?
    } else {
        None
    });
    if let Some(id) = existing {
        if target.is_some_and(|t| t != id) {
            return Err("That source is already linked to another project.".into());
        }
        return get(&tx, &id);
    }
    let id = target
        .map(str::to_string)
        .unwrap_or_else(|| format!("linked-{}", super::organizer_store::new_id()));
    let mut p = if target.is_some() {
        let m = get(&tx, &id)?;
        if m.visibility != "visible" {
            return Err("Restore the project before linking another source.".into());
        }
        m.project
    } else {
        blank(&id, &name)
    };
    if kind == "folder" && p.path.is_empty() {
        p.path = source.as_ref().unwrap().location.clone();
        p.repo_state = "folder-only".into();
    }
    if target.is_none() {
        insert(&tx, &p, "visible")?;
    } else {
        tx.execute(
            "UPDATE project_members SET payload=?2,revision=revision+1 WHERE id=?1",
            params![id, serde_json::to_string(&p).map_err(err)?],
        )
        .map_err(err)?;
    }
    if let Some(source) = source {
        if kind == "folder" {
            tx.execute("INSERT OR IGNORE INTO project_links(source_key,project_id,kind,location) VALUES(?1,?2,?3,?4)",params![path_key(&source.location),id,source.kind,source.location]).map_err(err)?;
        }
        tx.execute("INSERT OR IGNORE INTO project_links(source_key,project_id,kind,location) VALUES(?1,?2,?3,?4)",params![key,id,source.kind,source.location]).map_err(err)?;
    }
    let member = get(&tx, &id)?;
    tx.commit().map_err(err)?;
    Ok(member)
}
pub fn visibility(c: &mut Connection, id: &str, value: &str) -> Result<Member> {
    if !["visible", "removed"].contains(&value) {
        return Err("Invalid project visibility.".into());
    }
    let tx = c.transaction().map_err(err)?;
    get(&tx, id)?;
    if value == "removed" {
        let busy:i64=tx.query_row("SELECT count(*) FROM delegation_runs WHERE project_id=?1 AND phase IN ('approved','preparing','planning','editing','testing','reviewing','waiting','awaiting_review')",[id],|r|r.get(0)).map_err(err)?;
        if busy > 0 {
            return Err("Resolve this project's active work or review before removing it.".into());
        }
    }
    tx.execute(
        "UPDATE project_members SET visibility=?2,revision=revision+1 WHERE id=?1",
        params![id, value],
    )
    .map_err(err)?;
    let m = get(&tx, id)?;
    tx.commit().map_err(err)?;
    Ok(m)
}
pub fn save_intake(
    c: &mut Connection,
    id: &str,
    revision: i64,
    value: serde_json::Value,
) -> Result<Member> {
    let text = serde_json::to_string(&value).map_err(err)?;
    if !value.is_object() || text.len() > 196608 {
        return Err("Project notes exceed the allowed size.".into());
    }
    let n=c.execute("UPDATE project_members SET intake=?3,revision=revision+1 WHERE id=?1 AND revision=?2 AND visibility='visible'",params![id,revision,text]).map_err(err)?;
    if n != 1 {
        return Err("Project changed. Reload its current answers before saving.".into());
    }
    get(c, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c
    }
    #[test]
    fn removal_survives_discovery_and_restore_preserves_identity() {
        let mut c = db();
        let p = blank("legacy", "Example");
        reconcile(&mut c, vec![p.clone()], true).unwrap();
        visibility(&mut c, "legacy", "removed").unwrap();
        assert!(reconcile(&mut c, vec![p], true).unwrap().is_empty());
        visibility(&mut c, "legacy", "visible").unwrap();
        assert_eq!(list(&c).unwrap()[0].project.id, "legacy");
    }
    #[test]
    fn later_discovery_requires_add_even_after_all_removed() {
        let mut c = db();
        reconcile(&mut c, vec![blank("a", "A")], true).unwrap();
        visibility(&mut c, "a", "removed").unwrap();
        let visible = reconcile(&mut c, vec![blank("a", "A"), blank("b", "B")], true).unwrap();
        assert!(visible.is_empty());
        assert_eq!(
            list(&c)
                .unwrap()
                .iter()
                .find(|p| p.project.id == "b")
                .unwrap()
                .visibility,
            "discovered"
        );
    }
    #[test]
    fn duplicate_repository_and_same_name_idea() {
        let mut c = db();
        let a = add(
            &mut c,
            "git",
            "https://github.com/team/repo.git/",
            "Example",
            None,
        )
        .unwrap();
        let b = add(&mut c, "git", "https://github.com/team/repo", "Other", None).unwrap();
        assert_eq!(a.project.id, b.project.id);
        let idea = add(&mut c, "idea", "", "Example", None).unwrap();
        assert_ne!(a.project.id, idea.project.id);
    }
    #[test]
    fn credentials_and_unsafe_urls_rejected() {
        for s in [
            "https://user:secret@github.com/a/b",
            "file:///tmp/repo",
            "javascript:alert(1)",
            "https://github.com/a/b?token=abc",
        ] {
            assert!(git_url(s).is_err(), "{s}");
        }
    }
    #[test]
    fn stale_draft_cannot_overwrite_newer_answers() {
        let mut c = db();
        let p = add(&mut c, "idea", "", "Example", None).unwrap();
        save_intake(
            &mut c,
            &p.project.id,
            0,
            serde_json::json!({"purpose":"First"}),
        )
        .unwrap();
        assert!(save_intake(
            &mut c,
            &p.project.id,
            0,
            serde_json::json!({"purpose":"Stale"})
        )
        .is_err());
    }
    #[test]
    fn folder_identity_survives_git_initialization() {
        let root = std::env::temp_dir().join(super::super::organizer_store::new_id());
        std::fs::create_dir(&root).unwrap();
        let mut c = db();
        let path = root.to_string_lossy();
        let first = add(&mut c, "folder", &path, "Example", None).unwrap();
        super::super::projects::git_command(&root, &["init"]).unwrap();
        let second = add(&mut c, "folder", &path, "Example", None).unwrap();
        assert_eq!(first.project.id, second.project.id);
        assert_eq!(list(&c).unwrap().len(), 1);
        std::fs::remove_dir_all(&root).unwrap();
    }
    #[test]
    fn confirmed_note_scan_keeps_folder_and_identity() {
        let mut c = db();
        let mut original = blank("id", "A");
        original.path = "C:/example".into();
        original.note_path = Some("01 - Projects/A.md".into());
        reconcile(&mut c, vec![original], true).unwrap();
        let mut observed = blank("note-id", "A");
        observed.note_path = Some("01 - Projects/A.md".into());
        observed.vision = "confirmed".into();
        let out = reconcile(&mut c, vec![observed], true).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].id, "id");
        assert_eq!(out[0].path, "C:/example");
        assert_eq!(out[0].vision, "confirmed");
    }
    #[test]
    fn distinct_folders_never_merge_from_shared_name_or_note() {
        let mut c = db();
        let mut a = blank("a", "Same");
        a.path = "C:/a".into();
        a.note_path = Some("01 - Projects/Same.md".into());
        let mut b = a.clone();
        b.id = "b".into();
        b.path = "C:/b".into();
        assert_eq!(reconcile(&mut c, vec![a, b], true).unwrap().len(), 2);
    }
    #[test]
    fn removal_blocks_unreviewed_work_and_retains_history() {
        let mut c = db();
        reconcile(&mut c, vec![blank("a", "A")], true).unwrap();
        c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone,started_at,updated_at) VALUES('run','a','A','Task','test','test','awaiting_review','','','','','','now','now')",[]).unwrap();
        assert!(visibility(&mut c, "a", "removed").is_err());
        c.execute("UPDATE delegation_runs SET phase='completed'", [])
            .unwrap();
        visibility(&mut c, "a", "removed").unwrap();
        assert_eq!(
            c.query_row("SELECT count(*) FROM delegation_runs", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert!(save_intake(&mut c, "a", 0, serde_json::json!({"purpose":"late"})).is_err());
    }
}
