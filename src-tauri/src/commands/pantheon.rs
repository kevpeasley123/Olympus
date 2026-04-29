use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PantheonEntry {
    pub id: String,
    pub title: String,
    pub source_file: String,
    pub entry_type: String,
    pub source_type: Option<String>,
    pub created: Option<String>,
    pub source_date: Option<String>,
    pub origin: Option<String>,
    pub tags: Vec<String>,
    pub word_count: u32,
    pub file_modified_at: String,
    pub body_preview: String,
    pub body: String,
}

use super::get_vault_path;

const RESEARCH_FOLDER: &str = "02 - Research";
const REQUIRED_TAG: &str = "olympus/research";
const PREVIEW_CHAR_LIMIT: usize = 200;

fn iso8601(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339()
}

fn relative_to_vault(vault: &Path, file: &Path) -> String {
    file.strip_prefix(vault)
        .unwrap_or(file)
        .to_string_lossy()
        .replace('\\', "/")
}

fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    if !content.starts_with("---") {
        return None;
    }
    let after_open = &content[3..];
    let after_open = after_open
        .strip_prefix("\r\n")
        .or_else(|| after_open.strip_prefix('\n'))
        .unwrap_or(after_open);
    let end = after_open.find("\n---")?;
    let frontmatter_str = &after_open[..end];
    let after_close = &after_open[end + 4..];
    let body = after_close
        .strip_prefix("\r\n")
        .or_else(|| after_close.strip_prefix('\n'))
        .unwrap_or(after_close);
    Some((frontmatter_str, body))
}

fn extract_string(value: &serde_yaml::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn extract_tags(value: &serde_yaml::Value) -> Vec<String> {
    value
        .get("tags")
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn count_words(body: &str) -> u32 {
    body.split_whitespace().count() as u32
}

fn make_preview(body: &str) -> String {
    let trimmed = body.trim_start();
    let collected: String = trimmed.chars().take(PREVIEW_CHAR_LIMIT).collect();
    if trimmed.chars().count() > PREVIEW_CHAR_LIMIT {
        format!("{}…", collected)
    } else {
        collected
    }
}

fn parse_pantheon_from_vault() -> Result<Vec<PantheonEntry>, String> {
    let vault = get_vault_path();
    if !vault.exists() {
        eprintln!(
            "[pantheon] vault path does not exist: {}",
            vault.display()
        );
        return Ok(Vec::new());
    }

    let folder = vault.join(RESEARCH_FOLDER);
    if !folder.exists() {
        eprintln!(
            "[pantheon] research folder does not exist: {}",
            folder.display()
        );
        return Ok(Vec::new());
    }

    let mut entries: Vec<PantheonEntry> = Vec::new();

    for entry in WalkDir::new(&folder)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.')
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[pantheon] walk error in {}: {}", folder.display(), err);
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }

        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(err) => {
                eprintln!(
                    "[pantheon] metadata read failed for {}: {}",
                    path.display(),
                    err
                );
                continue;
            }
        };
        let mtime = metadata.modified().unwrap_or_else(|_| SystemTime::now());

        let content = match fs::read_to_string(path) {
            Ok(s) => s,
            Err(err) => {
                eprintln!(
                    "[pantheon] read failed for {} (likely non-UTF-8): {}",
                    path.display(),
                    err
                );
                continue;
            }
        };

        let (frontmatter_str, body) = match split_frontmatter(&content) {
            Some(parts) => parts,
            None => {
                eprintln!(
                    "[pantheon] no frontmatter in {}, skipping",
                    path.display()
                );
                continue;
            }
        };

        let frontmatter: serde_yaml::Value = match serde_yaml::from_str(frontmatter_str) {
            Ok(v) => v,
            Err(err) => {
                eprintln!(
                    "[pantheon] malformed frontmatter in {}: {}",
                    path.display(),
                    err
                );
                continue;
            }
        };

        let tags = extract_tags(&frontmatter);
        if !tags.iter().any(|t| t == REQUIRED_TAG) {
            continue;
        }

        let source_file = relative_to_vault(&vault, path);
        let title = extract_string(&frontmatter, "title").unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });
        let entry_type = extract_string(&frontmatter, "type").unwrap_or_else(|| "note".to_string());
        let source_type = extract_string(&frontmatter, "source_type");
        let created = extract_string(&frontmatter, "created");
        let source_date = extract_string(&frontmatter, "source_date");
        let origin = extract_string(&frontmatter, "origin");
        let body_full = body.trim().to_string();
        let word_count = count_words(&body_full);
        let body_preview = make_preview(&body_full);
        let file_modified_at = iso8601(mtime);

        entries.push(PantheonEntry {
            id: source_file.clone(),
            title,
            source_file,
            entry_type,
            source_type,
            created,
            source_date,
            origin,
            tags,
            word_count,
            file_modified_at,
            body_preview,
            body: body_full,
        });
    }

    entries.sort_by(|a, b| {
        let a_key = a.created.as_deref().unwrap_or(a.file_modified_at.as_str());
        let b_key = b.created.as_deref().unwrap_or(b.file_modified_at.as_str());
        b_key.cmp(a_key)
    });

    Ok(entries)
}

