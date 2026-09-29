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
