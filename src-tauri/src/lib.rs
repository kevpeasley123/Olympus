#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use commands::vault_write;
use commands::write_confirm;
use commands::write_confirm::resolve_vault_write;

use commands::attachments::{
    extract_pdf_text, pick_attachment_file, save_attachment_to_vault,
};
use commands::assistant::send_assistant_message;
use commands::markets::fetch_market_quotes;
use commands::observations::append_profile_observation;
use commands::pantheon::{fetch_pantheon_entries, write_pantheon_entry};
use commands::pantheon_migrate::migrate_pantheon_schema;
use commands::profile::fetch_operator_profile;
use commands::persistence::{
    append_conversation_messages, clear_conversation, load_persisted_state, save_settings,
    save_tool_states, Db,
};
use commands::projects::scan_tracked_projects;
use commands::tasks::fetch_action_queue;
use commands::weather::fetch_weather;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

const SCHEMA: &str = include_str!("../schema.sql");

#[derive(Debug, Deserialize)]
struct MemoryArtifact {
    folder: String,
    file_name: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteResult {
    path: String,
    /// False when the operator declined the overwrite. Declining is a correct
    /// outcome, not a failure — the command did its job by asking and honouring
    /// the answer — so it returns Ok and lets the caller phrase it neutrally.
    written: bool,
}

/// Builds the vault-relative path for an artifact. Containment is proven by
/// `vault_write::resolve_vault_path`, not here — a substring check for ".."
/// is not a containment check.
fn artifact_relative_path(folder: &str, file_name: &str) -> PathBuf {
    let mut path = PathBuf::new();

    if !folder.trim().is_empty() {
        path.push(folder);
    }

    path.push(file_name);
    path
}

/// Opens the local database and applies the schema. Runs once at startup so the
/// frontend can assume persistence is ready by the time it can invoke anything.
fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
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

    eprintln!("[Olympus::Db] opened {}", db_path.display());
    Ok(connection)
}

#[tauri::command]
async fn write_memory_artifact(
    app: tauri::AppHandle,
    db: tauri::State<'_, commands::persistence::Db>,
    artifact: MemoryArtifact,
) -> Result<WriteResult, String> {
    // The vault root comes from Rust, not the caller. Accepting it from the
    // frontend gave the app two sources of truth for where the vault lives:
    // this command wrote to the configured path while the Pantheon and
    // attachment writers used the constant, so a divergence would have split
    // the vault in half.
    let relative = artifact_relative_path(&artifact.folder, &artifact.file_name);
    let target = vault_write::resolve_vault_path(&relative).map_err(|error| error.to_string())?;

    // Stable key regardless of separator, so a row written on one platform is
    // still found on another.
    let key = relative.to_string_lossy().replace('\\', "/");

    // Disk I/O goes to the blocking pool, not a tokio worker. This command now
    // awaits a human, so it must not also be the thing holding a worker busy.
    let target_for_read = target.clone();
    let on_disk = tauri::async_runtime::spawn_blocking(move || fs::read_to_string(&target_for_read).ok())
        .await
        .map_err(|error| format!("Artifact read task panicked: {error}"))?;

    // Scoped so the database lock is released before any await — a MutexGuard
    // held across an await is not Send, and this function now awaits a human.
    let recorded = commands::persistence::read_artifact_fingerprint(db.inner(), &key)?;

    // Declared, not inferred: these are files the app regenerates from its own
    // state.
    let decision = vault_write::decide(
        vault_write::WriteIntent::RegenerateDerived,
        on_disk.as_deref(),
        recorded.as_deref(),
    );

    if let vault_write::WriteDecision::NeedsConfirmation(reason) = decision {
        let summary =
            vault_write::summarise_diff(on_disk.as_deref().unwrap_or_default(), &artifact.content);

        let approved = write_confirm::request_confirmation(
            &app,
            key.clone(),
            vault_write::WriteIntent::RegenerateDerived,
            reason,
            summary,
        )
        .await;

        if !approved {
            return Ok(WriteResult {
                path: target.to_string_lossy().to_string(),
                written: false,
            });
        }
    }

    // Confirmation is resolved by this point; the write itself also goes to the
    // blocking pool rather than running on a worker thread.
    let target_for_write = target.clone();
    let content = artifact.content.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        if let Some(parent) = target_for_write.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&target_for_write, &content).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("Artifact write task panicked: {error}"))??;

    // Recorded only after a successful write, so a failed write cannot leave a
    // fingerprint claiming authorship of contents that were never stored.
    commands::persistence::store_artifact_fingerprint(
        db.inner(),
        &key,
        &vault_write::content_fingerprint(&artifact.content),
    )?;

    Ok(WriteResult {
        path: target.to_string_lossy().to_string(),
        written: true,
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
        .setup(|app| {
            let connection = open_database(app.handle())?;
            app.manage(Db(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_assistant_message,
            load_persisted_state,
            save_settings,
            save_tool_states,
            append_conversation_messages,
            clear_conversation,
            write_memory_artifact,
            launch_quick_app,
            restart_olympus,
            fetch_market_quotes,
            scan_tracked_projects,
            fetch_weather,
            fetch_action_queue,
            fetch_pantheon_entries,
            fetch_operator_profile,
            resolve_vault_write,
            append_profile_observation,
            write_pantheon_entry,
            migrate_pantheon_schema,
            pick_attachment_file,
            extract_pdf_text,
            save_attachment_to_vault
        ])
        .run(tauri::generate_context!())
        .expect("error while running Project Olympus");
}
