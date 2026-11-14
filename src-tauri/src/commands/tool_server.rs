//! Olympus's own tools, offered to an engine over MCP (`docs/OLYMPUS-TOOLS.md`).
//!
//! The runner starts this same executable with `--olympus-tools` and the engine
//! talks to it over stdin/stdout. Every tool here is read-only, and the server
//! enforces that itself: the database is opened read-only and vault access is
//! confined to Markdown files under the vault root. A tool that writes belongs
//! behind the approval gate in the main process, never here.

use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};

pub const FLAG: &str = "--olympus-tools";
pub const SERVER_NAME: &str = "olympus";
const PROTOCOL: &str = "2024-11-05";
const TEXT_LIMIT: usize = 4000;
const NOTE_LIMIT: u64 = 256 * 1024;
/// One part of a note, under `TEXT_LIMIT` so it is returned whole.
const NOTE_PART: usize = 3800;
const LIST_LIMIT: usize = 10;
const THREAD_LIMIT: usize = 20;
const VAULT_SCAN_LIMIT: usize = 5000;
const LEARNED_FOLDER: &str = "09 - System/Learned";

/// The tools an engine may be allowed, as `mcp__olympus__<name>`.
pub const TOOLS: &[&str] = &["search_mail", "read_mail_thread", "recall_memory", "search_vault", "read_vault_note", "list_projects", "recent_activity"];

pub fn qualified(tool: &str) -> String {
    format!("mcp__{SERVER_NAME}__{tool}")
}

fn definitions() -> Value {
    let text = |name: &str, what: &str| json!({"type": "object", "properties": {name: {"type": "string", "description": what}}, "required": [name], "additionalProperties": false});
    json!([
        {"name": "search_mail", "description": "Search Kevin's locally cached Gmail. Returns short excerpts with sender, subject, date and thread id. Read-only.",
         "inputSchema": text("query", "Words to look for in recent mail")},
        {"name": "read_mail_thread", "description": "Read the messages of one cached mail thread by the thread id a search returned. Read-only.",
         "inputSchema": text("thread_id", "A thread id from search_mail")},
        {"name": "recall_memory", "description": "Find what Olympus has learned from past conversations. Returns matching source-backed records with their vault file paths. Learned memory is lower authority than Kevin's own notes.",
         "inputSchema": text("query", "The topic to recall")},
        {"name": "search_vault", "description": "Find notes in Kevin's Obsidian vault by words in their name or text. Returns paths and a short excerpt. Read-only.",
         "inputSchema": text("query", "Words to look for")},
        {"name": "read_vault_note", "description": "Read one Markdown note from the vault by its vault-relative path. A long note comes in parts: when the answer's `nextFrom` is a number, call again with that number as `from` to read on; `nextFrom` null means you have reached the end. Read-only.",
         "inputSchema": {"type": "object", "properties": {"path": {"type": "string", "description": "Vault-relative path ending in .md"}, "from": {"type": "integer", "minimum": 0, "description": "Where to start, in characters. Omit for the beginning; otherwise the `nextFrom` of the previous part."}}, "required": ["path"], "additionalProperties": false}},
        {"name": "list_projects", "description": "List the projects on Kevin's Olympus dashboard with their status, vision and recorded next step. Read-only.",
         "inputSchema": {"type": "object", "properties": {}, "additionalProperties": false}},
        {"name": "recent_activity", "description": "What has changed lately across Kevin's mail, ongoing mail situations, vault notes, chats with Olympus and open tasks, newest first, with the state of the Gmail connection. The place to start when asked what is new. Each entry is a pointer: read the thread or note before relying on it. Read-only.",
         "inputSchema": {"type": "object", "properties": {"days": {"type": "integer", "minimum": 1, "maximum": 14, "description": "How far back to look. Default 3."}}, "additionalProperties": false}}
    ])
}

fn clip(text: &str) -> String {
    if text.chars().count() <= TEXT_LIMIT {
        return text.to_string();
    }
    let mut clipped: String = text.chars().take(TEXT_LIMIT - 1).collect();
    clipped.push('…');
    clipped
}

