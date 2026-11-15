//! Email-only inference route. No model downloads, cloud fallback or effect on chat routing.
use super::*;
use crate::commands::models;
use std::sync::RwLock;
/// Kevin's choice in Preferences (`email.analysis.provider.v1`), which wins over `.env`.
/// Kept in memory so the status check, which has no database, reads the same route.
static CHOSEN:RwLock<Option<String>>=RwLock::new(None);
pub const SETTING:&str="email.analysis.provider.v1";
pub const CHOICES:&[&str]=&["claude-code","codex","ollama"];
pub fn choose(provider:Option<&str>){ if let Ok(mut chosen)=CHOSEN.write(){*chosen=provider.filter(|p|CHOICES.contains(p)).map(str::to_string);} }
pub fn load(connection:&rusqlite::Connection){ choose(connection.query_row("SELECT value FROM settings WHERE key=?1",[SETTING],|r|r.get::<_,String>(0)).ok().as_deref()); }
fn resolve(chosen:Option<&str>,env:Option<String>)->String{ chosen.filter(|p|CHOICES.contains(p)).map(str::to_string).or(env).unwrap_or_else(||"openai".into()) }
fn provider()->String{ resolve(CHOSEN.read().ok().and_then(|c|c.clone()).as_deref(),std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").ok()) }
pub(super) fn route()->Result<(String,String),String>{
 let provider=provider();
 match provider.as_str(){
  "openai"=>Ok((provider,models::PRIMARY_MODEL.into())),
  "codex"=>Ok((provider,crate::commands::subscription::model_id().into())),
  "claude-code"=>Ok((provider,"claude-sonnet-5-5".into())),
  "ollama"=>{let model=std::env::var("OLYMPUS_EMAIL_MODEL").unwrap_or_default();if !crate::commands::analysis_readiness::valid_local_model(&model){return Err("local_email_model_not_configured".into())}Ok((provider,model))},
  _=>Err("email_analysis_provider_unknown".into())
 }
}
pub(super) fn readiness() -> crate::commands::analysis_readiness::AnalysisReadiness {
 let provider = provider();
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

#[cfg(test)]
mod chosen_route {
 #[test] fn kevins_choice_wins_over_the_environment_and_an_unknown_one_is_ignored(){
  assert_eq!(super::resolve(Some("claude-code"),Some("ollama".into())),"claude-code");
  assert_eq!(super::resolve(Some("made-up"),Some("ollama".into())),"ollama");
  assert_eq!(super::resolve(None,None),"openai");
 }
}
