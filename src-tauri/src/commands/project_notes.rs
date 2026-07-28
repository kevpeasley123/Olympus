//! Project *intent*, declared by the operator in `01 - Projects/*.md`.
//!
//! Git can say what a repository is doing; only the operator can say what it is
//! for. This module reads the second half of that pair. The scan in
//! `projects.rs` joins them, and the division is strict: Git owns branch, dirty
//! state, and commits; a note owns status, promotion date, and next step.
//! Neither writes the other's fields, so no value ever has two sources.
//!
//! Every field is optional and every parse failure degrades to `None` with a
//! recorded warning — the same contract as `profile.rs`, and for the same
//! reason: a malformed note must never read as a configured one. Warnings are
//! carried to the UI rather than only logged, because a status that silently
//! failed to parse looks exactly like a project the operator never classified.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use serde::Serialize;

use super::get_vault_path;
use super::pantheon::{extract_tags, split_frontmatter};

const PROJECTS_FOLDER: &str = "01 - Projects";

/// The tag or `type` a note must declare to be treated as a project.
///
/// `01 - Projects` also holds reference material — `Olympus/Design Evolution.md`
/// carries `type: project-reference`. Without this filter it would join nothing
/// and then render as a project that has no repository.
const PROJECT_TYPE: &str = "project";
const PROJECT_TAG: &str = "olympus/project";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Active,
    Watching,
    Scaffold,
    Archived,
    /// No note, or a note that does not say. Never written in frontmatter —
    /// this is the absence marker, and it is deliberately distinct from
    /// `Scaffold`, which is a decision the operator made.
    Unclassified,
}

impl ProjectStatus {
    /// Display order. `Unclassified` sits directly under `Active` rather than
    /// at the bottom: on a vault where most projects have no note yet, burying
    /// them would hide most of what the operator actually works on.
    pub fn rank(self) -> u8 {
        match self {
            Self::Active => 0,
            Self::Unclassified => 1,
            Self::Watching => 2,
            Self::Scaffold => 3,
            Self::Archived => 4,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Watching => "watching",
            Self::Scaffold => "scaffold",
            Self::Archived => "archived",
            Self::Unclassified => "unclassified",
        }
    }

