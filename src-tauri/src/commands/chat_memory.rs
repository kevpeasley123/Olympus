//! Chats in Obsidian and what Olympus learns from them
//! (docs/CONVERSATIONS-AND-MEMORY.md).
//!
//! One background worker. When a saved chat has been quiet for ten minutes it
//! asks the primary route for the chat's title and summary and the updated
//! memory note, then writes the chat's own note. Both notes are
//! Olympus-authored and Kevin may edit either; `save_note` and `learn` say how
//! his edits survive. Temporary chats never reach SQLite, so never reach here.

use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{Manager, State};

use super::conversations::{now_sql, HAS_OPERATOR_TURN};
use super::persistence::Db;
use super::vault_write::{self as vw, WriteIntent};
#[path = "chat_memory_jobs.rs"]
mod jobs;

pub const CHATS_FOLDER: &str = "10 - Conversations";
pub const MEMORY_NOTE: &str = "09 - System/Olympus Memory.md";
/// A chat is left alone until it has been quiet this long.
const QUIET_MINUTES: i64 = 10;
/// After a failed memory pass the chat waits before another paid try: this
/// long, doubling each time, and it stops after `MAX_FAILURES` in a row until
/// Kevin turns learning off and on again.
const RETRY_MINUTES: i64 = 30;
const MAX_FAILURES: i64 = 4;
const CHATS_PER_TICK: i64 = 3;
/// Bounds on one memory pass. Longer chats are learned from in order, one
/// bounded batch per pass, so nothing is skipped.
const PASS_MESSAGE_CHARS: usize = 4_000;
const PASS_BUDGET_CHARS: usize = 48_000;
/// The memory note as the assistant reads it each turn.
const MEMORY_PROMPT_CHARS: usize = 16_000;
const MEMORY_NOTE_CHARS: usize = 24_000;

const SAVE_KEY: &str = "chatMemory.saveChats";
const LEARN_KEY: &str = "chatMemory.learn";
const USE_KEY: &str = "chatMemory.use";

const MEMORY_INTRO: &str = "What Olympus has learned from conversations with Kevin. Olympus updates it after a chat goes quiet. Edit anything here and Olympus keeps your version. It ranks below your own notes and what you say in the moment.";

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub save_chats: bool,
    pub learn: bool,
    pub use_memory: bool,
}

/// Each switch is on unless Kevin turned it off.
pub fn settings(connection: &Connection) -> Settings {
    let on = |key: &str| {
        connection
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get::<_, String>(0))
            .optional()
            .ok()
            .flatten()
            .is_none_or(|value| value != "false")
    };
    Settings { save_chats: on(SAVE_KEY), learn: on(LEARN_KEY), use_memory: on(USE_KEY) }
}

fn sql_minutes_ago(minutes: i64) -> String {
    (chrono::Utc::now() - chrono::Duration::minutes(minutes)).format("%Y-%m-%d %H:%M:%S").to_string()
}

fn local(raw: &str) -> Option<chrono::DateTime<chrono::Local>> {
    chrono::NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|t| t.and_utc().with_timezone(&chrono::Local))
}

#[derive(Debug, Clone)]
struct Chat {
    id: String,
    title: String,
    title_source: String,
    summary: String,
    created_at: String,
    vault_path: Option<String>,
    vault_watermark: i64,
    memory_watermark: i64,
    vault_due: bool,
    memory_due: bool,
    legacy: bool,
}

/// Quiet chats with something left to do, oldest first so memory learns in the
/// order things were said.
fn due(connection: &Connection, settings: Settings) -> rusqlite::Result<Vec<Chat>> {
    let sql = format!(
        "WITH quiet AS (SELECT c.id, c.title, c.title_source, c.summary, c.created_at, c.vault_path, c.vault_watermark, \
           c.memory_watermark, c.memory_attempted_at, c.updated_at, \
           (SELECT max(m.rowid) FROM conversation_messages m WHERE m.conversation_id = c.id) AS last_rowid \
           , c.memory_error, c.memory_failures, c.legacy \
         FROM conversations c WHERE {HAS_OPERATOR_TURN} AND c.updated_at <= ?1), \
         flagged AS (SELECT *, (?3 = 1 AND vault_watermark < last_rowid) AS vault_due, \
           (?4 = 1 AND memory_watermark < last_rowid AND memory_failures < {MAX_FAILURES} AND (memory_error IS NULL \
             OR memory_attempted_at <= datetime('now', printf('-%d minutes', ?2 * (1 << max(memory_failures - 1, 0)))))) AS memory_due FROM quiet) \
         SELECT id, title, title_source, summary, created_at, vault_path, vault_watermark, memory_watermark, vault_due, memory_due, legacy \
         FROM flagged WHERE vault_due OR memory_due ORDER BY updated_at, id LIMIT ?5"
    );
    connection
        .prepare(&sql)?
        .query_map(
            params![sql_minutes_ago(QUIET_MINUTES), RETRY_MINUTES, settings.save_chats, settings.learn, CHATS_PER_TICK],
            |r| {
                Ok(Chat {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    title_source: r.get(2)?,
                    summary: r.get(3)?,
                    created_at: r.get(4)?,
                    vault_path: r.get(5)?,
                    vault_watermark: r.get(6)?,
                    memory_watermark: r.get(7)?,
                    vault_due: r.get(8)?,
                    memory_due: r.get(9)?,
                    legacy: r.get(10)?,
                })
            },
        )?
        .collect()
}

#[derive(Debug, Clone, Serialize)]
struct Line {
    id: String,
    fingerprint: String,
    rowid: i64,
    role: String,
    content: String,
    created_at: String,
    imported: bool,
    attachment: Option<String>,
}

fn lines_after(connection: &Connection, id: &str, after: i64) -> rusqlite::Result<Vec<Line>> {
    connection
        .prepare(
            "SELECT m.rowid, m.role, m.content, m.created_at, \
               EXISTS (SELECT 1 FROM conversation_imports i WHERE i.message_id = m.id), \
               (SELECT json_extract(t.context_json, '$.attachment.label') FROM conversation_turn_context t WHERE t.message_id = m.id), m.id \
             FROM conversation_messages m WHERE m.conversation_id = ?1 AND m.rowid > ?2 ORDER BY m.created_at, m.rowid",
        )?
        .query_map(params![id, after], |r| {
            let content:String=r.get(2)?;
                Ok(Line { id:r.get(6)?, fingerprint:vw::content_fingerprint(&content), rowid: r.get(0)?, role: r.get(1)?, content, created_at: r.get(3)?, imported: r.get(4)?, attachment: r.get(5)? })
        })?
        .collect()
}

// ---- Chat notes -------------------------------------------------------------

/// Characters Windows or Obsidian will not take in a file name.
fn file_safe(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*#^[]".contains(c) { ' ' } else { c })
        .collect();
    let words = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let cut: String = words.chars().take(60).collect();
    let cut = cut.trim_end_matches(['.', ' ', '…']).to_string();
    if cut.is_empty() { "Chat".into() } else { cut }
}

/// Fixed when the note is first written: a later title shows in the note, but
/// the file keeps its name so links to it hold.
fn note_path(id: &str, title: &str, created_at: &str) -> String {
    use sha2::{Digest, Sha256};
    let when = local(created_at).unwrap_or_else(chrono::Local::now);
    let tag: String = format!("{:x}", Sha256::digest(id.as_bytes())).chars().take(6).collect();
    format!("{CHATS_FOLDER}/{}/{} {} {tag}.md", when.format("%Y/%m"), when.format("%Y-%m-%d"), file_safe(title))
}

fn speaker(line: &Line) -> &'static str {
    match line.role.as_str() {
        "user" => "Kevin",
        "assistant" => "Olympus",
        _ => "System",
    }
}

fn render_lines(lines: &[Line]) -> String {
    let mut out = String::new();
    let mut last_day = String::new();
    for line in lines {
        let when = local(&line.created_at);
        let day = when.map(|t| t.format("%Y-%m-%d").to_string()).unwrap_or_default();
        let time = when.map(|t| t.format("%H:%M").to_string()).unwrap_or_default();
        let stamp = if line.imported {
            "imported, original time unknown".to_string()
        } else if day != last_day {
            format!("{day} {time}")
        } else {
            time
        };
        last_day = day;
        out.push_str(&format!("### {} · {stamp}\n\n", speaker(line)));
        if let Some(label) = &line.attachment {
            out.push_str(&format!("_Attached: {label}_\n\n"));
        }
        out.push_str(line.content.trim());
        out.push_str("\n\n");
    }
    out
}

fn render_note(chat: &Chat, title: &str, lines: &[Line], learning: bool) -> String {
    let updated = lines.last().map(|l| l.created_at.as_str()).unwrap_or(&chat.created_at);
    let iso = |raw: &str| local(raw).map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, false)).unwrap_or_default();
    let summary = if !chat.summary.is_empty() {
        chat.summary.clone()
    } else if chat.legacy && chat.memory_watermark > 0 {
        "_No summary: this chat is from before Olympus learned from chats. Preferences > Memory can learn from it._".into()
    } else if learning {
        "_Summary pending: Olympus writes one after the chat goes quiet._".into()
    } else {
        "_No summary: learning from chats is off._".into()
    };
    format!(
        "---\ntype: conversation\nconversation_id: {}\ntitle: {}\ncreated: {}\nupdated: {}\nmessages: {}\ntags: [olympus/conversation]\n---\n# {title}\n\n{summary}\n\n## Transcript\n\n{}",
        serde_json::to_string(&chat.id).unwrap_or_default(),
        serde_json::to_string(title).unwrap_or_default(),
        iso(&chat.created_at),
        iso(updated),
        lines.len(),
        render_lines(lines).trim_end()
    ) + "\n"
}

fn recorded_fingerprint(connection: &Connection, relative: &str) -> rusqlite::Result<Option<String>> {
    connection
        .query_row("SELECT content_sha256 FROM artifact_hashes WHERE vault_relative_path = ?1", [relative], |r| r.get(0))
        .optional()
}

fn record_fingerprint(connection: &Connection, relative: &str, content: &str) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO artifact_hashes (vault_relative_path, content_sha256, written_at) VALUES (?1, ?2, CURRENT_TIMESTAMP) \
         ON CONFLICT(vault_relative_path) DO UPDATE SET content_sha256 = excluded.content_sha256, written_at = CURRENT_TIMESTAMP",
        params![relative, vw::content_fingerprint(content)],
    )?;
    Ok(())
}

