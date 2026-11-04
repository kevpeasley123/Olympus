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
    #[serde(default,skip_serializing_if="Option::is_none")] pub briefing: Option<BriefingOrigin>,
    #[serde(default,skip_serializing)] pub delivery: Option<super::briefing::DisplayPlan>,
    #[serde(default,skip_serializing_if="Option::is_none")]
    pub feedback: Option<serde_json::Value>,
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

/// Origin is immutable diagnostic attribution. Source references are not semantic proof.
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct BriefingSource {pub id:String,pub revision:String}
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(tag="kind",rename_all="snake_case",rename_all_fields="camelCase",deny_unknown_fields)]
pub enum BriefingOrigin {
    DeterministicFallback {prepared_at:i64,sources:Vec<BriefingSource>},
    ModelSynthesis {prepared_at:i64,sources:Vec<BriefingSource>,packet_revision:String,provider:String,model:String,request_id:String},
}
fn validate_and_consume_briefing_origin(c:&Connection,conversation_id:&str,message:&ConversationMessage,origin:&BriefingOrigin)->Result<(),String>{
    let invalid=||"Invalid briefing origin".to_string();
    if message.role!="assistant"||!message.id.starts_with("conversation-briefing-"){return Err(invalid());}
    let (at,sources)=match origin {BriefingOrigin::DeterministicFallback{prepared_at,sources}=> (*prepared_at,sources),BriefingOrigin::ModelSynthesis{prepared_at,sources,..}=>(*prepared_at,sources)};
    let digest=|v:&str|v.len()==64&&v.bytes().all(|b|b.is_ascii_hexdigit());
    let mut ids=std::collections::HashSet::new();
    if at<0||at>chrono::Utc::now().timestamp_millis().saturating_add(60_000)||sources.len()>24||sources.iter().any(|s|s.id.is_empty()||s.id.len()>256||s.id.chars().any(char::is_control)||!digest(&s.revision)||!ids.insert(&s.id)){return Err(invalid());}
    if let BriefingOrigin::ModelSynthesis{packet_revision,provider,model,request_id,..}=origin {
        if message.request.as_ref().is_some_and(|r|r.id!=*request_id){return Err(invalid());}
        if !digest(packet_revision)||request_id.is_empty()||request_id.len()>256||provider.len()>128||model.len()>128{return Err(invalid());}
        let raw:Option<String>=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[request_id],|r|r.get(0)).optional().map_err(|_|invalid())?;
        let raw=raw.ok_or_else(invalid)?;
        let record:super::models::RequestRecord=serde_json::from_str(&raw).map_err(|_|invalid())?;
        if record.purpose!="briefing_synthesis"||record.status!="completed"||record.provider!=*provider||record.actual_model.as_deref()!=Some(model.as_str()){return Err(invalid());}
        // A request's existence is not permission to attribute arbitrary text to it.
        // Only a future qualified native compositor may issue this binding. Until
        // then production model-origin saves fail closed; tests issue fixtures.
        use sha2::{Digest,Sha256};
        let expected=serde_json::json!({"conversationId":conversation_id,"contentDigest":format!("{:x}",Sha256::digest(message.content.as_bytes())),"origin":origin,"delivery":serde_json::to_value(&message.delivery).map_err(|_|invalid())?});
        if record.usage.as_ref().and_then(|u|u.get("briefing_binding"))!=Some(&expected){return Err(invalid());}
        let used:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM conversation_turn_context WHERE json_extract(context_json,'$.briefing.requestId')=?1)",[request_id],|r|r.get(0)).map_err(|_|invalid())?;
        if used||record.usage.as_ref().and_then(|u|u.get("briefing_consumed")).is_some(){return Err(invalid());}
        // Durable consumption lives independently of deletable conversation rows.
        // CAS and all message/provenance/delivery writes share the caller transaction.
        let consumed=serde_json::json!({"messageId":message.id,"conversationId":conversation_id});
        let changed=c.execute("UPDATE model_requests SET record_json=json_set(record_json,'$.usage.briefing_consumed',json(?1)) WHERE id=?2 AND record_json=?3",params![consumed.to_string(),request_id,raw]).map_err(|_|invalid())?;
        if changed!=1{return Err(invalid());}
    }
    Ok(())
}

