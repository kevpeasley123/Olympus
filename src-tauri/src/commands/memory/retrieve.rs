use super::{
    index,
    record::{self, Record},
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeSet, HashSet},
    path::Path,
};

pub const POLICY: &str = "curated-memory/v1";
pub const MAX_PACKET_BYTES: usize = 24_000;
pub const MAX_PASSAGES: usize = 8;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub question: String,
    pub active_project: Option<String>,
    #[serde(default)]
    pub recent_questions: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub record: Record,
    pub heading: String,
    pub start: usize,
    pub end: usize,
    pub excerpt: String,
    pub reason: String,
    pub truncated: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Packet {
    pub policy: String,
    pub status: String,
    pub scope: Vec<String>,
    pub generation: u64,
    pub indexed_at: Option<String>,
    pub sources: Vec<Source>,
    pub warnings: Vec<String>,
    pub truncated: bool,
    pub byte_limit: usize,
}
impl Packet {
    pub fn unavailable(reason: &str) -> Self {
        Self {
            policy: POLICY.into(),
            status: "unavailable".into(),
            warnings: vec![reason.into()],
            byte_limit: MAX_PACKET_BYTES,
            ..Self::default()
        }
    }
    pub fn json(&self) -> String {
        serde_json::to_string(self).expect("memory packet serializes")
    }
}

fn bound_warnings(packet: &mut Packet) {
    packet.warnings.sort();
    packet.warnings.dedup();
    let mut warning_bytes = 0;
    let mut omitted = false;
    packet.warnings = std::mem::take(&mut packet.warnings)
        .into_iter()
        .filter_map(|mut warning| {
            let mut end = warning.len().min(256);
            while !warning.is_char_boundary(end) {
                end -= 1;
            }
            if end < warning.len() {
                warning.truncate(end);
                warning.push('…');
            }
            let bytes = serde_json::to_string(&warning).unwrap().len();
            if warning_bytes + bytes > 1800 {
                omitted = true;
                None
            } else {
                warning_bytes += bytes;
                Some(warning)
            }
        })
        .collect();
    if omitted {
        packet
            .warnings
            .push("Additional diagnostics omitted; inspect memory status for coverage.".into());
    }
}

