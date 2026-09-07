//! Explicit promotion of a persisted chat message into historical memory.
//! This writer creates no task commitment and grants no delegation authority.
use std::{fs, io::Write, path::Path, sync::atomic::{AtomicU64, Ordering}};
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, OptionalExtension};
use super::{persistence::Db, vault_context::DECISION_HISTORY_NOTE, vault_write::{self, DiffSummary, WriteIntent, ConfirmReason}};

static WRITER: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static TEMP_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromotionRequest { pub message_id: String, pub title: String, pub text: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromotionResult { pub written: bool, pub path: String, pub warning: Option<String> }

struct Source { id: String, role: String, content: String, research: String }

fn source(connection: &Connection, id: &str) -> Result<Source, String> {
    connection.query_row(
        "SELECT id, role, content, COALESCE((SELECT sources_json FROM conversation_research WHERE message_id = conversation_messages.id), '[]') FROM conversation_messages WHERE id = ?1 AND role IN ('user', 'assistant')",
        [id], |row| Ok(Source { id: row.get(0)?, role: row.get(1)?, content: row.get(2)?, research: row.get(3)? })
    ).optional().map_err(|e| e.to_string())?
        .ok_or_else(|| "The source message is not saved yet or has been removed. Try again after it is saved.".into())
}

fn quote(text: &str) -> String { text.lines().map(|line| format!("> {line}")).collect::<Vec<_>>().join("\n") }

fn entry(request: &PromotionRequest, source: &Source, date: &str) -> Result<String, String> {
    let title = request.title.split_whitespace().collect::<Vec<_>>().join(" ");
    let text = request.text.trim();
    if title.is_empty() || title.chars().count() > 120 || text.is_empty() || text.chars().count() > 2_000 {
        return Err("Provide a title up to 120 characters and memory text up to 2,000 characters.".into());
    }
    let research: Vec<super::research_retrieval::ResearchExcerpt> = serde_json::from_str(&source.research).map_err(|e| e.to_string())?;
    let provenance = research.iter().map(|s| format!("- {} | {} | {} | stance: {} | origin: {} | body fingerprint: {}",
        s.title, s.source_file, s.source_date.as_deref().unwrap_or("undated"), s.stance,
        s.origin.as_deref().unwrap_or("unspecified"), s.fingerprint)).collect::<Vec<_>>().join("\n");
    let original: String = source.content.chars().take(1_200).collect();
    Ok(format!("\n## {date} — Chat memory\n\n{}\n\nHistorical memory recorded through the chat promotion form. This entry is not a task commitment or delegation approval.\n\n### Memory text\n\n{}\n\n### Conversation provenance\n\n{}\n\n### Source message{}\n\n{}\n\n### Research supplied to that turn (not necessarily endorsed or cited)\n\n{}\n",
        quote(&title), quote(text), quote(&format!("Message: {}\nRole: {}\nContent fingerprint: {}", source.id, source.role, vault_write::content_fingerprint(&source.content))),
        if original.chars().count() < source.content.chars().count() { " (excerpt)" } else { "" },
        quote(&original), if provenance.is_empty() { "None recorded for this message.".into() } else { quote(&provenance) }))
}

fn read(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Cannot read the Decision Log; nothing will be replaced: {e}")),
    }
}

