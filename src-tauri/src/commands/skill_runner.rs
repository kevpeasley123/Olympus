//! Runs a skill on an engine with Olympus's own tools (`docs/SKILL-RUNNER.md`).
//!
//! A skill is a contract: a goal, the tools it may use, a budget and a test of
//! its answer. The runner starts the selected engine in tool mode, passes every
//! step to the activity stream, and accepts the answer only if it passes the
//! skill's test. Nothing a skill returns is shown as an operator decision, and
//! a trial skill never replaces the workflow it is being compared with.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use super::agent_events::{self, Draft};
use super::persistence::Db;
use super::tool_server;
use super::workflow::SkillContract;

pub const EVENT_NAME: &str = "agent-run-updated";
const CLAUDE: &str = "claude-code";

pub struct Skill {
    pub id: &'static str,
    pub version: u32,
    pub title: &'static str,
    /// The Armory role credited in the activity stream.
    pub agent: &'static str,
    pub purpose: &'static str,
    pub instructions: &'static str,
    pub tools: &'static [&'static str],
    pub max_turns: u32,
    pub limit: Duration,
    pub success_criteria: &'static str,
    pub output_schema: fn() -> Value,
    /// The skill's own test of a schema-valid answer, given the tools the run actually called.
    pub accept: fn(&Value, &BTreeSet<String>) -> Result<(), String>,
}

const BRIEF_INSTRUCTIONS: &str = "You are Olympus preparing Kevin's opening brief. Use the tools to find what has actually changed for him: search recent mail for things that need him (orders, deliveries, bills, security notices, replies from people), check his projects, and recall what Olympus has learned about how he wants briefs. Read a thread before relying on it.\n\nThen answer with one JSON object and nothing else, matching the schema you are given.\n\nRules for the brief:\n- Conversational and short: what changed, why it matters to Kevin, and whether he needs to act. At most 120 words in `brief`.\n- No subject-line lists, no routine receipts or sign-in notices unless they signal a problem, and nothing about how the brief was made.\n- Every item cites the tool results it rests on. Do not state anything you did not find with a tool.\n- A suggestion is not Kevin's decision. Say what you suggest, never that he has decided it.\n- If the tools show nothing worth his attention, say so plainly with an empty `items` list.\n- `coverage` says in one sentence what you looked at and anything you could not check.";

fn brief_schema() -> Value {
    json!({
        "type": "object", "additionalProperties": false, "required": ["brief", "items", "coverage"],
        "properties": {
            "brief": {"type": "string", "maxLength": 1200},
            "coverage": {"type": "string", "maxLength": 400},
            "items": {"type": "array", "maxItems": 6, "items": {
                "type": "object", "additionalProperties": false, "required": ["headline", "why", "actionNeeded", "sources"],
                "properties": {
                    "headline": {"type": "string", "maxLength": 160},
                    "why": {"type": "string", "maxLength": 400},
                    "actionNeeded": {"type": "boolean"},
                    "sources": {"type": "array", "minItems": 1, "maxItems": 4, "items": {
                        "type": "object", "additionalProperties": false, "required": ["tool", "reference"],
                        "properties": {"tool": {"type": "string", "enum": tool_server::TOOLS}, "reference": {"type": "string", "maxLength": 300}}
                    }}
                }
            }}
        }
    })
}

