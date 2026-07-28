//! The append path for `09 - System/Profile Observations.md`.
//!
//! Two structural decisions, both load-bearing:
//!
//! **This note is not the operator's profile.** It holds what Olympus inferred,
//! and it is deliberately absent from `vault_context::STABLE_NOTES`. If model
//! inferences were read back into the assistant's context, they would arrive on
//! the next turn indistinguishable from the operator's own stated preferences,
//! and the system would start treating its own guesses as instructions. The
//! note the operator owns is `09 - System/User Profile.md`; nothing here is
//! allowed to leak into it.
//!
//! **Appending is not atomic.** A plain `OpenOptions::append` that is
//! interrupted — a crash, or OneDrive touching the file mid-write — leaves half
//! an entry in a note the operator reads by hand. So the whole file is composed
//! in memory, written to a temp file in the same directory, and renamed over
//! the target: atomic within a volume, and the failure mode is a leftover temp
//! file rather than a corrupted note.
//!
//! This is the first appender in the codebase and therefore the first real
//! exercise of `WriteIntent::AppendAuthored`, which always confirms.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::vault_write::{
    self, content_fingerprint, resolve_vault_path, summarise_diff, DiffSummary, WriteDecision,
    WriteIntent,
};
use super::write_confirm;

pub const OBSERVATIONS_NOTE: &str = "09 - System/Profile Observations.md";

/// An observation is one claim. The cap is a shape constraint, not a storage
/// one: past a couple of sentences it is a note, and notes belong in
/// `02 - Research` where they are titled and searchable.
const MAX_OBSERVATION_CHARS: usize = 500;

/// Written once, when the note does not exist yet. The prose is aimed at the
/// operator opening this in Obsidian six months from now and asking what wrote
/// it and whether it is authoritative.
const NOTE_HEADER: &str = "---\n\
title: Profile Observations\n\
type: system\n\
status: inferred\n\
tags:\n\
  - olympus/system\n\
---\n\
\n\
# Profile Observations\n\
\n\
What Olympus has inferred about how you work, appended one dated line at a\n\
time and never rewritten. Every line here was approved by you before it was\n\
written.\n\
\n\
This is **not** your profile. Nothing here was stated by you, and nothing here\n\
is read back into the assistant's context — an inference that fed itself back\n\
in would be indistinguishable from an instruction on the next turn. The note\n\
you own is `09 - System/User Profile.md`.\n\
\n\
Edit or delete anything below freely; Olympus only ever adds to the end.\n\
\n\
## Observations\n\
\n";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationRequest {
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationResult {
    pub path: String,
    /// False when the operator declined at the gate. Declining is a correct
    /// outcome, not a failure — same contract as `write_memory_artifact`.
    pub written: bool,
}

/// Collapses an observation to a single line.
///
/// One line per entry is what keeps the gate's diff preview complete: the
/// preview is capped, and a multi-line entry could scroll the part the operator
/// most needs to read out of view. It also keeps the note greppable.
fn normalise(text: &str) -> Result<String, String> {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if collapsed.is_empty() {
        return Err("An observation needs some text.".to_string());
    }

    // Rejected rather than truncated: silently storing half of what the
    // operator approved is exactly the class of quiet damage the gate exists
    // to prevent.
    let length = collapsed.chars().count();
    if length > MAX_OBSERVATION_CHARS {
        return Err(format!(
            "An observation is one claim, not a note — keep it under {MAX_OBSERVATION_CHARS} \
             characters (this one is {length})."
        ));
    }

    Ok(collapsed)
}

fn format_entry(date: &str, observation: &str) -> String {
    format!("- **{date}** — {observation}")
}

/// Builds the file's full next contents. Pure, so the composition rules are
/// testable without touching the vault.
fn compose(existing: Option<&str>, entry: &str) -> String {
    match existing {
        Some(current) if !current.trim().is_empty() => {
            format!("{}\n{}\n", current.trim_end(), entry)
        }
        // Absent or empty: seed the header. An empty file is treated as absent
        // because a zero-byte note is what a failed sync leaves behind, and
        // appending a bare bullet to it would produce a note with no context.
        _ => format!("{NOTE_HEADER}{entry}\n"),
    }
}

/// The diff the operator approves.
///
/// `summarise_diff` previews the first few added lines, which on the very first
/// write are the note's frontmatter — the operator would be asked to approve an
/// append without seeing the line being appended. This appender knows exactly
/// what it adds, so it guarantees that line is shown.
fn append_summary(before: Option<&str>, after: &str, entry: &str) -> DiffSummary {
    let mut summary = summarise_diff(before.unwrap_or_default(), after);

    if !summary.preview.iter().any(|line| line.contains(entry)) {
        summary.preview.insert(0, format!("+ {entry}"));
    }

    summary
}

fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Replaces `target` in one step: full contents to a sibling temp file, flushed
/// to disk, then renamed over the target.
///
/// The temp file is dot-prefixed so that if a rename fails and leaves it
/// behind, Obsidian hides it rather than indexing a duplicate note.
fn atomic_replace(target: &Path, content: &str) -> Result<(), String> {
    use std::io::Write;

    let parent = target
        .parent()
        .ok_or_else(|| "The observations note has no parent directory.".to_string())?;

    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The observations note has no file name.".to_string())?;
    let temp = parent.join(format!(".{file_name}.olympus-tmp"));

    let write_temp = || -> Result<(), String> {
        let mut handle = fs::File::create(&temp).map_err(|error| error.to_string())?;
        handle
            .write_all(content.as_bytes())
            .map_err(|error| error.to_string())?;
        // Without this the rename can land before the bytes do, which on a
        // crash leaves an empty file where the note used to be.
        handle.sync_all().map_err(|error| error.to_string())
    };

    if let Err(error) = write_temp() {
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not stage the observation: {error}"));
    }

    match rename_over(&temp, target) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temp);
            Err(error)
        }
    }
}

