//! The single doorway for every vault write.
//!
//! Two responsibilities, deliberately separate:
//!
//! 1. **Containment** — prove a target path lands inside the vault before any
//!    write touches the disk. Enforced now.
//! 2. **Classification** — record what kind of write a call site intends, so a
//!    confirmation gate can act on it. Computed now, enforced in a later step;
//!    nothing in this module prompts or blocks yet.
//!
//! Intent is *declared* by the call site rather than inferred from the
//! operation, because the operation does not determine the harm. A create is
//! only safe here because the two creating writers guarantee a unique path —
//! that is a property of those call sites, not of creation. Declared intent is
//! greppable and reviewable; inferred intent is neither.

use std::path::{Component, Path, PathBuf};

use super::get_vault_path;

/// What a call site means to do. The gate maps this to a tier; it never
/// guesses from the filesystem operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteIntent {
    /// A new file at a path the caller guarantees is unused. Both creating
    /// writers hold this guarantee via their `ensure_unique_*` helpers.
    CreateUnique,
    /// A rewrite of a file the app generates from its own state. Destroys
    /// nothing a human authored — unless a human edited it, which is what the
    /// content-hash check will later establish.
    RegenerateDerived,
    /// Adding lines to a note a human may have written.
    AppendAuthored,
    /// Rewriting or removing lines a human may have written.
    ModifyAuthored,
}

/// What the gate will require of a write. Computed today, enforced once the
/// confirmation channel exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteTier {
    AutoApproved,
    Confirm,
    ConfirmWithDiff,
}

/// What the operator is being asked to allow, in their terms rather than the
/// call site's. The dialog has to say "add to" or "replace" correctly — asking
/// "overwrite this file?" about an append is a lie that trains the operator to
/// stop reading the question.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WriteOperation {
    Overwrite,
    Append,
}

/// Derived from the declared intent rather than passed alongside it, so the two
/// cannot drift apart at a call site.
pub fn operation_of(intent: WriteIntent) -> WriteOperation {
    match intent {
        WriteIntent::AppendAuthored => WriteOperation::Append,
        WriteIntent::CreateUnique
        | WriteIntent::RegenerateDerived
        | WriteIntent::ModifyAuthored => WriteOperation::Overwrite,
    }
}

pub fn classify(intent: WriteIntent) -> WriteTier {
    match intent {
        WriteIntent::CreateUnique => WriteTier::AutoApproved,
        WriteIntent::AppendAuthored => WriteTier::Confirm,
        // Pending the content-hash exemption: a derived file whose bytes still
        // match what the app last wrote can be regenerated silently, and one
        // that diverged was edited by a human. Until that check exists, the
        // safe classification is the strict one.
        WriteIntent::RegenerateDerived | WriteIntent::ModifyAuthored => WriteTier::ConfirmWithDiff,
    }
}

/// Why a write needs a human before it proceeds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmReason {
    /// The file on disk differs from what the app last wrote, so someone edited
    /// it by hand.
    EditedSinceLastWrite,
    /// No fingerprint was ever recorded for this file. Absent must mean confirm
    /// — treating it as clean would make the check bypassable by deleting the
    /// row.
    NoRecordedFingerprint,
    /// The intent itself always requires a human, regardless of file state.
    IntentRequiresConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteDecision {
    Proceed,
    NeedsConfirmation(ConfirmReason),
}

