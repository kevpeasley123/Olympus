//! Loads the durable parts of the Obsidian vault into the assistant's context.
//!
//! Split into two tiers because of how prompt caching works: the API matches a
//! prefix, so anything that changes invalidates every byte after it. `stable`
//! holds notes that change rarely and sits behind the cache breakpoint;
//! `pantheon_index` changes whenever an entry is added, so it is rendered after
//! it and left uncached.

use std::fs;
use std::path::Path;

use super::get_vault_path;
use super::pantheon::parse_pantheon_from_vault;

/// Caps any single note so one long file cannot crowd out the rest of the
/// context. The vault notes are small today; this is a guard, not a budget.
const MAX_NOTE_CHARS: usize = 6_000;

/// Vault-relative notes that describe the operator and the system itself.
/// Ordered most- to least-important so truncation degrades sensibly.
///
/// Public so that notes which must *not* be in it can assert their absence —
/// see `observations.rs`. Everything here reaches the model as authoritative,
/// which is the reason inferred content is kept out.
pub const STABLE_NOTES: &[(&str, &str)] = &[
    ("Operator profile", "09 - System/User Profile.md"),
    ("Charter", "09 - System/Olympus Charter.md"),
    ("Skill index", "05 - Skills/Skill Index.md"),
    ("Agent index", "06 - Agents/Agent Index.md"),
];

#[derive(Debug, Default)]
pub struct VaultMemory {
    /// Operator profile, charter, and the skill/agent indexes.
    pub stable: String,
    /// One line per research entry — titles and metadata, never bodies.
    pub pantheon_index: String,
}

/// Reads the vault from disk. Blocking; call it from a blocking context.
pub fn load_vault_memory() -> VaultMemory {
    VaultMemory {
        stable: load_stable_notes(&get_vault_path()),
        pantheon_index: load_pantheon_index(),
    }
}

fn load_stable_notes(vault: &Path) -> String {
    if !vault.exists() {
        eprintln!(
            "[Olympus::VaultContext] vault path does not exist: {}",
            vault.display()
        );
        return String::new();
    }

    let mut out = String::new();

    for (label, relative) in STABLE_NOTES {
        match read_note(&vault.join(relative)) {
            Some(body) => {
                out.push_str(&format!("### {label}\n\n_Vault note: `{relative}`_\n\n"));
                out.push_str(&body);
                out.push_str("\n\n");
            }
            None => eprintln!("[Olympus::VaultContext] missing or unreadable: {relative}"),
        }
    }

    out
}

fn read_note(path: &Path) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return None;
    }

    if trimmed.chars().count() <= MAX_NOTE_CHARS {
        return Some(trimmed.to_string());
    }

    let mut clipped: String = trimmed.chars().take(MAX_NOTE_CHARS).collect();
    clipped.push_str("\n\n[... note truncated for context ...]");
    Some(clipped)
}

fn load_pantheon_index() -> String {
    let entries = match parse_pantheon_from_vault() {
        Ok(entries) => entries,
        Err(error) => {
            eprintln!("[Olympus::VaultContext] pantheon scan failed: {error}");
            return String::new();
        }
    };

    if entries.is_empty() {
        return "The Pantheon library has no entries yet.".to_string();
    }

    let mut out = format!(
        "{} entr{} in the Pantheon research library. Titles and metadata only — \
         the bodies are not included here.\n\n",
        entries.len(),
        if entries.len() == 1 { "y" } else { "ies" }
    );

    for entry in &entries {
        let source_type = entry.source_type.as_deref().unwrap_or("unspecified");
        let dated = entry
            .source_date
            .as_deref()
            .or(entry.created.as_deref())
            .unwrap_or("undated");

        out.push_str(&format!(
            "- \"{}\" — {}, {}, ~{} words, file `{}`",
            entry.title, source_type, dated, entry.word_count, entry.source_file
        ));

        // Stance is the field that makes disagreement possible, so it has to
        // reach the model. A stance nothing ever reads is decoration.
        out.push_str(&format!(", stance: {}", entry.stance));

        if let Some(origin) = entry.origin.as_deref() {
            out.push_str(&format!(", {origin}"));
        }

        // The gap is stated rather than left blank. An entry with no declared
        // purpose should be visibly unexplained, not silently indistinguishable
        // from one the operator justified.
        match entry.why_kept.as_deref() {
            Some(why) => out.push_str(&format!(", kept because: {why}")),
            None => out.push_str(", no stated purpose"),
        }

        if !entry.tags.is_empty() {
            out.push_str(&format!(" [{}]", entry.tags.join(", ")));
        }

        out.push('\n');
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_note_returns_none_for_a_missing_file() {
        assert!(read_note(Path::new("does-not-exist-anywhere.md")).is_none());
    }

    #[test]
    fn stable_notes_are_skipped_when_the_vault_is_absent() {
        assert!(load_stable_notes(Path::new("C:/no-such-vault-here")).is_empty());
    }

    /// Exercised against the operator's real vault so a renamed or moved System
    /// note shows up as a failure rather than as silently missing context.
    ///
    /// The assertions are the point: every read here degrades to an empty
    /// string on failure, so printing alone would pass whether the notes loaded
    /// or vanished.
    #[test]
    fn debug_load_real_vault_memory() {
        let memory = load_vault_memory();
        eprintln!(
            "[vault-context] stable={} chars, pantheon index={} chars",
            memory.stable.chars().count(),
            memory.pantheon_index.chars().count()
        );

        assert!(
            get_vault_path().exists(),
            "the real vault must be present for this test to mean anything"
        );
        assert!(
            !memory.stable.is_empty(),
            "no System notes loaded — a renamed or moved note silently empties the \
             assistant's durable memory"
        );

        for (label, _) in STABLE_NOTES {
            assert!(
                memory.stable.contains(label),
                "`{label}` is missing from the loaded context"
            );
        }

        assert!(
            !memory.pantheon_index.is_empty(),
            "the research index should describe the library, even when it is empty"
        );
    }
}
