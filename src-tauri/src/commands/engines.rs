//! Subscription engines: where Codex and Claude Code are installed, and which
//! sign-in each would use.
//!
//! The two are equal engines and neither is required (docs/ARMORY-PLAN.md,
//! principle 7). The sign-in check runs each CLI's own status command with the
//! environment Olympus launches it with, so the answer describes a launch, not
//! the operator's shell. Unknown paid-overage eligibility blocks generation.

use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use super::delegation::{allowed_environment, blocking, claude_executable, hide_console};

const STATUS_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Engine {
    Codex,
    ClaudeCode,
}

impl Engine {
    fn id(self) -> &'static str {
        match self {
            Engine::Codex => "codex",
            Engine::ClaudeCode => "claude-code",
        }
    }

    fn name(self) -> &'static str {
        match self {
            Engine::Codex => "Codex",
            Engine::ClaudeCode => "Claude Code",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum SignIn {
    /// A ChatGPT or Claude subscription. `plan` is the tier when the CLI reports one.
    Subscription { plan: Option<String> },
    /// A sign-in that bills an API or a cloud provider. Olympus will not launch on it.
    ApiBilled { detail: String },
    SignedOut,
    NotFound { detail: String },
    /// The check ran but could not establish the sign-in. Treated as not a subscription.
    Unknown { detail: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub engine: &'static str,
    pub name: &'static str,
    pub executable: Option<String>,
    pub version: Option<String>,
    pub sign_in: SignIn,
    pub observed_at: String,
    pub selection: &'static str,
    pub capabilities: EngineCapabilities,
    pub billing: BillingState,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineCapabilities {
    streaming: Option<bool>,
    structured_output: Option<bool>,
    ephemeral: Option<bool>,
    source: &'static str,
}

fn capabilities(engine: Engine, version: Option<&str>) -> EngineCapabilities {
    // CLI help inspected locally; this does not claim live inference acceptance.
    let inspected = matches!((engine, version),
        (Engine::ClaudeCode, Some("2.1.74 (Claude Code)" | "2.1.284 (Claude Code)")) |
        (Engine::Codex, Some("codex-cli 0.163.0-alpha.10.2")));
    EngineCapabilities {
        streaming: inspected.then_some(true), structured_output: inspected.then_some(true),
        ephemeral: inspected.then_some(true),
        source: if inspected { "Installed-version CLI help: streaming, structured output and ephemeral sessions advertised; live behavior unverified." }
            else { "Version capabilities not verified. No generation is enabled." },
    }
}

#[derive(Debug, Serialize)]
pub struct BillingState { state: &'static str, detail: &'static str }

fn billing_state(sign_in: &SignIn) -> BillingState {
    if matches!(sign_in, SignIn::Subscription { .. }) {
        BillingState { state: "unknown", detail: "Subscription confirmed; paid-overage eligibility has not been verified." }
    } else {
        BillingState { state: "ineligible", detail: "A subscription sign-in has not been confirmed." }
    }
}

/// No supported no-overage proof is wired yet. All subscription generation fails closed.
pub(crate) fn require_generation_eligibility(sign_in: &SignIn) -> Result<(), String> {
    Err(format!("{} Nothing was started. Check subscription and paid-overage settings before enabling generation.", billing_state(sign_in).detail))
}

pub(crate) fn select_executable(explicit: Option<PathBuf>, candidates: Vec<PathBuf>) -> Result<PathBuf, String> {
    if let Some(path) = explicit {
        return if path.is_absolute() && path.is_file() { Ok(path) }
            else { Err("The explicit engine executable must be an existing absolute file path. No other installation was selected.".into()) };
    }
    candidates.into_iter().find(|path| path.is_absolute() && path.is_file())
        .ok_or_else(|| "No engine executable was found in the configured locations.".into())
}

/// Desktop app-managed installations are not on PATH. Inspect only this bounded directory.
fn desktop_codex_candidates(local_app_data: &Path) -> Vec<PathBuf> {
    let root = local_app_data.join("OpenAI/Codex/bin");
    let Ok(entries) = std::fs::read_dir(root) else { return Vec::new() };
    let entries: Vec<_> = entries.take(65).collect();
    // Do not select from an incomplete directory scan.
    if entries.len() > 64 { return Vec::new(); }
    let mut paths: Vec<_> = entries.into_iter().filter_map(Result::ok)
        .map(|entry| entry.path().join("codex.exe")).filter(|path| path.is_file()).collect();
    paths.sort();
    paths
}

fn select_desktop_codex(paths: Vec<PathBuf>) -> Result<PathBuf, String> {
    if paths.len() > 1 {
        return Err("Multiple desktop Codex installations were found. Set OLYMPUS_CODEX to the exact executable to inspect; no version was chosen silently.".into());
    }
    select_executable(None, paths)
}

/// Where Codex may be installed, most specific first: an explicit `OLYMPUS_CODEX`
/// path, then `codex.exe` on `PATH` (standalone installs), then npm's global
/// install. npm's `codex.cmd` shim cannot be spawned directly, so the npm entries
/// name the native binary its launcher would run (`codex-cli/bin/codex.js`): the
/// platform package's vendor folder, then the older in-package vendor folder.
pub(crate) fn codex_candidates(var: impl Fn(&str) -> Option<std::ffi::OsString>) -> Vec<PathBuf> {
    let name = if cfg!(windows) { "codex.exe" } else { "codex" };
    let (triple, platform_package) = if cfg!(target_arch = "aarch64") {
        ("aarch64-pc-windows-msvc", "codex-win32-arm64")
    } else {
        ("x86_64-pc-windows-msvc", "codex-win32-x64")
    };
    let mut candidates = Vec::new();
    if let Some(explicit) = var("OLYMPUS_CODEX").filter(|value| !value.is_empty()) {
        candidates.push(PathBuf::from(explicit));
    }
    if let Some(path) = var("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|dir| dir.join(name)));
    }
    if let Some(app_data) = var("APPDATA") {
        let package = PathBuf::from(app_data).join("npm").join("node_modules").join("@openai").join("codex");
        let vendored = |root: PathBuf| root.join("vendor").join(triple).join("bin").join(name);
        candidates.push(vendored(package.join("node_modules").join("@openai").join(platform_package)));
        candidates.push(vendored(package));
    }
    candidates
}

pub(crate) fn codex_executable() -> Result<PathBuf, String> {
    let explicit = std::env::var_os("OLYMPUS_CODEX").filter(|value| !value.is_empty()).map(PathBuf::from);
    let selected = select_executable(explicit.clone(), codex_candidates(|key| std::env::var_os(key)));
    if explicit.is_some() || selected.is_ok() { return selected; }
    let desktop = std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
        .map(|path| desktop_codex_candidates(&path)).unwrap_or_default();
    select_desktop_codex(desktop).map_err(|reason| format!("{reason} Set OLYMPUS_CODEX to the full path of codex.exe."))
}

/// Runs a CLI's own status command in the launch environment. A CLI that does not
/// answer within the timeout is killed rather than left holding the caller.
fn run_cli(executable: &Path, args: &[&str]) -> Result<Output, String> {
    let mut command = Command::new(executable);
    hide_console(&mut command)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    allowed_environment(&mut command);
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let deadline = Instant::now() + STATUS_TIMEOUT;
    while child.try_wait().map_err(|error| error.to_string())?.is_none() {
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("it did not answer within {} seconds", STATUS_TIMEOUT.as_secs()));
        }
        thread::sleep(Duration::from_millis(50));
    }
    child.wait_with_output().map_err(|error| error.to_string())
}

/// `claude auth status --json`. The shape is Claude Code's own: `loggedIn`,
/// `authMethod` (`claude.ai`, `oauth_token`, `api_key`, `api_key_helper`,
/// `third_party` or `none`), `apiKeySource` whenever an API key is configured,
/// and `subscriptionType` for a claude.ai sign-in.
pub(crate) fn classify_claude(stdout: &str) -> SignIn {
    let Ok(status) = serde_json::from_str::<Value>(stdout.trim()) else {
        return SignIn::Unknown { detail: "Claude Code's sign-in status could not be read".into() };
    };
    if status.get("loggedIn").and_then(Value::as_bool) != Some(true) {
        return SignIn::SignedOut;
    }
    // Claude Code prefers a configured API key over its subscription login.
    if let Some(source) = status.get("apiKeySource").and_then(Value::as_str) {
        let detail = match source {
            "/login managed key" => "signed in with an Anthropic Console account".to_string(),
            other => format!("an API key is configured ({other})"),
        };
        return SignIn::ApiBilled { detail };
    }
    match status.get("authMethod").and_then(Value::as_str) {
        Some("claude.ai") => SignIn::Subscription {
            plan: status.get("subscriptionType").and_then(Value::as_str).map(str::to_string),
        },
        Some("api_key") | Some("api_key_helper") => SignIn::ApiBilled { detail: "signed in with an API key".into() },
        Some("third_party") => SignIn::ApiBilled { detail: "billed through a cloud provider (Bedrock or Vertex)".into() },
        Some("oauth_token") => SignIn::Unknown {
            detail: "signed in with a long-lived token, which Olympus cannot confirm is a subscription".into(),
        },
        other => SignIn::Unknown { detail: format!("unrecognised sign-in method {}", other.unwrap_or("(none)")) },
    }
}

/// `codex login status` writes one line to stderr (`codex-rs/cli/src/login.rs`).
/// Warnings may precede it, so the line is found rather than assumed first. The
/// API-key line carries a masked key, which is never repeated.
pub(crate) fn classify_codex(stdout: &str, stderr: &str) -> SignIn {
    let Some(line) = stderr
        .lines()
        .chain(stdout.lines())
        .map(str::trim)
        .find(|line| line.starts_with("Logged in using") || line.starts_with("Not logged in"))
    else {
        return SignIn::Unknown { detail: "Codex's sign-in status could not be read".into() };
    };
    if line.starts_with("Not logged in") {
        return SignIn::SignedOut;
    }
    let method = line.trim_start_matches("Logged in using").trim();
    if method == "ChatGPT" {
        SignIn::Subscription { plan: None }
    } else if method.starts_with("an API key") {
        SignIn::ApiBilled { detail: "signed in with an OpenAI API key".into() }
    } else if method.starts_with("Amazon Bedrock") {
        SignIn::ApiBilled { detail: "billed through Amazon Bedrock".into() }
    } else {
        SignIn::Unknown {
            detail: format!("signed in using {method}, which Olympus cannot confirm is a ChatGPT subscription"),
        }
    }
}

fn sign_in(engine: Engine, executable: &Path) -> SignIn {
    let args: &[&str] = match engine {
        Engine::Codex => &["login", "status"],
        Engine::ClaudeCode => &["--setting-sources", "", "auth", "status", "--json"],
    };
    match run_cli(executable, args) {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            match engine {
                Engine::Codex => classify_codex(&stdout, &stderr),
                Engine::ClaudeCode => classify_claude(&stdout),
            }
        }
        Ok(_) => SignIn::Unknown { detail: "the sign-in check did not succeed; no credentials or raw output are shown".into() },
        Err(error) => SignIn::Unknown { detail: format!("the sign-in check could not run: {error}") },
    }
}

