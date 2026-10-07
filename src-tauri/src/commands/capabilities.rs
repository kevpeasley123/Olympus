//! Command's capability armory and mission projections. Read-only.
//!
//! Every Tool here is access Olympus can actually exercise through an existing
//! command, and every Skill is a compiled contract a workflow already runs.
//! Nothing is registered dynamically, read from Markdown or inferred from
//! helper functions: a capability appears only when source code implements it.
//! Selecting one in the UI invokes nothing.
//!
//! Missions are projections of the structured runs Olympus already persists
//! (Research Verification, Communication Intelligence and Situations,
//! Knowledge Audit, Coding delegation). A step's state comes only from that
//! run's own recorded events or phase, never from elapsed time.
use super::{
    acceptance, delegation, get_vault_path, gmail, models, persistence::Db, project_relevance,
    research_agents,
};
use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};
use tauri::State;

/// Stable display order around the ring, clockwise from the top.
pub const DOMAINS: [(&str, &str, &str); 8] = [
    ("communications", "Communications", "Mail understanding and situation briefings"),
    ("research", "Research", "Scoped evidence retrieval, synthesis and verification"),
    ("knowledge", "Knowledge", "The Obsidian vault: durable memory and decisions"),
    ("code", "Code", "Repository state and approved coding delegation"),
    ("reasoning", "Reasoning", "Backend-owned model routes"),
    ("voice", "Voice", "Spoken replies and transcription"),
    ("files", "Files", "Operator-chosen files and PDF text"),
    ("system", "System", "Handoffs to the operating system"),
];

/// Observed facts about this machine, gathered by the command and injectable
/// in tests, so the projection itself stays a pure function of its inputs.
#[derive(Clone, Debug)]
pub struct Environment {
    pub openai_key: bool,
    pub anthropic_key: bool,
    pub vault: bool,
    pub research: bool,
    pub git: Option<String>,
    pub claude_code: Result<String, String>,
    pub windows: bool,
    pub acceptance: bool,
}

impl Default for Environment {
    fn default() -> Self {
        Self {
            openai_key: false,
            anthropic_key: false,
            vault: false,
            research: false,
            git: None,
            claude_code: Err("not probed".into()),
            windows: false,
            acceptance: false,
        }
    }
}

fn on_path(name: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
        .map(|found| found.display().to_string())
}

fn key(name: &str) -> bool {
    std::env::var(name).is_ok_and(|value| !value.trim().is_empty())
}

impl Environment {
    fn observe() -> Self {
        let vault = get_vault_path();
        Self {
            openai_key: key("OPENAI_API_KEY"),
            anthropic_key: key("ANTHROPIC_API_KEY"),
            vault: vault.is_dir(),
            research: vault.join("02 - Research").is_dir(),
            git: on_path(if cfg!(windows) { "git.exe" } else { "git" }),
            claude_code: delegation::claude_executable().map(|path| path.display().to_string()),
            windows: cfg!(windows),
            acceptance: acceptance::active(),
        }
    }
}

/// `(count, most recent timestamp)` for a query, or unknown when the table is
/// missing or unreadable. Unknown renders as "not recorded", never as zero use.
fn usage(connection: &Connection, sql: &str, parameter: &str) -> Value {
    let result = connection
        .query_row(sql, [parameter], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .optional();
    match result {
        Ok(Some((count, last))) => json!({"count":count,"lastAt":last}),
        _ => Value::Null,
    }
}

fn state(available: bool) -> &'static str {
    if available {
        "AVAILABLE"
    } else {
        "UNAVAILABLE"
    }
}

const RUNS_BY_GRAPH: &str = "SELECT count(*), max(json_extract(payload_json,'$.startedAt')) FROM communication_runs WHERE json_extract(payload_json,'$.graph') LIKE ?1";
const MODEL_USE: &str = "SELECT count(*), max(json_extract(record_json,'$.requestedAt')) FROM model_requests WHERE json_extract(record_json,'$.requestedModel')=?1";

