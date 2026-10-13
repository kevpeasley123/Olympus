//! Separate conversations (docs/CONVERSATIONS-AND-MEMORY.md).
//!
//! SQLite keeps every message. This module groups messages into chats, titles
//! them, lists and searches them. Temporary chats never reach it: the webview
//! does not append them.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Serialize;
use tauri::State;

use super::persistence::{load_messages, Db, LoadedMessage};

/// The old single history is split into chats where it went quiet this long.
const LEGACY_GAP_HOURS: i64 = 4;
/// A chat touched this recently is reopened at launch instead of a new one, so a
/// restart does not strand a conversation in progress.
pub const RESUME_WITHIN_MINUTES: i64 = 30;
const TITLE_CHARS: usize = 60;

/// SQLite `CURRENT_TIMESTAMP` format, UTC. Every timestamp here uses it so
/// ordering by text is ordering by time.
pub fn now_sql() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn parse_sql(raw: &str) -> Option<chrono::NaiveDateTime> {
    chrono::NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S").ok()
}

fn iso(raw: &str) -> String {
    parse_sql(raw)
        .map(|t| t.and_utc().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .unwrap_or_else(|| raw.to_string())
}

/// A readable title from the opening words of a message: its first non-empty
/// line without Markdown markers, cut at a word boundary.
pub fn title_from(text: &str) -> String {
    let line = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let line = line.trim_start_matches(|c: char| matches!(c, '#' | '>' | '-' | '*' | ' '));
    let words = line.split_whitespace().collect::<Vec<_>>().join(" ");
    let words = words.replace(['*', '`', '_'], "");
    if words.chars().count() <= TITLE_CHARS {
        return words;
    }
    let cut: String = words.chars().take(TITLE_CHARS).collect();
    let at_word = cut.rfind(' ').filter(|&i| i > TITLE_CHARS / 2).map_or(cut.as_str(), |i| &cut[..i]);
    format!("{}…", at_word.trim_end_matches([',', '.', ';', ':']))
}

/// Creates the conversation on its first message. A chat whose title is still
/// empty takes it from the first operator message it receives.
pub fn ensure(transaction: &Transaction, id: &str, first_user_text: Option<&str>) -> rusqlite::Result<()> {
    let now = now_sql();
    transaction.execute(
        "INSERT INTO conversations (id, created_at, updated_at) VALUES (?1, ?2, ?2) ON CONFLICT(id) DO NOTHING",
        params![id, now],
    )?;
    if let Some(text) = first_user_text.map(title_from).filter(|t| !t.is_empty()) {
        transaction.execute(
            "UPDATE conversations SET title = ?2 WHERE id = ?1 AND title = '' AND title_source = 'auto'",
            params![id, text],
        )?;
    }
    Ok(())
}

pub fn touch(transaction: &Transaction, id: &str) -> rusqlite::Result<()> {
    transaction.execute("UPDATE conversations SET updated_at = ?2 WHERE id = ?1", params![id, now_sql()])?;
    Ok(())
}

pub fn index_message(transaction: &Transaction, conversation_id: &str, message_id: &str, content: &str) -> rusqlite::Result<()> {
    transaction.execute(
        "INSERT INTO conversation_search (content, message_id, conversation_id) VALUES (?1, ?2, ?3)",
        params![content, message_id, conversation_id],
    )?;
    Ok(())
}

/// Migration 2's data step: the single pre-2026-10-13 history becomes chats.
/// Rows imported from the browser era form one chat; the rest split where the
/// history went quiet for four hours. Legacy chats are saved to the vault but
/// not learned from automatically, so their memory watermark starts at the end.
pub fn backfill(transaction: &Transaction) -> rusqlite::Result<()> {
    struct Row { rowid: i64, id: String, role: String, content: String, created_at: String, imported: bool }
    let rows: Vec<Row> = transaction
        .prepare(
            "SELECT m.rowid, m.id, m.role, m.content, m.created_at, i.message_id IS NOT NULL \
             FROM conversation_messages m LEFT JOIN conversation_imports i ON i.message_id = m.id \
             WHERE m.conversation_id IS NULL ORDER BY m.created_at, m.rowid",
        )?
        .query_map([], |r| {
            Ok(Row { rowid: r.get(0)?, id: r.get(1)?, role: r.get(2)?, content: r.get(3)?, created_at: r.get(4)?, imported: r.get(5)? })
        })?
        .collect::<Result<_, _>>()?;

    let mut groups: Vec<Vec<&Row>> = Vec::new();
    let (imported, native): (Vec<&Row>, Vec<&Row>) = rows.iter().partition(|r| r.imported);
    if !imported.is_empty() {
        groups.push(imported);
    }
    let mut current: Vec<&Row> = Vec::new();
    for row in native {
        let gap = current.last().and_then(|last| Some(parse_sql(&row.created_at)? - parse_sql(&last.created_at)?));
        if gap.is_some_and(|g| g > chrono::Duration::hours(LEGACY_GAP_HOURS)) {
            groups.push(std::mem::take(&mut current));
        }
        current.push(row);
    }
    if !current.is_empty() {
        groups.push(current);
    }

    for group in groups {
        let first = group[0];
        let last = group[group.len() - 1];
        let id = format!("legacy-{}", first.rowid);
        let title = group
            .iter()
            .find(|r| r.role == "user")
            .map(|r| title_from(&r.content))
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| format!("Conversation of {}", &first.created_at[..first.created_at.len().min(10)]));
        let max_rowid = group.iter().map(|r| r.rowid).max().unwrap_or(0);
        transaction.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, legacy, memory_watermark) VALUES (?1, ?2, ?3, ?4, 1, ?5)",
            params![id, title, first.created_at, last.created_at, max_rowid],
        )?;
        for row in &group {
            transaction.execute("UPDATE conversation_messages SET conversation_id = ?1 WHERE rowid = ?2", params![id, row.rowid])?;
            index_message(transaction, &id, &row.id, &row.content)?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: i64,
    pub legacy: bool,
    pub vault_path: Option<String>,
}