/// Fingerprints content for the app-authored check.
///
/// Normalised before hashing because the vault lives in OneDrive and is opened
/// by Obsidian: a sync round-trip or a plugin can rewrite line endings and
/// trailing whitespace without a human touching the file. Hashing raw bytes
/// would report those as human edits and train the operator to click through
/// the confirmation.
pub fn content_fingerprint(content: &str) -> String {
    use sha2::{Digest, Sha256};

    let normalised = content
        .replace("\r\n", "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim_end()
        .to_string();

    let digest = Sha256::digest(normalised.as_bytes());
    format!("{digest:x}")
}

/// Decides whether a write may proceed without asking.
///
/// Pure: the caller supplies what is on disk and what was last recorded, so the
/// whole decision table is testable without a filesystem or a database.
pub fn decide(
    intent: WriteIntent,
    on_disk: Option<&str>,
    recorded_fingerprint: Option<&str>,
) -> WriteDecision {
    match classify(intent) {
        WriteTier::AutoApproved => WriteDecision::Proceed,

        WriteTier::Confirm => WriteDecision::NeedsConfirmation(
            ConfirmReason::IntentRequiresConfirmation,
        ),

        WriteTier::ConfirmWithDiff => match on_disk {
            // Nothing on disk means nothing to destroy — this is a create, and
            // the overwrite question does not arise.
            None => WriteDecision::Proceed,

            Some(existing) => match recorded_fingerprint {
                Some(recorded) if recorded == content_fingerprint(existing) => {
                    WriteDecision::Proceed
                }
                Some(_) => {
                    WriteDecision::NeedsConfirmation(ConfirmReason::EditedSinceLastWrite)
                }
                None => {
                    WriteDecision::NeedsConfirmation(ConfirmReason::NoRecordedFingerprint)
                }
            },
        },
    }
}

/// A human-readable account of what a write would change.
///
/// Deliberately a summary rather than a real diff: it compares line multisets,
/// so reordered lines read as changed. For the case this exists to catch — a
/// rearranged canvas, where node coordinates genuinely differ — that is the
/// right answer, and it avoids pulling in a diff algorithm for a dialog.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffSummary {
    pub added: usize,
    pub removed: usize,
    /// A capped sample, `+`/`-` prefixed, for display.
    pub preview: Vec<String>,
}

const DIFF_PREVIEW_LIMIT: usize = 12;

pub fn summarise_diff(before: &str, after: &str) -> DiffSummary {
    let before_lines: Vec<&str> = before.lines().map(str::trim_end).collect();
    let after_lines: Vec<&str> = after.lines().map(str::trim_end).collect();

    let removed: Vec<&str> = before_lines
        .iter()
        .filter(|line| !after_lines.contains(line))
        .copied()
        .collect();
    let added: Vec<&str> = after_lines
        .iter()
        .filter(|line| !before_lines.contains(line))
        .copied()
        .collect();

    let mut preview = Vec::new();
    for line in removed.iter().take(DIFF_PREVIEW_LIMIT / 2) {
        preview.push(format!("- {line}"));
    }
    for line in added.iter().take(DIFF_PREVIEW_LIMIT / 2) {
        preview.push(format!("+ {line}"));
    }

    DiffSummary {
        added: added.len(),
        removed: removed.len(),
        preview,
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum VaultWriteError {
    Empty,
    Absolute,
    Traversal,
    ReservedName(String),
    IllegalCharacter(String),
    EscapesVault(String),
    RootUnavailable(String),
}

impl std::fmt::Display for VaultWriteError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Empty => write!(f, "A vault path is required."),
            Self::Absolute => write!(
                f,
                "Vault writes take a path relative to the vault root, not an absolute or UNC path."
            ),
            Self::Traversal => write!(f, "Path traversal is not allowed in a vault path."),
            Self::ReservedName(name) => {
                write!(f, "`{name}` is a reserved Windows device name.")
            }
            Self::IllegalCharacter(part) => {
                write!(f, "`{part}` contains a character that is not allowed in a vault path.")
            }
            Self::EscapesVault(path) => {
                write!(f, "Refusing to write outside the vault: {path}")
            }
            Self::RootUnavailable(detail) => write!(f, "Vault root is unusable: {detail}"),
        }
    }
}