fn append_checked(path: &Path, before: Option<&str>, addition: &str) -> Result<(), String> {
    // Compare exact bytes, including absence versus an empty file. Never treat a read error as absence.
    if read(path)?.as_deref() != before { return Err("The Decision Log changed during review. Nothing was added; review it again.".into()); }
    let parent = path.parent().ok_or("Missing parent directory")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = parent.join(format!(".decision-{}-{}.tmp", std::process::id(), TEMP_ID.fetch_add(1, Ordering::Relaxed)));
    let result = (|| {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|e| e.to_string())?;
        file.write_all(before.unwrap_or("# Decision Log\n").as_bytes()).map_err(|e| e.to_string())?;
        file.write_all(addition.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        if read(path)?.as_deref() != before { return Err("The Decision Log changed before saving. Review it again.".into()); }
        fs::rename(&temp, path).map_err(|e| format!("Could not save the Decision Log: {e}"))
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

#[tauri::command]
pub async fn promote_chat_memory(app: tauri::AppHandle, db: tauri::State<'_, Db>, request: PromotionRequest) -> Result<PromotionResult, String> {
    let _writer = WRITER.lock().await;
    let saved = { let connection = db.0.lock().map_err(|e| e.to_string())?; source(&connection, &request.message_id)? };
    let addition = entry(&request, &saved, &chrono::Utc::now().to_rfc3339())?;
    let path = vault_write::resolve_vault_path(Path::new(DECISION_HISTORY_NOTE)).map_err(|e| e.to_string())?;
    let before = read(&path)?;
    // Show the entire bounded addition, not the gate's usual sampled diff.
    let preview: Vec<_> = addition.lines().map(|line| format!("+ {line}")).collect();
    let approved = super::write_confirm::request_confirmation(&app, DECISION_HISTORY_NOTE.into(), WriteIntent::AppendAuthored,
        ConfirmReason::IntentRequiresConfirmation, DiffSummary { added: preview.len(), removed: 0, preview }).await;
    let mut result = PromotionResult { written: false, path: path.to_string_lossy().into(), warning: None };
    if !approved { return Ok(result); }
    let resolved = vault_write::resolve_vault_path(Path::new(DECISION_HISTORY_NOTE)).map_err(|e| e.to_string())?;
    if resolved != path { return Err("The vault location changed during review.".into()); }
    // The source may have been cleared or edited while the gate was open.
    let current = { let connection = db.0.lock().map_err(|e| e.to_string())?; source(&connection, &request.message_id)? };
    if current.content != saved.content || current.role != saved.role || current.research != saved.research {
        return Err("The source conversation changed during review. Nothing was added.".into());
    }
    tauri::async_runtime::spawn_blocking(move || append_checked(&resolved, before.as_deref(), &addition)).await.map_err(|e| e.to_string())??;
    result.written = true;
    super::persistence::log_vault_write(db.inner(), DECISION_HISTORY_NOTE, "append");
    result.warning = super::vault_git::commit_vault_file(DECISION_HISTORY_NOTE, "append").err()
        .map(|e| format!("Memory saved, but its Git commit failed: {e}. Do not resubmit the entry."));
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_must_exist_and_come_from_saved_conversation() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        assert!(source(&db, "invented").is_err());
        db.execute("INSERT INTO conversation_messages(id,role,content,timestamp) VALUES ('a','assistant','Original','now')", []).unwrap();
        let saved = source(&db, "a").unwrap();
        let request = PromotionRequest { message_id: "a".into(), title: "Choice".into(), text: "Use bounded retrieval.".into() };
        let text = entry(&request, &saved, "2026-09-07").unwrap();
        assert!(text.contains("> Role: assistant"));
        assert!(text.contains("> Original"));
        assert!(text.contains("not a task commitment or delegation approval"));
        assert!(!text.contains("Kevin approved"));
    }
    #[test]
    fn research_provenance_survives_storage_and_promotion() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        let message: super::super::persistence::ConversationMessage = serde_json::from_value(serde_json::json!({
            "id":"answer", "role":"assistant", "content":"Compare the source with our decisions.", "timestamp":"now",
            "research":[{"title":"Agent systems", "sourceFile":"02 - Research/Agents.md", "sourceDate":"2026-07-29",
                "stance":"disputed", "origin":"olympus-found", "excerpt":"Use independent review.", "truncated":true,"fingerprint":"abc"}]
        })).unwrap();
        super::super::persistence::store_messages(&mut db, vec![message]).unwrap();
        let saved = source(&db, "answer").unwrap();
        let text = entry(&PromotionRequest { message_id:"answer".into(),title:"Review".into(),text:"Keep independent review.".into() }, &saved, "today").unwrap();
        assert!(text.contains("stance: disputed | origin: olympus-found"));
        assert!(text.contains("2026-07-29"));
        assert!(text.contains("02 - Research/Agents.md"));
        assert!(text.contains("body fingerprint: abc"));
        // Legacy messages without research are still deserializable.
        let legacy: super::super::persistence::ConversationMessage = serde_json::from_value(serde_json::json!({"id":"old","role":"user","content":"Old message","timestamp":"then"})).unwrap();
        assert!(legacy.research.is_empty());
    }
    #[test]
    fn append_preserves_bytes_and_rejects_concurrent_changes_and_read_errors() {
        let dir = std::env::temp_dir().join(format!("olympus-promotion-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("Decision Log.md");
        fs::write(&path, "\u{feff}Human text  \r\n").unwrap();
        let before = read(&path).unwrap().unwrap();
        append_checked(&path, Some(&before), "\nNew memory\n").unwrap();
        assert_eq!(read(&path).unwrap().unwrap(), format!("{before}\nNew memory\n"));
        assert!(append_checked(&path, Some(&before), "Lost edit").is_err());
        assert!(read(&dir).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
