//! Typed settings from `09 - System/User Profile.md`.
//!
//! The note is prose the operator maintains by hand; only the `olympus:` block
//! inside its frontmatter is machine-readable. Nesting under a namespace keeps
//! Obsidian's own keys (`title`, `type`, `status`, `tags`, `aliases`) clear of
//! ours and makes everything the app parses greppable.
//!
//! Every field is optional and every parse failure degrades to `None` with a
//! recorded warning. This module is reached on the assistant's turn path, so a
//! panic here would break chat entirely — a malformed profile must never stop
//! the app, and must never silently read as a configured one.
//!
//! The prose body continues to reach the model verbatim through
//! `vault_context`. This parses the same file for the app's own use and does
//! not change what the model sees.

use serde::Serialize;

use super::get_vault_path;
use super::pantheon::split_frontmatter;

const PROFILE_NOTE: &str = "09 - System/User Profile.md";

/// Applied by callers when the corresponding field is absent or unparseable.
pub const DEFAULT_BRIEF_TIME: TimeOfDay = TimeOfDay {
    hour: 7,
    minute: 30,
};
pub const DEFAULT_BRIEF_MAX_WORDS: u32 = 400;
pub const DEFAULT_ACTIVE_PROJECT_CAP: u32 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeOfDay {
    pub hour: u8,
    pub minute: u8,
}

impl TimeOfDay {
    fn parse(raw: &str) -> Option<Self> {
        let (hours, minutes) = raw.trim().split_once(':')?;
        let hour: u8 = hours.trim().parse().ok()?;
        let minute: u8 = minutes.trim().parse().ok()?;

        if hour > 23 || minute > 59 {
            return None;
        }

        Some(Self { hour, minute })
    }