/// What the note should become. While its bytes are still what Olympus last
/// wrote, it is rendered whole. Once Kevin has edited it, his version stays and
/// only messages it has not seen are added at the end.
enum NotePlan {
    Write { content: String, whole: bool },
    /// Kevin removed a note Olympus had written. That is his call; it is not
    /// brought back.
    Removed,
    /// Kevin edited the note and nothing new has been said since.
    Unchanged,
}

fn plan_note(chat: &Chat, title: &str, all: &[Line], on_disk: Option<&str>, recorded: Option<&str>, learning: bool) -> NotePlan {
    match on_disk {
        None if chat.vault_path.is_some() => NotePlan::Removed,
        None => NotePlan::Write { content: render_note(chat, title, all, learning), whole: true },
        Some(text) if recorded == Some(vw::content_fingerprint(text).as_str()) => {
            NotePlan::Write { content: render_note(chat, title, all, learning), whole: true }
        }
        Some(text) => {
            let unseen: Vec<Line> = all.iter().filter(|l| l.rowid > chat.vault_watermark).cloned().collect();
            if unseen.is_empty() {
                return NotePlan::Unchanged;
            }
            let content = format!("{}\n\n{}\n", text.trim_end(), render_lines(&unseen).trim_end());
            NotePlan::Write { content, whole: false }
        }
    }
}

fn vault_root() -> Result<PathBuf, String> {
    let vault = super::get_vault_path();
    if vault.is_dir() { Ok(vault) } else { Err(format!("The vault is not reachable at {}.", vault.display())) }
}

/// Every write gets its own vault commit. A failed commit leaves the file
/// written and is logged, as the other writers do.
fn commit(root: &Path, relative: &str, operation: &str) {
    if let Err(error) = super::vault_git::commit_vault_file_in(root, relative, operation) {
        eprintln!("[Olympus::ChatMemory] {relative} was written but not committed: {error}");
    }
}

fn save_note(db: &Db, chat: &Chat, root: &Path) -> Result<(), String> {
    let (all, title, learning) = {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        let title: String = c.query_row("SELECT title FROM conversations WHERE id = ?1", [&chat.id], |r| r.get(0)).map_err(|e| e.to_string())?;
        (lines_after(&c, &chat.id, 0).map_err(|e| e.to_string())?, title, settings(&c).learn)
    };
    let title = if title.trim().is_empty() { "Chat".to_string() } else { title };
    let last = all.last().map_or(0, |l| l.rowid);
    let relative = chat.vault_path.clone().unwrap_or_else(|| note_path(&chat.id, &title, &chat.created_at));
    let target = vw::resolve_within(root, Path::new(&relative)).map_err(|e| e.to_string())?;
    let on_disk = vw::read_existing(&target)?;
    let recorded = {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        recorded_fingerprint(&c, &relative).map_err(|e| e.to_string())?
    };
    let mark = |path: Option<&str>| -> Result<(), String> {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        c.execute(
            "UPDATE conversations SET vault_path = COALESCE(?2, vault_path), vault_watermark = ?3 WHERE id = ?1",
            params![chat.id, path, last],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    };
    let (content, whole) = match plan_note(chat, &title, &all, on_disk.as_deref(), recorded.as_deref(), learning) {
        NotePlan::Removed => return mark(None),
        NotePlan::Unchanged => return mark(Some(&relative)),
        NotePlan::Write { content, whole } => (content, whole),
    };
    if on_disk.as_deref() == Some(content.as_str()) {
        return mark(Some(&relative));
    }
    let _intent = WriteIntent::MaintainAuthored;
    vw::replace_if_unchanged(&target, on_disk.as_deref(), &content)?;
    {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        // Only a whole render is Olympus's own text. After an edit the note
        // stays marked as edited, so a later pass never renders over it.
        if whole {
            record_fingerprint(&c, &relative, &content).map_err(|e| e.to_string())?;
        }
    }
    mark(Some(&relative))?;
    super::persistence::log_vault_write(db, &relative, "save_chat");
    commit(root, &relative, "save chat");
    Ok(())
}

// ---- The memory note ----------------------------------------------------------

/// The memory note in three parts. The pass rewrites only `sections`, from the
/// first `## ` heading on; Kevin's frontmatter and anything he puts above the
/// sections are kept as he left them.
struct MemoryNote<'a> {
    frontmatter: Option<&'a str>,
    preamble: &'a str,
    sections: &'a str,
}

fn split_memory(note: &str) -> MemoryNote<'_> {
    let text = note.trim_start_matches('\u{feff}');
    let (frontmatter, rest) = match text.strip_prefix("---\n").or_else(|| text.strip_prefix("---\r\n")) {
        Some(inner) => match inner.find("\n---") {
            Some(end) => (Some(inner[..end].trim_end_matches('\r')), inner[end + 4..].trim_start_matches(['\r', '\n'])),
            None => (None, text),
        },
        None => (None, text),
    };
    let start = if rest.starts_with("## ") { Some(0) } else { rest.find("\n## ").map(|i| i + 1) };
    match start {
        Some(i) => MemoryNote { frontmatter, preamble: rest[..i].trim(), sections: rest[i..].trim() },
        None => MemoryNote { frontmatter, preamble: rest.trim(), sections: "" },
    }
}

/// What the note says, for the assistant and the pass: everything but the
/// frontmatter and Olympus's own heading and introduction.
pub fn memory_text(note: &str) -> String {
    let parts = split_memory(note);
    let preamble = parts.preamble.strip_prefix("# Olympus Memory").map(str::trim_start).unwrap_or(parts.preamble);
    let preamble = preamble.strip_prefix(MEMORY_INTRO).unwrap_or(preamble).trim();
    [preamble, parts.sections].iter().filter(|p| !p.is_empty()).copied().collect::<Vec<_>>().join("\n\n")
}

fn render_memory(before: Option<&str>, sections: &str) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d");
    let parts = before.map(split_memory);
    let frontmatter = match parts.as_ref().and_then(|p| p.frontmatter) {
        Some(existing) => {
            let mut lines: Vec<String> = existing.lines().map(|l| if l.starts_with("updated:") { format!("updated: {today}") } else { l.to_string() }).collect();
            if !lines.iter().any(|l| l.starts_with("updated:")) {
                lines.push(format!("updated: {today}"));
            }
            lines.join("\n")
        }
        None => format!("type: olympus-memory\nmemory_exclude: true\nupdated: {today}"),
    };
    let preamble = parts.as_ref().map(|p| p.preamble).filter(|p| !p.is_empty()).map(str::to_string)
        .unwrap_or_else(|| format!("# Olympus Memory\n\n{MEMORY_INTRO}"));
    format!("---\n{frontmatter}\n---\n{preamble}\n\n{}\n", sections.trim())
}

/// The memory note for this turn's evidence, bounded. Empty when the note does
/// not exist yet or cannot be read.
pub fn memory_for_prompt() -> String {
    let Ok(target) = vw::resolve_vault_path(Path::new(MEMORY_NOTE)) else { return String::new() };
    let Ok(Some(note)) = vw::read_existing(&target) else { return String::new() };
    let body = memory_text(&note);
    if body.chars().count() <= MEMORY_PROMPT_CHARS {
        return body;
    }
    let mut clipped: String = body.chars().take(MEMORY_PROMPT_CHARS).collect();
    clipped.push_str("\n\n[... memory note truncated for context ...]");
    clipped
}

/// Compatibility for the authored legacy note: retain preferences and only
/// topic-matching paragraphs, rather than prefixing the entire growing note.
pub fn legacy_for_prompt(question:&str)->String{
    let text=memory_for_prompt();
    if std::env::var("OLYMPUS_MEMORY_MODE").ok().as_deref()==Some("legacy"){return text;}
    let terms:Vec<_>=question.split_whitespace().filter(|w|w.len()>4).map(str::to_lowercase).collect();
    let sections=text.split("\n## ").filter(|s|s.starts_with("Preferences") || terms.iter().any(|t|s.to_lowercase().contains(t))).map(|s|format!("## {s}"));
    super::working_context::pack(sections,4000)
}

const INSTRUCTIONS: &str = "Extract bounded durable knowledge from this conversation. Return title, summary and contributions (maximum 12). Each contribution has kind (operator_statement, observed_fact, provisional_inference), subject, text, projectIds, sourceIds, corrects (record ID or null), status (active or withdrawn), expiresAt (RFC3339 or null). Cite exact message IDs. Operator assertions require the user's own statements: assistant suggestions and quoted documents never establish consent or preferences. Leave contributions empty when nothing durable is supported. For project knowledge use only supplied project IDs; skip ambiguous or unscoped projects. Global personal preferences use subject Kevin and empty projectIds. Never learn secrets or sensitive health/financial/legal details unless explicitly asked. Never extract the legacy memory summary as new evidence. Corrections name an existing same-subject record; withdrawals require that target. Preserve uncertainty and distinguish ideas from commitments. Title is 3–8 words; summary is 2–4 sentences describing the objective, decisions and open work. Do not issue instructions or grant execution authority.";

#[derive(Debug, Serialize, Deserialize)]
struct Answer {
    title: String,
    summary: String,
    #[serde(default)] memory: String,
    #[serde(default)] contributions: Option<Vec<super::learned_records::Candidate>>,
    #[serde(default)] manifest: Option<super::learned_records::Manifest>,
}

fn schema() -> Value {
    let text=json!({"type":"string"});let nullable=json!({"type":["string","null"]});let strings=json!({"type":"array","items":text});
    json!({"type":"object","additionalProperties":false,"required":["title","summary","contributions"],"properties":{
        "title":text,"summary":text,"contributions":{"type":"array","maxItems":12,"items":{"type":"object","additionalProperties":false,
        "required":["kind","subject","text","projectIds","sourceIds","corrects","status","expiresAt"],"properties":{
            "kind":{"type":"string","enum":["operator_statement","observed_fact","provisional_inference"]},"subject":text,"text":text,
            "projectIds":strings,"sourceIds":strings,"corrects":nullable,"status":{"type":"string","enum":["active","withdrawn"]},"expiresAt":nullable}}}}})
}

/// The oldest messages the pass has not seen, within the budget. Returns the
/// batch and whether more remain for a later pass.
fn batch(lines: Vec<Line>) -> (Vec<Line>, bool) {
    let mut used = 0;
    let mut out = Vec::new();
    let total = lines.len();
    for mut line in lines {
        if line.content.chars().count() > PASS_MESSAGE_CHARS {
            line.content = format!("{} [… message shortened]", line.content.chars().take(PASS_MESSAGE_CHARS).collect::<String>());
        }
        let size = line.content.chars().count();
        if !out.is_empty() && used + size > PASS_BUDGET_CHARS {
            break;
        }
        used += size;
        out.push(line);
    }
    let more = out.len() < total;
    (out, more)
}

