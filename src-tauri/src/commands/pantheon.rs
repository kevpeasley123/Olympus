use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use once_cell::sync::Lazy;

use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::vault_write::{classify, resolve_vault_path, WriteIntent};

/// Parsed entries keyed by path, kept only while the file's mtime is unchanged.
/// Skipping unchanged files is what makes a 300-second scan cheap enough to run
/// in every mode rather than only where the library panel was mounted.
static ENTRY_CACHE: Lazy<Mutex<HashMap<PathBuf, (SystemTime, PantheonEntry)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
    /// Who *found* the source, not who wrote the file. See `ORIGIN_VALUES`.
    pub origin: Option<String>,
    /// What wrote the file — the value `origin` used to carry.
    pub written_by: Option<String>,
    /// Always populated: an absent or unreadable stance is `unevaluated`, which
    /// is deliberately not the same as `endorsed`.
    pub stance: String,
    /// One line on what the entry is for. Optional, and its absence is surfaced
    /// rather than filled in — a guessed purpose is worse than a stated gap.
    pub why_kept: Option<String>,
    pub project: Option<String>,
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

/// Who found the source. Everything the operator collects is pre-filtered by
/// his own taste, so a library reasoning only from it is a well-read version of
/// him. Sources Olympus found — often *because* they cut against the library —
/// have to stay distinguishable.
pub(crate) const ORIGIN_VALUES: &[&str] = &["collected", "olympus-found"];

/// How the operator has judged the source. Without this, presence in the vault
/// reads as endorsement and the assistant drifts toward agreeing with whatever
/// was collected.
const STANCE_VALUES: &[&str] = &["endorsed", "provisional", "disputed", "unevaluated"];

/// The stance of an entry that does not declare one. Not `endorsed`: the whole
/// point of the field is that being in the library is not agreement.
const DEFAULT_STANCE: &str = "unevaluated";

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

pub(crate) fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    // Notes created by the PowerShell scaffold scripts carry a UTF-8 BOM;
    // notes the app writes via fs::write do not. Without stripping it, the
    // frontmatter is invisible and the note reads as unstructured prose — a
    // scaffolded research note would simply never appear in the library.
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);

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

/// Reads a key whose values are a closed set, discarding anything outside it.
///
/// `origin` used to hold writer provenance — every entry written before the
/// schema change says `"Olympus dashboard"`. That string is not an origin at
/// all, and silently accepting it would report the operator as having judged
/// where a source came from when nobody did. Values outside `allowed` are
/// dropped with a warning rather than passed through.
fn extract_enum(
    value: &serde_yaml::Value,
    key: &str,
    allowed: &[&str],
    file: &Path,
) -> Option<String> {
    let raw = extract_string(value, key)?;
    if allowed.contains(&raw.as_str()) {
        return Some(raw);
    }

    eprintln!(
        "[pantheon] {} declares {key}: {:?}, which is not one of {:?} — ignoring it",
        file.display(),
        raw,
        allowed
    );
    None
}

pub(crate) fn extract_tags(value: &serde_yaml::Value) -> Vec<String> {
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

pub(crate) fn parse_pantheon_from_vault() -> Result<Vec<PantheonEntry>, String> {
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
    // Rebuilt each scan rather than mutated, so files deleted from the vault
    // fall out of the cache instead of lingering.
    let mut fresh_cache: HashMap<PathBuf, (SystemTime, PantheonEntry)> = HashMap::new();
    let cached = ENTRY_CACHE.lock().map(|guard| guard.clone()).unwrap_or_default();

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

        // A research library changes when the operator adds something, not
        // every scan. Re-reading and re-parsing every file — one of them
        // ~17,000 words — on a timer was pure waste, and this scan now runs in
        // every mode rather than only where the panel was mounted.
        if let Some((cached_mtime, cached_entry)) = cached.get(path) {
            if *cached_mtime == mtime {
                fresh_cache.insert(path.to_path_buf(), (mtime, cached_entry.clone()));
                entries.push(cached_entry.clone());
                continue;
            }
        }

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
        let origin = extract_enum(&frontmatter, "origin", ORIGIN_VALUES, path);
        let written_by = extract_string(&frontmatter, "written_by");
        let stance = extract_enum(&frontmatter, "stance", STANCE_VALUES, path)
            .unwrap_or_else(|| DEFAULT_STANCE.to_string());
        let why_kept = extract_string(&frontmatter, "why_kept");
        let project = extract_string(&frontmatter, "project");
        let body_full = body.trim().to_string();
        let word_count = count_words(&body_full);
        let body_preview = make_preview(&body_full);
        let file_modified_at = iso8601(mtime);

        let parsed = PantheonEntry {
            id: source_file.clone(),
            title,
            source_file,
            entry_type,
            source_type,
            created,
            source_date,
            origin,
            written_by,
            stance,
            why_kept,
            project,
            tags,
            word_count,
            file_modified_at,
            body_preview,
            body: body_full,
        };

        fresh_cache.insert(path.to_path_buf(), (mtime, parsed.clone()));
        entries.push(parsed);
    }

    if let Ok(mut guard) = ENTRY_CACHE.lock() {
        *guard = fresh_cache;
    }

    entries.sort_by(|a, b| {
        let a_key = a.created.as_deref().unwrap_or(a.file_modified_at.as_str());
        let b_key = b.created.as_deref().unwrap_or(b.file_modified_at.as_str());
        b_key.cmp(a_key)
    });

    Ok(entries)
}

