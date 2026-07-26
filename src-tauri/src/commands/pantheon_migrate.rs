//! One-shot migration for the `origin` repurpose.
//!
//! `origin` used to hold writer provenance — every entry written before the
//! schema change says `origin: "Olympus dashboard"`. It now answers a different
//! question: who *found* the source. The parser already refuses to read a
//! legacy value as an origin (see `extract_enum`), so an un-migrated entry is
//! not dangerous, only incomplete. This moves the old value to `written_by` and
//! states the fields the entry was written without.
//!
//! `why_kept` is never invented. An entry migrated by tooling has no stated
//! purpose, and saying otherwise would put words in the operator's mouth about
//! the one field whose whole value is that he wrote it.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use walkdir::WalkDir;

use super::pantheon::{extract_tags, split_frontmatter, ORIGIN_VALUES};
use super::vault_write::{self, resolve_vault_path, WriteDecision, WriteIntent};
use super::write_confirm;
use super::get_vault_path;

const RESEARCH_FOLDER: &str = "02 - Research";
const REQUIRED_TAG: &str = "olympus/research";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationOutcome {
    /// Vault-relative paths that were rewritten.
    pub migrated: Vec<String>,
    /// Entries that already carried the new schema.
    pub already_current: Vec<String>,
    /// Entries the operator declined at the gate. Declining is a correct
    /// outcome, not a failure.
    pub declined: Vec<String>,
    pub failed: Vec<String>,
}

/// Reads the value of a top-level frontmatter key, quotes stripped.
fn value_of<'a>(frontmatter: &'a str, key: &str) -> Option<&'a str> {
    frontmatter.lines().find_map(|line| {
        let rest = line.strip_prefix(key)?.strip_prefix(':')?;
        Some(rest.trim().trim_matches('"'))
    })
}

/// Rewrites one frontmatter block, or `None` when there is nothing to do.
///
/// Pure, so the rules are testable without a vault. Everything it does not
/// recognise is left exactly as it found it — this runs over notes a human may
/// have edited, and a migration that reformats unrelated keys is indistinguishable
/// from one that damages them.
pub(crate) fn migrate_frontmatter(frontmatter: &str) -> Option<String> {
    let newline = if frontmatter.contains("\r\n") { "\r\n" } else { "\n" };

    let legacy_origin = value_of(frontmatter, "origin")
        .filter(|value| !ORIGIN_VALUES.contains(value))
        .map(|value| value.to_string());
    let needs_stance = value_of(frontmatter, "stance").is_none();

    if legacy_origin.is_none() && !needs_stance {
        return None;
    }

    let mut out: Vec<String> = Vec::new();
    let mut stance_placed = false;

    for line in frontmatter.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);

        let is_legacy_origin_line = legacy_origin.is_some()
            && line
                .strip_prefix("origin:")
                .map(|rest| rest.trim().trim_matches('"'))
                .is_some_and(|value| !ORIGIN_VALUES.contains(&value));

        if is_legacy_origin_line {
            let legacy = legacy_origin.as_deref().unwrap_or_default();
            out.push(format!("written_by: \"{legacy}\""));
            // Everything already in the vault was put there by the operator's
            // own hand, so `collected` is the true value rather than a default.
            out.push("origin: collected".to_string());
            if needs_stance {
                out.push("stance: unevaluated".to_string());
                stance_placed = true;
            }
            continue;
        }

        out.push(line.to_string());
    }

    // No origin line to anchor to — the stance still has to land somewhere.
    if needs_stance && !stance_placed {
        out.push("stance: unevaluated".to_string());
    }

    Some(out.join(newline))
}

fn research_entries(vault: &Path) -> Vec<PathBuf> {
    let folder = vault.join(RESEARCH_FOLDER);
    if !folder.exists() {
        return Vec::new();
    }

    WalkDir::new(&folder)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.path().to_path_buf())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("md"))
        .filter(|path| {
            let Ok(content) = fs::read_to_string(path) else {
                return false;
            };
            let Some((frontmatter_str, _)) = split_frontmatter(&content) else {
                return false;
            };
            let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(frontmatter_str) else {
                return false;
            };
            extract_tags(&value).iter().any(|tag| tag == REQUIRED_TAG)
        })
        .collect()
}

