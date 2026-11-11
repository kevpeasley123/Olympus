//! One explicitly selected task runtime. Connector health never selects a provider.
use serde_json::Value;
use super::{models::RequestRecord, inference_routes};

pub(crate) async fn structured(provider: &str, purpose: &str, instructions: &str, input: Value, schema: Value, record: &mut RequestRecord) -> Result<String,String> {
    match provider {
        "codex" | "claude-code" => {
            let tier=if purpose.starts_with("briefing_") || purpose.contains("memory") || purpose.contains("research") {super::subscription_jobs::Tier::Deep}else{super::subscription_jobs::Tier::Quick};
            super::subscription_jobs::run_on(provider,tier,instructions,input,schema,record).await
        },
        "ollama" => {
            let task=inference_routes::task_for(purpose);
            let model=match inference_routes::configured_local_model(task) {
                Ok(model)=>model,
                Err(error)=>{record.status="blocked".into();record.error_code=Some(error.clone());return Err(error)}
            };
            record.provider="ollama".into();record.requested_model=model.clone();record.actual_model=None;
            record.fallback_from=None;record.escalation_reason=None;
            super::agent_events::record_job(record);
            let start=std::time::Instant::now();
            let result=super::local_inference::infer_local(&model,instructions,input,schema,purpose).await;
            record.latency_ms=Some(start.elapsed().as_millis() as u64);
            let outcome=match result {
                Ok((text,metadata))=>{record.status="completed".into();record.actual_model=Some(model);record.usage=Some(metadata);record.error_code=None;Ok(text)},
                Err(error)=>{record.status="failed".into();record.error_code=Some(error.clone());Err(error)}
            };
            super::agent_events::record_job(record);
            outcome
        },
        _ => {let error="Unknown task runtime; no fallback was attempted".to_string();record.status="blocked".into();record.error_code=Some(error.clone());Err(error)}
    }
}