/// Every launch opens a chat with its briefing in it. Until the operator says
/// something there, it is not a chat worth listing, searching or learning from.
pub const HAS_OPERATOR_TURN: &str = "EXISTS (SELECT 1 FROM conversation_messages u WHERE u.conversation_id = c.id AND u.role = 'user')";

pub fn list(connection: &Connection, limit: u32) -> Result<Vec<ConversationSummary>, String> {
    connection
        .prepare(&format!(
            "SELECT c.id, c.title, c.summary, c.created_at, c.updated_at, count(m.id), c.legacy, c.vault_path \
             FROM conversations c JOIN conversation_messages m ON m.conversation_id = c.id \
             WHERE {HAS_OPERATOR_TURN} GROUP BY c.id ORDER BY c.updated_at DESC, c.id DESC LIMIT ?1"
        ))
        .map_err(|e| e.to_string())?
        .query_map([limit], |r| {
            Ok(ConversationSummary {
                id: r.get(0)?,
                title: r.get(1)?,
                summary: r.get(2)?,
                created_at: iso(&r.get::<_, String>(3)?),
                updated_at: iso(&r.get::<_, String>(4)?),
                message_count: r.get(5)?,
                legacy: r.get::<_, i64>(6)? != 0,
                vault_path: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())
}

/// The chat to reopen at launch: the most recent one, if it was used within
/// `RESUME_WITHIN_MINUTES`.
pub fn resumable(connection: &Connection) -> Result<Option<String>, String> {
    let cutoff = (chrono::Utc::now() - chrono::Duration::minutes(RESUME_WITHIN_MINUTES)).format("%Y-%m-%d %H:%M:%S").to_string();
    connection
        .query_row(
            "SELECT c.id FROM conversations c WHERE c.updated_at >= ?1 AND EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id = c.id) ORDER BY c.updated_at DESC LIMIT 1",
            [cutoff],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub conversation_id: String,
    pub title: String,
    pub message_id: String,
    pub role: String,
    /// Matched words sit between U+0002 and U+0003, which stored text never
    /// carries, so a literal bracket in a message is not read as a match.
    pub snippet: String,
    pub at: String,
}

/// Each word must appear, matched as a prefix. Punctuation never reaches the
/// FTS5 query syntax.
fn fts_query(query: &str) -> Option<String> {
    let terms: Vec<String> = query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .take(12)
        .map(|t| format!("\"{}\"*", t.to_lowercase()))
        .collect();
    (!terms.is_empty()).then(|| terms.join(" "))
}

pub fn search(connection: &Connection, query: &str, limit: u32) -> Result<Vec<SearchHit>, String> {
    let Some(fts) = fts_query(query) else { return Ok(Vec::new()) };
    connection
        .prepare(&format!(
            "SELECT s.conversation_id, c.title, s.message_id, m.role, snippet(conversation_search, 0, char(2), char(3), '…', 12), m.created_at \
             FROM conversation_search s JOIN conversation_messages m ON m.id = s.message_id JOIN conversations c ON c.id = s.conversation_id \
             WHERE conversation_search MATCH ?1 AND {HAS_OPERATOR_TURN} ORDER BY bm25(conversation_search) LIMIT ?2"
        ))
        .map_err(|e| e.to_string())?
        .query_map(params![fts, limit], |r| {
            Ok(SearchHit {
                conversation_id: r.get(0)?,
                title: r.get(1)?,
                message_id: r.get(2)?,
                role: r.get(3)?,
                snippet: r.get(4)?,
                at: iso(&r.get::<_, String>(5)?),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())
}

/// An earlier chat recalled for the assistant: what it was, and the lines that
/// matched.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recalled {
    pub title: String,
    pub last_active: String,
    pub summary: String,
    pub matching_lines: Vec<String>,
}

const RECALL_CHATS: usize = 3;
const RECALL_LINES: usize = 2;
const RECALL_STOP: &[&str] = &[
    "the", "and", "for", "with", "this", "that", "from", "what", "when", "where", "why", "how", "who", "which",
    "should", "could", "would", "about", "have", "has", "had", "does", "did", "your", "you", "our", "are", "was",
    "were", "can", "will", "please", "tell", "more", "just", "any", "anything", "something", "there", "their",
    "them", "they", "then", "than", "into", "out", "not", "but", "all", "also", "get", "got", "let", "know",
    "think", "want", "need", "like", "make", "say", "said", "talk", "talked", "remember", "earlier", "before",
    "last", "time", "today", "yesterday", "olympus", "again", "now", "its", "it's", "i'm", "im", "me", "my",
];

/// Earlier chats sharing words with the question, best match first. Keyword
/// matching only, so a hit can be unrelated; the prompt says so.
pub fn recall(connection: &Connection, question: &str, exclude: Option<&str>) -> Result<Vec<Recalled>, String> {
    let mut terms: Vec<String> = question
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .map(|t| t.trim_matches('\'').to_lowercase())
        .filter(|t| t.chars().count() > 2 && !RECALL_STOP.contains(&t.as_str()))
        .collect();
    terms.sort();
    terms.dedup();
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    let fts = terms.iter().take(16).map(|t| format!("\"{}\"", t.replace('"', ""))).collect::<Vec<_>>().join(" OR ");
    let hits: Vec<(String, String, String)> = connection
        .prepare(&format!(
            "SELECT s.conversation_id, m.role, snippet(conversation_search, 0, '', '', '…', 24) \
             FROM conversation_search s JOIN conversation_messages m ON m.id = s.message_id JOIN conversations c ON c.id = s.conversation_id \
             WHERE conversation_search MATCH ?1 AND s.conversation_id != ?2 AND {HAS_OPERATOR_TURN} \
             ORDER BY bm25(conversation_search) LIMIT 60"
        ))
        .map_err(|e| e.to_string())?
        .query_map(params![fts, exclude.unwrap_or("")], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;
    let mut order: Vec<String> = Vec::new();
    let mut lines: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (id, role, snippet) in hits {
        if !order.contains(&id) {
            if order.len() == RECALL_CHATS {
                continue;
            }
            order.push(id.clone());
        }
        let found = lines.entry(id).or_default();
        if found.len() < RECALL_LINES {
            found.push(format!("{}: {}", if role == "user" { "Kevin" } else { "Olympus" }, snippet.split_whitespace().collect::<Vec<_>>().join(" ")));
        }
    }
    order
        .into_iter()
        .map(|id| {
            let (title, summary, updated): (String, String, String) = connection
                .query_row("SELECT title, summary, updated_at FROM conversations WHERE id = ?1", [&id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .map_err(|e| e.to_string())?;
            Ok(Recalled { title, last_active: iso(&updated), summary, matching_lines: lines.remove(&id).unwrap_or_default() })
        })
        .collect()
}

pub fn rename(connection: &Connection, id: &str, title: &str) -> Result<(), String> {
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() || title.chars().count() > 120 {
        return Err("A title needs 1 to 120 characters.".into());
    }
    let changed = connection
        .execute("UPDATE conversations SET title = ?2, title_source = 'operator' WHERE id = ?1", params![id, title])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("That chat no longer exists.".into());
    }
    Ok(())
}

/// Removes the chat from Olympus. Its vault note, and anything already learned
/// from it, stay until the operator removes them; the UI says so.
pub fn delete(connection: &mut Connection, id: &str) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let in_chat = "SELECT id FROM conversation_messages WHERE conversation_id = ?1";
    transaction
        .execute(&format!("DELETE FROM request_memory WHERE request_id IN (SELECT request_id FROM conversation_model WHERE message_id IN ({in_chat}))"), [id])
        .map_err(|e| e.to_string())?;
    for table in ["conversation_model", "conversation_voice", "conversation_mail", "conversation_research", "conversation_turn_context", "conversation_imports"] {
        transaction
            .execute(&format!("DELETE FROM {table} WHERE message_id IN ({in_chat})"), [id])
            .map_err(|e| e.to_string())?;
    }
    transaction.execute("DELETE FROM conversation_search WHERE conversation_id = ?1", [id]).map_err(|e| e.to_string())?;
    transaction.execute("DELETE FROM conversation_messages WHERE conversation_id = ?1", [id]).map_err(|e| e.to_string())?;
    transaction.execute("DELETE FROM conversations WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())
}

fn locked<'a>(db: &State<'a, Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.inner().0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_conversations(db: State<Db>, limit: Option<u32>) -> Result<Vec<ConversationSummary>, String> {
    list(&*locked(&db)?, limit.unwrap_or(200).min(1000))
}

#[tauri::command]
pub fn load_conversation(db: State<Db>, id: String) -> Result<Vec<LoadedMessage>, String> {
    load_messages(&*locked(&db)?, Some(&id))
}

#[tauri::command]
pub fn search_conversations(db: State<Db>, query: String) -> Result<Vec<SearchHit>, String> {
    search(&*locked(&db)?, &query, 50)
}

#[tauri::command]
pub fn rename_conversation(db: State<Db>, id: String, title: String) -> Result<(), String> {
    rename(&*locked(&db)?, &id, &title)
}

#[tauri::command]
pub fn delete_conversation(db: State<Db>, id: String) -> Result<(), String> {
    delete(&mut *locked(&db)?, &id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::persistence::{store_messages, ConversationMessage};

    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&c).unwrap();
        c
    }

    fn message(id: &str, role: &str, content: &str) -> ConversationMessage {
        serde_json::from_value(serde_json::json!({"id": id, "role": role, "content": content, "timestamp": "12:00"})).unwrap()
    }

    #[test]
    fn titles_come_from_the_first_line_without_markdown_and_stop_at_a_word() {
        assert_eq!(title_from("## Plan the **memory** work\nmore"), "Plan the memory work");
        assert_eq!(title_from("\n\n  hello   there "), "hello there");
        let long = title_from("Tell me how the Olympus memory pass should decide what is worth remembering across chats");
        assert!(long.ends_with('…') && long.chars().count() <= TITLE_CHARS + 1, "{long}");
        assert!(!long.contains("remem…"), "cut at a word: {long}");
        assert_eq!(title_from(""), "");
    }

    #[test]
    fn the_old_history_splits_into_chats_at_quiet_gaps_and_imports_stay_together() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c.execute_batch(
            "INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES
               ('a', 'user', 'First chat question', '09:00', '2026-10-01 09:00:00'),
               ('b', 'assistant', 'answer', '09:01', '2026-10-01 09:01:00'),
               ('c', 'user', 'still the first chat', '11:00', '2026-10-01 11:00:00'),
               ('d', 'user', 'Second chat, the next day', '10:00', '2026-10-02 10:00:00'),
               ('e', 'user', 'imported', '07:00', '2026-10-03 07:00:00'),
               ('f', 'assistant', 'imported reply', '07:00', '2026-10-03 07:00:00');
             INSERT INTO conversation_imports (message_id) VALUES ('e'), ('f');",
        )
        .unwrap();
        crate::commands::migrations::apply(&c).unwrap();
        let chats = list(&c, 10).unwrap();
        let titles: Vec<&str> = chats.iter().map(|c| c.title.as_str()).collect();
        assert_eq!(chats.len(), 3, "{titles:?}");
        assert!(titles.contains(&"First chat question") && titles.contains(&"Second chat, the next day") && titles.contains(&"imported"));
        assert!(chats.iter().all(|c| c.legacy));
        let first = chats.iter().find(|c| c.title == "First chat question").unwrap();
        assert_eq!(first.message_count, 3);
        let watermark: i64 = c.query_row("SELECT memory_watermark FROM conversations WHERE id = ?1", [&first.id], |r| r.get(0)).unwrap();
        assert!(watermark > 0, "legacy chats are not learned from automatically");
        assert_eq!(search(&c, "next day", 10).unwrap().len(), 1, "backfilled messages are searchable");
    }

    #[test]
    fn appended_messages_create_titled_searchable_chats() {
        let mut c = db();
        store_messages(&mut c, "chat-1", vec![message("u1", "user", "How should Olympus remember things?"), message("a1", "assistant", "Automatically, with notes you can edit.")]).unwrap();
        store_messages(&mut c, "chat-2", vec![message("u2", "user", "Weather in Lisbon")]).unwrap();
        let chats = list(&c, 10).unwrap();
        assert_eq!(chats.len(), 2);
        assert_eq!(chats.iter().find(|c| c.id == "chat-1").unwrap().title, "How should Olympus remember things?");
        let hits = search(&c, "notes edit", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!((hits[0].conversation_id.as_str(), hits[0].message_id.as_str()), ("chat-1", "a1"));
        assert!(hits[0].snippet.contains("\u{2}notes\u{3}"), "the match is marked: {}", hits[0].snippet);
        assert!(search(&c, "\"*) OR (", 10).unwrap().is_empty(), "punctuation never reaches FTS syntax");
        assert_eq!(load_messages(&c, Some("chat-2")).unwrap().len(), 1);
    }

    #[test]
    fn a_renamed_chat_keeps_its_title_and_rejects_empty_names() {
        let mut c = db();
        store_messages(&mut c, "chat", vec![message("u", "user", "original words")]).unwrap();
        rename(&c, "chat", "  My   title ").unwrap();
        assert_eq!(list(&c, 1).unwrap()[0].title, "My title");
        let source: String = c.query_row("SELECT title_source FROM conversations WHERE id='chat'", [], |r| r.get(0)).unwrap();
        assert_eq!(source, "operator");
        assert!(rename(&c, "chat", "   ").is_err());
        assert!(rename(&c, "missing", "x").is_err());
    }

    #[test]
    fn deleting_a_chat_removes_its_messages_side_rows_and_search_entries_only() {
        let mut c = db();
        store_messages(&mut c, "keep", vec![message("k", "user", "keep this chat")]).unwrap();
        store_messages(&mut c, "drop", vec![message("d", "user", "drop this chat")]).unwrap();
        delete(&mut c, "drop").unwrap();
        assert_eq!(list(&c, 10).unwrap().len(), 1);
        assert!(search(&c, "drop", 10).unwrap().is_empty());
        assert_eq!(search(&c, "keep", 10).unwrap().len(), 1);
        let research: i64 = c.query_row("SELECT count(*) FROM conversation_research WHERE message_id='d'", [], |r| r.get(0)).unwrap();
        assert_eq!(research, 0);
    }

    #[test]
    fn a_briefing_alone_is_not_listed_or_searched_until_the_operator_speaks() {
        let mut c = db();
        store_messages(&mut c, "launch", vec![message("briefing-1", "assistant", "Two commits landed on Olympus since yesterday.")]).unwrap();
        assert!(list(&c, 10).unwrap().is_empty());
        assert!(search(&c, "commits", 10).unwrap().is_empty());
        store_messages(&mut c, "launch", vec![message("u", "user", "Which commits?")]).unwrap();
        let chats = list(&c, 10).unwrap();
        assert_eq!((chats.len(), chats[0].title.as_str(), chats[0].message_count), (1, "Which commits?", 2));
        assert_eq!(search(&c, "landed", 10).unwrap().len(), 1);
    }

    #[test]
    fn recall_finds_other_chats_by_topic_and_skips_the_open_one() {
        let mut c = db();
        store_messages(&mut c, "trip", vec![message("t1", "user", "Book flights to Singapore for the conference"), message("t2", "assistant", "Two options under $900.")]).unwrap();
        store_messages(&mut c, "build", vec![message("b1", "user", "Why did the Olympus build fail?")]).unwrap();
        store_messages(&mut c, "now", vec![message("n1", "user", "What did we decide about Singapore flights?")]).unwrap();
        let found = recall(&c, "What did we decide about Singapore flights?", Some("now")).unwrap();
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].title, "Book flights to Singapore for the conference");
        assert!(found[0].matching_lines[0].starts_with("Kevin: ") && found[0].matching_lines[0].contains("Singapore"));
        assert!(recall(&c, "what did we talk about?", None).unwrap().is_empty(), "stop words alone recall nothing");
        assert!(recall(&c, "\"*) OR (", None).unwrap().is_empty());
    }

    #[test]
    fn a_recent_chat_is_resumed_and_an_old_one_is_not() {
        let mut c = db();
        assert_eq!(resumable(&c).unwrap(), None);
        store_messages(&mut c, "recent", vec![message("r", "user", "hi")]).unwrap();
        assert_eq!(resumable(&c).unwrap().as_deref(), Some("recent"));
        c.execute("UPDATE conversations SET updated_at = '2026-01-01 00:00:00'", []).unwrap();
        assert_eq!(resumable(&c).unwrap(), None);
    }
}
