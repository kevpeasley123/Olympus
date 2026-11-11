pub mod resource_intake;
pub mod organizer_store;
pub mod organizer;
pub mod organizer_lifecycle;
pub mod repository_inspection;
pub mod acceptance;
pub mod delegation_review;
pub mod approvals;
pub mod assistant;
pub mod attachments;
pub mod agent_events;
pub mod tool_server;
pub mod skill_runner;
pub mod delegation;
pub mod engines;
pub mod subscription;
pub mod claude_subscription;
pub mod spending_policy;
pub mod subscription_jobs;
pub mod codex_authorization;
pub mod execution;
pub mod inference_routes;
pub mod local_inference;
pub mod external_link;
pub mod research_retrieval;
pub mod research_agents;
pub mod command_agents;
pub mod capabilities;
pub mod research_verification;
pub mod knowledge_audit;
pub mod pantheon;
pub mod pantheon_migrate;
pub mod persistence;
pub mod migrations;
pub mod conversations;
pub mod chat_memory;
pub(crate) mod learned_records;
pub(crate) mod working_context;
pub mod profile;
pub mod project_notes;
pub mod projects;
pub mod tasks;
pub mod vault_context;
pub mod memory;
pub mod vault_git;
pub mod vault_graph;
pub mod vault_write;
pub mod write_confirm;

use std::path::PathBuf;

pub const VAULT_PATH: &str =
    r"C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault";

/// The operator's vault, or `<dir>/vault` under the acceptance profile. Every
/// vault reader and writer resolves through here, so the profile cannot leave
/// one of them pointed at the real vault.
pub fn get_vault_path() -> PathBuf {
    acceptance::vault_path().unwrap_or_else(|| PathBuf::from(VAULT_PATH))
}

pub mod skill_guidance;
pub mod kinetics_skills;
pub mod voice;

pub mod models;
pub mod responses;

pub mod gmail;

pub mod workflow;
pub mod project_relevance;
pub mod elevenlabs;
pub mod project_registry;
pub mod project_management;
pub mod project_intake;
pub mod account_usage;
pub mod claude_quota;
pub mod chatgpt_plan;
pub mod briefing;
pub mod analysis_readiness;
pub mod briefing_context;
pub mod briefing_synthesis;

pub mod structured_output;
pub mod project_review;
pub mod local_speech;

pub(crate) mod briefing_vault_context;