fn finish(mut packet: Packet, mut bundle_boundaries: Vec<usize>) -> Packet {
    bound_warnings(&mut packet);
    if packet.sources.is_empty() && packet.status == "ready" {
        packet.status = "no_match".into();
    }
    if packet.truncated {
        packet.warnings.push(
            "Evidence budget or traversal limit reached; this is not exhaustive recall".into(),
        );
    }
    while packet.json().len() > MAX_PACKET_BYTES && !packet.sources.is_empty() {
        packet
            .sources
            .truncate(bundle_boundaries.pop().unwrap_or(0));
        packet.truncated = true;
    }
    packet
}
fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
        .filter(|s| !s.is_empty())
        .take(128)
        .map(str::to_lowercase)
        .collect()
}
fn search_terms(text: &str) -> String {
    const STOP: &[&str] = &[
        "the", "and", "for", "with", "this", "that", "from", "what", "when", "where", "why", "how",
        "should", "could", "would", "about", "have", "does", "your", "you", "our", "are", "can",
        "will", "please", "tell", "more", "did", "we", "off", "left", "current", "latest",
        "project", "projects", "olympus",
    ];
    words(text)
        .into_iter()
        .filter(|w| w.len() > 2 && !STOP.contains(&w.as_str()))
        .take(24)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .map(|w| format!("\"{}\"", w.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn resolve(c: &Connection, aliases: &[String]) -> rusqlite::Result<(Vec<String>, bool)> {
    let mut stmt = c.prepare("SELECT alias,MIN(project_id),COUNT(DISTINCT project_id) FROM aliases WHERE alias IN (SELECT value FROM json_each(?1)) GROUP BY alias")?;
    let rows = stmt.query_map([serde_json::to_string(aliases).unwrap()], |r| {
        Ok((r.get::<_, String>(1)?, r.get::<_, u64>(2)?))
    })?;
    let mut ids = BTreeSet::new();
    let mut ambiguous = false;
    for row in rows {
        let (id, count) = row?;
        if count == 1 {
            ids.insert(id);
        } else {
            ambiguous = true;
        }
    }
    Ok((ids.into_iter().collect(), ambiguous))
}
fn mentions(c: &Connection, text: &str) -> rusqlite::Result<(Vec<String>, bool)> {
    let tokens = words(text);
    let mut phrases = Vec::new();
    for start in 0..tokens.len() {
        for size in 1..=6 {
            if start + size <= tokens.len() {
                phrases.push(tokens[start..start + size].join(" "));
            }
        }
    }
    resolve(c, &phrases)
}
fn row_source(row: &rusqlite::Row<'_>) -> rusqlite::Result<Source> {
    let raw: String = row.get(0)?;
    let record: Record = serde_json::from_str(&raw).map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(Source {
        record,
        heading: row.get(1)?,
        excerpt: row.get(2)?,
        start: row.get(3)?,
        end: row.get(4)?,
        reason: String::new(),
        truncated: true,
    })
}

const FIELDS: &str = "d.json,c.heading,c.body,c.start,c.end";
fn first_chunk(c: &Connection, path: &str, reason: &str) -> rusqlite::Result<Option<Source>> {
    let sql=format!("SELECT {FIELDS} FROM chunks c JOIN documents d ON d.path=c.path WHERE d.path=?1 AND d.valid=1 ORDER BY CASE WHEN d.kind='project' AND (c.heading LIKE '%current state%' OR c.heading LIKE '%current implementation%' OR c.heading LIKE '%verified%') THEN 0 ELSE 1 END,c.start LIMIT 1");
    use rusqlite::OptionalExtension;
    let mut source = c.query_row(&sql, [path], row_source).optional()?;
    if let Some(s) = &mut source {
        s.reason = reason.into();
    }
    Ok(source)
}

fn correction_chunks(c: &Connection, path: &str) -> rusqlite::Result<Vec<Source>> {
    // A reversal may explain itself after background/provenance sections. Do
    // not imply it was inspected when only its opening paragraph fits.
    let sql=format!("SELECT {FIELDS} FROM chunks c JOIN documents d ON d.path=c.path WHERE d.path=?1 AND d.valid=1 ORDER BY c.start LIMIT 9");
    let mut sources: Vec<Source> = c
        .prepare(&sql)?
        .query_map([path], row_source)?
        .collect::<Result<_, _>>()?;
    for source in &mut sources {
        source.reason =
            "explicit correction/supersession relationship; examine both records".into();
    }
    Ok(sources)
}

pub fn retrieve(c: &Connection, vault: &Path, query: &Query) -> Result<Packet, String> {
    // One committed generation supplies all candidates and relationship reads.
    let tx = c.unchecked_transaction().map_err(|e| e.to_string())?;
    let result = retrieve_snapshot(&tx, vault, query).map_err(|e| e.to_string());
    tx.commit().map_err(|e| e.to_string())?;
    result
}
fn retrieve_snapshot(c: &Connection, vault: &Path, query: &Query) -> rusqlite::Result<Packet> {
    let status = index::status(c).map_err(|_| rusqlite::Error::InvalidQuery)?;
    let mut packet = Packet {
        policy: POLICY.into(),
        status: status.state.clone(),
        generation: status.generation,
        indexed_at: status.indexed_at,
        warnings: status.warnings,
        byte_limit: MAX_PACKET_BYTES,
        ..Packet::default()
    };
    bound_warnings(&mut packet);
    if status.generation == 0 {
        packet.status = "indexing".into();
        return Ok(finish(packet, vec![]));
    }
    let question = record::key(&query.question);
    let portfolio = [
        "all projects",
        "across projects",
        "my projects",
        "portfolio",
    ]
    .iter()
    .any(|s| question.contains(s));
    let historical = [
        "histor", "previous", "used to", "original", "why", "changed", "decision",
    ]
    .iter()
    .any(|s| question.contains(s));
    let recall = [
        "left off",
        "leave off",
        "where were we",
        "where are we",
        "resume",
        "continue",
        "remember",
        "decid",
        "next",
        "status",
        "stand",
        "progress",
        "changed",
        "working on",
        "current",
        "latest",
    ]
    .iter()
    .any(|s| question.contains(s));
    let (mut scope, mut ambiguous) = mentions(c, &question)?;
    if scope.is_empty() && !ambiguous && !portfolio {
        if let Some(active) = &query.active_project {
            let found = resolve(c, &[record::key(active)])?;
            scope = found.0;
            ambiguous = found.1;
        }
        if scope.is_empty() && !ambiguous {
            for previous in query.recent_questions.iter().rev().take(4) {
                let found = mentions(c, previous)?;
                if !found.0.is_empty() || found.1 {
                    scope = found.0;
                    ambiguous = found.1;
                    break;
                }
            }
        }
    }
    if ambiguous {
        packet.status = "ambiguous_scope".into();
        packet.warnings.push("Several projects share this name; clarify project identity before using project evidence".into());
        return Ok(finish(packet, vec![]));
    }
    if scope.len() > 8 {
        scope.truncate(8);
        packet.truncated = true;
        packet
            .warnings
            .push("Project scope limited to eight projects".into());
    }
    packet.scope = scope.clone();
    if scope.is_empty() && recall && !portfolio {
        packet.status = "scope_required".into();
        packet.warnings.push(
            "No project was established for this resumption question; ask which project".into(),
        );
        return Ok(finish(packet, vec![]));
    }
    let scope_json = serde_json::to_string(&scope).unwrap();
    let allowed="(d.kind='research' OR (?2=1 AND d.kind='project') OR EXISTS(SELECT 1 FROM bindings b WHERE b.path=d.path AND b.project_id IN (SELECT value FROM json_each(?1))))";
    let mut candidates = Vec::new();
    // Summaries are context, not exclusive truth. Reserve room for unreconciled
    // sessions and decisions, even when a recent summary exists.
    if !scope.is_empty() || portfolio {
        let sql=format!("SELECT d.path FROM documents d WHERE valid=1 AND kind='project' AND {allowed} ORDER BY path LIMIT 9");
        let paths: Vec<String> = c
            .prepare(&sql)?
            .query_map(params![scope_json, portfolio as i32], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        if paths.len() > 4 {
            packet.truncated = true;
            packet.warnings.push("Only four project summaries fit this evidence packet; portfolio coverage is partial".into());
        }
        for path in paths.into_iter().take(4) {
            if let Some(s) =
                first_chunk(c, &path, "project summary; may omit unreconciled sessions")?
            {
                if s.record.source_revisions.is_empty() {
                    packet.warnings.push(format!(
                        "{} has no source-revision coverage; session incorporation is unconfirmed",
                        s.record.title
                    ));
                }
                for (id, revision) in &s.record.source_revisions {
                    let matches:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM documents WHERE id=?1 AND revision=?2 AND valid=1)",params![id,revision],|r|r.get(0))?;
                    if !matches {
                        packet.warnings.push(format!("{} cites a missing or changed source revision; its summary may be stale",s.record.title));
                    }
                }
                candidates.push(s);
            }
        }
    }
    let mut terms = search_terms(&query.question);
    if terms.is_empty() && !recall {
        if let Some(previous) = query.recent_questions.last() {
            terms = search_terms(previous);
        }
    }
    if !terms.is_empty() {
        let sql=format!("SELECT {FIELDS} FROM search JOIN chunks c ON c.rowid=search.rowid JOIN documents d ON d.path=c.path WHERE search MATCH ?3 AND d.valid=1 AND ({allowed} OR (?4=1 AND d.kind='decision' AND NOT EXISTS(SELECT 1 FROM refs WHERE path=d.path))) AND (?4=1 OR (d.kind!='history' AND json_extract(d.json,'$.status') NOT IN ('superseded','archived'))) ORDER BY bm25(search,5.0,3.0,1.0),d.path,c.start LIMIT 48");
        let mut stmt = c.prepare(&sql)?;
        for row in stmt.query_map(
            params![scope_json, portfolio as i32, terms, historical as i32],
            row_source,
        )? {
            let mut s = row?;
            s.reason=if s.record.kind=="decision"&&s.record.project_refs.is_empty(){"topic match in unscoped historical decision evidence; project applicability unconfirmed"}else{"topic match in eligible scope"}.into();
            if let Some(summary) = candidates.iter_mut().find(|summary| {
                summary.record.path == s.record.path
                    && summary.reason.starts_with("project summary")
            }) {
                s.reason =
                    "question-matching project summary section; incorporation not assumed".into();
                *summary = s;
            } else {
                candidates.push(s);
            }
        }
    }
    let mut current_paths = HashSet::new();
    if !scope.is_empty() && (recall || candidates.len() < 3) {
        for kind in ["session", "decision"] {
            let sql="SELECT d.path FROM bindings b JOIN documents d ON d.path=b.path WHERE d.valid=1 AND d.kind=?2 AND json_extract(d.json,'$.status') NOT IN ('superseded','archived') AND b.project_id IN (SELECT value FROM json_each(?1)) GROUP BY d.path ORDER BY COALESCE(json_extract(d.json,'$.observedAt'),json_extract(d.json,'$.recordedAt'),'') DESC,d.path LIMIT 3";
            let paths: Vec<String> = c
                .prepare(sql)?
                .query_map(params![scope_json, kind], |r| r.get(0))?
                .collect::<Result<_, _>>()?;
            for path in paths {
                current_paths.insert(path.clone());
                if candidates.iter().any(|s| s.record.path == path) {
                    continue;
                }
                if let Some(s) = first_chunk(
                    c,
                    &path,
                    "project decision/session; incorporation not assumed",
                )? {
                    candidates.push(s);
                }
            }
        }
    }
    let mut seen = HashSet::new();
    // Global research must not crowd unreconciled project milestones out of a
    // resumption/status answer. Stable sorting preserves rank within each lane.
    candidates.sort_by_key(|s| {
        if s.record.kind == "project" {
            0
        } else if recall && current_paths.contains(&s.record.path) {
            1
        } else if s.record.kind != "research" && !s.record.project_refs.is_empty() {
            2
        } else {
            3
        }
    });
    let mut seen_text = HashSet::new();
    let mut lineage = HashSet::new();
    let mut checked = std::collections::HashMap::new();
    let mut bundle_boundaries = Vec::new();
    for mut candidate in candidates {
        if seen.contains(&candidate.record.path) {
            continue;
        }
        let text_hash = record::fingerprint(candidate.excerpt.trim().as_bytes());
        if seen_text.contains(&text_hash)
            && candidate.record.corrects.is_empty()
            && candidate.record.supersedes.is_empty()
        {
            continue;
        }
        if candidate
            .record
            .derived_from
            .iter()
            .any(|id| lineage.contains(id))
        {
            candidate.reason.push_str("; shares recorded source lineage with another passage, not independent corroboration");
        }
        let mut bundle =
            if candidate.record.corrects.is_empty() && candidate.record.supersedes.is_empty() {
                vec![candidate.clone()]
            } else {
                correction_chunks(c, &candidate.record.path)?
            };
        let mut resolved = true;
        let mut frontier = vec![candidate.record.id.clone()];
        let mut related = HashSet::new();
        // Include recorded reversals even if they would not match the question.
        // Bounded expansion is explicit; it is not arbitrary prose conflict detection.
        for _ in 0..3 {
            let mut next = Vec::new();
            for id in frontier {
                let missing:u64=c.query_row("SELECT COUNT(*) FROM relations r JOIN documents d ON d.path=r.path WHERE d.id=?1 AND r.kind IN ('corrects','supersedes') AND NOT EXISTS(SELECT 1 FROM documents target WHERE target.id=r.target AND target.valid=1)",[&id],|r|r.get(0))?;
                if missing > 0 {
                    resolved = false;
                }
                let sql="SELECT DISTINCT d.path FROM relations r JOIN documents d ON d.path=r.path WHERE r.target=?1 AND r.kind IN ('corrects','supersedes') UNION SELECT DISTINCT target.path FROM documents source JOIN relations r ON r.path=source.path JOIN documents target ON target.id=r.target WHERE source.id=?1 AND r.kind IN ('corrects','supersedes') LIMIT 9";
                let paths: Vec<String> = c
                    .prepare(sql)?
                    .query_map([id], |r| r.get(0))?
                    .collect::<Result<_, _>>()?;
                for path in paths {
                    if path == candidate.record.path || !related.insert(path.clone()) {
                        continue;
                    }
                    let in_scope:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM documents d WHERE d.path=?1 AND d.valid=1 AND (EXISTS(SELECT 1 FROM bindings WHERE path=d.path AND project_id IN(SELECT value FROM json_each(?2))) OR kind='research'))",params![path,scope_json],|r|r.get(0))?;
                    if !in_scope {
                        resolved = false;
                        continue;
                    }
                    if related.len() >= 4 {
                        packet.truncated = true;
                        resolved = false;
                        continue;
                    }
                    let sources = correction_chunks(c, &path)?;
                    if let Some(source) = sources.first() {
                        next.push(source.record.id.clone());
                    } else {
                        resolved = false;
                    }
                    bundle.extend(sources);
                }
            }
            frontier = next;
        }
        if !frontier.is_empty() {
            packet.truncated = true;
            resolved = false;
            packet
                .warnings
                .push("Correction traversal reached its depth limit".into());
        }
        if !resolved {
            packet.warnings.push(format!(
                "{} omitted: known correction links are incomplete, unavailable or outside scope",
                candidate.record.title
            ));
            packet.status = "partial".into();
            continue;
        }
        bundle.retain(|s| !seen.contains(&s.record.path));
        if packet.sources.len() + bundle.len() > MAX_PASSAGES {
            packet.truncated = true;
            continue;
        }
        let mut valid = true;
        for s in &bundle {
            let current = checked.entry(s.record.path.clone()).or_insert_with(|| {
                index::read_source(vault, &s.record.path).map(|b| record::fingerprint(&b))
            });
            if current.as_ref().ok() != Some(&s.record.revision) {
                valid = false;
                packet.warnings.push(format!(
                    "Changed or unavailable source omitted: {}",
                    s.record.path
                ));
            }
        }
        // Never supply one side of a known correction when another changed.
        if !valid {
            packet.status = "stale".into();
            continue;
        }
        let old_len = packet.sources.len();
        bound_warnings(&mut packet);
        packet.sources.extend(bundle);
        if packet.json().len() > MAX_PACKET_BYTES - 2000 {
            packet.sources.truncate(old_len);
            packet.truncated = true;
            continue;
        }
        bundle_boundaries.push(old_len);
        for s in &packet.sources[old_len..] {
            seen.insert(s.record.path.clone());
            seen_text.insert(record::fingerprint(s.excerpt.trim().as_bytes()));
            lineage.insert(s.record.id.clone());
            lineage.extend(s.record.derived_from.iter().cloned());
        }
        if packet.sources.len() == MAX_PASSAGES {
            break;
        }
    }
    Ok(finish(packet, bundle_boundaries))
}