    fn as_minutes(self) -> u16 {
        u16::from(self.hour) * 60 + u16::from(self.minute)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuietHours {
    pub start: TimeOfDay,
    pub end: TimeOfDay,
}

impl QuietHours {
    fn parse(raw: &str) -> Option<Self> {
        let (start, end) = raw.trim().split_once('-')?;
        Some(Self {
            start: TimeOfDay::parse(start)?,
            end: TimeOfDay::parse(end)?,
        })
    }

    /// True when `at` falls inside the window. Quiet hours normally wrap past
    /// midnight, so a plain range comparison is wrong for the common case.
    pub fn contains(self, at: TimeOfDay) -> bool {
        let (start, end, now) = (
            self.start.as_minutes(),
            self.end.as_minutes(),
            at.as_minutes(),
        );

        if start <= end {
            now >= start && now < end
        } else {
            now >= start || now < end
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProfileStatus {
    /// Starter content from the vault scaffold.
    Seed,
    /// Values placed by the app or by tooling as defaults, not chosen by the
    /// operator. Distinct from `seed` so a consumer can tell "nobody has set
    /// this" from "something guessed on your behalf".
    Assumed,
    /// The operator has set these deliberately.
    Active,
    Unknown,
}

impl Default for ProfileStatus {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperatorProfile {
    pub status: ProfileStatus,
    pub brief_time: Option<TimeOfDay>,
    pub brief_max_words: Option<u32>,
    pub active_project_cap: Option<u32>,
    pub quiet_hours: Option<QuietHours>,
    /// Fields that were present but unparseable. Surfaced so a typo is visible
    /// rather than behaving identically to leaving the field out.
    pub warnings: Vec<String>,
}

/// Reads and parses the profile note. Blocking; call from a blocking context.
pub fn load_operator_profile() -> OperatorProfile {
    let path = get_vault_path().join(PROFILE_NOTE);

    match std::fs::read_to_string(&path) {
        Ok(raw) => parse_operator_profile(&raw),
        Err(error) => {
            eprintln!("[Olympus::Profile] could not read {PROFILE_NOTE}: {error}");
            OperatorProfile {
                warnings: vec![format!("Could not read {PROFILE_NOTE}: {error}")],
                ..Default::default()
            }
        }
    }
}

fn parse_operator_profile(raw: &str) -> OperatorProfile {
    let mut warnings = Vec::new();

    let Some((frontmatter, _body)) = split_frontmatter(raw) else {
        return OperatorProfile {
            warnings: vec!["Profile note has no frontmatter block.".to_string()],
            ..Default::default()
        };
    };

    let yaml: serde_yaml::Value = match serde_yaml::from_str(frontmatter) {
        Ok(value) => value,
        Err(error) => {
            return OperatorProfile {
                warnings: vec![format!("Profile frontmatter is not valid YAML: {error}")],
                ..Default::default()
            };
        }
    };

    let status = match yaml.get("status").and_then(|value| value.as_str()) {
        Some("seed") => ProfileStatus::Seed,
        Some("assumed") => ProfileStatus::Assumed,
        Some("active") => ProfileStatus::Active,
        Some(other) => {
            warnings.push(format!(
                "Unrecognised profile status `{other}`; expected `seed`, `assumed`, or `active`."
            ));
            ProfileStatus::Unknown
        }
        None => ProfileStatus::Unknown,
    };

    // No `olympus:` block is a normal state, not an error: the note predates
    // this schema and stays valid without it.
    let Some(olympus) = yaml.get("olympus") else {
        return OperatorProfile {
            status,
            warnings,
            ..Default::default()
        };
    };

    let brief_time = typed_field(olympus, "brief_time", &mut warnings, |value| {
        value.as_str().and_then(TimeOfDay::parse)
    });
    let brief_max_words = typed_field(olympus, "brief_max_words", &mut warnings, positive_u32);
    let active_project_cap =
        typed_field(olympus, "active_project_cap", &mut warnings, positive_u32);
    let quiet_hours = typed_field(olympus, "quiet_hours", &mut warnings, |value| {
        value.as_str().and_then(QuietHours::parse)
    });

    OperatorProfile {
        status,
        brief_time,
        brief_max_words,
        active_project_cap,
        quiet_hours,
        warnings,
    }
}

/// Absent fields are silent; present-but-invalid fields warn. Conflating the
/// two would let a typo look like a deliberate omission.
fn typed_field<T>(
    node: &serde_yaml::Value,
    key: &str,
    warnings: &mut Vec<String>,
    parse: impl Fn(&serde_yaml::Value) -> Option<T>,
) -> Option<T> {
    let raw = node.get(key)?;

    match parse(raw) {
        Some(value) => Some(value),
        None => {
            warnings.push(format!(
                "`olympus.{key}` is present but could not be read; the default applies."
            ));
            None
        }
    }
}

fn positive_u32(value: &serde_yaml::Value) -> Option<u32> {
    let number = value.as_u64()?;
    if number == 0 {
        return None;
    }
    u32::try_from(number).ok()
}

#[tauri::command]
pub async fn fetch_operator_profile() -> Result<OperatorProfile, String> {
    tauri::async_runtime::spawn_blocking(load_operator_profile)
        .await
        .map_err(|error| format!("Profile load task panicked: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FULL: &str = "---\ntitle: User Profile\nstatus: active\nolympus:\n  brief_time: \"07:30\"\n  brief_max_words: 400\n  active_project_cap: 5\n  quiet_hours: \"22:00-07:00\"\n---\n\n# User Profile\n\nProse body.";

    #[test]
    fn parses_a_complete_profile() {
        let profile = parse_operator_profile(FULL);

        assert_eq!(profile.status, ProfileStatus::Active);
        assert_eq!(profile.brief_time, Some(TimeOfDay { hour: 7, minute: 30 }));
        assert_eq!(profile.brief_max_words, Some(400));
        assert_eq!(profile.active_project_cap, Some(5));
        assert_eq!(
            profile.quiet_hours,
            Some(QuietHours {
                start: TimeOfDay { hour: 22, minute: 0 },
                end: TimeOfDay { hour: 7, minute: 0 },
            })
        );
        assert!(profile.warnings.is_empty());
    }

    /// The note shipped before this schema existed and must stay valid.
    #[test]
    fn a_note_without_an_olympus_block_is_not_an_error() {
        let profile = parse_operator_profile("---\ntitle: User Profile\nstatus: seed\n---\n\nProse.");

        assert_eq!(profile.status, ProfileStatus::Seed);
        assert!(profile.brief_time.is_none());
        assert!(profile.warnings.is_empty());
    }

    #[test]
    fn a_malformed_field_warns_and_falls_back() {
        let profile = parse_operator_profile(
            "---\nstatus: active\nolympus:\n  brief_time: \"25:99\"\n  brief_max_words: 400\n---\n\nProse.",
        );

        assert!(profile.brief_time.is_none());
        assert_eq!(profile.brief_max_words, Some(400));
        assert_eq!(profile.warnings.len(), 1);
        assert!(profile.warnings[0].contains("brief_time"));
    }

    /// A bad profile must degrade, never panic — this module runs on the
    /// assistant's turn path.
    #[test]
    fn invalid_yaml_degrades_instead_of_panicking() {
        let profile = parse_operator_profile("---\n\tthis: is: not: yaml\n---\nbody");

        assert!(profile.brief_time.is_none());
        assert_eq!(profile.status, ProfileStatus::Unknown);
        assert!(!profile.warnings.is_empty());
    }

    #[test]
    fn a_note_without_frontmatter_degrades() {
        let profile = parse_operator_profile("# Just a heading\n\nProse.");

        assert_eq!(profile.status, ProfileStatus::Unknown);
        assert!(!profile.warnings.is_empty());
    }

    #[test]
    fn quiet_hours_wrapping_midnight_contains_both_sides() {
        let hours = QuietHours::parse("22:00-07:00").expect("valid window");

        assert!(hours.contains(TimeOfDay { hour: 23, minute: 0 }));
        assert!(hours.contains(TimeOfDay { hour: 2, minute: 30 }));
        assert!(hours.contains(TimeOfDay { hour: 22, minute: 0 }));
        assert!(!hours.contains(TimeOfDay { hour: 7, minute: 0 }));
        assert!(!hours.contains(TimeOfDay { hour: 12, minute: 0 }));
    }

    #[test]
    fn quiet_hours_within_one_day_do_not_wrap() {
        let hours = QuietHours::parse("09:00-17:00").expect("valid window");

        assert!(hours.contains(TimeOfDay { hour: 12, minute: 0 }));
        assert!(!hours.contains(TimeOfDay { hour: 8, minute: 59 }));
        assert!(!hours.contains(TimeOfDay { hour: 21, minute: 0 }));
    }

    #[test]
    fn rejects_out_of_range_and_malformed_times() {
        assert!(TimeOfDay::parse("24:00").is_none());
        assert!(TimeOfDay::parse("12:60").is_none());
        assert!(TimeOfDay::parse("noon").is_none());
        assert!(TimeOfDay::parse("7").is_none());
        assert!(QuietHours::parse("22:00").is_none());
    }

    #[test]
    fn zero_is_rejected_for_caps() {
        let profile = parse_operator_profile(
            "---\nolympus:\n  active_project_cap: 0\n---\nbody",
        );

        assert!(profile.active_project_cap.is_none());
        assert_eq!(profile.warnings.len(), 1);
    }

    /// Exercised against the operator's real note so schema drift or a renamed
    /// file surfaces as a failure rather than as silent defaults.
    ///
    /// Every failure path in this module degrades to defaults plus a warning,
    /// so printing alone would pass whether the note parsed or was missing
    /// entirely. Asserting the warnings are empty is what makes a typo in the
    /// operator's own frontmatter fail here instead of going unnoticed.
    #[test]
    fn debug_load_real_profile() {
        let profile = load_operator_profile();
        eprintln!("[profile] {profile:?}");

        assert!(
            get_vault_path().join(PROFILE_NOTE).exists(),
            "{PROFILE_NOTE} must exist for this test to mean anything"
        );
        assert!(
            profile.warnings.is_empty(),
            "the real profile note did not parse cleanly: {:?}",
            profile.warnings
        );
        assert_ne!(
            profile.status,
            ProfileStatus::Unknown,
            "the profile note should declare a recognised status"
        );
    }
}