fn tools(connection: &Connection, env: &Environment) -> Vec<Value> {
    let account = gmail::store::account(connection).ok().flatten();
    let (gmail_available, gmail_detail) = if env.acceptance {
        (false, "Disabled in the acceptance profile. Gmail is not contacted.".to_string())
    } else {
        match &account {
            Some(a) if a.enabled && a.status == "authentication_required" => (false, format!("{} · authorization expired; reconnect in Preferences", a.email)),
            Some(a) if a.enabled => (true, format!("Connected · read-only · {} · last {} days", a.email, a.horizon_days)),
            _ => (false, "Not connected. Connect in Preferences › Gmail.".to_string()),
        }
    };
    let research_runs = usage(connection, "SELECT count(*), max(json_extract(record_json,'$.startedAt')) FROM research_verification_runs WHERE ?1<>''", "x");
    let delegation_runs = usage(connection, "SELECT count(*), max(started_at) FROM delegation_runs WHERE ?1<>''", "x");
    let route = |capability: models::Capability| models::resolve(capability);
    let primary = route(models::Capability::Primary);
    let deep = route(models::Capability::DeepReasoning);
    let claude = route(models::Capability::ClaudeComparison);
    let key_detail = |present: bool, provider: &str| if present {
        format!("{provider} credentials configured; provider access and credit are not probed here.")
    } else {
        format!("{provider} credentials unavailable in this process.")
    };
    vec![
        json!({"id":"gmail","kind":"tool","toolKind":"connection","name":"Gmail","domain":"communications",
            "state":state(gmail_available),"detail":gmail_detail,
            "capabilities":["Sync Inbox and Sent into a bounded local cache","Search cached mail","Read cached threads"],
            "authority":"Read-only (gmail.readonly). Olympus never sends, labels, archives or deletes mail.",
            "effects":["external_read","local_cache_write"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Communication Intelligence v4","Communication Situations v1"],
            "usage":usage(connection,"SELECT count(*), max(started_at) FROM gmail_sync_runs WHERE ?1<>''","x"),"usageUnit":"syncs"}),
        json!({"id":"pantheon","kind":"tool","toolKind":"source","name":"Pantheon library","domain":"research",
            "state":state(env.research),"detail":if env.research {"Research folder present in the vault."} else {"The vault's 02 - Research folder is unavailable."},
            "capabilities":["Rank tagged Research entries for a question","Excerpt entries with content fingerprints"],
            "authority":"Read-only retrieval. New entries are written only through the vault write gate.",
            "effects":["local_read"],"approval":"none",
            "usedBy":["olympus",research_agents::RESEARCH,research_agents::VERIFY],"workflows":["Research Verification v1","Knowledge Audit v1","Chat research context"],
            "usage":research_runs,"usageUnit":"research verification runs"}),
        json!({"id":"vault","kind":"tool","toolKind":"source","name":"Obsidian vault","domain":"knowledge",
            "state":state(env.vault),"detail":if env.vault {"Vault folder present."} else {"The vault folder is unavailable."},
            "capabilities":["Read durable memory and the Decision Log as context","Append profile observations","Promote decisions from chat","Write research entries and dashboard artifacts"],
            "authority":"Reads freely. Every write declares an intent, is proven contained and asks before touching anything Olympus did not author.",
            "effects":["local_read","gated_local_write"],"approval":"writes",
            "usedBy":["olympus"],"workflows":["Chat context","Memory promotion","Observations"],"usage":Value::Null,"usageUnit":null}),
        json!({"id":"obsidian","kind":"tool","toolKind":"handoff","name":"Obsidian app","domain":"knowledge",
            "state":state(env.vault),"detail":"Opens a vault note in Obsidian; Olympus stays put.",
            "capabilities":["Open a contained vault note in Obsidian"],
            "authority":"Handoff only. Paths are resolved inside the vault before opening.",
            "effects":["os_handoff"],"approval":"none","usedBy":["olympus"],"workflows":["Research library","Attachments"],"usage":Value::Null,"usageUnit":null}),
        json!({"id":"git","kind":"tool","toolKind":"local","name":"Git repositories","domain":"code",
            "state":state(env.git.is_some()),"detail":env.git.as_ref().map(|path|format!("git found at {path}")).unwrap_or_else(||"git was not found on PATH.".into()),
            "capabilities":["Scan the projects root","Read branch, commits and working-tree state"],
            "authority":"Read-only status. `git status` may refresh a repository's index.",
            "effects":["local_read"],"approval":"none","usedBy":["olympus","coding-delegate"],"workflows":["Project scan","Project delegation"],"usage":Value::Null,"usageUnit":null}),
        json!({"id":"claude-code","kind":"tool","toolKind":"executor","name":"Claude Code","domain":"code",
            "state":if env.acceptance || env.claude_code.is_err() {"UNAVAILABLE"} else {"AVAILABLE"},
            "detail":if env.acceptance {"Delegation launches are refused in the acceptance profile.".to_string()} else {match &env.claude_code {Ok(path)=>format!("Found at {path}; version is read when a run is prepared."),Err(reason)=>reason.clone()}},
            "capabilities":["Plan in an isolated worktree","Implement after a separate approval","Run recorded verification checks"],
            "authority":"Only the approved project, stage and worktree. Planning and implementation each require operator approval; completion requires recorded checks and review.",
            "effects":["execute_in_worktree"],"approval":"required","usedBy":["coding-delegate"],"workflows":["Project delegation"],
            "usage":delegation_runs,"usageUnit":"delegation runs"}),
        json!({"id":"model-primary","kind":"tool","toolKind":"model","name":primary.label,"domain":"reasoning",
            "state":state(env.openai_key),"detail":key_detail(env.openai_key,"OpenAI"),
            "capabilities":["Chat and voice reasoning","Structured agent and workflow output"],
            "authority":"Reasoning only; no tools, writes or approvals.","effects":["provider_request"],"approval":"none",
            "usedBy":["olympus",research_agents::RESEARCH,research_agents::VERIFY],"workflows":["Chat","Research Verification v1","Communication Intelligence v4","Communication Situations v1"],
            "model":primary.model,"usage":usage(connection,MODEL_USE,primary.model),"usageUnit":"model requests"}),
        json!({"id":"model-deep","kind":"tool","toolKind":"model","name":deep.label,"domain":"reasoning",
            "state":state(env.openai_key),"detail":key_detail(env.openai_key,"OpenAI"),
            "capabilities":["Explicit one-request deep analysis"],
            "authority":"Reasoning only; selected per request by the operator.","effects":["provider_request"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Chat"],"model":deep.model,"usage":usage(connection,MODEL_USE,deep.model),"usageUnit":"model requests"}),
        json!({"id":"model-claude","kind":"tool","toolKind":"model","name":claude.label,"domain":"reasoning",
            "state":state(env.anthropic_key),"detail":key_detail(env.anthropic_key,"Anthropic"),
            "capabilities":["Explicit comparison answers"],
            "authority":"Reasoning only; selected per request by the operator.","effects":["provider_request"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Chat"],"model":claude.model,"usage":usage(connection,MODEL_USE,claude.model),"usageUnit":"model requests"}),
        json!({"id":"realtime-voice","kind":"tool","toolKind":"model","name":"Realtime speech","domain":"voice",
            "state":state(env.openai_key),"detail":key_detail(env.openai_key,"OpenAI"),
            "capabilities":["Speak replies and the opening briefing","Voice conversation turns"],
            "authority":"Audio output only; reasoning stays on the chat route.","effects":["provider_request"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Voice replies"],"model":models::REALTIME_MODEL,"usage":usage(connection,MODEL_USE,models::REALTIME_MODEL),"usageUnit":"voice sessions"}),
        json!({"id":"transcription","kind":"tool","toolKind":"model","name":"Transcription","domain":"voice",
            "state":state(env.openai_key),"detail":key_detail(env.openai_key,"OpenAI"),
            "capabilities":["Transcribe the operator's microphone while voice is on"],
            "authority":"Runs only while the microphone is live.","effects":["provider_request"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Voice input"],"model":models::TRANSCRIPTION_MODEL,"usage":Value::Null,"usageUnit":null}),
        json!({"id":"file-attachments","kind":"tool","toolKind":"local","name":"File attachments","domain":"files",
            "state":"AVAILABLE","detail":"The operator picks each file; Olympus never browses the file system.",
            "capabilities":["Read an operator-chosen file","Extract PDF text","Copy into the vault's _attachments through the write gate"],
            "authority":"Only files the operator selects. Copies into the vault ask first.","effects":["local_read","gated_local_write"],"approval":"writes",
            "usedBy":["olympus"],"workflows":["Research Add Entry"],"usage":Value::Null,"usageUnit":null}),
        json!({"id":"quick-apps","kind":"tool","toolKind":"handoff","name":"Quick apps","domain":"system",
            "state":state(env.windows),"detail":if env.windows {"Launches a fixed list of apps and sites."} else {"Quick app launching is only wired for Windows."},
            "capabilities":["Open Spotify","Open Discord","Open X or YouTube in Firefox"],
            "authority":"A fixed allowlist of four targets; no arguments from chat.","effects":["os_handoff"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Tool rail"],"usage":Value::Null,"usageUnit":null}),
        json!({"id":"browser","kind":"tool","toolKind":"handoff","name":"Browser handoff","domain":"system",
            "state":"AVAILABLE","detail":"Opens http and https links in the system browser.",
            "capabilities":["Open a link from chat or the library in the system browser"],
            "authority":"Guarded opener; the app window never navigates away.","effects":["os_handoff"],"approval":"none",
            "usedBy":["olympus"],"workflows":["Chat","Research library"],"usage":Value::Null,"usageUnit":null}),
    ]
}

fn skills(connection: &Connection) -> Vec<Value> {
    let research_children = |role: &str| usage(connection, "SELECT count(*), max(json_extract(a.value,'$.startedAt')) FROM research_verification_runs r, json_each(r.record_json,'$.agents') a WHERE json_extract(a.value,'$.definition.id')=?1 AND json_extract(a.value,'$.startedAt') IS NOT NULL", role);
    let intelligence = usage(connection, RUNS_BY_GRAPH, "communication-intelligence/%");
    let situations = usage(connection, RUNS_BY_GRAPH, "communication-situations/%");
    let assess = gmail::communication_skills::registry()[0].clone();
    let relevance = project_relevance::contract();
    let contracts = research_agents::skills();
    let research = |id: &str| contracts.iter().find(|contract| contract.id == id).cloned();
    let mut skills = vec![
        json!({"id":"communication-assess","version":assess["version"],"kind":"skill","name":"Communication Assessment","domain":"communications",
            "purpose":assess["purpose"],"inputs":"Bounded cached threads (at most six, four messages each)","output":"Events, changes, operator impact and a proposed next move per thread",
            "effects":"None. Prohibited: Gmail writes, tasks, decisions, project writes, memory promotion.","allowedTools":["gmail","model-primary"],
            "usedBy":["olympus"],"workflows":["Communication Intelligence v4"],"usage":intelligence.clone(),"usageUnit":"analysis runs"}),
        json!({"id":"project-relevance","version":relevance["version"],"kind":"skill","name":"Project Relevance","domain":"communications",
            "purpose":relevance["purpose"],"inputs":"Assessed threads and tracked project metadata","output":"Source-linked project matches with confidence",
            "effects":"None.","allowedTools":["gmail","git"],
            "usedBy":["olympus"],"workflows":["Communication Intelligence v4"],"usage":intelligence,"usageUnit":"analysis runs"}),
        json!({"id":"situation-discovery","version":1,"kind":"skill","name":"Situation Discovery","domain":"communications",
            "purpose":"Group changed correspondence into ongoing real-world situations","inputs":"Changed cached threads, known situations, operator updates","output":"One grounded observation per thread",
            "effects":"None beyond publishing generated situations locally.","allowedTools":["gmail","model-primary"],
            "usedBy":["olympus"],"workflows":["Communication Situations v1"],"usage":situations.clone(),"usageUnit":"situation runs"}),
        json!({"id":"situation-briefing","version":1,"kind":"skill","name":"Situation Briefing","domain":"communications",
            "purpose":"Explain where each situation stands and the informative next moves","inputs":"Observations, selected research and operator updates","output":"One briefing per situation",
            "effects":"None beyond publishing generated briefings locally.","allowedTools":["gmail","pantheon","model-primary"],
            "usedBy":["olympus"],"workflows":["Communication Situations v1"],"usage":situations,"usageUnit":"situation runs"}),
    ];
    for (id, name, output, tools, agent) in [
        ("research-retrieval", "Research Retrieval", "Up to three ranked excerpts, 4,000 characters each", vec!["pantheon"], research_agents::RESEARCH),
        ("evidence-synthesis", "Evidence Synthesis", "At most five candidate claims with exact citations", vec!["pantheon", "model-primary"], research_agents::RESEARCH),
        ("claim-verification", "Claim Verification", "Supported / Contradicted / Insufficient per claim", vec!["pantheon", "model-primary"], research_agents::VERIFY),
    ] {
        let Some(contract) = research(id) else { continue };
        let usage = if id == "research-retrieval" {
            usage(connection, "SELECT count(*), max(json_extract(record_json,'$.startedAt')) FROM research_verification_runs WHERE ?1<>''", "x")
        } else {
            research_children(agent)
        };
        skills.push(json!({"id":id,"version":contract.version,"kind":"skill","name":name,"domain":"research",
            "purpose":contract.purpose,"inputs":if id=="research-retrieval" {"A question and the tagged Research entries".to_string()} else if id=="claim-verification" {"Candidate claims and the parent's evidence packet".to_string()} else {"A question and the parent's scoped excerpts".to_string()},
            "output":output,"effects":"None. Prohibited: source, project and memory writes, approvals, tool execution, web.","allowedTools":tools,
            "usedBy":if id=="research-retrieval" {json!(["olympus",research_agents::RESEARCH])} else {json!([agent])},
            "workflows":["Research Verification v1"],"usage":usage,"usageUnit":if id=="research-retrieval" {"research verification runs"} else {"agent executions"}}));
    }
    if let Ok(custom)=super::resource_intake::read_skills(connection){for s in custom{skills.push(json!({"id":s.id,"version":1,"kind":"skill","name":s.name,"domain":"research","purpose":"User-authored resource analysis instructions","instructions":s.instructions,"inputs":"An explicitly selected resource","output":"Reusable analysis guidance","effects":"Instructions only; no execution or tool authority","allowedTools":[],"usedBy":["olympus"],"workflows":["Resource review"],"usage":null,"usageUnit":null}));}}
    skills
}

/// What each runtime role is armed with, from its contract, never from UI copy.
fn agents(tools: &[Value], skills: &[Value]) -> Vec<Value> {
    let ids = |list: &[Value]| list.iter().map(|item| item["id"].clone()).collect::<Vec<_>>();
    let mut research = research_agents::definition(research_agents::RESEARCH).ok();
    let mut verification = research_agents::definition(research_agents::VERIFY).ok();
    let skill_ids = |definition: &mut Option<research_agents::AgentDefinition>| definition.take().map(|d| {
        d.skills.iter().map(|reference| reference.split('@').next().unwrap_or(reference).to_string()).collect::<Vec<_>>()
    }).unwrap_or_default();
    vec![
        json!({"id":"olympus","tools":ids(tools),"skills":ids(skills),"note":"Aggregate armory: every Tool and Skill a workflow or route can use."}),
        json!({"id":research_agents::RESEARCH,"tools":["pantheon","model-primary"],"skills":skill_ids(&mut research),
            "note":"Receives parent-selected Pantheon excerpts; the agent itself holds no tools, web or write authority."}),
        json!({"id":research_agents::VERIFY,"tools":["pantheon","model-primary"],"skills":skill_ids(&mut verification),
            "note":"Judges claims against the parent's evidence packet only."}),
        json!({"id":"coding-delegate","tools":["claude-code","git"],"skills":[],
            "note":"No versioned skill bindings; bounded to the approved project, stage and worktree."}),
    ]
}

pub fn snapshot(connection: &Connection, env: &Environment) -> Value {
    let tools = tools(connection, env);
    let skills = skills(connection);
    let agents = agents(&tools, &skills);
    let domains: Vec<Value> = DOMAINS
        .iter()
        .map(|(id, label, summary)| {
            let owned = |list: &[Value]| list.iter().filter(|item| item["domain"] == *id).count();
            let available = tools.iter().chain(skills.iter()).filter(|item| item["domain"] == *id && item["state"] != "UNAVAILABLE").count();
            json!({"id":id,"label":label,"summary":summary,"tools":owned(&tools),"skills":owned(&skills),"available":available})
        })
        .collect();
    json!({"observedAt":chrono::Utc::now().to_rfc3339(),"acceptance":env.acceptance,"domains":domains,"tools":tools,"skills":skills,"agents":agents})
}

#[tauri::command]
pub fn command_capabilities(db: State<Db>) -> Result<Value, String> {
    let env = Environment::observe();
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    Ok(snapshot(&connection, &env))
}

// ---- Missions --------------------------------------------------------------

/// A run's recorded node state, reduced to the Mission View's vocabulary.
fn step_state(recorded: Option<&str>, run_running: bool) -> &'static str {
    match recorded {
        Some("completed" | "finished" | "checked" | "published") => "completed",
        Some("skipped" | "not_dispatched") => "skipped",
        Some("failed" | "source_failed" | "stopped" | "error" | "cancelled") => "failed",
        Some(_) if run_running => "active",
        Some(_) => "completed",
        None if run_running => "pending",
        None => "not-run",
    }
}

fn run_status(status: &str) -> &'static str {
    match status {
        "running" => "running",
        "completed" | "complete" => "completed",
        "cancelled" | "canceled" => "cancelled",
        "interrupted" => "interrupted",
        "waiting" | "awaiting_review" | "proposed" => "waiting",
        _ if status.contains("fail") => "failed",
        _ => "completed",
    }
}

/// Capabilities a graph node exercises, from the workflow's own contract.
fn node_capabilities(graph: &str, node: &str) -> (Option<&'static str>, Vec<&'static str>, Vec<&'static str>) {
    // (agent, tools, skills)
    match (graph, node) {
        (g, "scope") if g.starts_with("research-verification") => (None, vec!["pantheon"], vec!["research-retrieval"]),
        (g, "research" | "clarification") if g.starts_with("research-verification") => (Some("research"), vec!["model-primary"], vec!["evidence-synthesis"]),
        (g, "verification" | "reverification") if g.starts_with("research-verification") => (Some("verification"), vec!["model-primary"], vec!["claim-verification"]),
        (g, "snapshot" | "select") if g.starts_with("communication-") => (None, vec!["gmail"], vec![]),
        (g, "assess") if g.starts_with("communication-intelligence") => (None, vec!["gmail", "model-primary"], vec!["communication-assess"]),
        (g, "project") if g.starts_with("communication-intelligence") => (None, vec!["git"], vec!["project-relevance"]),
        (g, "discover") if g.starts_with("communication-situations") => (None, vec!["gmail", "model-primary"], vec!["situation-discovery"]),
        (g, "brief") if g.starts_with("communication-situations") => (None, vec!["pantheon", "model-primary"], vec!["situation-briefing"]),
        (g, "research") if g.starts_with("knowledge-audit") => (None, vec!["pantheon"], vec![]),
        (g, "history" | "reviews" | "inspect") if g.starts_with("knowledge-audit") => (None, vec!["vault"], vec![]),
        _ => (None, vec![], vec![]),
    }
}

const STEP_LABELS: [(&str, &str); 22] = [
    ("scope", "Select scoped sources"), ("research", "Research: candidate claims"), ("verification", "Verify claims"),
    ("clarification", "Clarify insufficient claims"), ("reverification", "Re-verify"), ("join", "Assemble the brief"),
    ("snapshot", "Read the mail cache"), ("select", "Select threads"), ("assess", "Assess threads"),
    ("project", "Match to projects"), ("synthesize", "Validate and join"), ("discover", "Discover situations"),
    ("brief", "Brief situations"), ("validate", "Validate grounding"), ("publish", "Publish locally"),
    ("history", "Check prior findings"), ("reviews", "Read review checkpoints"), ("verify", "Verify findings"),
    ("route", "Route the outcome"), ("planning", "Plan in the worktree"), ("editing", "Implement"), ("reviewing", "Operator review"),
];
fn label(node: &str) -> String {
    STEP_LABELS.iter().find(|(id, _)| *id == node).map(|(_, text)| text.to_string()).unwrap_or_else(|| node.replace('_', " "))
}

/// Steps from a graph definition plus the last recorded state per node.
fn graph_steps(graph: &str, nodes: &[String], events: &[(String, String)], running: bool) -> Vec<Value> {
    nodes
        .iter()
        .map(|node| {
            let recorded = events.iter().rev().find(|(n, _)| n == node).map(|(_, s)| s.as_str());
            let (agent, tools, skills) = node_capabilities(graph, node);
            json!({"id":node,"label":label(node),"state":step_state(recorded,running),"recorded":recorded,"agent":agent,"tools":tools,"skills":skills})
        })
        .collect()
}

fn node_ids(definition: &Value) -> Vec<String> {
    definition.as_array().map(|nodes| nodes.iter().filter_map(|node| node["id"].as_str().map(str::to_string)).collect()).unwrap_or_default()
}

fn research_missions(connection: &Connection, limit: i64) -> Vec<Value> {
    let Ok(mut query) = connection.prepare("SELECT record_json FROM research_verification_runs ORDER BY rowid DESC LIMIT ?1") else { return vec![] };
    let rows = query.query_map([limit], |row| row.get::<_, String>(0)).map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
    rows.into_iter().filter_map(|raw| serde_json::from_str::<Value>(&raw).ok()).map(|run| {
        let graph = run["graph"].as_str().unwrap_or(research_agents::GRAPH).to_string();
        let running = run["status"] == "running";
        let events: Vec<(String, String)> = run["events"].as_array().map(|events| events.iter().filter_map(|e| Some((e["node"].as_str()?.to_string(), e["state"].as_str()?.to_string()))).collect()).unwrap_or_default();
        let mut steps = graph_steps(&graph, &node_ids(&run["definition"]), &events, running);
        // Agent nodes take their state from the agent executions themselves.
        let agents = run["agents"].as_array().cloned().unwrap_or_default();
        for step in &mut steps {
            let role = match step["id"].as_str() { Some("research") | Some("clarification") => "research", Some("verification") | Some("reverification") => "verification", _ => continue };
            let round = if matches!(step["id"].as_str(), Some("clarification") | Some("reverification")) { 1 } else { 0 };
            if let Some(agent) = agents.iter().find(|a| a["definition"]["id"] == role && a["round"] == round) {
                let status = agent["status"].as_str().unwrap_or("");
                step["state"] = json!(match status { "completed" => "completed", "failed" | "cancelled" => "failed", "running" => "active", _ if running => "pending", _ => "not-run" });
                step["recorded"] = json!(status);
            }
        }
        let brief = &run["brief"];
        let result = if brief.is_object() {
            json!({"summary":format!("{} supported · {} contradicted · {} insufficient",brief["supported"].as_array().map_or(0,Vec::len),brief["contradicted"].as_array().map_or(0,Vec::len),brief["insufficient"].as_array().map_or(0,Vec::len)),"detail":brief["notice"]})
        } else if let Some(error) = run["error"].as_str() { json!({"summary":"Stopped before a brief","detail":error}) } else { Value::Null };
        json!({"id":run["id"],"kind":"research-verification","workflow":"Research Verification v1","title":"Research verification","request":run["question"],
            "status":run_status(run["status"].as_str().unwrap_or("")),"startedAt":run["startedAt"],"finishedAt":run["finishedAt"],
            "steps":steps,"approval":Value::Null,"result":result,"destination":"research","source":"research_verification_runs"})
    }).collect()
}

fn communication_missions(connection: &Connection, limit: i64) -> Vec<Value> {
    let Ok(mut query) = connection.prepare("SELECT id, payload_json FROM communication_runs ORDER BY rowid DESC LIMIT ?1") else { return vec![] };
    let rows = query.query_map([limit], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
    rows.into_iter().filter_map(|(id, raw)| Some((id, serde_json::from_str::<Value>(&raw).ok()?))).map(|(id, run)| {
        let graph = run["graph"].as_str().unwrap_or("communication").to_string();
        let running = run["status"] == "running";
        let events: Vec<(String, String)> = connection.prepare("SELECT node, state FROM communication_events WHERE run_id=?1 ORDER BY sequence")
            .and_then(|mut q| q.query_map([&id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map(|rows| rows.filter_map(Result::ok).collect()))
            .unwrap_or_default();
        let situations = graph.starts_with("communication-situations");
        let items = run["items"].as_array().map_or(0, Vec::len);
        json!({"id":id,"kind":if situations {"communication-situations"} else {"communication-intelligence"},
            "workflow":if situations {"Communication Situations v1"} else {"Communication Intelligence"},
            "title":if situations {"Situation refresh"} else {"Thread analysis"},
            "request":if situations {json!(run["phase"].as_str().unwrap_or("Refresh situations from changed correspondence"))} else {json!(format!("Analyze the last {} days of cached mail", run["days"].as_i64().unwrap_or(0)))},
            "status":run_status(run["status"].as_str().unwrap_or("")),"startedAt":run["startedAt"],"finishedAt":run["finishedAt"],
            "steps":graph_steps(&graph,&node_ids(&run["definition"]),&events,running),"approval":Value::Null,
            "result":if run["status"]=="running" {Value::Null} else if let Some(error)=run["error"].as_str() {json!({"summary":"Stopped","detail":error})} else {json!({"summary":format!("{items} {} recorded", if items==1 {"item"} else {"items"})})},
            "destination":"communications","source":"communication_runs"})
    }).collect()
}

fn audit_missions(connection: &Connection, limit: i64) -> Vec<Value> {
    let Ok(mut query) = connection.prepare("SELECT id, payload_json FROM knowledge_audit_runs ORDER BY rowid DESC LIMIT ?1") else { return vec![] };
    let rows = query.query_map([limit], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
    rows.into_iter().filter_map(|(id, raw)| Some((id, serde_json::from_str::<Value>(&raw).ok()?))).map(|(id, run)| {
        let running = run["status"] == "running";
        let events: Vec<(String, String)> = connection.prepare("SELECT node, state FROM knowledge_audit_events WHERE run_id=?1 ORDER BY sequence")
            .and_then(|mut q| q.query_map([&id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map(|rows| rows.filter_map(Result::ok).collect()))
            .unwrap_or_default();
        json!({"id":id,"kind":"knowledge-audit","workflow":"Knowledge Audit v1","title":"Knowledge audit","request":run["topic"],
            "status":run_status(run["status"].as_str().unwrap_or("")),"startedAt":run["startedAt"],"finishedAt":run["finishedAt"],
            "steps":graph_steps("knowledge-audit",&node_ids(&run["definition"]),&events,running),"approval":Value::Null,
            "result":if let Some(report)=run["report"].as_object() {json!({"summary":report.get("outcome").cloned().unwrap_or(Value::Null),"detail":report.get("verification").cloned().unwrap_or(Value::Null)})} else if let Some(error)=run["error"].as_str() {json!({"summary":"Stopped","detail":error})} else {Value::Null},
            "destination":"research","source":"knowledge_audit_runs"})
    }).collect()
}

/// Delegation phases are linear apart from waiting, failure and cancellation.
const DELEGATION_STEPS: [&str; 5] = ["planning", "editing", "testing", "reviewing", "awaiting_review"];
fn delegation_missions(connection: &Connection, limit: i64) -> Vec<Value> {
    let Ok(mut query) = connection.prepare("SELECT id, project_name, task, phase, milestone, outcome, error, started_at, updated_at FROM delegation_runs ORDER BY rowid DESC LIMIT ?1") else { return vec![] };
    let rows = query.query_map([limit], |r| Ok((r.get::<_,String>(0)?, r.get::<_,String>(1)?, r.get::<_,String>(2)?, r.get::<_,String>(3)?, r.get::<_,Option<String>>(4)?, r.get::<_,Option<String>>(5)?, r.get::<_,Option<String>>(6)?, r.get::<_,Option<String>>(7)?, r.get::<_,Option<String>>(8)?)))
        .map(|rows| rows.filter_map(Result::ok).collect::<Vec<_>>()).unwrap_or_default();
    rows.into_iter().map(|(id, project, task, phase, milestone, outcome, error, started, updated)| {
        let reached = DELEGATION_STEPS.iter().position(|step| *step == phase);
        let live = matches!(phase.as_str(), "planning" | "editing" | "testing" | "reviewing" | "preparing" | "approved");
        let steps: Vec<Value> = DELEGATION_STEPS.iter().enumerate().map(|(index, step)| {
            let state = match (reached, phase.as_str()) {
                (_, "complete") => "completed",
                (Some(at), _) if index < at => "completed",
                (Some(at), _) if index == at => if *step == "awaiting_review" { "waiting" } else { "active" },
                (None, "waiting") if index == 0 => "completed",
                (None, "failed" | "cancelled") => "not-run",
                _ => "pending",
            };
            let (tools, agent): (Vec<&str>, Option<&str>) = match *step { "planning" | "editing" | "testing" => (vec!["claude-code", "git"], Some("coding-delegate")), _ => (vec![], None) };
            json!({"id":step,"label":if *step=="awaiting_review" {"Awaiting operator review".to_string()} else {label(step)},"state":state,"recorded":if Some(index)==reached {json!(phase)} else {Value::Null},"agent":agent,"tools":tools,"skills":[]})
        }).collect();
        let approval = match phase.as_str() {
            "waiting" => json!({"required":true,"detail":"The plan is ready. Implementation needs a separate approval in Project mode."}),
            "awaiting_review" => json!({"required":true,"detail":"Completion needs recorded checks and the operator's review in Project mode."}),
            _ => Value::Null,
        };
        json!({"id":id,"kind":"coding-delegation","workflow":"Project delegation","title":format!("Delegation · {project}"),"request":task,
            "status":if live {"running"} else {run_status(&phase)},"phase":phase,"startedAt":started,"finishedAt":if live {Value::Null} else {json!(updated)},
            "steps":steps,"approval":approval,
            "result":if let Some(error)=error {json!({"summary":"Stopped","detail":error})} else if let Some(outcome)=outcome {json!({"summary":milestone.unwrap_or_default(),"detail":outcome})} else {Value::Null},
            "destination":"project","source":"delegation_runs"})
    }).collect()
}

/// Running missions first, then the most recent, across every structured run.
pub fn missions(connection: &Connection, limit: i64) -> Value {
    let mut all = research_missions(connection, limit);
    all.extend(communication_missions(connection, limit));
    all.extend(audit_missions(connection, limit));
    all.extend(delegation_missions(connection, limit));
    all.sort_by(|a, b| {
        let live = |m: &Value| m["status"] == "running" || m["status"] == "waiting";
        live(b).cmp(&live(a)).then_with(|| b["startedAt"].as_str().unwrap_or("").cmp(a["startedAt"].as_str().unwrap_or("")))
    });
    all.truncate(limit.max(0) as usize);
    json!({"observedAt":chrono::Utc::now().to_rfc3339(),"missions":all})
}

#[tauri::command]
pub fn command_missions(db: State<Db>) -> Result<Value, String> {
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    Ok(missions(&connection, 6))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c
    }
    fn env() -> Environment {
        Environment { openai_key: true, anthropic_key: false, vault: true, research: true, git: Some("/usr/bin/git".into()), claude_code: Err("Claude Code was not found.".into()), windows: false, acceptance: false }
    }
    fn ids(list: &Value) -> Vec<String> {
        list.as_array().unwrap().iter().map(|item| item["id"].as_str().unwrap().to_string()).collect()
    }

    #[test]
    fn the_armory_lists_only_implemented_tools_and_compiled_skills() {
        let c = db();
        let before = c.total_changes();
        let view = snapshot(&c, &env());
        assert_eq!(c.total_changes(), before, "the projection is read-only");
        assert_eq!(ids(&view["skills"]), ["communication-assess", "project-relevance", "situation-discovery", "situation-briefing", "research-retrieval", "evidence-synthesis", "claim-verification"]);
        assert_eq!(ids(&view["tools"]), ["gmail", "pantheon", "vault", "obsidian", "git", "claude-code", "model-primary", "model-deep", "model-claude", "realtime-voice", "transcription", "file-attachments", "quick-apps", "browser"]);
        // Every item names a real domain, and counts are derived from items.
        let domains = ids(&view["domains"]);
        assert_eq!(domains.len(), 8);
        let total: u64 = view["domains"].as_array().unwrap().iter().map(|d| d["tools"].as_u64().unwrap() + d["skills"].as_u64().unwrap()).sum();
        assert_eq!(total as usize, view["tools"].as_array().unwrap().len() + view["skills"].as_array().unwrap().len());
        for item in view["tools"].as_array().unwrap().iter().chain(view["skills"].as_array().unwrap()) {
            assert!(domains.contains(&item["domain"].as_str().unwrap().to_string()), "{item}");
        }
        // Skill versions come from the contracts, not from copy.
        let versions: Vec<u64> = view["skills"].as_array().unwrap().iter().map(|s| s["version"].as_u64().unwrap()).collect();
        assert_eq!(versions, [2, 2, 1, 1, 1, 1, 1]);
    }

    #[test]
    fn availability_is_observed_not_assumed() {
        let c = db();
        let view = snapshot(&c, &env());
        let tool = |id: &str| view["tools"].as_array().unwrap().iter().find(|t| t["id"] == id).unwrap().clone();
        assert_eq!(tool("gmail")["state"], "UNAVAILABLE", "no account row means not connected");
        assert_eq!(tool("claude-code")["state"], "UNAVAILABLE");
        assert_eq!(tool("model-claude")["state"], "UNAVAILABLE");
        assert_eq!(tool("model-primary")["state"], "AVAILABLE");
        assert_eq!(tool("quick-apps")["state"], "UNAVAILABLE", "Windows only");
        c.execute("INSERT INTO gmail_accounts(id,email,enabled,status,scopes,connected_at) VALUES('a','op@example.invalid',1,'connected','readonly','2026-09-01')", []).unwrap();
        let mut accepted = env();
        let connected = snapshot(&c, &accepted);
        assert_eq!(connected["tools"][0]["state"], "AVAILABLE");
        accepted.acceptance = true;
        let isolated = snapshot(&c, &accepted);
        assert_eq!(isolated["tools"][0]["state"], "UNAVAILABLE", "the acceptance profile never contacts Gmail");
        let claude = isolated["tools"].as_array().unwrap().iter().find(|t| t["id"] == "claude-code").unwrap();
        assert!(claude["detail"].as_str().unwrap().contains("acceptance"));
    }

    /// The Agent Catalog and the armory describe the same bindings.
    #[test]
    fn agent_lenses_match_their_contracts_and_the_catalog() {
        let c = db();
        let view = snapshot(&c, &env());
        let agent = |id: &str| view["agents"].as_array().unwrap().iter().find(|a| a["id"] == id).unwrap().clone();
        assert_eq!(agent("research")["skills"], json!(["research-retrieval", "evidence-synthesis"]));
        assert_eq!(agent("verification")["skills"], json!(["claim-verification"]));
        assert_eq!(agent("coding-delegate")["skills"], json!([]));
        assert_eq!(agent("coding-delegate")["tools"], json!(["claude-code", "git"]));
        assert_eq!(agent("olympus")["tools"].as_array().unwrap().len(), view["tools"].as_array().unwrap().len());
        let catalog = super::super::command_agents::snapshot_for_tests(&c);
        for role in catalog["agents"].as_array().unwrap() {
            let id = role["id"].as_str().unwrap();
            let listed: Vec<&str> = role["skills"].as_array().unwrap().iter().map(|s| s["id"].as_str().unwrap().split('@').next().unwrap()).collect();
            let lens = agent(id);
            let armed: Vec<&str> = lens["skills"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
            assert_eq!(listed, armed, "{id}");
        }
        // Every bound id exists in the armory.
        for lens in view["agents"].as_array().unwrap() {
            for tool in lens["tools"].as_array().unwrap() { assert!(view["tools"].as_array().unwrap().iter().any(|t| &t["id"] == tool), "{tool}"); }
            for skill in lens["skills"].as_array().unwrap() { assert!(view["skills"].as_array().unwrap().iter().any(|s| &s["id"] == skill), "{skill}"); }
        }
    }

    #[test]
    fn usage_counts_come_from_persisted_runs() {
        let c = db();
        let run = json!({"id":"rv1","graph":research_agents::GRAPH,"question":"q","status":"completed","startedAt":"2026-09-28T10:00:00Z","agents":[{"definition":{"id":"research"},"round":0,"status":"completed","startedAt":"2026-09-28T10:00:01Z"}]});
        c.execute("INSERT INTO research_verification_runs(id,status,record_json) VALUES('rv1','completed',?1)", params![run.to_string()]).unwrap();
        let view = snapshot(&c, &env());
        let skill = |id: &str| view["skills"].as_array().unwrap().iter().find(|s| s["id"] == id).unwrap().clone();
        assert_eq!(skill("evidence-synthesis")["usage"]["count"], 1);
        assert_eq!(skill("claim-verification")["usage"]["count"], 0);
        assert_eq!(skill("research-retrieval")["usage"]["lastAt"], "2026-09-28T10:00:00Z");
    }

    #[test]
    fn a_running_research_mission_reports_only_recorded_progress() {
        let c = db();
        let definition = serde_json::to_value(research_agents::graph()).unwrap();
        let run = json!({"id":"rv","graph":research_agents::GRAPH,"question":"Does X hold?","status":"running","startedAt":"2026-09-29T01:00:00Z","finishedAt":null,
            "definition":definition,"events":[{"node":"scope","state":"completed"}],
            "agents":[{"definition":{"id":"research"},"round":0,"status":"running","startedAt":"2026-09-29T01:00:02Z"}],"brief":null,"error":null});
        c.execute("INSERT INTO research_verification_runs(id,status,record_json) VALUES('rv','running',?1)", params![run.to_string()]).unwrap();
        let view = missions(&c, 6);
        let mission = &view["missions"][0];
        assert_eq!(mission["status"], "running");
        assert_eq!(mission["request"], "Does X hold?");
        let states: Vec<&str> = mission["steps"].as_array().unwrap().iter().map(|s| s["state"].as_str().unwrap()).collect();
        assert_eq!(states, ["completed", "active", "pending", "pending", "pending", "pending"]);
        assert_eq!(mission["steps"][1]["agent"], "research");
        assert_eq!(mission["steps"][1]["skills"], json!(["evidence-synthesis"]));
        assert_eq!(mission["steps"][0]["tools"], json!(["pantheon"]));
    }

    #[test]
    fn finished_runs_never_show_active_steps_and_delegation_waits_for_approval() {
        let c = db();
        let run = json!({"id":"a1","graph":"knowledge-audit/v1","topic":"agents","status":"completed","startedAt":"2026-09-29T00:00:00Z","finishedAt":"2026-09-29T00:01:00Z",
            "definition":[{"id":"scope"},{"id":"research"},{"id":"verify"}],"report":{"outcome":"no_findings","verification":"checked"}});
        c.execute("INSERT INTO knowledge_audit_runs(id,status,payload_json) VALUES('a1','completed',?1)", params![run.to_string()]).unwrap();
        c.execute("INSERT INTO knowledge_audit_events(run_id,node,state,detail,at) VALUES('a1','scope','finished','','t'),('a1','research','started','','t')", []).unwrap();
        c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone,started_at) VALUES ('d','p','P','Fix it','drv','m','waiting','w','b','c','s','Plan ready','2026-09-29T02:00:00Z')", []).unwrap();
        let view = missions(&c, 6);
        let all = view["missions"].as_array().unwrap();
        assert_eq!(all[0]["kind"], "coding-delegation", "live work sorts first");
        assert_eq!(all[0]["approval"]["required"], true);
        assert_eq!(all[0]["steps"][0]["state"], "completed");
        let audit = all.iter().find(|m| m["kind"] == "knowledge-audit").unwrap();
        assert!(audit["steps"].as_array().unwrap().iter().all(|s| s["state"] != "active" && s["state"] != "pending"));
        assert_eq!(audit["steps"][2]["state"], "not-run", "no event recorded for verify");
        assert_eq!(audit["result"]["summary"], "no_findings");
    }

    #[test]
    fn an_empty_database_has_no_missions() {
        assert_eq!(missions(&db(), 6)["missions"], json!([]));
    }
    /// Writes `src/services/capabilitiesFixture.json` for the Command harnesses
    /// from the real projection over a synthetic database, so the fixture's
    /// shape cannot drift from the backend's. Run with
    /// `OLYMPUS_CAPABILITIES_FIXTURE=<path> cargo test --lib write_capability_fixture -- --ignored`.
    #[test]
    #[ignore = "writes the synthetic Command fixture; run explicitly"]
    fn write_capability_fixture() {
        let path = std::env::var("OLYMPUS_CAPABILITIES_FIXTURE").expect("set OLYMPUS_CAPABILITIES_FIXTURE");
        let c = db();
        c.execute("INSERT INTO gmail_accounts(id,email,enabled,status,scopes,connected_at,horizon_days) VALUES('synthetic','operator@example.invalid',1,'connected','readonly','2026-09-01T09:00:00Z',90)", []).unwrap();
        c.execute("INSERT INTO gmail_sync_runs(id,account_id,started_at,status,mode) VALUES('s1','synthetic','2026-09-29T08:40:00Z','succeeded','incremental')", []).unwrap();
        let definition = serde_json::to_value(research_agents::graph()).unwrap();
        let completed = json!({"id":"rv-complete","graph":research_agents::GRAPH,"question":"Does evidence-first review reduce rework?","status":"completed","startedAt":"2026-09-29T07:10:00Z","finishedAt":"2026-09-29T07:12:40Z",
            "definition":definition,"events":[{"node":"scope","state":"completed"},{"node":"clarification","state":"not_dispatched"},{"node":"join","state":"completed"}],
            "agents":[{"definition":{"id":"research"},"round":0,"status":"completed","startedAt":"2026-09-29T07:10:02Z"},{"definition":{"id":"verification"},"round":0,"status":"completed","startedAt":"2026-09-29T07:11:20Z"}],
            "brief":{"supported":[{},{}],"contradicted":[],"insufficient":[{}],"notice":"Model judgment over three library excerpts; not proof of truth."},"error":null});
        let running = json!({"id":"rv-running","graph":research_agents::GRAPH,"question":"What does the library say about approval gates for agents?","status":"running","startedAt":"2026-09-29T09:00:00Z","finishedAt":null,
            "definition":definition,"events":[{"node":"scope","state":"completed"}],
            "agents":[{"definition":{"id":"research"},"round":0,"status":"completed","startedAt":"2026-09-29T09:00:02Z"},{"definition":{"id":"verification"},"round":0,"status":"running","startedAt":"2026-09-29T09:01:10Z"}],"brief":null,"error":null});
        c.execute("INSERT INTO research_verification_runs(id,status,record_json) VALUES('rv-complete','completed',?1)", params![completed.to_string()]).unwrap();
        let idle = snapshot(&c, &env());
        let finished = missions(&c, 6);
        c.execute("INSERT INTO research_verification_runs(id,status,record_json) VALUES('rv-running','running',?1)", params![running.to_string()]).unwrap();
        let active = missions(&c, 6);
        let mail_definition = serde_json::to_value(gmail::intelligence::definition()).unwrap();
        let mail = json!({"id":"ci-running","graph":"communication-intelligence/v4","definition":mail_definition,"status":"running","days":7,"startedAt":"2026-09-29T09:05:00Z","finishedAt":null,"items":[]});
        c.execute("DELETE FROM research_verification_runs WHERE id='rv-running'", []).unwrap();
        c.execute("INSERT INTO communication_runs(id,account_id,days,status,payload_json) VALUES('ci-running','synthetic',7,'running',?1)", params![mail.to_string()]).unwrap();
        c.execute("INSERT INTO communication_events(run_id,node,state,at,result_json) VALUES('ci-running','snapshot','completed','t','{}'),('ci-running','select','completed','t','{}'),('ci-running','assess','running','t','{}')", []).unwrap();
        let mail_active = missions(&c, 6);
        let fixture = json!({"note":"Synthetic. Generated by capabilities::tests::write_capability_fixture; no real mailbox, vault or run data.",
            "capabilities":idle,"missions":{"none":{"observedAt":idle["observedAt"],"missions":[]},"completed":finished,"researchActive":active,"mailActive":mail_active}});
        std::fs::write(path, serde_json::to_string_pretty(&fixture).unwrap()).unwrap();
    }
}