/// Windows treats these as devices regardless of extension: `CON.md` is still
/// `CON`. `fs::write` to one succeeds and the bytes go nowhere.
const RESERVED_STEMS: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Resolves a vault-relative path against the configured vault root.
pub fn resolve_vault_path(relative: &Path) -> Result<PathBuf, VaultWriteError> {
    resolve_within(&get_vault_path(), relative)
}

/// The containment check, parameterised on the root so it can be tested
/// against a temporary directory rather than the operator's real vault.
pub fn resolve_within(root: &Path, relative: &Path) -> Result<PathBuf, VaultWriteError> {
    if relative.as_os_str().is_empty() {
        return Err(VaultWriteError::Empty);
    }

    validate_components(relative)?;

    let canonical_root = root
        .canonicalize()
        .map_err(|error| VaultWriteError::RootUnavailable(error.to_string()))?;

    let candidate = canonical_root.join(relative);

    // The target usually does not exist yet, and `canonicalize` requires an
    // existing path — so anchor on the nearest ancestor that does. That
    // ancestor is where a junction or symlink would redirect us out of the
    // vault, and canonicalizing it resolves the link before we compare.
    let anchor = nearest_existing_ancestor(&candidate)
        .ok_or_else(|| VaultWriteError::EscapesVault(candidate.display().to_string()))?;

    let canonical_anchor = anchor
        .canonicalize()
        .map_err(|error| VaultWriteError::RootUnavailable(error.to_string()))?;

    if !canonical_anchor.starts_with(&canonical_root) {
        return Err(VaultWriteError::EscapesVault(
            candidate.display().to_string(),
        ));
    }

    Ok(candidate)
}

fn validate_components(relative: &Path) -> Result<(), VaultWriteError> {
    for component in relative.components() {
        match component {
            // A `Prefix` is a drive letter or UNC share; `RootDir` is a leading
            // separator. Either means the caller supplied something other than
            // a vault-relative path.
            Component::Prefix(_) | Component::RootDir => return Err(VaultWriteError::Absolute),
            Component::ParentDir => return Err(VaultWriteError::Traversal),
            Component::CurDir => continue,
            Component::Normal(part) => {
                let text = part.to_string_lossy();

                // Catches alternate data streams (`note.md:hidden`) and
                // drive-relative paths (`C:notes`), which resolve against the
                // process's current directory on that drive rather than the root.
                if text.contains(':') {
                    return Err(VaultWriteError::IllegalCharacter(text.to_string()));
                }

                let stem = text
                    .split('.')
                    .next()
                    .unwrap_or(&text)
                    .trim()
                    .to_ascii_uppercase();

                if RESERVED_STEMS.contains(&stem.as_str()) {
                    return Err(VaultWriteError::ReservedName(text.to_string()));
                }
            }
        }
    }

    Ok(())
}