/// Moves legacy `origin` values to `written_by` across the research library.
///
/// One confirmation per file: the gate's contract is a single path and a single
/// diff, and batching them behind one prompt would ask the operator to approve
/// changes they were never shown.
#[tauri::command]
pub async fn migrate_pantheon_schema(app: tauri::AppHandle) -> Result<MigrationOutcome, String> {
    let vault = get_vault_path();
    let files = tauri::async_runtime::spawn_blocking(move || research_entries(&vault))
        .await
        .map_err(|error| format!("Migration scan panicked: {error}"))?;

    let mut outcome = MigrationOutcome {
        migrated: Vec::new(),
        already_current: Vec::new(),
        declined: Vec::new(),
        failed: Vec::new(),
    };

    for path in files {
        let relative = path
            .strip_prefix(get_vault_path())
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let before = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) => {
                outcome.failed.push(format!("{relative}: {error}"));
                continue;
            }
        };

        let Some((frontmatter_str, body)) = split_frontmatter(&before) else {
            outcome.failed.push(format!("{relative}: no frontmatter"));
            continue;
        };

        let Some(migrated_frontmatter) = migrate_frontmatter(frontmatter_str) else {
            outcome.already_current.push(relative);
            continue;
        };

        let after = format!("---\n{migrated_frontmatter}\n---\n\n{body}");

        // These are notes the operator may have edited by hand, so the intent is
        // ModifyAuthored and the gate shows a diff before anything is touched.
        let decision = vault_write::decide(WriteIntent::ModifyAuthored, Some(&before), None);

        if let WriteDecision::NeedsConfirmation(reason) = decision {
            let summary = vault_write::summarise_diff(&before, &after);
            let approved = write_confirm::request_confirmation(
                &app,
                relative.clone(),
                WriteIntent::ModifyAuthored,
                reason,
                summary,
            )
            .await;

            if !approved {
                outcome.declined.push(relative);
                continue;
            }
        }

        let target = match resolve_vault_path(Path::new(&relative)) {
            Ok(target) => target,
            Err(error) => {
                outcome.failed.push(format!("{relative}: {error}"));
                continue;
            }
        };

        // Re-read after approval. The gate can hold for two minutes and this is
        // a full-file replace, so an edit that landed while the dialog was open
        // would otherwise be discarded.
        let recheck = before.clone();
        let write_target = target.clone();
        let written = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            match fs::read_to_string(&write_target) {
                Ok(current) if current != recheck => Err(
                    "The note changed while the confirmation was open, so it was left alone."
                        .to_string(),
                ),
                _ => fs::write(&write_target, after).map_err(|error| error.to_string()),
            }
        })
        .await
        .map_err(|error| format!("Migration write panicked: {error}"))?;

        match written {
            Ok(()) => outcome.migrated.push(relative),
            Err(error) => outcome.failed.push(format!("{relative}: {error}")),
        }
    }

    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LEGACY: &str = "title: \"A talk\"\ntype: research\ncreated: \"2026-04-26\"\norigin: \"Olympus Pantheon\"\ntags:\n  - olympus/research";

    #[test]
    fn a_legacy_origin_moves_to_written_by_and_the_entry_gains_the_new_fields() {
        let migrated = migrate_frontmatter(LEGACY).expect("legacy frontmatter needs migrating");

        assert!(migrated.contains("written_by: \"Olympus Pantheon\""));
        assert!(migrated.contains("origin: collected"));
        assert!(migrated.contains("stance: unevaluated"));
    }

    /// The field whose only value is that the operator wrote it. Tooling that
    /// guesses here is worse than tooling that leaves the gap visible.
    #[test]
    fn no_purpose_is_invented() {
        let migrated = migrate_frontmatter(LEGACY).expect("needs migrating");
        assert!(!migrated.contains("why_kept"));
    }

    #[test]
    fn unrelated_keys_survive_untouched() {
        let migrated = migrate_frontmatter(LEGACY).expect("needs migrating");

        assert!(migrated.contains("title: \"A talk\""));
        assert!(migrated.contains("type: research"));
        assert!(migrated.contains("created: \"2026-04-26\""));
        assert!(migrated.contains("  - olympus/research"));
    }

    #[test]
    fn an_already_migrated_entry_is_left_alone() {
        let current = "title: \"x\"\norigin: collected\nstance: disputed\ntags:\n  - olympus/research";
        assert_eq!(migrate_frontmatter(current), None);
    }

    /// Running it twice must not append a second stance or re-wrap `written_by`.
    #[test]
    fn migrating_twice_changes_nothing_the_second_time() {
        let once = migrate_frontmatter(LEGACY).expect("needs migrating");
        assert_eq!(migrate_frontmatter(&once), None);
    }

    #[test]
    fn an_entry_with_no_origin_still_gains_a_stance() {
        let no_origin = "title: \"x\"\ntype: research";
        let migrated = migrate_frontmatter(no_origin).expect("needs a stance");

        assert!(migrated.contains("stance: unevaluated"));
        assert!(!migrated.contains("written_by"));
        assert!(!migrated.contains("origin:"));
    }

    #[test]
    fn crlf_frontmatter_stays_crlf() {
        let crlf = LEGACY.replace('\n', "\r\n");
        let migrated = migrate_frontmatter(&crlf).expect("needs migrating");

        assert!(migrated.contains("\r\n"));
        assert!(!migrated.contains("\n\n"), "no bare LF should be introduced");
    }
}
