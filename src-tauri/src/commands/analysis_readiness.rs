//! Read-only eligibility, shared by status and automatic analysis workers.
//! An attemptable route still has to pass its runtime/account/source gates.
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisReadiness {
    pub state: &'static str,
    pub code: &'static str,
    pub reason: String,
    pub can_attempt: bool,
}

impl AnalysisReadiness {
    pub fn waiting(state: &'static str, code: &'static str, reason: impl Into<String>) -> Self {
        Self { state, code, reason: reason.into(), can_attempt: false }
    }

    pub fn unverified(reason: impl Into<String>) -> Self {
        Self { state: "unverified", code: "runtime_unverified", reason: reason.into(), can_attempt: true }
    }

    pub fn require(&self) -> Result<(), String> {
        if self.can_attempt { Ok(()) } else { Err(format!("analysis_waiting:{}", self.code)) }
    }
}

/// Exact machine codes only: never classify arbitrary provider diagnostics.
pub fn is_waiting(error: &str) -> bool {
    matches!(error,
        "analysis_waiting:acceptance" | "analysis_waiting:generation_protection" |
        "analysis_waiting:app_data" | "analysis_waiting:account_confirmation" |
        "analysis_waiting:local_model" | "analysis_waiting:provider")
}

pub fn acceptance_wait() -> AnalysisReadiness {
    AnalysisReadiness::waiting("blocked", "acceptance", "Background analysis is disabled in the isolated acceptance profile.")
}

pub fn valid_local_model(model: &str) -> bool {
    !model.trim().is_empty() && model.len() <= 128 && !model.to_ascii_lowercase().contains("cloud")
        && model.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.:/".contains(&b))
}