// An exact repeat may update voice playback but cannot alter attribution or
// acknowledge delivery again. Missing delivery is normal on history reload.
fn existing_model_briefing(c:&Connection,chat:&str,message:&ConversationMessage)->Result<bool,String>{
    let invalid=||"Invalid briefing replay".to_string();
    let row:Option<(String,String,String,Option<String>)>=c.query_row("SELECT conversation_id,role,content,(SELECT context_json FROM conversation_turn_context WHERE message_id=conversation_messages.id) FROM conversation_messages WHERE id=?1",[&message.id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional().map_err(|_|invalid())?;
    let Some((stored_chat,role,content,context))=row else{return Ok(false)};
    let context:TurnContext=context.map(|s|serde_json::from_str(&s)).transpose().map_err(|_|invalid())?.unwrap_or_default();
    let Some(origin @ BriefingOrigin::ModelSynthesis{request_id,..})=context.briefing.as_ref() else{
        if matches!(message.briefing,Some(BriefingOrigin::ModelSynthesis{..})){return Err(invalid());}
        return Ok(false)
    };
    if stored_chat!=chat||role!=message.role||content!=message.content{return Err(invalid());}
    if let Some(incoming)=&message.briefing{if serde_json::to_value(incoming).map_err(|_|invalid())?!=serde_json::to_value(&origin).map_err(|_|invalid())?{return Err(invalid());}}
    if message.request.as_ref().is_some_and(|r|r.id!=*request_id){return Err(invalid());}
    let raw:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[request_id],|r|r.get(0)).map_err(|_|invalid())?;
    let record:serde_json::Value=serde_json::from_str(&raw).map_err(|_|invalid())?;
    if record["usage"]["briefing_consumed"]!=serde_json::json!({"messageId":message.id,"conversationId":chat}){return Err(invalid());}
    if let Some(delivery)=&message.delivery{if serde_json::to_value(delivery).map_err(|_|invalid())?!=record["usage"]["briefing_binding"]["delivery"]{return Err(invalid());}}
    Ok(true)
}

/// Source data sent with an operator turn, stored beside it rather than in it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TurnAttachment {
    #[serde(default,rename="projectId",skip_serializing_if="Option::is_none")]
    pub project_id: Option<String>,
    pub kind: String,
    pub label: String,
    pub heading: String,
    pub context: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct TurnContext {
    #[serde(default,skip_serializing_if="Option::is_none")] briefing: Option<BriefingOrigin>,
    #[serde(default,skip_serializing_if="Option::is_none")]
    feedback: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    attachment: Option<TurnAttachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
}

/// A stored message as the webview receives it. `at` is when the row was
/// appended, as ISO 8601 UTC: older rows carry only an `HH:MM` `timestamp`, and
/// `created_at` is the one date every row already has. Messages are appended at
/// send time, so it is the message's own time.
///
/// Rows imported from the browser era are the exception: their `created_at` is
/// the import moment. They carry `importedAt` and no `at`, so nothing can read
/// the import as the time the message was written.
#[derive(Debug, Serialize)]
pub struct LoadedMessage {
    #[serde(flatten)]
    pub message: ConversationMessage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub at: Option<String>,
    #[serde(rename = "importedAt", skip_serializing_if = "Option::is_none")]
    pub imported_at: Option<String>,
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
    /// The chat reopened at launch (see `conversations::resumable`), if any.
    pub conversation_id: Option<String>,
    pub conversation: Vec<LoadedMessage>,
    /// Whether any chat is stored, so the webview never mistakes a fresh
    /// launch for an empty database and re-imports browser-era history.
    pub has_conversations: bool,
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

    let conversation_id = super::conversations::resumable(connection)?;
    let conversation = match &conversation_id {
        Some(id) => load_messages(connection, Some(id))?,
        None => Vec::new(),
    };
    let has_conversations = connection
        .query_row("SELECT EXISTS (SELECT 1 FROM conversation_messages)", [], |r| r.get(0))
        .map_err(|error| error.to_string())?;

    Ok(PersistedState {
        settings,
        tool_states,
        conversation_id,
        conversation,
        has_conversations,
    })
}

/// One chat's messages in order, with their side rows; `None` reads every
/// message (tests and diagnostics).
pub fn load_messages(connection: &Connection, conversation_id: Option<&str>) -> Result<Vec<LoadedMessage>, String> {
    let mut conversation_query = connection
        .prepare(
            "SELECT id, role, content, timestamp, COALESCE((SELECT sources_json FROM conversation_research WHERE message_id = conversation_messages.id), '[]'), (SELECT metadata_json FROM conversation_voice WHERE message_id = conversation_messages.id), (SELECT record_json FROM model_requests WHERE id=(SELECT request_id FROM conversation_model WHERE message_id=conversation_messages.id)), COALESCE((SELECT sources_json FROM conversation_mail WHERE message_id=conversation_messages.id), '[]'), created_at, (SELECT context_json FROM conversation_turn_context WHERE message_id=conversation_messages.id), (SELECT imported_at FROM conversation_imports WHERE message_id=conversation_messages.id) FROM conversation_messages \
             WHERE ?1 IS NULL OR conversation_id = ?1 ORDER BY created_at ASC, rowid ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = conversation_query
        .query_map([conversation_id], |row| {
            let id: String = row.get(0)?;
            let imported_at: Option<String> = row.get(10)?;
            let at = match imported_at {
                Some(_) => None,
                None => row.get::<_, Option<String>>(8)?.as_deref().and_then(created_at_iso),
            };
            let turn: TurnContext = side_row(row.get(9)?, "conversation_turn_context", &id).unwrap_or_default();
            Ok(LoadedMessage { at, imported_at, message: ConversationMessage {
                delivery:None, briefing:turn.briefing, feedback: turn.feedback,
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
        .map_err(|error| error.to_string());
    rows
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
///
/// `imported` is set only by the one-time localStorage import. Those rows are
/// marked in the same transaction, and only when this call inserted them, so a
/// message already stored is never relabelled.
#[tauri::command]
pub fn append_conversation_messages(
    db: State<Db>,
    conversation_id: String,
    messages: Vec<ConversationMessage>,
    imported: Option<bool>,
) -> Result<(), String> {
    let mut connection = locked(&db)?;
    store_messages_as(&mut connection, &conversation_id, messages, imported.unwrap_or(false))
}

#[cfg(test)]
pub(crate) fn store_messages(connection: &mut Connection, conversation_id: &str, messages: Vec<ConversationMessage>) -> Result<(), String> {
    store_messages_as(connection, conversation_id, messages, false)
}

fn store_messages_as(connection: &mut Connection, conversation_id: &str, messages: Vec<ConversationMessage>, imported: bool) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    store_messages_in_transaction(&transaction, conversation_id, messages, imported)?;
    transaction.commit().map_err(|error| error.to_string())
}

/// Stores messages and consumes result bindings inside the caller's transaction.
/// The caller must roll back on any error; this helper never commits or creates
/// its own transaction, so native binding issuance can be part of the same unit.
pub(super) fn store_messages_in_transaction(transaction: &rusqlite::Transaction<'_>, conversation_id: &str, messages: Vec<ConversationMessage>, imported: bool) -> Result<(), String> {
    let conversation_id = conversation_id.trim();
    if conversation_id.is_empty() || conversation_id.len() > 128 {
        return Err("A message must belong to a conversation.".into());
    }
    let first_user = messages.iter().find(|m| m.role == "user").map(|m| m.content.as_str());
    super::conversations::ensure(transaction, conversation_id, first_user).map_err(|e| e.to_string())?;
    let mut inserted_any = false;

    for message in messages {
        if existing_model_briefing(transaction,conversation_id,&message)?{
            if let Some(voice)=&message.voice{transaction.execute("INSERT INTO conversation_voice(message_id,metadata_json) VALUES(?1,?2) ON CONFLICT(message_id) DO UPDATE SET metadata_json=excluded.metadata_json",params![message.id,serde_json::to_string(voice).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;}
            continue;
        }
        if imported&&matches!(message.briefing,Some(BriefingOrigin::ModelSynthesis{..})){return Err("Imported messages cannot consume native briefing results".into());}
        // Provenance is fixed when a message is first stored. A later append of
        // the same ID may only update voice playback metadata.
        transaction.execute("INSERT INTO conversation_mail(message_id,sources_json) VALUES (?1,?2) ON CONFLICT(message_id) DO NOTHING",params![message.id,serde_json::to_string(&message.mail).map_err(|_|"Mail provenance serialization failed")?]).map_err(|_|"Mail provenance persistence failed")?;
        if let Some(request)=&message.request {
            transaction.execute("INSERT INTO conversation_model(message_id,request_id) SELECT ?1,?2 WHERE EXISTS(SELECT 1 FROM model_requests WHERE id=?2) ON CONFLICT(message_id) DO NOTHING",params![message.id,request.id]).map_err(|e|e.to_string())?;
        }
        // Fixed at first store, like the other provenance.
        if message.feedback.as_ref().is_some_and(|f|message.role!="assistant"||!f.is_object()||f.to_string().len()>16000){return Err("Invalid app feedback context".into())}
        let existing:bool=transaction.query_row("SELECT EXISTS(SELECT 1 FROM conversation_messages WHERE id=?1)",[&message.id],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !existing && (message.attachment.is_some() || message.scope.is_some() || message.feedback.is_some() || message.briefing.is_some()) {
            if let Some(origin)=&message.briefing {validate_and_consume_briefing_origin(transaction,conversation_id,&message,origin)?;}
            let turn = TurnContext { briefing:message.briefing.clone(), feedback:message.feedback.clone(), attachment: message.attachment.clone(), scope: message.scope.clone() };
            transaction.execute("INSERT INTO conversation_turn_context (message_id, context_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO NOTHING", params![message.id, serde_json::to_string(&turn).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
        }
        if let Some(voice) = &message.voice {
            transaction.execute("INSERT INTO conversation_voice (message_id, metadata_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO UPDATE SET metadata_json=excluded.metadata_json", params![message.id, serde_json::to_string(voice).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
        }
        transaction.execute(
            "INSERT INTO conversation_research (message_id, sources_json) VALUES (?1, ?2) ON CONFLICT(message_id) DO NOTHING",
            params![message.id, serde_json::to_string(&message.research).map_err(|e| e.to_string())?],
        ).map_err(|e| e.to_string())?;
        let inserted = transaction
            .execute(
                "INSERT INTO conversation_messages (id, role, content, timestamp, conversation_id) \
                 VALUES (?1, ?2, ?3, ?4, ?5) \
                 ON CONFLICT(id) DO NOTHING",
                params![message.id, message.role, message.content, message.timestamp, conversation_id],
            )
            .map_err(|error| error.to_string())?;
        if inserted == 1 {
            if !imported {
                if let Some(plan)=&message.delivery {super::briefing::store_display(transaction,&message.id,&message.role,plan)?;}
            }
            inserted_any = true;
            super::conversations::index_message(transaction, conversation_id, &message.id, &message.content).map_err(|e| e.to_string())?;
        }
        if imported && inserted == 1 {
            transaction
                .execute("INSERT INTO conversation_imports (message_id) VALUES (?1) ON CONFLICT(message_id) DO NOTHING", params![message.id])
                .map_err(|error| error.to_string())?;
        }
    }
    if inserted_any {
        super::conversations::touch(transaction, conversation_id).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn briefing_feedback_context_roundtrips_and_cannot_be_added_by_replay() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let value=serde_json::json!({"id":"brief","role":"assistant","content":"Email recommendation","timestamp":"12:00","feedback":{"kind":"brief","itemCount":1,"sources":[{"accountId":"a","threadId":"t","signature":"s","revision":0,"subject":"Subject"}]}});
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        let loaded=serde_json::to_value(load_messages(&c,Some("chat")).unwrap()).unwrap();
        assert_eq!(loaded[0]["feedback"],value["feedback"]);
        let mut plain=value.clone();plain["id"]=serde_json::json!("plain");plain.as_object_mut().unwrap().remove("feedback");
        store_messages(&mut c,"chat",vec![serde_json::from_value(plain.clone()).unwrap()]).unwrap();
        plain["feedback"]=value["feedback"].clone();
        store_messages(&mut c,"chat",vec![serde_json::from_value(plain).unwrap()]).unwrap();
        assert!(serde_json::to_value(load_messages(&c,Some("chat")).unwrap()).unwrap()[1]["feedback"].is_null());
    }

    #[test]
    fn briefing_origin_roundtrips_and_replay_cannot_add_it() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let origin=serde_json::json!({"kind":"deterministic_fallback","preparedAt":1000,"sources":[{"id":"fixture-source","revision":"a".repeat(64)}]});
        let value=serde_json::json!({"id":"conversation-briefing-fixture","role":"assistant","content":"Synthetic brief","timestamp":"12:00","briefing":origin});
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        let loaded=serde_json::to_value(load_messages(&c,Some("chat")).unwrap()).unwrap();
        assert_eq!(loaded[0]["briefing"],origin);
        let mut plain=value.clone();plain["id"]=serde_json::json!("conversation-briefing-legacy");plain.as_object_mut().unwrap().remove("briefing");
        store_messages(&mut c,"chat",vec![serde_json::from_value(plain.clone()).unwrap()]).unwrap();
        plain["briefing"]=origin.clone();store_messages(&mut c,"chat",vec![serde_json::from_value(plain).unwrap()]).unwrap();
        assert!(serde_json::to_value(load_messages(&c,Some("chat")).unwrap()).unwrap()[1]["briefing"].is_null());
    }

    #[test]
    fn briefing_model_origin_requires_completed_native_request_and_is_immutable() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let mut r=super::super::models::RequestRecord::new(&super::super::models::resolve(super::super::models::Capability::Primary),"briefing_synthesis");
        r.provider="fixture".into();r.actual_model=Some("synthetic".into());r.status="completed".into();
        let origin=serde_json::json!({"kind":"model_synthesis","preparedAt":1000,"sources":[{"id":"fixture-source","revision":"a".repeat(64)}],"packetRevision":"b".repeat(64),"provider":"fixture","model":"synthetic","requestId":r.id});
        let value=serde_json::json!({"id":"conversation-briefing-model","role":"assistant","content":"Synthetic brief","timestamp":"12:00","briefing":origin});
        assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).is_err());
        assert_eq!(c.query_row("SELECT count(*) FROM conversation_messages",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        c.execute("INSERT INTO model_requests(id,record_json) VALUES (?1,?2)",params![r.id,serde_json::to_string(&r).unwrap()]).unwrap();
        for field in ["provider","model","requestId"] {
            let mut forged=value.clone();forged["briefing"][field]=serde_json::json!("forged");
            assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(forged).unwrap()]).is_err());
        }
        let mut user=value.clone();user["role"]=serde_json::json!("user");
        assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(user).unwrap()]).is_err());
        for (status,purpose) in [("started","briefing_synthesis"),("completed","chat")] {
            let mut bad=r.clone();bad.status=status.into();bad.purpose=purpose.into();
            c.execute("UPDATE model_requests SET record_json=?1",[serde_json::to_string(&bad).unwrap()]).unwrap();
            assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).is_err());
        }
        use sha2::{Digest,Sha256};
        r.usage=Some(serde_json::json!({"briefing_binding":{"conversationId":"chat","contentDigest":format!("{:x}",Sha256::digest(b"Synthetic brief")),"origin":origin,"delivery":null}}));
        c.execute("UPDATE model_requests SET record_json=?1",[serde_json::to_string(&r).unwrap()]).unwrap();
        assert!(store_messages(&mut c,"other-chat",vec![serde_json::from_value(value.clone()).unwrap()]).is_err());
        for field in ["content","preparedAt","packetRevision","sources"] {
            let mut tampered=value.clone();
            match field {"content"=>tampered["content"]=serde_json::json!("Invented claim"),"preparedAt"=>tampered["briefing"][field]=serde_json::json!(1001),"sources"=>tampered["briefing"][field]=serde_json::json!([]),_=>tampered["briefing"][field]=serde_json::json!("c".repeat(64))};
            assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(tampered).unwrap()]).is_err());
        }
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        let mut duplicate=value.clone();duplicate["id"]=serde_json::json!("conversation-briefing-replay");
        assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(duplicate).unwrap()]).is_err());
        let mut replay=value.clone();replay["briefing"]=serde_json::json!({"kind":"deterministic_fallback","preparedAt":1000,"sources":[]});
        assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(replay).unwrap()]).is_err());
        assert_eq!(serde_json::to_value(load_messages(&c,Some("chat")).unwrap()).unwrap()[0]["briefing"],origin);
    }

    fn bound_fixture()->(Connection,serde_json::Value,String){
        let c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let mut record=super::super::models::RequestRecord::new(&super::super::models::resolve(super::super::models::Capability::Primary),"briefing_synthesis");
        record.provider="fixture".into();record.actual_model=Some("synthetic".into());record.status="completed".into();
        let origin=serde_json::json!({"kind":"model_synthesis","preparedAt":1000,"sources":[{"id":"fictional-studio","revision":"a".repeat(64)}],"packetRevision":"b".repeat(64),"provider":"fixture","model":"synthetic","requestId":record.id});
        let delivery=serde_json::json!({"preparedAt":1000,"items":[{"id":"fictional-studio","revision":"a".repeat(64)}],"cursors":[]});
        let value=serde_json::json!({"id":"conversation-briefing-bound","role":"assistant","content":"Synthetic studio update.","timestamp":"12:00","briefing":origin,"delivery":delivery});
        use sha2::{Digest,Sha256};
        record.usage=Some(serde_json::json!({"briefing_binding":{"conversationId":"chat","contentDigest":format!("{:x}",Sha256::digest(b"Synthetic studio update.")),"origin":origin,"delivery":delivery}}));
        c.execute("INSERT INTO model_requests(id,record_json) VALUES(?1,?2)",params![record.id,serde_json::to_string(&record).unwrap()]).unwrap();
        (c,value,record.id)
    }
    #[test]fn briefing_consumption_survives_conversation_deletion_and_rejects_replay(){
        let (mut c,value,id)=bound_fixture();
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        super::super::conversations::delete(&mut c,"chat").unwrap();
        for chat in ["chat","other"]{for new_id in ["conversation-briefing-bound","conversation-briefing-new"]{
            let mut replay=value.clone();replay["id"]=serde_json::json!(new_id);
            assert!(store_messages(&mut c,chat,vec![serde_json::from_value(replay).unwrap()]).is_err());
        }}
        let consumed:Option<String>=c.query_row("SELECT json_extract(record_json,'$.usage.briefing_consumed.messageId') FROM model_requests WHERE id=?1",[id],|r|r.get(0)).unwrap();
        assert_eq!(consumed.as_deref(),Some("conversation-briefing-bound"));
        assert_eq!(c.query_row("SELECT count(*) FROM conversation_messages",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }
    #[test]fn briefing_consumption_and_all_message_delivery_rows_rollback_together(){
        for table in ["conversation_turn_context","conversation_messages","pending_brief_displays","conversations"]{
            let (mut c,value,id)=bound_fixture();
            let before:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
            let event=if table=="conversations"{"UPDATE"}else{"INSERT"};
            c.execute_batch(&format!("CREATE TRIGGER injected BEFORE {event} ON {table} BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;")).unwrap();
            assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).is_err());
            assert_eq!(c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get::<_,String>(0)).unwrap(),before);
            for stored in ["conversations","conversation_messages","conversation_turn_context","pending_brief_displays","conversation_mail","conversation_research"]{assert_eq!(c.query_row(&format!("SELECT count(*) FROM {stored}"),[],|r|r.get::<_,i64>(0)).unwrap(),0);}
            c.execute_batch("DROP TRIGGER injected").unwrap();
            store_messages(&mut c,"chat",vec![serde_json::from_value(value).unwrap()]).unwrap();
        }
    }
    #[test]fn briefing_binding_authenticates_delivery_plan_and_saved_record_is_immutable(){
        let (mut c,value,id)=bound_fixture();
        let mut forged=value.clone();forged["delivery"]["items"][0]["id"]=serde_json::json!("unseen-source");
        assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(forged).unwrap()]).is_err());
        store_messages(&mut c,"chat",vec![serde_json::from_value(value).unwrap()]).unwrap();
        let raw:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
        let mut record:super::super::models::RequestRecord=serde_json::from_str(&raw).unwrap();record.usage=None;record.provider="forged".into();
        let db=Db(Mutex::new(c));assert!(super::super::models::save(&db,&record).is_err());
        assert_eq!(db.0.lock().unwrap().query_row("SELECT record_json FROM model_requests WHERE id=?1",[id],|r|r.get::<_,String>(0)).unwrap(),raw);
    }

    #[test]fn briefing_exact_reload_and_voice_update_preserve_binding_and_do_not_redeliver(){
        let (mut c,value,id)=bound_fixture();
        store_messages(&mut c,"chat",vec![serde_json::from_value(value.clone()).unwrap()]).unwrap();
        c.execute("DELETE FROM pending_brief_displays",[]).unwrap();
        let raw:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
        let mut replay=value.clone();replay.as_object_mut().unwrap().remove("delivery");replay["voice"]=serde_json::json!({"playback":"complete"});
        store_messages(&mut c,"chat",vec![serde_json::from_value(replay).unwrap()]).unwrap();
        assert_eq!(c.query_row("SELECT count(*) FROM pending_brief_displays",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        assert_eq!(c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get::<_,String>(0)).unwrap(),raw);
        for field in ["content","delivery","briefing"]{
            let mut changed=value.clone();match field{"content"=>changed["content"]=serde_json::json!("Changed"),"delivery"=>changed["delivery"]["items"]=serde_json::json!([]),_=>changed["briefing"]["packetRevision"]=serde_json::json!("c".repeat(64))};
            assert!(store_messages(&mut c,"chat",vec![serde_json::from_value(changed).unwrap()]).is_err());
        }
        assert!(store_messages(&mut c,"other-chat",vec![serde_json::from_value(value).unwrap()]).is_err());
    }
    #[test]fn briefing_bound_request_cannot_be_rewritten_before_consumption(){
        let (c,_,id)=bound_fixture();
        let raw:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
        let mut record:super::super::models::RequestRecord=serde_json::from_str(&raw).unwrap();let db=Db(Mutex::new(c));
        super::super::models::save(&db,&record).unwrap();
        record.usage=None;assert!(super::super::models::save(&db,&record).is_err());
        assert_eq!(db.0.lock().unwrap().query_row("SELECT record_json FROM model_requests WHERE id=?1",[id],|r|r.get::<_,String>(0)).unwrap(),raw);
    }

    #[test]fn briefing_outer_transaction_rolls_back_binding_and_message_together(){
        for fail_message in [false,true]{
            let (mut c,value,id)=bound_fixture();
            let bound:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
            c.execute("UPDATE model_requests SET record_json=json_remove(record_json,'$.usage.briefing_binding') WHERE id=?1",[&id]).unwrap();
            let before:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get(0)).unwrap();
            if fail_message{c.execute_batch("CREATE TRIGGER synthetic_failure BEFORE INSERT ON pending_brief_displays BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;").unwrap();}
            {
                let transaction=c.transaction().unwrap();
                transaction.execute("UPDATE model_requests SET record_json=?1 WHERE id=?2",params![bound,id]).unwrap();
                let result=store_messages_in_transaction(&transaction,"chat",vec![serde_json::from_value(value).unwrap()],false);
                assert_eq!(result.is_err(),fail_message);
                if !fail_message{
                    assert_eq!(transaction.query_row("SELECT count(*) FROM conversation_messages",[],|r|r.get::<_,i64>(0)).unwrap(),1);
                    assert_eq!(transaction.query_row("SELECT count(*) FROM pending_brief_displays",[],|r|r.get::<_,i64>(0)).unwrap(),1);
                }
                transaction.rollback().unwrap();
            }
            assert_eq!(c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&id],|r|r.get::<_,String>(0)).unwrap(),before);
            for table in ["conversations","conversation_messages","conversation_turn_context","pending_brief_displays","conversation_mail","conversation_research"]{
                assert_eq!(c.query_row(&format!("SELECT count(*) FROM {table}"),[],|r|r.get::<_,i64>(0)).unwrap(),0);
            }
        }
    }

    /// Every stored message, as `load_persisted_state` shaped it before chats
    /// were separate: these tests are about what a loaded message carries.
    fn all(db: &Connection) -> PersistedState {
        let mut state = load_state_from(db).expect("one bad side row must not fail the whole load");
        state.conversation = load_messages(db, None).expect("one bad side row must not fail the whole load");
        state
    }


    #[test]
    fn model_provenance_survives_message_updates_and_cannot_be_forged(){
      let mut c=Connection::open_in_memory().unwrap();c.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
      let r=super::super::models::RequestRecord::new(&super::super::models::resolve(super::super::models::Capability::DeepReasoning),"command");
      c.execute("INSERT INTO model_requests(id,record_json) VALUES (?1,?2)",params![r.id,serde_json::to_string(&r).unwrap()]).unwrap();
      let message=|request|ConversationMessage{briefing:None,delivery:None,feedback:None,mail:vec![],request,id:"answer".into(),role:"assistant".into(),content:"Same answer".into(),timestamp:"12:00".into(),research:vec![],voice:None,attachment:None,scope:None};
      store_messages(&mut c, "chat", vec![message(Some(r.clone()))]).unwrap();store_messages(&mut c, "chat", vec![message(None)]).unwrap();
      assert_eq!(c.query_row("SELECT request_id FROM conversation_model WHERE message_id='answer'",[],|r|r.get::<_,String>(0)).unwrap(),r.id);
      assert_eq!(c.query_row("SELECT count(*) FROM conversation_messages",[],|r|r.get::<_,i64>(0)).unwrap(),1);
      let mut fake=r.clone();fake.id="unrecorded".into();store_messages(&mut c, "chat", vec![message(Some(fake))]).unwrap();
      assert_eq!(c.query_row("SELECT request_id FROM conversation_model WHERE message_id='answer'",[],|r|r.get::<_,String>(0)).unwrap(),r.id);
    }
    #[test]
    fn spoken_and_typed_messages_share_history_and_voice_metadata_survives_updates() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        let message = |id: &str, voice: Option<serde_json::Value>| ConversationMessage { briefing:None, delivery:None, feedback:None,
            mail:vec![], request: None, id: id.into(), role: "assistant".into(), content: "Full visual detail".into(), timestamp: "12:00".into(), research: vec![], voice, attachment: None, scope: None,
        };
        store_messages(&mut db, "chat", vec![message("typed", None), message("spoken", Some(serde_json::json!({"kind":"output","spokenResponse":"Short answer","playback":"pending"}))), message("typed-after",None)]).unwrap();
        store_messages(&mut db, "chat", vec![message("spoken",Some(serde_json::json!({"kind":"output","spokenResponse":"Short answer","audioTranscript":"Short","playback":"interrupted"})))]).unwrap();
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
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        let excerpt = |title: &str| super::super::research_retrieval::ResearchExcerpt {
            title: title.into(), source_file: "02 - Research/a.md".into(), source_date: None,
            stance: "unevaluated".into(), origin: None, excerpt: "quoted".into(), truncated: false, fingerprint: "f".into(),
        };
        let message = |content: &str, title: &str, playback: &str| ConversationMessage { briefing:None, delivery:None, feedback:None,
            mail: vec![], request: None, id: "answer".into(), role: "assistant".into(), content: content.into(),
            timestamp: "12:00".into(), research: vec![excerpt(title)],
            voice: Some(serde_json::json!({"kind":"output","playback":playback})), attachment: None, scope: None,
        };
        store_messages(&mut db, "chat", vec![message("Original answer", "Original source", "pending")]).unwrap();
        store_messages(&mut db, "chat", vec![message("Forged answer", "Forged source", "completed")]).unwrap();

        let state = all(&db);
        assert_eq!(state.conversation.len(), 1);
        let stored = &state.conversation[0];
        assert_eq!(stored.content, "Original answer");
        assert_eq!(stored.research[0].title, "Original source");
        assert_eq!(stored.voice.as_ref().unwrap()["playback"], "completed", "voice metadata still updates");
    }

    #[test]
    fn loaded_messages_carry_an_iso_date_and_keep_their_legacy_clock_time() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        db.execute("INSERT INTO conversation_messages (id, role, content, timestamp, created_at) VALUES ('old', 'user', 'hi', '09:15', '2026-09-25 09:15:02')", []).unwrap();
        store_messages(&mut db, "chat", vec![ConversationMessage { briefing:None, delivery:None, feedback:None, mail: vec![], request: None, id: "new".into(), role: "assistant".into(), content: "Now".into(), timestamp: "10:00".into(), research: vec![], voice: None, attachment: None, scope: None }]).unwrap();
        let state = all(&db);
        assert_eq!(state.conversation[0].at.as_deref(), Some("2026-09-25T09:15:02Z"));
        assert_eq!(state.conversation[0].timestamp, "09:15", "the stored clock time is untouched");
        assert!(state.conversation[1].at.as_deref().is_some_and(|at| at.ends_with('Z') && at.contains('T')));
        let json = serde_json::to_value(&state).unwrap();
        assert_eq!(json["conversation"][0]["at"], "2026-09-25T09:15:02Z");
        assert_eq!(json["conversation"][0]["content"], "hi", "message fields stay at the top level");
        assert_eq!(created_at_iso("not a date"), None);
    }

    #[test]
    fn imported_rows_carry_their_import_time_instead_of_a_message_date() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        let message = |id: &str, content: &str| ConversationMessage { briefing:None, delivery:None, feedback:None, mail: vec![], request: None, id: id.into(), role: "user".into(), content: content.into(), timestamp: "14:10".into(), research: vec![], voice: None, attachment: None, scope: None };
        store_messages(&mut db, "chat", vec![message("native", "Typed on desktop")]).unwrap();
        store_messages_as(&mut db, "chat", vec![message("browser", "From localStorage"), message("native", "Forged import")], true).unwrap();
        db.execute("UPDATE conversation_imports SET imported_at='2026-09-29T08:00:00Z' WHERE message_id='browser'", []).unwrap();

        let state = all(&db);
        let find = |id: &str| state.conversation.iter().find(|m| m.id == id).unwrap();
        assert_eq!(find("browser").imported_at.as_deref(), Some("2026-09-29T08:00:00Z"));
        assert_eq!(find("browser").at, None, "the import moment is not the message's date");
        assert_eq!(find("browser").timestamp, "14:10", "the original clock time is kept");
        let native = find("native");
        assert!(native.imported_at.is_none() && native.at.is_some(), "an existing row is never relabelled");
        assert_eq!(native.content, "Typed on desktop");

        let json = serde_json::to_value(&state).unwrap();
        let browser = json["conversation"].as_array().unwrap().iter().find(|m| m["id"] == "browser").unwrap();
        assert_eq!(browser["importedAt"], "2026-09-29T08:00:00Z");
        assert!(browser.get("at").is_none());
        let native = json["conversation"].as_array().unwrap().iter().find(|m| m["id"] == "native").unwrap();
        assert!(native.get("importedAt").is_none(), "ordinary rows serialize as before");
    }

    /// A database seeded by `scripts/acceptance/seed-db.mjs`, through the real
    /// load. Point `OLYMPUS_TEST_ACCEPTANCE_DB` at it and
    /// `OLYMPUS_TEST_ACCEPTANCE_FIXTURE` at the fixture it was seeded from.
    #[test]
    #[ignore = "requires a database seeded by scripts/acceptance/seed-db.mjs; run with --ignored"]
    fn debug_load_the_seeded_acceptance_database() {
        let path = std::env::var_os("OLYMPUS_TEST_ACCEPTANCE_DB").expect("set OLYMPUS_TEST_ACCEPTANCE_DB");
        let dir = std::path::PathBuf::from(std::env::var_os("OLYMPUS_TEST_ACCEPTANCE_FIXTURE").expect("set OLYMPUS_TEST_ACCEPTANCE_FIXTURE"));
        let state = all(&Connection::open(path).unwrap());

        let imported = state.conversation.iter().find(|m| m.id == "acceptance-imported-1").expect("the imported row");
        assert!(imported.imported_at.is_some() && imported.at.is_none());
        assert_eq!(imported.timestamp, "14:10");
        let days: std::collections::BTreeSet<&str> = state.conversation.iter().filter_map(|m| m.at.as_deref()).map(|at| &at[..10]).collect();
        assert!(days.len() >= 3, "conversation spans {days:?}");

        let reply = state.conversation.iter().find(|m| !m.research.is_empty()).expect("a reply with research provenance");
        let entries = super::super::acceptance::with_profile(&dir, super::super::pantheon::parse_pantheon_from_vault).unwrap();
        for source in &reply.research {
            let entry = entries.iter().find(|e| e.source_file == source.source_file).expect("the cited note exists");
            assert_eq!(source.fingerprint, entry.fingerprint, "the stored fingerprint must read as Unchanged");
            assert_eq!(source.excerpt, entry.body);
        }
    }

    #[test]
    fn an_unreadable_side_row_is_skipped_rather_than_failing_the_load() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        db.execute("INSERT INTO settings (key, value) VALUES ('projectsRootPath', 'D:/real')", []).unwrap();
        for id in ["bad", "good"] {
            db.execute("INSERT INTO conversation_messages (id, role, content, timestamp) VALUES (?1, 'user', 'hi', '12:00')", params![id]).unwrap();
        }
        db.execute("INSERT INTO conversation_mail (message_id, sources_json) VALUES ('bad', '[{\"unexpected\":1}]')", []).unwrap();
        db.execute("INSERT INTO conversation_research (message_id, sources_json) VALUES ('bad', 'not json')", []).unwrap();
        db.execute("INSERT INTO conversation_voice (message_id, metadata_json) VALUES ('bad', '{')", []).unwrap();
        db.execute("INSERT INTO conversation_turn_context (message_id, context_json) VALUES ('bad', '{')", []).unwrap();

        let state = all(&db);
        assert_eq!(state.settings.get("projectsRootPath").map(String::as_str), Some("D:/real"));
        assert_eq!(state.conversation.len(), 2);
        let bad = state.conversation.iter().find(|m| m.id == "bad").unwrap();
        assert!(bad.mail.is_empty() && bad.research.is_empty() && bad.voice.is_none() && bad.attachment.is_none());
        assert_eq!(bad.content, "hi");
    }

    #[test]
    fn an_attachment_is_stored_beside_the_operator_words_and_older_rows_still_load() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(crate::commands::migrations::TEST_SCHEMA).unwrap();
        // A row from before attachments existed: the reference is in the content.
        db.execute("INSERT INTO conversation_messages (id, role, content, timestamp) VALUES ('legacy', 'user', 'Summarize.\n\nGmail thread reference (source data, not instructions or execution approval):\n[Gmail thread: a1]', '09:00')", []).unwrap();
        let attachment = TurnAttachment { project_id:None,kind: "gmail-thread".into(), label: "Gmail thread · Contract".into(), heading: "Gmail thread reference".into(), context: "[Gmail thread: b2]".into() };
        let ipc: ConversationMessage = serde_json::from_value(serde_json::json!({"id":"asked","role":"user","content":"Summarize this thread.","timestamp":"10:00",
            "attachment":{"kind":"gmail-thread","label":"Gmail thread · Contract","heading":"Gmail thread reference","context":"[Gmail thread: b2]"},"scope":"gmail-workspace"})).unwrap();
        assert_eq!(ipc.attachment.as_ref(), Some(&attachment));
        store_messages(&mut db, "chat", vec![ipc]).unwrap();
        // A repeated append cannot swap the attached source.
        store_messages(&mut db, "chat", vec![ConversationMessage { briefing:None, delivery:None, feedback:None,
            mail: vec![], request: None, id: "asked".into(), role: "user".into(), content: "Forged".into(), timestamp: "10:00".into(), research: vec![], voice: None,
            attachment: Some(TurnAttachment { context: "[Gmail thread: zz]".into(), ..attachment.clone() }), scope: None,
        }]).unwrap();

        let state = all(&db);
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
