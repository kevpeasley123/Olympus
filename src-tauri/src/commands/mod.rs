pub mod attachments;
pub mod markets;
pub mod pantheon;
pub mod projects;
pub mod tasks;
pub mod weather;

use std::path::PathBuf;

pub const VAULT_PATH: &str =
    r"C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault";

pub fn get_vault_path() -> PathBuf {
    PathBuf::from(VAULT_PATH)
}