/// Bounds every string and list in a tool's answer, so one large mail or note
/// cannot crowd out the rest of an engine's working context.
fn bounded(value: Value) -> Value {
    match value {
        Value::String(text) => Value::String(clip(&text)),
        Value::Array(items) => Value::Array(items.into_iter().take(THREAD_LIMIT).map(bounded).collect()),
        Value::Object(fields) => Value::Object(fields.into_iter().map(|(key, value)| (key, bounded(value))).collect()),
        other => other,
    }
}

fn terms(query: &str) -> Vec<String> {
    let mut words: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .map(str::to_lowercase)
        .filter(|word| word.chars().count() > 2)
        .collect();
    words.sort();
    words.dedup();
    words
}

fn excerpt(text: &str, terms: &[String]) -> String {
    let lower = text.to_lowercase();
    let at = terms.iter().filter_map(|term| lower.find(term.as_str())).min().unwrap_or(0);
    // `to_lowercase` can change byte lengths; fall back to the start when the offset is not a boundary here.
    let start = if text.is_char_boundary(at) { at } else { 0 };
    let line_start = text[..start].rfind('\n').map_or(0, |index| index + 1);
    text[line_start..].chars().take(240).collect::<String>().trim().replace('\n', " ")
}

fn markdown_files(root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(folder) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&folder) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let hidden = path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.starts_with('.'));
            if hidden {
                continue;
            }
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                found.push(path);
                if found.len() >= VAULT_SCAN_LIMIT {
                    return found;
                }
            }
        }
    }
    found
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/")
}

/// Notes under `folder` ranked by how many of the query's words they contain.
fn search_notes(root: &Path, folder: &Path, query: &str, whole: bool) -> Result<Value, String> {
    let terms = terms(query);
    if terms.is_empty() {
        return Err("Give at least one word of three letters or more.".into());
    }
    let mut hits: Vec<(usize, String, String)> = markdown_files(folder)
        .into_iter()
        .filter_map(|path| {
            if std::fs::metadata(&path).ok()?.len() > NOTE_LIMIT {
                return None;
            }
            let text = std::fs::read_to_string(&path).ok()?;
            let name = relative(root, &path);
            let haystack = format!("{}\n{}", name.to_lowercase(), text.to_lowercase());
            let score = terms.iter().filter(|term| haystack.contains(term.as_str())).count();
            (score > 0).then(|| (score, name, if whole { clip(&text) } else { excerpt(&text, &terms) }))
        })
        .collect();
    hits.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    let key = if whole { "content" } else { "excerpt" };
    Ok(Value::Array(hits.into_iter().take(LIST_LIMIT).map(|(score, path, text)| json!({"path": path, "matchedWords": score, key: text})).collect()))
}

