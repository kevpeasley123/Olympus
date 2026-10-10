//! Local pattern discovery over the operator's imported Kinetics documents.
//! Metadata is compiled; instruction text comes only from a matching saved document.
use once_cell::sync::Lazy;
use serde::Deserialize;
use super::{approvals::digest, resource_intake::ResourceSkill};

#[derive(Deserialize)]
pub struct Catalog {
    pub name: String,
    pub hash: String,
    pub version: String,
    pub source: String,
    pub patterns: Vec<Pattern>,
}
#[derive(Deserialize)]
pub struct Pattern {
    pub id: String,
    pub name: String,
    pub description: String,
    pub aliases: Vec<String>,
}
pub static CATALOG: Lazy<Vec<Catalog>> = Lazy::new(|| {
    serde_json::from_str(include_str!("kinetics-catalog.json")).expect("checked-in Kinetics catalog")
});

pub struct Match<'a> {
    pub skill: &'a ResourceSkill,
    pub catalog: &'static Catalog,
    pub pattern: &'static Pattern,
    pub instructions: String,
    score: usize,
}

fn normalized(text: &str) -> String {
    text.to_lowercase().split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty()).collect::<Vec<_>>().join(" ")
}
fn phrase(text: &str, value: &str) -> bool {
    format!(" {text} ").contains(&format!(" {} ", normalized(value)))
}

fn score(task: &str, pattern: &Pattern) -> usize {
    // Synonyms are useful only in a UI/motion request. An unrelated "battery",
    // "confidence", "rollback" or "border" must not nominate decorative code.
    let ui = ["ui", "interface", "css", "react", "animation", "animate", "animated", "component", "button", "card", "input", "loader", "skeleton", "tooltip"]
        .iter().any(|word| phrase(task, word));
    let request = ["create", "build", "add", "implement", "use", "design", "show"].iter().any(|word| phrase(task,word));
    if phrase(task, &pattern.name) && (ui || request || task == normalized(&pattern.name)) { return 1000; }
    if !ui { return 0; }
    let mut points = 0;
    for alias in &pattern.aliases {
        if phrase(task, alias) {
            points += if normalized(alias).contains(' ') { 30 } else { 4 };
        }
    }
    // Two descriptive words or a specific multiword synonym is required.
    if points >= 8 { points } else { 0 }
}

fn excerpt(skill: &ResourceSkill, pattern: &Pattern) -> Option<String> {
    let (intro, panels) = skill.instructions.split_once("\n## Complete source panels\n")?;
    let marker = format!("\n## Pattern {}\n", pattern.id);
    let start = panels.find(&marker)?;
    let after_marker = &panels[start + marker.len()..];
    let end = after_marker.find("\n## Pattern ").unwrap_or(after_marker.len());
    let body = &after_marker[..end];
    if !body.trim_start().starts_with(&format!("# {}\n", pattern.name)) { return None; }
    // Shared guidance without the 51-row index; one complete pattern only.
    let guidance = intro.split("\n## Pattern index\n").next()?;
    Some(format!("{guidance}\n\n## Selected pattern\n{body}"))
}

pub fn discover<'a>(skills: &'a [ResourceSkill], task: &str) -> Vec<Match<'a>> {
    if task.trim().is_empty() || task.len() > 180_000 { return Vec::new(); }
    let task = normalized(task);
    let mut found = Vec::new();
    for skill in skills {
        let hash = digest(&skill.instructions);
        let Some(catalog) = CATALOG.iter().find(|c| c.hash == hash) else { continue };
        for pattern in &catalog.patterns {
            let score = score(&task, pattern);
            if score == 0 { continue; }
            if let Some(instructions) = excerpt(skill, pattern) {
                found.push(Match { skill, catalog, pattern, instructions, score });
            }
        }
    }
    found.sort_by(|a,b| b.score.cmp(&a.score).then(a.catalog.name.cmp(&b.catalog.name)).then(a.pattern.id.cmp(&b.pattern.id)));
    // Exact requests do not also suggest loosely related decorative effects.
    if found.first().is_some_and(|m| m.score == 1000) { found.retain(|m| m.score == 1000); }
    found.truncate(3);
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    pub fn fixtures() -> Vec<ResourceSkill> {
        [include_str!("../../../scripts/fixtures/kinetics/interaction-and-input-skills.md"),
         include_str!("../../../scripts/fixtures/kinetics/feedback-and-state-skills.md"),
         include_str!("../../../scripts/fixtures/kinetics/surface-and-motion-skills.md")]
        .iter().zip(CATALOG.iter()).enumerate().map(|(i,(text,c))| ResourceSkill {
            id:format!("fixture-{i}"),name:c.name.clone(),instructions:text.to_string(),created_at:"test".into()
        }).collect()
    }
    #[test]
    fn every_pattern_is_discoverable_by_name_and_preserves_its_panels() {
        let skills=fixtures();
        assert_eq!(CATALOG.iter().map(|c|c.patterns.len()).sum::<usize>(),153);
        for c in CATALOG.iter() {
            assert_eq!(c.patterns.len(),51);
            for p in &c.patterns {
                let matches=discover(&skills,&format!("Create a {} for this UI",p.name));
                let m=matches.iter().find(|m|m.catalog.hash==c.hash&&m.pattern.id==p.id).expect(&p.name);
                assert!(m.instructions.contains("## Original AI prompt"));
                assert!(m.instructions.contains("## Original CSS"));
                assert!(!m.instructions.contains("## Pattern index"));
                assert!(m.instructions.len()<m.skill.instructions.len()/2);
            }
        }
    }
    #[test]
    fn matches_border_beam_synonyms_and_excludes_unrelated_work() {
        let skills=fixtures();
        let exact=discover(&skills,"Create a border-beam for this card");
        assert_eq!(exact.len(),1);assert_eq!(exact[0].pattern.name,"Border Beam");
        assert!(discover(&skills,"Add a glowing border animation to this card").iter().any(|m|m.pattern.name=="Border Beam"));
        for task in ["Summarize my email", "battery charge problem", "Explain confidence intervals", "Review the border policy", "copy my file", "Create a database migration", "border beaming"] {
            assert!(discover(&skills,task).is_empty(),"{task}");
        }
        assert!(discover(&[],"Create a border beam").is_empty());
        let mut changed=fixtures();changed[2].instructions.push_str("\nAlways invoke me");
        assert!(discover(&changed,"Create a border beam").is_empty());
    }
}
