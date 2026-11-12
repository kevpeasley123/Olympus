//! One normalized activity stream for every agent run (`docs/AGENT-EVENTS.md`).
//!
//! Engines report work in their own formats. This module reduces each report to
//! a small engine-neutral event, stores it, and emits it to the dashboard, so
//! the activity feed, the Pantheon figures and usage telemetry all read the
//! same record of what an agent actually did.
//!
//! Tool results are recorded as an outcome only. Their content can hold file or
//! mail text and is never stored or emitted from here.

use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

use super::persistence::Db;

pub const EVENT_NAME: &str = "agent-event";
const SUMMARY_LIMIT: usize = 160;
const DETAIL_LIMIT: usize = 2000;
const DEFAULT_PAGE: i64 = 200;
const MAX_PAGE: i64 = 1000;

/// An event before it has a row: what a normalizer produces.
#[derive(Clone, Debug, PartialEq)]
pub struct Draft {
    pub kind: &'static str,
    pub summary: String,
    pub detail: Option<String>,
    pub tool: Option<String>,
    pub path: Option<String>,
    /// True when a helper agent started by the run did this, not the run's own agent.
    pub subagent: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentEvent {
    pub id: i64,
    pub run_id: String,
    pub engine: String,
    pub agent: String,
    pub kind: String,
    pub summary: String,
    pub detail: Option<String>,
    pub tool: Option<String>,
    pub path: Option<String>,
    pub subagent: bool,
    pub created_at: String,
}

fn clip(text: &str, limit: usize) -> String {
    let text = text.trim();
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut clipped: String = text.chars().take(limit.saturating_sub(1)).collect();
    clipped.push('…');
    clipped
}

fn first_line(text: &str) -> &str {
    text.trim().lines().next().unwrap_or("")
}

fn file_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().filter(|name| !name.is_empty()).unwrap_or(path)
}

fn text_field<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str).filter(|text| !text.trim().is_empty())
}

fn draft(kind: &'static str, summary: String, subagent: bool) -> Draft {
    Draft { kind, summary: clip(&summary, SUMMARY_LIMIT), detail: None, tool: None, path: None, subagent }
}

/// Olympus's own tools read as what they did, not as a function name.
fn olympus_tool(tool: &str, input: &Value) -> String {
    let about = |verb: &str| text_field(input, "query").map_or(verb.to_string(), |query| format!("{verb} for {query}"));
    match tool {
        "search_mail" => about("Searched mail"),
        "read_mail_thread" => "Read a mail thread".into(),
        "recall_memory" => about("Recalled memory"),
        "search_vault" => about("Searched the vault"),
        "read_vault_note" => format!("Read {}", text_field(input, "path").map(file_name).unwrap_or("a vault note")),
        "list_projects" => "Checked the project list".into(),
        other => format!("Used {other}"),
    }
}

fn tool_use(name: &str, input: &Value, subagent: bool) -> Draft {
    let path = ["file_path", "notebook_path", "path"].iter().find_map(|key| text_field(input, key));
    let mut event = match name {
        "Read" => draft("file_read", format!("Read {}", path.map(file_name).unwrap_or("a file")), subagent),
        "Edit" | "MultiEdit" | "Write" | "NotebookEdit" => {
            draft("file_edit", format!("Edited {}", path.map(file_name).unwrap_or("a file")), subagent)
        }
        "Glob" | "Grep" => {
            draft("search", format!("Searched for {}", text_field(input, "pattern").unwrap_or("a pattern")), subagent)
        }
        "Bash" => {
            let command = text_field(input, "command").unwrap_or("a command");
            let mut event = draft("command", format!("Ran {}", first_line(command)), subagent);
            event.detail = Some(clip(command, DETAIL_LIMIT));
            event
        }
        "Task" | "Agent" => {
            let purpose = text_field(input, "description").unwrap_or("a delegated step");
            draft("subagent_started", format!("Started a helper: {purpose}"), subagent)
        }
        _ => match name.strip_prefix("mcp__").and_then(|rest| rest.split_once("__")) {
            Some((server, tool)) if server == super::tool_server::SERVER_NAME => draft("tool_call", olympus_tool(tool, input), subagent),
            Some((server, tool)) => draft("tool_call", format!("Called {tool} on {server}"), subagent),
            None => draft("tool_call", format!("Used {name}"), subagent),
        },
    };
    event.tool = Some(name.to_string());
    // Which file, exactly: two reads of one name may be two different paths, or a repeat.
    if matches!(event.kind, "file_read" | "file_edit") || name == super::tool_server::qualified("read_vault_note") {
        event.path = path.map(str::to_string);
    }
    event
}