/// `fs::rename` replaces the destination on both platforms. On Windows it can
/// still fail with a sharing violation while Obsidian or OneDrive holds the
/// file open, which is a transient condition rather than a real error — hence
/// the short retry before giving up.
fn rename_over(temp: &Path, target: &Path) -> Result<(), String> {
    const ATTEMPTS: usize = 3;
    const BACKOFF: std::time::Duration = std::time::Duration::from_millis(60);

    let mut last_error = String::new();

    for attempt in 0..ATTEMPTS {
        match fs::rename(temp, target) {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_error = error.to_string();
                if attempt + 1 < ATTEMPTS {
                    std::thread::sleep(BACKOFF);
                }
            }
        }
    }

    Err(format!(
        "Could not replace the observations note ({last_error}). It may be open in another \
         program — close it and try again."
    ))
}

fn read_note(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()
}

/// Appends one dated observation, after the operator approves it.
#[tauri::command]
pub async fn append_profile_observation(
    app: tauri::AppHandle,
    db: tauri::State<'_, crate::commands::persistence::Db>,
    request: ObservationRequest,
) -> Result<ObservationResult, String> {
    let observation = normalise(&request.text)?;

    let relative = PathBuf::from(OBSERVATIONS_NOTE);
    let target = resolve_vault_path(&relative).map_err(|error| error.to_string())?;

    let read_target = target.clone();
    let before = tauri::async_runtime::spawn_blocking(move || read_note(&read_target))
        .await
        .map_err(|error| format!("Observation read task panicked: {error}"))?;

    let entry = format_entry(&today(), &observation);
    let after = compose(before.as_deref(), &entry);

    // AppendAuthored always confirms, so this decision is not in doubt — it is
    // routed through `decide` anyway so the appender cannot quietly diverge
    // from the gate's own table if that classification ever changes.
    let decision = vault_write::decide(WriteIntent::AppendAuthored, before.as_deref(), None);

    if let WriteDecision::NeedsConfirmation(reason) = decision {
        let summary = append_summary(before.as_deref(), &after, &entry);
        let approved = write_confirm::request_confirmation(
            &app,
            OBSERVATIONS_NOTE.to_string(),
            WriteIntent::AppendAuthored,
            reason,
            summary,
        )
        .await;

        if !approved {
            return Ok(ObservationResult {
                path: target.to_string_lossy().to_string(),
                written: false,
            });
        }
    }

    // The gate can hold for up to two minutes, and this write replaces the
    // whole file. If the note changed while the dialog was open — a second
    // observation approved first, or an edit in Obsidian — then `after` was
    // composed against contents that no longer exist and writing it would
    // silently drop whatever landed in between.
    let recheck_target = target.clone();
    let expected = before.as_deref().map(content_fingerprint);

    let write_target = target.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let current = read_note(&recheck_target).as_deref().map(content_fingerprint);

        if current != expected {
            return Err(
                "The observations note changed while the confirmation was open, so this entry \
                 was not added. Try again."
                    .to_string(),
            );
        }

        atomic_replace(&write_target, &after)
    })
    .await
    .map_err(|error| format!("Observation write task panicked: {error}"))??;

    crate::commands::persistence::log_vault_write(db.inner(), OBSERVATIONS_NOTE, "append");

    Ok(ObservationResult {
        path: target.to_string_lossy().to_string(),
        written: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::vault_context::STABLE_NOTES;

    /// The decision this module exists to encode. An inference that reaches the
    /// assistant's durable context is a preference by the next turn.
    #[test]
    fn observations_are_not_loaded_into_the_assistants_context() {
        assert!(
            !STABLE_NOTES
                .iter()
                .any(|(_, relative)| *relative == OBSERVATIONS_NOTE),
            "{OBSERVATIONS_NOTE} must stay out of STABLE_NOTES — model inferences fed back into \
             the prompt become indistinguishable from the operator's own instructions"
        );
    }

    #[test]
    fn a_new_note_gets_the_header_and_the_first_entry() {
        let composed = compose(None, "- **2026-07-25** — prefers dense interfaces");

        assert!(composed.starts_with("---\n"));
        assert!(composed.contains("## Observations"));
        assert!(composed.ends_with("- **2026-07-25** — prefers dense interfaces\n"));
    }

    /// A zero-byte file is what an interrupted sync leaves behind; appending to
    /// it must rebuild the header rather than produce a headerless bullet list.
    #[test]
    fn an_empty_file_is_reseeded_rather_than_appended_to() {
        for existing in ["", "   \n\n"] {
            assert!(compose(Some(existing), "- **2026-07-25** — x").contains("## Observations"));
        }
    }

    #[test]
    fn an_existing_note_keeps_every_line_and_gains_one() {
        let existing = format!("{NOTE_HEADER}- **2026-07-01** — first\n");
        let composed = compose(Some(&existing), "- **2026-07-25** — second");

        assert!(composed.contains("- **2026-07-01** — first"));
        assert!(composed.contains("- **2026-07-25** — second"));
        assert_eq!(composed.matches("## Observations").count(), 1);
        assert_eq!(composed.lines().count(), existing.lines().count() + 1);
    }

    /// Appending must never rewrite what is already there — that is the whole
    /// difference between this and `write_memory_artifact`.
    #[test]
    fn hand_written_lines_survive_an_append() {
        let edited = format!(
            "{NOTE_HEADER}- **2026-07-01** — first\n\nI disagree with the line above. — K\n"
        );
        let composed = compose(Some(&edited), "- **2026-07-25** — second");

        assert!(composed.contains("I disagree with the line above. — K"));
        assert!(composed.starts_with(&edited.trim_end().to_string()));
    }

    #[test]
    fn the_diff_the_operator_approves_only_adds() {
        let existing = format!("{NOTE_HEADER}- **2026-07-01** — first\n");
        let entry = "- **2026-07-25** — second";
        let composed = compose(Some(&existing), entry);
        let summary = append_summary(Some(&existing), &composed, entry);

        assert_eq!(summary.removed, 0);
        assert_eq!(summary.added, 1);
        assert!(summary.preview.iter().any(|line| line.contains("second")));
    }

    /// The first write also creates the note, and its header is long enough to
    /// fill the capped preview. Approving an append without seeing the appended
    /// line is the one thing the dialog must never ask for.
    #[test]
    fn the_first_write_still_previews_the_line_being_added() {
        let entry = "- **2026-07-25** — the very first observation";
        let composed = compose(None, entry);
        let summary = append_summary(None, &composed, entry);

        assert_eq!(summary.removed, 0);
        assert!(
            summary
                .preview
                .iter()
                .any(|line| line.contains("the very first observation")),
            "preview was {:?}",
            summary.preview
        );
    }

    #[test]
    fn multi_line_text_collapses_to_one_line() {
        let normalised = normalise("  works in\n\n bursts,\tlate  ").expect("valid observation");

        assert_eq!(normalised, "works in bursts, late");
        assert!(!format_entry("2026-07-25", &normalised).contains('\n'));
    }

    #[test]
    fn blank_observations_are_rejected() {
        assert!(normalise("").is_err());
        assert!(normalise("   \n\t ").is_err());
    }

    #[test]
    fn an_over_long_observation_is_rejected_rather_than_truncated() {
        let long = "x".repeat(MAX_OBSERVATION_CHARS + 1);
        let error = normalise(&long).expect_err("an over-long observation must be refused");

        assert!(error.contains(&MAX_OBSERVATION_CHARS.to_string()));
    }

    #[test]
    fn the_entry_carries_its_date() {
        assert_eq!(
            format_entry("2026-07-25", "an observation"),
            "- **2026-07-25** — an observation"
        );
    }

    #[test]
    fn todays_date_is_the_iso_form_the_entry_expects() {
        let date = today();

        assert_eq!(date.len(), 10);
        assert_eq!(date.matches('-').count(), 2);
        assert!(date.chars().filter(|c| c.is_ascii_digit()).count() == 8);
    }

    /// Exercises the real filesystem path — the temp file, the rename over an
    /// existing target, and the absence of leftovers. The composition tests
    /// above prove nothing about whether the rename actually lands.
    #[test]
    fn atomic_replace_lands_the_content_and_leaves_no_temp_file() {
        let dir = std::env::temp_dir().join("olympus-observations-atomic");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");

        let target = dir.join("Profile Observations.md");

        atomic_replace(&target, "first\n").expect("first write");
        assert_eq!(fs::read_to_string(&target).unwrap(), "first\n");

        // The rename has to replace an existing file, not fail against it.
        atomic_replace(&target, "first\nsecond\n").expect("second write");
        assert_eq!(fs::read_to_string(&target).unwrap(), "first\nsecond\n");

        assert!(
            !dir.join(".Profile Observations.md.olympus-tmp").exists(),
            "the staging file must not survive a successful write"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    /// The target's directory may not exist on a fresh vault.
    #[test]
    fn atomic_replace_creates_the_containing_folder() {
        let dir = std::env::temp_dir().join("olympus-observations-mkdir");
        let _ = fs::remove_dir_all(&dir);

        let target = dir.join("09 - System").join("Profile Observations.md");
        atomic_replace(&target, "seeded\n").expect("write into a missing folder");

        assert_eq!(fs::read_to_string(&target).unwrap(), "seeded\n");

        let _ = fs::remove_dir_all(&dir);
    }
}
