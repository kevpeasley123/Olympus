use chrono::{DateTime, Utc};
pub use crate::commands::analysis_readiness::AnalysisReadiness;

/// Configuration is not proof of a live connection or a successful analysis.
pub fn analysis_readiness(provider: &str, local_model: Option<&str>) -> AnalysisReadiness {
    if crate::commands::acceptance::active() { return crate::commands::analysis_readiness::acceptance_wait(); }
    match provider {
        "openai" => crate::commands::subscription_jobs::readiness(),
        "ollama" if local_model.is_some_and(crate::commands::analysis_readiness::valid_local_model) =>
            AnalysisReadiness::unverified("A local analysis model is configured; availability and output quality have not been verified by this status check."),
        "ollama" => AnalysisReadiness::waiting("unconfigured", "local_model", "No supported local analysis model is configured."),
        _ => AnalysisReadiness::waiting("unconfigured", "provider", "The email analysis provider configuration is not supported."),
    }
}

pub fn sync_due(enabled: bool, status: &str, next_sync: Option<&str>, now: DateTime<Utc>) -> bool {
    enabled && status != "authentication_required" && next_sync
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .is_none_or(|deadline| deadline <= now)
}

/// Never include URLs, request bodies or unrestricted transport diagnostics.
pub fn transport_error(error: &reqwest::Error) -> &'static str {
    if error.is_timeout() { "gmail_request_timeout" }
    else if error.is_connect() { "gmail_connection_failed" }
    else { "gmail_network_unavailable" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isolated_acceptance_blocks_even_a_configured_local_analyzer() {
        crate::commands::acceptance::with_profile(&std::env::temp_dir().join("readiness-profile-fixture"), || {
            for provider in ["ollama", "openai"] {
                let readiness = analysis_readiness(provider, Some("fixture:8b"));
                assert!(!readiness.can_attempt);
                assert_eq!(readiness.require().unwrap_err(), "analysis_waiting:acceptance");
            }
        });
    }

    #[test]
    fn subscription_readiness_never_claims_a_closed_route_is_ready() {
        let result = analysis_readiness("openai", None);
        assert_eq!(result.state, "blocked");
        assert!(result.reason.contains("spending"));
    }

    #[test]
    fn local_configuration_is_not_proof_of_working_analysis() {
        assert_eq!(analysis_readiness("ollama", None).state, "unconfigured");
        assert_eq!(analysis_readiness("ollama", Some("fixture:8b")).state, "unverified");
        assert_eq!(analysis_readiness("unexpected", None).state, "unconfigured");
    }

    #[test]
    fn invalid_local_configuration_cannot_wait_for_an_attempt() {
        for model in ["fixture cloud", "fixture:cloud", "bad?name", "  fixture", &"x".repeat(129)] {
            assert_eq!(analysis_readiness("ollama", Some(model)).state, "unconfigured", "{model}");
        }
    }

    #[test]
    fn automatic_sync_respects_persisted_retry_and_authorization() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-11-03T04:00:00Z").unwrap().with_timezone(&chrono::Utc);
        assert!(!sync_due(true, "sync_error", Some("2026-11-03T04:01:00Z"), now));
        assert!(sync_due(true, "sync_error", Some("2026-11-03T03:59:00Z"), now));
        assert!(!sync_due(false, "connected", None, now));
        assert!(!sync_due(true, "authentication_required", None, now));
        assert!(sync_due(true, "connected", None, now));
        assert!(sync_due(true, "sync_error", Some("invalid"), now));
    }

    #[test]
    fn connection_failure_is_safe_and_does_not_require_reauthorization() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let error = reqwest::blocking::Client::builder().no_proxy().build().unwrap()
            .get(format!("http://127.0.0.1:{port}/?secret=must-not-appear"))
            .send().unwrap_err();
        assert_eq!(transport_error(&error), "gmail_connection_failed");
    }

    #[test]
    fn timeout_is_not_reported_as_an_expired_grant() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let error = reqwest::blocking::Client::builder().no_proxy()
            .timeout(std::time::Duration::from_millis(30)).build().unwrap()
            .get(format!("http://{address}/")).send().unwrap_err();
        assert_eq!(transport_error(&error), "gmail_request_timeout");
    }
}
