use super::{Api, ApiError, Runtime, SCOPE};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::Path,
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri_plugin_opener::OpenerExt;

// Intentionally no Debug/Serialize on credential-bearing types.
#[derive(Deserialize)]
pub struct ClientConfig {
    pub client_id: String,
    #[serde(default)]
    pub client_secret: String,
}
pub fn config(path: &Path) -> Result<ClientConfig, String> {
    let raw = fs::read(path).map_err(|_| "gmail_client_config_missing")?;
    if raw.len() > 32_000 {
        return Err("gmail_client_config_invalid".into());
    }
    let parsed: Value = serde_json::from_slice(&raw).map_err(|_| "gmail_client_config_invalid")?;
    let client: ClientConfig = serde_json::from_value(parsed["installed"].clone())
        .map_err(|_| "gmail_requires_desktop_client")?;
    if !client.client_id.ends_with(".apps.googleusercontent.com") {
        return Err("gmail_client_config_invalid".into());
    }
    Ok(client)
}
pub trait Secrets {
    fn get(&self, account: &str) -> Result<String, String>;
    fn set(&self, account: &str, value: &str) -> Result<(), String>;
    fn delete(&self, account: &str) -> Result<(), String>;
}
pub struct WindowsSecrets;
fn entry(account: &str) -> Result<keyring::Entry, String> {
    if !cfg!(target_os = "windows") {
        return Err("gmail_secure_store_unsupported".into());
    }
    keyring::Entry::new("Olympus.Gmail.ReadOnly", account)
        .map_err(|_| "gmail_secure_store_unavailable".into())
}
impl Secrets for WindowsSecrets {
    fn get(&self, a: &str) -> Result<String, String> {
        entry(a)?.get_password().map_err(|e| match e {
            keyring::Error::NoEntry => "gmail_credential_missing".into(),
            _ => "gmail_secure_store_unavailable".into(),
        })
    }
    fn set(&self, a: &str, v: &str) -> Result<(), String> {
        entry(a)?
            .set_password(v)
            .map_err(|_| "gmail_secure_store_unavailable".into())
    }
    fn delete(&self, a: &str) -> Result<(), String> {
        match entry(a)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("gmail_secure_store_unavailable".into()),
        }
    }
}
pub fn random() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|_| "secure_random_unavailable")?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}
pub fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}
pub fn callback(target: &str, state: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{target}"))
        .map_err(|_| "oauth_invalid_callback")?;
    if url.path() != "/oauth/callback" {
        return Err("oauth_invalid_callback".into());
    }
    let values = url.query_pairs().collect::<Vec<_>>();
    let states = values
        .iter()
        .filter(|(k, _)| k == "state")
        .collect::<Vec<_>>();
    if states.len() != 1 || states[0].1.as_ref() != state {
        return Err("oauth_state_mismatch".into());
    }
    if values.iter().any(|(k, _)| k == "error") {
        return Err("oauth_cancelled".into());
    }
    let codes = values
        .iter()
        .filter(|(k, _)| k == "code")
        .collect::<Vec<_>>();
    if codes.len() != 1 || codes[0].1.is_empty() {
        return Err("oauth_code_missing".into());
    }
    Ok(codes[0].1.to_string())
}
fn http() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "gmail_http_unavailable".into())
}
fn token(form: &[(&str, &str)]) -> Result<Value, String> {
    let response = http()?
        .post("https://oauth2.googleapis.com/token")
        .form(form)
        .send()
        .map_err(|_| "gmail_network_unavailable")?;
    let status = response.status();
    let mut bytes = Vec::new();
    response
        .take(32_001)
        .read_to_end(&mut bytes)
        .map_err(|_| "oauth_invalid_response")?;
    if bytes.len() > 32_000 {
        return Err("oauth_invalid_response".into());
    }
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| "oauth_invalid_response")?;
    if !status.is_success() {
        return Err(if value["error"] == "invalid_grant" {
            "gmail_authentication_required"
        } else {
            "oauth_exchange_failed"
        }
        .into());
    }
    Ok(value)
}
pub fn authorize(
    app: &tauri::AppHandle,
    runtime: &Runtime,
    cfg: &ClientConfig,
) -> Result<(String, String), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "oauth_callback_bind_failed")?;
    listener
        .set_nonblocking(true)
        .map_err(|_| "oauth_callback_bind_failed")?;
    let redirect = format!(
        "http://127.0.0.1:{}/oauth/callback",
        listener
            .local_addr()
            .map_err(|_| "oauth_callback_bind_failed")?
            .port()
    );
    let state = random()?;
    let verifier = random()?;
    let mut url = reqwest::Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", cfg.client_id.as_str()),
        ("redirect_uri", &redirect),
        ("response_type", "code"),
        ("scope", SCOPE),
        ("state", &state),
        ("code_challenge", &challenge(&verifier)),
        ("code_challenge_method", "S256"),
        ("access_type", "offline"),
        ("prompt", "consent"),
    ]);
    app.opener()
        .open_url(url.to_string(), None::<&str>)
        .map_err(|_| "oauth_browser_open_failed")?;
    let deadline = Instant::now() + Duration::from_secs(180);
    let code = loop {
        if runtime.cancel.load(Ordering::SeqCst) {
            return Err("oauth_cancelled".into());
        }
        if Instant::now() > deadline {
            return Err("oauth_callback_timeout".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream
                    .set_read_timeout(Some(Duration::from_millis(250)))
                    .ok();
                stream.set_write_timeout(Some(Duration::from_secs(1))).ok();
                let mut data = Vec::new();
                let read_until = Instant::now() + Duration::from_secs(2);
                while !data.windows(2).any(|w| w == b"\r\n")
                    && data.len() < 8192
                    && Instant::now() < read_until
                {
                    if runtime.cancel.load(Ordering::SeqCst) {
                        return Err("oauth_cancelled".into());
                    }
                    let mut chunk = [0u8; 1024];
                    match stream.read(&mut chunk) {
                        Ok(0) => break,
                        Ok(n) => data.extend_from_slice(&chunk[..n]),
                        Err(e)
                            if matches!(
                                e.kind(),
                                std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                            ) =>
                        {
                            continue
                        }
                        Err(_) => break,
                    }
                }
                if !data.windows(2).any(|w| w == b"\r\n") {
                    continue;
                }
                let request = std::str::from_utf8(&data).map_err(|_| "oauth_invalid_callback")?;
                let mut first = request.lines().next().unwrap_or("").split_whitespace();
                let method = first.next().unwrap_or("");
                let target = first.next().unwrap_or("");
                if method != "GET" || !target.starts_with("/oauth/callback?") {
                    let _ = stream.write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    );
                    continue;
                }
                let result = callback(target, &state);
                let body = if result.is_ok() {
                    "Authorization received. Return to Olympus; connection is being verified."
                } else {
                    "Authorization was not accepted. Return to Olympus and try again."
                };
                let response=format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);
                let _ = stream.write_all(response.as_bytes());
                break result?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Err(_) => return Err("oauth_callback_failed".into()),
        }
    };
    drop(listener);
    if runtime.cancel.load(Ordering::SeqCst) {
        return Err("oauth_cancelled".into());
    }
    let value = token(&[
        ("client_id", &cfg.client_id),
        ("client_secret", &cfg.client_secret),
        ("code", &code),
        ("code_verifier", &verifier),
        ("redirect_uri", &redirect),
        ("grant_type", "authorization_code"),
    ])?;
    let scopes = value["scope"]
        .as_str()
        .unwrap_or("")
        .split_whitespace()
        .collect::<Vec<_>>();
    if scopes != vec![SCOPE] {
        return Err("oauth_scope_mismatch".into());
    }
    let access = value["access_token"]
        .as_str()
        .ok_or("oauth_token_missing")?
        .to_string();
    let refresh = value["refresh_token"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("oauth_refresh_token_missing")?
        .to_string();
    Ok((access, refresh))
}
pub struct GmailHttp<'a> {
    pub account: String,
    pub cfg: ClientConfig,
    pub runtime: &'a Runtime,
    pub token: String,
    pub client: reqwest::blocking::Client,
    pub expires: Instant,
    next_request: Instant,
}
impl<'a> GmailHttp<'a> {
    pub fn new(account: String, cfg: ClientConfig, runtime: &'a Runtime) -> Result<Self, String> {
        Ok(Self {
            account,
            cfg,
            runtime,
            token: String::new(),
            client: http()?,
            expires: Instant::now(),
            next_request: Instant::now(),
        })
    }
    fn refresh(&mut self) -> Result<(), ApiError> {
        let refresh = WindowsSecrets.get(&self.account).map_err(ApiError::Auth)?;
        let value = token(&[
            ("client_id", &self.cfg.client_id),
            ("client_secret", &self.cfg.client_secret),
            ("refresh_token", &refresh),
            ("grant_type", "refresh_token"),
        ])
        .map_err(|e| {
            if e == "gmail_authentication_required" {
                ApiError::Auth(e)
            } else {
                ApiError::Other(e)
            }
        })?;
        self.token = value["access_token"]
            .as_str()
            .ok_or_else(|| ApiError::Auth("oauth_token_missing".into()))?
            .into();
        self.expires = Instant::now()
            + Duration::from_secs(
                value["expires_in"]
                    .as_u64()
                    .unwrap_or(300)
                    .saturating_sub(60),
            );
        Ok(())
    }
}
impl Api for GmailHttp<'_> {
    fn get(&mut self, path: &str, query: &[(&str, String)]) -> Result<Value, ApiError> {
        if !["profile", "messages", "history"].contains(&path)
            && !path
                .strip_prefix("messages/")
                .is_some_and(super::provider_id)
        {
            return Err(ApiError::Other("gmail_route_denied".into()));
        }
        for attempt in 0..3 {
            if self.runtime.cancel.load(Ordering::SeqCst) {
                return Err(ApiError::Other("gmail_cancelled".into()));
            }
            if self.token.is_empty() || Instant::now() >= self.expires {
                self.refresh()?
            }
            pause(
                self.runtime,
                self.next_request.saturating_duration_since(Instant::now()),
            )?;
            self.next_request = Instant::now() + Duration::from_millis(250);
            let response = self
                .client
                .get(format!(
                    "https://gmail.googleapis.com/gmail/v1/users/me/{path}"
                ))
                .bearer_auth(&self.token)
                .query(query)
                .send()
                .map_err(|_| ApiError::Other("gmail_network_unavailable".into()))?;
            let status = response.status().as_u16();
            let retry_after = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok());
            if status == 401 {
                self.token.clear();
                if attempt < 2 {
                    continue;
                }
                return Err(ApiError::Auth("gmail_authentication_required".into()));
            }
            if status == 404 {
                return Err(ApiError::NotFound);
            }
            if status == 429 || status >= 500 {
                if attempt < 2 {
                    pause(self.runtime, retry_delay(attempt, retry_after)?)?;
                    continue;
                }
                return Err(ApiError::Other(
                    if status == 429 {
                        "gmail_rate_limited"
                    } else {
                        "gmail_service_unavailable"
                    }
                    .into(),
                ));
            }
            if status == 403 {
                let mut bytes = Vec::new();
                response
                    .take(32769)
                    .read_to_end(&mut bytes)
                    .map_err(|_| ApiError::Other("gmail_response_read_failed".into()))?;
                let code = if bytes.len() <= 32768 {
                    serde_json::from_slice::<Value>(&bytes)
                        .ok()
                        .map(|v| forbidden_code(&v))
                        .unwrap_or("gmail_access_or_quota_denied")
                } else {
                    "gmail_access_or_quota_denied"
                };
                if code == "gmail_rate_limited" && attempt < 2 {
                    pause(self.runtime, retry_delay(attempt, retry_after)?)?;
                    continue;
                }
                return Err(ApiError::Other(code.into()));
            }
            if !(200..300).contains(&status) {
                return Err(ApiError::Other("gmail_request_failed".into()));
            }
            let mut bytes = Vec::new();
            response
                .take(4_000_001)
                .read_to_end(&mut bytes)
                .map_err(|_| ApiError::Other("gmail_response_read_failed".into()))?;
            if bytes.len() > 4_000_000 {
                return Err(ApiError::Other("gmail_response_too_large".into()));
            }
            return serde_json::from_slice(&bytes)
                .map_err(|_| ApiError::Other("gmail_malformed_response".into()));
        }
        Err(ApiError::Other("gmail_retry_exhausted".into()))
    }
}

