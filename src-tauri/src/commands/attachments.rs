use std::fs;
use std::path::PathBuf;

use super::get_vault_path;

const ATTACHMENTS_FOLDER: &str = "02 - Research/_attachments";
const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"];

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

/// Append `-2`, `-3`, ... to the stem to avoid overwriting an existing file.
fn ensure_unique_attachment_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
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

    for n in 2..1000 {
        let candidate = parent.join(format!("{}-{}{}", stem, n, ext));
        if !candidate.exists() {
            return candidate;
        }
    }
    // Fallback: append timestamp
    let ts = chrono::Local::now().format("%H%M%S").to_string();
    parent.join(format!("{}-{}{}", stem, ts, ext))
}

#[tauri::command]
pub async fn pick_attachment_file() -> Result<Option<String>, String> {
    let result = rfd::AsyncFileDialog::new()
        .add_filter(
            "Attachments",
            &["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"],
        )
        .pick_file()
        .await;

    Ok(result.map(|handle| handle.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn extract_pdf_text(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    let lower = file_path.to_lowercase();
    if !lower.ends_with(".pdf") {
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

#[tauri::command]
pub async fn save_attachment_to_vault(
    source_path: String,
    target_filename: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }
    if !source.is_file() {
        return Err(format!("Source path is not a file: {}", source_path));
    }
    if !extension_allowed(&target_filename) {
        return Err(format!(
            "File type not allowed. Allowed extensions: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    let safe_filename = sanitize_attachment_filename(&target_filename);

    let vault = get_vault_path();
    let target_dir = vault.join(ATTACHMENTS_FOLDER);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create _attachments directory: {}", e))?;

    let initial_target = target_dir.join(&safe_filename);
    let final_target = ensure_unique_attachment_path(initial_target);

    fs::copy(&source, &final_target)
        .map_err(|e| format!("Failed to copy attachment to vault: {}", e))?;

    let final_filename = final_target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&safe_filename);

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

    #[test]
    fn dedupe_unique_path_passes_through() {
        let temp = std::env::temp_dir().join(format!(
            "olympus-attach-test-{}.txt",
            chrono::Local::now().format("%H%M%S%f")
        ));
        // Path doesn't exist; should pass through.
        let result = ensure_unique_attachment_path(temp.clone());
        assert_eq!(result, temp);
    }

    #[test]
    fn dedupe_unique_path_with_collision() {
        let dir = std::env::temp_dir();
        let unique_id = chrono::Local::now().format("%H%M%S%f").to_string();
        let occupied = dir.join(format!("olympus-dedupe-{}.txt", unique_id));
        fs::write(&occupied, "x").expect("write test fixture");

        let result = ensure_unique_attachment_path(occupied.clone());
        assert_ne!(result, occupied);
        assert!(result.to_string_lossy().contains(&format!("{}-2", unique_id)));

        // Cleanup
        let _ = fs::remove_file(&occupied);
    }
}