/// Rows of one query as JSON objects, or a note that this part could not be read. A missing
/// table is ordinary here: the server also runs against databases older than a feature.
fn rows(connection: &Connection, sql: &str, since: &str, fields: &[&str]) -> Value {
    let read = || -> rusqlite::Result<Vec<Value>> {
        let mut statement = connection.prepare(sql)?;
        let found = statement
            .query_map([since], |row| {
                let mut entry = serde_json::Map::new();
                for (index, field) in fields.iter().enumerate() {
                    let value: Option<String> = row.get::<_, Option<rusqlite::types::Value>>(index)?.map(|value| match value {
                        rusqlite::types::Value::Text(text) => text,
                        rusqlite::types::Value::Integer(number) => number.to_string(),
                        rusqlite::types::Value::Real(number) => number.to_string(),
                        _ => String::new(),
                    });
                    entry.insert((*field).into(), value.map_or(Value::Null, |text| Value::String(text.chars().take(240).collect())));
                }
                Ok(Value::Object(entry))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(found)
    };
    read().map(Value::Array).unwrap_or_else(|_| json!({"unavailable": true}))
}

/// What changed in the last `days` days, as pointers into the other tools. Counts and
/// dates come from the stores themselves; nothing here is summarised or judged.
fn recent_activity(connection: &Connection, vault: Option<&Path>, days: i64) -> Value {
    let since = format!("-{days} days");
    let connection_state = rows(
        connection,
        "SELECT status, last_success, last_error, (SELECT strftime('%Y-%m-%dT%H:%M:%SZ', max(internal_date) / 1000, 'unixepoch') FROM gmail_messages WHERE available = 1) \
         FROM gmail_accounts WHERE ?1 IS NOT NULL LIMIT 1",
        &since,
        &["status", "lastSuccessfulSync", "lastError", "newestCachedMessage"],
    );
    let mail = rows(
        connection,
        "SELECT thread_id, json_extract(snapshot_json, '$.sender'), json_extract(snapshot_json, '$.subject'), strftime('%Y-%m-%dT%H:%M:%SZ', internal_date / 1000, 'unixepoch') \
         FROM gmail_messages WHERE available = 1 AND in_scope = 1 AND internal_date >= CAST(strftime('%s', 'now', ?1) AS INTEGER) * 1000 \
           AND coalesce(json_extract(snapshot_json, '$.labels'), '') NOT LIKE '%CATEGORY_PROMOTIONS%' \
         ORDER BY internal_date DESC LIMIT 15",
        &since,
        &["threadId", "from", "subject", "receivedAt"],
    );
    let situations = rows(
        connection,
        "SELECT title, state, updated_at FROM communication_situations WHERE state IN ('active', 'emerging') AND ?1 IS NOT NULL ORDER BY updated_at DESC LIMIT 10",
        &since,
        &["title", "state", "updatedAt"],
    );
    let chats = rows(
        connection,
        "SELECT title, summary, updated_at FROM conversations WHERE title <> '' AND updated_at >= datetime('now', ?1) ORDER BY updated_at DESC LIMIT 8",
        &since,
        &["title", "summary", "updatedAt"],
    );
    let tasks = rows(
        connection,
        "SELECT title, state, priority, intent, due_date, updated_at FROM organizer_tasks WHERE state NOT IN ('done', 'completed', 'cancelled', 'archived') AND ?1 IS NOT NULL ORDER BY updated_at DESC LIMIT 10",
        &since,
        &["title", "state", "priority", "intent", "dueDate", "updatedAt"],
    );
    let notes = vault.filter(|root| root.is_dir()).map_or(json!({"unavailable": true}), |root| {
        let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(days as u64 * 86_400);
        let mut changed: Vec<(std::time::SystemTime, String)> = markdown_files(root)
            .into_iter()
            .filter_map(|path| {
                let modified = std::fs::metadata(&path).ok()?.modified().ok()?;
                (modified >= cutoff).then(|| (modified, relative(root, &path)))
            })
            .collect();
        changed.sort_by(|a, b| b.0.cmp(&a.0));
        // Learned records are written by a background pass after every chat; listing each would bury the notes Kevin or an agent wrote on purpose.
        let learned = changed.iter().filter(|(_, path)| path.replace('\\', "/").starts_with(LEARNED_FOLDER)).count();
        let listed: Vec<Value> = changed
            .iter()
            .filter(|(_, path)| !path.replace('\\', "/").starts_with(LEARNED_FOLDER))
            .take(20)
            .map(|(modified, path)| json!({"path": path, "modifiedAt": chrono::DateTime::<chrono::Utc>::from(*modified).format("%Y-%m-%dT%H:%M:%SZ").to_string()}))
            .collect();
        json!({"changed": listed, "learnedRecordsChanged": learned})
    });
    json!({
        "now": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        "lookedBackDays": days,
        // The copy of Olympus answering this call, so a note that says "not installed yet" can be checked against what is running.
        "thisOlympus": {"version": env!("CARGO_PKG_VERSION"), "build": if cfg!(debug_assertions) { "development build" } else { "installed release" }},
        "gmailConnection": connection_state,
        "mail": mail,
        "mailSituations": situations,
        "vaultNotes": notes,
        "chatsWithOlympus": chats,
        "openTasks": tasks,
    })
}

/// A Markdown file inside the vault, or a refusal. Symlinks and `..` cannot leave the root.
fn vault_note(root: &Path, requested: &str) -> Result<PathBuf, String> {
    let requested = requested.trim().trim_start_matches(['/', '\\']);
    if requested.is_empty() || Path::new(requested).is_absolute() || !requested.to_lowercase().ends_with(".md") {
        return Err("Give a vault-relative path to a Markdown note.".into());
    }
    let root = root.canonicalize().map_err(|_| "The vault is unavailable.".to_string())?;
    let path = root.join(requested).canonicalize().map_err(|_| "No note at that path.".to_string())?;
    let hidden = path.strip_prefix(&root).ok().is_some_and(|inside| {
        inside.components().any(|part| part.as_os_str().to_string_lossy().starts_with('.'))
    });
    if !path.starts_with(&root) || hidden || !path.is_file() {
        return Err("That path is outside the readable vault.".into());
    }
    if std::fs::metadata(&path).map_err(|_| "No note at that path.".to_string())?.len() > NOTE_LIMIT {
        return Err("That note is too large to read through this tool.".into());
    }
    Ok(path)
}

fn argument<'a>(arguments: &'a Value, name: &str) -> Result<&'a str, String> {
    arguments.get(name).and_then(Value::as_str).map(str::trim).filter(|text| !text.is_empty()).ok_or_else(|| format!("Missing `{name}`."))
}

