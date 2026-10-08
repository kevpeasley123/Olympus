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
    /// Caps reasoning and answer together on every provider here, so a
    /// higher-effort route needs more room or it ends `incomplete` on exactly
    /// the requests the operator chose to pay more for.
    pub max_output_tokens: u32,
}
pub fn resolve(capability: Capability) -> Route {
    match capability {
        Capability::Primary => Route {
            capability,
            provider: "openai",
            model: PRIMARY_MODEL,
            effort: "medium",
            label: "Sol",
            max_output_tokens: 8_000,
        },
        Capability::DeepReasoning => Route {
            capability,
            provider: "openai",
            model: DEEP_MODEL,
            effort: "high",
            label: "Astra · Deep Analysis",
            max_output_tokens: 32_000,
        },
        Capability::ClaudeComparison => Route {
            capability,
            provider: "anthropic",
            model: CLAUDE_MODEL,
            effort: "medium",
            label: "Claude · Comparison",
            // Streamed, and thinking shares `max_tokens` with the answer.
            max_output_tokens: 64_000,
        },
    }
}
/// Picker metadata is separate from execution routing. Availability means configured,
/// not a promise that provider credits or the remote service are healthy.
fn picker_route(capability: Capability, configured: bool) -> Value {
    let route = resolve(capability);
    let (label, description, provider_label) = match capability {
        Capability::Primary => ("Sol", "Everyday reasoning", "OpenAI"),
        Capability::DeepReasoning => ("Astra", "Deeper analysis", "OpenAI"),
        Capability::ClaudeComparison => ("Claude", "Another perspective", "Anthropic"),
    };
    let mut value = serde_json::to_value(&route).expect("serializable route");
    value["label"] = json!(label);
    value["description"] = json!(description);
    value["providerLabel"] = json!(provider_label);
    value["available"] = json!(configured);
    value["unavailableReason"] = if configured { Value::Null } else { json!(format!("{provider_label} is not configured in this desktop app.")) };
    value
}
fn configured(capability: Capability) -> bool {
    let key = if capability == Capability::ClaudeComparison { "ANTHROPIC_API_KEY" } else { "OPENAI_API_KEY" };
    std::env::var(key).is_ok_and(|value| !value.trim().is_empty())
}
const SELECTION_KEY: &str = "conversationModelSelection";
#[tauri::command]
pub fn model_routes(db: State<Db>) -> Result<Value, String> {
    let connection = db.0.lock().map_err(|_| "Model catalog unavailable")?;
    let saved = connection.query_row("SELECT value FROM settings WHERE key=?1", [SELECTION_KEY], |row| row.get::<_,String>(0));
    let selection = match saved {
        Ok(text) => serde_json::from_str::<Value>(&text).map_err(|_| "Saved model selection is invalid")?,
        Err(rusqlite::Error::QueryReturnedNoRows) => Value::Null,
        Err(_) => return Err("Saved model selection unavailable".into()),
    };
    Ok(json!({"routes":[picker_route(Capability::Primary,configured(Capability::Primary)),picker_route(Capability::DeepReasoning,configured(Capability::DeepReasoning)),picker_route(Capability::ClaudeComparison,configured(Capability::ClaudeComparison))],"defaultCapability":"PRIMARY","selection":selection,"realtime":REALTIME_MODEL,"transcription":TRANSCRIPTION_MODEL,"coding":CODING_MODEL}))
}
fn store_selection(connection: &rusqlite::Connection, capability: Capability, scope: &str) -> Result<(), String> {
    match scope {
        "chat" => { connection.execute("INSERT INTO settings(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![SELECTION_KEY,json!({"capability":capability,"scope":"chat"}).to_string()]).map_err(|_| "Could not save model selection")?; },
        "next" => { connection.execute("DELETE FROM settings WHERE key=?1",[SELECTION_KEY]).map_err(|_| "Could not save model selection")?; },
        _ => return Err("Unknown selection scope".into()),
    }
    Ok(())
}
#[tauri::command]
pub fn save_model_selection(db: State<Db>, capability: Capability, scope: String) -> Result<(), String> {
    if !configured(capability) { return Err("This model is not configured. Choose an available model.".into()); }
    let connection = db.0.lock().map_err(|_| "Model selection unavailable")?;
    store_selection(&connection,capability,&scope)
}
#[cfg(test)]
mod picker_tests {
    use super::*;
    #[test] fn catalog_reports_unavailability_without_substitution() {
        for cap in [Capability::Primary,Capability::DeepReasoning,Capability::ClaudeComparison] {
            let yes=picker_route(cap,true);let no=picker_route(cap,false);
            assert_eq!(yes["model"],no["model"]);
            assert_eq!(yes["available"],true);assert_eq!(no["available"],false);
            assert!(no["unavailableReason"].as_str().unwrap().contains("not configured"));
            assert!(!yes["description"].as_str().unwrap().is_empty());
        }
    }
    #[test] fn chat_selection_is_saved_and_next_answer_removes_it() {
        let db=rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch(include_str!("../../schema.sql")).unwrap();
        store_selection(&db,Capability::DeepReasoning,"chat").unwrap();
        let text:String=db.query_row("SELECT value FROM settings WHERE key=?1",[SELECTION_KEY],|r|r.get(0)).unwrap();
        assert_eq!(serde_json::from_str::<Value>(&text).unwrap()["capability"],"DEEP_REASONING");
        assert!(store_selection(&db,Capability::Primary,"forever").is_err());
        store_selection(&db,Capability::Primary,"next").unwrap();
        assert_eq!(db.query_row("SELECT count(*) FROM settings WHERE key=?1",[SELECTION_KEY],|r|r.get::<_,i64>(0)).unwrap(),0);
    }
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
    fn deeper_routes_get_a_larger_output_budget() {
        let primary = resolve(Capability::Primary).max_output_tokens;
        assert!(resolve(Capability::DeepReasoning).max_output_tokens > primary);
        assert!(resolve(Capability::ClaudeComparison).max_output_tokens > primary);
        // Opus 5 streaming ceiling.
        assert!(resolve(Capability::ClaudeComparison).max_output_tokens <= 128_000);
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