    /// `unclassified` is not accepted here. It means "nobody said", so writing
    /// it into a note would be a claim that the note does not make.
    fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "active" => Some(Self::Active),
            "watching" => Some(Self::Watching),
            "scaffold" => Some(Self::Scaffold),
            "archived" => Some(Self::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProjectNote {
    pub status: Option<ProjectStatus>,
    pub promoted: Option<String>,
    pub next_step: Option<String>,
    /// Vault-relative, for display and for telling two notes apart.
    pub note_path: String,
    pub warnings: Vec<String>,
}

/// Notes keyed by every name they answer to.
#[derive(Debug, Default)]
pub struct ProjectNoteIndex {
    notes: Vec<ProjectNote>,
    by_key: HashMap<String, usize>,
    /// Keys claimed by more than one note. A lookup on one of these refuses to
    /// match rather than picking a winner.
    ambiguous: HashSet<String>,
    /// Problems that belong to the folder rather than to a single note.
    pub warnings: Vec<String>,
}

impl ProjectNoteIndex {
    pub fn lookup(&self, name: &str) -> Option<&ProjectNote> {
        let key = normalise_key(name);

        if self.ambiguous.contains(&key) {
            return None;
        }

        self.by_key.get(&key).map(|index| &self.notes[*index])
    }

    pub fn notes(&self) -> &[ProjectNote] {
        &self.notes
    }
}

/// Lowercased and whitespace-collapsed, so `Project  Olympus` and
/// `project olympus` are the same key.
fn normalise_key(raw: &str) -> String {
    raw.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

/// Reads and indexes the folder. Blocking; call it from a blocking context.
impl ProjectNoteIndex {
    /// Vault-relative paths of every note that declared itself a project.
    ///
    /// Exposed for the vault graph, whose anchors must be the *declared*
    /// projects rather than everything sitting in `01 - Projects` — that folder
    /// also holds notes like `Olympus/Design Evolution.md`, which is why the
    /// `type: project` rule exists at all.
    pub fn note_paths(&self) -> Vec<&str> {
        self.notes.iter().map(|note| note.note_path.as_str()).collect()
    }
}

pub fn load_project_notes() -> ProjectNoteIndex {
    load_project_notes_from(&get_vault_path().join(PROJECTS_FOLDER))
}

/// Parameterised on the folder so tests run against a temp directory rather
/// than the operator's vault.
pub fn load_project_notes_from(folder: &Path) -> ProjectNoteIndex {
    let mut index = ProjectNoteIndex::default();

    let entries = match fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) => {
            // A missing folder is a normal state on a fresh vault, not an
            // error worth surfacing — every project simply stays unclassified.
            eprintln!("[Olympus::ProjectNotes] could not read {PROJECTS_FOLDER}: {error}");
            return index;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            continue;
        }

        let Ok(raw) = fs::read_to_string(&path) else {
            index.warnings.push(format!(
                "Could not read {}.",
                path.file_name().unwrap_or_default().to_string_lossy()
            ));
            continue;
        };

        let file_stem = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_string();
        let note_path = format!("{PROJECTS_FOLDER}/{}",
            path.file_name().unwrap_or_default().to_string_lossy());

        let Some((note, keys)) = parse_project_note(&raw, &file_stem, &note_path) else {
            continue;
        };

        let position = index.notes.len();
        index.notes.push(note);

        for key in keys {
            if let Some(existing) = index.by_key.get(&key) {
                // Two notes answering to one name. Picking either would be a
                // coin flip that looks like a decision, so neither matches.
                let existing_path = index.notes[*existing].note_path.clone();
                let new_path = index.notes[position].note_path.clone();
                index.warnings.push(format!(
                    "`{key}` is claimed by both {existing_path} and {new_path}; neither will be \
                     matched to a project until one of them changes."
                ));
                index.ambiguous.insert(key);
                continue;
            }

            index.by_key.insert(key, position);
        }
    }

    index
}

/// Returns the note and every name it answers to, or `None` when the file is
/// not a project note at all.
fn parse_project_note(
    raw: &str,
    file_stem: &str,
    note_path: &str,
) -> Option<(ProjectNote, Vec<String>)> {
    // `split_frontmatter` strips the UTF-8 BOM the PowerShell scaffold writes.
    // Without that, every scaffolded note reads as unstructured prose — which
    // is exactly how the Pantheon scanner lost all of its entries once.
    let (frontmatter, _body) = split_frontmatter(raw)?;

    let yaml: serde_yaml::Value = serde_yaml::from_str(frontmatter).ok()?;

    if !declares_itself_a_project(&yaml) {
        return None;
    }

    let mut warnings = Vec::new();

    let status = match yaml.get("status").and_then(|value| value.as_str()) {
        Some(raw_status) => match ProjectStatus::parse(raw_status) {
            Some(parsed) => Some(parsed),
            None => {
                warnings.push(format!(
                    "{note_path}: `{raw_status}` is not a recognised status; expected `active`, \
                     `watching`, `scaffold`, or `archived`."
                ));
                None
            }
        },
        None => None,
    };

    let promoted = match yaml.get("promoted") {
        Some(value) => match value.as_str().filter(|text| is_iso_date(text)) {
            Some(text) => Some(text.to_string()),
            None => {
                warnings.push(format!(
                    "{note_path}: `promoted` should be a YYYY-MM-DD date in quotes."
                ));
                None
            }
        },
        None => None,
    };

    let next_step = yaml
        .get("next_step")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string);

    let mut keys = vec![normalise_key(file_stem)];

    if let Some(title) = yaml.get("title").and_then(|value| value.as_str()) {
        push_key(&mut keys, title);
    }

    for alias in aliases(&yaml) {
        push_key(&mut keys, &alias);
    }

    Some((
        ProjectNote {
            status,
            promoted,
            next_step,
            note_path: note_path.to_string(),
            warnings,
        },
        keys,
    ))
}

fn push_key(keys: &mut Vec<String>, raw: &str) {
    let key = normalise_key(raw);

    if !key.is_empty() && !keys.contains(&key) {
        keys.push(key);
    }
}

fn declares_itself_a_project(yaml: &serde_yaml::Value) -> bool {
    let typed = yaml
        .get("type")
        .and_then(|value| value.as_str())
        .map(|text| text.trim().eq_ignore_ascii_case(PROJECT_TYPE))
        .unwrap_or(false);

    typed || extract_tags(yaml).iter().any(|tag| tag == PROJECT_TAG)
}

