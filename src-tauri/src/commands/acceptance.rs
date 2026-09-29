//! The desktop acceptance profile: `OLYMPUS_ACCEPTANCE_DIR`, debug builds only.
//!
//! An ordinary dev launch opens the operator's vault, projects root, provider
//! keys and Gmail, and none of those can be separated by configuration. When
//! the variable names a directory, a debug build instead reads the vault from
//! `<dir>/vault`, scans `<dir>/projects`, drops the provider keys from its own
//! environment, and refuses every Gmail network or keyring path and every
//! delegation launch. The database and webview profile are separated by the
//! `scripts/acceptance/tauri.acceptance.json` identifier, not here.
//!
//! Release builds do not compile the variable read at all, so the installed app
//! cannot be redirected by an environment it happens to inherit.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde::Serialize;

#[cfg_attr(not(debug_assertions), allow(dead_code))]
pub const ENV_VAR: &str = "OLYMPUS_ACCEPTANCE_DIR";

/// Removed from this process only. Every provider path then fails with its
/// existing "needs …_API_KEY" error before any request is built.
pub const PROVIDER_KEYS: [&str; 2] = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"];

/// Gmail's errors are codes the webview maps to sentences (`gmailError`).
pub const GMAIL_DISABLED: &str = "gmail_acceptance_profile_disabled";

pub const DELEGATION_DISABLED: &str = "Disabled in the acceptance profile: delegation runs are \
not prepared or started. Plans, reviews and local verification checks stay available.";

/// `None` when unset or blank: PowerShell deletes a variable set to "", and a
/// blank value on other shells is the same intent. A relative path is anchored
/// to the working directory now, so it cannot silently mean something else to
/// a later `current_dir` change.
#[cfg_attr(not(debug_assertions), allow(dead_code))]
fn parse(raw: Option<OsString>, cwd: &Path) -> Option<PathBuf> {
    let raw = raw?;
    let text = raw.to_string_lossy();
    if text.trim().is_empty() {
        return None;
    }
    let path = PathBuf::from(raw);
    Some(if path.is_absolute() { path } else { cwd.join(path) })
}

/// What `run()` does with the environment before anything reads it.
#[derive(Debug, PartialEq, Eq)]
pub struct StartupEnvironment {
    pub load_dotenv: bool,
    pub remove: &'static [&'static str],
}

pub fn startup_environment(profile: Option<&Path>) -> StartupEnvironment {
    match profile {
        Some(_) => StartupEnvironment {
            load_dotenv: false,
            remove: &PROVIDER_KEYS,
        },
        None => StartupEnvironment {
            load_dotenv: true,
            remove: &[],
        },
    }
}

