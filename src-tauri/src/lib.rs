#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use commands::markets::fetch_market_quotes;
use commands::projects::scan_tracked_projects;
use commands::tasks::fetch_action_queue;
use commands::weather::fetch_weather;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::Manager;

const SCHEMA: &str = include_str!("../schema.sql");

#[derive(Debug, Deserialize)]
struct MemoryArtifact {
    vault_path: String,
    folder: String,
    file_name: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct WriteResult {
    path: String,
}

fn safe_join(base: &Path, folder: &str, file_name: &str) -> Result<PathBuf, String> {
    if file_name.contains("..") || folder.contains("..") {
        return Err("Path traversal is not allowed.".to_string());
    }

    let mut path = base.to_path_buf();

    if !folder.trim().is_empty() {
        path.push(folder);
    }

    path.push(file_name);
    Ok(path)
}

#[tauri::command]
fn initialize_database(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;
    let db_path = app_dir.join("olympus.sqlite");
    let connection = Connection::open(&db_path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(SCHEMA)
        .map_err(|error| error.to_string())?;

    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_memory_artifact(artifact: MemoryArtifact) -> Result<WriteResult, String> {
    let vault = PathBuf::from(&artifact.vault_path);

    if !vault.exists() || !vault.is_dir() {
        return Err("Configured vault path does not exist or is not a directory.".to_string());
    }

    let target = safe_join(&vault, &artifact.folder, &artifact.file_name)?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(&target, artifact.content).map_err(|error| error.to_string())?;

    Ok(WriteResult {
        path: target.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn launch_quick_app(app_id: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match app_id.as_str() {
            "quick-spotify" => {
                Command::new("cmd")
                    .args(["/C", "start", "", "spotify:"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-discord" => {
                Command::new("cmd")
                    .args(["/C", "start", "", "discord://"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-x" => {
                Command::new("cmd")
                    .args(["/C", "start", "", "firefox", "https://x.com"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-youtube" => {
                Command::new("cmd")
                    .args(["/C", "start", "", "firefox", "https://youtube.com"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            _ => return Err("Unknown quick app target.".to_string()),
        }

        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Quick app launching is only wired for Windows right now.".to_string())
}

#[tauri::command]
fn restart_olympus(app: tauri::AppHandle) {
    app.restart();
}

fn load_olympus_env() {
    let manifest_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate_paths = [
        manifest_root.join("../.env"),
        manifest_root.join(".env"),
        PathBuf::from("../.env"),
        PathBuf::from(".env"),
    ];

    for path in candidate_paths {
        if path.exists() {
            match dotenvy::from_path(&path) {
                Ok(_) => {
                    eprintln!("[Olympus::Env] loaded .env from {}", path.display());
                    return;
                }
                Err(error) => {
                    eprintln!(
                        "[Olympus::Env] found .env at {} but could not load it: {}",
                        path.display(),
                        error
                    );
                }
            }
        }
    }

    eprintln!("[Olympus::Env] no .env file found in expected Olympus paths");
}

pub fn run() {
    load_olympus_env();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            initialize_database,
            write_memory_artifact,
            launch_quick_app,
            restart_olympus,
            fetch_market_quotes,
            scan_tracked_projects,
            fetch_weather,
            fetch_action_queue
        ])
        .run(tauri::generate_context!())
        .expect("error while running Project Olympus");
}
