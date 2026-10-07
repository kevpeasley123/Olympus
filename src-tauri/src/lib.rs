#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;

use std::fs;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;

use commands::vault_write;
use commands::write_confirm;
use commands::write_confirm::resolve_vault_write;

use commands::attachments::{
    extract_pdf_text, pick_attachment_file, save_attachment_to_vault,
};
use commands::assistant::send_assistant_message;
use commands::voice::create_voice_session;
use commands::delegation::{
    cancel_delegation_run, fetch_delegation_diff, list_delegation_runs,
    resume_delegation_run, start_delegation_run, prepare_delegation_run, prepare_delegation_resume, DelegationProcesses,
};
use commands::observations::append_profile_observation;
use commands::memory_promotion::promote_chat_memory;
use commands::pantheon::{fetch_pantheon_entries, write_pantheon_entry};
use commands::pantheon_migrate::migrate_pantheon_schema;
use commands::profile::fetch_operator_profile;
use commands::persistence::{
    append_conversation_messages, begin_operator_session, clear_conversation, fetch_recent_vault_writes,
    load_persisted_state, save_settings, save_tool_states, Db,
};
use commands::projects::scan_tracked_projects;
use commands::tasks::fetch_action_queue;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

const SCHEMA: &str = include_str!("../schema.sql");

/// The derived files this command may regenerate. Rust owns the path: taking a
/// folder and file name from the webview let any script in it write anywhere
/// in the vault, including `.git/hooks`, without a dialog for a new file.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
enum MemoryArtifactKind {
    ResearchBase,
    ProjectsCanvas,
}

impl MemoryArtifactKind {
    fn relative_path(self) -> &'static str {
        match self {
            Self::ResearchBase => "00 - Dashboard/Olympus Research.base",
            Self::ProjectsCanvas => "00 - Dashboard/Olympus Projects.canvas",
        }
    }
}

#[derive(Debug, Deserialize)]
struct MemoryArtifact {
    kind: MemoryArtifactKind,
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
    let has_process_id = {
        let mut columns = connection
            .prepare("PRAGMA table_info(delegation_runs)")
            .map_err(|error| error.to_string())?;
        let found = columns
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .any(|name| name == "process_id");
        found
    };
    if !has_process_id {
        connection
            .execute(
                "ALTER TABLE delegation_runs ADD COLUMN process_id INTEGER",
                [],
            )
            .map_err(|error| error.to_string())?;
    }

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
    // Already separator-stable, so a fingerprint row written on one platform
    // is still found on another.
    let key = artifact.kind.relative_path();
    let relative = std::path::Path::new(key);
    let target = vault_write::resolve_vault_path(relative).map_err(|error| error.to_string())?;

    // Disk I/O goes to the blocking pool, not a tokio worker. This command now
    // awaits a human, so it must not also be the thing holding a worker busy.
    let target_for_read = target.clone();
    let on_disk = tauri::async_runtime::spawn_blocking(move || vault_write::read_existing(&target_for_read))
        .await
        .map_err(|error| format!("Artifact read task panicked: {error}"))??;

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
            key.to_string(),
            vault_write::WriteIntent::RegenerateDerived,
            reason,
            summary,
        )
        .await;

        if !approved {
            return Ok(WriteResult {
                path: vault_write::display_path(&target),
                written: false,
            });
        }
    }

    // The vault can be re-pointed, or a link planted, while the dialog is open.
    let resolved = vault_write::resolve_vault_path(relative).map_err(|error| error.to_string())?;
    if resolved != target {
        return Err("The vault location changed during review. Nothing was written.".to_string());
    }

    // Confirmation is resolved by this point; the write itself also goes to the
    // blocking pool rather than running on a worker thread. It lands only if
    // the file still holds the bytes the decision above was made about.
    let content = artifact.content.clone();
    tauri::async_runtime::spawn_blocking(move || {
        vault_write::replace_if_unchanged(&resolved, on_disk.as_deref(), &content)
    })
    .await
    .map_err(|error| format!("Artifact write task panicked: {error}"))??;

    // Recorded only after a successful write, so a failed write cannot leave a
    // fingerprint claiming authorship of contents that were never stored.
    commands::persistence::store_artifact_fingerprint(
        db.inner(),
        key,
        &vault_write::content_fingerprint(&artifact.content),
    )?;
    // Logged before the commit, which can fail after the file has landed.
    commands::persistence::log_vault_write(db.inner(), key, "overwrite");
    commands::vault_git::commit_vault_file(key, "update").map_err(|error| {
        format!(
            "The vault file was written at {key}, but its automatic Git commit failed: {error}. \
             The file remains in the vault."
        )
    })?;

    Ok(WriteResult {
        path: vault_write::display_path(&target),
        written: true,
    })
}

