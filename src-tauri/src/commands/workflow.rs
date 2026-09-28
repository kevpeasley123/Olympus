//! Shared definition shape for fixed, backend-owned workflows.
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub kind: String,
    pub depends_on: Vec<String>,
    pub max_iterations: usize,
}
/// An inspectable executable contract; publishing it grants no execution authority.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SkillContract {
    pub id: String,
    pub version: u32,
    pub purpose: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
    pub allowed_capabilities: Vec<String>,
    pub prohibited_effects: Vec<String>,
    pub evidence_requirements: String,
    pub loop_budget: usize,
    pub success_criteria: String,
    pub implementation: String,
}
