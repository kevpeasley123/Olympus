use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use once_cell::sync::Lazy;
use serde::Serialize;

use super::vault_write::{classify, resolve_vault_path, WriteIntent};

const ATTACHMENTS_FOLDER: &str = "02 - Research/_attachments";
const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"];

/// Files the operator chose in the native picker, keyed by an unguessable
/// token. The webview only ever holds the token: a source path taken from it
/// let any script there copy `.env` or the database into the synced vault.
/// Only the latest pick is kept, since the capture form stages one file.
static PICKED: Lazy<Mutex<HashMap<String, PathBuf>>> = Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedAttachment {
    pub token: String,
    pub file_name: String,
}

fn token() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).map_err(|_| "Secure randomness is unavailable.".to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn remember_pick(path: PathBuf) -> Result<String, String> {
    let token = token()?;
    let mut picked = PICKED.lock().map_err(|error| error.to_string())?;
    picked.clear();
    picked.insert(token.clone(), path);
    Ok(token)
}

fn picked_path(token: &str, consume: bool) -> Result<PathBuf, String> {
    let mut picked = PICKED.lock().map_err(|error| error.to_string())?;
    let found = if consume { picked.remove(token) } else { picked.get(token).cloned() };
    found.ok_or_else(|| "That attachment is no longer staged. Choose the file again.".to_string())
}

fn extension_allowed(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    let ext = match lower.rsplit_once('.') {
        Some((_, ext)) => ext,
        None => return false,
    };
    ALLOWED_EXTENSIONS.iter().any(|allowed| *allowed == ext)
}

/// Server-side filename sanitization.
/// - lowercase
/// - whitespace → hyphen
/// - any character outside [a-z0-9.-_] is stripped
/// - collapse runs of hyphens, trim leading/trailing hyphens (but keep extension dot)
fn sanitize_attachment_filename(name: &str) -> String {
    let lower = name.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut last_was_hyphen = false;
    for ch in lower.chars() {
        let mapped = if ch.is_whitespace() {
            '-'
        } else if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
            ch
        } else {
            // Strip
            continue;
        };
        if mapped == '-' {
            if last_was_hyphen {
                continue;
            }
            last_was_hyphen = true;
        } else {
            last_was_hyphen = false;
        }
        out.push(mapped);
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "attachment".to_string()
    } else {
        trimmed
    }
}

/// Copies `source` to `path`, or to the first free `-2`, `-3`, ... sibling.
/// The name is claimed with `create_new`, so an existing file is never
/// overwritten even if it appears after the directory was listed.
fn copy_to_unique(source: &Path, path: PathBuf) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("attachment")
        .to_string();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e))
        .unwrap_or_default();

    // Fallback after the numbered names: append timestamp
    let ts = chrono::Local::now().format("%H%M%S").to_string();
    let candidates = std::iter::once(path)
        .chain((2..1000).map(|n| parent.join(format!("{}-{}{}", stem, n, ext))))
        .chain(std::iter::once(parent.join(format!("{}-{}{}", stem, ts, ext))));

    let mut input =
        fs::File::open(source).map_err(|e| format!("Failed to read the attachment: {}", e))?;
    for candidate in candidates {
        let mut output = match fs::OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("Failed to copy attachment to vault: {}", e)),
        };
        if let Err(e) = std::io::copy(&mut input, &mut output) {
            drop(output);
            let _ = fs::remove_file(&candidate);
            return Err(format!("Failed to copy attachment to vault: {}", e));
        }
        return Ok(candidate);
    }
    Err("Every candidate name for this attachment is taken.".to_string())
}

#[tauri::command]
pub async fn pick_attachment_file() -> Result<Option<PickedAttachment>, String> {
    let result = rfd::AsyncFileDialog::new()
        .add_filter(
            "Attachments",
            &["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"],
        )
        .pick_file()
        .await;

    let Some(handle) = result else {
        return Ok(None);
    };
    let path = handle.path().to_path_buf();
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "The chosen file has no name.".to_string())?;
    // Refused before it replaces an already staged pick.
    if !extension_allowed(&file_name) {
        return Err(format!(
            "File type not allowed. Allowed extensions: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }
    Ok(Some(PickedAttachment {
        token: remember_pick(path)?,
        file_name,
    }))
}

/// Reads the staged file without consuming it: the capture form previews the
/// text before the entry, and the attachment with it, is saved.
#[tauri::command]
pub async fn extract_pdf_text(token: String) -> Result<String, String> {
    let path = picked_path(&token, false)?;
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }
    if !path.to_string_lossy().to_lowercase().ends_with(".pdf") {
        return Err("File is not a PDF.".to_string());
    }

    let extraction = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pdf_extract::extract_text(&path)
    }));

    match extraction {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(e)) => Err(format!("PDF extraction failed: {}", e)),
        Err(_) => Err("PDF extraction crashed (file may be malformed).".to_string()),
    }
}