fn nearest_existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current = path;

    loop {
        if current.exists() {
            return Some(current.to_path_buf());
        }
        current = current.parent()?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// A junction on Windows (no elevation required), a symlink elsewhere.
    #[cfg(target_os = "windows")]
    fn create_directory_link(link: &Path, target: &Path) -> bool {
        std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    fn create_directory_link(link: &Path, target: &Path) -> bool {
        std::os::unix::fs::symlink(target, link).is_ok()
    }

    /// Creates a throwaway root. Named per-test so parallel runs cannot collide.
    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("olympus-vault-write-{name}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn accepts_a_path_inside_the_vault() {
        let root = temp_root("inside");
        let resolved = resolve_within(&root, Path::new("02 - Research/entry.md"))
            .expect("a plain relative path must resolve");

        assert!(resolved.starts_with(root.canonicalize().unwrap()));
        assert!(resolved.ends_with("entry.md"));
    }

    #[test]
    fn accepts_a_target_whose_directory_does_not_exist_yet() {
        let root = temp_root("missing-dir");
        // _attachments/ is created on first save; the guard must not require it.
        resolve_within(&root, Path::new("02 - Research/_attachments/file.pdf"))
            .expect("a not-yet-created directory must still resolve");
    }

    #[test]
    fn rejects_parent_traversal() {
        let root = temp_root("traversal");

        assert_eq!(
            resolve_within(&root, Path::new("../outside.md")),
            Err(VaultWriteError::Traversal)
        );
        assert_eq!(
            resolve_within(&root, Path::new("02 - Research/../../outside.md")),
            Err(VaultWriteError::Traversal)
        );
    }

    #[test]
    fn rejects_absolute_and_unc_paths() {
        let root = temp_root("absolute");

        assert_eq!(
            resolve_within(&root, Path::new(r"C:\Windows\System32\evil.md")),
            Err(VaultWriteError::Absolute)
        );
        assert_eq!(
            resolve_within(&root, Path::new(r"\\server\share\evil.md")),
            Err(VaultWriteError::Absolute)
        );
    }

    /// `C:notes` is relative to the current directory *on drive C*, not to the
    /// drive root — a different path than it looks like.
    #[test]
    fn rejects_drive_relative_and_alternate_data_streams() {
        let root = temp_root("colon");

        assert!(matches!(
            resolve_within(&root, Path::new("note.md:hidden")),
            Err(VaultWriteError::IllegalCharacter(_))
        ));
        assert!(matches!(
            resolve_within(&root, Path::new("C:notes/entry.md")),
            Err(VaultWriteError::Absolute) | Err(VaultWriteError::IllegalCharacter(_))
        ));
    }

    #[test]
    fn rejects_reserved_device_names_with_or_without_an_extension() {
        let root = temp_root("reserved");

        for name in ["NUL", "CON.md", "com1.txt", "02 - Research/LPT9.md"] {
            assert!(
                matches!(
                    resolve_within(&root, Path::new(name)),
                    Err(VaultWriteError::ReservedName(_))
                ),
                "`{name}` must be rejected as a reserved device name"
            );
        }
    }

    #[test]
    fn rejects_an_empty_path() {
        let root = temp_root("empty");
        assert_eq!(resolve_within(&root, Path::new("")), Err(VaultWriteError::Empty));
    }

    /// A junction inside the vault pointing outside it is the realistic Windows
    /// escape: it needs no elevation to create, and its literal path looks
    /// perfectly contained. Only canonicalization catches it.
    ///
    /// Junctions are used rather than symlinks deliberately — `symlink_dir`
    /// requires Developer Mode or elevation, so a symlink-based test silently
    /// skips on an ordinary machine and asserts nothing.
    #[test]
    fn rejects_a_junction_that_escapes_the_vault() {
        let root = temp_root("escape");
        let outside = temp_root("escape-target");
        let link = root.join("linked");

        let created = create_directory_link(&link, &outside);

        assert!(
            created,
            "could not create a directory junction; this test must not silently pass"
        );

        assert!(
            matches!(
                resolve_within(&root, Path::new("linked/evil.md")),
                Err(VaultWriteError::EscapesVault(_))
            ),
            "a junction escaping the vault must be rejected"
        );

        // The same junction is fine as a *read* target; containment is only
        // asserted for writes. Proving the link really did point outside keeps
        // this test honest if mklink ever silently no-ops.
        assert!(
            link.canonicalize()
                .expect("junction resolves")
                .starts_with(outside.canonicalize().expect("target resolves")),
            "the junction must actually point outside the root"
        );
    }

    #[test]
    fn tiers_follow_declared_intent() {
        assert_eq!(classify(WriteIntent::CreateUnique), WriteTier::AutoApproved);
        assert_eq!(classify(WriteIntent::AppendAuthored), WriteTier::Confirm);
        assert_eq!(
            classify(WriteIntent::RegenerateDerived),
            WriteTier::ConfirmWithDiff
        );
        assert_eq!(
            classify(WriteIntent::ModifyAuthored),
            WriteTier::ConfirmWithDiff
        );
    }

    /// Only the appender describes itself as adding to a file. Everything else
    /// replaces one, and the dialog has to say which.
    #[test]
    fn only_appending_reads_as_an_append() {
        assert_eq!(
            operation_of(WriteIntent::AppendAuthored),
            WriteOperation::Append
        );

        for intent in [
            WriteIntent::CreateUnique,
            WriteIntent::RegenerateDerived,
            WriteIntent::ModifyAuthored,
        ] {
            assert_eq!(operation_of(intent), WriteOperation::Overwrite);
        }
    }

    /// The two shipped creating writers must stay in the silent tier — if one
    /// ever loses its uniqueness guarantee, its intent should change and this
    /// is where that shows up.
    #[test]
    fn the_shipped_creating_writers_are_auto_approved() {
        assert_eq!(classify(WriteIntent::CreateUnique), WriteTier::AutoApproved);
    }

    const GENERATED: &str = "{\n  \"nodes\": [],\n  \"edges\": []\n}";

    #[test]
    fn a_file_matching_its_recorded_fingerprint_is_regenerated_silently() {
        let recorded = content_fingerprint(GENERATED);

        assert_eq!(
            decide(
                WriteIntent::RegenerateDerived,
                Some(GENERATED),
                Some(&recorded)
            ),
            WriteDecision::Proceed
        );
    }

    /// The case the whole exemption exists for: someone rearranged the canvas
    /// in Obsidian and Update Canvas would silently discard it.
    #[test]
    fn a_hand_edited_file_needs_confirmation() {
        let recorded = content_fingerprint(GENERATED);
        let edited = "{\n  \"nodes\": [{\"id\": \"moved-by-hand\"}],\n  \"edges\": []\n}";

        assert_eq!(
            decide(
                WriteIntent::RegenerateDerived,
                Some(edited),
                Some(&recorded)
            ),
            WriteDecision::NeedsConfirmation(ConfirmReason::EditedSinceLastWrite)
        );
    }

    /// Absent must mean confirm. If a missing row read as clean, deleting it
    /// would be enough to bypass the gate.
    #[test]
    fn a_file_with_no_recorded_fingerprint_needs_confirmation() {
        assert_eq!(
            decide(WriteIntent::RegenerateDerived, Some(GENERATED), None),
            WriteDecision::NeedsConfirmation(ConfirmReason::NoRecordedFingerprint)
        );
    }

    /// First write of an artifact destroys nothing, so it must not prompt.
    #[test]
    fn writing_a_file_that_does_not_exist_yet_proceeds() {
        assert_eq!(
            decide(WriteIntent::RegenerateDerived, None, None),
            WriteDecision::Proceed
        );
    }

    #[test]
    fn create_unique_never_asks_regardless_of_disk_state() {
        assert_eq!(
            decide(WriteIntent::CreateUnique, Some("anything"), None),
            WriteDecision::Proceed
        );
    }

    #[test]
    fn appending_always_asks() {
        assert_eq!(
            decide(WriteIntent::AppendAuthored, Some("notes"), None),
            WriteDecision::NeedsConfirmation(ConfirmReason::IntentRequiresConfirmation)
        );
    }

    /// The vault syncs through OneDrive and is opened by Obsidian; a line-ending
    /// round-trip is not a human edit and must not prompt.
    #[test]
    fn fingerprints_ignore_line_endings_and_trailing_whitespace() {
        let lf = "line one\nline two\n";
        let crlf = "line one\r\nline two\r\n";
        let padded = "line one   \nline two\t\n\n\n";

        assert_eq!(content_fingerprint(lf), content_fingerprint(crlf));
        assert_eq!(content_fingerprint(lf), content_fingerprint(padded));
    }

    #[test]
    fn fingerprints_still_detect_real_content_changes() {
        assert_ne!(
            content_fingerprint("line one\nline two"),
            content_fingerprint("line one\nline three")
        );
    }
}
