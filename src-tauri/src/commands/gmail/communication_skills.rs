//! Communication assessment and synthesis helpers. Only assessment is registered as a skill.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    Review,
    Verify,
    Monitor,
    NoAction,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Attention {
    Yes,
    No,
    Uncertain,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Evidence {
    pub message_id: String,
    pub thread_id: String,
    pub fingerprint: String,
    pub timestamp: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Message {
    pub evidence: Evidence,
    pub sender: String,
    pub subject: String,
    pub text: String,
    pub sent: bool,
    pub body_available: bool,
    pub candidates: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadInput {
    pub messages: Vec<Message>,
}
impl ThreadInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.messages.is_empty() || self.messages.len() > 4 {
            return Err("skill_thread_budget".into());
        }
        let thread = &self.messages[0].evidence.thread_id;
        for m in &self.messages {
            if m.evidence.message_id.is_empty()
                || m.evidence.fingerprint.is_empty()
                || thread.is_empty()
                || &m.evidence.thread_id != thread
                || m.text.chars().count() > 2000
                || m.subject.chars().count() > 300
                || m.sender.chars().count() > 300
            {
                return Err("skill_input_or_evidence_invalid".into());
            }
            if m.candidates.iter().any(|c| {
                !matches!(
                    c.as_str(),
                    "possible_response_needed"
                        | "possible_deadline"
                        | "possible_project_relationship"
                )
            }) {
                return Err("skill_unknown_candidate".into());
            }
        }
        if self
            .messages
            .windows(2)
            .any(|w| w[0].evidence.timestamp > w[1].evidence.timestamp)
        {
            return Err("skill_message_order".into());
        }
        Ok(())
    }
    pub fn refs(&self) -> Vec<Evidence> {
        self.messages.iter().map(|m| m.evidence.clone()).collect()
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Triage {
    pub attention: Attention,
    pub reason_codes: Vec<String>,
    pub summary: String,
    pub evidence_refs: Vec<Evidence>,
}
fn triage(input:&ThreadInput)->Result<Triage,String>{
 input.validate()?;let latest=input.messages.last().unwrap();
 let mut kinds=input.messages.iter().flat_map(|m|m.candidates.clone()).collect::<std::collections::BTreeSet<_>>();
 let response=kinds.contains("possible_response_needed");let deadline=kinds.contains("possible_deadline");let project=kinds.contains("possible_project_relationship");
 let (attention,summary)=if !latest.body_available {kinds.insert("source_unavailable".into());(Attention::Uncertain,"Latest body is unavailable; attention cannot be assessed.")}
 else if latest.sent&&(response||deadline){kinds.insert("later_sent_message".into());(Attention::Uncertain,"A later sent message may change the earlier attention signal; resolution is unverified.")}
 else if deadline{(Attention::Yes,"Possible deadline language was detected; its date and applicability are unverified.")}
 else if response{(Attention::Yes,"A received message contains a possible response need; the question needs source review.")}
 else if project{(Attention::Uncertain,"A possible project reference was detected; the relationship is unconfirmed.")}
 else{(Attention::No,"No supported attention signal was found in the inspected subset.")};
 Ok(Triage{attention,summary:summary.into(),reason_codes:kinds.into_iter().collect(),evidence_refs:input.refs()})
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Summary {
    pub what_happened: String,
    pub what_changed: String,
    pub what_matters: String,
    pub evidence_refs: Vec<Evidence>,
}
fn summarize_with_triage(input: &ThreadInput, t: &Triage) -> Result<Summary, String> {
    input.validate()?;
    let last = input.messages.last().unwrap();
    let quote = last
        .text
        .split_terminator(['\n', '.', '!'])
        .map(str::trim)
        .find(|s| !s.is_empty())
        .unwrap_or("Body unavailable")
        .chars()
        .take(180)
        .collect::<String>();
    let changed = if input.messages.len() > 1 {
        if last.sent {
            "Latest cached message is sent; check whether it resolves the earlier request.".into()
        } else {
            format!("{} cached messages inspected; latest is received. A substantive change is not verified.",input.messages.len())
        }
    } else {
        "One cached message inspected; no earlier comparison available.".into()
    };
    Ok(Summary {
        what_happened: format!("Latest source: “{quote}”"),
        what_changed: changed,
        what_matters: t.summary.clone(),
        evidence_refs: input.refs(),
    })
}
pub use crate::commands::project_relevance::{Project, Relevance};
pub fn artifact(
    input: &ThreadInput,
) -> Result<crate::commands::project_relevance::EvidenceArtifact, String> {
    use crate::commands::project_relevance::{EvidenceArtifact, EvidencePart, SourceRef};
    input.validate()?;
    Ok(EvidenceArtifact {
        parts: input
            .messages
            .iter()
            .map(|m| EvidencePart {
                source: SourceRef {
                    source_type: "gmail".into(),
                    source_id: m.evidence.message_id.clone(),
                    fingerprint: m.evidence.fingerprint.clone(),
                },
                text: format!("{} {}", m.subject, m.text),
            })
            .collect(),
    })
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Assessment {
    pub triage: Triage,
    pub summary: Summary,
}
pub fn assess(input: &ThreadInput) -> Result<Assessment, String> {
    let triage = triage(input)?;
    let summary = summarize_with_triage(input, &triage)?;
    Ok(Assessment { triage, summary })
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recommendation {
    pub disposition: Disposition,
    pub guidance: String,
    pub priority: String,
    pub evidence_refs: Vec<Evidence>,
}
pub fn recommend(t: &Triage, p: &Relevance) -> Result<Recommendation, String> {
    if t.evidence_refs.is_empty()
        || p.evidence_refs.is_empty()
        || t.evidence_refs.iter().any(|r| r.fingerprint.is_empty())
        || p.evidence_refs.iter().any(|r| {
            !t.evidence_refs
                .iter()
                .any(|e| e.message_id == r.source_id && e.fingerprint == r.fingerprint)
        })
    {
        return Err("recommendation_requires_evidence".into());
    }
    let has=|code:&str|t.reason_codes.iter().any(|r|r==code);
    let disposition=if p.ambiguity||has("source_unavailable"){Disposition::Verify}
    else if has("later_sent_message"){Disposition::Review}
    else if has("possible_deadline"){Disposition::Verify}
    else if t.attention==Attention::No {Disposition::NoAction}
    else {Disposition::Review};
    let priority = if t.attention == Attention::Yes {
        "attention_candidate"
    } else if disposition == Disposition::NoAction {
        "background"
    } else {
        "review_candidate"
    };
    let guidance = match disposition {
        Disposition::Verify => "Verify the source and unresolved details before deciding.",
        Disposition::Review => {
            "Review the latest thread before deciding whether it needs a response."
        }
        Disposition::Monitor => "Recheck when new evidence arrives.",
        Disposition::NoAction => "No action identified in this inspected subset.",
    };
    Ok(Recommendation {
        disposition,
        guidance: guidance.into(),
        priority: priority.into(),
        evidence_refs: t.evidence_refs.clone(),
    })
}
pub fn registry() -> Value {
    let mut assessment = contract(
        "communication-assess",
        "Assess attention and concise source context in a bounded communication thread",
        "ThreadInput",
        "Assessment",
        0,
    );
    assessment["allowedCapabilities"] = json!(["read_supplied_thread"]);
    json!([assessment, crate::commands::project_relevance::contract()])
}
fn object(properties: Value) -> Value {
    let required = properties
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    json!({"type":"object","additionalProperties":false,"properties":properties,"required":required})
}
fn schema(name: &str) -> Value {
    let text = json!({"type":"string"});
    let evidence = object(
        json!({"messageId":{"type":"string","minLength":1},"threadId":{"type":"string","minLength":1},"fingerprint":{"type":"string","minLength":1},"timestamp":{"type":"integer"}}),
    );
    let refs = json!({"type":"array","minItems":1,"maxItems":4,"items":evidence});
    match name {
        "ThreadInput" => object(
            json!({"messages":{"type":"array","minItems":1,"maxItems":4,"items":object(json!({"evidence":evidence,"sender":{"type":"string","maxLength":300},"subject":{"type":"string","maxLength":300},"text":{"type":"string","maxLength":2000},"sent":{"type":"boolean"},"bodyAvailable":{"type":"boolean"},"candidates":{"type":"array","items":{"enum":["possible_response_needed","possible_deadline","possible_project_relationship"]}}}))}}),
        ),
        "Triage" => object(
            json!({"attention":{"enum":["yes","no","uncertain"]},"reasonCodes":{"type":"array","items":text},"summary":text,"evidenceRefs":refs}),
        ),
        "Assessment" => object(json!({"triage":schema("Triage"),"summary":schema("Summary")})),
        "Summary" => object(
            json!({"whatHappened":text,"whatChanged":text,"whatMatters":text,"evidenceRefs":refs}),
        ),
        _ => unreachable!("Compiled skill schema is a closed set"),
    }
}
fn contract(id: &str, purpose: &str, input: &str, output: &str, budget: usize) -> Value {
    use crate::commands::workflow::SkillContract;
    serde_json::to_value(SkillContract{
 id:id.into(),version:1,purpose:purpose.into(),input_schema:schema(input),output_schema:schema(output),
 allowed_capabilities:vec!["read_supplied_thread".into()],
 prohibited_effects:["gmail_write","task_create","decision_create","project_write","memory_promotion","skill_rewrite","graph_rewrite","external_model"].into_iter().map(str::to_string).collect(),
 evidence_requirements:"Message IDs, thread IDs and source fingerprints are mandatory; project evidence carries note fingerprints. All findings are generated, not authority.".into(),
 loop_budget:budget,success_criteria:"Typed output with source evidence; unknown fields are rejected, missing evidence and ambiguity remain explicit; no side effects.".into(),implementation:"local deterministic v1".into(),
 }).expect("Static contract serializes")
}
/// Compact runtime inventory for the assistant; full schemas remain inspectable on demand.
pub fn inventory() -> Value {
    Value::Array(registry().as_array().unwrap().iter().map(|c|json!({"id":c["id"],"version":c["version"],"purpose":c["purpose"],"implementation":c["implementation"],"trigger":"manual Communications Analyze; recommendations do not execute"})).collect())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn input(kinds: &[&str]) -> ThreadInput {
        ThreadInput {
            messages: vec![Message {
                evidence: Evidence {
                    message_id: "ab".into(),
                    thread_id: "aa".into(),
                    fingerprint: "hash".into(),
                    timestamp: 10,
                },
                sender: "sender".into(),
                subject: "Project beacon".into(),
                text: "Can you review the beacon launch?".into(),
                sent: false,
                body_available: true,
                candidates: kinds.iter().map(|s| s.to_string()).collect(),
            }],
        }
    }
    #[test]
    fn rejects_unknown_fields_missing_evidence_and_excess_input() {
        let i = input(&[]);
        let mut v = serde_json::to_value(&i).unwrap();
        v["execute"] = json!("send_mail");
        assert!(serde_json::from_value::<ThreadInput>(v).is_err());
        let mut bad = i.clone();
        bad.messages[0].evidence.fingerprint.clear();
        assert!(triage(&bad).is_err());
        bad = i;
        bad.messages[0].text = "a".repeat(2001);
        assert!(assess(&bad).is_err());
        assert!(serde_json::from_str::<Disposition>("\"send\"").is_err());
    }
    #[test]
    fn no_attention_response_deadline_and_conflict() {
        assert_eq!(triage(&input(&[])).unwrap().attention, Attention::No);
        assert_eq!(
            triage(&input(&["possible_response_needed"]))
                .unwrap()
                .attention,
            Attention::Yes
        );
        assert_eq!(
            triage(&input(&["possible_deadline"]))
                .unwrap()
                .attention,
            Attention::Yes
        );
        let mut i = input(&["possible_response_needed"]);
        let mut sent = i.messages[0].clone();
        sent.sent = true;
        sent.evidence.timestamp = 11;
        sent.evidence.message_id = "ac".into();
        sent.candidates.clear();
        i.messages.push(sent);
        assert_eq!(triage(&i).unwrap().attention, Attention::Uncertain);
        assert!(assess(&i).unwrap().summary.what_changed.contains("sent"));
    }
    #[test]
    fn registry_effects_and_version_are_explicit() {
        for c in registry().as_array().unwrap() {
            assert!(c["version"].as_u64().unwrap() >= 1);
            assert!(c["prohibitedEffects"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e == "gmail_write"));
            assert!(c["loopBudget"].as_u64().unwrap() <= 3);
        }
    }
    #[test]
    fn recommendation_rejects_foreign_evidence() {
        let t = triage(&input(&[])).unwrap();
        let mut p = crate::commands::project_relevance::match_projects(
            &artifact(&input(&[])).unwrap(),
            &[],
        )
        .unwrap();
        p.evidence_refs[0].fingerprint = "different".into();
        assert!(recommend(&t, &p).is_err());
    }
    #[test]
    fn missing_body_and_source_failure_are_not_no_action() {
        let mut i = input(&[]);
        i.messages[0].body_available = false;
        assert_eq!(triage(&i).unwrap().attention, Attention::Uncertain);
        assert!(artifact(&ThreadInput { messages: vec![] }).is_err());
    }
    #[test]
    fn registry_contains_only_two_live_contracts_and_current_taxonomy() {
        let r=registry();let list=r.as_array().unwrap();assert_eq!(list.len(),2);
        assert_eq!(list[0]["id"],"communication-assess");assert_eq!(list[1]["id"],"project-relevance");assert_eq!(list[1]["version"],2);
        assert!(list.iter().all(|c|c["loopBudget"]==0));
        assert!(list[0]["outputSchema"]["properties"]["triage"]["properties"].get("recommendedDisposition").is_none());
        assert!(serde_json::from_value::<Disposition>(json!("verify")).is_ok());
        assert!(serde_json::from_value::<Disposition>(json!("respond")).is_err());
    }

}