/// A brief may only cite tools the run really called, and must fit its spoken length.
fn accept_brief(answer: &Value, called: &BTreeSet<String>) -> Result<(), String> {
    let brief = answer["brief"].as_str().unwrap_or("").trim();
    if brief.is_empty() {
        return Err("The brief has no text.".into());
    }
    if brief.split_whitespace().count() > 140 {
        return Err("The brief is longer than its spoken limit.".into());
    }
    let items = answer["items"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    if !items.is_empty() && called.is_empty() {
        return Err("The brief makes claims but the run used no tools.".into());
    }
    for item in items {
        for source in item["sources"].as_array().map(Vec::as_slice).unwrap_or(&[]) {
            let tool = source["tool"].as_str().unwrap_or("");
            if !called.contains(tool) {
                return Err(format!("The brief cites `{tool}`, which this run never called."));
            }
        }
    }
    Ok(())
}

pub const SKILLS: &[Skill] = &[Skill {
    id: "opening-brief",
    version: 1,
    title: "Opening brief (trial)",
    agent: "olympus",
    purpose: "Tell Kevin what changed, why it matters and whether he needs to act, from his mail, projects and learned memory.",
    instructions: BRIEF_INSTRUCTIONS,
    tools: &["search_mail", "read_mail_thread", "recall_memory", "list_projects", "read_vault_note"],
    max_turns: 16,
    limit: Duration::from_secs(300),
    success_criteria: "A schema-valid brief of at most 140 words whose every item cites a tool this run actually called.",
    output_schema: brief_schema,
    accept: accept_brief,
}];

pub fn skill(id: &str) -> Option<&'static Skill> {
    SKILLS.iter().find(|skill| skill.id == id)
}

impl Skill {
    /// The inspectable contract. Publishing it grants no execution authority.
    pub fn contract(&self) -> SkillContract {
        SkillContract {
            id: self.id.into(),
            version: self.version,
            purpose: self.purpose.into(),
            input_schema: json!({"type": "object", "properties": {}, "additionalProperties": false}),
            output_schema: (self.output_schema)(),
            allowed_capabilities: self.tools.iter().map(|tool| tool_server::qualified(tool)).collect(),
            prohibited_effects: vec!["Any write to mail, the vault, the database or a project".into(), "Any tool, file or network access outside Olympus's own tools".into()],
            evidence_requirements: "Every claim cites the Olympus tool result it rests on.".into(),
            loop_budget: self.max_turns as usize,
            success_criteria: self.success_criteria.into(),
            implementation: "skill_runner".into(),
        }
    }
    fn prompt(&self, today: &str) -> String {
        format!("Today is {today}. Produce the result now.\n\nAnswer schema:\n{}", (self.output_schema)())
    }
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkillRun {
    pub id: String,
    pub skill_id: String,
    pub skill_version: u32,
    pub engine: String,
    pub agent: String,
    pub status: String,
    pub model: Option<String>,
    pub output: Option<Value>,
    pub error: Option<String>,
    pub tool_calls: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
}

const COLUMNS: &str = "id, skill_id, skill_version, engine, agent, status, model, output_json, error, tool_calls, started_at, finished_at";

fn row_to_run(row: &rusqlite::Row<'_>) -> rusqlite::Result<SkillRun> {
    Ok(SkillRun {
        id: row.get(0)?,
        skill_id: row.get(1)?,
        skill_version: row.get(2)?,
        engine: row.get(3)?,
        agent: row.get(4)?,
        status: row.get(5)?,
        model: row.get(6)?,
        output: row.get::<_, Option<String>>(7)?.and_then(|text| serde_json::from_str(&text).ok()),
        error: row.get(8)?,
        tool_calls: row.get(9)?,
        started_at: row.get(10)?,
        finished_at: row.get(11)?,
    })
}

pub fn load(connection: &Connection, id: &str) -> rusqlite::Result<Option<SkillRun>> {
    connection.query_row(&format!("SELECT {COLUMNS} FROM agent_runs WHERE id = ?1"), [id], row_to_run).optional()
}

pub fn list(connection: &Connection, limit: i64) -> rusqlite::Result<Vec<SkillRun>> {
    let mut statement = connection.prepare(&format!("SELECT {COLUMNS} FROM agent_runs ORDER BY started_at DESC, id DESC LIMIT ?1"))?;
    let runs = statement.query_map([limit.clamp(1, 100)], row_to_run)?.collect();
    runs
}

/// Registers a run, refusing a second concurrent run of the same skill.
pub fn begin(connection: &Connection, id: &str, skill: &Skill, engine: &str) -> Result<SkillRun, String> {
    let running: i64 = connection
        .query_row("SELECT COUNT(*) FROM agent_runs WHERE skill_id = ?1 AND status = 'running'", [skill.id], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if running > 0 {
        return Err(format!("{} is already running.", skill.title));
    }
    connection
        .execute(
            "INSERT INTO agent_runs (id, skill_id, skill_version, engine, agent, status) VALUES (?1, ?2, ?3, ?4, ?5, 'running')",
            params![id, skill.id, skill.version, engine, skill.agent],
        )
        .map_err(|error| error.to_string())?;
    load(connection, id).map_err(|error| error.to_string())?.ok_or_else(|| "The run was not recorded.".into())
}

/// The result of an engine turn, before the skill's own test.
pub struct Turn {
    pub text: String,
    pub model: String,
    pub called: BTreeSet<String>,
    pub tool_calls: i64,
}

/// Applies the schema and the skill's test, and settles the run row either way.
pub fn finish(connection: &Connection, id: &str, skill: &Skill, turn: Result<Turn, String>) -> Result<SkillRun, String> {
    let judged = turn.and_then(|turn| {
        let checked = super::structured_output::extract_object(&turn.text, &(skill.output_schema)())?;
        let answer: Value = serde_json::from_str(&checked).map_err(|_| "The answer was not valid JSON.".to_string())?;
        (skill.accept)(&answer, &turn.called)?;
        Ok((answer, turn))
    });
    let settled = match &judged {
        Ok((answer, turn)) => connection.execute(
            "UPDATE agent_runs SET status = 'completed', model = ?2, output_json = ?3, error = NULL, tool_calls = ?4, \
             finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, turn.model, answer.to_string(), turn.tool_calls],
        ),
        Err(error) => connection.execute(
            "UPDATE agent_runs SET status = 'failed', error = ?2, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, error.chars().take(500).collect::<String>()],
        ),
    };
    settled.map_err(|error| error.to_string())?;
    load(connection, id).map_err(|error| error.to_string())?.ok_or_else(|| "The run was not recorded.".into())
}

/// A run still marked running at startup was cut off with the app; say so rather than leave it open.
pub fn recover(connection: &Connection) -> rusqlite::Result<usize> {
    connection.execute(
        "UPDATE agent_runs SET status = 'failed', error = 'Olympus closed before this run finished.', \
         finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE status = 'running'",
        [],
    )
}

/// The Olympus tools a stream frame calls, by their short names.
fn tools_called(frame: &Value) -> Vec<String> {
    let prefix = tool_server::qualified("");
    frame["message"]["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"] == "tool_use" && frame["type"] == "assistant")
        .filter_map(|block| block["name"].as_str().and_then(|name| name.strip_prefix(&prefix)).map(str::to_string))
        .collect()
}

fn note(kind: &'static str, summary: String) -> Draft {
    Draft { kind, summary, detail: None, tool: None, path: None, subagent: false }
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|folder| folder.join("olympus.sqlite")).map_err(|error| error.to_string())
}

