//! Provider-independent, deterministic matching against a bounded declared project catalog.
//! This capability receives data, not paths, tools, or permission to fetch more sources.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceRef {
    pub source_type: String,
    pub source_id: String,
    pub fingerprint: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidencePart {
    pub source: SourceRef,
    pub text: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceArtifact {
    pub parts: Vec<EvidencePart>,
}
impl EvidenceArtifact {
    pub fn validate(&self) -> Result<(), String> {
        if self.parts.is_empty() || self.parts.len() > 4 {
            return Err("artifact_budget".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for p in &self.parts {
            if p.text.chars().count() > 2301
                || p.source.source_type.is_empty()
                || p.source.source_type.len() > 32
                || p.source.source_id.is_empty()
                || p.source.source_id.len() > 300
                || p.source.fingerprint.is_empty()
                || !ids.insert((&p.source.source_type, &p.source.source_id))
            {
                return Err("artifact_evidence_invalid".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub name: String,
    pub aliases: Vec<String>,
    pub description: String,
    pub source: String,
    pub fingerprint: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Relevance {
    pub state: String,
    pub suggested_projects: Vec<Project>,
    pub reason: String,
    pub ambiguity: bool,
    pub evidence_refs: Vec<SourceRef>,
    pub method: String,
}
fn contains_phrase(text: &str, phrase: &str) -> bool {
    let words = |s: &str| {
        s.split(|c: char| !c.is_alphanumeric())
            .filter(|s| !s.is_empty())
            .map(str::to_lowercase)
            .collect::<Vec<_>>()
            .join(" ")
    };
    let p = words(phrase);
    p.len() >= 4 && format!(" {} ", words(text)).contains(&format!(" {p} "))
}
pub fn match_projects(
    artifact: &EvidenceArtifact,
    projects: &[Project],
) -> Result<Relevance, String> {
    artifact.validate()?;
    if projects.len() > 24
        || projects.iter().any(|p| {
            p.name.is_empty()
                || p.source.is_empty()
                || p.fingerprint.is_empty()
                || p.aliases.len() > 12
                || p.description.chars().count() > 2000
        })
    {
        return Err("project_catalog_invalid".into());
    }
    // All names AND aliases are checked before choosing a result. A file-name match
    // must not mask another project's alias, as the v1 staged lookup could do.
    let mut matches = projects
        .iter()
        .filter(|p| {
            artifact.parts.iter().any(|part| {
                contains_phrase(&part.text, &p.name)
                    || p.aliases.iter().any(|a| contains_phrase(&part.text, a))
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    matches.sort_by(|a, b| a.source.cmp(&b.source));
    let ambiguity = matches.len() > 1;
    Ok(Relevance{state:if ambiguity{"ambiguous"}else if matches.len()==1{"suggested"}else{"unresolved"}.into(),reason:if ambiguity{"Several declared project names or aliases match. Verify the relationship; none is assigned."}else if matches.len()==1{"A declared project name or alias matches the evidence. Generated suggestion, not an accepted relationship."}else{"No declared name or alias matched this bounded evidence. A relationship may still exist."}.into(),suggested_projects:matches,ambiguity,evidence_refs:artifact.parts.iter().map(|p|p.source.clone()).collect(),method:"bounded_name_alias_match".into()})
}
pub fn contract() -> Value {
    let text = json!({"type":"string","minLength":1});
    let source = json!({"type":"object","additionalProperties":false,"required":["sourceType","sourceId","fingerprint"],"properties":{"sourceType":{"type":"string","minLength":1,"maxLength":32},"sourceId":{"type":"string","minLength":1,"maxLength":300},"fingerprint":text}});
    json!({"id":"project-relevance","version":2,"purpose":"Match bounded evidence to declared project names and aliases without forced assignment","inputSchema":{"type":"object","additionalProperties":false,"required":["artifact","projects"],"properties":{"artifact":{"type":"object","additionalProperties":false,"required":["parts"],"properties":{"parts":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"object","additionalProperties":false,"required":["source","text"],"properties":{"source":source,"text":{"type":"string","maxLength":2301}}}}}},"projects":{"type":"array","maxItems":24,"items":{"type":"object","additionalProperties":false,"required":["name","aliases","description","source","fingerprint"],"properties":{"name":text,"aliases":{"type":"array","maxItems":12,"items":text},"description":{"type":"string","maxLength":2000},"source":text,"fingerprint":text}}}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["state","suggestedProjects","reason","ambiguity","evidenceRefs","method"],"properties":{"state":{"enum":["suggested","ambiguous","unresolved"]},"suggestedProjects":{"type":"array","maxItems":24},"reason":text,"ambiguity":{"type":"boolean"},"evidenceRefs":{"type":"array","minItems":1,"maxItems":4,"items":source},"method":{"const":"bounded_name_alias_match"}}},"allowedCapabilities":["read_supplied_evidence","read_supplied_project_catalog"],"prohibitedEffects":["external_fetch","gmail_write","project_write","task_create","memory_promotion","skill_rewrite"],"evidenceRequirements":"Every artifact part and matched project retains source identity and fingerprint.","loopBudget":0,"successCriteria":"All names and aliases inspected before classification; ambiguity is preserved; no forced match.","implementation":"pure deterministic matcher"})
}
#[cfg(test)]
mod tests {
    use super::*;
    fn artifact(kind: &str) -> EvidenceArtifact {
        EvidenceArtifact {
            parts: vec![EvidencePart {
                source: SourceRef {
                    source_type: kind.into(),
                    source_id: "source-1".into(),
                    fingerprint: "abc".into(),
                },
                text: "Atlas launch review".into(),
            }],
        }
    }
    fn p(name: &str, aliases: &[&str]) -> Project {
        Project {
            name: name.into(),
            aliases: aliases.iter().map(|s| s.to_string()).collect(),
            description: "".into(),
            source: format!("{name}.md"),
            fingerprint: "project-hash".into(),
        }
    }
    #[test]
    fn direct_name_cannot_mask_competing_alias() {
        let r = match_projects(
            &artifact("gmail"),
            &[p("Atlas", &[]), p("Beacon", &["Atlas"])],
        )
        .unwrap();
        assert!(r.ambiguity);
        assert_eq!(r.suggested_projects.len(), 2);
    }
    #[test]
    fn document_and_mail_use_same_matcher() {
        for kind in ["gmail", "document"] {
            let r = match_projects(&artifact(kind), &[p("Beacon", &["Atlas"])]).unwrap();
            assert_eq!(r.state, "suggested");
            assert_eq!(r.evidence_refs[0].source_type, kind);
        }
    }
    #[test]
    fn missing_match_is_not_forced_by_description() {
        let mut project = p("Beacon", &[]);
        project.description = "Atlas launch review".into();
        assert_eq!(
            match_projects(&artifact("document"), &[project])
                .unwrap()
                .state,
            "unresolved"
        );
    }
    #[test]
    fn invalid_evidence_and_catalog_fail_closed() {
        let mut a = artifact("document");
        a.parts[0].source.fingerprint.clear();
        assert!(match_projects(&a, &[]).is_err());
        assert!(match_projects(&artifact("document"), &vec![p("Atlas", &[]); 25]).is_err());
        assert!(
            serde_json::from_value::<EvidenceArtifact>(json!({"parts":[],"tool":"web"})).is_err()
        );
    }
}