#[tauri::command]
pub async fn fetch_pantheon_entries() -> Result<Vec<PantheonEntry>, String> {
    tauri::async_runtime::spawn_blocking(parse_pantheon_from_vault)
        .await
        .map_err(|error| format!("Pantheon scan task panicked: {error}"))?
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
    /// Defaults to `unevaluated` rather than to agreement.
    #[serde(default)]
    pub stance: Option<String>,
    /// Optional by decision. An entry without one saves, and renders as having
    /// no stated purpose.
    #[serde(default)]
    pub why_kept: Option<String>,
    /// Defaults to `collected` — the capture form is the operator's own hand.
    #[serde(default)]
    pub origin: Option<String>,
    #[serde(default)]
    pub project: Option<String>,
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

    // What wrote the file. This is the value `origin` used to carry; `origin`
    // now answers a different question and could not keep holding both.
    frontmatter.push_str("written_by: \"Olympus dashboard\"\n");

    // Anything unrecognised falls back rather than being written through: a
    // frontmatter value outside the set would be dropped by the parser on the
    // next scan, so writing one would produce an entry that silently loses a
    // field it appears to have.
    let origin = req
        .origin
        .as_deref()
        .map(str::trim)
        .filter(|value| ORIGIN_VALUES.contains(value))
        .unwrap_or("collected");
    frontmatter.push_str(&format!("origin: {origin}\n"));

    let stance = req
        .stance
        .as_deref()
        .map(str::trim)
        .filter(|value| STANCE_VALUES.contains(value))
        .unwrap_or(DEFAULT_STANCE);
    frontmatter.push_str(&format!("stance: {stance}\n"));

    // Omitted entirely when blank. An empty `why_kept:` key would read as a
    // stated purpose that happens to be empty, which is not the same as never
    // having given one.
    if let Some(why_kept) = &req.why_kept {
        let trimmed = why_kept.trim();
        if !trimmed.is_empty() {
            frontmatter.push_str(&format!("why_kept: \"{}\"\n", escape_yaml_string(trimmed)));
        }
    }

    if let Some(project) = &req.project {
        let trimmed = project.trim();
        if !trimmed.is_empty() {
            frontmatter.push_str(&format!("project: \"{}\"\n", escape_yaml_string(trimmed)));
        }
    }

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

    // ensure_unique_path below guarantees this never overwrites, which is what
    // puts it in the silent tier. If that guarantee is ever removed, the intent
    // declared here must change with it.
    let _tier = classify(WriteIntent::CreateUnique);

    let target_path = resolve_vault_path(&Path::new(RESEARCH_FOLDER).join(&filename))
        .map_err(|error| error.to_string())?;

    let target_dir = target_path
        .parent()
        .ok_or_else(|| "Research entry has no parent directory.".to_string())?
        .to_path_buf();

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
pub async fn write_pantheon_entry(
    db: tauri::State<'_, crate::commands::persistence::Db>,
    req: WritePantheonEntryRequest,
) -> Result<String, String> {
    let written = tauri::async_runtime::spawn_blocking(move || perform_write_pantheon_entry(req))
        .await
        .map_err(|error| format!("Pantheon write task panicked: {error}"))??;

    crate::commands::persistence::log_vault_write(db.inner(), &written, "create");

    Ok(written)
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

    /// The scaffold scripts write UTF-8 with a BOM. Before this was handled,
    /// every scaffolded note read as having no frontmatter and was skipped.
    #[test]
    fn split_frontmatter_tolerates_a_utf8_bom() {
        let content = "\u{feff}---\ntitle: foo\n---\nbody here";
        let (fm, body) = split_frontmatter(content).expect("BOM must not hide frontmatter");
        assert_eq!(fm, "title: foo");
        assert_eq!(body, "body here");
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

                // Preconditions, not decoration. parse_pantheon_from_vault
                // returns Ok(empty) when the vault is missing, so without these
                // this test passes identically whether it parsed the real
                // library or found nothing at all — which is exactly how the
                // BOM bug stayed invisible.
                assert!(
                    get_vault_path().exists(),
                    "the real vault must be present for this test to mean anything"
                );
                assert!(
                    !entries.is_empty(),
                    "the vault has research entries; an empty result means the scan silently \
                     matched none of them"
                );
                for entry in &entries {
                    assert!(!entry.title.trim().is_empty(), "every entry needs a title");
                    assert!(
                        !entry.source_file.trim().is_empty(),
                        "every entry needs a source file"
                    );
                }
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
            stance: None,
            why_kept: None,
            origin: None,
            project: None,
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
        assert!(
            content.contains("written_by: \"Olympus dashboard\""),
            "writer provenance moved to written_by when origin was repurposed"
        );
        assert!(content.contains("- olympus/research"), "must include olympus/research tag");
        assert!(content.contains("Some body content."), "must include body");

        // Defaults, stated rather than inherited: an entry the operator captured
        // by hand is `collected`, and nothing is endorsed just by being saved.
        assert!(content.contains("origin: collected"), "origin defaults to collected");
        assert!(
            content.contains("stance: unevaluated"),
            "stance defaults to unevaluated, never to endorsed"
        );
        assert!(
            !content.contains("why_kept:"),
            "an unstated purpose is omitted, not written as an empty value"
        );
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
            ..make_request("Test", "body")
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
            source_date: Some("   ".to_string()),
            additional_tags: vec!["".to_string(), "  ".to_string()],
            ..make_request("Test", "body")
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
            attachments: vec!["_attachments/foo-bar.pdf".to_string()],
            ..make_request("With File", "User-typed body content.")
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
            attachments: vec!["".to_string(), "   ".to_string()],
            ..make_request("T", "b")
        };
        let content = build_entry_content("T", "b", &req, "2026-04-28");
        assert!(!content.contains("attachments:"));
        assert!(!content.contains("![["));
    }

    /// The hazard accepted when `origin` was repurposed. Every entry written
    /// before the change says `origin: "Olympus dashboard"` — a writer, not an
    /// origin. If that survived the parse, an un-migrated note would report the
    /// operator as having judged where a source came from when nobody did.
    #[test]
    fn a_legacy_origin_value_is_dropped_rather_than_read_as_a_judgement() {
        for legacy in ["Olympus dashboard", "Olympus Pantheon"] {
            let frontmatter: serde_yaml::Value =
                serde_yaml::from_str(&format!("origin: \"{legacy}\"")).expect("valid yaml");
            assert_eq!(
                extract_enum(&frontmatter, "origin", ORIGIN_VALUES, Path::new("legacy.md")),
                None,
                "{legacy:?} is a writer, not an origin"
            );
        }
    }

    #[test]
    fn a_declared_origin_survives_the_parse() {
        for declared in ORIGIN_VALUES {
            let frontmatter: serde_yaml::Value =
                serde_yaml::from_str(&format!("origin: {declared}")).expect("valid yaml");
            assert_eq!(
                extract_enum(&frontmatter, "origin", ORIGIN_VALUES, Path::new("new.md")).as_deref(),
                Some(*declared)
            );
        }
    }

    /// Degrading to `endorsed` would make an unreadable value read as agreement,
    /// which is the one direction this field must never fail in.
    #[test]
    fn an_unknown_stance_degrades_to_unevaluated() {
        for raw in ["agree", "ENDORSED", "sceptical", ""] {
            let frontmatter: serde_yaml::Value =
                serde_yaml::from_str(&format!("stance: \"{raw}\"")).expect("valid yaml");
            let stance = extract_enum(&frontmatter, "stance", STANCE_VALUES, Path::new("x.md"))
                .unwrap_or_else(|| DEFAULT_STANCE.to_string());
            assert_eq!(stance, DEFAULT_STANCE, "for stance {raw:?}");
        }
    }

    #[test]
    fn a_declared_stance_and_purpose_reach_the_written_file() {
        let req = WritePantheonEntryRequest {
            stance: Some("disputed".to_string()),
            why_kept: Some("Counters the agent-framework consensus.".to_string()),
            origin: Some("olympus-found".to_string()),
            project: Some("01 - Projects/Project Olympus.md".to_string()),
            ..make_request("Test", "body")
        };
        let content = build_entry_content("Test", "body", &req, "2026-07-26");

        assert!(content.contains("stance: disputed"));
        assert!(content.contains("origin: olympus-found"));
        assert!(content.contains("why_kept: \"Counters the agent-framework consensus.\""));
        assert!(content.contains("project: \"01 - Projects/Project Olympus.md\""));
    }

    /// A value outside the set would be dropped by the parser on the next scan,
    /// so writing it would produce an entry that silently loses a field it
    /// appears to carry.
    #[test]
    fn an_unrecognised_stance_is_not_written_through() {
        let req = WritePantheonEntryRequest {
            stance: Some("mostly agree".to_string()),
            origin: Some("borrowed".to_string()),
            ..make_request("Test", "body")
        };
        let content = build_entry_content("Test", "body", &req, "2026-07-26");

        assert!(content.contains("stance: unevaluated"));
        assert!(content.contains("origin: collected"));
        assert!(!content.contains("mostly agree"));
        assert!(!content.contains("borrowed"));
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
