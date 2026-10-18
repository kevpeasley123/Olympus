//! Explicit account reads only. No login, turn, reset, or billing mutations.
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read, Write},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};
fn empty(provider: &str) -> Value {
    json!({"provider":provider,"capabilityCategory":if provider=="ElevenLabs"{"apis-services"}else{"models-subscriptions"},"scope":"Account","source":if provider=="Codex"{"Codex app-server account/rateLimits/read"}else{"ElevenLabs GET /v1/user/subscription"},"observedAt":null,"windows":[],"balance":null,"ytdConsumption":null,"ytdSpend":null,"status":"failed"})
}
fn number(v: &Value) -> Option<f64> {
    v.as_f64().filter(|n| n.is_finite() && *n >= 0.0)
}
fn timestamp(v: &Value) -> Option<String> {
    chrono::DateTime::from_timestamp(v.as_i64()?, 0).map(|t| t.to_rfc3339())
}
fn metric(value: f64, unit: &str, period: &str) -> Value {
    json!({"value":value,"unit":unit,"period":period})
}
fn normalize(provider: &str, value: &Value) -> Result<Value, String> {
    let mut s = empty(provider);
    let mut windows = vec![];
    if provider == "ElevenLabs" {
        let used =
            number(&value["character_count"]).ok_or("Quota response omitted characters used.")?;
        let limit = number(&value["character_limit"])
            .ok_or("Quota response omitted character allowance.")?;
        let remaining = (limit - used).max(0.0);
        s["balance"] = metric(remaining, "characters", "Current billing period remaining");
        s["consumption"] = metric(used, "characters", "Current billing period");
        windows.push(json!({"label":"Billing period","remaining":if limit>0.0{metric(remaining/limit*100.0,"%","Current billing period")}else{Value::Null},"resetsAt":timestamp(&value["next_character_count_reset_unix"])}));
    } else {
        let buckets: Vec<(&str, &Value)> =
            if let Some(map) = value["rateLimitsByLimitId"].as_object() {
                map.iter().take(16).map(|(k, v)| (k.as_str(), v)).collect()
            } else {
                vec![("Codex", &value["rateLimits"])]
            };
        for (name, bucket) in buckets {
            for kind in ["primary", "secondary"] {
                let w = &bucket[kind];
                if let Some(used) = number(&w["usedPercent"]) {
                    let period = w["windowDurationMins"]
                        .as_u64()
                        .filter(|n| *n > 0)
                        .map(|n| format!("{} min window", n))
                        .unwrap_or_else(|| kind.into());
                    windows.push(json!({"label":format!("{} · {}",name.chars().take(80).collect::<String>(),period),"remaining":metric((100.0-used).clamp(0.0,100.0),"%",&period),"resetsAt":timestamp(&w["resetsAt"])}));
                }
            }
        }
        if windows.is_empty() {
            return Err("Codex returned no account allowance windows.".into());
        }
        let bucket = value["rateLimitsByLimitId"]
            .get("codex")
            .unwrap_or(&value["rateLimits"]);
        let credits = &bucket["credits"];
        if credits["unlimited"] != true {
            let balance = number(&credits["balance"]).or_else(|| {
                credits["balance"]
                    .as_str()?
                    .parse::<f64>()
                    .ok()
                    .filter(|n| n.is_finite() && *n >= 0.0)
            });
            if let Some(balance) = balance {
                s["balance"] = metric(balance, "credits", "Account usage credits");
            }
        }
    }
    s["windows"] = json!(windows);
    s["status"] = json!("ready");
    s["observedAt"] = json!(chrono::Utc::now().to_rfc3339());
    Ok(s)
}
const PROXY_UNAVAILABLE: &str =
    "Codex quota reader could not connect. No login, daemon or model turn was started.";