fn version(executable: &Path) -> Option<String> {
    let output = run_cli(executable, &["--version"]).ok()?;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (output.status.success() && !version.is_empty()).then_some(version)
}

fn status(engine: Engine) -> EngineStatus {
    let found = match engine {
        Engine::Codex => codex_executable(),
        Engine::ClaudeCode => claude_executable(),
    };
    let (executable, version, sign_in) = match found {
        Ok(path) => (Some(path.display().to_string()), version(&path), sign_in(engine, &path)),
        Err(detail) => (None, None, SignIn::NotFound { detail }),
    };
    let capabilities = capabilities(engine, version.as_deref());
    let billing = billing_state(&sign_in);
    let override_name = match engine { Engine::Codex => "OLYMPUS_CODEX", Engine::ClaudeCode => "OLYMPUS_CLAUDE_CODE" };
    let selection = if std::env::var_os(override_name).is_some_and(|value| !value.is_empty()) { "explicit executable override" } else { "automatic discovery" };
    EngineStatus { engine: engine.id(), name: engine.name(), executable, version, sign_in,
        observed_at: chrono::Utc::now().to_rfc3339(), selection, capabilities, billing }
}

/// Delegation's gate: sign-in alone cannot establish that paid overage is disabled.
pub(crate) fn require_claude_subscription(executable: &Path) -> Result<(), String> {
    require_generation_eligibility(&sign_in(Engine::ClaudeCode, executable))
}