/// Note names the pass may link to: projects and decisions, the vault's hubs.
const LINKABLE_FOLDERS: &[&str] = &["01 - Projects", "04 - Decisions"];
const LINKABLE_NOTES: usize = 300;
fn linkable_notes(root: &Path) -> Vec<String> {
    let mut names = Vec::new();
    for folder in LINKABLE_FOLDERS {
        let Ok(entries) = std::fs::read_dir(root.join(folder)) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = if path.is_dir() { path.file_name() } else if path.extension().is_some_and(|e| e == "md") { path.file_stem() } else { None };
            if let Some(name) = name.and_then(|n| n.to_str()).filter(|n| !n.starts_with('.') && n.chars().count() <= 120) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    names.dedup();
    names.truncate(LINKABLE_NOTES);
    names
}

fn pass_input(chat: &Chat, current: &str, lines: &[Line], more: bool, notes: &[String]) -> Value {
    json!({
        "today": chrono::Local::now().format("%A %Y-%m-%d").to_string(),
        "currentMemory": current,
        "vaultNotes": notes,
        "chat": {
            "currentTitle": chat.title,
            "titleChosenByKevin": chat.title_source == "operator",
            "earlierSummary": chat.summary,
            "newMessages": lines.iter().map(|l| json!({
                "id":l.id,"from": speaker(l),
                "at": if l.imported { "unknown".to_string() } else { local(&l.created_at).map(|t| t.format("%Y-%m-%d %H:%M").to_string()).unwrap_or_default() },
                "attached": l.attachment,
                "text": l.content,
            })).collect::<Vec<_>>(),
            "moreMessagesFollowInALaterPass": more,
        }
    })
}

fn checked(answer: Answer) -> Result<Answer, String> {
    let title = answer.title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() || title.chars().count() > 120 {
        return Err("memory_pass_bad_title".into());
    }
    if answer.summary.chars().count() > 2_000 || answer.memory.chars().count() > MEMORY_NOTE_CHARS {
        return Err("memory_pass_output_too_long".into());
    }
    // Text before the first section would land above the sections, where the
    // next pass treats it as Kevin's and never rewrites it.
    let memory = answer.memory.trim();
    let memory = if memory.is_empty() || memory.starts_with("## ") { memory.to_string() } else { format!("## Other\n{memory}") };
    Ok(Answer { title, memory, ..answer })
}

#[cfg(test)]
async fn learn(db: &Db, chat: &Chat, root: &Path) -> Result<(), String> {
    learn_with(db, chat, root, &|input| jobs::analyze(db,input)).await
}

async fn learn_with<F, Fut>(db: &Db, chat: &Chat, root: &Path, model: &F) -> Result<(), String>
where F: Fn(Value) -> Fut, Fut: std::future::Future<Output = Result<String, String>> {
    learn_with_mode(db,chat,root,model,true).await
}

async fn learn_with_mode<F,Fut>(db:&Db,chat:&Chat,root:&Path,model:&F,allow_new:bool)->Result<(),String>
where F:Fn(Value)->Fut,Fut:std::future::Future<Output=Result<String,String>> {
    {
        let c=db.0.lock().map_err(|e|e.to_string())?;
        let watermark:Option<i64>=c.query_row("SELECT memory_watermark FROM conversations WHERE id=?1",[&chat.id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
        if watermark != Some(chat.memory_watermark) { return if watermark.is_some_and(|w|w>chat.memory_watermark) {Ok(())} else {Err("memory_source_changed".into())}; }
        if !settings(&c).learn { return Err("analysis_waiting:memory_disabled".into()); }
    }
    let target = vw::resolve_within(root, Path::new(MEMORY_NOTE)).map_err(|e| e.to_string())?;
    let before = vw::read_existing(&target)?;
    let current = before.as_deref().map(memory_text).unwrap_or_default();
    let (source_revision, lines, more) = {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        let pending=lines_after(&c, &chat.id, chat.memory_watermark).map_err(|e|e.to_string())?;
        let revision=vw::content_fingerprint(&serde_json::to_string(&pending).map_err(|e|e.to_string())?);
        let (lines,more)=batch(pending); (revision,lines,more)
    };
    jobs::supersede_sources(db,chat,&source_revision,lines.last().map(|l|l.rowid).unwrap_or(chat.memory_watermark))?;
    let Some(seen) = lines.last().map(|l| l.rowid) else { return Ok(()) };
    if !allow_new && !lines.iter().any(|l|l.role=="user") {return Ok(());}
    if !lines.iter().any(|l| l.role == "user") {
        // Only Olympus spoke (a briefing added to a reopened chat): nothing of
        // Kevin's to learn, so no paid request.
        let c = db.0.lock().map_err(|e| e.to_string())?;
        c.execute("UPDATE conversations SET memory_watermark = ?2 WHERE id = ?1", params![chat.id, seen]).map_err(|e| e.to_string())?;
        return Ok(());
    }

    if let Some(prepared)=jobs::recover(db,chat,&source_revision,seen,before.as_deref(),!allow_new,root)? {
        return store_answer(db,chat,root,&target,prepared.before.as_deref(),&prepared.answer,seen,Some(&source_revision),Some(&prepared));
    }
    if !allow_new {return Ok(());}
    // Production supplies the selected qualified analyzer; tests supply synthetic output.
    let notes = linkable_notes(root);
    let claim=jobs::claim(db,chat,&source_revision,&lines,seen,before.as_deref())?;
    let projects:Vec<String>=super::memory::previous_scope(db,Some(&chat.id)).into_iter().collect();
    let mut input=pass_input(chat,&current,&lines,more,&notes);
    input["projectIds"]=json!(projects);
    input["existingRecords"]=super::learned_records::existing(root,&projects);
    input["_memoryContributionId"]=json!(claim.id);
    input["_memoryAttempt"]=json!(claim.attempt);
    let mut answer=match model(input).await.and_then(|raw|serde_json::from_str::<Answer>(&raw).map_err(|_|"memory_pass_invalid_output".into())).and_then(checked) {
        Ok(answer)=>answer,
        Err(error)=>{jobs::fail(db,&claim,&error);return Err(error);}
    };
    if let Some(items)=&answer.contributions {
        let c=db.0.lock().map_err(|e|e.to_string())?;
        let originals=lines_after(&c,&chat.id,chat.memory_watermark).map_err(|e|e.to_string())?;
        let sources=originals.iter().filter(|l|lines.iter().any(|seen|seen.id==l.id)).map(|l|super::learned_records::Evidence{
            id:l.id.clone(),revision:l.fingerprint.clone(),role:l.role.clone(),text:l.content.clone(),event_at:l.created_at.clone(),conversation:Some(chat.id.clone()),path:None}).collect::<Vec<_>>();
        answer.manifest=Some(super::learned_records::prepare(items,&sources,&projects,root)?);
    }
    let prepared=jobs::prepare(db,&claim,before.as_deref(),answer)?;
    store_answer(db,chat,root,&target,before.as_deref(),&prepared.answer,seen,Some(&source_revision),Some(&prepared))
}

fn store_answer(db: &Db, chat: &Chat, root: &Path, target: &Path, before: Option<&str>, answer: &Answer, seen: i64, source_revision: Option<&str>, prepared: Option<&jobs::Prepared>) -> Result<(), String> {
    let mut c=db.0.lock().map_err(|e|e.to_string())?;
    let tx=c.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(|e|e.to_string())?;
    if let Some(expected)=source_revision {
        let current:Option<i64>=tx.query_row("SELECT memory_watermark FROM conversations WHERE id=?1",[&chat.id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
        let pending=lines_after(&tx,&chat.id,chat.memory_watermark).map_err(|e|e.to_string())?;
        let revision=vw::content_fingerprint(&serde_json::to_string(&pending).map_err(|e|e.to_string())?);
        if current!=Some(chat.memory_watermark) || revision!=expected || !settings(&tx).learn {return Err("memory_source_changed".into());}
    }
    if let Some(prepared)=prepared {jobs::require_prepared(&tx,prepared)?;}
    let unchanged = answer.contributions.is_some() || before.map(|note| split_memory(note).sections.to_string()).unwrap_or_default() == answer.memory.trim();
    let result_note=prepared.map(|p|p.result.clone()).unwrap_or_else(||render_memory(before,&answer.memory));
    let on_disk=vw::read_existing(target)?;
    let recovered_write=answer.manifest.as_ref().is_some_and(|m|super::learned_records::published(root,&m.receipt)) || (prepared.is_some() && before!=Some(result_note.as_str()) && on_disk.as_deref()==Some(result_note.as_str()));
    if !recovered_write {
        if let Some(prepared)=prepared {
            if let Err(error)=jobs::require_route(&tx,&prepared.id) {
                tx.commit().map_err(|e|e.to_string())?;
                return Err(error);
            }
        }
    }
    if !recovered_write && on_disk.as_deref()!=before {return Err("memory_note_changed".into());}
    if let Some(manifest)=&answer.manifest { super::learned_records::publish(root,manifest)?; }
    if !unchanged && !recovered_write {
        // Kevin's edits are folded in by the pass itself, which read them as the
        // current memory. If he edited again while it ran, nothing is replaced
        // and the chat is retried.
        let _intent = WriteIntent::MaintainAuthored;
        vw::replace_if_unchanged(target, before, &result_note)?;
        commit(root, MEMORY_NOTE, "update memory");
    }
    tx.execute(
        "UPDATE conversations SET \
           title = CASE WHEN title_source = 'operator' THEN title ELSE ?2 END, \
           title_source = CASE WHEN title_source = 'operator' THEN title_source ELSE 'model' END, \
           summary = ?3, memory_watermark = ?4, memory_attempted_at = ?5, memory_error = NULL, memory_failures = 0 \
         WHERE id = ?1",
        params![chat.id, answer.title, answer.summary.trim(), seen, now_sql()],
    )
    .map_err(|e| e.to_string())?;
    if let Some(prepared)=prepared {
        let changed=tx.execute("UPDATE memory_contributions SET state='applied',updated_at=CURRENT_TIMESTAMP,error=NULL WHERE id=?1 AND state='prepared' AND attempts=?2",params![prepared.id,prepared.attempt]).map_err(|e|e.to_string())?;
        if changed!=1 {return Err("memory_contribution_changed".into());}
    }
    tx.commit().map_err(|e|e.to_string())?; drop(c);
    if !unchanged {super::persistence::log_vault_write(db, MEMORY_NOTE, "update_memory");}
    if let Some(manifest)=&answer.manifest {
        for path in manifest.files.keys(){super::persistence::log_vault_write(db,path,"learned_record");}
        if !manifest.files.is_empty(){commit(root,super::learned_records::FOLDER,"record source-backed memory");}
    }
    Ok(())
}

fn record_failure(db: &Db, id: &str, error: &str) {
    if super::analysis_readiness::is_waiting(error) || matches!(error,"analysis_waiting:memory_in_flight"|"analysis_waiting:memory_disabled"|"memory_route_changed") { return; }
    if let Ok(c) = db.0.lock() {
        let _ = c.execute(
            "UPDATE conversations SET memory_attempted_at = ?2, memory_error = ?3, memory_failures = memory_failures + 1 WHERE id = ?1",
            params![id, now_sql(), error.chars().take(500).collect::<String>()],
        );
    }
}

/// One pass over quiet chats: learn first, so a new note carries the model's
/// title and summary, then save the note.
pub async fn tick(db: &Db) {
    let root = match vault_root() {
        Ok(root) => root,
        Err(error) => { eprintln!("[Olympus::ChatMemory] {error}"); return; }
    };
    let readiness={let Ok(c)=db.0.lock() else{return};jobs::readiness(&c)};
    tick_with(db, &root, readiness, |input| jobs::analyze(db,input)).await;
}

async fn tick_with<F, Fut>(db: &Db, root: &Path, readiness: super::analysis_readiness::AnalysisReadiness, model: F)
where F: Fn(Value) -> Fut, Fut: std::future::Future<Output = Result<String, String>> {
    // Recover only already-written outputs before gating new inference.
    let recoverable={
        let Ok(c)=db.0.lock() else{return};
        if settings(&c).learn {
            let note=vw::resolve_within(root,Path::new(MEMORY_NOTE)).ok().and_then(|p|vw::read_existing(&p).ok().flatten()).unwrap_or_default();
            jobs::written_chats(&c,&note,root).unwrap_or_default()
        } else {Vec::new()}
    };
    for chat in recoverable {
        if let Err(error)=learn_with_mode(db,&chat,root,&model,false).await {record_failure(db,&chat.id,&error);}
    }
    let (chats, settings) = {
        let Ok(c) = db.0.lock() else { return };
        let settings = settings(&c);
        if !settings.save_chats && !settings.learn {
            return;
        }
        // Do not let the oldest blocked learning work occupy the archive batch.
        match due(&c, Settings { learn: settings.learn && readiness.can_attempt, ..settings }) {
            Ok(chats) => (chats, settings),
            Err(error) => {
                eprintln!("[Olympus::ChatMemory] could not read chats: {error}");
                return;
            }
        }
    };
    for chat in chats {
        let mut chat = chat;
        if chat.memory_due {
            match learn_with(db, &chat, root, &model).await {
                Ok(()) => {
                    if let Ok(c) = db.0.lock() {
                        if let Ok(summary) = c.query_row("SELECT summary FROM conversations WHERE id = ?1", [&chat.id], |r| r.get(0)) {
                            chat.summary = summary;
                        }
                    }
                    // A note written before this pass still shows the old title
                    // and no summary.
                    chat.vault_due |= settings.save_chats && chat.vault_path.is_some();
                }
                Err(error) => record_failure(db, &chat.id, &error),
            }
        }
        if chat.vault_due {
            if let Err(error) = save_note(db, &chat, &root) {
                eprintln!("[Olympus::ChatMemory] could not save chat {}: {error}", chat.id);
            }
        }
    }
}

pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(45)).await;
        loop {
            let db = app.state::<Db>();
            tick(db.inner()).await;
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        }
    });
}

// ---- Preferences ----------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    #[serde(flatten)]
    pub settings: Settings,
    pub saved_chats: i64,
    /// Unseen chats still within the retry budget, including quiet-time waits.
    pub pending_chats: i64,
    pub analysis: super::analysis_readiness::AnalysisReadiness,
    pub provider: Option<String>,
    pub contribution: Option<Value>,
    /// Chats from before 2026-10-13 that memory has not been asked to learn
    /// from, and those Kevin queued that are still in progress.
    pub earlier_waiting: i64,
    pub earlier_queued: i64,
    /// Chats whose memory pass failed `MAX_FAILURES` times in a row.
    pub stopped_chats: i64,
    /// The last pass that succeeded.
    pub last_learned_at: Option<String>,
    /// Set when the most recent pass failed.
    pub last_error: Option<String>,
    pub memory_note: String,
    pub chats_folder: String,
}

