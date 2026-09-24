//! One fixed communicating pair, not a reusable agent executor. Only operational SQLite writes.
use super::{
    models::{self, RequestRecord},
    persistence::Db,
    research_agents::*,
    research_retrieval, responses, vault_write,
};
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::BTreeSet, io::Read, path::Path, time::Duration};
use tauri::{Manager, State};

fn now() -> String {
    Utc::now().to_rfc3339()
}
fn hash(value: &impl Serialize) -> String {
    vault_write::content_fingerprint(&serde_json::to_string(value).unwrap())
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: String,
    pub fingerprint: String,
    pub source: research_retrieval::ResearchExcerpt,
    pub checked_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Endpoint {
    pub agent: String,
    pub version: u32,
    pub run: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", deny_unknown_fields)]
pub enum Packet {
    EvidencePacket {
        research: ResearchOutput,
        source_ids: Vec<String>,
    },
    ClarificationRequest(Clarification),
    ClarificationResponse {
        research: ResearchOutput,
        source_ids: Vec<String>,
    },
    VerificationResult {
        research_hash: String,
        result: VerificationOutput,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Message {
    pub id: String,
    pub sender: Endpoint,
    pub recipient: Endpoint,
    pub graph: String,
    pub parent_run: String,
    pub correlation: String,
    pub round: usize,
    pub at: String,
    pub deadline: String,
    pub remaining_requests: usize,
    pub evidence: Vec<String>,
    pub requested_action: String,
    pub expected_response: String,
    pub packet: Packet,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRun {
    pub id: String,
    pub parent_run: String,
    pub definition: AgentDefinition,
    pub definition_fingerprint: String,
    pub round: usize,
    pub status: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub input: Option<Value>,
    pub output: Option<Value>,
    pub request: Option<RequestRecord>,
    pub error: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BriefClaim {
    pub claim: Claim,
    pub verification: Finding,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brief {
    pub supported: Vec<BriefClaim>,
    pub contradicted: Vec<BriefClaim>,
    pub insufficient: Vec<BriefClaim>,
    pub notice: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub sequence: usize,
    pub at: String,
    pub node: String,
    pub state: String,
    pub detail: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: String,
    pub graph: String,
    pub question: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub deadline: String,
    pub definition: Value,
    pub sources: Vec<Source>,
    pub agents: Vec<AgentRun>,
    pub messages: Vec<Message>,
    pub events: Vec<Event>,
    pub brief: Option<Brief>,
    pub error: Option<String>,
    pub evaluation: Value,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Start {
    pub id: String,
    pub question: String,
}

pub fn recover(connection: &rusqlite::Connection) -> Result<(), String> {
    connection.execute_batch("CREATE TABLE IF NOT EXISTS research_verification_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,cancel_requested INTEGER NOT NULL DEFAULT 0,record_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS research_verification_checkpoints(run_id TEXT NOT NULL,sequence INTEGER NOT NULL,record_json TEXT NOT NULL,PRIMARY KEY(run_id,sequence));").map_err(|e|e.to_string())?;
    let rows = {
        let mut query = connection
            .prepare("SELECT record_json FROM research_verification_runs WHERE status='running'")
            .map_err(|e| e.to_string())?;
        let values = query
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        values
    };
    for raw in rows {
        let mut run: Run = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        run.status = "interrupted".into();
        run.error=Some("Application restarted; execution end time and any unreported provider usage are unknown. Start a new run explicitly.".into());
        for child in &mut run.agents {
            if child.status == "running" || child.status == "pending" {
                child.status = "interrupted".into();
                child.error = run.error.clone();
                if let Some(record) = &mut child.request {
                    if record.status == "started" {
                        record.status = "interrupted".into();
                        record.error_code = Some("application_restarted".into())
                    }
                }
            }
        }
        event(
            &mut run,
            "parent",
            "interrupted",
            "Recovery observed interruption; no automatic retry.",
        );
        let raw = serde_json::to_string(&run).unwrap();
        connection.execute("UPDATE research_verification_runs SET status='interrupted',record_json=?2 WHERE id=?1",params![run.id,raw]).map_err(|e|e.to_string())?;
        connection
            .execute(
                "INSERT INTO research_verification_checkpoints VALUES(?1,?2,?3)",
                params![run.id, run.events.len(), raw],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn event(run: &mut Run, node: &str, state: &str, detail: &str) {
    run.events.push(Event {
        sequence: run.events.len() + 1,
        at: now(),
        node: node.into(),
        state: state.into(),
        detail: detail.into(),
    });
}
fn load(db: &Db, id: &str) -> Result<Run, String> {
    let c = db.0.lock().map_err(|e| e.to_string())?;
    let raw: String = c
        .query_row(
            "SELECT record_json FROM research_verification_runs WHERE id=?1",
            [id],
            |r| r.get(0),
        )
        .map_err(|_| "run_not_found")?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}
fn checkpoint(db: &Db, run: &Run) -> Result<(), String> {
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    let cancelled: bool = tx
        .query_row(
            "SELECT cancel_requested FROM research_verification_runs WHERE id=?1",
            [&run.id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if cancelled && !["cancelled", "failed", "timed_out"].contains(&run.status.as_str()) {
        return Err("cancelled".into());
    }
    let raw = serde_json::to_string(run).map_err(|e| e.to_string())?;
    if tx.execute("UPDATE research_verification_runs SET status=?2,record_json=?3 WHERE id=?1 AND status='running'",params![run.id,run.status,raw]).map_err(|e|e.to_string())?!=1 {return Err("run_already_terminal".into())}
    tx.execute(
        "INSERT INTO research_verification_checkpoints VALUES(?1,?2,?3)",
        params![run.id, run.events.len(), raw],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
fn guard(db: &Db, run: &Run) -> Result<(), String> {
    let c = db.0.lock().map_err(|e| e.to_string())?;
    let (status, cancelled): (String, bool) = c
        .query_row(
            "SELECT status,cancel_requested FROM research_verification_runs WHERE id=?1",
            [&run.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    if cancelled {
        return Err("cancelled".into());
    }
    if status != "running" {
        return Err("parent_not_running".into());
    }
    if Utc::now()
        >= chrono::DateTime::parse_from_rfc3339(&run.deadline).map_err(|_| "invalid_deadline")?
    {
        return Err("timed_out".into());
    }
    Ok(())
}
fn available(key: bool, source: bool) -> Result<(), String> {
    if !key {
        Err("OpenAI credentials unavailable".into())
    } else if !source {
        Err("Research source directory unavailable".into())
    } else {
        Ok(())
    }
}
fn has_key() -> bool {
    std::env::var("OPENAI_API_KEY").is_ok_and(|v| !v.trim().is_empty())
}
fn read_source(root: &Path, relative: &str) -> Result<String, String> {
    if !relative.starts_with("02 - Research/") || !relative.ends_with(".md") {
        return Err("source_outside_scope".into());
    }
    let path = vault_write::resolve_within(root, Path::new(relative))
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|_| "source_unreadable")?;
    // The canonical destination must also remain under Research, not merely under the vault.
    let research = root
        .canonicalize()
        .map_err(|_| "vault_unavailable")?
        .join("02 - Research");
    if !path.starts_with(research) {
        return Err("source_outside_scope".into());
    }
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .map_err(|_| "source_unreadable")?
        .take(512_001)
        .read_to_end(&mut bytes)
        .map_err(|_| "source_unreadable")?;
    if bytes.len() > 512_000 {
        return Err("source_file_budget_exceeded".into());
    }
    String::from_utf8(bytes).map_err(|_| "source_not_utf8".into())
}
fn collect(root: &Path, question: &str, existing: &[Source]) -> Result<Vec<Source>, String> {
    let canonical = root.canonicalize().map_err(|_| "vault_unavailable")?;
    let root = canonical.as_path();
    let folder =
        vault_write::resolve_within(root, Path::new("02 - Research")).map_err(|e| e.to_string())?;
    let mut paths = Vec::new();
    for (i, item) in walkdir::WalkDir::new(folder)
        .follow_links(false)
        .sort_by_file_name()
        .into_iter()
        .enumerate()
    {
        if i >= 2048 {
            return Err("research_directory_budget_exceeded".into());
        }
        let entry = item.map_err(|_| "research_directory_unreadable")?;
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|s| s.to_str()) != Some("md")
        {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|_| "source_outside_scope")?
            .to_string_lossy()
            .replace('\\', "/");
        if existing.iter().any(|s| s.source.source_file == relative) {
            continue;
        }
        paths.push(relative);
        if paths.len() > 256 {
            return Err("research_file_count_budget_exceeded".into());
        }
    }
    let mut entries = Vec::new();
    let mut fingerprints = std::collections::BTreeMap::new();
    let mut bytes = 0;
    for path in paths {
        let raw = read_source(root, &path)?;
        bytes += raw.len();
        if bytes > 16_000_000 {
            return Err("research_read_budget_exceeded".into());
        }
        let Some((header, body)) = super::pantheon::split_frontmatter(&raw) else {
            continue;
        };
        let metadata: serde_yaml::Value =
            serde_yaml::from_str(header).map_err(|_| "research_frontmatter_invalid")?;
        let tags: Vec<String> = metadata
            .get("tags")
            .and_then(|v| v.as_sequence())
            .map(|v| {
                v.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        if !tags.iter().any(|t| t == "olympus/research") {
            continue;
        }
        let field = |name: &str| {
            metadata
                .get(name)
                .and_then(|v| v.as_str())
                .map(str::to_string)
        };
        let stance = field("stance")
            .filter(|s| {
                ["endorsed", "provisional", "disputed", "unevaluated"].contains(&s.as_str())
            })
            .unwrap_or("unevaluated".into());
        entries.push(serde_json::from_value::<super::pantheon::PantheonEntry>(json!({"id":path,"title":field("title").unwrap_or(path.clone()),"sourceFile":path,"entryType":"research","stance":stance,"origin":field("origin"),"sourceDate":field("source_date"),"tags":tags,"project":field("project"),"wordCount":0,"fileModifiedAt":"","bodyPreview":"","body":body.trim()})).map_err(|e|e.to_string())?);
        fingerprints.insert(path, vault_write::content_fingerprint(&raw));
    }
    Ok(research_retrieval::retrieve(&entries, question)
        .into_iter()
        .map(|source| {
            let fingerprint = fingerprints[&source.source_file].clone();
            Source {
                id: format!(
                    "source-{}",
                    hash(&(source.source_file.clone(), fingerprint.clone()))
                ),
                fingerprint,
                source,
                checked_at: now(),
            }
        })
        .collect())
}
fn source_health(root: &Path, sources: &[Source]) -> Result<(), String> {
    for s in sources {
        if vault_write::content_fingerprint(&read_source(root, &s.source.source_file)?)
            != s.fingerprint
        {
            return Err("source_changed_during_run".into());
        }
    }
    Ok(())
}
fn citations(refs: &[Citation], sources: &[Source], required: bool) -> Result<(), String> {
    if refs.len() > 6 || (required && refs.is_empty()) {
        return Err("citation_count_invalid".into());
    }
    for r in refs {
        let source = sources
            .iter()
            .find(|s| s.id == r.source_id && s.fingerprint == r.fingerprint)
            .ok_or("evidence_fingerprint_mismatch")?;
        if r.quote.trim().chars().count() < 8
            || r.quote.chars().count() > 1000
            || !source.source.excerpt.contains(&r.quote)
        {
            return Err("quote_not_in_supplied_excerpt".into());
        }
    }
    Ok(())
}
fn validate_research(
    output: &ResearchOutput,
    sources: &[Source],
    prior: Option<&ResearchOutput>,
) -> Result<(), String> {
    if output.claims.len() > 5
        || output.unanswered.len() > 5
        || output.contradictions.len() > 5
        || output
            .unanswered
            .iter()
            .chain(output.contradictions.iter())
            .any(|s| s.len() > 2000)
    {
        return Err("research_output_budget".into());
    }
    let mut ids = BTreeSet::new();
    for c in &output.claims {
        if c.id.is_empty()
            || c.id.len() > 64
            || !ids.insert(&c.id)
            || c.text.trim().is_empty()
            || c.text.len() > 2000
        {
            return Err("invalid_claim".into());
        }
        citations(&c.evidence, sources, false)?;
    }
    if let Some(prior) = prior {
        if output.claims.len() != prior.claims.len()
            || prior.claims.iter().any(|p| {
                !output
                    .claims
                    .iter()
                    .any(|c| c.id == p.id && c.text == p.text)
            })
        {
            return Err("clarification_rewrote_claims".into());
        }
    }
    Ok(())
}
fn validate_verification(
    output: &VerificationOutput,
    research: &ResearchOutput,
    sources: &[Source],
    round: usize,
) -> Result<(), String> {
    if output.findings.len() != research.claims.len() {
        return Err("verification_claim_set_mismatch".into());
    }
    let mut seen = BTreeSet::new();
    for f in &output.findings {
        if !research.claims.iter().any(|c| c.id == f.claim_id)
            || !seen.insert(&f.claim_id)
            || f.explanation.trim().is_empty()
            || f.explanation.len() > 2000
        {
            return Err("invalid_verification_claim".into());
        }
        citations(&f.evidence, sources, f.status != Verdict::Insufficient)?;
    }
    if let Some(c) = &output.clarification {
        if round >= MAX_ROUNDS
            || c.question.trim().is_empty()
            || c.question.len() > 500
            || c.claim_ids.is_empty()
            || c.claim_ids.len() > 5
            || c.claim_ids.iter().collect::<BTreeSet<_>>().len() != c.claim_ids.len()
            || c.claim_ids.iter().any(|id| {
                !output
                    .findings
                    .iter()
                    .any(|f| &f.claim_id == id && f.status == Verdict::Insufficient)
            })
        {
            return Err("invalid_or_exceeded_clarification".into());
        }
    }
    Ok(())
}
fn endpoint(run: &Run, index: usize) -> Endpoint {
    let child = &run.agents[index];
    Endpoint {
        agent: child.definition.id.clone(),
        version: child.definition.version,
        run: child.id.clone(),
    }
}
fn olympus(run: &Run) -> Endpoint {
    Endpoint {
        agent: "olympus".into(),
        version: 1,
        run: run.id.clone(),
    }
}
fn validate_message(
    run: &Run,
    m: &Message,
    expected_sender: &Endpoint,
    expected_recipient: &Endpoint,
    round: usize,
) -> Result<(), String> {
    if m.sender != *expected_sender || m.recipient != *expected_recipient {
        return Err("message_endpoint_mismatch".into());
    }
    if m.graph != GRAPH
        || m.parent_run != run.id
        || m.correlation != format!("{}:{round}", run.id)
        || m.round != round
        || round > MAX_ROUNDS
    {
        return Err("message_correlation_or_round_mismatch".into());
    }
    if m.id != format!("{}:message:{}", run.id, run.messages.len() + 1)
        || run.messages.iter().any(|p| p.id == m.id)
    {
        return Err("duplicate_or_out_of_order_message".into());
    }
    let at = chrono::DateTime::parse_from_rfc3339(&m.at).map_err(|_| "message_time_invalid")?;
    let deadline =
        chrono::DateTime::parse_from_rfc3339(&run.deadline).map_err(|_| "deadline_invalid")?;
    if m.deadline != run.deadline
        || at > deadline
        || Utc::now() > deadline
        || at > Utc::now()
        || at
            < chrono::DateTime::parse_from_rfc3339(&run.started_at)
                .map_err(|_| "start_time_invalid")?
    {
        return Err("late_or_invalid_message".into());
    }
    if m.evidence
        != run
            .sources
            .iter()
            .map(|s| format!("{}:{}", s.id, s.fingerprint))
            .collect::<Vec<_>>()
        || m.remaining_requests != 4 - run.agents.iter().filter(|a| a.request.is_some()).count()
    {
        return Err("message_evidence_or_budget_mismatch".into());
    }
    for endpoint in [&m.sender, &m.recipient] {
        if endpoint.agent != "olympus"
            && !run.agents.iter().any(|a| {
                a.id == endpoint.run
                    && a.definition.id == endpoint.agent
                    && a.definition.version == endpoint.version
            })
        {
            return Err("unknown_message_endpoint".into());
        }
    }
    let sender = run
        .agents
        .iter()
        .find(|a| a.id == m.sender.run && a.status == "completed" && a.round == round)
        .ok_or("message_sender_not_completed")?;
    if m.recipient.agent != "olympus"
        && !run.agents.iter().any(|a| {
            a.id == m.recipient.run
                && a.status == "pending"
                && a.round
                    == if matches!(m.packet, Packet::ClarificationRequest(_)) {
                        1
                    } else {
                        round
                    }
        })
    {
        return Err("message_recipient_not_pending".into());
    }
    let action = match &m.packet {
        Packet::EvidencePacket {
            research,
            source_ids,
        }
        | Packet::ClarificationResponse {
            research,
            source_ids,
        } => {
            if m.sender.agent != RESEARCH
                || m.recipient.agent != VERIFY
                || matches!(&m.packet, Packet::EvidencePacket { .. }) != (round == 0)
                || source_ids != &run.sources.iter().map(|s| s.id.clone()).collect::<Vec<_>>()
            {
                return Err("wrong_graph_edge".into());
            }
            validate_research(research, &run.sources, None)?;
            ("verify_claims", "VerificationResult")
        }
        Packet::ClarificationRequest(c) => {
            if m.sender.agent != VERIFY
                || m.recipient.agent != RESEARCH
                || round != 0
                || c.question.is_empty()
                || c.question.len() > 500
                || run
                    .messages
                    .iter()
                    .any(|m| matches!(m.packet, Packet::ClarificationRequest(_)))
            {
                return Err("wrong_clarification_edge".into());
            }
            let output: VerificationOutput =
                serde_json::from_value(sender.output.clone().ok_or("missing_sender_output")?)
                    .map_err(|_| "invalid_sender_output")?;
            if output.clarification.as_ref() != Some(c) {
                return Err("clarification_output_mismatch".into());
            }
            ("clarify_evidence", "ClarificationResponse")
        }
        Packet::VerificationResult {
            research_hash,
            result,
        } => {
            if m.sender.agent != VERIFY || m.recipient != olympus(run) {
                return Err("wrong_result_edge".into());
            }
            let candidate = run
                .agents
                .iter()
                .find(|a| {
                    a.round == round && a.definition.id == RESEARCH && a.status == "completed"
                })
                .and_then(|a| a.output.clone())
                .ok_or("missing_research_output")?;
            let research: ResearchOutput =
                serde_json::from_value(candidate).map_err(|_| "invalid_research_output")?;
            if *research_hash != hash(&research) {
                return Err("stale_research_hash".into());
            }
            validate_verification(result, &research, &run.sources, round)?;
            ("join_or_clarify", "none")
        }
    };
    match &m.packet {
        Packet::EvidencePacket { research, .. }
        | Packet::ClarificationResponse { research, .. }
            if sender.output.as_ref() != Some(&json!(research)) =>
        {
            return Err("evidence_output_mismatch".into())
        }
        Packet::VerificationResult { result, .. }
            if sender.output.as_ref() != Some(&json!(result)) =>
        {
            return Err("verification_output_mismatch".into())
        }
        _ => {}
    }
    if (m.requested_action.as_str(), m.expected_response.as_str()) != action {
        return Err("message_action_mismatch".into());
    }
    Ok(())
}
fn send(
    run: &mut Run,
    sender: Endpoint,
    recipient: Endpoint,
    round: usize,
    packet: Packet,
) -> Result<(), String> {
    let (action, response) = match packet {
        Packet::EvidencePacket { .. } | Packet::ClarificationResponse { .. } => {
            ("verify_claims", "VerificationResult")
        }
        Packet::ClarificationRequest(_) => ("clarify_evidence", "ClarificationResponse"),
        Packet::VerificationResult { .. } => ("join_or_clarify", "none"),
    };
    let message = Message {
        id: format!("{}:message:{}", run.id, run.messages.len() + 1),
        sender: sender.clone(),
        recipient: recipient.clone(),
        graph: GRAPH.into(),
        parent_run: run.id.clone(),
        correlation: format!("{}:{round}", run.id),
        round,
        at: now(),
        deadline: run.deadline.clone(),
        remaining_requests: 4 - run.agents.iter().filter(|a| a.request.is_some()).count(),
        evidence: run
            .sources
            .iter()
            .map(|s| format!("{}:{}", s.id, s.fingerprint))
            .collect(),
        requested_action: action.into(),
        expected_response: response.into(),
        packet,
    };
    validate_message(run, &message, &sender, &recipient, round)?;
    run.messages.push(message);
    event(run, "message", "accepted", action);
    Ok(())
}
fn child(run: &mut Run, id: &str, round: usize) -> usize {
    let definition = definition(id).unwrap();
    let index = run.agents.len();
    run.agents.push(AgentRun {
        id: format!("{}:{id}:{round}", run.id),
        parent_run: run.id.clone(),
        definition_fingerprint: hash(&definition),
        definition,
        round,
        status: "pending".into(),
        started_at: None,
        finished_at: None,
        input: None,
        output: None,
        request: None,
        error: None,
    });
    index
}
type ModelFuture<'a> =
    std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send + 'a>>;
trait Model: Sync {
    fn call<'a>(
        &'a self,
        agent: &'a AgentDefinition,
        input: Value,
        record: &'a mut RequestRecord,
    ) -> ModelFuture<'a>;
}
struct LiveModel;
impl Model for LiveModel {
    fn call<'a>(
        &'a self,
        agent: &'a AgentDefinition,
        input: Value,
        record: &'a mut RequestRecord,
    ) -> ModelFuture<'a> {
        Box::pin(async move {
            match agent.id.as_str() {
                RESEARCH => research(agent, input, record).await,
                VERIFY => verification(agent, input, record).await,
                _ => Err("unknown_handler".into()),
            }
        })
    }
}
async fn research(
    agent: &AgentDefinition,
    input: Value,
    record: &mut RequestRecord,
) -> Result<String, String> {
    if agent.id != RESEARCH {
        return Err("wrong_research_role".into());
    }
    responses::structured(
        &models::resolve(models::Capability::Primary),
        &agent.instructions,
        input,
        agent.output_schema.clone(),
        record,
    )
    .await
}
async fn verification(
    agent: &AgentDefinition,
    input: Value,
    record: &mut RequestRecord,
) -> Result<String, String> {
    if agent.id != VERIFY {
        return Err("wrong_verification_role".into());
    }
    responses::structured(
        &models::resolve(models::Capability::Primary),
        &agent.instructions,
        input,
        agent.output_schema.clone(),
        record,
    )
    .await
}
async fn dispatch(
    db: &Db,
    root: &Path,
    run: &mut Run,
    index: usize,
    input: Value,
    model: &dyn Model,
) -> Result<Value, String> {
    guard(db, run)?;
    source_health(root, &run.sources)?;
    let definition = run.agents[index].definition.clone();
    // Compiled role authority, never a message/skill-supplied handler or model route.
    if definition.id != RESEARCH && definition.id != VERIFY {
        return Err("unknown_handler".into());
    }
    let mut record = RequestRecord::new(
        &models::resolve(models::Capability::Primary),
        &format!("{GRAPH}/{}", definition.id),
    );
    let child = &mut run.agents[index];
    child.input = Some(input.clone());
    child.started_at = Some(now());
    child.status = "running".into();
    child.request = Some(record.clone());
    event(
        run,
        &definition.id,
        "started",
        "One model request; no retries or fallback.",
    );
    checkpoint(db, run)?;
    models::save(db, &record)?;
    let result = {
        let call = model.call(&definition, input, &mut record);
        let cancellation = Box::pin(async {
            loop {
                if let Err(e) = guard(db, run) {
                    break e;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });
        match futures_util::future::select(call, cancellation).await {
            futures_util::future::Either::Left((result, _)) => result,
            futures_util::future::Either::Right((error, pending)) => {
                drop(pending);
                Err(error)
            }
        }
    };
    if record.status == "started" {
        record.status = if result.as_ref().err().is_some_and(|e| e == "cancelled") {
            "cancelled"
        } else {
            "failed"
        }
        .into();
        record.error_code = result.as_ref().err().cloned();
    }
    run.agents[index].request = Some(record.clone());
    models::save(db, &record)?;
    let value: Value = result.and_then(|raw| {
        if raw.len() > 64_000 {
            Err("output_budget".into())
        } else {
            serde_json::from_str(&raw).map_err(|_| "invalid_output_schema".into())
        }
    })?;
    // Keep raw structured response even if contract validation subsequently fails.
    run.agents[index].output = Some(value.clone());
    run.agents[index].finished_at = Some(now());
    guard(db, run)?;
    source_health(root, &run.sources)?;
    Ok(value)
}
fn input(
    run: &Run,
    round: usize,
    prior: Option<&ResearchOutput>,
    clarification: Option<&Clarification>,
) -> Value {
    json!({"question":run.question,"round":round,"sources":run.sources.iter().map(|s|json!({"id":s.id,"fingerprint":s.fingerprint,"title":s.source.title,"sourceFile":s.source.source_file,"stance":s.source.stance,"excerpt":s.source.excerpt})).collect::<Vec<_>>(),"priorResearch":prior,"clarification":clarification})
}
fn join(
    run: &Run,
    research: &ResearchOutput,
    verification: &VerificationOutput,
    round: usize,
) -> Result<Brief, String> {
    if run.agents.iter().any(|a| a.status != "completed") {
        return Err("incomplete_agent_cannot_join".into());
    }
    let last = run.messages.last().ok_or("missing_verification_message")?;
    let mut before = run.clone();
    before.messages.pop();
    let verifier = run
        .agents
        .iter()
        .position(|a| a.definition.id == VERIFY && a.round == round)
        .ok_or("missing_verifier")?;
    validate_message(
        &before,
        last,
        &endpoint(run, verifier),
        &olympus(run),
        round,
    )?;
    match &last.packet {
        Packet::VerificationResult {
            research_hash,
            result,
        } if *research_hash == hash(research)
            && *result == *verification
            && last.round == round
            && last.recipient == olympus(run) => {}
        _ => return Err("join_result_mismatch".into()),
    }
    validate_research(research, &run.sources, None)?;
    validate_verification(verification, research, &run.sources, round)?;
    let mut brief=Brief{supported:Vec::new(),contradicted:Vec::new(),insufficient:Vec::new(),notice:"Model-assessed support against saved excerpts, not independent proof of truth, comprehensive research, operator endorsement, or permission to act. Unsupported claims are excluded from the supported answer.".into()};
    for f in &verification.findings {
        let item = BriefClaim {
            claim: research
                .claims
                .iter()
                .find(|c| c.id == f.claim_id)
                .unwrap()
                .clone(),
            verification: f.clone(),
        };
        match f.status {
            Verdict::Supported => brief.supported.push(item),
            Verdict::Contradicted => brief.contradicted.push(item),
            Verdict::Insufficient => brief.insufficient.push(item),
        }
    }
    Ok(brief)
}
async fn drive(db: &Db, root: &Path, run: &mut Run, model: &dyn Model) -> Result<(), String> {
    guard(db, run)?;
    run.sources = collect(root, &run.question, &[])?;
    event(run,"scope","completed",&format!("{} excerpts selected; at most 3 initially, 6 overall; lexical retrieval is not exhaustive.",run.sources.len()));
    checkpoint(db, run)?;
    if run.sources.is_empty() {
        run.status = "insufficient".into();
        event(
            run,
            "join",
            "insufficient",
            "No matching Research excerpts; no agent or model request dispatched.",
        );
        return Ok(());
    }
    let mut prior: Option<ResearchOutput> = None;
    let mut clarification: Option<Clarification> = None;
    let mut research_index = None;
    for round in 0..=MAX_ROUNDS {
        guard(db, run)?;
        let ri = research_index
            .take()
            .unwrap_or_else(|| child(run, RESEARCH, round));
        let request = input(run, round, prior.as_ref(), clarification.as_ref());
        let research: ResearchOutput =
            serde_json::from_value(dispatch(db, root, run, ri, request, model).await?)
                .map_err(|_| "invalid_research_schema")?;
        validate_research(&research, &run.sources, prior.as_ref())?;
        run.agents[ri].status = "completed".into();
        event(
            run,
            RESEARCH,
            "completed",
            &format!("{} candidate claims; round {round}.", research.claims.len()),
        );
        checkpoint(db, run)?;
        let vi = child(run, VERIFY, round);
        let ids = run.sources.iter().map(|s| s.id.clone()).collect();
        send(
            run,
            endpoint(run, ri),
            endpoint(run, vi),
            round,
            if round == 0 {
                Packet::EvidencePacket {
                    research: research.clone(),
                    source_ids: ids,
                }
            } else {
                Packet::ClarificationResponse {
                    research: research.clone(),
                    source_ids: ids,
                }
            },
        )?;
        checkpoint(db, run)?;
        let request = input(run, round, Some(&research), clarification.as_ref());
        let verification: VerificationOutput =
            serde_json::from_value(dispatch(db, root, run, vi, request, model).await?)
                .map_err(|_| "invalid_verification_schema")?;
        validate_verification(&verification, &research, &run.sources, round)?;
        run.agents[vi].status = "completed".into();
        event(
            run,
            VERIFY,
            "completed",
            if verification.clarification.is_some() {
                "Requested one bounded clarification."
            } else {
                "Final structured judgments returned."
            },
        );
        send(
            run,
            endpoint(run, vi),
            olympus(run),
            round,
            Packet::VerificationResult {
                research_hash: hash(&research),
                result: verification.clone(),
            },
        )?;
        checkpoint(db, run)?;
        if let Some(request) = &verification.clarification {
            let extra = collect(
                root,
                &format!("{} {}", run.question, request.question),
                &run.sources,
            )?;
            if !extra.is_empty() {
                let next = child(run, RESEARCH, 1);
                send(
                    run,
                    endpoint(run, vi),
                    endpoint(run, next),
                    round,
                    Packet::ClarificationRequest(request.clone()),
                )?;
                run.sources.extend(extra);
                if run.sources.len() > 6 {
                    return Err("source_budget_exceeded".into());
                }
                event(run,"scope","clarification", "Selected additional Research excerpts within the original source scope; claim identities/texts are frozen.");
                checkpoint(db, run)?;
                prior = Some(research);
                clarification = Some(request.clone());
                research_index = Some(next);
                continue;
            }
            event(run,"clarification","not_dispatched","No additional matching sources; retained insufficiency without another model request.");
        }
        guard(db, run)?;
        source_health(root, &run.sources)?;
        let brief = join(run, &research, &verification, round)?;
        let initial = run
            .agents
            .iter()
            .find(|a| a.definition.id == VERIFY && a.round == 0)
            .and_then(|a| a.output.clone())
            .and_then(|v| serde_json::from_value::<VerificationOutput>(v).ok())
            .unwrap();
        run.evaluation = json!({"initialUnsupportedClaims":initial.findings.iter().filter(|f|f.status!=Verdict::Supported).map(|f|&f.claim_id).collect::<Vec<_>>(),"clarificationRequested":initial.clarification.is_some(),"clarificationRoundsExecuted":round,"insufficiencyResolved":initial.findings.iter().filter(|f|f.status==Verdict::Insufficient&&verification.findings.iter().any(|v|v.claim_id==f.claim_id&&v.status!=Verdict::Insufficient)).map(|f|&f.claim_id).collect::<Vec<_>>(),"verificationLatencyMs":run.agents.iter().filter(|a|a.definition.id==VERIFY).map(|a|a.request.as_ref().and_then(|r|r.latency_ms)).collect::<Option<Vec<_>>>().map(|values|values.into_iter().sum::<u64>()),"operatorFeedback":null,"claimTypeTaxonomy":null,"usage":"See individual request receipts; null means unreported, never zero."});
        run.status = if brief.insufficient.is_empty() && !research.claims.is_empty() {
            "completed"
        } else {
            "insufficient"
        }
        .into();
        run.brief = Some(brief);
        event(run,"join","completed","Deterministic brief partitions supported, contradicted and insufficient claims; no additional synthesis model.");
        return Ok(());
    }
    Err("clarification_budget_exceeded".into())
}
async fn execute(db: &Db, root: &Path, mut run: Run, model: &dyn Model) -> Result<Run, String> {
    if let Err(error) = drive(db, root, &mut run, model).await {
        run.status = match error.as_str() {
            "cancelled" => "cancelled",
            "timed_out" => "timed_out",
            _ => "failed",
        }
        .into();
        run.error = Some(error.clone());
        run.brief = None;
        for a in &mut run.agents {
            if a.status == "running" || a.status == "pending" {
                a.status = run.status.clone();
                a.error = Some(error.clone());
                a.finished_at = Some(now());
            }
        }
        event(&mut run, "parent", "stopped", &error);
    }
    run.finished_at = Some(now());
    // Cancellation may race the final join; the transaction vetoes success.
    if let Err(error) = checkpoint(db, &run) {
        if error != "cancelled" {
            return Err(error);
        }
        run.status = "cancelled".into();
        run.brief = None;
        run.error = Some(error);
        event(
            &mut run,
            "parent",
            "cancelled",
            "Cancellation won the final-save race.",
        );
        checkpoint(db, &run)?;
    }
    Ok(run)
}
fn begin(db: &Db, request: Start) -> Result<(Run, bool), String> {
    if request.id.len() < 8
        || request.id.len() > 80
        || !request
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
        || request.question.trim().is_empty()
        || request.question.chars().count() > 500
    {
        return Err("invalid_run_request".into());
    }
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    if let Some(raw) = tx
        .query_row(
            "SELECT record_json FROM research_verification_runs WHERE id=?1",
            [&request.id],
            |r| r.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    {
        let run: Run = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if run.question != request.question.trim() {
            return Err("run_id_scope_conflict".into());
        }
        return Ok((run, false));
    }
    let count: i64 = tx
        .query_row(
            "SELECT count(*) FROM research_verification_runs WHERE status='running'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if count > 0 {
        return Err("research_workflow_already_running".into());
    }
    let mut run = Run {
        id: request.id,
        graph: GRAPH.into(),
        question: request.question.trim().into(),
        status: "running".into(),
        started_at: now(),
        finished_at: None,
        deadline: (Utc::now() + chrono::Duration::seconds(DEADLINE_SECONDS)).to_rfc3339(),
        definition: json!({"graph":graph(),"agents":[definition(RESEARCH)?,definition(VERIFY)?],"skills":skills(),"scope":SOURCE_SCOPE,"maxSources":6,"maxClaims":5,"maxModelRequests":4,"maxClarifications":1,"deadlineSeconds":DEADLINE_SECONDS,"retries":0,"joinRule":"Join after the last dispatched verifier; conditional nodes may be skipped.","build":env!("CARGO_PKG_VERSION")}),
        sources: vec![],
        agents: vec![],
        messages: vec![],
        events: vec![],
        brief: None,
        error: None,
        evaluation: json!({"operatorFeedback":null}),
    };
    event(
        &mut run,
        "parent",
        "started",
        "Explicit operator request; Research sources only; no source, project or memory writes.",
    );
    let raw = serde_json::to_string(&run).unwrap();
    tx.execute(
        "INSERT INTO research_verification_runs(id,status,record_json) VALUES(?1,'running',?2)",
        params![run.id, raw],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO research_verification_checkpoints VALUES(?1,1,?2)",
        params![run.id, raw],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok((run, true))
}
fn prepare(db: &Db, root: &Path, request: Start, key: bool) -> Result<(Run, bool), String> {
    // Retrying an existing identity only inspects it, even if current dependencies changed.
    if let Ok(run) = load(&db, &request.id) {
        if run.question == request.question.trim() {
            return Ok((run, false));
        }
        return Err("run_id_scope_conflict".into());
    }
    available(key, root.join("02 - Research").is_dir())?;
    begin(db, request)
}
#[tauri::command]
pub fn start_research_verification(
    app: tauri::AppHandle,
    db: State<Db>,
    request: Start,
) -> Result<Run, String> {
    let root = super::get_vault_path();
    let (run, created) = prepare(&db, &root, request, has_key())?;
    if created {
        let task = run.clone();
        tauri::async_runtime::spawn(async move {
            let db = app.state::<Db>();
            if let Err(e) = execute(&db, &root, task, &LiveModel).await {
                eprintln!("[research-verification] persistence failure: {e}");
            }
        });
    }
    Ok(run)
}
#[tauri::command]
pub fn inspect_research_verification(db: State<Db>, id: String) -> Result<Run, String> {
    load(&db, &id)
}
#[tauri::command]
pub fn list_research_verifications(db: State<Db>) -> Result<Vec<Value>, String> {
    let c = db.0.lock().map_err(|e| e.to_string())?;
    let mut q = c
        .prepare("SELECT record_json FROM research_verification_runs ORDER BY rowid DESC LIMIT 30")
        .map_err(|e| e.to_string())?;
    let rows = q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.map(|raw|{let r:Run=serde_json::from_str(&raw.map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;Ok(json!({"id":r.id,"question":r.question,"status":r.status,"startedAt":r.started_at,"agentIds":r.agents.iter().map(|a|&a.definition.id).collect::<BTreeSet<_>>()}))}).collect()
}
fn cancel(db: &Db, id: &str) -> Result<(), String> {
    db.0.lock().map_err(|e|e.to_string())?.execute("UPDATE research_verification_runs SET cancel_requested=1 WHERE id=?1 AND status='running'",[id]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn cancel_research_verification(db: State<Db>, id: String) -> Result<(), String> {
    cancel(&db, &id)
}
#[tauri::command]
pub fn research_agent_catalog(db: State<Db>) -> Result<Value, String> {
    catalog(&db, &super::get_vault_path(), has_key())
}
fn catalog(db: &Db, root: &Path, credential_present: bool) -> Result<Value, String> {
    let availability = available(credential_present, root.join("02 - Research").is_dir());
    let c = db.0.lock().map_err(|e| e.to_string())?;
    let completed: i64 = c
        .query_row(
            "SELECT count(*) FROM delegation_runs WHERE phase='completed'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let count: i64 = c
        .query_row("SELECT count(*) FROM delegation_runs", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let pair_runs: i64 = c
        .query_row("SELECT count(*) FROM research_verification_runs", [], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    Ok(
        json!({"executable":[definition(RESEARCH)?,definition(VERIFY)?],"availability":{"readyToAttempt":availability.is_ok(),"reason":availability.err(),"providerAccess":"Not tested by catalog; credentials present does not prove model access or credit.","checkedAt":now()},"evaluation":{"recordedParentRuns":pair_runs,"quality":"Unevaluated; inspect actual outputs and request receipts."},"codingDelegate":{"name":"Coding Delegate","implementation":"Implemented; existing Claude Code adapter","version":null,"versionNote":"Legacy handler has no compiled AgentDefinition version; not retrofitted in this slice.","model":models::CODING_MODEL,"skills":[],"sources":"Explicit approved project/worktree scope","capabilities":"Existing separately approved planning and implementation stages","prohibitedEffects":"No message in this graph can invoke it or transfer operator consent.","graphs":["Existing Coding Delegate workflow"],"availability":"Driver detected in September 23 audit (2.1.222); not re-probed by this read-only catalog.","recordedRuns":count,"completedRuns":completed,"operationalStatus":if completed==0{"Unproven / potentially dormant"}else{"Completed run evidence exists; inspect Coding Delegate review"},"location":"Existing project delegation panel"},"orchestrator":{"id":"olympus","name":"Olympus","role":"Parent dispatch, scope, budgets, cancellation, validation and deterministic brief"},"documentedCandidates":["Research Analyst","Project Architect","Daily Briefing Officer","Obsidian Curator","Codebase Navigator"],"externalRoles":["Codex Strategy General","Codex Project Soldier"],"documentationNote":"Agent Index audit snapshot, September 23, 2026. Authored status does not establish runtime availability. Operator notes are unchanged. Research Agent does not silently convert the Research Analyst note into an executor.","graph":{"id":GRAPH,"nodes":graph()},"skills":skills()}),
    )
}

#[cfg(test)]
mod tests;
