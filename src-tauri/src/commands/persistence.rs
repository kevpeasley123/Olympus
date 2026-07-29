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
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub settings: HashMap<String, String>,
    pub tool_states: Vec<ToolState>,
    pub conversation: Vec<ConversationMessage>,
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
/// React StrictMode mounts effects twice in development. The frontend keeps one
/// UUID for the page lifetime, and the primary key makes both invocations
/// resolve to the same session rather than advancing the boundary twice.
#[tauri::command]
pub fn begin_operator_session(
    db: State<Db>,
    request: BeginSessionRequest,
) -> Result<SessionBoundary, String> {
    begin_operator_session_in(db.inner(), &request.session_id)
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

    // The boundary history is operational evidence, not an audit archive.
    // Keeping the latest 100 sessions is ample while preventing unbounded rows.
    transaction
        .execute(
            "DELETE FROM operator_sessions WHERE id NOT IN \
             (SELECT id FROM operator_sessions ORDER BY started_at DESC LIMIT 100)",
            [],
        )
        .map_err(|error| error.to_string())?;

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

#[tauri::command]
pub fn load_persisted_state(db: State<Db>) -> Result<PersistedState, String> {
    let connection = locked(&db)?;

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
            "SELECT id, role, content, timestamp FROM conversation_messages \
             ORDER BY created_at ASC, rowid ASC",
        )
        .map_err(|error| error.to_string())?;
    let conversation = conversation_query
        .query_map([], |row| {
            Ok(ConversationMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<ConversationMessage>, _>>()
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
    let transaction = connection.transaction().map_err(|e| e.to_string())?;

    for message in messages {
        transaction
            .execute(
                "INSERT INTO conversation_messages (id, role, content, timestamp) \
                 VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(id) DO UPDATE SET \
                   role = excluded.role, content = excluded.content, timestamp = excluded.timestamp",
                params![message.id, message.role, message.content, message.timestamp],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_conversation(db: State<Db>) -> Result<(), String> {
    let connection = locked(&db)?;
    connection
        .execute("DELETE FROM conversation_messages", [])
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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