const DISABLED_FEATURES: &[&str] = &[
    "apps",
    "plugins",
    "remote_plugin",
    "hooks",
    "code_mode_host",
    "daemon_auto_start",
    "skill_mcp_dependency_install",
];
fn isolation_args(inventory: &Value) -> Result<Vec<String>, String> {
    let rows = inventory
        .as_array()
        .filter(|r| r.len() <= 64)
        .ok_or("Codex integration inventory is unavailable.")?;
    let mut args = Vec::new();
    for feature in DISABLED_FEATURES {
        args.extend(["--disable".into(), (*feature).into()]);
    }
    for row in rows {
        let name = row["name"]
            .as_str()
            .filter(|n| {
                !n.is_empty()
                    && n.len() <= 128
                    && n.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            })
            .ok_or("Codex integration name cannot be safely isolated.")?;
        // Codex's dotted override parser treats quoted segments as literal names.
        args.extend(["-c".into(), format!("mcp_servers.{name}.enabled=false")]);
    }
    args.extend(["-c".into(), "analytics.enabled=false".into()]);
    Ok(args)
}
fn isolation_verified(inventory: &Value, features: &str) -> bool {
    inventory
        .as_array()
        .is_some_and(|rows| rows.len() <= 64 && rows.iter().all(|row| row["enabled"] == false))
        && DISABLED_FEATURES.iter().all(|name| {
            features.lines().any(|line| {
                let words: Vec<_> = line.split_whitespace().collect();
                words.first() == Some(name) && words.last() == Some(&"false")
            })
        })
}
// Metadata commands never connect MCP servers. Their raw output is bounded,
// consumed in memory and never logged or sent to the frontend.
fn metadata(mut command: Command) -> Result<String, String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|_| "Codex metadata command could not start.")?;
    let output = child
        .stdout
        .take()
        .ok_or("Codex metadata output unavailable.")?;
    let (send, recv) = mpsc::sync_channel(1);
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = output.take(262145).read_to_end(&mut bytes);
        let _ = send.send((result, bytes));
    });
    let deadline = Instant::now() + Duration::from_secs(5);
    let result = (|| {
        let (read, bytes) = recv
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Codex metadata check timed out.")?;
        read.map_err(|_| "Codex metadata could not be read.")?;
        if bytes.len() > 262144 {
            return Err("Codex metadata exceeds the size limit.");
        }
        loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|_| "Codex metadata process failed.")?
            {
                if !status.success() {
                    return Err("Codex metadata command failed.");
                }
                return String::from_utf8(bytes).map_err(|_| "Codex metadata is invalid.");
            }
            if Instant::now() >= deadline {
                return Err("Codex metadata check timed out.");
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    })();
    let _ = child.kill();
    let _ = child.wait();
    result.map_err(str::to_string)
}
struct QuotaDirectory(std::path::PathBuf);
impl Drop for QuotaDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir(&self.0);
    }
}
fn codex_read() -> Result<Value, String> {
    let executable = super::engines::codex_executable()?;
    let mut nonce = [0u8; 16];
    getrandom::getrandom(&mut nonce).map_err(|_| "Quota workspace unavailable.")?;
    let suffix: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
    let directory =
        QuotaDirectory(std::env::temp_dir().join(format!("olympus-codex-quota-{suffix}")));
    std::fs::create_dir(&directory.0).map_err(|_| "Quota workspace could not be created.")?;
    let command = |arguments: &[&str], isolation: &[String]| {
        let mut c = Command::new(&executable);
        c.args(arguments).args(isolation).current_dir(&directory.0);
        super::delegation::allowed_environment(&mut c);
        super::delegation::hide_console(&mut c);
        c
    };
    let base = isolation_args(&json!([]))?;
    let inventory: Value =
        serde_json::from_str(&metadata(command(&["mcp", "list", "--json"], &base))?)
            .map_err(|_| "Codex integration inventory is invalid.")?;
    let args = isolation_args(&inventory)?;
    let verified: Value =
        serde_json::from_str(&metadata(command(&["mcp", "list", "--json"], &args))?)
            .map_err(|_| "Codex isolation inventory is invalid.")?;
    let features = metadata(command(&["features", "list"], &args))?;
    if !isolation_verified(&verified, &features) {
        return Err(
            "Codex could not verify disabled integrations. No account server was started.".into(),
        );
    }
    // Private stdin/stdout, no listener or daemon. Config is never changed.
    codex_transport(command(&["app-server"], &args))
}
fn codex_transport(mut command: Command) -> Result<Value, String> {
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = command.spawn().map_err(|_| PROXY_UNAVAILABLE.to_string())?;
    let mut recovered: Option<Value> = None;
    let result = (|| {
        let mut input = child.stdin.take().ok_or(PROXY_UNAVAILABLE)?;
        let output = child.stdout.take().ok_or(PROXY_UNAVAILABLE)?;
        let (tx, rx) = mpsc::sync_channel(8);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(output);
            let mut total = 0;
            loop {
                let mut line = Vec::new();
                let result = reader.by_ref().take(1_000_001).read_until(b'\n', &mut line);
                total += line.len();
                if !matches!(result,Ok(n) if n>0) || line.len() > 1_000_000 || total > 4_000_000 {
                    break;
                }
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        fn send(input: &mut impl Write, v: Value) -> Result<(), String> {
            writeln!(input, "{}", v)
                .and_then(|_| input.flush())
                .map_err(|_| PROXY_UNAVAILABLE.into())
        }
        send(
            &mut input,
            json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"olympus_usage","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true}}}),
        )?;
        let start = Instant::now();
        let mut limits: Option<Value> = None;
        let mut initialized = false;
        loop {
            let remaining = Duration::from_secs(20)
                .checked_sub(start.elapsed())
                .ok_or("Codex account check timed out. No generation was requested.")?;
            let line = match rx.recv_timeout(remaining) {
                Ok(line) => line,
                Err(_) => {
                    if let Some(mut s) = limits {
                        s["detail"] = json!("Allowance retrieved; token activity unavailable.");
                        return Ok(s);
                    }
                    return Err(PROXY_UNAVAILABLE.to_string());
                }
            };
            let v: Value =
                serde_json::from_slice(&line).map_err(|_| "Invalid Codex account response.")?;
            if v.get("method").is_some() {
                if v.get("id").is_some() {
                    return Err("Unexpected Codex server request; account check stopped.".into());
                }
                continue;
            }
            match v["id"].as_u64() {
                Some(1) if !initialized => {
                    if v.get("error").is_some() {
                        return Err("Codex initialization rejected the read-only client.".into());
                    }
                    initialized = true;
                    send(&mut input, json!({"method":"initialized"}))?;
                    send(
                        &mut input,
                        json!({"id":2,"method":"account/rateLimits/read"}),
                    )?;
                }
                Some(2) if initialized => {
                    if v.get("error").is_some() {
                        return Err("Codex account limits are unavailable. Check your existing ChatGPT sign-in in Codex; no login was changed.".into());
                    }
                    limits = Some(normalize("Codex", &v["result"])?);
                    recovered = limits.clone();
                    send(&mut input, json!({"id":3,"method":"account/usage/read"}))?;
                }
                Some(3) if limits.is_some() => {
                    let mut s = limits.take().unwrap();
                    if let Some(tokens) = number(&v["result"]["summary"]["lifetimeTokens"]) {
                        s["consumption"] = metric(tokens, "tokens", "Provider-reported lifetime");
                    }
                    if v.get("error").is_some() {
                        s["detail"] = json!("Allowance retrieved; token activity unavailable.");
                    }
                    return Ok(s);
                }
                _ => return Err("Unexpected Codex account response; check stopped.".into()),
            }
        }
    })();
    let _ = child.kill();
    let _ = child.wait();
    match result {
        Err(_) if recovered.is_some() => {
            let mut s = recovered.unwrap();
            s["detail"] = json!("Allowance retrieved; token activity unavailable.");
            Ok(s)
        }
        other => other,
    }
}
static CODEX_BUSY: AtomicBool = AtomicBool::new(false);
static ELEVEN_BUSY: AtomicBool = AtomicBool::new(false);
struct Busy(&'static AtomicBool);
impl Drop for Busy {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
#[tauri::command]
pub async fn account_usage_read(provider: String) -> Result<Value, String> {
    if !["Codex", "Claude", "ElevenLabs"].contains(&provider.as_str()) {
        return Err("Unknown account provider.".into());
    }
    if super::acceptance::active() {
        return Err("Live account reads are disabled in acceptance mode.".into());
    }
    let mut s = empty(&provider);
    if provider == "Claude" {
        return match super::claude_quota::read() {
            Ok(reading) => Ok(reading),
            Err(detail) => {
                s["source"] = json!("Claude Code statusline (passive local)");
                s["detail"] = json!(detail);
                Ok(s)
            }
        };
    }
    let flag = if provider == "Codex" {
        &CODEX_BUSY
    } else {
        &ELEVEN_BUSY
    };
    if flag.swap(true, Ordering::SeqCst) {
        return Err("An account check is already running.".into());
    }
    let _busy = Busy(flag);
    let result = if provider == "Codex" {
        tauri::async_runtime::spawn_blocking(codex_read)
            .await
            .map_err(|_| "Codex account reader stopped.".to_string())
            .and_then(|r| r)
    } else {
        super::elevenlabs::subscription_quota()
            .await
            .and_then(|v| normalize("ElevenLabs", &v))
    };
    match result {
        Ok(s) => Ok(s),
        Err(detail) => {
            s["detail"] = json!(detail);
            Ok(s)
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quota_launch_disables_effective_integrations_with_plain_keys() {
        let inventory = json!([{"name":"node_repl","enabled":true,"env":{"SECRET":"never-forward"}},{"name":"review-helper","enabled":false}]);
        let args = isolation_args(&inventory).unwrap();
        assert!(args
            .iter()
            .any(|s| s == "mcp_servers.node_repl.enabled=false"));
        assert!(args
            .iter()
            .any(|s| s == "mcp_servers.review-helper.enabled=false"));
        assert!(!args.join(" ").contains("SECRET"));
        assert!(!args.join(" ").contains('"'));
        for name in ["bad.name", "quoted\"name", "", "a=b"] {
            assert!(isolation_args(&json!([{"name":name}])).is_err());
        }
        assert!(isolation_args(&json!({})).is_err());
    }
    #[test]
    fn quota_launch_requires_verified_disabled_settings() {
        let features="apps stable false\nplugins stable false\nremote_plugin stable false\nhooks stable false\ncode_mode_host stable false\ndaemon_auto_start stable false\nskill_mcp_dependency_install stable false";
        assert!(isolation_verified(
            &json!([{"name":"node_repl","enabled":false}]),
            features
        ));
        assert!(!isolation_verified(
            &json!([{"name":"node_repl","enabled":true}]),
            features
        ));
        assert!(!isolation_verified(
            &json!([]),
            &features.replace("hooks stable false", "hooks stable true")
        ));
        assert!(!isolation_verified(&json!([]), ""));
    }
    #[test]
    fn codex_credit_balance_is_native_credits_without_token_allowance() {
        let s=normalize("Codex",&json!({"rateLimitsByLimitId":{"codex":{"primary":{"usedPercent":69,"windowDurationMins":10080},"credits":{"balance":"62.6701000000","unlimited":false}}}})).unwrap();
        assert_eq!(s["windows"][0]["remaining"]["value"], 31.0);
        assert_eq!(s["balance"]["value"], 62.6701);
        assert_eq!(s["balance"]["unit"], "credits");
        assert!(s["ytdSpend"].is_null());
    }
    #[test]
    fn eleven_quota_is_characters_not_dollars() {
        let s=normalize("ElevenLabs",&json!({"character_count":250,"character_limit":1000,"next_character_count_reset_unix":1800000000})).unwrap();
        assert_eq!(s["balance"]["value"], 750.0);
        assert_eq!(s["balance"]["unit"], "characters");
        assert!(s["ytdSpend"].is_null());
        assert_eq!(s["windows"][0]["remaining"]["value"], 75.0);
    }
    #[test]
    fn codex_prefers_bucket_map_and_clamps() {
        let s=normalize("Codex",&json!({"rateLimits":{"primary":{"usedPercent":5}},"rateLimitsByLimitId":{"codex":{"primary":{"usedPercent":120,"windowDurationMins":300,"resetsAt":1800000000}}}})).unwrap();
        assert_eq!(s["windows"].as_array().unwrap().len(), 1);
        assert_eq!(s["windows"][0]["remaining"]["value"], 0.0);
        assert!(s["balance"].is_null());
    }
    #[test]
    fn protocol_requests_only_read_methods_and_keeps_limits_when_usage_fails() {
        for scenario in [
            "success",
            "usage-error",
            "usage-eof",
            "usage-malformed",
            "unexpected",
        ] {
            let mut command = Command::new("node");
            command
                .arg(
                    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join("../scripts/acceptance/account-usage-server.mjs"),
                )
                .arg(scenario);
            super::super::delegation::hide_console(&mut command);
            let result = codex_transport(command);
            if scenario == "unexpected" {
                assert!(result
                    .unwrap_err()
                    .contains("Unexpected Codex server request"));
            } else {
                let s = result.unwrap();
                assert_eq!(s["windows"][0]["remaining"]["value"], 80.0);
                if scenario == "success" {
                    assert_eq!(s["consumption"]["period"], "Provider-reported lifetime");
                } else {
                    assert!(s["detail"]
                        .as_str()
                        .unwrap()
                        .contains("token activity unavailable"));
                }
            }
        }
    }
    #[test]
    fn missing_quota_is_not_zero() {
        assert!(normalize("ElevenLabs", &json!({"character_count":0})).is_err());
        assert!(normalize("Codex", &json!({})).is_err());
    }
}

#[cfg(test)]
mod live_reads {
    #[test]
    #[ignore = "Explicit read-only account check; uses existing managed authentication"]
    fn live_codex_quota() {
        let result = super::codex_read();
        match result {
            Ok(s) => println!("CODEX_ACCOUNT_READING {}", s),
            Err(e) => println!("CODEX_ACCOUNT_BLOCKER {}", e),
        }
    }
    #[test]
    #[ignore = "Explicit read-only quota GET; uses existing Windows credential"]
    fn live_elevenlabs_quota() {
        let result = tauri::async_runtime::block_on(super::super::elevenlabs::subscription_quota())
            .and_then(|v| super::normalize("ElevenLabs", &v));
        match result {
            Ok(s) => println!("ELEVENLABS_ACCOUNT_READING {}", s),
            Err(e) => println!("ELEVENLABS_ACCOUNT_BLOCKER {}", e),
        }
    }
}
