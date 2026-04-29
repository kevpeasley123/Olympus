use std::fs;
use std::path::Path;
use std::time::SystemTime;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::get_vault_path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionQueueTask {
    pub id: String,
    pub text: String,
    #[serde(rename = "sourceFile")]
    pub source_file: String,
    #[serde(rename = "sourceFolder")]
    pub source_folder: TaskSource,
    #[serde(rename = "lineNumber")]
    pub line_number: u32,
    #[serde(rename = "fileModifiedAt")]
    pub file_modified_at: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskSource {
    Tasks,
    DailyBriefs,
    Projects,
}

impl TaskSource {
    fn priority(&self) -> u8 {
        match self {
            Self::Tasks => 0,
            Self::DailyBriefs => 1,
            Self::Projects => 2,
        }
    }

    fn folder_name(&self) -> &'static str {
        match self {
            Self::Tasks => "03 - Tasks",
            Self::DailyBriefs => "08 - Daily Briefs",
            Self::Projects => "01 - Projects",
        }
    }
}

fn parse_task_line(line: &str) -> Option<(bool, String)> {
    let trimmed = line.trim_start();
    let bytes = trimmed.as_bytes();
    if bytes.len() < 6 {
        return None;
    }
    if bytes[0] != b'-' || bytes[1] != b' ' || bytes[2] != b'[' {
        return None;
    }
    let completed = match bytes[3] {
        b' ' => false,
        b'x' | b'X' => true,
        _ => return None,
    };
    if bytes[4] != b']' || bytes[5] != b' ' {
        return None;
    }
    let text = trimmed[6..].trim();
    if text.is_empty() {
        return None;
    }
    Some((completed, text.to_string()))
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

struct ParsedTask {
    task: ActionQueueTask,
    mtime: SystemTime,
}

fn parse_folder(vault: &Path, source: TaskSource) -> Vec<ParsedTask> {
    let folder_path = vault.join(source.folder_name());
    if !folder_path.exists() {
        return Vec::new();
    }

    let mut out = Vec::new();

    for entry in WalkDir::new(&folder_path)
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
                eprintln!(
                    "[action-queue] walk error in {}: {}",
                    folder_path.display(),
                    err
                );
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
                    "[action-queue] metadata read failed for {}: {}",
                    path.display(),
                    err
                );
                continue;
            }
        };

        let mtime = metadata.modified().unwrap_or_else(|_| SystemTime::now());

        let contents = match fs::read_to_string(path) {
            Ok(s) => s,
            Err(err) => {
                eprintln!(
                    "[action-queue] read failed for {} (likely non-UTF-8): {}",
                    path.display(),
                    err
                );
                continue;
            }
        };

        let source_file = relative_to_vault(vault, path);
        let mtime_iso = iso8601(mtime);

        for (idx, line) in contents.lines().enumerate() {
            if let Some((completed, text)) = parse_task_line(line) {
                if completed {
                    continue;
                }
                let line_number = (idx + 1) as u32;
                let id = format!("{}:{}", source_file, line_number);
                let task = ActionQueueTask {
                    id,
                    text,
                    source_file: source_file.clone(),
                    source_folder: source,
                    line_number,
                    file_modified_at: mtime_iso.clone(),
                    completed: false,
                };
                out.push(ParsedTask { task, mtime });
            }
        }
    }

    out
}

pub fn parse_tasks_from_vault() -> Result<Vec<ActionQueueTask>, String> {
    let vault = get_vault_path();

    if !vault.exists() {
        eprintln!(
            "[action-queue] vault path does not exist: {}",
            vault.display()
        );
        return Ok(Vec::new());
    }

    let mut all = Vec::new();
    for source in [TaskSource::Tasks, TaskSource::DailyBriefs, TaskSource::Projects] {
        all.extend(parse_folder(&vault, source));
    }

    all.sort_by(|a, b| {
        a.task
            .source_folder
            .priority()
            .cmp(&b.task.source_folder.priority())
            .then_with(|| b.mtime.cmp(&a.mtime))
            .then_with(|| a.task.line_number.cmp(&b.task.line_number))
    });

    Ok(all.into_iter().map(|p| p.task).collect())
}

#[tauri::command]
pub fn fetch_action_queue() -> Result<Vec<ActionQueueTask>, String> {
    parse_tasks_from_vault()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_task_line_unchecked() {
        let result = parse_task_line("- [ ] hello world");
        assert_eq!(result, Some((false, "hello world".to_string())));
    }

    #[test]
    fn parse_task_line_checked_lower() {
        let result = parse_task_line("- [x] done");
        assert_eq!(result, Some((true, "done".to_string())));
    }

    #[test]
    fn parse_task_line_checked_upper() {
        let result = parse_task_line("- [X] done");
        assert_eq!(result, Some((true, "done".to_string())));
    }

    #[test]
    fn parse_task_line_indented() {
        let result = parse_task_line("    - [ ] indented task");
        assert_eq!(result, Some((false, "indented task".to_string())));
    }

    #[test]
    fn parse_task_line_empty_text_skipped() {
        assert_eq!(parse_task_line("- [ ]"), None);
        assert_eq!(parse_task_line("- [ ] "), None);
        assert_eq!(parse_task_line("- [ ]   "), None);
    }

    #[test]
    fn parse_task_line_missing_space_after_bracket_skipped() {
        // Strict matching: "- [ ]task" without space should not match
        assert_eq!(parse_task_line("- [ ]task"), None);
    }

    #[test]
    fn parse_task_line_unrelated_content_skipped() {
        assert_eq!(parse_task_line("just a regular line"), None);
        assert_eq!(parse_task_line("# heading"), None);
        assert_eq!(parse_task_line("- bullet without checkbox"), None);
        assert_eq!(parse_task_line(""), None);
    }

    #[test]
    fn debug_parse_real_vault() {
        match parse_tasks_from_vault() {
            Ok(tasks) => {
                println!("=== ACTION QUEUE PARSER OUTPUT ===");
                println!("Found {} tasks", tasks.len());
                for (i, task) in tasks.iter().enumerate() {
                    println!(
                        "{:3}. [{:?}] {} ({}:{})",
                        i + 1,
                        task.source_folder,
                        task.text,
                        task.source_file,
                        task.line_number
                    );
                }
                println!("=== END ===");
            }
            Err(e) => panic!("parser error: {}", e),
        }
    }
}
