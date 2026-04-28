use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, Utc};
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

const VAULT_PATH: &str =
    r"C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault";
const RESEARCH_FOLDER: &str = "02 - Research";
const REQUIRED_TAG: &str = "olympus/research";
const PREVIEW_CHAR_LIMIT: usize = 200;

fn get_vault_path() -> PathBuf {
    PathBuf::from(VAULT_PATH)
}

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
}