/// Opens a vault note in Obsidian.
///
/// The path arrives from the webview and ends at a process spawn, which is the
/// hazard class the vault path was hardened against in `62c957e`. So it is
/// resolved through the same containment guard every vault write uses, and the
/// URI is assembled here rather than accepted ready-made — the webview never
/// gets to choose the scheme.
#[tauri::command]
fn open_vault_note(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let relative = std::path::Path::new(&relative_path);
    let target = vault_write::resolve_vault_path(relative).map_err(|error| error.to_string())?;

    if !target.exists() {
        return Err(format!("{relative_path} is not in the vault."));
    }

    let vault_name = commands::get_vault_path()
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine the vault name.".to_string())?;

    let uri = format!(
        "obsidian://open?vault={}&file={}",
        urlencoding::encode(&vault_name),
        urlencoding::encode(&relative_path)
    );

    // Handed to the OS URL handler directly. Through `cmd /C start` the `&`
    // in the URI was a command separator and `file=…` ran as a program.
    app.opener()
        .open_url(uri, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn launch_quick_app(app_id: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        match app_id.as_str() {
            "quick-spotify" => {
                commands::delegation::hide_console(&mut Command::new("cmd"))
                    .args(["/C", "start", "", "spotify:"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-discord" => {
                commands::delegation::hide_console(&mut Command::new("cmd"))
                    .args(["/C", "start", "", "discord://"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-x" => {
                commands::delegation::hide_console(&mut Command::new("cmd"))
                    .args(["/C", "start", "", "firefox", "https://x.com"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            "quick-youtube" => {
                commands::delegation::hide_console(&mut Command::new("cmd"))
                    .args(["/C", "start", "", "firefox", "https://youtube.com"])
                    .spawn()
                    .map_err(|error| error.to_string())?;
            }
            _ => return Err("Unknown quick app target.".to_string()),
        }

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    let _ = app_id;
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

/// Settles the process environment before anything reads it. Under the
/// acceptance profile `.env` is never opened and the provider keys are removed
/// from this process, so no chat, voice or verification path can reach a paid
/// provider. The file itself is untouched.
fn prepare_environment() {
    let profile = commands::acceptance::acceptance_dir();
    let plan = commands::acceptance::startup_environment(profile.as_deref());
    if plan.load_dotenv {
        load_olympus_env();
    }
    // Still single-threaded here: the builder, the runtime and every command
    // start after this returns.
    for key in plan.remove {
        std::env::remove_var(key);
    }
    if let Some(dir) = profile {
        eprintln!("[Olympus::Acceptance] profile {}", dir.display());
    }
}

pub fn run() {
    // Before anything else: `.env`, the window and its webview profile, the
    // database, the keyring and the workers all follow from this decision.
    let context = tauri::generate_context!();
    if let Err(message) = commands::acceptance::check_startup(
        cfg!(debug_assertions),
        commands::acceptance::acceptance_dir().as_deref(),
        &context.config().identifier,
    ) {
        commands::acceptance::refuse_startup(&message);
    }
    prepare_environment();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(commands::external_link::navigation_guard())
        .setup(|app| {
            let connection = open_database(app.handle())?;
            if let Some(dir) = commands::acceptance::acceptance_dir() {
                commands::acceptance::record_launch(&connection, &dir, &app.config().identifier)?;
            }
            commands::knowledge_audit::recover(&connection)?;
            commands::research_verification::recover(&connection)?;
            commands::gmail::recover(&connection)?;
            commands::gmail::intelligence::recover(&connection)?;
            let session_id = commands::delegation::run_id();
            connection.execute("INSERT INTO operator_sessions(id) VALUES (?1)", [&session_id])?;
            app.manage(commands::approvals::ApprovalState::new(session_id));
            connection.execute("UPDATE model_requests SET record_json=json_set(record_json,'$.status','interrupted','$.errorCode','application_restarted') WHERE json_extract(record_json,'$.status')='started'", [])?;
            app.manage(Db(Mutex::new(connection)));
            app.manage(DelegationProcesses::default());
            app.manage(commands::gmail::Runtime::default());
            // No background sync or understanding under the acceptance
            // profile: its Gmail account row is synthetic.
            if !commands::acceptance::active() {
                commands::gmail::start_cadence(app.handle().clone());
                commands::gmail::situations::start_cadence(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::gmail::situations::documents::situation_document_status, commands::gmail::situations::documents::situation_document_open,
            commands::gmail::situations::situation_snapshot, commands::gmail::situations::engine::situation_refresh, commands::gmail::situations::situation_set_background, commands::gmail::situations::situation_update, commands::gmail::situations::situation_edit, commands::gmail::situations::drafts::situation_draft, commands::gmail::situations::drafts::situation_save_draft,
            commands::gmail::intelligence::analyze_communications, commands::gmail::intelligence::communication_runs, commands::gmail::intelligence::communication_run_events, commands::gmail::intelligence::communication_feedback, commands::gmail::intelligence::communication_skills,
            commands::gmail::intelligence::inspection::communication_workflow, commands::gmail::intelligence::inspection::inspect_communication_run,
            commands::gmail::gmail_workspace, commands::gmail::gmail_remove_cache, commands::gmail::gmail_cache_counts, commands::gmail::gmail_status, commands::gmail::gmail_connect, commands::gmail::gmail_cancel, commands::gmail::gmail_disconnect, commands::gmail::gmail_sync, commands::gmail::gmail_set_horizon, commands::gmail::gmail_search, commands::gmail::gmail_thread,
            send_assistant_message,
            commands::assistant::cancel_assistant_message,
            commands::acceptance::acceptance_profile,
            commands::knowledge_audit::start_knowledge_audit,
            commands::research_verification::research_agent_catalog,
            commands::command_agents::command_agent_catalog,
            commands::capabilities::command_capabilities,
            commands::capabilities::command_missions,
            commands::research_verification::start_research_verification,
            commands::research_verification::inspect_research_verification,
            commands::research_verification::list_research_verifications,
            commands::research_verification::cancel_research_verification,
            commands::knowledge_audit::list_knowledge_audits,
            commands::knowledge_audit::inspect_knowledge_audit,
            commands::models::model_routes,
            commands::models::model_diagnostics,
            commands::models::record_voice_request,
            create_voice_session,
            load_persisted_state,
            save_settings,
            save_tool_states,
            append_conversation_messages,
            begin_operator_session,
            clear_conversation,
            write_memory_artifact,
            launch_quick_app,
            open_vault_note,
            restart_olympus,
            scan_tracked_projects,
            fetch_action_queue,
            fetch_pantheon_entries,
            fetch_operator_profile,
            resolve_vault_write,
            commands::external_link::open_external_link,
            append_profile_observation,
            promote_chat_memory,
            write_pantheon_entry,
            migrate_pantheon_schema,
            fetch_recent_vault_writes,
            commands::vault_graph::fetch_vault_graph,
            pick_attachment_file,
            extract_pdf_text,
            save_attachment_to_vault,
            prepare_delegation_run,
            prepare_delegation_resume,
            commands::approvals::cancel_delegation_proposal,
            start_delegation_run,
            resume_delegation_run,
            cancel_delegation_run,
            list_delegation_runs,
            fetch_delegation_diff,
            commands::delegation_review::fetch_delegation_review,
            commands::delegation_review::run_delegation_check,
            commands::delegation_review::delegation_review_fingerprint,
            commands::delegation_review::complete_delegation_review
        ])
        .run(context)
        .expect("error while running Project Olympus");
}