pub fn call(connection: &Connection, vault: Option<&Path>, tool: &str, arguments: &Value) -> Result<Value, String> {
    call_within(connection, vault, None, tool, arguments)
}

/// `allow` narrows the server to one skill's tools: it neither lists nor runs any other.
fn permitted(allow: Option<&[String]>, tool: &str) -> bool {
    allow.is_none_or(|allowed| allowed.iter().any(|name| name == tool))
}

pub fn call_within(connection: &Connection, vault: Option<&Path>, allow: Option<&[String]>, tool: &str, arguments: &Value) -> Result<Value, String> {
    if !permitted(allow, tool) {
        return Err(format!("Unknown tool `{tool}`."));
    }
    let vault_root = || vault.filter(|root| root.is_dir()).ok_or_else(|| "The vault is unavailable.".to_string());
    let answer = match tool {
        "search_mail" => {
            let query: String = argument(arguments, "query")?.chars().take(500).collect();
            let found = super::gmail::store::search(connection, &query, true)?;
            serde_json::to_value(found.into_iter().take(LIST_LIMIT).collect::<Vec<_>>()).map_err(|error| error.to_string())?
        }
        "read_mail_thread" => {
            let account = super::gmail::store::account(connection)?.filter(|account| account.enabled).ok_or("Gmail is not connected.")?;
            let messages = super::gmail::store::thread_messages(connection, &account.id, argument(arguments, "thread_id")?, THREAD_LIMIT)?;
            serde_json::to_value(messages).map_err(|error| error.to_string())?
        }
        "recall_memory" => {
            let root = vault_root()?;
            search_notes(root, &root.join(LEARNED_FOLDER), argument(arguments, "query")?, true)?
        }
        "search_vault" => {
            let root = vault_root()?;
            search_notes(root, root, argument(arguments, "query")?, false)?
        }
        "read_vault_note" => {
            let root = vault_root()?;
            let path = vault_note(root, argument(arguments, "path")?)?;
            let content = std::fs::read_to_string(&path).map_err(|_| "That note could not be read.".to_string())?;
            // One part per call, short enough that `bounded` never cuts it: a reader told
            // where the note ends cannot mistake a part for the whole.
            let total = content.chars().count();
            let from = arguments.get("from").and_then(Value::as_u64).map_or(0, |from| from as usize).min(total);
            let part: String = content.chars().skip(from).take(NOTE_PART).collect();
            let end = from + part.chars().count();
            json!({"path": relative(&root.canonicalize().unwrap_or_else(|_| root.to_path_buf()), &path), "content": part, "from": from, "totalChars": total, "nextFrom": if end < total { json!(end) } else { Value::Null }})
        }
        "list_projects" => {
            let members = super::project_registry::list(connection).map_err(|error| error.to_string())?;
            Value::Array(
                members
                    .into_iter()
                    .filter(|member| member.visibility != "removed")
                    .map(|member| serde_json::to_value(member.project).unwrap_or(Value::Null))
                    .collect(),
            )
        }
        "recent_activity" => recent_activity(connection, vault, arguments.get("days").and_then(Value::as_i64).unwrap_or(3).clamp(1, 14)),
        _ => return Err(format!("Unknown tool `{tool}`.")),
    };
    Ok(bounded(answer))
}

