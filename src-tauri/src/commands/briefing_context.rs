//! Read-only conversation evidence for briefs. No model, vault or mailbox writes.
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Scope {
    pub temporary: bool,
    pub conversation_id: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Item {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub learned_at: String,
    pub source_message_ids: Vec<String>,
    pub revision: String,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub enabled: bool,
    pub revision: String,
    pub items: Vec<Item>,
}

fn digest(value: &impl Serialize) -> String {
    format!("{:x}", Sha256::digest(serde_json::to_vec(value).unwrap_or_default()))
}
fn finish(enabled: bool, items: Vec<Item>) -> Snapshot {
    Snapshot {revision:digest(&(enabled,&items)),enabled,items}
}
fn error(_: rusqlite::Error) -> String { "briefing_context_unavailable".into() }

pub(crate) fn snapshot(c: &Connection, scope: &Scope, now: i64) -> Result<Snapshot, String> {
    if scope.temporary { return Ok(finish(false,vec![])); }
    let preference:Option<String>=c.query_row("SELECT value FROM settings WHERE key='chatMemory.use'",[],|r|r.get(0))
        .optional().map_err(error)?;
    if preference.as_deref()==Some("false") { return Ok(finish(false,vec![])); }
    let stamp=|ms| chrono::DateTime::from_timestamp_millis(ms)
        .map(|t|t.format("%Y-%m-%d %H:%M:%S").to_string()).ok_or("briefing_context_invalid_time".to_string());
    let cutoff=stamp(now-7*86_400_000)?;
    let upper=stamp(now+60_000)?;
    let mut query=c.prepare("WITH eligible AS (
      SELECT c.id,c.title,c.summary,c.memory_attempted_at,c.memory_watermark,
        (SELECT max(m.created_at) FROM conversation_messages m WHERE m.conversation_id=c.id AND m.role='user') AS last_user
      FROM conversations c WHERE c.id != ?1 AND c.legacy=0
        AND length(c.id) BETWEEN 1 AND 160 AND length(trim(c.title)) BETWEEN 1 AND 120
        AND length(trim(c.summary)) BETWEEN 1 AND 2000
        AND c.memory_error IS NULL AND c.memory_failures=0
        AND c.memory_attempted_at BETWEEN ?2 AND ?3
        AND c.memory_watermark >= (SELECT max(m.rowid) FROM conversation_messages m WHERE m.conversation_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM conversation_messages m JOIN conversation_imports i ON i.message_id=m.id WHERE m.conversation_id=c.id)
      ) SELECT id,title,summary,memory_attempted_at,memory_watermark FROM eligible
        WHERE last_user BETWEEN ?2 AND ?3 ORDER BY last_user DESC,id LIMIT 3").map_err(error)?;
    let rows=query.query_map(rusqlite::params![scope.conversation_id.as_deref().unwrap_or(""),cutoff,upper],|r|
        Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,i64>(4)?)))
        .map_err(error)?.collect::<Result<Vec<_>,_>>().map_err(error)?;
    let mut items=vec![];
    for (id,title,summary,learned,watermark) in rows {
        let Ok(at)=chrono::NaiveDateTime::parse_from_str(&learned,"%Y-%m-%d %H:%M:%S") else {continue};
        let sources=c.prepare("SELECT id,substr(content,1,64000) FROM conversation_messages WHERE conversation_id=?1 AND role='user' AND rowid<=?2 ORDER BY rowid DESC LIMIT 3")
            .map_err(error)?.query_map(rusqlite::params![id,watermark],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?)))
            .map_err(error)?.collect::<Result<Vec<_>,_>>().map_err(error)?;
        if sources.is_empty() {continue;}
        // Display identity tracks remembered content and user evidence, not worker bookkeeping.
        // Eligibility and the full snapshot still invalidate incomplete or newly learned drafts.
        let revision=digest(&(&id,&title,&summary,&sources));
        items.push(Item{id,title,summary,learned_at:at.and_utc().to_rfc3339(),source_message_ids:sources.into_iter().map(|s|s.0).collect(),revision});
    }
    Ok(finish(true,items))
}