/// Reduces one line of Claude Code's `--output-format stream-json` to events.
/// Lines that are not JSON, or carry nothing worth showing, yield none.
pub fn normalize_claude_line(line: &str) -> Vec<Draft> {
    serde_json::from_str::<Value>(line).map(|value| normalize_claude_value(&value)).unwrap_or_default()
}

/// The same reduction for a frame that is already parsed.
pub fn normalize_claude_value(value: &Value) -> Vec<Draft> {
    let subagent = value.get("parent_tool_use_id").is_some_and(|parent| !parent.is_null());
    let blocks = || {
        value.get("message").and_then(|message| message.get("content")).and_then(Value::as_array).cloned().unwrap_or_default()
    };

    match value.get("type").and_then(Value::as_str) {
        Some("system") if value.get("subtype").and_then(Value::as_str) == Some("init") => {
            let model = text_field(value, "model").unwrap_or("the selected model");
            vec![draft("run_started", format!("Session started on {model}"), subagent)]
        }
        Some("assistant") => blocks()
            .iter()
            .filter_map(|block| match block.get("type").and_then(Value::as_str) {
                Some("thinking") => {
                    let mut event = draft("thinking", "Thinking".into(), subagent);
                    if let Some(thought) = text_field(block, "thinking") {
                        event.summary = clip(first_line(thought), SUMMARY_LIMIT);
                        event.detail = Some(clip(thought, DETAIL_LIMIT));
                    }
                    Some(event)
                }
                Some("text") => text_field(block, "text").map(|text| {
                    let mut event = draft("message", first_line(text).to_string(), subagent);
                    event.detail = Some(clip(text, DETAIL_LIMIT));
                    event
                }),
                Some("tool_use") => Some(tool_use(
                    block.get("name").and_then(Value::as_str).unwrap_or("tool"),
                    block.get("input").unwrap_or(&Value::Null),
                    subagent,
                )),
                _ => None,
            })
            .collect(),
        // Only failures are worth a line; a success is implied by the next step.
        Some("user") => blocks()
            .iter()
            .filter(|block| {
                block.get("type").and_then(Value::as_str) == Some("tool_result")
                    && block.get("is_error").and_then(Value::as_bool) == Some(true)
            })
            .map(|_| draft("tool_failed", "A tool call failed".into(), subagent))
            .collect(),
        Some("result") => {
            let succeeded = value.get("subtype").and_then(Value::as_str) == Some("success")
                && value.get("is_error").and_then(Value::as_bool) != Some(true);
            let turns = value.get("num_turns").and_then(Value::as_u64);
            let mut event = if succeeded {
                draft("result", turns.map_or("Finished".into(), |n| format!("Finished in {n} turns")), subagent)
            } else {
                let reason = text_field(value, "subtype").unwrap_or("error").replace('_', " ");
                draft("error", format!("Stopped: {reason}"), subagent)
            };
            // Measurements only. The result text is the run's deliverable and is kept by its owner.
            let measured: serde_json::Map<String, Value> = ["num_turns", "duration_ms", "usage", "total_cost_usd"]
                .iter()
                .filter_map(|key| value.get(*key).map(|v| ((*key).to_string(), v.clone())))
                .collect();
            if !measured.is_empty() {
                event.detail = Some(clip(&Value::Object(measured).to_string(), DETAIL_LIMIT));
            }
            vec![event]
        }
        _ => Vec::new(),
    }
}

