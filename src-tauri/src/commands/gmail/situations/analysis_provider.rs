//! Email-only inference route. No model downloads, cloud fallback or effect on chat routing.
use super::*;
use crate::commands::models;
pub(super) fn route()->Result<(String,String),String>{
 let provider=std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_|"openai".into());
 match provider.as_str(){
  "openai"=>Ok((provider,models::PRIMARY_MODEL.into())),
  "codex"=>Ok((provider,crate::commands::subscription::model_id().into())),
  "claude-code"=>Ok((provider,"claude-sonnet-5-5".into())),
  "ollama"=>{let model=std::env::var("OLYMPUS_EMAIL_MODEL").unwrap_or_default();if !crate::commands::analysis_readiness::valid_local_model(&model){return Err("local_email_model_not_configured".into())}Ok((provider,model))},
  _=>Err("email_analysis_provider_unknown".into())
 }
}
pub(super) fn readiness() -> crate::commands::analysis_readiness::AnalysisReadiness {
 let provider = std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_| "openai".into());
 let model = std::env::var("OLYMPUS_EMAIL_MODEL").ok();
 crate::commands::gmail::health::analysis_readiness(&provider, model.as_deref())
}
pub(super) async fn infer(db:&Db,instructions:&str,input:Value,schema:Value,purpose:&str)->Result<(String,Value),String>{
 readiness().require()?;
 if input.to_string().len()>220000{return Err("situation_model_input_budget".into())}
 let (provider,model)=route()?;
 let route=models::resolve(models::Capability::Primary);let mut r=models::RequestRecord::new(&route,purpose);
 r.provider=if provider=="openai"{"claude-code".into()}else{provider.clone()};r.requested_model=model;
 models::save(db,&r)?;
 let selected=if provider=="openai"{"claude-code"}else{provider.as_str()};
 let answer=crate::commands::execution::structured(selected,purpose,instructions,input,schema,&mut r).await;
 models::save(db,&r)?;answer.map(|a|(a,json!(r)))
}