// The credential store and SQLite cannot share a transaction. Compensate if
// the account write fails, without exposing either credential to diagnostics.
pub fn save_connection(
    secrets: &impl Secrets,
    c: &rusqlite::Connection,
    id: &str,
    email: &str,
    horizon: u32,
    refresh: &str,
) -> Result<(), String> {
    let previous = match secrets.get(id) {
        Ok(v) => Some(v),
        Err(e) if e == "gmail_credential_missing" => None,
        Err(e) => return Err(e),
    };
    secrets.set(id, refresh)?;
    if let Err(e) = super::store::connect(c, id, email, horizon) {
        let rollback = if let Some(v) = previous {
            secrets.set(id, &v)
        } else {
            secrets.delete(id)
        };
        return Err(rollback.err().unwrap_or(e));
    }
    Ok(())
}
pub fn disconnect(
    secrets: &impl Secrets,
    c: &rusqlite::Connection,
    id: &str,
) -> Result<(), String> {
    super::store::disconnect(c, id)?;
    if let Err(e) = secrets.delete(id) {
        c.execute(
            "UPDATE gmail_accounts SET last_error=?2 WHERE id=?1",
            rusqlite::params![id, e],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        return Err(e);
    }
    Ok(())
}

// Only allowlisted reason codes cross the native boundary, never Google's
// free-text error message, request URL, token or response payload.
pub(super) fn forbidden_code(v: &Value) -> &'static str {
    let reasons = v["error"]["errors"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| e["reason"].as_str())
        .chain(
            v["error"]["details"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|e| e["reason"].as_str()),
        )
        .collect::<Vec<_>>();
    if reasons.iter().any(|r| {
        matches!(
            *r,
            "rateLimitExceeded" | "userRateLimitExceeded" | "RATE_LIMIT_EXCEEDED"
        )
    }) {
        "gmail_rate_limited"
    } else if reasons.iter().any(|r| {
        matches!(
            *r,
            "dailyLimitExceeded" | "quotaExceeded" | "QUOTA_EXCEEDED"
        )
    }) {
        "gmail_quota_exceeded"
    } else if reasons
        .iter()
        .any(|r| matches!(*r, "accessNotConfigured" | "SERVICE_DISABLED"))
    {
        "gmail_api_disabled"
    } else if reasons.iter().any(|r| {
        matches!(
            *r,
            "insufficientPermissions" | "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
        )
    }) {
        "gmail_scope_insufficient"
    } else if reasons.contains(&"domainPolicy") {
        "gmail_domain_policy"
    } else {
        "gmail_access_or_quota_denied"
    }
}

fn pause(runtime: &Runtime, duration: Duration) -> Result<(), ApiError> {
    let until = Instant::now() + duration;
    while Instant::now() < until {
        if runtime.cancel.load(Ordering::SeqCst) {
            return Err(ApiError::Other("gmail_cancelled".into()));
        }
        std::thread::sleep(
            until
                .saturating_duration_since(Instant::now())
                .min(Duration::from_millis(50)),
        );
    }
    Ok(())
}
pub(super) fn retry_delay(attempt: u32, retry_after: Option<u64>) -> Result<Duration, ApiError> {
    let seconds = retry_after.unwrap_or(0).max(5u64 << attempt.min(3));
    if seconds > 60 {
        return Err(ApiError::Other("gmail_rate_limited".into()));
    }
    Ok(Duration::from_secs(seconds))
}