#[tauri::command]
pub async fn engine_status(app: AppHandle) -> Result<Vec<EngineStatus>, String> {
    if super::acceptance::active() {
        return Err("The acceptance profile does not run Codex or Claude Code, so their sign-ins are not checked.".into());
    }
    blocking(app, |_| Ok(vec![status(Engine::Codex), status(Engine::ClaudeCode)])).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscription_does_not_authorize_unknown_overage() {
        let sign = SignIn::Subscription { plan: Some("max".into()) };
        assert_eq!(billing_state(&sign).state, "unknown");
        assert!(require_generation_eligibility(&sign).is_err());
        assert_eq!(billing_state(&SignIn::SignedOut).state, "ineligible");
        assert!(require_generation_eligibility(&SignIn::ApiBilled { detail: "key".into() }).is_err());
    }

    #[test]
    fn explicit_executable_never_falls_back_and_must_be_absolute() {
        let root = std::env::temp_dir().join(format!("olympus-engine-selection-{}",std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let fallback = root.join("fallback.exe");
        std::fs::write(&fallback, b"fixture").unwrap();
        assert!(select_executable(Some(root.join("missing.exe")), vec![fallback.clone()]).is_err());
        assert!(select_executable(Some(PathBuf::from("fallback.exe")), vec![fallback.clone()]).is_err());
        assert_eq!(select_executable(Some(fallback.clone()), vec![]).unwrap(), fallback);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn desktop_discovery_is_bounded_and_ambiguous_installs_need_selection() {
        let root = std::env::temp_dir().join(format!("olympus-desktop-discovery-{}",std::process::id()));
        let bin = root.join("OpenAI/Codex/bin");
        std::fs::create_dir_all(bin.join("build-a")).unwrap();
        std::fs::write(bin.join("build-a/codex.exe"), b"fixture").unwrap();
        let paths = desktop_codex_candidates(&root);
        assert_eq!(paths, vec![bin.join("build-a/codex.exe")]);
        std::fs::create_dir_all(bin.join("build-b")).unwrap();
        std::fs::write(bin.join("build-b/codex.exe"), b"fixture").unwrap();
        assert!(select_desktop_codex(desktop_codex_candidates(&root)).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn capability_claims_require_an_inspected_version() {
        assert_eq!(capabilities(Engine::ClaudeCode, Some("2.1.74 (Claude Code)")).streaming, Some(true));
        assert_eq!(capabilities(Engine::ClaudeCode, Some("2.1.284 (Claude Code)")).ephemeral, Some(true));
        assert_eq!(capabilities(Engine::Codex, Some("codex-cli 0.163.0-alpha.10.2")).structured_output, Some(true));
        assert_eq!(capabilities(Engine::Codex, Some("codex-cli 999.0.0")).streaming, None);
        assert_eq!(capabilities(Engine::ClaudeCode, None).ephemeral, None);
    }

    #[test]
    fn claude_counts_only_a_claude_ai_sign_in_without_an_api_key_as_a_subscription() {
        assert_eq!(
            classify_claude(r#"{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"max"}"#),
            SignIn::Subscription { plan: Some("max".into()) }
        );
        assert_eq!(
            classify_claude(r#"{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":null}"#),
            SignIn::Subscription { plan: None }
        );
        // A Console login reports `claude.ai` with a managed API key: that is API billing.
        assert!(matches!(
            classify_claude(r#"{"loggedIn":true,"authMethod":"claude.ai","apiKeySource":"/login managed key"}"#),
            SignIn::ApiBilled { detail } if detail.contains("Console")
        ));
        for method in ["api_key", "api_key_helper", "third_party"] {
            let status = format!(r#"{{"loggedIn":true,"authMethod":"{method}"}}"#);
            assert!(matches!(classify_claude(&status), SignIn::ApiBilled { .. }), "{method}");
        }
        assert!(matches!(classify_claude(r#"{"loggedIn":true,"authMethod":"oauth_token"}"#), SignIn::Unknown { .. }));
        assert_eq!(classify_claude(r#"{"loggedIn":false,"authMethod":"none"}"#), SignIn::SignedOut);
        assert!(matches!(classify_claude("Not logged in."), SignIn::Unknown { .. }));
    }

    #[test]
    fn codex_counts_only_a_chatgpt_sign_in_as_a_subscription_and_never_repeats_a_key() {
        assert_eq!(classify_codex("", "Logged in using ChatGPT\n"), SignIn::Subscription { plan: None });
        assert_eq!(
            classify_codex("", "WARNING: deprecated config key\nLogged in using ChatGPT\n"),
            SignIn::Subscription { plan: None }
        );
        let keyed = classify_codex("", "Logged in using an API key - sk-proj-***abcd\n");
        assert!(matches!(&keyed, SignIn::ApiBilled { detail } if !detail.contains("abcd")));
        assert!(matches!(classify_codex("", "Logged in using Amazon Bedrock API key"), SignIn::ApiBilled { .. }));
        assert!(matches!(classify_codex("", "Logged in using personal access token"), SignIn::Unknown { .. }));
        assert_eq!(classify_codex("", "Not logged in\n"), SignIn::SignedOut);
        assert!(matches!(classify_codex("", "error: unexpected argument"), SignIn::Unknown { .. }));
    }

    #[test]
    fn codex_is_looked_for_in_every_install_location_in_order() {
        let env = |key: &str| -> Option<std::ffi::OsString> {
            match key {
                "OLYMPUS_CODEX" => Some("C:/explicit/codex.exe".into()),
                "PATH" => Some(std::env::join_paths(["/first", "/second"]).unwrap()),
                "APPDATA" => Some("C:/Users/kev/AppData/Roaming".into()),
                _ => None,
            }
        };
        let name = if cfg!(windows) { "codex.exe" } else { "codex" };
        let candidates = codex_candidates(env);
        assert_eq!(candidates[0], PathBuf::from("C:/explicit/codex.exe"));
        assert_eq!(candidates[1], PathBuf::from("/first").join(name));
        assert_eq!(candidates[2], PathBuf::from("/second").join(name));
        let npm = PathBuf::from("npm/node_modules/@openai/codex");
        assert!(candidates[3].starts_with("C:/Users/kev/AppData/Roaming"));
        assert!(candidates[3].to_string_lossy().replace('\\', "/").contains("@openai/codex/node_modules/@openai/codex-win32-"));
        assert!(candidates[3].ends_with(PathBuf::from("bin").join(name)));
        assert!(candidates[4].ends_with(npm.join("vendor").join(if cfg!(target_arch = "aarch64") { "aarch64-pc-windows-msvc" } else { "x86_64-pc-windows-msvc" }).join("bin").join(name)));
        assert_eq!(candidates.len(), 5);
        assert!(codex_candidates(|_| None).is_empty());
    }
}
