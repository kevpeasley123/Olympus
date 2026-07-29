pub mod assistant;
pub mod attachments;
pub mod delegation;
pub mod markets;
pub mod observations;
pub mod pantheon;
pub mod pantheon_migrate;
pub mod persistence;
pub mod profile;
pub mod project_notes;
pub mod projects;
pub mod tasks;
pub mod vault_context;
pub mod vault_git;
pub mod vault_graph;
pub mod vault_write;
pub mod write_confirm;
pub mod weather;

use std::path::PathBuf;

pub const VAULT_PATH: &str =
    r"C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault";

pub fn get_vault_path() -> PathBuf {
    PathBuf::from(VAULT_PATH)
}
