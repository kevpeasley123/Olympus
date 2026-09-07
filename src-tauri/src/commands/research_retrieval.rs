//! Deterministic, bounded retrieval. Research is evidence, never operator authority.
use std::collections::BTreeSet;
use serde::{Deserialize, Serialize};
use super::pantheon::PantheonEntry;

pub const MAX_SOURCES: usize = 3;
pub const MAX_EXCERPT_CHARS: usize = 4_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchExcerpt {
    pub title: String,
    pub source_file: String,
    pub source_date: Option<String>,
    pub stance: String,
    pub origin: Option<String>,
    pub excerpt: String,
    pub truncated: bool,
    pub fingerprint: String,
}

fn terms(text: &str) -> BTreeSet<String> {
    const STOP: &[&str] = &["the", "and", "for", "with", "this", "that", "from", "what", "when", "where", "why", "how", "should", "could", "would", "about", "have", "does", "into", "your", "you", "our", "are", "can", "will", "please", "olympus", "tell", "more"];
    text.split(|c: char| !c.is_alphanumeric())
        .map(str::to_lowercase)
        .filter(|s| s.chars().count() >= 3 && !STOP.contains(&s.as_str()))
        .map(|s| match s.as_str() {
            "agents" | "agentic" => "agent".into(),
            "orchestrate" | "orchestrating" => "orchestration".into(),
            _ => s,
        }).take(64).collect()
}

fn overlap(query: &BTreeSet<String>, text: &str) -> usize {
    // Do not cap document vocabulary: relevant material may occur late in a source.
    let words: BTreeSet<_> = text.split_whitespace().flat_map(terms).collect();
    query.intersection(&words).count()
}

fn excerpt(body: &str, query: &BTreeSet<String>) -> (String, bool) {
    let chars: Vec<char> = body.chars().collect();
    if chars.len() <= MAX_EXCERPT_CHARS { return (body.to_string(), false); }
    // Score bounded windows, so one huge paragraph cannot hide its relevant tail.
    let best = chars.chunks(1_000).enumerate()
        .map(|(i, chunk)| (i, overlap(query, &chunk.iter().collect::<String>())))
        .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))
        .map(|(i, _)| i * 1_000).unwrap_or(0);
    let start = best.saturating_sub(1_000).min(chars.len() - MAX_EXCERPT_CHARS);
    (chars[start..start + MAX_EXCERPT_CHARS].iter().collect(), true)
}

pub fn retrieve(entries: &[PantheonEntry], question: &str) -> Vec<ResearchExcerpt> {
    let query = terms(question);
    if query.is_empty() { return Vec::new(); }
    let mut ranked: Vec<_> = entries.iter().filter(|e| !e.body.trim().is_empty())
        .filter(|e| e.source_file.replace('\\', "/").starts_with("02 - Research/"))
        .map(|e| {
            let title = overlap(&query, &e.title);
            let metadata = overlap(&query, &format!("{} {}", e.tags.join(" "), e.project.as_deref().unwrap_or_default()));
            let body = overlap(&query, &e.body);
            (title * 5 + metadata * 2 + body, title, body, e)
        })
        // A body-only match needs two distinct terms, unless the question is one term.
        .filter(|(_, title, body, _)| *title > 0 || *body >= query.len().min(2))
        .collect();
    ranked.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.3.source_file.cmp(&b.3.source_file)));
    ranked.into_iter().take(MAX_SOURCES).map(|(_, _, _, e)| {
        let (excerpt, truncated) = excerpt(&e.body, &query);
        ResearchExcerpt {
            title: e.title.chars().take(240).collect(),
            source_file: e.source_file.chars().take(1_024).collect(),
            source_date: e.source_date.as_ref().or(e.created.as_ref()).map(|s| s.chars().take(80).collect()),
            stance: e.stance.clone(),
            origin: e.origin.clone(),
            fingerprint: super::vault_write::content_fingerprint(&e.body),
            excerpt, truncated,
        }
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn entry(title: &str, body: &str) -> PantheonEntry {
        serde_json::from_value(serde_json::json!({
            "id":title,"title":title,"sourceFile":format!("02 - Research/{title}.md"),
            "entryType":"research","stance":"unevaluated","origin":"collected",
            "sourceDate":"2026-07-29","tags":[],"wordCount":10,"fileModifiedAt":"",
            "bodyPreview":"","body":body
        })).unwrap()
    }
    #[test]
    fn selects_arguments_and_preserves_provenance_without_endorsement() {
        let sources = vec![entry("Agent orchestration", "Coding agents need independent verification."), entry("Gardening", "Water the bonsai.")];
        let found = retrieve(&sources, "Should Olympus orchestrate coding agents?");
        assert_eq!(found.len(), 1);
        assert!(found[0].excerpt.contains("independent verification"));
        assert_eq!(found[0].stance, "unevaluated");
        assert_eq!(found[0].origin.as_deref(), Some("collected"));
        assert_eq!(found[0].source_date.as_deref(), Some("2026-07-29"));
        assert_eq!(found[0].fingerprint.len(), 64);
        assert!(retrieve(&sources, "What's the weather?").is_empty());
        assert!(retrieve(&sources, "Tell me more").is_empty());
    }
    #[test]
    fn bounded_unicode_excerpt_finds_late_material_and_is_deterministic() {
        let body = format!("{}\nCoding agents need verification.{}", "水 ".repeat(9_000), "λ".repeat(8_000));
        let sources: Vec<_> = (0..8).map(|i| entry(&format!("Coding agents {i}"), &body)).collect();
        let found = retrieve(&sources, "coding agents verification");
        assert_eq!(found.len(), MAX_SOURCES);
        assert!(found.iter().all(|e| e.truncated && e.excerpt.chars().count() <= MAX_EXCERPT_CHARS));
        assert!(found[0].excerpt.contains("Coding agents need verification"));
        assert_eq!(found[0].title, "Coding agents 0");
    }
    #[test]
    fn does_not_retrieve_profile_observations_or_blank_bodies() {
        let mut observation = entry("Coding agents", "Coding agents");
        observation.source_file = "09 - System/Profile Observations.md".into();
        assert!(retrieve(&[observation, entry("Coding agents", "")], "coding agents").is_empty());
    }

    #[test]
    fn debug_retrieval_uses_real_pantheon_arguments() {
        let entries = super::super::pantheon::parse_pantheon_from_vault().expect("real vault scan");
        assert!(!entries.is_empty(), "the real vault must exist for this integration check");
        let selected = retrieve(&entries, "Should Olympus orchestrate coding agents?");
        assert!(!selected.is_empty(), "the real library must supply arguments for the memory acceptance question");
        assert!(selected.iter().all(|s| !s.excerpt.trim().is_empty() && s.source_file.starts_with("02 - Research/")));
        eprintln!("Research selected: {:?}", selected.iter().map(|s| &s.title).collect::<Vec<_>>());
    }
}