fn run_on_claude(app: &AppHandle, run_id: &str, skill: &'static Skill) -> Result<Turn, String> {
    let app_data = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let executable = std::env::current_exe().map_err(|_| "Olympus could not locate its own executable.".to_string())?;
    let vault = super::get_vault_path();
    let policy = super::claude_subscription::ToolPolicy {
        mcp_config: tool_server::mcp_config(&executable, &database_path(app)?, vault.is_dir().then_some(vault.as_path())).to_string(),
        allowed: skill.tools.iter().map(|tool| tool_server::qualified(tool)).collect(),
        max_turns: skill.max_turns,
    };
    let mut called = BTreeSet::new();
    let mut tool_calls = 0;
    let mut observe = |frame: &Value| {
        for tool in tools_called(frame) {
            tool_calls += 1;
            called.insert(tool);
        }
        agent_events::record(app, run_id, CLAUDE, skill.agent, agent_events::normalize_claude_value(frame));
    };
    let today = chrono::Local::now().format("%A, %B %-d, %Y").to_string();
    let (text, model) = super::claude_subscription::run_agent(
        &app_data, None, skill.instructions, skill.prompt(&today), skill.limit, Arc::new(AtomicBool::new(false)), &policy, &mut observe,
    )?;
    Ok(Turn { text, model, called, tool_calls })
}