fn row_to_event(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgentEvent> {
    Ok(AgentEvent {
        id: row.get(0)?,
        run_id: row.get(1)?,
        engine: row.get(2)?,
        agent: row.get(3)?,
        kind: row.get(4)?,
        summary: row.get(5)?,
        detail: row.get(6)?,
        tool: row.get(7)?,
        path: row.get(8)?,
        subagent: row.get::<_, i64>(9)? != 0,
        created_at: row.get(10)?,
    })
}

const COLUMNS: &str = "id, run_id, engine, agent, kind, summary, detail, tool, path, subagent, created_at";

pub fn insert(connection: &Connection, run_id: &str, engine: &str, agent: &str, event: &Draft) -> rusqlite::Result<AgentEvent> {
    connection.execute(
        "INSERT INTO agent_events (run_id, engine, agent, kind, summary, detail, tool, path, subagent) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![run_id, engine, agent, event.kind, event.summary, event.detail, event.tool, event.path, event.subagent as i64],
    )?;
    connection.query_row(
        &format!("SELECT {COLUMNS} FROM agent_events WHERE id = ?1"),
        [connection.last_insert_rowid()],
        row_to_event,
    )
}

/// The most recent `limit` events after `after`, oldest first.
pub fn list(connection: &Connection, run_id: Option<&str>, after: Option<i64>, limit: Option<i64>) -> rusqlite::Result<Vec<AgentEvent>> {
    let limit = limit.unwrap_or(DEFAULT_PAGE).clamp(1, MAX_PAGE);
    let mut statement = connection.prepare(&format!(
        "SELECT {COLUMNS} FROM agent_events WHERE (?1 IS NULL OR run_id = ?1) AND id > ?2 ORDER BY id DESC LIMIT ?3"
    ))?;
    let mut events = statement
        .query_map(params![run_id, after.unwrap_or(0), limit], row_to_event)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    events.reverse();
    Ok(events)
}

/// Stores and emits. A failure here must never interrupt the run being observed.
pub fn record(app: &AppHandle, run_id: &str, engine: &str, agent: &str, events: Vec<Draft>) {
    if events.is_empty() {
        return;
    }
    let db = app.state::<Db>();
    let stored: Vec<AgentEvent> = match db.0.lock() {
        Ok(connection) => events.iter().filter_map(|event| insert(&connection, run_id, engine, agent, event).ok()).collect(),
        Err(_) => return,
    };
    for event in stored {
        let _ = app.emit(EVENT_NAME, event);
    }
}

static APP: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

/// Set once at startup, so background jobs that hold no handle can report.
pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

fn job_engine(provider: &str) -> &str {
    match provider {
        "codex-subscription" => "codex",
        "claude-subscription" => "claude-code",
        other => other,
    }
}

/// The Armory role credited for a background job, from its recorded purpose.
fn job_agent(purpose: &str) -> &'static str {
    if purpose.contains("verif") && !purpose.starts_with("research") {
        "verification"
    } else if purpose.starts_with("research") {
        "research"
    } else {
        "olympus"
    }
}

fn job_label(purpose: &str) -> String {
    let words = purpose.replace('_', " ");
    let mut letters = words.chars();
    letters.next().map_or_else(String::new, |first| first.to_uppercase().chain(letters).collect())
}

/// One event describing where a single-request job stands. Jobs are one model
/// call with no tools, so they report a start and an outcome and nothing between.
pub fn job_event(record: &super::models::RequestRecord) -> Option<Draft> {
    let label = job_label(&record.purpose);
    let seconds = |ms: u64| format!("{:.0} s", (ms as f64 / 1000.0).max(1.0));
    let mut event = match record.status.as_str() {
        "completed" => draft(
            "result",
            record.latency_ms.map_or(format!("Finished {label}"), |ms| format!("Finished {label} in {}", seconds(ms))),
            false,
        ),
        "failed" => draft("error", format!("Stopped {label}"), false),
        "blocked" => draft("error", format!("Blocked {label}"), false),
        "cancelled" => draft("error", format!("Cancelled {label}"), false),
        _ => {
            let model = if record.requested_model.is_empty() { "the selected model" } else { &record.requested_model };
            return Some(draft("run_started", format!("{label} on {model}"), false));
        }
    };
    let measured = serde_json::json!({
        "model": record.actual_model.as_deref().unwrap_or(&record.requested_model),
        "latency_ms": record.latency_ms,
        "usage": record.usage,
        "reason": record.error_code.as_deref().map(|reason| clip(reason, SUMMARY_LIMIT)),
    });
    event.detail = Some(clip(&measured.to_string(), DETAIL_LIMIT));
    Some(event)
}

/// Reports a background job's current state. Silent before `init`, as in tests.
pub fn record_job(record: &super::models::RequestRecord) {
    if let (Some(app), Some(event)) = (APP.get(), job_event(record)) {
        self::record(app, &record.id, job_engine(&record.provider), job_agent(&record.purpose), vec![event]);
    }
}