fn status(connection: &Connection) -> Result<Status, String> {
    let count = |sql: &str| connection.query_row(sql, [], |r| r.get::<_, i64>(0)).map_err(|e| e.to_string());
    let last_error: Option<String> = connection
        .query_row("SELECT memory_error FROM conversations WHERE memory_attempted_at IS NOT NULL ORDER BY memory_attempted_at DESC LIMIT 1", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();
    let last_learned_at: Option<String> = connection
        .query_row("SELECT max(memory_attempted_at) FROM conversations WHERE memory_error IS NULL", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let unseen = "c.memory_watermark < (SELECT max(m.rowid) FROM conversation_messages m WHERE m.conversation_id = c.id)";
    Ok(Status {
        settings: settings(connection),
        saved_chats: count("SELECT count(*) FROM conversations WHERE vault_path IS NOT NULL")?,
        pending_chats: count(&format!("SELECT count(*) FROM conversations c WHERE {unseen} AND memory_failures < {MAX_FAILURES} AND {HAS_OPERATOR_TURN}"))?,
        analysis: jobs::readiness(connection),
        provider: jobs::provider(connection).ok(),
        contribution: jobs::latest(connection)?,
        earlier_waiting: count(&format!("SELECT count(*) FROM conversations c WHERE legacy = 1 AND memory_attempted_at IS NULL AND NOT {unseen} AND {HAS_OPERATOR_TURN}"))?,
        earlier_queued: count(&format!("SELECT count(*) FROM conversations c WHERE legacy = 1 AND {unseen} AND memory_failures < {MAX_FAILURES} AND {HAS_OPERATOR_TURN}"))?,
        stopped_chats: count(&format!("SELECT count(*) FROM conversations c WHERE {unseen} AND memory_failures >= {MAX_FAILURES} AND {HAS_OPERATOR_TURN}"))?,
        last_learned_at: last_learned_at.as_deref().and_then(local).map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, false)),
        last_error,
        memory_note: MEMORY_NOTE.into(),
        chats_folder: CHATS_FOLDER.into(),
    })
}

/// Queues the earlier chats for the memory pass. Each is at least one paid
/// request, so Preferences shows the count before Kevin asks.
fn learn_from_earlier(connection: &Connection) -> Result<i64, String> {
    connection
        .execute(
            &format!("UPDATE conversations SET memory_watermark = 0 WHERE legacy = 1 AND memory_attempted_at IS NULL AND id IN (SELECT c.id FROM conversations c WHERE {HAS_OPERATOR_TURN})"),
            [],
        )
        .map(|n| n as i64)
        .map_err(|e| e.to_string())
}

fn locked<'a>(db: &State<'a, Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.inner().0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_memory_status(db: State<Db>) -> Result<Status, String> {
    status(&*locked(&db)?)
}

#[tauri::command]
pub fn set_chat_memory(db: State<Db>, settings: Settings) -> Result<Status, String> {
    let c = locked(&db)?;
    if settings.learn && !self::settings(&c).learn {
        // Turning learning back on is how stopped chats get another try.
        c.execute(&format!("UPDATE conversations SET memory_failures = 0 WHERE memory_failures >= {MAX_FAILURES}"), []).map_err(|e| e.to_string())?;
    }
    for (key, on) in [(SAVE_KEY, settings.save_chats), (LEARN_KEY, settings.learn), (USE_KEY, settings.use_memory)] {
        c.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
            params![key, if on { "true" } else { "false" }],
        )
        .map_err(|e| e.to_string())?;
    }
    status(&c)
}

