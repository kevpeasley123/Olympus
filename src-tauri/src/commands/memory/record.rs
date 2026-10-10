use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use sha2::{Digest, Sha256};

pub const MAX_FILE_BYTES: usize = 2 * 1024 * 1024;
pub const CHUNK_BYTES: usize = 2_400;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub id: String,
    pub provisional: bool,
    pub schema_version: u32,
    pub kind: String,
    pub title: String,
    pub path: String,
    pub revision: String,
    pub project_refs: Vec<String>,
    pub project_id: Option<String>,
    pub aliases: Vec<String>,
    pub repository: Option<String>,
    pub status: String,
    pub source_date: Option<String>,
    pub observed_at: Option<String>,
    pub recorded_at: Option<String>,
    pub reviewed_at: Option<String>,
    pub source_session: Option<String>,
    pub origin: Option<String>,
    pub supersedes: Vec<String>,
    pub corrects: Vec<String>,
    pub derived_from: Vec<String>,
    #[serde(default)]
    pub source_revisions: std::collections::BTreeMap<String, String>,
    pub historical: bool,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct Chunk {
    pub heading: String,
    pub start: usize,
    pub end: usize,
    pub body: String,
}
pub struct Parsed {
    pub record: Record,
    pub chunks: Vec<Chunk>,
}
pub fn fingerprint(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn string(v: &Value, k: &str) -> Option<String> {
    v.get(k)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(512).collect())
}
fn strings(v: &Value, k: &str) -> Vec<String> {
    match v.get(k) {
        Some(Value::Sequence(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .take(64)
            .map(|s| s.chars().take(512).collect())
            .collect(),
        _ => string(v, k).into_iter().collect(),
    }
}

/// Only curated folders are eligible. Templates, hidden recovery files and
/// inferred profile observations never enter this reader.
pub fn eligible_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    !path
        .split('/')
        .any(|p| p.starts_with('.') || p.starts_with('_'))
        && lower.ends_with(".md")
        && [
            "01 - projects/",
            "02 - research/",
            "04 - decisions/",
            "08 - daily briefs/sessions/",
            "09 - system/history/",
        ]
        .iter()
        .any(|p| lower.starts_with(p))
}

pub fn parse(path: &str, raw: &[u8]) -> Result<Option<Parsed>, String> {
    if !eligible_path(path) {
        return Ok(None);
    }
    if raw.len() > MAX_FILE_BYTES {
        return Err("document exceeds 2 MiB indexing limit".into());
    }
    let text = std::str::from_utf8(raw).map_err(|_| "document is not UTF-8")?;
    let Some((front, body)) = super::super::pantheon::split_frontmatter(text) else {
        // A legacy Decision Log is useful even without frontmatter.
        if path == "04 - Decisions/Decision Log.md" {
            return parse_legacy_log(path, raw, text);
        }
        return Err("missing frontmatter; source preserved, not indexed".into());
    };
    if front.len() > 32_768 {
        return Err("frontmatter exceeds 32 KiB".into());
    }
    let yaml: Value = serde_yaml::from_str(front).map_err(|_| "malformed frontmatter")?;
    let version = match yaml.get("schema_version") {
        None => 0,
        Some(v) => v
            .as_u64()
            .filter(|n| *n == 1)
            .ok_or("unsupported schema_version")? as u32,
    };
    let kind = string(&yaml, "type").unwrap_or_default();
    let tags = strings(&yaml, "tags");
    if kind == "template"
        || yaml.get("test_fixture").and_then(Value::as_bool) == Some(true)
        || yaml.get("memory_exclude").and_then(Value::as_bool) == Some(true)
        || tags
            .iter()
            .any(|t| t.contains("/test") || t.contains("/template"))
    {
        return Ok(None);
    }
    let kind = if path.starts_with("01 - Projects/") && kind == "project" {
        "project"
    } else if path.starts_with("02 - Research/") && tags.iter().any(|t| t == "olympus/research") {
        "research"
    } else if path.starts_with("04 - Decisions/") {
        "decision"
    } else if path.starts_with("08 - Daily Briefs/Sessions/") && kind == "session-record" {
        "session"
    } else if path.starts_with("08 - Daily Briefs/Sessions/") && kind == "reconciliation-record" {
        "reconciliation"
    } else if path.starts_with("09 - System/History/") || kind == "project-reference" {
        "history"
    } else {
        return Ok(None);
    };
    let name = path
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .trim_end_matches(".md");
    let id = string(&yaml, "record_id");
    if version == 1 && id.is_none() {
        return Err("v1 record requires record_id".into());
    }
    let mut warnings = Vec::new();
    if version == 0 {
        warnings.push("legacy metadata; missing values remain unknown".into());
    }
    if id.is_none() {
        warnings.push("provisional path identity; rename continuity unconfirmed".into());
    }
    let mut refs = strings(&yaml, "project_ids");
    refs.extend(strings(&yaml, "project"));
    if kind != "project" {
        refs.extend(strings(&yaml, "project_id"));
    }
    refs.sort();
    refs.dedup();
    let mut aliases = strings(&yaml, "aliases");
    aliases.push(name.to_string());
    let title = string(&yaml, "title").unwrap_or_else(|| name.to_string());
    aliases.push(title.clone());
    let project_id = if kind == "project" {
        Some(string(&yaml, "project_id").unwrap_or_else(|| format!("legacy-project:{path}")))
    } else {
        None
    };
    if let Some(p) = &project_id {
        aliases.push(p.clone());
        refs.push(p.clone());
    }
    let status = string(&yaml, "decision_status")
        .or_else(|| string(&yaml, "status"))
        .or_else(|| string(&yaml, "stance"))
        .unwrap_or_else(|| "unconfirmed".into());
    let record = Record {
        id: id.clone().unwrap_or_else(|| format!("legacy:{path}")),
        provisional: id.is_none(),
        schema_version: version,
        kind: kind.into(),
        title,
        path: path.into(),
        revision: fingerprint(raw),
        project_refs: refs,
        project_id,
        aliases,
        repository: string(&yaml, "repository"),
        status,
        source_date: string(&yaml, "source_date"),
        observed_at: string(&yaml, "observed_at"),
        recorded_at: string(&yaml, "recorded_at").or_else(|| string(&yaml, "created")),
        reviewed_at: string(&yaml, "reviewed"),
        source_session: string(&yaml, "session_id").or_else(|| string(&yaml, "source_session")),
        origin: string(&yaml, "author").or_else(|| string(&yaml, "origin")),
        supersedes: strings(&yaml, "supersedes"),
        corrects: strings(&yaml, "corrects"),
        derived_from: strings(&yaml, "derived_from"),
        source_revisions: yaml
            .get("source_revisions")
            .and_then(Value::as_mapping)
            .map(|m| {
                m.iter()
                    .take(64)
                    .filter_map(|(k, v)| {
                        Some((
                            k.as_str()?.chars().take(512).collect(),
                            v.as_str()?.chars().take(128).collect(),
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default(),
        historical: kind == "history",
        warnings,
    };
    let offset = text.len() - body.len();
    Ok(Some(Parsed {
        record,
        chunks: chunks(body, offset),
    }))
}

fn parse_legacy_log(path: &str, raw: &[u8], text: &str) -> Result<Option<Parsed>, String> {
    Ok(Some(Parsed {
        record: Record {
            id: format!("legacy:{path}"),
            provisional: true,
            kind: "decision".into(),
            title: "Decision Log".into(),
            path: path.into(),
            revision: fingerprint(raw),
            status: "unconfirmed".into(),
            warnings: vec!["legacy mixed-project history; project scope unconfirmed".into()],
            ..Record::default()
        },
        chunks: chunks(text, 0),
    }))
}

fn floor_boundary(s: &str, mut n: usize) -> usize {
    while !s.is_char_boundary(n) {
        n -= 1;
    }
    n
}
pub fn chunks(body: &str, base: usize) -> Vec<Chunk> {
    let mut out = Vec::new();
    let mut heading = String::new();
    let mut start = 0;
    while start < body.len() {
        let remaining = &body[start..];
        if remaining.starts_with('#') {
            heading = remaining
                .lines()
                .next()
                .unwrap_or_default()
                .chars()
                .take(240)
                .collect();
        }
        let limit = floor_boundary(remaining, remaining.len().min(CHUNK_BYTES));
        let window = &remaining[..limit];
        // Keep headings and paragraph boundaries where possible; huge paragraphs
        // still have a hard UTF-8-safe bound and exact source offsets.
        let boundary = window
            .get(1..)
            .and_then(|s| s.find("\n#").map(|n| n + 2))
            .or_else(|| {
                window
                    .rfind("\n\n")
                    .filter(|n| *n > limit / 2)
                    .map(|n| n + 2)
            });
        let length = boundary.unwrap_or(limit).max(1);
        let end = start + length;
        if body[start..end]
            .lines()
            .any(|line| !line.trim().is_empty() && !line.trim_start().starts_with('#'))
        {
            out.push(Chunk {
                heading: heading.clone(),
                start: base + start,
                end: base + end,
                body: body[start..end].into(),
            });
        }
        start = end;
    }
    out
}
