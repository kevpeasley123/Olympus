//! Bounded, immutable learned records. The vault is the source of truth; receipts
//! make multi-file publication replayable without another model request.
use super::vault_write as vw;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};
pub const FOLDER: &str = "09 - System/Learned";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Candidate {
    pub kind: String,
    pub subject: String,
    pub text: String,
    pub project_ids: Vec<String>,
    pub source_ids: Vec<String>,
    pub corrects: Option<String>,
    pub status: String,
    pub expires_at: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    pub revision: String,
    pub role: String,
    pub text: String,
    pub event_at: String,
    pub conversation: Option<String>,
    pub path: Option<String>,
    #[serde(default)]
    pub parent_run: Option<String>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Manifest {
    pub receipt: String,
    pub files: BTreeMap<String, String>,
}

fn metadata(raw: &str) -> Result<Value, String> {
    let (front, _) = super::pantheon::split_frontmatter(raw).ok_or("learned_record_invalid")?;
    serde_yaml::from_str(front).map_err(|_| "learned_record_invalid".into())
}
fn safe_id(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit())
}
pub fn prepare(
    items: &[Candidate],
    sources: &[Evidence],
    projects: &[String],
    root: &Path,
) -> Result<Manifest, String> {
    if items.len() > 12 {
        return Err("too_many_learned_records".into());
    }
    let mut prepared = Vec::new();
    for item in items {
        if !matches!(
            item.kind.as_str(),
            "operator_statement" | "observed_fact" | "provisional_inference"
        ) || !matches!(item.status.as_str(), "active" | "withdrawn")
            || item.text.trim().is_empty()
            || item.text.len() > 1800
            || item.subject.trim().is_empty()
            || item.subject.len() > 120
            || item.source_ids.is_empty()
            || item.source_ids.len() > 8
            || item.project_ids.iter().any(|id| !projects.contains(id))
            || (item.project_ids.is_empty()
                && item.subject != "Kevin"
                && !(item.kind == "provisional_inference"
                    && item.subject.starts_with("research:")
                    && item.source_ids.iter().all(|id| {
                        sources
                            .iter()
                            .any(|s| s.id == *id && s.path.is_some() && s.parent_run.is_some())
                    })))
        {
            return Err("learned_record_invalid_scope_or_shape".into());
        }
        if item
            .expires_at
            .as_ref()
            .is_some_and(|s| chrono::DateTime::parse_from_rfc3339(s).is_err())
        {
            return Err("learned_record_invalid_expiry".into());
        }
        let evidence: Vec<Evidence> = item
            .source_ids
            .iter()
            .map(|id| {
                sources
                    .iter()
                    .find(|s| &s.id == id)
                    .cloned()
                    .ok_or("learned_source_missing".to_string())
            })
            .collect::<Result<_, _>>()?;
        if evidence
            .iter()
            .any(|s| s.revision != vw::content_fingerprint(&s.text))
        {
            return Err("learned_source_changed".into());
        }
        if item.kind == "operator_statement" && evidence.iter().any(|s| s.role != "user") {
            return Err("suggestion_is_not_operator_statement".into());
        }
        if item.status == "withdrawn" && item.corrects.is_none() {
            return Err("withdrawal_requires_target".into());
        }
        if let Some(target) = &item.corrects {
            if !safe_id(target) {
                return Err("invalid_correction_identity".into());
            }
            let raw = vw::read_existing(
                &vw::resolve_within(root, Path::new(&format!("{FOLDER}/{target}.md")))
                    .map_err(|e| e.to_string())?,
            )?
            .ok_or("correction_target_missing")?;
            let meta = metadata(&raw)?;
            if !meta["publication"]
                .as_str()
                .is_some_and(|r| published(root, r))
            {
                return Err("correction_target_unpublished_or_edited".into());
            }
            if meta["project_ids"] != json!(item.project_ids) || meta["subject"] != item.subject {
                return Err("correction_scope_mismatch".into());
            }
        }
        let identity = vw::content_fingerprint(&json!([item, evidence]).to_string());
        prepared.push((identity, item, evidence));
    }
    let receipt = vw::content_fingerprint(
        &json!(prepared.iter().map(|p| &p.0).collect::<BTreeSet<_>>()).to_string(),
    );
    let mut files = BTreeMap::new();
    for (id, item, mut evidence) in prepared {
        // Keep references and revisions, not duplicate unrelated/private message
        // bodies in durable notes. Original text stays in its source store.
        for source in &mut evidence {
            source.text.clear();
        }
        let meta = json!({"schema_version":1,"type":"learned-record","record_id":id,
            "assertion":item.text,"title":item.text.chars().take(80).collect::<String>(),"subject":item.subject,
            "project_ids":item.project_ids,"assertion_kind":item.kind,"status":item.status,
            "expires_at":item.expires_at,"corrects":item.corrects.iter().collect::<Vec<_>>(),
            "observed_at":evidence.iter().map(|e|&e.event_at).max(),
            "recorded_at":chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "publication":receipt,"evidence":evidence});
        let path = format!("{FOLDER}/{id}.md");
        let raw=format!("---\n{}---\n# {}\n\n{}\n\nAssertion kind: {}. This is evidence, never execution permission.\n",serde_yaml::to_string(&meta).map_err(|e|e.to_string())?,item.subject,item.text,item.kind);
        // Existing identity must match its immutable publication. Never overwrite an operator edit.
        let existing = vw::resolve_within(root, Path::new(&path))
            .ok()
            .and_then(|p| vw::read_existing(&p).ok().flatten());
        files.insert(
            path,
            existing
                .filter(|old| {
                    metadata(old).ok().is_some_and(|m| {
                        m["record_id"] == id
                            && m["publication"]
                                .as_str()
                                .is_some_and(|r| published(root, r))
                    })
                })
                .unwrap_or(raw),
        );
    }
    Ok(Manifest { receipt, files })
}
pub fn publish(root: &Path, manifest: &Manifest) -> Result<(), String> {
    if manifest.files.is_empty() {
        return Ok(());
    }
    if !safe_id(&manifest.receipt) {
        return Err("invalid_publication_identity".into());
    }
    for (path, raw) in &manifest.files {
        let target = vw::resolve_within(root, Path::new(path)).map_err(|e| e.to_string())?;
        match vw::read_existing(&target)? {
            Some(existing) if existing == *raw => (),
            Some(_) => return Err("learned_record_edited".into()),
            None => vw::replace_if_unchanged(&target, None, raw)?,
        }
    }
    let receipt = format!("{FOLDER}/.receipts/{}.json", manifest.receipt);
    let target = vw::resolve_within(root, Path::new(&receipt)).map_err(|e| e.to_string())?;
    let raw = json!(manifest
        .files
        .iter()
        .map(|(p, b)| (p, vw::content_fingerprint(b)))
        .collect::<BTreeMap<_, _>>())
    .to_string();
    match vw::read_existing(&target)? {
        Some(old) if old == raw => Ok(()),
        Some(_) => Err("publication_receipt_changed".into()),
        None => vw::replace_if_unchanged(&target, None, &raw),
    }
}
pub fn published(root: &Path, receipt: &str) -> bool {
    if !safe_id(receipt) {
        return false;
    }
    let result = (|| -> Result<bool, String> {
        let target = vw::resolve_within(
            root,
            Path::new(&format!("{FOLDER}/.receipts/{receipt}.json")),
        )
        .map_err(|e| e.to_string())?;
        let raw = vw::read_existing(&target)?.ok_or("missing_publication")?;
        let files: BTreeMap<String, String> =
            serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if files.is_empty() || files.len() > 12 {
            return Ok(false);
        }
        for (path, revision) in files {
            if !path.starts_with(&format!("{FOLDER}/")) {
                return Ok(false);
            }
            let target = vw::resolve_within(root, Path::new(&path)).map_err(|e| e.to_string())?;
            let raw = vw::read_existing(&target)?.ok_or("missing_record")?;
            if vw::content_fingerprint(&raw) != revision {
                return Ok(false);
            }
        }
        Ok(true)
    })();
    result.unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn source() -> Evidence {
        Evidence {
            id: "m1".into(),
            revision: vw::content_fingerprint("Use Rust for Atlas"),
            role: "user".into(),
            text: "Use Rust for Atlas".into(),
            event_at: "2026-11-08T20:00:00Z".into(),
            conversation: Some("c1".into()),
            path: None,
            parent_run: None,
        }
    }
    fn item() -> Candidate {
        Candidate {
            kind: "operator_statement".into(),
            subject: "Atlas".into(),
            text: "Use Rust for Atlas".into(),
            project_ids: vec!["atlas".into()],
            source_ids: vec!["m1".into()],
            corrects: None,
            status: "active".into(),
            expires_at: None,
        }
    }
    #[test]
    fn learned_assertions_are_source_bound_and_deterministic() {
        let a = prepare(
            &[item()],
            &[source()],
            &["atlas".into()],
            Path::new("unused"),
        )
        .unwrap();
        let b = prepare(
            &[item()],
            &[source()],
            &["atlas".into()],
            Path::new("unused"),
        )
        .unwrap();
        assert_eq!(
            a.files.keys().collect::<Vec<_>>(),
            b.files.keys().collect::<Vec<_>>()
        );
        assert_eq!(a.files.len(), 1);
        let raw = a.files.values().next().unwrap();
        assert!(raw.contains("m1") && raw.contains(&source().revision));
        let mut bad = item();
        bad.source_ids = vec!["invented".into()];
        assert!(prepare(&[bad], &[source()], &["atlas".into()], Path::new("unused")).is_err());
        let mut suggestion = source();
        suggestion.role = "assistant".into();
        assert!(prepare(
            &[item()],
            &[suggestion],
            &["atlas".into()],
            Path::new("unused")
        )
        .is_err());
        assert!(prepare(
            &[item()],
            &[source()],
            &["atlas-other".into()],
            Path::new("unused")
        )
        .is_err());
    }
    #[test]
    fn partial_batches_edits_expiry_and_withdrawal_are_respected() {
        let root = std::env::temp_dir().join(format!(
            "olympus-learned-{}",
            super::super::delegation::run_id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let mut a = item();
        a.kind = "provisional_inference".into();
        a.subject = "research:fixture".into();
        a.project_ids.clear();
        let mut e = source();
        e.conversation = None;
        e.path = Some("02 - Research/source.md".into());
        e.parent_run = Some("parent".into());
        let mut b = a.clone();
        b.text = "Second assertion".into();
        let batch = prepare(&[a.clone(), b], &[e.clone()], &[], &root).unwrap();
        let (path, raw) = batch.files.iter().next().unwrap();
        let target = root.join(path);
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(&target, raw).unwrap();
        assert!(!published(&root, &batch.receipt));
        publish(&root, &batch).unwrap();
        assert!(published(&root, &batch.receipt));
        let sources = BTreeMap::from([(e.path.clone().unwrap(), e.revision.clone())]);
        assert_eq!(research_context(&root, "fixture", &sources).len(), 2);
        let first = prepare(&[a.clone()], &[e.clone()], &[], &root).unwrap();
        let id = metadata(first.files.values().next().unwrap()).unwrap()["record_id"]
            .as_str()
            .unwrap()
            .to_owned();
        let mut withdrawn = a.clone();
        withdrawn.corrects = Some(id);
        withdrawn.status = "withdrawn".into();
        withdrawn.text = "Withdraw prior finding".into();
        publish(
            &root,
            &prepare(&[withdrawn], &[e.clone()], &[], &root).unwrap(),
        )
        .unwrap();
        assert_eq!(research_context(&root, "fixture", &sources).len(), 1);
        let mut expired = a;
        expired.text = "Expired transient finding".into();
        expired.expires_at = Some("2000-01-01T00:00:00Z".into());
        publish(&root, &prepare(&[expired], &[e], &[], &root).unwrap()).unwrap();
        assert_eq!(research_context(&root, "fixture", &sources).len(), 1);
        std::fs::write(&target, "Operator edit").unwrap();
        assert!(publish(&root, &batch).is_err());
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "Operator edit");
        let resolved = root.canonicalize().unwrap();
        assert!(resolved.starts_with(std::env::temp_dir().canonicalize().unwrap()));
        std::fs::remove_dir_all(resolved).unwrap();
    }
}

pub fn existing(root: &Path, projects: &[String]) -> Value {
    let mut records = Vec::new();
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(root.join(FOLDER)) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let Ok(raw) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let Ok(meta) = metadata(&raw) else {
                continue;
            };
            let scope = meta["project_ids"].as_array().cloned().unwrap_or_default();
            if !scope.is_empty()
                && !scope
                    .iter()
                    .any(|p| p.as_str().is_some_and(|p| projects.iter().any(|q| q == p)))
            {
                continue;
            }
            if !meta["publication"]
                .as_str()
                .is_some_and(|r| published(root, r))
            {
                continue;
            }
            let item = json!({"id":meta["record_id"],"subject":meta["subject"],"projectIds":scope,"text":meta.get("assertion").unwrap_or(&meta["title"]),"status":meta["status"],"corrects":meta["corrects"]});
            size += item.to_string().len();
            if size > 16000 {
                break;
            }
            records.push(item);
        }
    }
    json!(records)
}