#[tauri::command]
pub fn learn_from_earlier_chats(db: State<Db>) -> Result<i64, String> {
    learn_from_earlier(&*locked(&db)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_conversation_learning_reaches_brief_context() {
        let root=vault("brief-pipeline");
        let mut c=db();
        store_messages(&mut c,"chat-a",vec![message("u1","user","For the Helios launch, review accessibility before adding features.")]).unwrap();
        quiet(&c);
        let db=Db(std::sync::Mutex::new(c));
        let scope=super::super::briefing_context::Scope{temporary:false,conversation_id:Some("another-chat".into())};
        let now=chrono::Utc::now().timestamp_millis();
        let unlearned=super::super::briefing_context::snapshot(&db.0.lock().unwrap(),&scope,now).unwrap();
        assert!(unlearned.items.is_empty());
        tauri::async_runtime::block_on(tick_with(&db,&root,super::super::analysis_readiness::AnalysisReadiness::unverified("synthetic"),|input| {
            assert!(input["chat"]["newMessages"][0]["text"].as_str().unwrap().contains("review accessibility"));
            std::future::ready(Ok(json!({"title":"Helios launch priorities","summary":"Review launch accessibility before adding features.","memory":"## Projects\n- Helios: review launch accessibility before adding features."}).to_string()))
        }));
        let learned=super::super::briefing_context::snapshot(&db.0.lock().unwrap(),&scope,now).unwrap();
        assert_eq!(learned.items.len(),1);
        assert_eq!(learned.items[0].source_message_ids,vec!["u1"]);
        let recalled=super::super::conversations::recall(&db.0.lock().unwrap(),"Helios launch accessibility",Some("another-chat")).unwrap();
        assert_eq!(recalled[0].summary,"Review launch accessibility before adding features.");
        {
            let mut c=db.0.lock().unwrap();
            store_messages(&mut c,"chat-a",vec![message("a1","assistant","Opening briefing: recorded project activity.")]).unwrap();
            quiet(&c);
            assert!(super::super::briefing_context::snapshot(&c,&scope,now).unwrap().items.is_empty());
        }
        tauri::async_runtime::block_on(tick_with(&db,&root,super::super::analysis_readiness::AnalysisReadiness::unverified("synthetic"),|_| {
            panic!("Assistant-only bookkeeping must not invoke analysis");
            #[allow(unreachable_code)] std::future::ready(Err("unexpected".to_string()))
        }));
        let assistant_only=super::super::briefing_context::snapshot(&db.0.lock().unwrap(),&scope,now).unwrap();
        assert_eq!(learned.items[0].revision,assistant_only.items[0].revision,"Bookkeeping must not resurface unchanged context");
        {
            let mut c=db.0.lock().unwrap();
            store_messages(&mut c,"chat-a",vec![message("u2","user","The Helios launch is postponed. Keep accessibility review as the next task.")]).unwrap();
            quiet(&c);
            assert!(super::super::briefing_context::snapshot(&c,&scope,now).unwrap().items.is_empty());
        }
        tauri::async_runtime::block_on(tick_with(&db,&root,super::super::analysis_readiness::AnalysisReadiness::unverified("synthetic"),|input| {
            assert!(input["currentMemory"].as_str().unwrap().contains("review launch accessibility"));
            assert!(input["chat"]["newMessages"][0]["text"].as_str().unwrap().contains("postponed"));
            std::future::ready(Ok(json!({"title":"Helios launch priorities","summary":"The Helios launch is postponed; accessibility review remains next.","memory":"## Projects\n- Helios: launch postponed; accessibility review remains next."}).to_string()))
        }));
        let c=db.0.lock().unwrap();
        let revised=super::super::briefing_context::snapshot(&c,&scope,now).unwrap();
        assert_ne!(learned.revision,revised.revision);
        assert_eq!(revised.items[0].summary,"The Helios launch is postponed; accessibility review remains next.");
        let private=super::super::briefing_context::snapshot(&c,&super::super::briefing_context::Scope{temporary:true,conversation_id:None},now).unwrap();
        c.execute("INSERT INTO settings(key,value) VALUES('chatMemory.use','false')",[]).unwrap();
        let disabled=super::super::briefing_context::snapshot(&c,&scope,now).unwrap();
        assert!(!disabled.enabled&&disabled.items.is_empty()&&private.items.is_empty());
        let fixture=json!({"now":now,"unlearned":unlearned,"learned":learned,"assistantOnly":assistant_only,"revised":revised,"recalled":recalled,"private":private,"disabled":disabled});
        if let Ok(path)=std::env::var("OLYMPUS_BRIEF_FIXTURE_PATH") {
            std::fs::write(path,serde_json::to_vec_pretty(&fixture).unwrap()).unwrap();
        }
        drop(c);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn memory_route_change_during_inference_cannot_publish() {
        let root=vault("route-changed");let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Remember this")]).unwrap();quiet(&c);
        let selected=chat(&c,"talk");let db=Db(std::sync::Mutex::new(c));
        let result=tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_| {
            db.0.lock().unwrap().execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1','codex')",[]).unwrap();
            std::future::ready(Ok(json!({"title":"Old route","summary":"old","memory":"## Other\n- old route"}).to_string()))
        }));
        assert_eq!(result.unwrap_err(),"memory_route_changed");assert!(!root.join(MEMORY_NOTE).exists());
        assert_eq!(jobs::latest(&db.0.lock().unwrap()).unwrap().unwrap()["state"],"superseded");
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn uncommitted_prepared_memory_is_recomputed_after_route_change() {
        let root=vault("prepared-route-change");let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Remember this")]).unwrap();quiet(&c);
        let selected=chat(&c,"talk");let lines=lines_after(&c,"talk",0).unwrap();
        let revision=vw::content_fingerprint(&serde_json::to_string(&lines).unwrap());
        let db=Db(std::sync::Mutex::new(c));let claim=jobs::claim(&db,&selected,&revision,&lines,lines.last().unwrap().rowid,None).unwrap();
        jobs::prepare(&db,&claim,None,Answer{contributions:None,manifest:None,title:"Old route".into(),summary:"old".into(),memory:"## Other\n- old route".into()}).unwrap();
        db.0.lock().unwrap().execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1','codex')",[]).unwrap();
        let calls=std::cell::Cell::new(0);
        tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_| {
            calls.set(calls.get()+1);std::future::ready(Ok(json!({"title":"New route","summary":"new","memory":"## Other\n- new route"}).to_string()))
        })).unwrap();
        assert_eq!(calls.get(),1);assert!(std::fs::read_to_string(root.join(MEMORY_NOTE)).unwrap().contains("new route"));
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn unchanged_prepared_note_does_not_prove_publication_under_old_route() {
        let root=vault("unchanged-prepared-route");let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Remember this")]).unwrap();quiet(&c);
        let selected=chat(&c,"talk");let lines=lines_after(&c,"talk",0).unwrap();
        let revision=vw::content_fingerprint(&serde_json::to_string(&lines).unwrap());
        let before=render_memory(None,"## Other\n- existing");
        std::fs::create_dir_all(root.join(MEMORY_NOTE).parent().unwrap()).unwrap();
        std::fs::write(root.join(MEMORY_NOTE),&before).unwrap();
        let db=Db(std::sync::Mutex::new(c));let claim=jobs::claim(&db,&selected,&revision,&lines,lines.last().unwrap().rowid,Some(&before)).unwrap();
        jobs::prepare(&db,&claim,Some(&before),Answer{contributions:None,manifest:None,title:"Old route".into(),summary:"old".into(),memory:"## Other\n- existing".into()}).unwrap();
        db.0.lock().unwrap().execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1','codex')",[]).unwrap();
        let calls=std::cell::Cell::new(0);
        tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_| {
            calls.set(calls.get()+1);std::future::ready(Ok(json!({"title":"New route","summary":"new","memory":"## Other\n- existing"}).to_string()))
        })).unwrap();
        assert_eq!(calls.get(),1,"An unchanged note cannot prove the old output was published");
        assert_eq!(db.0.lock().unwrap().query_row("SELECT summary FROM conversations WHERE id='talk'",[],|r|r.get::<_,String>(0)).unwrap(),"new");
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn overlapping_workers_do_not_issue_duplicate_memory_inference() {
        let root=vault("overlap"); let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Prefer concise replies")]).unwrap();quiet(&c);
        let selected=chat(&c,"talk"); let db=Db(std::sync::Mutex::new(c));
        tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_| async {
            let second=learn_with(&db,&selected,&root,&|_| {
                panic!("An active contribution must exclude duplicate model work");
                #[allow(unreachable_code)] std::future::ready(Err("duplicate".into()))
            }).await;
            assert!(second.unwrap_err().starts_with("analysis_waiting:"));
            Ok(json!({"title":"Preferences","summary":"Concise replies","memory":"## Preferences\n- Concise replies"}).to_string())
        })).unwrap();
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn prepared_contribution_recovers_after_note_write_without_another_model_call() {
        let root=vault("crash-recovery"); let database=root.join("memory-restart.sqlite");
        let mut c=Connection::open(&database).unwrap();super::super::migrations::apply(&c).unwrap();
        store_messages(&mut c,"talk",vec![message("u","user","Prefer concise replies")]).unwrap(); quiet(&c);
        let selected=chat(&c,"talk");
        c.execute_batch("CREATE TRIGGER crash_after_note BEFORE UPDATE OF memory_watermark ON conversations BEGIN SELECT RAISE(ABORT,'synthetic interruption after note write'); END;").unwrap();
        let db=Db(std::sync::Mutex::new(c));
        let first=tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_|std::future::ready(Ok(json!({"title":"Preferences","summary":"Concise replies","memory":"## Preferences\n- Concise replies"}).to_string()))));
        assert!(first.is_err()); assert!(root.join(MEMORY_NOTE).exists());
        drop(db);
        let c=Connection::open(&database).unwrap();
        c.execute_batch("DROP TRIGGER crash_after_note").unwrap();
        let db=Db(std::sync::Mutex::new(c));
        {
            let c=db.0.lock().unwrap();
            // Emulate withdrawn/replaced confirmation without touching an account.
            c.execute("UPDATE memory_contributions SET route_binding_json='{}'",[]).unwrap();
            c.execute("INSERT INTO settings(key,value) VALUES('chatMemory.learn','false')",[]).unwrap();
        }
        tauri::async_runtime::block_on(tick_with(&db,&root,super::super::analysis_readiness::AnalysisReadiness::waiting("blocked","account_confirmation","confirmation removed"),|_| {
            panic!("Disabled learning cannot invoke a provider");
            #[allow(unreachable_code)] std::future::ready(Err("unexpected".into()))
        }));
        {
            let c=db.0.lock().unwrap();
            assert_eq!(jobs::latest(&c).unwrap().unwrap()["state"],"prepared");
            c.execute("UPDATE settings SET value='true' WHERE key='chatMemory.learn'",[]).unwrap();
        }
        let blocked=super::super::analysis_readiness::AnalysisReadiness::waiting("blocked","account_confirmation","confirmation removed");
        tauri::async_runtime::block_on(tick_with(&db,&root,blocked,|_| {
            panic!("Recovery must reuse prepared output rather than invoke a provider");
            #[allow(unreachable_code)] std::future::ready(Err("unexpected".into()))
        }));
        let c=db.0.lock().unwrap();
        let receipt:(String,String,i64)=c.query_row("SELECT state,source_revision,through_watermark FROM memory_contributions",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(receipt.0,"applied"); assert_eq!(receipt.1.len(),64); assert!(receipt.2>0);
        let refs:String=c.query_row("SELECT source_refs_json FROM memory_contributions",[],|r|r.get(0)).unwrap();
        let refs:Value=serde_json::from_str(&refs).unwrap();
        assert_eq!(refs[0]["messageId"],"u");
        assert_eq!(refs[0]["fingerprint"],vw::content_fingerprint("Prefer concise replies"));
        let displayed=jobs::latest(&c).unwrap().unwrap();
        assert_eq!(displayed["state"],"applied");assert!(displayed["actualModel"].is_null());
        drop(c);drop(db);
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn stale_prepared_attempt_cannot_write_or_receipt_a_reclaimed_job() {
        let root=vault("stale-prepared");let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Remember this")]).unwrap();quiet(&c);
        let selected=chat(&c,"talk");let lines=lines_after(&c,"talk",0).unwrap();let seen=lines.last().unwrap().rowid;
        let revision=vw::content_fingerprint(&serde_json::to_string(&lines).unwrap());let db=Db(std::sync::Mutex::new(c));
        let first=jobs::claim(&db,&selected,&revision,&lines,seen,None).unwrap();
        let old=jobs::prepare(&db,&first,None,Answer{contributions:None,manifest:None,title:"old".into(),summary:"old".into(),memory:"## Other\n- old".into()}).unwrap();
        db.0.lock().unwrap().execute("UPDATE memory_contributions SET state='superseded' WHERE id=?1",[&first.id]).unwrap();
        let next=jobs::claim(&db,&selected,&revision,&lines,seen,None).unwrap();
        jobs::prepare(&db,&next,None,Answer{contributions:None,manifest:None,title:"new".into(),summary:"new".into(),memory:"## Other\n- new".into()}).unwrap();
        let target=root.join(MEMORY_NOTE);
        let result=store_answer(&db,&selected,&root,&target,None,&old.answer,seen,Some(&revision),Some(&old));
        assert_eq!(result.unwrap_err(),"memory_contribution_changed");
        assert!(!target.exists(),"An expired prepared handle cannot write before its attempt is checked");
        assert_eq!(jobs::latest(&db.0.lock().unwrap()).unwrap().unwrap()["state"],"prepared");
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn obsolete_written_receipts_do_not_starve_later_crash_recovery() {
        let root=vault("recovery-fairness");let mut c=db();
        for i in 0..4 {store_messages(&mut c,&format!("chat{i}"),vec![message(&format!("u{i}"),"user","Remember this")]).unwrap();}
        quiet(&c);let db=Db(std::sync::Mutex::new(c));let mut written=String::new();
        for i in 0..4 {
            let (selected,lines)={let c=db.0.lock().unwrap();let mut selected=chat(&c,"chat0");selected.id=format!("chat{i}");(selected,lines_after(&c,&format!("chat{i}"),0).unwrap())};
            let revision=vw::content_fingerprint(&serde_json::to_string(&lines).unwrap());
            let claim=jobs::claim(&db,&selected,&revision,&lines,lines.last().unwrap().rowid,None).unwrap();
            let prepared=jobs::prepare(&db,&claim,None,Answer{contributions:None,manifest:None,title:"Remembered".into(),summary:"Remembered".into(),memory:"## Other\n- remembered".into()}).unwrap();
            if i==0 {written=prepared.result.clone();}
            let c=db.0.lock().unwrap();
            c.execute("UPDATE memory_contributions SET result_note=?2 WHERE id=?1",params![claim.id,written]).unwrap();
            if i<3 {c.execute("UPDATE conversation_messages SET content='Changed source' WHERE id=?1",[format!("u{i}")]).unwrap();}
        }
        std::fs::create_dir_all(root.join(MEMORY_NOTE).parent().unwrap()).unwrap();std::fs::write(root.join(MEMORY_NOTE),written).unwrap();
        for _ in 0..2 {
            tauri::async_runtime::block_on(tick_with(&db,&root,super::super::analysis_readiness::AnalysisReadiness::waiting("blocked","account_confirmation","withdrawn"),|_| {
                panic!("Receipt recovery must never invoke inference");
                #[allow(unreachable_code)] std::future::ready(Err("unexpected".into()))
            }));
        }
        let c=db.0.lock().unwrap();
        assert_eq!(c.query_row("SELECT state FROM memory_contributions WHERE conversation_id='chat3'",[],|r|r.get::<_,String>(0)).unwrap(),"applied");
        assert_eq!(c.query_row("SELECT count(*) FROM memory_contributions WHERE state='superseded' AND error='memory_source_changed'",[],|r|r.get::<_,i64>(0)).unwrap(),3);
        drop(c);drop(db);std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn changed_source_cannot_publish_memory() {
        let root = vault("changed-source");
        let mut c = db();
        store_messages(&mut c,"talk",vec![message("u","user","Original preference")]).unwrap(); quiet(&c);
        let selected = chat(&c,"talk"); let db=Db(std::sync::Mutex::new(c)); let calls=std::cell::Cell::new(0);
        let result=tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&|_| {
            calls.set(calls.get()+1);
            db.0.lock().unwrap().execute("UPDATE conversation_messages SET content='Corrected preference' WHERE id='u'",[]).unwrap();
            std::future::ready(Ok(json!({"title":"Preferences","summary":"Original preference","memory":"## Preferences\n- Original preference"}).to_string()))
        }));
        assert_eq!(calls.get(),1);
        assert_eq!(result.unwrap_err(),"memory_source_changed");
        assert!(!root.join(MEMORY_NOTE).exists());
        assert_eq!(db.0.lock().unwrap().query_row("SELECT memory_watermark FROM conversations WHERE id='talk'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn a_stale_worker_snapshot_does_not_repeat_a_completed_contribution() {
        let root=vault("repeated-contribution"); let mut c=db();
        store_messages(&mut c,"talk",vec![message("u","user","Prefer concise replies")]).unwrap(); quiet(&c);
        let selected=chat(&c,"talk"); let db=Db(std::sync::Mutex::new(c)); let calls=std::cell::Cell::new(0);
        let model=|_| {calls.set(calls.get()+1);std::future::ready(Ok(json!({"title":"Preferences","summary":"Concise replies","memory":"## Preferences\n- Concise replies"}).to_string()))};
        for _ in 0..2 {tauri::async_runtime::block_on(learn_with(&db,&selected,&root,&model)).unwrap();}
        assert_eq!(calls.get(),1);
        std::fs::remove_dir_all(root).ok();
    }
    #[test]
    fn quiet_chats_archive_while_blocked_then_learn_without_operator_management() {
        let root = vault("automatic-resumption");
        let mut c = db();
        for id in ["a", "b", "c", "d"] {
            store_messages(&mut c, id, vec![message(id, "user", "For Olympus, remember that I prefer automatic context, not categorization.")]).unwrap();
        }
        quiet(&c);
        let db = Db(std::sync::Mutex::new(c));
        let calls = std::cell::Cell::new(0);
        let analyze = |input: Value| {
            calls.set(calls.get() + 1);
            assert!(input["chat"]["newMessages"][0]["text"].as_str().unwrap().contains("automatic context"));
            std::future::ready(Ok(json!({"title":"Olympus direction","summary":"Kevin wants automatic context for Olympus.","memory":"## Preferences\n- Kevin prefers automatic context over categorization for Olympus."}).to_string()))
        };
        for _ in 0..3 {
            tauri::async_runtime::block_on(tick_with(&db, &root, super::super::subscription_jobs::readiness(), &analyze));
        }
        assert_eq!(calls.get(), 0, "blocked chats must not reach the analyzer");
        {
            let c = db.0.lock().unwrap();
            let archived: i64 = c.query_row("SELECT count(*) FROM conversations WHERE vault_path IS NOT NULL", [], |r| r.get(0)).unwrap();
            assert_eq!(archived, 4, "blocked learning must not starve later chat archives");
            let untouched: i64 = c.query_row("SELECT count(*) FROM conversations WHERE memory_watermark=0 AND memory_failures=0 AND memory_attempted_at IS NULL", [], |r| r.get(0)).unwrap();
            assert_eq!(untouched, 4);
            assert!(status(&c).unwrap().last_learned_at.is_none());
        }
        for _ in 0..3 {
            tauri::async_runtime::block_on(tick_with(&db, &root, super::super::analysis_readiness::AnalysisReadiness::unverified("synthetic test analyzer"), &analyze));
        }
        assert_eq!(calls.get(), 4, "eligible unseen work resumes once, without setting changes");
        let remembered = memory_text(&std::fs::read_to_string(root.join(MEMORY_NOTE)).unwrap());
        assert!(remembered.contains("automatic context over categorization"));
        let c = db.0.lock().unwrap();
        assert!(due(&c, settings(&c)).unwrap().is_empty());
        assert!(status(&c).unwrap().last_learned_at.is_some());
        let summary: String = c.query_row("SELECT summary FROM conversations WHERE id='d'", [], |r| r.get(0)).unwrap();
        assert_eq!(summary, "Kevin wants automatic context for Olympus.");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn readiness_race_does_not_consume_a_memory_retry() {
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "Keep Olympus context automatically")]).unwrap();
        let db = Db(std::sync::Mutex::new(c));
        record_failure(&db, "talk", "analysis_waiting:generation_protection");
        let c = db.0.lock().unwrap();
        let row: (i64, Option<String>, i64) = c.query_row("SELECT memory_failures,memory_attempted_at,memory_watermark FROM conversations", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
        assert_eq!(row, (0, None, 0));
        let displayed = json!(status(&c).unwrap());
        assert_eq!(displayed["pendingChats"], 1);
        assert_eq!(displayed["analysis"]["canAttempt"], false);
    }

    #[test]
    fn the_pass_may_link_only_to_project_and_decision_notes_that_exist() {
        let root = std::env::temp_dir().join(format!("olympus-linkable-{}", super::super::delegation::run_id()));
        for folder in ["01 - Projects/Olympus", "04 - Decisions", "02 - Research"] {
            std::fs::create_dir_all(root.join(folder)).unwrap();
        }
        for file in ["01 - Projects/Project Olympus.md", "01 - Projects/notes.txt", "04 - Decisions/2026-10-20 Subscriptions.md", "02 - Research/Paper.md", "01 - Projects/.hidden.md"] {
            std::fs::write(root.join(file), "x").unwrap();
        }
        assert_eq!(linkable_notes(&root), vec!["2026-10-20 Subscriptions", "Olympus", "Project Olympus"]);
        let input = pass_input(&Chat { id: "c".into(), title: "t".into(), title_source: "model".into(), summary: String::new(), created_at: String::new(), vault_path: None, vault_watermark: 0, memory_watermark: 0, vault_due: false, memory_due: true, legacy: false }, "", &[], false, &linkable_notes(&root));
        assert_eq!(input["vaultNotes"][2], "Project Olympus");
        assert!(INSTRUCTIONS.contains("only supplied project IDs") && INSTRUCTIONS.contains("Never extract the legacy memory summary"));
        std::fs::remove_dir_all(root).unwrap();
    }
    use crate::commands::persistence::{store_messages, ConversationMessage};

    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&c).unwrap();
        c
    }


    #[test]
    fn source_backed_learning_preserves_legacy_note_and_recovers_receipt_without_inference() {
        let root=vault("source-backed");let mut c=db();
        store_messages(&mut c,"chat-new",vec![message("u-new","user","I prefer concise conversational updates.")]).unwrap();
        quiet(&c);
        let chat=chat(&c,"chat-new");let db=Db(std::sync::Mutex::new(c));
        let before="---\ntype: memory\n---\n# My memory\n\n## Preferences\nMy own words.\n";
        std::fs::create_dir_all(root.join("09 - System")).unwrap();std::fs::write(root.join(MEMORY_NOTE),before).unwrap();
        tauri::async_runtime::block_on(learn_with(&db,&chat,&root,&|input|async move{
            assert_eq!(input["chat"]["newMessages"][0]["id"],"u-new");
            Ok(json!({"title":"Conversational updates","summary":"Kevin prefers conversational updates.","contributions":[{
                "kind":"operator_statement","subject":"Kevin","text":"Prefers concise conversational updates.","projectIds":[],"sourceIds":["u-new"],"corrects":null,"status":"active","expiresAt":null}]}).to_string())
        })).unwrap();
        assert_eq!(std::fs::read_to_string(root.join(MEMORY_NOTE)).unwrap(),before);
        let manifest={let c=db.0.lock().unwrap();let raw:String=c.query_row("SELECT answer_json FROM memory_contributions",[],|r|r.get(0)).unwrap();serde_json::from_str::<Answer>(&raw).unwrap().manifest.unwrap()};
        assert!(super::super::learned_records::published(&root,&manifest.receipt));
        {let c=db.0.lock().unwrap();c.execute("UPDATE memory_contributions SET state='prepared'",[]).unwrap();c.execute("UPDATE conversations SET memory_watermark=0",[]).unwrap();}
        tauri::async_runtime::block_on(learn_with_mode(&db,&chat,&root,&|_|async{panic!("recovery called the model");#[allow(unreachable_code)] Ok(String::new())},false)).unwrap();
        assert_eq!(db.0.lock().unwrap().query_row("SELECT state FROM memory_contributions",[],|r|r.get::<_,String>(0)).unwrap(),"applied");
        assert_eq!(manifest.files.len(),1);
        std::fs::remove_dir_all(root).unwrap();
    }

    fn message(id: &str, role: &str, content: &str) -> ConversationMessage {
        serde_json::from_value(json!({"id": id, "role": role, "content": content, "timestamp": "12:00"})).unwrap()
    }

    fn quiet(c: &Connection) {
        c.execute("UPDATE conversations SET updated_at = '2026-10-01 09:00:00'", []).unwrap();
    }

    /// One real memory pass on copies: Kevin's database copied to a temporary
    /// file and a temporary vault holding only his project and decision names.
    /// Uses the explicitly selected memory runtime without fallback; writes nothing of his.
    #[test]
    #[ignore = "Live subscription memory pass on copied data"]
    fn live_memory_pass_on_copies() {
        let id = std::env::var("OLYMPUS_MEMORY_LIVE_CHAT").expect("chat id to learn from");
        let app_data = PathBuf::from(std::env::var("APPDATA").unwrap()).join("com.projectolympus.commandstation");
        let _ = super::super::subscription_jobs::APP_DATA_FOR_TESTS.set(app_data.clone());
        let work = std::env::temp_dir().join(format!("olympus-live-memory-{}", super::super::delegation::run_id()));
        std::fs::create_dir_all(work.join("vault/09 - System")).unwrap();
        let real_vault = super::super::get_vault_path();
        for folder in LINKABLE_FOLDERS {
            std::fs::create_dir_all(work.join("vault").join(folder)).unwrap();
            for name in linkable_notes(&real_vault) {
                if real_vault.join(folder).join(format!("{name}.md")).is_file() {
                    std::fs::write(work.join("vault").join(folder).join(format!("{name}.md")), "").unwrap();
                }
            }
        }
        let db_copy = work.join("olympus.sqlite");
        rusqlite::Connection::open_with_flags(app_data.join("olympus.sqlite"), rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap()
            .execute_batch(&format!("VACUUM INTO '{}'", db_copy.display().to_string().replace('\'', "''"))).unwrap();
        let c = Connection::open(&db_copy).unwrap();
        c.execute("UPDATE conversations SET memory_failures = 0, memory_attempted_at = NULL, memory_error = NULL, memory_watermark = 0, updated_at = datetime('now', '-1 hour') WHERE id = ?1", params![id]).unwrap();
        let target = chat(&c, &id);
        let db = Db(std::sync::Mutex::new(c));
        let root = work.join("vault");
        let result = tauri::async_runtime::block_on(learn(&db, &target, &root));
        println!("MEMORY_PASS_RESULT {result:?}");
        let note = std::fs::read_to_string(root.join(MEMORY_NOTE)).unwrap_or_default();
        println!("MEMORY_NOTE_BEGIN
{note}
MEMORY_NOTE_END");
        let summary: (String, String) = db.0.lock().unwrap().query_row("SELECT title, summary FROM conversations WHERE id = ?1", params![id], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        println!("MEMORY_CHAT {summary:?}");
        result.unwrap();
        assert!(note.contains("## "));
    }

    fn chat(c: &Connection, id: &str) -> Chat {
        due(c, Settings { save_chats: true, learn: true, use_memory: true }).unwrap().into_iter().find(|ch| ch.id == id).unwrap()
    }

    fn git(root: &Path, args: &[&str]) -> String {
        let out = std::process::Command::new("git").arg("-C").arg(root).args(args).output().unwrap();
        assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn vault(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("olympus-chat-memory-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "-q"]);
        git(&root, &["config", "user.name", "Olympus Test"]);
        git(&root, &["config", "user.email", "olympus@example.invalid"]);
        std::fs::write(root.join("Home.md"), "home\n").unwrap();
        git(&root, &["add", "."]);
        git(&root, &["commit", "-qm", "seed"]);
        root
    }

    #[test]
    fn a_quiet_chat_is_written_to_the_vault_committed_and_kevins_edits_survive() {
        let root = vault("note");
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "Plan the week"), message("a", "assistant", "Monday: review.")]).unwrap();
        c.execute("INSERT INTO settings (key, value) VALUES (?1, 'false')", [LEARN_KEY]).unwrap();
        quiet(&c);
        let db = Db(std::sync::Mutex::new(c));
        let first = due(&db.0.lock().unwrap(), Settings { save_chats: true, learn: false, use_memory: true }).unwrap().remove(0);
        save_note(&db, &first, &root).unwrap();

        let relative: String = db.0.lock().unwrap().query_row("SELECT vault_path FROM conversations WHERE id = 'talk'", [], |r| r.get(0)).unwrap();
        assert!(relative.starts_with("10 - Conversations/") && relative.contains("Plan the week"), "{relative}");
        let written = std::fs::read_to_string(root.join(&relative)).unwrap();
        assert!(written.contains("Monday: review.") && written.contains("No summary: learning from chats is off."));
        assert!(git(&root, &["log", "-1", "--format=%s"]).trim() == format!("olympus: save chat {relative}"), "each write is its own commit");
        assert!(due(&db.0.lock().unwrap(), Settings { save_chats: true, learn: false, use_memory: true }).unwrap().is_empty());

        std::fs::write(root.join(&relative), format!("{written}\nKevin: follow up Friday.\n")).unwrap();
        {
            let mut c = db.0.lock().unwrap();
            store_messages(&mut c, "talk", vec![message("u2", "user", "Add the dentist on Thursday")]).unwrap();
            quiet(&c);
        }
        let again = due(&db.0.lock().unwrap(), Settings { save_chats: true, learn: false, use_memory: true }).unwrap().remove(0);
        save_note(&db, &again, &root).unwrap();
        let kept = std::fs::read_to_string(root.join(&relative)).unwrap();
        assert!(kept.contains("Kevin: follow up Friday.") && kept.contains("Add the dentist on Thursday"));
        assert_eq!(kept.matches("Monday: review.").count(), 1);

        std::fs::remove_file(root.join(&relative)).unwrap();
        {
            let mut c = db.0.lock().unwrap();
            store_messages(&mut c, "talk", vec![message("u3", "user", "One more thing")]).unwrap();
            quiet(&c);
        }
        let third = due(&db.0.lock().unwrap(), Settings { save_chats: true, learn: false, use_memory: true }).unwrap().remove(0);
        save_note(&db, &third, &root).unwrap();
        assert!(!root.join(&relative).exists(), "a note Kevin deleted is not brought back");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_memory_answer_writes_the_note_keeps_kevins_title_and_refuses_a_note_changed_mid_pass() {
        let root = vault("memory");
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "I moved to Lisbon in September")]).unwrap();
        c.execute("UPDATE conversations SET title = 'Moving', title_source = 'operator'", []).unwrap();
        quiet(&c);
        let db = Db(std::sync::Mutex::new(c));
        let chat = due(&db.0.lock().unwrap(), Settings { save_chats: false, learn: true, use_memory: true }).unwrap().remove(0);
        let target = root.join(MEMORY_NOTE);
        let answer = Answer { contributions:None, manifest:None, title: "Lisbon move".into(), summary: "Kevin moved to Lisbon.".into(), memory: "## About Kevin\n- Lives in Lisbon since September 2026.".into() };

        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(&target, "Kevin typed this while the pass ran.\n").unwrap();
        assert!(store_answer(&db, &chat, &root, &target, None, &answer, 1, None, None).is_err(), "a note that appeared mid-pass is not replaced");
        let untouched: i64 = db.0.lock().unwrap().query_row("SELECT memory_watermark FROM conversations", [], |r| r.get(0)).unwrap();
        assert_eq!(untouched, 0, "nothing is marked learned");

        let before = std::fs::read_to_string(&target).unwrap();
        store_answer(&db, &chat, &root, &target, Some(&before), &answer, 1, None, None).unwrap();
        let note = std::fs::read_to_string(&target).unwrap();
        assert!(note.contains("Lives in Lisbon since September 2026.") && note.contains("type: olympus-memory"));
        assert!(git(&root, &["log", "-1", "--format=%s"]).contains("update memory"));
        let (title, summary, watermark): (String, String, i64) = db.0.lock().unwrap()
            .query_row("SELECT title, summary, memory_watermark FROM conversations", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).unwrap();
        assert_eq!((title.as_str(), summary.as_str(), watermark), ("Moving", "Kevin moved to Lisbon.", 1), "Kevin's title stays");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_chat_where_only_olympus_spoke_since_is_marked_seen_without_a_request() {
        let root = vault("briefing");
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "Plan the week")]).unwrap();
        let first = lines_after(&c, "talk", 0).unwrap()[0].rowid;
        c.execute("UPDATE conversations SET memory_watermark = ?1", [first]).unwrap();
        store_messages(&mut c, "talk", vec![message("briefing-2", "assistant", "Two commits landed since.")]).unwrap();
        quiet(&c);
        let db = Db(std::sync::Mutex::new(c));
        let chat = due(&db.0.lock().unwrap(), Settings { save_chats: false, learn: true, use_memory: true }).unwrap().remove(0);
        // No network in tests: this returns only because no request is made.
        tauri::async_runtime::block_on(learn(&db, &chat, &root)).unwrap();
        let c = db.0.lock().unwrap();
        assert!(due(&c, Settings { save_chats: false, learn: true, use_memory: true }).unwrap().is_empty());
        let requests: i64 = c.query_row("SELECT count(*) FROM model_requests", [], |r| r.get(0)).unwrap();
        assert_eq!(requests, 0);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn switches_default_on_and_turn_off_individually() {
        let c = db();
        assert_eq!(settings(&c), Settings { save_chats: true, learn: true, use_memory: true });
        c.execute("INSERT INTO settings (key, value) VALUES (?1, 'false')", [LEARN_KEY]).unwrap();
        assert_eq!(settings(&c), Settings { save_chats: true, learn: false, use_memory: true });
    }

    #[test]
    fn only_quiet_chats_with_an_operator_turn_and_unseen_messages_are_due() {
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "Plan the week"), message("a", "assistant", "Done.")]).unwrap();
        store_messages(&mut c, "brief", vec![message("b", "assistant", "Two commits landed.")]).unwrap();
        let all = Settings { save_chats: true, learn: true, use_memory: true };
        assert!(due(&c, all).unwrap().is_empty(), "a chat touched just now is still active");
        quiet(&c);
        let found = due(&c, all).unwrap();
        assert_eq!(found.iter().map(|ch| ch.id.as_str()).collect::<Vec<_>>(), vec!["talk"], "a briefing alone is not a chat");

        let last = lines_after(&c, "talk", 0).unwrap().last().unwrap().rowid;
        c.execute("UPDATE conversations SET vault_watermark = ?1, memory_watermark = ?1", [last]).unwrap();
        assert!(due(&c, all).unwrap().is_empty(), "nothing unseen");

        c.execute("UPDATE conversations SET memory_watermark = 0, memory_attempted_at = ?1", [now_sql()]).unwrap();
        assert_eq!(due(&c, all).unwrap().len(), 1, "a pass that succeeded does not hold back the next one");
        let db = Db(std::sync::Mutex::new(c));
        record_failure(&db, "talk", "assessment_provider_incomplete_or_refused");
        let c = db.0.into_inner().unwrap();
        assert!(due(&c, all).unwrap().is_empty(), "a failed pass waits before a paid retry");
        c.execute("UPDATE conversations SET vault_watermark = 0", []).unwrap();
        let note_only = due(&c, all).unwrap();
        assert!(note_only[0].vault_due && !note_only[0].memory_due, "a due note does not cut the retry wait short");
        c.execute("UPDATE conversations SET memory_attempted_at = datetime('now', '-31 minutes')", []).unwrap();
        assert!(due(&c, all).unwrap()[0].memory_due, "one failure waits thirty minutes");
        c.execute("UPDATE conversations SET memory_failures = 2", []).unwrap();
        assert!(!due(&c, all).unwrap()[0].memory_due, "the wait doubles");
        c.execute("UPDATE conversations SET memory_failures = ?1, memory_attempted_at = '2026-01-01 00:00:00' WHERE id = 'talk'", [MAX_FAILURES]).unwrap();
        assert!(!due(&c, all).unwrap()[0].memory_due, "repeated failures stop the paid retries");
        assert_eq!(status(&c).unwrap().stopped_chats, 1);
        c.execute("UPDATE conversations SET memory_failures = 0, memory_error = NULL", []).unwrap();
        assert!(!due(&c, Settings { learn: false, ..all }).unwrap()[0].memory_due);
    }

    #[test]
    fn a_note_renders_whole_until_kevin_edits_it_then_only_new_messages_are_added() {
        let mut c = db();
        store_messages(&mut c, "talk", vec![message("u", "user", "Plan the week"), message("a", "assistant", "Monday: review.")]).unwrap();
        quiet(&c);
        let first = chat(&c, "talk");
        let lines = lines_after(&c, "talk", 0).unwrap();
        let NotePlan::Write { content, whole } = plan_note(&first, "Weekly plan", &lines, None, None, true) else { panic!() };
        assert!(whole && content.contains("# Weekly plan") && content.contains("### Kevin ·") && content.contains("Monday: review."));
        assert!(content.starts_with("---\ntype: conversation\n") && content.contains("title: \"Weekly plan\""));
        assert!(content.contains("Summary pending"));

        let ours = vw::content_fingerprint(&content);
        let again = plan_note(&first, "Weekly plan", &lines, Some(&content), Some(&ours), true);
        assert!(matches!(again, NotePlan::Write { whole: true, .. }), "unchanged bytes are Olympus's to re-render");

        let edited = format!("{content}\nMy own note.\n");
        let seen = Chat { vault_watermark: lines.last().unwrap().rowid, vault_path: Some("x.md".into()), ..first.clone() };
        store_messages(&mut c, "talk", vec![message("u2", "user", "Add Friday")]).unwrap();
        let lines = lines_after(&c, "talk", 0).unwrap();
        let NotePlan::Write { content: kept, whole } = plan_note(&seen, "Weekly plan", &lines, Some(&edited), Some(&ours), true) else { panic!() };
        assert!(!whole);
        assert!(kept.starts_with(&edited.trim_end().to_string()), "his version stays as he left it");
        assert!(kept.contains("Add Friday") && kept.matches("Plan the week").count() == 1, "only the unseen message is added");

        assert!(matches!(plan_note(&seen, "Weekly plan", &lines, None, Some(&ours), true), NotePlan::Removed), "a note he deleted stays deleted");
    }

    #[test]
    fn note_paths_are_dated_safe_and_stable() {
        let path = note_path("chat-1", "What: is <this>? / a test", "2026-10-13 09:00:00");
        assert!(path.starts_with("10 - Conversations/2026/10/2026-10-1"), "{path}");
        assert!(!path["10 - Conversations/".len()..].trim_end_matches(".md").contains(['<', '>', ':', '?', '\\']) && path.ends_with(".md"));
        assert_eq!(path.matches('/').count(), 3, "the title cannot add folders: {path}");
        assert_eq!(path, note_path("chat-1", "What: is <this>? / a test", "2026-10-13 09:00:00"));
        assert_ne!(path, note_path("chat-2", "What: is <this>? / a test", "2026-10-13 09:00:00"));
        let root = std::env::temp_dir().join("olympus-chat-note-path");
        std::fs::create_dir_all(&root).unwrap();
        assert!(vw::resolve_within(&root, Path::new(&path)).is_ok());
    }

    #[test]
    fn the_memory_note_keeps_kevins_frontmatter_and_preamble_and_only_its_sections_change() {
        let body = "## About Kevin\n- Builds Olympus.";
        let note = render_memory(None, body);
        assert!(note.contains("memory_exclude: true") && note.contains("# Olympus Memory"));
        assert_eq!(memory_text(&note), body, "Olympus's own heading and introduction are not memory");

        let edited = "---\ntype: olympus-memory\ntags: [kevin]\nupdated: 2026-01-01\n---\n# What Olympus knows\n\nMy intro.\n\n## About Kevin\n- Builds Olympus.\n";
        let next = render_memory(Some(edited), "## About Kevin\n- Builds Olympus.\n- Lives in Lisbon.");
        assert!(next.contains("tags: [kevin]") && !next.contains("updated: 2026-01-01"), "his frontmatter stays; only the date changes");
        assert_eq!(next.matches("My intro.").count(), 1);
        assert!(!next.contains("# Olympus Memory"), "his heading is not replaced");
        assert!(memory_text(&next).starts_with("# What Olympus knows\n\nMy intro.") && memory_text(&next).contains("Lives in Lisbon"));
        assert_eq!(memory_text("- Kevin wrote this by hand."), "- Kevin wrote this by hand.");
    }

    #[test]
    fn a_long_chat_is_learned_in_order_across_passes() {
        let lines: Vec<Line> = (0..30)
            .map(|i| Line { id:format!("m{i}"),fingerprint:String::new(),rowid: i, role: "user".into(), content: "x".repeat(4_000), created_at: "2026-10-13 09:00:00".into(), imported: false, attachment: None })
            .collect();
        let (first, more) = batch(lines);
        assert!(more && first.len() == PASS_BUDGET_CHARS / 4_000 && first[0].rowid == 0, "oldest first, within budget");
        let (one, more) = batch(vec![Line { id:"m1".into(),fingerprint:String::new(),rowid: 1, role: "user".into(), content: "y".repeat(10_000), created_at: String::new(), imported: false, attachment: None }]);
        assert!(!more && one[0].content.chars().count() < 10_000, "a long message is shortened, never dropped");
    }

    #[test]
    fn model_output_is_bounded_and_titles_are_tidied() {
        let ok = checked(Answer { contributions:None, manifest:None, title: "  Weekly   plan ".into(), summary: "s".into(), memory: "- stray line".into() }).unwrap();
        assert_eq!(ok.title, "Weekly plan");
        assert_eq!(ok.memory, "## Other\n- stray line", "text before the first section is kept inside one");
        assert!(checked(Answer { contributions:None, manifest:None, title: "".into(), summary: "s".into(), memory: "m".into() }).is_err());
        assert!(checked(Answer { contributions:None, manifest:None, title: "t".into(), summary: "s".into(), memory: "m".repeat(MEMORY_NOTE_CHARS + 1) }).is_err());
    }

    #[test]
    fn earlier_chats_are_counted_then_queued_for_learning() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c.execute_batch(
            "INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES
               ('a', 'user', 'Old question', '09:00', '2026-10-01 09:00:00'),
               ('b', 'assistant', 'Only a briefing', '09:00', '2026-10-03 09:00:00');",
        )
        .unwrap();
        crate::commands::migrations::apply(&c).unwrap();
        let s = status(&c).unwrap();
        assert_eq!((s.earlier_waiting, s.earlier_queued), (1, 0), "the briefing-only chat is not offered");
        assert!(due(&c, Settings { save_chats: false, learn: true, use_memory: true }).unwrap().is_empty(), "not learned until asked");
        assert_eq!(learn_from_earlier(&c).unwrap(), 1);
        let s = status(&c).unwrap();
        assert_eq!((s.earlier_waiting, s.earlier_queued), (0, 1));
        assert_eq!(due(&c, Settings { save_chats: false, learn: true, use_memory: true }).unwrap().len(), 1);
    }
}