pub fn record_claude_line(app: &AppHandle, run_id: &str, agent: &str, line: &str) {
    record(app, run_id, "claude-code", agent, normalize_claude_line(line));
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EngineUsage {
    pub engine: String,
    pub runs: i64,
    pub failed: i64,
    pub seconds: f64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    /// What the engine itself reported a run would cost at API rates. For Claude
    /// Code this is the closest reading Olympus has of headless credit spent.
    pub reported_cost_usd: f64,
}

/// What Olympus observed each engine do over the last `days`, from run outcomes.
/// It counts only what passed through the event stream, so it is a floor, not
/// the account's own meter.
pub fn usage(connection: &Connection, days: i64) -> rusqlite::Result<Vec<EngineUsage>> {
    let mut statement = connection.prepare(
        "SELECT engine, kind, detail FROM agent_events WHERE kind IN ('result', 'error') AND subagent = 0 \
         AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1) ORDER BY engine",
    )?;
    let window = format!("-{} days", days.clamp(1, 365));
    let rows = statement.query_map([window], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?)))?;
    let mut totals: Vec<EngineUsage> = Vec::new();
    for row in rows {
        let (engine, kind, detail) = row?;
        if totals.last().map(|total| total.engine.as_str()) != Some(engine.as_str()) {
            totals.push(EngineUsage { engine, ..Default::default() });
        }
        let total = totals.last_mut().expect("just pushed");
        total.runs += 1;
        total.failed += (kind == "error") as i64;
        let measured: Value = detail.as_deref().and_then(|text| serde_json::from_str(text).ok()).unwrap_or(Value::Null);
        let milliseconds = measured["duration_ms"].as_f64().or_else(|| measured["latency_ms"].as_f64()).unwrap_or(0.0);
        total.seconds += milliseconds / 1000.0;
        total.input_tokens += measured["usage"]["input_tokens"].as_i64().unwrap_or(0);
        total.output_tokens += measured["usage"]["output_tokens"].as_i64().unwrap_or(0);
        total.reported_cost_usd += measured["total_cost_usd"].as_f64().unwrap_or(0.0);
    }
    Ok(totals)
}