#[tauri::command]
pub fn fetch_pantheon_entries() -> Result<Vec<PantheonEntry>, String> {
    parse_pantheon_from_vault()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritePantheonEntryRequest {
    pub title: String,
    pub body: String,
    pub source_type: Option<String>,
    pub source_url: Option<String>,
    pub source_date: Option<String>,
    pub additional_tags: Vec<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
}

fn sanitize_filename(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.chars().count() > 100 {
        trimmed.chars().take(100).collect::<String>().trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn ensure_unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("entry")
        .to_string();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("md")
        .to_string();
    let parent = path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    for n in 2..100 {
        let candidate = parent.join(format!("{} ({}).{}", stem, n, ext));
        if !candidate.exists() {
            return candidate;
        }
    }
    let ts = Local::now().format("%H%M%S").to_string();
    parent.join(format!("{} ({}).{}", stem, ts, ext))
}

fn escape_yaml_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn build_entry_content(
    title: &str,
    body: &str,
    req: &WritePantheonEntryRequest,
    today: &str,
) -> String {
    let mut tags: Vec<String> = vec!["olympus/research".to_string()];

    if let Some(source_type) = &req.source_type {
        let trimmed = source_type.trim();
        if !trimmed.is_empty() {
            let combined = format!("research/{}", trimmed);
            if !tags.contains(&combined) {
                tags.push(combined);
            }
        }
    }

    for tag in &req.additional_tags {
        let trimmed = tag.trim();
        if !trimmed.is_empty() && !tags.iter().any(|existing| existing == trimmed) {
            tags.push(trimmed.to_string());
        }
    }

    let mut frontmatter = String::new();
    frontmatter.push_str("---\n");
    frontmatter.push_str(&format!("title: \"{}\"\n", escape_yaml_string(title)));
    frontmatter.push_str("type: research\n");

    if let Some(source_type) = &req.source_type {
        let trimmed = source_type.trim();
        if !trimmed.is_empty() {
            frontmatter.push_str(&format!(
                "source_type: \"{}\"\n",
                escape_yaml_string(trimmed)
            ));
        }
    }

    frontmatter.push_str(&format!("created: \"{}\"\n", today));

    if let Some(source_date) = &req.source_date {
        let trimmed = source_date.trim();
        if !trimmed.is_empty() {
            frontmatter.push_str(&format!(
                "source_date: \"{}\"\n",
                escape_yaml_string(trimmed)
            ));
        }
    }

    if let Some(source_url) = &req.source_url {
        let trimmed = source_url.trim();
        if !trimmed.is_empty() {
            frontmatter.push_str(&format!(
                "source_url: \"{}\"\n",
                escape_yaml_string(trimmed)
            ));
        }
    }

    frontmatter.push_str("origin: \"Olympus dashboard\"\n");
    frontmatter.push_str("tags:\n");
    for tag in &tags {
        frontmatter.push_str(&format!("  - {}\n", tag));
    }

    let cleaned_attachments: Vec<String> = req
        .attachments
        .iter()
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .collect();

    if !cleaned_attachments.is_empty() {
        frontmatter.push_str("attachments:\n");
        for attachment in &cleaned_attachments {
            frontmatter.push_str(&format!(
                "  - \"{}\"\n",
                escape_yaml_string(attachment)
            ));
        }
    }

    frontmatter.push_str("---\n\n");

    let mut full = format!("{}{}", frontmatter, body);
    for attachment in &cleaned_attachments {
        full.push_str(&format!("\n\n![[{}]]\n", attachment));
    }
    full
}

fn perform_write_pantheon_entry(req: WritePantheonEntryRequest) -> Result<String, String> {
    let title = req.title.trim().to_string();
    if title.is_empty() {
        return Err("Title is required".to_string());
    }

    let body = req.body.trim().to_string();
    if body.is_empty() {
        return Err("Body content is required".to_string());
    }

    let today = Local::now().format("%Y-%m-%d").to_string();
    let safe_title = sanitize_filename(&title);
    let filename = format!("{} {}.md", today, safe_title);

    let vault_path = get_vault_path();
    let target_dir = vault_path.join(RESEARCH_FOLDER);
    let target_path = target_dir.join(&filename);

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to ensure research directory exists: {}", e))?;

    let final_path = ensure_unique_path(target_path);
    let final_filename = final_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&filename)
        .to_string();

    let content = build_entry_content(&title, &body, &req, &today);

    fs::write(&final_path, content).map_err(|e| format!("Failed to write entry: {}", e))?;

    Ok(format!("{}/{}", RESEARCH_FOLDER, final_filename))
}

#[tauri::command]
pub fn write_pantheon_entry(req: WritePantheonEntryRequest) -> Result<String, String> {
    perform_write_pantheon_entry(req)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_frontmatter_basic() {
        let content = "---\ntitle: foo\n---\nbody here";
        let (fm, body) = split_frontmatter(content).expect("frontmatter present");
        assert_eq!(fm, "title: foo");
        assert_eq!(body, "body here");
    }

    #[test]
    fn split_frontmatter_crlf() {
        let content = "---\r\ntitle: foo\r\n---\r\nbody here";
        let (fm, body) = split_frontmatter(content).expect("frontmatter present");
        assert!(fm.contains("title: foo"));
        assert_eq!(body, "body here");
    }

    #[test]
    fn split_frontmatter_no_frontmatter() {
        assert!(split_frontmatter("just body").is_none());
    }

    #[test]
    fn extract_tags_returns_strings() {
        let yaml: serde_yaml::Value =
            serde_yaml::from_str("tags:\n  - foo\n  - bar\n  - baz").unwrap();
        let tags = extract_tags(&yaml);
        assert_eq!(tags, vec!["foo".to_string(), "bar".to_string(), "baz".to_string()]);
    }

    #[test]
    fn extract_tags_missing() {
        let yaml: serde_yaml::Value = serde_yaml::from_str("title: foo").unwrap();
        assert!(extract_tags(&yaml).is_empty());
    }

    #[test]
    fn make_preview_truncates_with_ellipsis() {
        let long_body = "a".repeat(300);
        let preview = make_preview(&long_body);
        assert_eq!(preview.chars().count(), PREVIEW_CHAR_LIMIT + 1);
        assert!(preview.ends_with('…'));
    }

    #[test]
    fn make_preview_short_body() {
        let preview = make_preview("hello world");
        assert_eq!(preview, "hello world");
    }

    #[test]
    fn debug_parse_real_vault() {
        match parse_pantheon_from_vault() {
            Ok(entries) => {
                println!("=== PANTHEON PARSER OUTPUT ===");
                println!("Found {} entries", entries.len());
                for (i, entry) in entries.iter().enumerate() {
                    println!(
                        "{:3}. [{}] {} ({} words, body_len={}, source_type={:?})",
                        i + 1,
                        entry.entry_type,
                        entry.title,
                        entry.word_count,
                        entry.body.chars().count(),
                        entry.source_type
                    );
                    println!("       file: {}", entry.source_file);
                    println!("       tags: {:?}", entry.tags);
                }
                println!("=== END ===");
            }
            Err(e) => panic!("parser error: {}", e),
        }
    }

    #[test]
    fn body_captures_full_content_no_truncation() {
        let entries = parse_pantheon_from_vault().expect("parser ok");
        for entry in &entries {
            // body must be at least as long as body_preview
            assert!(
                entry.body.chars().count() >= entry.body_preview.chars().count(),
                "body shorter than preview for {}",
                entry.source_file
            );
            // For entries with substantial word counts, body should clearly exceed
            // the 200-char preview limit.
            if entry.word_count > 100 {
                assert!(
                    entry.body.chars().count() > 200,
                    "body for {} ({} words) is suspiciously short: {} chars",
                    entry.source_file,
                    entry.word_count,
                    entry.body.chars().count()
                );
            }
        }
    }

    fn make_request(title: &str, body: &str) -> WritePantheonEntryRequest {
        WritePantheonEntryRequest {
            title: title.to_string(),
            body: body.to_string(),
            source_type: None,
            source_url: None,
            source_date: None,
            additional_tags: Vec::new(),
            attachments: Vec::new(),
        }
    }

    #[test]
    fn test_sanitize_filename_replaces_unsafe_chars() {
        let cases = [
            ("foo/bar", "foo-bar"),
            ("foo\\bar", "foo-bar"),
            ("foo:bar", "foo-bar"),
            ("foo*bar", "foo-bar"),
            ("foo?bar", "foo-bar"),
            ("foo\"bar", "foo-bar"),
            ("foo<bar>baz", "foo-bar-baz"),
            ("foo|bar", "foo-bar"),
            ("normal title — ok", "normal title — ok"),
        ];
        for (input, expected) in cases {
            assert_eq!(sanitize_filename(input), expected, "for input {:?}", input);
        }
    }

    #[test]
    fn test_sanitize_filename_truncates_long_titles() {
        let long = "a".repeat(150);
        let sanitized = sanitize_filename(&long);
        assert_eq!(sanitized.chars().count(), 100);
    }

    #[test]
    fn test_build_entry_content_includes_required_fields() {
        let req = make_request("Test Title", "Some body content.");
        let content = build_entry_content("Test Title", "Some body content.", &req, "2026-04-28");
        assert!(content.starts_with("---\n"), "must start with frontmatter");
        assert!(content.contains("title: \"Test Title\""), "must include title");
        assert!(content.contains("type: research"), "must include type");
        assert!(content.contains("created: \"2026-04-28\""), "must include created date");
        assert!(content.contains("origin: \"Olympus dashboard\""), "must include origin");
        assert!(content.contains("- olympus/research"), "must include olympus/research tag");
        assert!(content.contains("Some body content."), "must include body");
    }

    #[test]
    fn test_build_entry_content_includes_optional_fields_when_provided() {
        let req = WritePantheonEntryRequest {
            title: "Test".to_string(),
            body: "body".to_string(),
            source_type: Some("transcript".to_string()),
            source_url: Some("https://example.com/talk".to_string()),
            source_date: Some("2025-01-15".to_string()),
            additional_tags: vec!["ai".to_string(), "talks".to_string()],
            attachments: Vec::new(),
        };
        let content = build_entry_content("Test", "body", &req, "2026-04-28");
        assert!(content.contains("source_type: \"transcript\""));
        assert!(content.contains("source_url: \"https://example.com/talk\""));
        assert!(content.contains("source_date: \"2025-01-15\""));
        assert!(content.contains("- research/transcript"));
        assert!(content.contains("- ai"));
        assert!(content.contains("- talks"));
    }

    #[test]
    fn test_build_entry_content_omits_optional_fields_when_empty() {
        let req = WritePantheonEntryRequest {
            title: "Test".to_string(),
            body: "body".to_string(),
            source_type: Some("".to_string()),
            source_url: None,
            source_date: Some("   ".to_string()),
            additional_tags: vec!["".to_string(), "  ".to_string()],
            attachments: Vec::new(),
        };
        let content = build_entry_content("Test", "body", &req, "2026-04-28");
        assert!(!content.contains("source_type:"), "should not include empty source_type");
        assert!(!content.contains("source_url:"), "should not include missing source_url");
        assert!(!content.contains("source_date:"), "should not include whitespace source_date");
        // No attachments → no frontmatter list, no wikilink in body
        assert!(!content.contains("attachments:"));
        assert!(!content.contains("![["));
        let tag_lines: Vec<&str> = content.lines().filter(|l| l.trim_start().starts_with("- ")).collect();
        assert_eq!(tag_lines, vec!["  - olympus/research"]);
    }

    #[test]
    fn test_build_entry_content_includes_attachments_frontmatter_and_wikilink() {
        let req = WritePantheonEntryRequest {
            title: "With File".to_string(),
            body: "User-typed body content.".to_string(),
            source_type: Some("paper".to_string()),
            source_url: None,
            source_date: None,
            additional_tags: Vec::new(),
            attachments: vec!["_attachments/foo-bar.pdf".to_string()],
        };
        let content = build_entry_content("With File", "User-typed body content.", &req, "2026-04-28");
        assert!(
            content.contains("attachments:\n  - \"_attachments/foo-bar.pdf\""),
            "frontmatter should include attachments list"
        );
        // Wikilink appears AFTER the body, on its own line, with blank line before
        assert!(
            content.contains("User-typed body content.\n\n![[_attachments/foo-bar.pdf]]\n"),
            "wikilink should follow body separated by a blank line"
        );
    }

    #[test]
    fn test_build_entry_content_skips_blank_attachment_paths() {
        let req = WritePantheonEntryRequest {
            title: "T".to_string(),
            body: "b".to_string(),
            source_type: None,
            source_url: None,
            source_date: None,
            additional_tags: Vec::new(),
            attachments: vec!["".to_string(), "   ".to_string()],
        };
        let content = build_entry_content("T", "b", &req, "2026-04-28");
        assert!(!content.contains("attachments:"));
        assert!(!content.contains("![["));
    }

    #[test]
    fn test_perform_write_rejects_empty_title() {
        let req = make_request("   ", "valid body");
        let result = perform_write_pantheon_entry(req);
        assert!(matches!(result, Err(ref msg) if msg.contains("Title")));
    }

    #[test]
    fn test_perform_write_rejects_empty_body() {
        let req = make_request("Valid title", "  \n  ");
        let result = perform_write_pantheon_entry(req);
        assert!(matches!(result, Err(ref msg) if msg.contains("Body")));
    }
}
