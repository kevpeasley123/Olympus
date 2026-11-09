//! Operator-confirmed no-extra-usage policy, bound to provider-reported account metadata.
use std::path::Path;
use serde_json::{json, Value};
const FILE: &str = "codex-subscription-authorization.json";
const STATEMENT: &str = "Paid extra usage and automatic credit purchases are disabled for this ChatGPT account.";
const BLOCKED: &str = "Confirm that paid extra usage and automatic credit purchases are disabled in Preferences > Subscription engines. No provider request or fallback was started.";

pub(crate) fn identity(value: &Value) -> Result<Value, String> {
    if value["type"] != "chatgpt" { return Err("Codex must use a ChatGPT subscription sign-in; API billing is not allowed.".into()); }
    let email = value["email"].as_str().filter(|s| !s.is_empty() && s.len() <= 320).ok_or("Codex account identity is missing")?;
    let plan = value["planType"].as_str().filter(|s| !s.is_empty() && s.len() <= 100).ok_or("Codex subscription plan is missing")?;
    let workspace = match &value["workspaceName"] { Value::Null => Value::Null, Value::String(s) if s.len() <= 320 => json!(s), _ => return Err("Invalid Codex workspace identity".into()) };
    Ok(json!({"type":"chatgpt","email":email,"planType":plan,"workspaceName":workspace}))
}
fn load(dir: &Path) -> Result<Value, String> {
    identity(&load_record(dir)?["account"])
}
fn load_record(dir: &Path) -> Result<Value, String> {
    let path = dir.join(FILE);
    if std::fs::metadata(&path).map_err(|_| BLOCKED)?.len() > 16384 { return Err(BLOCKED.into()); }
    let record: Value = serde_json::from_slice(&std::fs::read(path).map_err(|_| BLOCKED)?).map_err(|_| BLOCKED)?;
    if record["statement"] != STATEMENT { return Err(BLOCKED.into()); }
    identity(&record["account"])?;
    Ok(record)
}
/// Fingerprint the saved statement, account metadata and confirmation revision.
pub(crate) fn confirmed_binding() -> Result<String,String> {
    if super::acceptance::active() {return Err(BLOCKED.into());}
    let record=load_record(super::subscription_jobs::app_data()?)?;
    Ok(super::vault_write::content_fingerprint(&record.to_string()))
}
pub(crate) fn confirmed_account() -> Result<Value, String> {
    if super::acceptance::active() { return Err("Synthetic acceptance cannot authorize a Codex subscription account".into()); }
    load(super::subscription_jobs::app_data().map_err(|_| BLOCKED)?)
}
pub(crate) fn confirm_at(dir: &Path, statement: &str) -> Result<Value, String> {
    if statement != STATEMENT || super::acceptance::active() { return Err(BLOCKED.into()); }
    let account = super::subscription::read_account_identity()?;
    let record = json!({"statement":STATEMENT,"account":account,"confirmedAt":chrono::Utc::now().to_rfc3339()});
    std::fs::create_dir_all(dir).map_err(|_| "Could not save Codex confirmation")?;
    std::fs::write(dir.join(FILE), serde_json::to_vec(&record).map_err(|_| "Could not encode confirmation")?).map_err(|_| "Could not save Codex confirmation")?;
    Ok(status_at(dir))
}
fn status_at(dir: &Path) -> Value {
    let account = load(dir).ok();
    json!({"statement":STATEMENT,"confirmed":account.is_some(),"email":account.and_then(|a|a["email"].as_str().map(str::to_owned))})
}
#[tauri::command]
pub fn codex_subscription_authorization(app: tauri::AppHandle) -> Result<Value,String> {
    use tauri::Manager;
    Ok(status_at(&app.path().app_data_dir().map_err(|_| "Olympus data folder unavailable")?))
}
#[tauri::command]
pub async fn confirm_codex_subscription(app: tauri::AppHandle, statement: String) -> Result<Value,String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|_| "Olympus data folder unavailable")?;
    tauri::async_runtime::spawn_blocking(move || confirm_at(&dir, &statement)).await.map_err(|_| "Codex confirmation worker failed")?
}
#[tauri::command]
pub fn revoke_codex_subscription(app: tauri::AppHandle) -> Result<Value,String> {
    use tauri::Manager;
    if super::acceptance::active() { return Err("Acceptance cannot alter account confirmation".into()); }
    let dir = app.path().app_data_dir().map_err(|_| "Olympus data folder unavailable")?;
    match std::fs::remove_file(dir.join(FILE)) { Ok(()) => {}, Err(e) if e.kind()==std::io::ErrorKind::NotFound => {}, Err(_) => return Err("Could not withdraw Codex confirmation".into()) }
    Ok(status_at(&dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn metadata_never_accepts_api_or_missing_identity() {
        assert!(identity(&json!({"type":"apiKey"})).is_err());
        assert!(identity(&json!({"type":"chatgpt","planType":"pro"})).is_err());
        assert!(identity(&json!({"type":"chatgpt","email":"fixture@example.com","planType":"pro"})).is_ok());
    }
    #[test] fn missing_confirmation_is_not_authority() {
        assert!(load(&std::env::temp_dir().join(super::super::delegation::run_id())).is_err());
    }
    #[test]
    #[ignore = "Explicit operator confirmation already provided in this session; binds current provider account"]
    fn live_record_operator_confirmation() {
        assert_eq!(std::env::var("OLYMPUS_CONFIRM_CODEX_NO_EXTRAS").as_deref(), Ok("operator-confirmed"));
        let dir=std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap()).join("com.projectolympus.commandstation");
        let status=confirm_at(&dir,STATEMENT).unwrap();
        assert_eq!(status["confirmed"],true);
        println!("Codex operator confirmation saved for current subscription account; no generation requested.");
    }
    #[test]
    #[ignore = "Explicit subscription generation acceptance using saved operator confirmation"]
    fn live_account_bound_codex_generation() {
        assert_eq!(std::env::var("OLYMPUS_CODEX_PRODUCTION_ACCEPTANCE").as_deref(),Ok("saved-confirmation"));
        let dir=std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap()).join("com.projectolympus.commandstation");
        let _=super::super::subscription_jobs::APP_DATA_FOR_TESTS.set(dir);
        let (text,model)=super::super::subscription::run_job("Reply with the exact requested text only.","Reply OLYMPUS_OK".into(),std::time::Duration::from_secs(90)).unwrap();
        assert_eq!(text.trim(),"OLYMPUS_OK");
        assert_eq!(model,super::super::subscription::model_id());
        println!("Account-bound production Codex job completed; subscription identity and allowance checked before prompt.");
    }
}
