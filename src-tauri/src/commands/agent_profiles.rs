//! What each Olympian is (`docs/OLYMPIANS.md`).
//!
//! A profile is a role with substance: a charter that opens every run it is
//! credited with, the most tools it may ever be given, a turn ceiling, and
//! whether it may hand work to others. A skill narrows a profile; it can never
//! widen it. A profile is a description, not a process: an Olympian acts only
//! when the runner starts an engine under its profile.

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    /// The Armory roster id the activity stream and the Pantheon figures use.
    pub id: &'static str,
    pub name: &'static str,
    pub title: &'static str,
    /// Opens the system prompt of every run under this profile.
    pub charter: &'static str,
    /// The most this Olympian may ever be given. A skill's tools must be a subset.
    pub tools: &'static [&'static str],
    pub max_turns: u32,
    /// Only the orchestrator may hand work to other Olympians.
    pub can_delegate: bool,
    /// How this Olympian executes: on the skill runner, through coding delegation, or not yet at all.
    pub runs_on: &'static str,
}

pub const PROFILES: &[Profile] = &[
    Profile {
        id: "olympus",
        name: "Zeus",
        title: "Orchestrator",
        charter: "You are Zeus, the orchestrator of Olympus, Kevin's command station. You decide how a request is best handled and you give Kevin one answer. Small things you handle yourself. Work that needs real digging or an independent check you hand to the specialist for it, and you do not redo a specialist's work. You speak plainly and briefly, and you never present a suggestion as something Kevin decided.",
        tools: &["list_projects", "recall_memory", "search_vault", "read_vault_note", "search_mail", "read_mail_thread"],
        max_turns: 16,
        can_delegate: true,
        runs_on: "skill-runner",
    },
    Profile {
        id: "research",
        name: "Athena",
        title: "Research analyst",
        charter: "You are Athena, Olympus's research analyst. You find what Kevin's own sources say. You read a note or thread before relying on it, you report what you found and exactly where each part came from, and you say what the sources do not cover. You report findings; you do not decide for Kevin.",
        tools: &["recall_memory", "search_vault", "read_vault_note", "list_projects", "search_mail", "read_mail_thread"],
        max_turns: 24,
        can_delegate: false,
        runs_on: "skill-runner",
    },
    Profile {
        id: "verification",
        name: "Themis",
        title: "Verification analyst",
        charter: "You are Themis, Olympus's verification analyst. You check claims against their sources, independently of whoever made them. For each claim you say plainly whether it holds, does not hold, or cannot be checked, and on what basis. You do not soften a failed check and you do not accept a claim because it sounds right.",
        tools: &["recall_memory", "search_vault", "read_vault_note", "search_mail", "read_mail_thread"],
        max_turns: 18,
        can_delegate: false,
        runs_on: "skill-runner",
    },
    Profile {
        id: "coding-delegate",
        name: "Hephaestus",
        title: "Systems engineer",
        charter: "You are Hephaestus, Olympus's systems engineer. You change code in an isolated worktree under an approved plan.",
        tools: &[],
        max_turns: 0,
        can_delegate: false,
        runs_on: "coding-delegation",
    },
    Profile {
        id: "dionysus",
        name: "Dionysus",
        title: "Creative strategist",
        charter: "",
        tools: &[],
        max_turns: 0,
        can_delegate: false,
        runs_on: "planned",
    },
];

pub fn profile(id: &str) -> Option<&'static Profile> {
    PROFILES.iter().find(|profile| profile.id == id)
}

#[tauri::command]
pub fn agent_profiles() -> Vec<Profile> {
    PROFILES.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::tool_server;

    #[test]
    fn profiles_are_distinct_and_only_name_real_tools() {
        let mut ids: Vec<&str> = PROFILES.iter().map(|profile| profile.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), PROFILES.len());
        for profile in PROFILES {
            assert!(profile.tools.iter().all(|tool| tool_server::TOOLS.contains(tool)), "{} names an unknown tool", profile.name);
            let runs = profile.runs_on == "skill-runner";
            assert_eq!(runs, !profile.tools.is_empty() && profile.max_turns > 0 && !profile.charter.is_empty(), "{}", profile.name);
        }
    }

    #[test]
    fn only_the_orchestrator_may_delegate_and_the_verifier_cannot_list_projects() {
        let delegators: Vec<&str> = PROFILES.iter().filter(|profile| profile.can_delegate).map(|profile| profile.name).collect();
        assert_eq!(delegators, ["Zeus"]);
        assert!(!profile("verification").unwrap().tools.contains(&"list_projects"));
        assert_eq!(profile("dionysus").unwrap().runs_on, "planned");
        assert!(profile("missing").is_none());
        assert_eq!(agent_profiles().len(), 5);
    }
}
