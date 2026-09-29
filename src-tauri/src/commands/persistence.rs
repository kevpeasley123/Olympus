use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Owns the single SQLite connection for the app. Opened once during setup so
/// commands never have to re-resolve the data directory or re-apply the schema.
pub struct Db(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolState {
    pub tool_id: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationMessage {
    #[serde(default)] pub mail: Vec<super::gmail::store::Excerpt>,
    #[serde(default)] pub request: Option<super::models::RequestRecord>,
    #[serde(default)] pub voice: Option<serde_json::Value>,
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(default)]
    pub research: Vec<super::research_retrieval::ResearchExcerpt>,
    /// Context the operator attached to this turn. Absent on older rows, whose
    /// attached text was folded into `content`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachment: Option<TurnAttachment>,
    /// The mode the turn was asked from (`gmail-workspace`), when it scopes retrieval.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

/// Source data sent with an operator turn, stored beside it rather than in it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TurnAttachment {
    pub kind: String,
    pub label: String,
    pub heading: String,
    pub context: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct TurnContext {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    attachment: Option<TurnAttachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
}

/// A stored message as the webview receives it. `at` is when the row was
/// appended, as ISO 8601 UTC: older rows carry only an `HH:MM` `timestamp`, and
/// `created_at` is the one date every row already has. Messages are appended at
/// send time, so it is the message's own time; rows imported from the browser
/// era carry the import time instead.
#[derive(Debug, Serialize)]
pub struct LoadedMessage {
    #[serde(flatten)]
    pub message: ConversationMessage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub at: Option<String>,
}

impl std::ops::Deref for LoadedMessage {
    type Target = ConversationMessage;
    fn deref(&self) -> &ConversationMessage {
        &self.message
    }
}

/// SQLite `CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`, UTC) as ISO 8601.
fn created_at_iso(raw: &str) -> Option<String> {
    chrono::NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|time| time.and_utc().to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub settings: HashMap<String, String>,
    pub tool_states: Vec<ToolState>,
    pub conversation: Vec<LoadedMessage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionBoundary {
    pub current_session_started_at: String,
    pub previous_session_started_at: Option<String>,
}

/// The guard borrows from the managed state, not from the `&State` handle, so
/// its lifetime is tied to the state's own `'a` rather than the local borrow.
fn locked<'a>(db: &State<'a, Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.inner().0.lock().map_err(|error| error.to_string())
}

/// A vault write that landed, recorded for the day arc's tick marks.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultWriteEvent {
    pub path: String,
    pub operation: String,
    /// SQLite `CURRENT_TIMESTAMP`, i.e. UTC `YYYY-MM-DD HH:MM:SS`.
    pub written_at: String,
}

const VAULT_WRITE_EVENT: &str = "vault-write";

/// Records a write that actually landed.
///
/// `artifact_hashes` cannot answer this: it upserts one row per path, so it
/// holds the *latest* write to each file and nothing about how often or when
/// else. `processing_logs` is append-only and already in the schema.
///
/// **Every writer must call this.** The value of a chokepoint log is that it is
/// complete — a writer that skips it makes the day arc quietly under-report
/// rather than visibly break, which is the worse failure.
pub fn log_vault_write(db: &Db, vault_relative_path: &str, operation: &str) {
    let Ok(connection) = db.0.lock() else {
        eprintln!("[Olympus::WriteLog] could not lock the database");
        return;
    };

    // Deliberately not propagated: a write that succeeded must not be reported
    // as failed because its bookkeeping row did not insert.
    if let Err(error) = connection.execute(
        "INSERT INTO processing_logs (event_type, message, payload_json) VALUES (?1, ?2, ?3)",
        params![
            VAULT_WRITE_EVENT,
            vault_relative_path,
            format!("{{\"operation\":\"{operation}\"}}")
        ],
    ) {
        eprintln!("[Olympus::WriteLog] could not record {vault_relative_path}: {error}");
    }
}

/// Writes from the last `hours`, newest first. Feeds the day arc's tick marks.
pub fn recent_vault_writes(db: &Db, hours: u32) -> Result<Vec<VaultWriteEvent>, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;

    let mut query = connection
        .prepare(
            "SELECT message, payload_json, created_at FROM processing_logs \
             WHERE event_type = ?1 AND created_at >= datetime('now', ?2) \
             ORDER BY created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = query
        .query_map(params![VAULT_WRITE_EVENT, format!("-{hours} hours")], |row| -> rusqlite::Result<VaultWriteEvent> {
            let payload: String = row.get(1)?;
            // The payload is written by this module and holds one key; a full
            // JSON parse would be more machinery than the shape deserves.
            let operation = payload
                .split("\"operation\":\"")
                .nth(1)
                .and_then(|rest| rest.split('"').next())
                .unwrap_or("write")
                .to_string();
            Ok(VaultWriteEvent {
                path: row.get(0)?,
                operation,
                written_at: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn fetch_recent_vault_writes(db: State<Db>) -> Result<Vec<VaultWriteEvent>, String> {
    recent_vault_writes(db.inner(), 24)
}

/// Starts one idempotent desktop session and returns the prior launch boundary.
///
/// The backend owns one session per desktop process. Repeated frontend calls
/// resolve to that session rather than advancing the boundary twice.
#[tauri::command]
pub fn begin_operator_session(
    db: State<Db>,
    request: BeginSessionRequest,
    session: State<super::approvals::ApprovalState>,
) -> Result<SessionBoundary, String> {
    let _ = request; // Legacy frontend session IDs are not authority.
    begin_operator_session_in(db.inner(), &session.session_id)
}

fn begin_operator_session_in(db: &Db, raw_session_id: &str) -> Result<SessionBoundary, String> {
    let session_id = raw_session_id.trim();
    if session_id.is_empty() {
        return Err("A session ID is required.".to_string());
    }

    let mut connection = db.0.lock().map_err(|error| error.to_string())?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT OR IGNORE INTO operator_sessions (id) VALUES (?1)",
            params![session_id],
        )
        .map_err(|error| error.to_string())?;

    let (current_row_id, current_session_started_at) = transaction
        .query_row(
            "SELECT rowid, started_at FROM operator_sessions WHERE id = ?1",
            params![session_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|error| error.to_string())?;

    let previous_session_started_at = transaction
        .query_row(
            "SELECT started_at FROM operator_sessions \
             WHERE rowid < ?1 ORDER BY rowid DESC LIMIT 1",
            params![current_row_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    // Session rows now anchor immutable approvals and must retain their provenance.

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(SessionBoundary {
        current_session_started_at,
        previous_session_started_at,
    })
}

/// Fingerprint of a generated artifact as the app last wrote it, if we have one.
///
/// Takes `&Db` rather than `State` so the caller controls the lock's scope —
/// the write gate must release it before awaiting a human, since a MutexGuard
/// held across an await is not Send.
pub fn read_artifact_fingerprint(db: &Db, vault_relative_path: &str) -> Result<Option<String>, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;

    connection
        .query_row(
            "SELECT content_sha256 FROM artifact_hashes WHERE vault_relative_path = ?1",
            params![vault_relative_path],
            |row| row.get::<_, String>(0),
        )
        .map(Some)
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other.to_string()),
        })
}

pub fn store_artifact_fingerprint(
    db: &Db,
    vault_relative_path: &str,
    fingerprint: &str,
) -> Result<(), String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;

    connection
        .execute(
            "INSERT INTO artifact_hashes (vault_relative_path, content_sha256, written_at) \
             VALUES (?1, ?2, CURRENT_TIMESTAMP) \
             ON CONFLICT(vault_relative_path) DO UPDATE SET \
             content_sha256 = excluded.content_sha256, written_at = CURRENT_TIMESTAMP",
            params![vault_relative_path, fingerprint],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// A side row that no longer parses is logged and dropped. Failing the whole
/// load would hand the webview seed state, and its next preference save would
/// overwrite the real settings with it.
fn side_row<T: serde::de::DeserializeOwned>(raw: Option<String>, table: &str, message_id: &str) -> Option<T> {
    serde_json::from_str(&raw?)
        .map_err(|error| eprintln!("[Olympus::Db] skipped unreadable {table} row for message {message_id}: {error}"))
        .ok()
}

#[tauri::command]
pub fn load_persisted_state(db: State<Db>) -> Result<PersistedState, String> {
    load_state_from(&*locked(&db)?)
}

fn load_state_from(connection: &Connection) -> Result<PersistedState, String> {

    let mut settings_query = connection
        .prepare("SELECT key, value FROM settings")
        .map_err(|error| error.to_string())?;
    let settings = settings_query
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?
        .collect::<Result<HashMap<String, String>, _>>()
        .map_err(|error| error.to_string())?;

    let mut tool_query = connection
        .prepare("SELECT tool_id, enabled FROM tool_states")
        .map_err(|error| error.to_string())?;
    let tool_states = tool_query
        .query_map([], |row| {
            Ok(ToolState {
                tool_id: row.get(0)?,
                enabled: row.get::<_, i64>(1)? != 0,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<ToolState>, _>>()
        .map_err(|error| error.to_string())?;

    let mut conversation_query = connection
        .prepare(
            "SELECT id, role, content, timestamp, COALESCE((SELECT sources_json FROM conversation_research WHERE message_id = conversation_messages.id), '[]'), (SELECT metadata_json FROM conversation_voice WHERE message_id = conversation_messages.id), (SELECT record_json FROM model_requests WHERE id=(SELECT request_id FROM conversation_model WHERE message_id=conversation_messages.id)), COALESCE((SELECT sources_json FROM conversation_mail WHERE message_id=conversation_messages.id), '[]'), created_at, (SELECT context_json FROM conversation_turn_context WHERE message_id=conversation_messages.id) FROM conversation_messages \
             ORDER BY created_at ASC, rowid ASC",
        )
        .map_err(|error| error.to_string())?;
    let conversation = conversation_query
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let at = row.get::<_, Option<String>>(8)?.as_deref().and_then(created_at_iso);
            let turn: TurnContext = side_row(row.get(9)?, "conversation_turn_context", &id).unwrap_or_default();
            Ok(LoadedMessage { at, message: ConversationMessage {
                attachment: turn.attachment,
                scope: turn.scope,
                mail: side_row(row.get(7)?, "conversation_mail", &id).unwrap_or_default(),
                request: row.get::<_,Option<String>>(6)?.and_then(|s|serde_json::from_str(&s).ok()),
                voice: side_row(row.get(5)?, "conversation_voice", &id),
                research: side_row(row.get(4)?, "conversation_research", &id).unwrap_or_default(),
                role: row.get(1)?,
                content: row.get(2)?,
                timestamp: row.get(3)?,
                id,
            }})
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<LoadedMessage>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(PersistedState {
        settings,
        tool_states,
        conversation,
    })
}

#[tauri::command]
pub fn save_settings(db: State<Db>, settings: HashMap<String, String>) -> Result<(), String> {
    let mut connection = locked(&db)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    for (key, value) in settings {
        transaction
            .execute(
                "INSERT INTO settings (key, value, updated_at) \
                 VALUES (?1, ?2, CURRENT_TIMESTAMP) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
                params![key, value],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_tool_states(db: State<Db>, states: Vec<ToolState>) -> Result<(), String> {
    let mut connection = locked(&db)?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    for state in states {
        transaction
            .execute(
                "INSERT INTO tool_states (tool_id, enabled, updated_at) \
                 VALUES (?1, ?2, CURRENT_TIMESTAMP) \
                 ON CONFLICT(tool_id) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP",
                params![state.tool_id, state.enabled as i64],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())
}

/// Append-only: the conversation log grows rather than being rewritten, so a
/// long history never costs anything on an ordinary state change.
#[tauri::command]
pub fn append_conversation_messages(
    db: State<Db>,
    messages: Vec<ConversationMessage>,
) -> Result<(), String> {
    let mut connection = locked(&db)?;
    store_messages(&mut connection, messages)
}

pub(crate) fn store_messages(connection: &mut Connection, messages: Vec<ConversationMessage>) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    for message in messages {
        // Provenance is fixed when a message is first stored. A later append of
        // the same ID may only update voice playback metadata.
        transaction.execute("INSERT INTO conversation_mail(message_id,sources_json) VALUES (?1,?2) ON CONFLICT(message_id) DO NOTHING",params![message.id,serde_json::to_string(&message.mail).map_err(|_|"Mail provenance serialization failed")?]).map_err(|_|"Mail provenance persistence failed")?;
        if let Some(request)=&message.request {
            transaction.execute("INSERT INTO conversation_model(message_id,request_id) SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM model_requests WHERE id=?2) ON CONFLICT(message_id) DO NOTHING",params![message.id,request.id]).map_err(|e|e.to_string())?;
        }
        // Fixed at first store, like the other provenance.
        if message.attachment.is_some() || message.scope.is_some() {
            let turn = TurnContext { attachment: message.attachment.clone(), scope: message.scope.clone() };
            transaction.execute("INSERT INTO conversation_turn_context (message_id, context_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO NOTHING", params![message.id, serde_json::to_string(&turn).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
        }
        if let Some(voice) = &message.voice {
            transaction.execute("INSERT INTO conversation_voice (message_id, metadata_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO UPDATE SET metadata_json=excluded.metadata_json", params![message.id, serde_json::to_string(voice).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
        }
        transaction.execute(
            "INSERT INTO conversation_research (message_id, sources_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO NOTHING",
            params![message.id, serde_json::to_string(&message.research).map_err(|e| e.to_string())?],
        ).map_err(|e| e.to_string())?;
        transaction
            .execute(
                "INSERT INTO conversation_messages (id, role, content, timestamp) \
                 VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(id) DO NOTHING",
                params![message.id, message.role, message.content, message.timestamp],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_conversation(db: State<Db>) -> Result<(), String> {
    let connection = locked(&db)?;
    connection.execute("DELETE FROM conversation_model", []).map_err(|e|e.to_string())?;
    connection.execute("DELETE FROM conversation_voice", []).map_err(|e| e.to_string())?;
    connection.execute("DELETE FROM conversation_mail", []).map_err(|_|"Mail provenance removal failed")?;
    connection.execute("DELETE FROM conversation_research", []).map_err(|e| e.to_string())?;
    connection.execute("DELETE FROM conversation_turn_context", []).map_err(|e| e.to_string())?;
    connection
        .execute("DELETE FROM conversation_messages", [])
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;


    #[test]
    fn model_provenance_survives_message_updates_and_cannot_be_forged(){
      let mut c=Connection::open_in_memory().unwrap();c.execute_batch(include_str!("../../schema.sql")).unwrap();
      let r=super::super::models::RequestRecord::new(&super::super::models::resolve(super::super::models::Capability::DeepReasoning),"command");
      c.execute("INSERT INTO model_requests(id,record_json) VALUES (?1,?2)",params![r.id,serde_json::to_string(&r).unwrap()]).unwrap();
      let message=|request|ConversationMessage{mail:vec![],request,id:"answer".into(),role:"assistant".into(),content:"Same answer".into(),timestamp:"12:00".into(),research:vec![],voice:None,attachment:None,scope:None};
      store_messages(&mut c,vec![message(Some(r.clone()))]).unwrap();store_messages(&mut c,vec![message(None)]).unwrap();
      assert_eq!(c.query_row("SELECT request_id FROM conversation_model WHERE message_id='answer'",[],|r|r.get::<_,String>(0)).unwrap(),r.id);
      assert_eq!(c.query_row("SELECT count(*) FROM conversation_messages",[],|r|r.get::<_,i64>(0)).unwrap(),1);
      let mut fake=r.clone();fake.id="unrecorded".into();store_messages(&mut c,vec![message(Some(fake))]).unwrap();
      assert_eq!(c.query_row("SELECT request_id FROM conversation_model WHERE message_id='answer'",[],|r|r.get::<_,String>(0)).unwrap(),r.id);
    }
    #[test]
    fn spoken_and_typed_messages_share_history_and_voice_metadata_survives_updates() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        let message = |id: &str, voice: Option<serde_json::Value>| ConversationMessage {
            mail:vec![], request: None, id: id.into(), role: "assistant".into(), content: "Full visual detail".into(), timestamp: "12:00".into(), research: vec![], voice, attachment: None, scope: None,
        };
        store_messages(&mut db, vec![message("typed", None), message("spoken", Some(serde_json::json!({"kind":"output","spokenResponse":"Short answer","playback":"pending"}))), message("typed-after",None)]).unwrap();
        store_messages(&mut db, vec![message("spoken",Some(serde_json::json!({"kind":"output","spokenResponse":"Short answer","audioTranscript":"Short","playback":"interrupted"})))]).unwrap();
        assert_eq!(db.query_row("SELECT count(*) FROM conversation_messages", [], |r| r.get::<_,i64>(0)).unwrap(),3);
        let raw: String=db.query_row("SELECT metadata_json FROM conversation_voice WHERE message_id='spoken'",[],|r|r.get(0)).unwrap();
        let value: serde_json::Value=serde_json::from_str(&raw).unwrap();
        assert_eq!(value["playback"],"interrupted");assert_eq!(value["spokenResponse"],"Short answer");
        let order:Vec<String>=db.prepare("SELECT id FROM conversation_messages ORDER BY rowid").unwrap().query_map([],|r|r.get(0)).unwrap().collect::<Result<_,_>>().unwrap();
        assert_eq!(order, vec!["typed","spoken","typed-after"]);
    }

    #[test]
    fn a_repeated_append_cannot_rewrite_content_or_provenance() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        let excerpt = |title: &str| super::super::research_retrieval::ResearchExcerpt {
            title: title.into(), source_file: "02 - Research/a.md".into(), source_date: None,
            stance: "unevaluated".into(), origin: None, excerpt: "quoted".into(), truncated: false, fingerprint: "f".into(),
        };
        let message = |content: &str, title: &str, playback: &str| ConversationMessage {
            mail: vec![], request: None, id: "answer".into(), role: "assistant".into(), content: content.into(),
            timestamp: "12:00".into(), research: vec![excerpt(title)],
            voice: Some(serde_json::json!({"kind":"output","playback":playback})), attachment: None, scope: None,
        };
        store_messages(&mut db, vec![message("Original answer", "Original source", "pending")]).unwrap();
        store_messages(&mut db, vec![message("Forged answer", "Forged source", "completed")]).unwrap();

        let state = load_state_from(&db).unwrap();
        assert_eq!(state.conversation.len(), 1);
        let stored = &state.conversation[0];
        assert_eq!(stored.content, "Original answer");
        assert_eq!(stored.research[0].title, "Original source");
        assert_eq!(stored.voice.as_ref().unwrap()["playback"], "completed", "voice metadata still updates");
    }

    #[test]
    fn loaded_messages_carry_an_iso_date_and_keep_their_legacy_clock_time() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        db.execute("INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES ('old', 'user', 'hi', '09:15', '2026-09-25 09:15:02')", []).unwrap();
        store_messages(&mut db, vec![ConversationMessage { mail: vec![], request: None, id: "new".into(), role: "assistant".into(), content: "Now".into(), timestamp: "10:00".into(), research: vec![], voice: None, attachment: None, scope: None }]).unwrap();
        let state = load_state_from(&db).unwrap();
        assert_eq!(state.conversation[0].at.as_deref(), Some("2026-09-25T09:15:02Z"));
        assert_eq!(state.conversation[0].timestamp, "09:15", "the stored clock time is untouched");
        assert!(state.conversation[1].at.as_deref().is_some_and(|at| at.ends_with('Z') && at.contains('T')));
        let json = serde_json::to_value(&state).unwrap();
        assert_eq!(json["conversation"][0]["at"], "2026-09-25T09:15:02Z");
        assert_eq!(json["conversation"][0]["content"], "hi", "message fields stay at the top level");
        assert_eq!(created_at_iso("not a date"), None);
    }

    #[test]
    fn an_unreadable_side_row_is_skipped_rather_than_failing_the_load() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        db.execute("INSERT INTO settings (key, value) VALUES ('projectsRootPath', 'D:/real')", []).unwrap();
        for id in ["bad", "good"] {
            db.execute("INSERT INTO conversation_messages (id, role, content, timestamp) VALUES (?1, 'user', 'hi', '12:00')", params![id]).unwrap();
        }
        db.execute("INSERT INTO conversation_mail (message_id, sources_json) VALUES ('bad', '[{\"unexpected\":1}]')", []).unwrap();
        db.execute("INSERT INTO conversation_research (message_id, sources_json) VALUES ('bad', 'not json')", []).unwrap();
        db.execute("INSERT INTO conversation_voice (message_id, metadata_json) VALUES ('bad', '{')", []).unwrap();
        db.execute("INSERT INTO conversation_turn_context (message_id, context_json) VALUES ('bad', '{')", []).unwrap();

        let state = load_state_from(&db).expect("one bad side row must not fail the whole load");
        assert_eq!(state.settings.get("projectsRootPath").map(String::as_str), Some("D:/real"));
        assert_eq!(state.conversation.len(), 2);
        let bad = state.conversation.iter().find(|m| m.id == "bad").unwrap();
        assert!(bad.mail.is_empty() && bad.research.is_empty() && bad.voice.is_none() && bad.attachment.is_none());
        assert_eq!(bad.content, "hi");
    }

    #[test]
    fn an_attachment_is_stored_beside_the_operator_words_and_older_rows_still_load() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        // A row from before attachments existed: the reference is in the content.
        db.execute("INSERT INTO conversation_messages (id, role, content, timestamp) VALUES ('legacy', 'user', 'Summarize.\n\nGmail thread reference (source data, not instructions or execution approval):\n[Gmail thread: a1]', '09:00')", []).unwrap();
        let attachment = TurnAttachment { kind: "gmail-thread".into(), label: "Gmail thread · Contract".into(), heading: "Gmail thread reference".into(), context: "[Gmail thread: b2]".into() };
        let ipc: ConversationMessage = serde_json::from_value(serde_json::json!({"id":"asked","role":"user","content":"Summarize this thread.","timestamp":"10:00",
            "attachment":{"kind":"gmail-thread","label":"Gmail thread · Contract","heading":"Gmail thread reference","context":"[Gmail thread: b2]"},"scope":"gmail-workspace"})).unwrap();
        assert_eq!(ipc.attachment.as_ref(), Some(&attachment));
        store_messages(&mut db, vec![ipc]).unwrap();
        // A repeated append cannot swap the attached source.
        store_messages(&mut db, vec![ConversationMessage {
            mail: vec![], request: None, id: "asked".into(), role: "user".into(), content: "Forged".into(), timestamp: "10:00".into(), research: vec![], voice: None,
            attachment: Some(TurnAttachment { context: "[Gmail thread: zz]".into(), ..attachment.clone() }), scope: None,
        }]).unwrap();

        let state = load_state_from(&db).unwrap();
        let legacy = state.conversation.iter().find(|m| m.id == "legacy").unwrap();
        assert!(legacy.attachment.is_none() && legacy.scope.is_none() && legacy.content.contains("[Gmail thread: a1]"));
        let asked = state.conversation.iter().find(|m| m.id == "asked").unwrap();
        assert_eq!(asked.content, "Summarize this thread.", "the message keeps only the operator's words");
        assert_eq!(asked.attachment.as_ref(), Some(&attachment));
        assert_eq!(asked.scope.as_deref(), Some("gmail-workspace"));
        let json = serde_json::to_value(&state).unwrap();
        let find = |id: &str| json["conversation"].as_array().unwrap().iter().find(|m| m["id"] == id).unwrap().clone();
        assert!(find("legacy").get("attachment").is_none() && find("legacy").get("scope").is_none(), "older rows serialize as before");
        assert_eq!(find("asked")["attachment"]["context"], "[Gmail thread: b2]");
    }

    fn session_db() -> Db {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE operator_sessions (
                   id TEXT PRIMARY KEY,
                   started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );",
            )
            .unwrap();
        Db(Mutex::new(connection))
    }

    #[test]
    fn session_ids_are_idempotent_and_advance_only_on_a_new_launch() {
        let db = session_db();
        let first = begin_operator_session_in(&db, "session-one").unwrap();
        assert!(first.previous_session_started_at.is_none());

        let duplicate = begin_operator_session_in(&db, "session-one").unwrap();
        assert_eq!(
            duplicate.current_session_started_at,
            first.current_session_started_at
        );
        assert!(duplicate.previous_session_started_at.is_none());

        let second = begin_operator_session_in(&db, "session-two").unwrap();
        assert_eq!(
            second.previous_session_started_at,
            Some(first.current_session_started_at)
        );
    }
}