#[tauri::command]
pub fn briefing_conversation_context(db: tauri::State<'_,super::persistence::Db>,scope: Scope) -> Result<Snapshot,String> {
    let c=db.0.lock().map_err(|_|"briefing_context_unavailable")?;
    snapshot(&c,&scope,chrono::Utc::now().timestamp_millis())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::persistence::{store_messages, ConversationMessage};
    use rusqlite::params;
    fn fixture() -> (Connection, i64) {
        let mut c=Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&c).unwrap();
        let message: ConversationMessage=serde_json::from_value(serde_json::json!({"id":"u1","role":"user","content":"Focus on the launch review before adding more features.","timestamp":"12:00"})).unwrap();
        store_messages(&mut c,"chat-a",vec![message]).unwrap();
        c.execute("UPDATE conversations SET title='Launch priorities', summary='Kevin wants the launch review before new features.', memory_watermark=(SELECT max(rowid) FROM conversation_messages), memory_attempted_at=CURRENT_TIMESTAMP",[]).unwrap();
        (c,chrono::Utc::now().timestamp_millis())
    }
    fn scope() -> Scope { Scope {temporary:false,conversation_id:Some("current-chat".into())} }
    #[test]
    fn learned_context_is_source_linked_and_mutations_invalidate_it() {
        let (c,now)=fixture();
        let first=snapshot(&c,&scope(),now).unwrap();
        assert_eq!(first.items.len(),1);
        assert_eq!(first.items[0].source_message_ids,vec!["u1"]);
        assert!(first.items[0].summary.contains("launch review"));
        c.execute("UPDATE conversations SET title='Renamed priorities'",[]).unwrap();
        assert_ne!(snapshot(&c,&scope(),now).unwrap().revision,first.revision);
        c.execute("DELETE FROM conversation_messages WHERE id='u1'",[]).unwrap();
        assert!(snapshot(&c,&scope(),now).unwrap().items.is_empty());
    }
    #[test]
    fn private_or_disabled_scope_does_not_read_chat_tables() {
        let c=Connection::open_in_memory().unwrap();
        assert!(snapshot(&c,&Scope{temporary:true,conversation_id:None},0).unwrap().items.is_empty());
        c.execute_batch("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); INSERT INTO settings VALUES('chatMemory.use','false');").unwrap();
        assert!(!snapshot(&c,&scope(),0).unwrap().enabled);
    }
    #[test]
    fn unreadable_memory_preference_does_not_default_to_disclosure() {
        let (c,now)=fixture();
        c.execute("DROP TABLE settings",[]).unwrap();
        assert!(snapshot(&c,&scope(),now).is_err());
    }
    #[test]
    fn incomplete_old_imported_failed_or_current_chat_context_is_withheld() {
        let (mut c,now)=fixture();
        assert!(snapshot(&c,&Scope{temporary:false,conversation_id:Some("chat-a".into())},now).unwrap().items.is_empty());
        for update in ["memory_watermark=0", "memory_error='failed'", "memory_failures=1", "memory_attempted_at=NULL", "legacy=1"] {
            c.execute("SAVEPOINT eligibility",[]).unwrap();
            c.execute(&format!("UPDATE conversations SET {update}"),[]).unwrap();
            assert!(snapshot(&c,&scope(),now).unwrap().items.is_empty(),"{update}");
            c.execute_batch("ROLLBACK TO eligibility; RELEASE eligibility;").unwrap();
        }
        assert!(snapshot(&c,&scope(),now+8*86_400_000).unwrap().items.is_empty());
        assert!(snapshot(&c,&scope(),now-120_000).unwrap().items.is_empty());
        c.execute("INSERT INTO conversation_imports(message_id) VALUES('u1')",[]).unwrap();
        assert!(snapshot(&c,&scope(),now).unwrap().items.is_empty());
        c.execute("DELETE FROM conversation_imports",[]).unwrap();
        let fresh:ConversationMessage=serde_json::from_value(serde_json::json!({"id":"u2","role":"user","content":"That changed: the release is postponed.","timestamp":"12:01"})).unwrap();
        store_messages(&mut c,"chat-a",vec![fresh]).unwrap();
        assert!(snapshot(&c,&scope(),now).unwrap().items.is_empty(),"unlearned correction must suppress old summary");
        c.execute("UPDATE conversations SET memory_watermark=(SELECT max(rowid) FROM conversation_messages),summary=?1",params!["The release is postponed."]).unwrap();
        assert_eq!(snapshot(&c,&scope(),now).unwrap().items[0].summary,"The release is postponed.");
    }
}
