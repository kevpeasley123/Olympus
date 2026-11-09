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
    query_snapshot(c,scope,now,"")
}
pub(crate) fn query_snapshot(c:&Connection,scope:&Scope,now:i64,question:&str)->Result<Snapshot,String>{
    if scope.temporary { return Ok(finish(false,vec![])); }
    let preference:Option<String>=c.query_row("SELECT value FROM settings WHERE key='chatMemory.use'",[],|r|r.get(0))
        .optional().map_err(error)?;
    if preference.as_deref()==Some("false") { return Ok(finish(false,vec![])); }
    if question.chars().count()>512{return Err("briefing_context_query_bound".into());}
    let terms=question.split(|c:char|!c.is_alphanumeric()).filter(|s|s.chars().count()>2).take(16).map(str::to_lowercase).collect::<Vec<_>>();
    let terms=serde_json::to_string(&terms).map_err(|_|"briefing_context_query_invalid")?;
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
        WHERE last_user BETWEEN ?2 AND ?3
          AND (?4='[]' OR EXISTS(SELECT 1 FROM json_each(?4) term WHERE instr(lower(title || ' ' || summary),term.value)>0))
        ORDER BY (SELECT count(*) FROM json_each(?4) term WHERE instr(lower(title || ' ' || summary),term.value)>0) DESC,last_user DESC,id LIMIT 3").map_err(error)?;
    let rows=query.query_map(rusqlite::params![scope.conversation_id.as_deref().unwrap_or(""),cutoff,upper,terms],|r|
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
    fn query_retrieves_relevant_fourth_chat_before_recency_limit() {
        let (mut c,now)=fixture();
        c.execute("UPDATE conversation_messages SET created_at=datetime('now','-1 day')",[]).unwrap();
        for i in 0..3 {
            let message:ConversationMessage=serde_json::from_value(serde_json::json!({"id":format!("new{i}"),"role":"user","content":"Other topic","timestamp":"12:00"})).unwrap();
            store_messages(&mut c,&format!("recent{i}"),vec![message]).unwrap();
        }
        c.execute("UPDATE conversations SET title='Other topic',summary='A separate discussion',memory_watermark=(SELECT max(rowid) FROM conversation_messages),memory_attempted_at=CURRENT_TIMESTAMP WHERE id LIKE 'recent%'",[]).unwrap();
        assert!(!snapshot(&c,&scope(),now).unwrap().items.iter().any(|i|i.id=="chat-a"));
        let relevant=query_snapshot(&c,&scope(),now,"launch review").unwrap();
        assert_eq!(relevant.items.len(),1);assert_eq!(relevant.items[0].id,"chat-a");
        c.execute("INSERT INTO conversation_imports(message_id) VALUES('u1')",[]).unwrap();
        assert!(query_snapshot(&c,&scope(),now,"launch review").unwrap().items.is_empty());
    }
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
        c.execute_batch("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); INSERT INTO settings(key,value) VALUES('chatMemory.use','false');").unwrap();
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

#[cfg(test)]
mod durable_tests {
    use super::*;
    #[test]
    fn old_explicit_preferences_are_current_file_evidence_and_withdrawal_removes_them() {
        let c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let root=std::env::temp_dir().join(format!("olympus-durable-{}",crate::commands::delegation::run_id()));
        std::fs::create_dir_all(root.join("09 - System")).unwrap();
        let path=root.join("09 - System/User Profile.md");
        std::fs::write(&path,"---\nstatus: active\nupdated: 2010-01-01\n---\n# Preferences\nPrefer rail travel.").unwrap();
        let scope=Scope{temporary:false,conversation_id:None};
        let old=durable_at(&c,&scope,&root).unwrap();
        assert_eq!(old.items.len(),1);assert_eq!(old.items[0].authority,"operator_statement");
        assert!(old.items[0].text.contains("rail travel"));
        std::fs::write(&path,"---\nstatus: active\n---\n# Preferences\nPrefer cycling.").unwrap();
        let changed=durable_at(&c,&scope,&root).unwrap();assert_ne!(old.items[0].revision,changed.items[0].revision);
        assert!(!changed.items[0].text.contains("rail travel"));
        std::fs::write(&path,"---\nstatus: withdrawn\n---\nPrefer rail travel.").unwrap();
        assert!(durable_at(&c,&scope,&root).unwrap().items.is_empty());
        std::fs::remove_file(&path).unwrap();assert!(durable_at(&c,&scope,&root).unwrap().items.is_empty());
        let learned=root.join(super::super::chat_memory::MEMORY_NOTE);
        std::fs::write(&learned,"---\nupdated: 2010-01-01\n---\n## Preferences\n- Prefers quiet mornings.").unwrap();
        let memory=durable_at(&c,&scope,&root).unwrap();assert_eq!(memory.items[0].authority,"remembered_context");
        assert!(memory.items[0].text.contains("quiet mornings"));
        std::fs::write(&learned,"## Preferences\n").unwrap();
        assert!(!durable_at(&c,&scope,&root).unwrap().items[0].text.contains("quiet mornings"));
        std::fs::remove_file(&learned).unwrap();assert!(durable_at(&c,&scope,&root).unwrap().items.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn durable_memory_is_lower_authority_and_disabled_scope_reads_nothing() {
        let c=Connection::open_in_memory().unwrap();
        let private=Scope{temporary:true,conversation_id:None};
        assert!(!durable_at(&c,&private,std::path::Path::new("does-not-exist")).unwrap().enabled);
        crate::commands::migrations::apply(&c).unwrap();
        c.execute("INSERT INTO settings(key,value) VALUES('chatMemory.use','false')",[]).unwrap();
        assert!(!durable_at(&c,&Scope{temporary:false,conversation_id:None},std::path::Path::new("does-not-exist")).unwrap().enabled);
    }
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct DurableItem { pub id:String,pub title:String,pub text:String,pub source_path:String,pub revision:String,pub authority:String,pub truncated:bool }
#[derive(Serialize)]
pub(crate) struct DurableSnapshot {pub enabled:bool,pub status:String,pub items:Vec<DurableItem>}
/// Exact current vault revisions, independent of the transient chat recall window.
pub(crate) fn durable_snapshot(c:&Connection,scope:&Scope)->Result<DurableSnapshot,String>{
    durable_at(c,scope,&super::get_vault_path())
}
fn durable_at(c:&Connection,scope:&Scope,root:&std::path::Path)->Result<DurableSnapshot,String>{
    use std::io::Read;
    let disabled=||DurableSnapshot{enabled:false,status:"disabled".into(),items:vec![]};
    if scope.temporary{return Ok(disabled());}
    let preference:Option<String>=c.query_row("SELECT value FROM settings WHERE key='chatMemory.use'",[],|r|r.get(0)).optional().map_err(error)?;
    if preference.as_deref()==Some("false"){return Ok(disabled());}
    let mut items=Vec::new();
    for (id,path,title,profile) in [("operator-profile","09 - System/User Profile.md","Operator profile",true),("durable-memory",super::chat_memory::MEMORY_NOTE,"Durable learned memory",false)] {
        let target=super::vault_write::resolve_within(root,std::path::Path::new(path)).map_err(|_|"briefing_durable_vault_unavailable")?;
        let mut file=match std::fs::File::open(&target){Ok(file)=>file,Err(e)if e.kind()==std::io::ErrorKind::NotFound=>continue,Err(_)=>return Err("briefing_durable_source_unavailable".into())};
        let before=file.metadata().map_err(|_|"briefing_durable_source_unavailable")?;
        if !before.is_file()||before.len()>65_536{return Err("briefing_durable_source_bound".into());}
        let mut bytes=Vec::new();Read::by_ref(&mut file).take(65_537).read_to_end(&mut bytes).map_err(|_|"briefing_durable_source_unavailable")?;
        let after=file.metadata().map_err(|_|"briefing_durable_source_unavailable")?;
        if bytes.len()>65_536||before.len()!=after.len()||before.modified().ok()!=after.modified().ok(){return Err("briefing_durable_source_changed".into());}
        let raw=String::from_utf8(bytes.clone()).map_err(|_|"briefing_durable_source_invalid")?;
        let (metadata,body)=match super::pantheon::split_frontmatter(&raw){Some((yaml,body))=>(serde_yaml::from_str::<serde_yaml::Value>(yaml).map_err(|_|"briefing_durable_metadata_invalid")?,body),None=>(serde_yaml::Value::Null,raw.as_str())};
        let status=metadata.get("status").and_then(serde_yaml::Value::as_str).unwrap_or("");
        if matches!(status,"withdrawn"|"revoked"|"deleted"|"archived"|"superseded")||(profile&&status!="active"){continue;}
        let body=if profile{body.trim().to_owned()}else{super::chat_memory::memory_text(&raw)};
        if body.trim().is_empty(){continue;}
        let truncated=body.chars().count()>12_000;
        items.push(DurableItem{id:id.into(),title:title.into(),text:body.chars().take(12_000).collect(),source_path:path.into(),revision:format!("{:x}",Sha256::digest(&bytes)),authority:if profile{"operator_statement"}else{"remembered_context"}.into(),truncated});
    }
    Ok(DurableSnapshot{enabled:true,status:if items.is_empty(){"no_match"}else{"ready"}.into(),items})
}