/// Copies the staged file into the vault. The token is spent here, so a
/// failed save needs a fresh pick rather than a replay.
#[tauri::command]
pub async fn save_attachment_to_vault(
    db: tauri::State<'_, crate::commands::persistence::Db>,
    token: String,
) -> Result<String, String> {
    let source = picked_path(&token, true)?;
    if !source.is_file() {
        return Err(format!("Source file not found: {}", source.display()));
    }
    // The allowlist applies to the file actually being copied.
    let target_filename = source
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    if !extension_allowed(&target_filename) {
        return Err(format!(
            "File type not allowed. Allowed extensions: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    let safe_filename = sanitize_attachment_filename(&target_filename);

    // copy_to_unique below guarantees this never overwrites.
    let _tier = classify(WriteIntent::CreateUnique);

    let initial_target = resolve_vault_path(&Path::new(ATTACHMENTS_FOLDER).join(&safe_filename))
        .map_err(|error| error.to_string())?;

    let target_dir = initial_target
        .parent()
        .ok_or_else(|| "Attachment has no parent directory.".to_string())?
        .to_path_buf();

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create _attachments directory: {}", e))?;
    let final_target = copy_to_unique(&source, initial_target)?;

    let final_filename = final_target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&safe_filename);
    let vault_relative = format!("{ATTACHMENTS_FOLDER}/{final_filename}");

    crate::commands::vault_git::commit_vault_file(&vault_relative, "create").map_err(|error| {
        format!(
            "The attachment was written at {vault_relative}, but its automatic Git commit failed: \
             {error}. The file remains in the vault."
        )
    })?;
    crate::commands::persistence::log_vault_write(db.inner(), &vault_relative, "create");

    Ok(format!("_attachments/{}", final_filename))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_lowercases() {
        assert_eq!(sanitize_attachment_filename("Foo Bar.PDF"), "foo-bar.pdf");
    }

    #[test]
    fn sanitize_replaces_whitespace_with_hyphen() {
        assert_eq!(
            sanitize_attachment_filename("My  research notes.txt"),
            "my-research-notes.txt"
        );
    }

    #[test]
    fn sanitize_strips_disallowed_chars() {
        // Keep . - _ alnum; strip the rest
        assert_eq!(
            sanitize_attachment_filename("paper@v1!#.pdf"),
            "paperv1.pdf"
        );
    }

    #[test]
    fn sanitize_collapses_consecutive_hyphens() {
        assert_eq!(
            sanitize_attachment_filename("foo___bar"),
            "foo___bar"
        );
        assert_eq!(
            sanitize_attachment_filename("foo - - bar"),
            "foo-bar"
        );
    }

    #[test]
    fn sanitize_empty_returns_fallback() {
        assert_eq!(sanitize_attachment_filename(""), "attachment");
        assert_eq!(sanitize_attachment_filename("   "), "attachment");
        assert_eq!(sanitize_attachment_filename("@@@"), "attachment");
    }

    #[test]
    fn sanitize_preserves_underscores_and_periods() {
        assert_eq!(
            sanitize_attachment_filename("note_v2.final.md"),
            "note_v2.final.md"
        );
    }

    #[test]
    fn extension_allowed_yes() {
        assert!(extension_allowed("foo.pdf"));
        assert!(extension_allowed("foo.PDF"));
        assert!(extension_allowed("foo.png"));
        assert!(extension_allowed("foo.JPG"));
        assert!(extension_allowed("foo.jpeg"));
        assert!(extension_allowed("foo.webp"));
        assert!(extension_allowed("foo.txt"));
        assert!(extension_allowed("foo.md"));
    }

    #[test]
    fn extension_allowed_no() {
        assert!(!extension_allowed("foo.exe"));
        assert!(!extension_allowed("foo.zip"));
        assert!(!extension_allowed("foo.docx"));
        assert!(!extension_allowed("noextension"));
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("olympus-attach-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn dedupe_unique_path_passes_through() {
        let dir = temp_dir("free");
        let source = dir.join("source.bin");
        fs::write(&source, "copied").unwrap();
        let target = dir.join("paper.pdf");

        assert_eq!(copy_to_unique(&source, target.clone()).unwrap(), target);
        assert_eq!(fs::read_to_string(&target).unwrap(), "copied");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dedupe_unique_path_with_collision() {
        let dir = temp_dir("collision");
        let source = dir.join("source.bin");
        fs::write(&source, "copied").unwrap();
        let occupied = dir.join("paper.pdf");
        fs::write(&occupied, "x").expect("write test fixture");
        fs::write(dir.join("paper-2.pdf"), "y").expect("write test fixture");

        let result = copy_to_unique(&source, occupied.clone()).unwrap();
        assert_eq!(result, dir.join("paper-3.pdf"));
        assert_eq!(fs::read_to_string(&result).unwrap(), "copied");
        assert_eq!(fs::read_to_string(&occupied).unwrap(), "x");
        assert_eq!(fs::read_to_string(dir.join("paper-2.pdf")).unwrap(), "y");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_token_names_only_the_latest_pick_and_saving_spends_it() {
        let first = remember_pick(PathBuf::from("/picked/first.pdf")).unwrap();
        let second = remember_pick(PathBuf::from("/picked/second.pdf")).unwrap();

        assert_ne!(first, second);
        assert_eq!(second.len(), 32);
        assert!(picked_path(&first, false).is_err());
        assert!(picked_path("/home/user/.env", false).is_err());
        assert_eq!(picked_path(&second, false).unwrap(), PathBuf::from("/picked/second.pdf"));
        assert_eq!(picked_path(&second, true).unwrap(), PathBuf::from("/picked/second.pdf"));
        assert!(picked_path(&second, true).is_err());
    }
}
