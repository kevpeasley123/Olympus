//! Backend-owned capability routing and prompt-free request diagnostics.
use super::persistence::Db;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

pub const PRIMARY_MODEL: &str = "gpt-6-sol";
pub const DEEP_MODEL: &str = "gpt-6-astra";
pub const CLAUDE_MODEL: &str = "claude-opus-5";
pub const REALTIME_MODEL: &str = "gpt-realtime-2.1";
pub const TRANSCRIPTION_MODEL: &str = "gpt-4o-mini-transcribe";
pub const CODING_MODEL: &str = "sonnet";

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Capability {
    #[default]
    Primary,
    DeepReasoning,
    ClaudeComparison,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub capability: Capability,
    pub provider: &'static str,
    pub model: &'static str,
    pub effort: &'static str,
    pub label: &'static str,
}
pub fn resolve(capability: Capability) -> Route {
    match capability {
        Capability::Primary => Route {
            capability,
            provider: "openai",
            model: PRIMARY_MODEL,
            effort: "medium",
            label: "Sol",
        },
        Capability::DeepReasoning => Route {
            capability,
            provider: "openai",
            model: DEEP_MODEL,
            effort: "high",
            label: "Astra · Deep Analysis",
        },
        Capability::ClaudeComparison => Route {
            capability,
            provider: "anthropic",
            model: CLAUDE_MODEL,
            effort: "medium",
            label: "Claude · Comparison",
        },
    }
}
#[tauri::command]
pub fn model_routes() -> Value {
    json!({"routes":[resolve(Capability::Primary),resolve(Capability::DeepReasoning),resolve(Capability::ClaudeComparison)],"realtime":REALTIME_MODEL,"transcription":TRANSCRIPTION_MODEL,"coding":CODING_MODEL})
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestRecord {
    pub id: String,
    pub provider: String,
    pub requested_model: String,
    pub actual_model: Option<String>,
    pub capability: String,
    pub purpose: String,
    pub reasoning_effort: Option<String>,
    pub requested_at: String,
    pub latency_ms: Option<u64>,
    pub first_token_ms: Option<u64>,
    pub status: String,
    pub fallback_from: Option<String>,
    pub escalation_reason: Option<String>,
    pub usage: Option<Value>,
    pub error_code: Option<String>,
}
impl RequestRecord {
    pub fn new(route: &Route, purpose: &str) -> Self {
        static SERIAL: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
        Self {
            id: format!(
                "model-{}-{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default(),
                SERIAL.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ),
            provider: route.provider.into(),
            requested_model: route.model.into(),
            actual_model: None,
            capability: serde_json::to_value(route.capability)
                .unwrap()
                .as_str()
                .unwrap()
                .into(),
            purpose: purpose.into(),
            reasoning_effort: Some(route.effort.into()),
            requested_at: chrono::Utc::now().to_rfc3339(),
            latency_ms: None,
            first_token_ms: None,
            status: "started".into(),
            fallback_from: None,
            escalation_reason: if route.capability == Capability::DeepReasoning {
                Some("Operator selected Deep Analysis".into())
            } else {
                None
            },
            usage: None,
            error_code: None,
        }
    }
}
pub fn save(db: &Db, record: &RequestRecord) -> Result<(), String> {
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    connection.execute("INSERT INTO model_requests(id,record_json) VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET record_json=excluded.record_json WHERE json_extract(model_requests.record_json,'$.status')='started' OR json_extract(excluded.record_json,'$.status')!='started'",params![record.id,serde_json::to_string(record).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn model_diagnostics(db: State<Db>) -> Result<Vec<RequestRecord>, String> {
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    let mut query = connection
        .prepare("SELECT record_json FROM model_requests ORDER BY rowid DESC LIMIT 100")
        .map_err(|e| e.to_string())?;
    let rows = query
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    })
    .collect()
}

// WebRTC inference happens in the webview. Its transport reports bounded metadata,
// never transcripts, to this command. Mark these records as client-reported.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VoiceTelemetry {
    pub id: String,
    pub kind: String,
    pub started_at: String,
    pub latency_ms: u64,
    pub status: String,
    pub usage: Option<Value>,
}
fn numeric_usage(value: &Value, depth: usize) -> Option<Value> {
    if depth > 4 {
        return None;
    }
    if value.is_number() {
        return Some(value.clone());
    }
    let object = value.as_object()?;
    let mut clean = serde_json::Map::new();
    for (key, value) in object.iter().take(30) {
        if key.len() <= 64 && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            if let Some(value) = numeric_usage(value, depth + 1) {
                clean.insert(key.clone(), value);
            }
        }
    }
    Some(Value::Object(clean))
}
#[tauri::command]
pub fn record_voice_request(db: State<Db>, event: VoiceTelemetry) -> Result<(), String> {
    if event.id.len() > 100
        || !event.id.starts_with("voice-")
        || !["audio", "preview", "transcription"].contains(&event.kind.as_str())
        || !["started", "completed", "failed", "interrupted"].contains(&event.status.as_str())
        || event.latency_ms > 3_600_000
        || chrono::DateTime::parse_from_rfc3339(&event.started_at).is_err()
    {
        return Err("Invalid voice diagnostic metadata".into());
    }
    let mut record = RequestRecord::new(
        &resolve(Capability::Primary),
        &format!("{}_client_reported", event.kind),
    );
    record.id = event.id;
    record.requested_at = event.started_at;
    record.requested_model = if event.kind == "transcription" {
        TRANSCRIPTION_MODEL
    } else {
        REALTIME_MODEL
    }
    .into();
    record.capability = if event.kind == "transcription" {
        "TRANSCRIPTION"
    } else {
        "REALTIME"
    }
    .into();
    record.reasoning_effort = None;
    record.latency_ms = Some(event.latency_ms);
    record.status = event.status;
    record.usage = event.usage.as_ref().and_then(|v| numeric_usage(v, 0));
    save(db.inner(), &record)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn routes_are_explicit_and_closed() {
        assert_eq!(resolve(Capability::default()).model, PRIMARY_MODEL);
        assert_eq!(resolve(Capability::DeepReasoning).model, DEEP_MODEL);
        assert!(serde_json::from_str::<Capability>("\"BACKGROUND\"").is_err());
    }
    #[test]
    fn records_round_trip_without_prompts() {
        let db = Db(std::sync::Mutex::new(
            rusqlite::Connection::open_in_memory().unwrap(),
        ));
        db.0.lock()
            .unwrap()
            .execute_batch(include_str!("../../schema.sql"))
            .unwrap();
        let mut r = RequestRecord::new(&resolve(Capability::DeepReasoning), "voice_reasoning");
        save(&db, &r).unwrap();
        r.status = "completed".into();
        save(&db, &r).unwrap();
        let c = db.0.lock().unwrap();
        assert_eq!(
            c.query_row("SELECT count(*) FROM model_requests", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            1
        );
        let raw: String = c
            .query_row("SELECT record_json FROM model_requests", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(
            serde_json::from_str::<RequestRecord>(&raw).unwrap().status,
            "completed"
        );
        assert!(!raw.contains("prompt"));
    }
}