/// Answers one JSON-RPC message. Notifications get no answer.
pub fn handle(connection: &Connection, vault: Option<&Path>, message: &Value) -> Option<Value> {
    handle_within(connection, vault, None, message)
}

pub fn handle_within(connection: &Connection, vault: Option<&Path>, allow: Option<&[String]>, message: &Value) -> Option<Value> {
    let id = message.get("id").cloned()?;
    let reply = |result: Value| Some(json!({"jsonrpc": "2.0", "id": id, "result": result}));
    match message.get("method").and_then(Value::as_str).unwrap_or("") {
        "initialize" => reply(json!({
            "protocolVersion": message.pointer("/params/protocolVersion").and_then(Value::as_str).unwrap_or(PROTOCOL),
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": env!("CARGO_PKG_VERSION")}
        })),
        "ping" => reply(json!({})),
        "tools/list" => {
            let listed: Vec<Value> = definitions().as_array().into_iter().flatten().filter(|tool| permitted(allow, tool["name"].as_str().unwrap_or(""))).cloned().collect();
            reply(json!({"tools": listed}))
        }
        "tools/call" => {
            let tool = message.pointer("/params/name").and_then(Value::as_str).unwrap_or("");
            let arguments = message.pointer("/params/arguments").cloned().unwrap_or(json!({}));
            let (text, failed) = match call_within(connection, vault, allow, tool, &arguments) {
                Ok(answer) => (answer.to_string(), false),
                Err(error) => (error, true),
            };
            reply(json!({"content": [{"type": "text", "text": text}], "isError": failed}))
        }
        method => Some(json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32601, "message": format!("Method not found: {method}")}})),
    }
}

pub fn open_read_only(database: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(database, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|_| "The Olympus database is unavailable.".to_string())
}

fn serve(database: &Path, vault: Option<&Path>, allow: Option<&[String]>) -> Result<(), String> {
    let connection = open_read_only(database)?;
    let mut output = std::io::stdout().lock();
    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        let Ok(message) = serde_json::from_str::<Value>(&line) else { continue };
        if let Some(answer) = handle_within(&connection, vault, allow, &message) {
            writeln!(output, "{answer}").and_then(|_| output.flush()).map_err(|_| "The engine closed the connection.".to_string())?;
        }
    }
    Ok(())
}

pub struct Launch {
    pub database: PathBuf,
    pub vault: Option<PathBuf>,
    /// The only tools to offer, or every tool when absent.
    pub allow: Option<Vec<String>>,
}

/// `--olympus-tools --db <file> [--vault <folder>] [--allow a,b]`, or `None` for a normal start.
pub fn parse_arguments(arguments: &[String]) -> Option<Result<Launch, String>> {
    if arguments.first().map(String::as_str) != Some(FLAG) {
        return None;
    }
    let value = |name: &str| arguments.iter().position(|a| a == name).and_then(|index| arguments.get(index + 1)).map(PathBuf::from);
    Some(match value("--db") {
        Some(database) => Ok(Launch {
            database,
            vault: value("--vault"),
            allow: value("--allow").map(|names| names.to_string_lossy().split(',').map(str::trim).filter(|name| !name.is_empty()).map(str::to_string).collect()),
        }),
        None => Err("--olympus-tools needs --db <file>.".into()),
    })
}

/// Runs the tool server when asked to and returns its exit code; `None` means start the app.
pub fn run_if_requested() -> Option<i32> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    Some(match parse_arguments(&arguments)? {
        Ok(launch) => match serve(&launch.database, launch.vault.as_deref(), launch.allow.as_deref()) {
            Ok(()) => 0,
            Err(error) => {
                eprintln!("{error}");
                1
            }
        },
        Err(error) => {
            eprintln!("{error}");
            2
        }
    })
}