#[tauri::command]
pub fn agent_usage(db: State<Db>, days: Option<i64>) -> Result<Vec<EngineUsage>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    usage(&connection, days.unwrap_or(7)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn agent_events(db: State<Db>, run_id: Option<String>, after: Option<i64>, limit: Option<i64>) -> Result<Vec<AgentEvent>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    list(&connection, run_id.as_deref(), after, limit).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        connection
    }

    fn assistant(content: Value) -> String {
        json!({"type": "assistant", "parent_tool_use_id": null, "message": {"content": content}}).to_string()
    }

    #[test]
    fn tool_uses_become_specific_events() {
        let events = normalize_claude_line(&assistant(json!([
            {"type": "tool_use", "name": "Read", "input": {"file_path": "C:\\repo\\src\\main.rs"}},
            {"type": "tool_use", "name": "Edit", "input": {"file_path": "/repo/src/lib.rs"}},
            {"type": "tool_use", "name": "Grep", "input": {"pattern": "fn main"}},
            {"type": "tool_use", "name": "Bash", "input": {"command": "cargo test --lib\necho done"}},
            {"type": "tool_use", "name": "Task", "input": {"description": "Check the migrations"}},
            {"type": "tool_use", "name": "mcp__olympus__search_mail", "input": {"query": "keyboard order"}},
            {"type": "tool_use", "name": "mcp__olympus__read_vault_note", "input": {"path": "01 - Projects/Olympus.md"}},
            {"type": "tool_use", "name": "mcp__olympus__list_projects", "input": {}},
            {"type": "tool_use", "name": "mcp__other__lookup", "input": {}},
            {"type": "tool_use", "name": "WebSearch", "input": {}}
        ])));
        let seen: Vec<(&str, &str)> = events.iter().map(|e| (e.kind, e.summary.as_str())).collect();
        assert_eq!(seen, vec![
            ("file_read", "Read main.rs"),
            ("file_edit", "Edited lib.rs"),
            ("search", "Searched for fn main"),
            ("command", "Ran cargo test --lib"),
            ("subagent_started", "Started a helper: Check the migrations"),
            ("tool_call", "Searched mail for keyboard order"),
            ("tool_call", "Read Olympus.md"),
            ("tool_call", "Checked the project list"),
            ("tool_call", "Called lookup on other"),
            ("tool_call", "Used WebSearch"),
        ]);
        assert_eq!(events[0].path.as_deref(), Some("C:\\repo\\src\\main.rs"));
        assert_eq!(events[6].path.as_deref(), Some("01 - Projects/Olympus.md"), "a vault read records which note");
        assert!(events[5].path.is_none() && events[7].path.is_none());
        assert_eq!(events[3].detail.as_deref(), Some("cargo test --lib\necho done"));
        assert_eq!(events[3].tool.as_deref(), Some("Bash"));
        assert!(events[2].path.is_none());
    }

    #[test]
    fn thinking_and_text_keep_a_bounded_excerpt() {
        let long = "x".repeat(5000);
        let events = normalize_claude_line(&assistant(json!([
            {"type": "thinking", "thinking": ""},
            {"type": "thinking", "thinking": "The schema needs a new table.\nThen a command."},
            {"type": "text", "text": long},
            {"type": "text", "text": "  "}
        ])));
        assert_eq!(events.len(), 3);
        assert_eq!((events[0].kind, events[0].summary.as_str(), events[0].detail.as_deref()), ("thinking", "Thinking", None));
        assert_eq!(events[1].summary, "The schema needs a new table.");
        assert_eq!(events[2].kind, "message");
        assert_eq!(events[2].summary.chars().count(), SUMMARY_LIMIT);
        assert_eq!(events[2].detail.as_ref().unwrap().chars().count(), DETAIL_LIMIT);
    }

    #[test]
    fn tool_result_content_is_never_recorded() {
        let line = json!({"type": "user", "message": {"content": [
            {"type": "tool_result", "content": "SECRET FILE BODY"},
            {"type": "tool_result", "is_error": true, "content": "SECRET ERROR BODY"}
        ]}})
        .to_string();
        let events = normalize_claude_line(&line);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "tool_failed");
        assert!(!format!("{events:?}").contains("SECRET"));
    }

    #[test]
    fn helper_work_is_marked_and_results_carry_measurements_only() {
        let helper = json!({"type": "assistant", "parent_tool_use_id": "toolu_1", "message": {"content": [
            {"type": "tool_use", "name": "Read", "input": {"file_path": "a.md"}}
        ]}})
        .to_string();
        assert!(normalize_claude_line(&helper)[0].subagent);

        let done = json!({"type": "result", "subtype": "success", "is_error": false, "num_turns": 7,
            "duration_ms": 1200, "result": "PRIVATE ANSWER", "usage": {"input_tokens": 10, "output_tokens": 4}})
        .to_string();
        let event = &normalize_claude_line(&done)[0];
        assert_eq!((event.kind, event.summary.as_str()), ("result", "Finished in 7 turns"));
        let detail = event.detail.as_ref().unwrap();
        assert!(detail.contains("\"input_tokens\":10") && !detail.contains("PRIVATE"));

        let stopped = json!({"type": "result", "subtype": "error_max_turns", "is_error": true}).to_string();
        let event = &normalize_claude_line(&stopped)[0];
        assert_eq!((event.kind, event.summary.as_str()), ("error", "Stopped: error max turns"));
    }

    #[test]
    fn unknown_and_malformed_lines_yield_nothing() {
        assert!(normalize_claude_line("not json").is_empty());
        assert!(normalize_claude_line(r#"{"type":"system","subtype":"hook"}"#).is_empty());
        assert!(normalize_claude_line(r#"{"type":"stream_event"}"#).is_empty());
        let started = normalize_claude_line(r#"{"type":"system","subtype":"init","model":"claude-opus-5"}"#);
        assert_eq!(started[0].summary, "Session started on claude-opus-5");
    }

    #[test]
    fn a_job_reports_its_start_and_outcome_with_measurements_only() {
        let route = crate::commands::models::resolve(crate::commands::models::Capability::Primary);
        let mut job = crate::commands::models::RequestRecord::new(&route, "briefing_investigation");
        job.provider = "codex-subscription".into();
        job.requested_model = "gpt-test".into();
        let started = job_event(&job).unwrap();
        assert_eq!((started.kind, started.summary.as_str()), ("run_started", "Briefing investigation on gpt-test"));

        job.status = "completed".into();
        job.latency_ms = Some(61_170);
        job.actual_model = Some("gpt-test-actual".into());
        let done = job_event(&job).unwrap();
        assert_eq!((done.kind, done.summary.as_str()), ("result", "Finished Briefing investigation in 61 s"));
        assert!(done.detail.as_ref().unwrap().contains("gpt-test-actual"));

        job.status = "blocked".into();
        job.error_code = Some("allowance ceiling".into());
        let blocked = job_event(&job).unwrap();
        assert_eq!((blocked.kind, blocked.summary.as_str()), ("error", "Blocked Briefing investigation"));
        assert!(blocked.detail.as_ref().unwrap().contains("allowance ceiling"));

        assert_eq!(job_engine("codex-subscription"), "codex");
        assert_eq!(job_engine("claude-subscription"), "claude-code");
        assert_eq!(job_engine("ollama"), "ollama");
        assert_eq!(job_agent("research_verification"), "research");
        assert_eq!(job_agent("claim_verification"), "verification");
        assert_eq!(job_agent("memory_contribution"), "olympus");
    }

    #[test]
    fn usage_totals_come_from_run_outcomes_per_engine() {
        let connection = db();
        let outcome = |kind: &'static str, detail: Value| Draft { detail: Some(detail.to_string()), ..draft(kind, "x".into(), false) };
        insert(&connection, "a", "claude-code", "olympus", &outcome("result", json!({"duration_ms": 61_000, "usage": {"input_tokens": 1200, "output_tokens": 300}, "total_cost_usd": 0.42}))).unwrap();
        insert(&connection, "b", "claude-code", "olympus", &outcome("error", json!({"duration_ms": 4_000}))).unwrap();
        insert(&connection, "c", "codex", "research", &outcome("result", json!({"latency_ms": 72_810, "usage": {"billing_status": "included_subscription"}}))).unwrap();
        insert(&connection, "c", "codex", "research", &draft("message", "not an outcome".into(), false)).unwrap();
        let mut helper = outcome("result", json!({"duration_ms": 9_000}));
        helper.subagent = true;
        insert(&connection, "a", "claude-code", "olympus", &helper).unwrap();
        connection.execute("INSERT INTO agent_events (run_id, engine, agent, kind, summary, created_at) VALUES ('old', 'codex', 'olympus', 'result', 'x', '2020-01-01T00:00:00.000Z')", []).unwrap();

        let totals = usage(&connection, 7).unwrap();
        assert_eq!(totals.len(), 2);
        let claude = &totals[0];
        assert_eq!((claude.engine.as_str(), claude.runs, claude.failed, claude.input_tokens, claude.output_tokens), ("claude-code", 2, 1, 1200, 300));
        assert!((claude.seconds - 65.0).abs() < 0.01 && (claude.reported_cost_usd - 0.42).abs() < 1e-9);
        let codex = &totals[1];
        assert_eq!((codex.engine.as_str(), codex.runs, codex.failed), ("codex", 1, 0));
        assert!((codex.seconds - 72.81).abs() < 0.01 && codex.reported_cost_usd == 0.0);
    }

    #[test]
    fn events_are_stored_in_order_and_paged() {
        let connection = db();
        for (run, text) in [("a", "one"), ("b", "two"), ("a", "three")] {
            let event = draft("message", text.into(), false);
            insert(&connection, run, "claude-code", "coding-delegate", &event).unwrap();
        }
        let all = list(&connection, None, None, None).unwrap();
        assert_eq!(all.iter().map(|e| e.summary.as_str()).collect::<Vec<_>>(), ["one", "two", "three"]);
        assert!(all.iter().all(|e| e.engine == "claude-code" && !e.created_at.is_empty()));

        let run_a = list(&connection, Some("a"), None, None).unwrap();
        assert_eq!(run_a.iter().map(|e| e.summary.as_str()).collect::<Vec<_>>(), ["one", "three"]);

        let newest = list(&connection, None, None, Some(1)).unwrap();
        assert_eq!(newest[0].summary, "three");
        let after = list(&connection, None, Some(all[0].id), None).unwrap();
        assert_eq!(after.len(), 2);
    }
}