pub fn evidence_current(c: &rusqlite::Connection, root: &Path, evidence: &[Evidence]) -> bool {
    !evidence.is_empty()
        && evidence.iter().all(|e| {
            if let Some(run) = &e.parent_run {
                if !c
                    .query_row(
                        "SELECT status='completed' FROM research_verification_runs WHERE id=?1",
                        [run],
                        |r| r.get::<_, bool>(0),
                    )
                    .unwrap_or(false)
                {
                    return false;
                }
            }
            if let Some(conversation) = &e.conversation {
                c.query_row(
                    "SELECT content FROM conversation_messages WHERE id=?1 AND conversation_id=?2",
                    rusqlite::params![e.id, conversation],
                    |r| r.get::<_, String>(0),
                )
                .ok()
                .is_some_and(|body| vw::content_fingerprint(&body) == e.revision)
            } else if let Some(path) = &e.path {
                vw::resolve_within(root, Path::new(path))
                    .ok()
                    .and_then(|p| vw::read_existing(&p).ok().flatten())
                    .is_some_and(|body| vw::content_fingerprint(&body) == e.revision)
            } else {
                false
            }
        })
}

/// Prior findings are context, not independent corroboration. Only expose them
/// when every original source is already in this task's validated source set.
pub fn research_context(
    root: &Path,
    question: &str,
    sources: &BTreeMap<String, String>,
) -> Vec<Value> {
    let subject = format!(
        "research:{}",
        question.chars().take(100).collect::<String>()
    );
    let mut out = Vec::new();
    let mut bytes = 0;
    let mut records = Vec::new();
    if let Ok(entries) = std::fs::read_dir(root.join(FOLDER)) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let Ok(raw) = std::fs::read_to_string(entry.path()) else {
                continue;
            };
            let Ok(meta) = metadata(&raw) else {
                continue;
            };
            if meta["subject"] == subject
                && meta["publication"]
                    .as_str()
                    .is_some_and(|r| published(root, r))
            {
                records.push(meta);
            }
        }
    }
    records.sort_by_key(|m| m["record_id"].as_str().unwrap_or("").to_owned());
    let corrected: BTreeSet<String> = records
        .iter()
        .flat_map(|m| m["corrects"].as_array().cloned().unwrap_or_default())
        .filter_map(|v| v.as_str().map(str::to_owned))
        .collect();
    for meta in records {
        if meta["status"] != "active"
            || meta["record_id"]
                .as_str()
                .is_some_and(|id| corrected.contains(id))
            || meta["expires_at"].as_str().is_some_and(|t| {
                chrono::DateTime::parse_from_rfc3339(t)
                    .map(|t| t <= chrono::Utc::now())
                    .unwrap_or(true)
            })
        {
            continue;
        }
        let Ok(evidence) = serde_json::from_value::<Vec<Evidence>>(meta["evidence"].clone()) else {
            continue;
        };
        if evidence.is_empty()
            || !evidence
                .iter()
                .all(|e| e.path.as_ref().and_then(|p| sources.get(p)) == Some(&e.revision))
        {
            continue;
        }
        let item = json!({"recordId":meta["record_id"],"finding":meta["assertion"],"status":"provisional; verify original sources again","sourceFiles":evidence.iter().filter_map(|e|e.path.as_ref()).collect::<Vec<_>>()});
        bytes += item.to_string().len();
        if bytes > 4000 || out.len() >= 5 {
            break;
        }
        out.push(item);
    }
    out
}