/// The MCP configuration that points an engine at this server.
pub fn mcp_config(executable: &Path, database: &Path, vault: Option<&Path>, allow: &[&str]) -> Value {
    let mut arguments = vec![FLAG.to_string(), "--db".into(), database.to_string_lossy().into_owned()];
    if !allow.is_empty() {
        arguments.extend(["--allow".into(), allow.join(",")]);
    }
    if let Some(vault) = vault {
        arguments.extend(["--vault".into(), vault.to_string_lossy().into_owned()]);
    }
    json!({"mcpServers": {SERVER_NAME: {"type": "stdio", "command": executable.to_string_lossy(), "args": arguments}}})
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Scratch(PathBuf);
    impl Scratch {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!("olympus-tools-{label}-{}-{}", std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn write(&self, relative: &str, text: &str) {
            let path = self.0.join(relative);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn memory_db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        connection
    }

    fn rpc(connection: &Connection, vault: Option<&Path>, method: &str, params: Value) -> Value {
        handle(connection, vault, &json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})).unwrap()
    }

    fn tool(connection: &Connection, vault: Option<&Path>, name: &str, arguments: Value) -> (Value, bool) {
        let answer = rpc(connection, vault, "tools/call", json!({"name": name, "arguments": arguments}));
        let text = answer.pointer("/result/content/0/text").and_then(Value::as_str).unwrap().to_string();
        let failed = answer.pointer("/result/isError").and_then(Value::as_bool).unwrap();
        (serde_json::from_str(&text).unwrap_or(Value::String(text)), failed)
    }

    #[test]
    fn the_handshake_lists_exactly_the_declared_tools() {
        let connection = memory_db();
        let hello = rpc(&connection, None, "initialize", json!({"protocolVersion": "2025-06-18"}));
        assert_eq!(hello.pointer("/result/protocolVersion").unwrap(), "2025-06-18");
        assert_eq!(hello.pointer("/result/serverInfo/name").unwrap(), SERVER_NAME);
        let listed = rpc(&connection, None, "tools/list", json!({}));
        let names: Vec<&str> = listed.pointer("/result/tools").unwrap().as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        assert_eq!(names, TOOLS);
        assert!(handle(&connection, None, &json!({"jsonrpc": "2.0", "method": "notifications/initialized"})).is_none());
        assert_eq!(rpc(&connection, None, "resources/list", json!({})).pointer("/error/code").unwrap(), -32601);
        assert_eq!(qualified("search_mail"), "mcp__olympus__search_mail");
    }

    #[test]
    fn memory_recall_returns_learned_records_with_their_paths() {
        let vault = Scratch::new("recall");
        vault.write("09 - System/Learned/aaa.md", "Kevin prefers concise conversational briefings: what changed, why it matters, whether to act.");
        vault.write("09 - System/Learned/bbb.md", "A suggestion counts as a decision only when Kevin explicitly adopts it.");
        vault.write("09 - System/Learned/.receipts/r.json", "{\"briefings\":true}");
        vault.write("01 - Projects/Olympus.md", "briefings are discussed here too");
        let connection = memory_db();

        let (found, failed) = tool(&connection, Some(&vault.0), "recall_memory", json!({"query": "conversational briefings"}));
        assert!(!failed);
        let found = found.as_array().unwrap();
        assert_eq!(found.len(), 1, "only learned records, never receipts or other notes");
        assert_eq!(found[0]["path"], "09 - System/Learned/aaa.md");
        assert!(found[0]["content"].as_str().unwrap().contains("what changed"));

        let (everywhere, _) = tool(&connection, Some(&vault.0), "search_vault", json!({"query": "briefings"}));
        let paths: Vec<&str> = everywhere.as_array().unwrap().iter().map(|hit| hit["path"].as_str().unwrap()).collect();
        assert_eq!(paths, ["01 - Projects/Olympus.md", "09 - System/Learned/aaa.md"]);

        let (none, failed) = tool(&connection, Some(&vault.0), "recall_memory", json!({"query": "zz"}));
        assert!(failed && none.as_str().unwrap().contains("three letters"));
        let (missing, failed) = tool(&connection, None, "recall_memory", json!({"query": "briefings"}));
        assert!(failed && missing.as_str().unwrap().contains("vault is unavailable"));
    }

    #[test]
    fn a_note_read_cannot_leave_the_vault() {
        let outside = Scratch::new("outside");
        outside.write("secret.md", "outside the vault");
        outside.write("vault/01 - Projects/Olympus.md", "# Olympus\nvision");
        outside.write("vault/.obsidian/workspace.md", "hidden");
        outside.write("vault/notes.txt", "not markdown");
        let vault = outside.0.join("vault");
        let connection = memory_db();

        let (note, failed) = tool(&connection, Some(&vault), "read_vault_note", json!({"path": "01 - Projects/Olympus.md"}));
        assert!(!failed);
        assert_eq!(note["path"], "01 - Projects/Olympus.md");
        assert!(note["content"].as_str().unwrap().contains("vision"));
        assert_eq!((&note["from"], &note["nextFrom"]), (&json!(0), &Value::Null), "a short note is whole and says so");

        let long: String = (0..9000).map(|i| char::from(b'a' + (i % 26) as u8)).collect();
        std::fs::write(vault.join("01 - Projects/Long.md"), &long).unwrap();
        let mut read = String::new();
        let mut from = json!(0);
        let mut parts = 0;
        while !from.is_null() {
            let (part, failed) = tool(&connection, Some(&vault), "read_vault_note", json!({"path": "01 - Projects/Long.md", "from": from}));
            assert!(!failed && part["totalChars"] == 9000 && !part["content"].as_str().unwrap().ends_with('…'), "a part is never silently cut");
            read.push_str(part["content"].as_str().unwrap());
            from = part["nextFrom"].clone();
            parts += 1;
        }
        assert_eq!((read, parts), (long, 3), "the parts join into the whole note");
        let (past, failed) = tool(&connection, Some(&vault), "read_vault_note", json!({"path": "01 - Projects/Long.md", "from": 99999}));
        assert!(!failed && past["content"] == "" && past["nextFrom"].is_null());

        for path in ["../secret.md", "01 - Projects/../../secret.md", ".obsidian/workspace.md", "notes.txt", "missing.md", ""] {
            let (_, failed) = tool(&connection, Some(&vault), "read_vault_note", json!({"path": path}));
            assert!(failed, "{path} must be refused");
        }
        let absolute = outside.0.join("secret.md").to_string_lossy().into_owned();
        assert!(tool(&connection, Some(&vault), "read_vault_note", json!({"path": absolute})).1);
    }

    #[test]
    fn the_database_is_opened_read_only_and_tools_still_answer() {
        let scratch = Scratch::new("db");
        let file = scratch.0.join("olympus.sqlite");
        Connection::open(&file).unwrap().execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        let connection = open_read_only(&file).unwrap();
        assert!(connection.execute("CREATE TABLE forbidden (x)", []).is_err(), "the tool server cannot write");

        let (projects, failed) = tool(&connection, None, "list_projects", json!({}));
        assert!(!failed && projects.as_array().is_some());
        let (mail, failed) = tool(&connection, None, "search_mail", json!({"query": "invoice shipment"}));
        assert!(!failed, "a mail search must not need to write: {mail}");
        assert_eq!(mail.as_array().map(Vec::len), Some(0));
        let (thread, failed) = tool(&connection, None, "read_mail_thread", json!({"thread_id": "t1"}));
        assert!(failed && thread.as_str().unwrap().contains("not connected"));
        let (unknown, failed) = tool(&connection, None, "send_mail", json!({}));
        assert!(failed && unknown.as_str().unwrap().contains("Unknown tool"));
    }

    #[test]
    fn answers_are_bounded_and_launch_arguments_are_explicit() {
        let long = bounded(json!({"body": "x".repeat(TEXT_LIMIT * 2), "items": (0..100).collect::<Vec<_>>()}));
        assert_eq!(long["body"].as_str().unwrap().chars().count(), TEXT_LIMIT);
        assert_eq!(long["items"].as_array().unwrap().len(), THREAD_LIMIT);

        let args = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(parse_arguments(&args(&[])).is_none());
        assert!(parse_arguments(&args(&["--other"])).is_none());
        assert!(parse_arguments(&args(&[FLAG])).unwrap().is_err());
        let launch = parse_arguments(&args(&[FLAG, "--db", "a.sqlite", "--vault", "v"])).unwrap().unwrap();
        assert_eq!((launch.database, launch.vault, launch.allow), (PathBuf::from("a.sqlite"), Some(PathBuf::from("v")), None));
        let narrowed = parse_arguments(&args(&[FLAG, "--db", "a.sqlite", "--allow", "search_mail, recall_memory,"])).unwrap().unwrap();
        assert_eq!(narrowed.allow, Some(vec!["search_mail".to_string(), "recall_memory".to_string()]));

        let config = mcp_config(Path::new("olympus.exe"), Path::new("a.sqlite"), None, &[]);
        assert_eq!(config.pointer("/mcpServers/olympus/args").unwrap(), &json!([FLAG, "--db", "a.sqlite"]));
        let config = mcp_config(Path::new("olympus.exe"), Path::new("a.sqlite"), None, &["search_mail", "list_projects"]);
        assert_eq!(config.pointer("/mcpServers/olympus/args").unwrap(), &json!([FLAG, "--db", "a.sqlite", "--allow", "search_mail,list_projects"]));
    }

    #[test]
    fn recent_activity_points_to_what_changed_and_says_what_it_cannot_read() {
        let connection = memory_db();
        let vault = std::env::temp_dir().join(format!("olympus-recent-{}", std::process::id()));
        std::fs::create_dir_all(vault.join("01 - Projects")).unwrap();
        std::fs::create_dir_all(vault.join(LEARNED_FOLDER)).unwrap();
        std::fs::write(vault.join("01 - Projects/Today.md"), "new").unwrap();
        std::fs::write(vault.join(LEARNED_FOLDER).join("abc.md"), "learned").unwrap();
        let (found, failed) = tool(&connection, Some(&vault), "recent_activity", json!({"days": 2}));
        assert!(!failed);
        assert_eq!(found["lookedBackDays"], 2);
        assert_eq!(found["thisOlympus"]["version"], env!("CARGO_PKG_VERSION"));
        let notes = found["vaultNotes"]["changed"].as_array().unwrap();
        assert!(notes.len() == 1 && notes[0]["path"].as_str().unwrap().ends_with("Today.md"), "learned records are counted, not listed");
        assert_eq!(found["vaultNotes"]["learnedRecordsChanged"], 1);
        // Every store section is either rows or an honest marker; a database without a table never fails the call.
        for part in ["gmailConnection", "mail", "mailSituations", "chatsWithOlympus", "openTasks"] {
            assert!(found[part].is_array() || found[part]["unavailable"] == true, "{part}");
        }
        let (no_vault, failed) = tool(&connection, None, "recent_activity", json!({}));
        assert!(!failed && no_vault["vaultNotes"]["unavailable"] == true && no_vault["lookedBackDays"] == 3);
        let _ = std::fs::remove_dir_all(&vault);
    }

    #[test]
    fn a_narrowed_server_neither_lists_nor_runs_other_tools() {
        let connection = memory_db();
        let allow = vec!["list_projects".to_string(), "search_mail".to_string()];
        let ask = |method: &str, params: Value| handle_within(&connection, None, Some(&allow), &json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})).unwrap();
        let listed = ask("tools/list", json!({}));
        let names: Vec<&str> = listed.pointer("/result/tools").unwrap().as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        assert_eq!(names, ["search_mail", "list_projects"]);
        assert_eq!(ask("tools/call", json!({"name": "list_projects", "arguments": {}})).pointer("/result/isError").unwrap(), false);
        let refused = ask("tools/call", json!({"name": "read_vault_note", "arguments": {"path": "a.md"}}));
        assert_eq!(refused.pointer("/result/isError").unwrap(), true);
        assert!(refused.pointer("/result/content/0/text").unwrap().as_str().unwrap().contains("Unknown tool"));
    }
}