/// Obsidian writes aliases as a list, but a single scalar is valid YAML and
/// people write it.
fn aliases(yaml: &serde_yaml::Value) -> Vec<String> {
    let Some(node) = yaml.get("aliases") else {
        return Vec::new();
    };

    if let Some(text) = node.as_str() {
        return vec![text.to_string()];
    }

    node.as_sequence()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn is_iso_date(text: &str) -> bool {
    let bytes = text.as_bytes();

    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("olympus-project-notes-{name}"));
        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).expect("create temp folder");
        folder
    }

    fn write(folder: &Path, name: &str, contents: &str) {
        fs::write(folder.join(name), contents).expect("write note");
    }

    const OLYMPUS_NOTE: &str = "---\ntitle: Project Olympus\ntype: project\nstatus: active\naliases:\n  - Olympus\n---\n\nBody.";

    #[test]
    fn a_note_is_found_by_its_filename() {
        let folder = temp_folder("by-filename");
        write(&folder, "Pokedex.md", "---\ntype: project\nstatus: watching\n---\n\nBody.");

        let index = load_project_notes_from(&folder);

        assert_eq!(
            index.lookup("Pokedex").and_then(|note| note.status),
            Some(ProjectStatus::Watching)
        );
    }

    /// The real case: the note is `Project Olympus.md` but the repository
    /// directory is `Olympus`. Only the alias bridges them.
    #[test]
    fn a_note_is_found_by_its_alias_when_the_filename_differs() {
        let folder = temp_folder("by-alias");
        write(&folder, "Project Olympus.md", OLYMPUS_NOTE);

        let index = load_project_notes_from(&folder);

        assert_eq!(
            index.lookup("Olympus").and_then(|note| note.status),
            Some(ProjectStatus::Active),
            "the alias must join the note to its repository directory"
        );
        assert!(index.lookup("Project Olympus").is_some(), "the filename still matches");
    }

    #[test]
    fn a_note_is_found_by_its_title() {
        let folder = temp_folder("by-title");
        write(
            &folder,
            "note.md",
            "---\ntitle: Fruit Organizer\ntype: project\nstatus: scaffold\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);

        assert_eq!(
            index.lookup("Fruit Organizer").and_then(|note| note.status),
            Some(ProjectStatus::Scaffold)
        );
    }

    #[test]
    fn lookup_ignores_case_and_extra_whitespace() {
        let folder = temp_folder("normalised");
        write(&folder, "Project Olympus.md", OLYMPUS_NOTE);

        let index = load_project_notes_from(&folder);

        assert!(index.lookup("olympus").is_some());
        assert!(index.lookup("  OLYMPUS  ").is_some());
    }

    /// Picking one of two notes that claim the same name would be a coin flip
    /// rendered as a decision.
    #[test]
    fn two_notes_claiming_one_name_match_neither() {
        let folder = temp_folder("ambiguous");
        write(&folder, "Olympus.md", "---\ntype: project\nstatus: active\n---\n\nOne.");
        write(
            &folder,
            "Other.md",
            "---\ntype: project\nstatus: archived\naliases:\n  - Olympus\n---\n\nTwo.",
        );

        let index = load_project_notes_from(&folder);

        assert!(index.lookup("Olympus").is_none());
        assert_eq!(index.warnings.len(), 1);
        assert!(index.warnings[0].contains("olympus"));
    }

    /// `01 - Projects` also holds reference material. A note that does not
    /// declare itself a project must not become a phantom project row.
    #[test]
    fn reference_notes_in_the_folder_are_not_projects() {
        let folder = temp_folder("reference");
        write(
            &folder,
            "Design Evolution.md",
            "---\ntitle: Olympus — Design Evolution\ntype: project-reference\ntags:\n  - design\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);

        assert!(index.notes().is_empty());
        assert!(index.lookup("Design Evolution").is_none());
    }

    #[test]
    fn the_olympus_project_tag_also_declares_a_project() {
        let folder = temp_folder("by-tag");
        write(
            &folder,
            "Tagged.md",
            "---\ntags:\n  - olympus/project\nstatus: active\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);

        assert_eq!(index.notes().len(), 1);
    }

    /// The scaffold scripts write UTF-8 with a BOM. This already cost the
    /// Pantheon scanner every one of its entries once.
    #[test]
    fn a_byte_order_mark_does_not_hide_the_frontmatter() {
        let folder = temp_folder("bom");
        write(
            &folder,
            "Bommed.md",
            "\u{feff}---\ntype: project\nstatus: active\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);

        assert_eq!(
            index.lookup("Bommed").and_then(|note| note.status),
            Some(ProjectStatus::Active)
        );
    }

    /// A typo must not read as a deliberate absence of classification.
    #[test]
    fn an_unrecognised_status_warns_instead_of_passing_silently() {
        let folder = temp_folder("bad-status");
        write(&folder, "Typo.md", "---\ntype: project\nstatus: activve\n---\n\nBody.");

        let index = load_project_notes_from(&folder);
        let note = index.lookup("Typo").expect("the note is still indexed");

        assert!(note.status.is_none());
        assert_eq!(note.warnings.len(), 1);
        assert!(note.warnings[0].contains("activve"));
    }

    #[test]
    fn a_note_without_a_status_is_indexed_but_says_nothing() {
        let folder = temp_folder("no-status");
        write(&folder, "Quiet.md", "---\ntype: project\n---\n\nBody.");

        let note = load_project_notes_from(&folder);
        let note = note.lookup("Quiet").expect("indexed");

        assert!(note.status.is_none());
        assert!(note.warnings.is_empty(), "silence is not an error");
    }

    #[test]
    fn next_step_and_promoted_are_read_when_present() {
        let folder = temp_folder("fields");
        write(
            &folder,
            "Full.md",
            "---\ntype: project\nstatus: active\npromoted: \"2026-07-25\"\nnext_step: Wire the hero card to real data.\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);
        let note = index.lookup("Full").expect("indexed");

        assert_eq!(note.promoted.as_deref(), Some("2026-07-25"));
        assert_eq!(note.next_step.as_deref(), Some("Wire the hero card to real data."));
        assert!(note.warnings.is_empty());
    }

    #[test]
    fn a_malformed_promoted_date_warns_and_falls_back() {
        let folder = temp_folder("bad-date");
        write(
            &folder,
            "Dated.md",
            "---\ntype: project\nstatus: active\npromoted: \"July 25\"\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);
        let note = index.lookup("Dated").expect("indexed");

        assert!(note.promoted.is_none());
        assert_eq!(note.warnings.len(), 1);
        assert!(note.warnings[0].contains("promoted"));
    }

    #[test]
    fn an_empty_next_step_is_absent_rather_than_blank() {
        let folder = temp_folder("blank-next");
        write(
            &folder,
            "Blank.md",
            "---\ntype: project\nstatus: active\nnext_step: \"   \"\n---\n\nBody.",
        );

        let index = load_project_notes_from(&folder);

        assert!(index.lookup("Blank").expect("indexed").next_step.is_none());
    }

    #[test]
    fn a_note_without_frontmatter_is_skipped() {
        let folder = temp_folder("no-frontmatter");
        write(&folder, "Prose.md", "# Just a heading\n\nNo frontmatter here.");

        assert!(load_project_notes_from(&folder).notes().is_empty());
    }

    #[test]
    fn invalid_yaml_is_skipped_rather_than_panicking() {
        let folder = temp_folder("bad-yaml");
        write(&folder, "Broken.md", "---\n\tthis: is: not: yaml\n---\n\nBody.");

        assert!(load_project_notes_from(&folder).notes().is_empty());
    }

    #[test]
    fn a_missing_folder_yields_an_empty_index() {
        let index = load_project_notes_from(Path::new("C:/no-such-projects-folder-here"));

        assert!(index.notes().is_empty());
        assert!(index.warnings.is_empty());
    }

    #[test]
    fn unclassified_sorts_above_watching_but_below_active() {
        assert!(ProjectStatus::Active.rank() < ProjectStatus::Unclassified.rank());
        assert!(ProjectStatus::Unclassified.rank() < ProjectStatus::Watching.rank());
        assert!(ProjectStatus::Watching.rank() < ProjectStatus::Scaffold.rank());
        assert!(ProjectStatus::Scaffold.rank() < ProjectStatus::Archived.rank());
    }

    /// `unclassified` means nobody said. Accepting it in frontmatter would let
    /// a note make a claim it is not making.
    #[test]
    fn unclassified_cannot_be_declared() {
        assert!(ProjectStatus::parse("unclassified").is_none());
    }

    #[test]
    fn iso_dates_are_checked_shallowly_but_usefully() {
        assert!(is_iso_date("2026-07-25"));
        assert!(!is_iso_date("2026-7-25"));
        assert!(!is_iso_date("July 25"));
        assert!(!is_iso_date("2026-07-25T00:00:00"));
    }

    /// Runs against the operator's real vault. Every read here degrades to an
    /// empty index on failure, so without asserting the precondition this test
    /// would pass just as happily with the folder missing.
    #[test]
    fn debug_join_the_real_project_note() {
        let folder = get_vault_path().join(PROJECTS_FOLDER);
        let index = load_project_notes_from(&folder);

        eprintln!(
            "[project-notes] {} note(s), {} folder warning(s)",
            index.notes().len(),
            index.warnings.len()
        );

        assert!(
            folder.exists(),
            "{PROJECTS_FOLDER} must exist for this test to mean anything"
        );

        // The repository directory is `Olympus`; the note is `Project
        // Olympus.md`. If this stops resolving, the alias was dropped or the
        // note was renamed, and every project silently becomes unclassified.
        let olympus = index
            .lookup("Olympus")
            .expect("`Project Olympus.md` must still join to the Olympus repository directory");

        assert_eq!(olympus.status, Some(ProjectStatus::Active));
        assert!(
            index.warnings.is_empty(),
            "the real project folder did not index cleanly: {:?}",
            index.warnings
        );
    }
}
