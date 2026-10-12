#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;

use std::fs;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;

use commands::vault_write;
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
use std::sync::Mutex;
use tauri::Manager;

const SCHEMA: &str = include_str!("../schema.sql");

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
            app.manage(commands::memory::MemoryService::start(
                commands::get_vault_path(), app.path().app_local_data_dir()?.join("memory-index.sqlite"),
            ));
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
            commands::organizer::create_organizer_task, commands::organizer::update_organizer_task,
            commands::organizer::list_organizer_tasks, commands::organizer::set_organizer_intent,
            commands::organizer::move_organizer_task,
            commands::organizer::prepare_organizer_delegation,
            commands::organizer::fetch_organizer_task, commands::organizer::accept_organizer_result,
            commands::organizer::finish_organizer_task, commands::organizer::acknowledge_organizer_event,
            commands::organizer::organizer_overview,
            commands::skill_guidance::recommend_resource_skills,
            commands::resource_intake::resource_skills, commands::resource_intake::add_resource_skill, commands::attachments::extract_resource_text,
            commands::gmail::situations::documents::situation_document_status, commands::gmail::situations::documents::situation_document_open,
            commands::gmail::situations::attention::email_attention_decide, commands::gmail::situations::situation_snapshot, commands::gmail::situations::engine::situation_refresh, commands::gmail::situations::situation_set_background, commands::gmail::situations::situation_update, commands::gmail::situations::situation_edit, commands::gmail::situations::drafts::situation_draft, commands::gmail::situations::drafts::situation_save_draft,
            commands::gmail::intelligence::analyze_communications, commands::gmail::intelligence::communication_runs, commands::gmail::intelligence::communication_run_events, commands::gmail::intelligence::communication_feedback, commands::gmail::intelligence::communication_skills,
            commands::gmail::intelligence::inspection::communication_workflow, commands::gmail::intelligence::inspection::inspect_communication_run,
            commands::gmail::gmail_workspace, commands::gmail::gmail_remove_cache, commands::gmail::gmail_cache_counts, commands::gmail::gmail_status, commands::gmail::gmail_connect, commands::gmail::gmail_cancel, commands::gmail::gmail_disconnect, commands::gmail::gmail_sync, commands::gmail::gmail_set_horizon, commands::gmail::gmail_search, commands::gmail::gmail_thread,
            send_assistant_message,
            commands::assistant::cancel_assistant_message,
            commands::memory::memory_status, commands::memory::memory_preview,
            commands::memory::memory_rebuild, commands::memory::memory_request_evidence,
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
            commands::models::save_model_selection,
            commands::models::model_diagnostics,
            commands::models::voice_usage,
            commands::models::record_voice_request,
            create_voice_session,
            commands::elevenlabs::elevenlabs_status,
            commands::elevenlabs::elevenlabs_connect,
            commands::elevenlabs::elevenlabs_disconnect,
            commands::elevenlabs::elevenlabs_check,
            commands::elevenlabs::elevenlabs_synthesize,
            commands::elevenlabs::elevenlabs_cancel,
            load_persisted_state,
            save_settings,
            save_tool_states,
            append_conversation_messages,
            begin_operator_session,
            clear_conversation,
            launch_quick_app,
            open_vault_note,
            restart_olympus,
            scan_tracked_projects,
            commands::project_management::project_members, commands::project_management::link_project,
            commands::project_management::set_project_visibility, commands::project_management::save_project_intake,
            commands::project_management::pick_project_folder,
            commands::project_intake::inspect_project, commands::project_intake::confirm_project_brief,
            fetch_action_queue,
            fetch_pantheon_entries,
            fetch_operator_profile,
            resolve_vault_write,
            commands::external_link::open_external_link,
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