#[cfg(test)]
thread_local! {
    /// Per test thread, so parallel tests never see each other's profile and
    /// the real environment never leaks into the suite.
    static TEST_PROFILE: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

/// Runs `work` as if the profile pointed at `dir`, on this thread only.
#[cfg(test)]
pub(crate) fn with_profile<T>(dir: &Path, work: impl FnOnce() -> T) -> T {
    struct Reset;
    impl Drop for Reset {
        fn drop(&mut self) {
            TEST_PROFILE.with(|slot| *slot.borrow_mut() = None);
        }
    }
    TEST_PROFILE.with(|slot| *slot.borrow_mut() = Some(dir.to_path_buf()));
    let _reset = Reset;
    work()
}

#[cfg(test)]
pub fn acceptance_dir() -> Option<PathBuf> {
    TEST_PROFILE.with(|slot| slot.borrow().clone())
}

/// Read once: the answer must not change while the app runs, or a vault write
/// could resolve against one root and commit against another.
#[cfg(all(debug_assertions, not(test)))]
pub fn acceptance_dir() -> Option<PathBuf> {
    static PROFILE: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    PROFILE
        .get_or_init(|| {
            let cwd = std::env::current_dir().unwrap_or_default();
            parse(std::env::var_os(ENV_VAR), &cwd)
        })
        .clone()
}

#[cfg(not(debug_assertions))]
pub fn acceptance_dir() -> Option<PathBuf> {
    None
}

pub fn active() -> bool {
    acceptance_dir().is_some()
}

pub fn vault_path() -> Option<PathBuf> {
    acceptance_dir().map(|dir| dir.join("vault"))
}

pub fn projects_root() -> Option<PathBuf> {
    acceptance_dir().map(|dir| dir.join("projects"))
}

/// The production identifier. Its app data directory holds the real database
/// and WebView2 profile, so the acceptance profile must never run under it.
pub const PRODUCTION_IDENTIFIER: &str = "com.projectolympus.commandstation";

/// `scripts/acceptance/tauri.acceptance.json`. Its database holds seeded rows,
/// including an enabled Gmail account, that only this profile's refusals keep
/// away from `.env`, the real vault and the background workers.
pub const ACCEPTANCE_IDENTIFIER: &str = "com.projectolympus.acceptance";

/// Written to `processing_logs` at each acceptance launch. `seed-db.mjs` seeds
/// only a database carrying one for its own fixture directory, so the database
/// proves what it is rather than the path it was found at.
pub const LAUNCH_EVENT: &str = "acceptance-profile-launch";

/// Decides whether this process may start, from the compiled identifier and
/// the variable alone. `run()` calls it before `.env`, the builder, the window
/// and its webview profile, the database, the keyring and the workers: Tauri
/// creates the configured window before `setup`, so a check there is too late.
///
/// `--config` is merged at compile time, so the identifier describes the
/// binary, not the command line that happens to launch it. Every pairing other
/// than "variable and acceptance identifier" or "no variable and any other
/// identifier" is refused. Windows compares app data paths without case, so a
/// case variant of the acceptance identifier is refused as well.
pub fn check_startup(
    debug_build: bool,
    profile: Option<&Path>,
    identifier: &str,
) -> Result<(), String> {
    match profile {
        Some(dir) => {
            if identifier != ACCEPTANCE_IDENTIFIER {
                return Err(format!(
                    "{ENV_VAR} is set, but this build's identifier is {identifier}, not \
                     {ACCEPTANCE_IDENTIFIER}. Launch with --config \
                     scripts/acceptance/tauri.acceptance.json, or remove the variable \
                     (Remove-Item Env:{ENV_VAR}) for an ordinary launch."
                ));
            }
            if !dir.is_dir() {
                return Err(format!(
                    "{ENV_VAR} names {}, which is not an existing directory. Build the fixture \
                     first with node scripts/acceptance/build-fixtures.mjs, or correct the variable.",
                    dir.display()
                ));
            }
            Ok(())
        }
        None if identifier.eq_ignore_ascii_case(ACCEPTANCE_IDENTIFIER) => Err(if debug_build {
            format!(
                "This build uses the acceptance identifier ({identifier}) but {ENV_VAR} is not \
                 set in this shell. Set it to the fixture directory, or launch without the \
                 acceptance --config for an ordinary launch."
            )
        } else {
            format!(
                "This release build was compiled with the acceptance identifier ({identifier}). \
                 Release builds ignore {ENV_VAR}, so it would read the real vault, .env and \
                 Gmail. Rebuild without the acceptance --config."
            )
        }),
        None => Ok(()),
    }
}

/// Ends the process before anything is opened. Release builds have no console,
/// so on Windows the reason is also shown in a message box.
pub fn refuse_startup(message: &str) -> ! {
    eprintln!("[Olympus::Acceptance] refused to start: {message}");
    #[cfg(all(windows, not(debug_assertions)))]
    {
        let _ = rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("Olympus did not start")
            .set_description(message)
            .set_buttons(rfd::MessageButtons::Ok)
            .show();
    }
    std::process::exit(2);
}

/// Marks the acceptance database as opened by the profile for `dir`.
pub fn record_launch(
    connection: &rusqlite::Connection,
    dir: &Path,
    identifier: &str,
) -> rusqlite::Result<()> {
    let payload = serde_json::json!({ "dir": dir.display().to_string(), "identifier": identifier });
    connection.execute(
        "INSERT INTO processing_logs (event_type, message, payload_json) VALUES (?1, 'Acceptance profile launch', ?2)",
        [LAUNCH_EVENT, &payload.to_string()],
    )?;
    Ok(())
}

pub fn refuse_gmail() -> Result<(), String> {
    if active() {
        return Err(GMAIL_DISABLED.into());
    }
    Ok(())
}

pub fn refuse_delegation() -> Result<(), String> {
    if active() {
        return Err(DELEGATION_DISABLED.into());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct AcceptanceProfile {
    pub active: bool,
    pub dir: String,
}

/// Read-only. `null` outside the profile, which is every release build.
#[tauri::command]
pub fn acceptance_profile() -> Option<AcceptanceProfile> {
    acceptance_dir().map(|dir| AcceptanceProfile {
        active: true,
        dir: dir.display().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Every pairing of build, variable and identifier. This exercises the
    /// decision only; that `run()` makes it first is pinned separately below
    /// and was observed in the compiled binary (NATIVE-ACCEPTANCE report).
    #[test]
    fn startup_accepts_only_the_matching_pairs() {
        let fixture = std::env::temp_dir().join("olympus-acceptance-startup");
        fs::create_dir_all(&fixture).unwrap();
        let missing = std::env::temp_dir().join("olympus-acceptance-startup-missing");
        let _ = fs::remove_dir_all(&missing);

        for debug in [true, false] {
            // Ordinary launches, and the release build ignoring the variable.
            assert!(check_startup(debug, None, PRODUCTION_IDENTIFIER).is_ok());
            // The acceptance build without its variable, in either build.
            let refused = check_startup(debug, None, ACCEPTANCE_IDENTIFIER).unwrap_err();
            assert!(refused.contains(ENV_VAR));
            assert_eq!(refused.contains("release build"), !debug);
            assert!(check_startup(debug, None, "COM.ProjectOlympus.Acceptance").is_err());
        }
        // The variable is only ever set in a debug build.
        assert!(check_startup(true, Some(&fixture), ACCEPTANCE_IDENTIFIER).is_ok());
        let production = check_startup(true, Some(&fixture), PRODUCTION_IDENTIFIER).unwrap_err();
        assert!(production.contains("--config"));
        assert!(check_startup(true, Some(&fixture), "com.example.unknown").is_err());
        assert!(check_startup(true, Some(&fixture), "COM.projectolympus.acceptance").is_err());
        let absent = check_startup(true, Some(&missing), ACCEPTANCE_IDENTIFIER).unwrap_err();
        assert!(absent.contains("not an existing directory"));

        let _ = fs::remove_dir_all(fixture);
    }

    /// The checked-in configs must carry the identifier the check expects, or
    /// the acceptance build would be refused (or, worse, the check never match).
    #[test]
    fn both_acceptance_configs_use_the_acceptance_identifier() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../scripts/acceptance");
        for file in ["tauri.acceptance.json", "tauri.acceptance-nowebgl.json"] {
            let raw = fs::read_to_string(dir.join(file)).unwrap();
            let config: serde_json::Value = serde_json::from_str(&raw).unwrap();
            assert_eq!(config["identifier"], ACCEPTANCE_IDENTIFIER, "{file}");
        }
        let production: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(production["identifier"], PRODUCTION_IDENTIFIER);
    }

    /// Source order, not behaviour: `run()` decides before it loads `.env` or
    /// starts the builder, and `setup` no longer carries the check.
    #[test]
    fn run_checks_the_identity_before_the_environment_and_the_builder() {
        let source = include_str!("../lib.rs");
        let run = &source[source.find("pub fn run()").expect("run() exists")..];
        let check = run.find("check_startup(").expect("run() checks the identity");
        assert!(check < run.find("prepare_environment()").unwrap());
        assert!(check < run.find("tauri::Builder::default()").unwrap());
        assert!(!run.contains("check_identifier"));
    }

    #[test]
    fn the_launch_marker_names_the_fixture_directory() {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection.execute_batch(crate::SCHEMA).unwrap();
        let dir = std::env::temp_dir().join("olympus-acceptance-marker");
        record_launch(&connection, &dir, ACCEPTANCE_IDENTIFIER).unwrap();
        let payload: String = connection
            .query_row(
                "SELECT payload_json FROM processing_logs WHERE event_type = ?1",
                [LAUNCH_EVENT],
                |row| row.get(0),
            )
            .unwrap();
        let payload: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(payload["dir"], dir.display().to_string());
        assert_eq!(payload["identifier"], ACCEPTANCE_IDENTIFIER);
    }

    fn cwd() -> PathBuf {
        std::env::temp_dir().join("olympus-cwd")
    }

    #[test]
    fn unset_or_blank_means_no_profile() {
        assert_eq!(parse(None, &cwd()), None);
        assert_eq!(parse(Some("".into()), &cwd()), None);
        assert_eq!(parse(Some("   ".into()), &cwd()), None);
    }

    #[test]
    fn an_absolute_directory_is_used_as_given_and_a_relative_one_is_anchored() {
        let absolute = std::env::temp_dir().join("olympus-acceptance-x");
        assert_eq!(parse(Some(absolute.clone().into_os_string()), &cwd()), Some(absolute));
        assert_eq!(parse(Some("acc".into()), &cwd()), Some(cwd().join("acc")));
    }

    /// The release variant is `None` by construction; this pins that the test
    /// build does not read the process environment either.
    #[test]
    fn the_suite_never_inherits_a_profile_from_the_environment() {
        assert_eq!(acceptance_dir(), None);
        assert!(acceptance_profile().is_none());
        assert!(refuse_gmail().is_ok() && refuse_delegation().is_ok());
        assert_eq!(super::super::get_vault_path(), PathBuf::from(super::super::VAULT_PATH));
    }

    #[test]
    fn the_profile_skips_dotenv_and_drops_both_provider_keys() {
        let dir = std::env::temp_dir().join("olympus-acceptance-env");
        let plan = startup_environment(Some(&dir));
        assert!(!plan.load_dotenv);
        assert_eq!(plan.remove, &["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]);

        let ordinary = startup_environment(None);
        assert!(ordinary.load_dotenv);
        assert!(ordinary.remove.is_empty());
    }

    #[test]
    fn the_profile_redirects_the_vault_and_projects_and_refuses_launches() {
        let dir = std::env::temp_dir().join("olympus-acceptance-paths");
        with_profile(&dir, || {
            assert_eq!(super::super::get_vault_path(), dir.join("vault"));
            assert_eq!(projects_root(), Some(dir.join("projects")));
            assert_eq!(refuse_gmail(), Err(GMAIL_DISABLED.to_string()));
            assert_eq!(refuse_delegation(), Err(DELEGATION_DISABLED.to_string()));
            let profile = acceptance_profile().expect("reported while active");
            assert!(profile.active);
            assert_eq!(profile.dir, dir.display().to_string());
        });
        assert_eq!(acceptance_dir(), None, "the override ends with the closure");
    }
}
