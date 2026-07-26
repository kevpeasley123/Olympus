use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::{params, Connection};
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

/// The guard borrows from the managed state, not from the `&State` handle, so
/// its lifetime is tied to the state's own `'a` rather than the local borrow.
fn locked<'a>(db: &State<'a, Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    db.inner().0.lock().map_err(|error| error.to_string())
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