#[tauri::command]
pub fn skill_catalog() -> Vec<Value> {
    SKILLS
        .iter()
        .map(|skill| json!({"id": skill.id, "title": skill.title, "agent": skill.agent, "engines": [CLAUDE], "contract": skill.contract()}))
        .collect()
}

#[tauri::command]
pub fn list_skill_runs(db: State<Db>, limit: Option<i64>) -> Result<Vec<SkillRun>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    list(&connection, limit.unwrap_or(20)).map_err(|error| error.to_string())
}

/// Starts a skill run in the background and returns its row at once. The engine
/// is always chosen explicitly; nothing here falls back to another one.
#[tauri::command]
pub fn start_skill_run(app: AppHandle, db: State<Db>, skill_id: String, engine: String) -> Result<SkillRun, String> {
    let skill = skill(&skill_id).ok_or("Unknown skill.")?;
    if engine != CLAUDE {
        return Err("Skill runs are available on Claude Code only for now. Nothing was started.".into());
    }
    let run_id = format!("skill-{}", super::delegation::run_id());
    let run = {
        let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
        begin(&connection, &run_id, skill, &engine)?
    };
    agent_events::record(&app, &run_id, &engine, skill.agent, vec![note("run_started", format!("Started {}", skill.title))]);
    let worker = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let turn = run_on_claude(&worker, &run_id, skill);
        // The stream already reported a normal end; a refusal by Olympus's own checks is only known here.
        if let Err(error) = &turn {
            agent_events::record(&worker, &run_id, CLAUDE, skill.agent, vec![note("error", format!("Stopped: {}", error.chars().take(140).collect::<String>()))]);
        }
        let db = worker.state::<Db>();
        let settled = db.0.lock().ok().and_then(|connection| finish(&connection, &run_id, skill, turn).ok());
        if let Some(run) = settled {
            if run.status == "failed" {
                if let Some(error) = run.error.as_deref().filter(|error| error.starts_with("The ")) {
                    agent_events::record(&worker, &run_id, CLAUDE, skill.agent, vec![note("error", format!("Answer rejected: {error}"))]);
                }
            }
            let _ = worker.emit(EVENT_NAME, run);
        }
    });
    Ok(run)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        connection
    }
    fn brief() -> &'static Skill {
        skill("opening-brief").unwrap()
    }
    fn called(tools: &[&str]) -> BTreeSet<String> {
        tools.iter().map(|tool| tool.to_string()).collect()
    }
    fn turn(answer: Value, tools: &[&str]) -> Result<Turn, String> {
        Ok(Turn { text: answer.to_string(), model: "claude-test".into(), called: called(tools), tool_calls: tools.len() as i64 })
    }
    fn good() -> Value {
        json!({"brief": "One order shipped and arrives Friday. Nothing needs you today.", "coverage": "Checked recent mail and projects.",
            "items": [{"headline": "Order shipped", "why": "Arrives Friday.", "actionNeeded": false, "sources": [{"tool": "read_mail_thread", "reference": "thread 18c"}]}]})
    }

    #[test]
    fn every_skill_only_names_real_tools_and_publishes_a_contract() {
        for skill in SKILLS {
            assert!(skill.tools.iter().all(|tool| tool_server::TOOLS.contains(tool)), "{} names an unknown tool", skill.id);
            let contract = skill.contract();
            assert_eq!(contract.loop_budget, skill.max_turns as usize);
            assert!(contract.allowed_capabilities.iter().all(|name| name.starts_with("mcp__olympus__")));
            assert!(skill.prompt("Monday").contains("Answer schema"));
        }
        assert!(skill("missing").is_none());
        assert_eq!(skill_catalog()[0]["engines"], json!(["claude-code"]));
    }

    #[test]
    fn a_valid_brief_completes_the_run_with_its_answer() {
        let connection = db();
        let started = begin(&connection, "r1", brief(), "claude-code").unwrap();
        assert_eq!((started.status.as_str(), started.agent.as_str()), ("running", "olympus"));
        let done = finish(&connection, "r1", brief(), turn(good(), &["search_mail", "read_mail_thread"])).unwrap();
        assert_eq!(done.status, "completed");
        assert_eq!(done.output.unwrap()["items"][0]["headline"], "Order shipped");
        assert_eq!((done.model.as_deref(), done.tool_calls, done.error), (Some("claude-test"), 2, None));
        assert!(done.finished_at.is_some());
        assert_eq!(list(&connection, 10).unwrap().len(), 1);
    }

    #[test]
    fn an_answer_that_fails_the_skills_test_is_rejected_not_stored() {
        let connection = db();
        let cases: Vec<(Result<Turn, String>, &str)> = vec![
            (turn(good(), &["search_mail"]), "never called"),
            (turn(good(), &[]), "used no tools"),
            (turn(json!({"brief": "  ", "coverage": "x", "items": []}), &[]), "no text"),
            (turn(json!({"brief": "word ".repeat(150), "coverage": "x", "items": []}), &[]), "spoken limit"),
            (turn(json!({"brief": "ok", "items": []}), &[]), ""),
            (turn(json!({"brief": "ok", "coverage": "x", "items": [], "decision": "Kevin approved"}), &[]), ""),
            (turn(json!({"brief": "ok", "coverage": "x", "items": [{"headline": "h", "why": "w", "actionNeeded": true, "sources": []}]}), &["search_mail"]), ""),
            (turn(json!({"brief": "ok", "coverage": "x", "items": [{"headline": "h", "why": "w", "actionNeeded": true, "sources": [{"tool": "send_mail", "reference": "x"}]}]}), &["search_mail"]), ""),
            (Err("Claude did not establish that usage credits are disabled".into()), "usage credits"),
        ];
        for (index, (attempt, reason)) in cases.into_iter().enumerate() {
            let id = format!("r{index}");
            begin(&connection, &id, brief(), "claude-code").unwrap();
            let run = finish(&connection, &id, brief(), attempt).unwrap();
            assert_eq!(run.status, "failed", "case {index}");
            assert!(run.output.is_none(), "case {index} stored a rejected answer");
            assert!(run.error.as_deref().unwrap().contains(reason), "case {index}: {:?}", run.error);
        }
        // Nothing found is a valid brief, with no tools required.
        begin(&connection, "empty", brief(), "claude-code").unwrap();
        let quiet = turn(json!({"brief": "Nothing needs you today.", "coverage": "Mail and projects checked.", "items": []}), &["search_mail"]);
        assert_eq!(finish(&connection, "empty", brief(), quiet).unwrap().status, "completed");
    }

    #[test]
    fn one_run_per_skill_and_interrupted_runs_are_closed() {
        let connection = db();
        begin(&connection, "a", brief(), "claude-code").unwrap();
        assert!(begin(&connection, "b", brief(), "claude-code").unwrap_err().contains("already running"));
        assert_eq!(recover(&connection).unwrap(), 1);
        let closed = load(&connection, "a").unwrap().unwrap();
        assert_eq!(closed.status, "failed");
        assert!(closed.error.unwrap().contains("closed before"));
        assert!(begin(&connection, "b", brief(), "claude-code").is_ok());
    }

    #[test]
    fn only_olympus_tool_calls_from_the_model_are_counted() {
        let frame = json!({"type": "assistant", "message": {"content": [
            {"type": "text", "text": "x"},
            {"type": "tool_use", "name": "mcp__olympus__search_mail", "input": {}},
            {"type": "tool_use", "name": "Bash", "input": {}}
        ]}});
        assert_eq!(tools_called(&frame), ["search_mail"]);
        assert!(tools_called(&json!({"type": "user", "message": {"content": [{"type": "tool_use", "name": "mcp__olympus__search_mail"}]}})).is_empty());
    }
}
