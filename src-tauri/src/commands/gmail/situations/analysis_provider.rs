//! Email-only inference route. No model downloads, cloud fallback or effect on chat routing.
use super::*;
use std::time::Duration;
use crate::commands::models;
pub(super) fn route()->Result<(String,String),String>{
 let provider=std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_|"openai".into());
 match provider.as_str(){
  "openai"=>Ok((provider,models::PRIMARY_MODEL.into())),
  "ollama"=>{let model=std::env::var("OLYMPUS_EMAIL_MODEL").unwrap_or_default();if !crate::commands::analysis_readiness::valid_local_model(&model){return Err("local_email_model_not_configured".into())}Ok((provider,model))},
  _=>Err("email_analysis_provider_unknown".into())
 }
}
pub(super) fn readiness() -> crate::commands::analysis_readiness::AnalysisReadiness {
 let provider = std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_| "openai".into());
 let model = std::env::var("OLYMPUS_EMAIL_MODEL").ok();
 crate::commands::gmail::health::analysis_readiness(&provider, model.as_deref())
}
async fn bounded_json(mut response:reqwest::Response)->Result<Value,String>{
 if !response.status().is_success(){return Err("local_email_request_failed".into())}
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"local_email_response_failed")?{if bytes.len()+chunk.len()>262144{return Err("local_email_response_too_large".into())}bytes.extend_from_slice(&chunk)}
 serde_json::from_slice(&bytes).map_err(|_|"local_email_invalid_json".into())
}
fn local_output(value:&Value,model:&str,schema:&Value)->Result<String,String>{
 if value["done"]!=true||value["done_reason"]!="stop"||value["model"]!=model{return Err("local_email_incomplete_or_wrong_model".into())}
 let content=value["message"]["content"].as_str().filter(|s|!s.trim().is_empty()).ok_or("local_email_empty_output")?;
 let output:Value=serde_json::from_str(content).map_err(|_|"local_email_invalid_output")?;crate::commands::structured_output::validate(&output,schema)?;Ok(content.into())
}
pub(super) async fn infer(db:&Db,instructions:&str,input:Value,schema:Value,purpose:&str)->Result<(String,Value),String>{
 readiness().require()?;
 if input.to_string().len()>220000{return Err("situation_model_input_budget".into())}
 let (provider,model)=route()?;
 if provider=="openai"{
  let route=models::resolve(models::Capability::Primary);let mut r=models::RequestRecord::new(&route,purpose);models::save(db,&r)?;
  let answer=crate::commands::subscription_jobs::run(crate::commands::subscription_jobs::Tier::Quick,instructions,input,schema,&mut r).await;models::save(db,&r)?;return answer.map(|a|(a,json!(r)))
 }
 infer_local(&model,instructions,input,schema,purpose).await
}
pub(crate) fn local_model()->Result<String,String>{
 let (provider,model)=route()?;
 if provider!="ollama"{return Err("local_analysis_not_enabled".into())}
 readiness().require()?;
 let model=std::env::var("OLYMPUS_BRIEF_MODEL").ok().filter(|m|!m.is_empty()).unwrap_or(model);
 if !crate::commands::analysis_readiness::valid_local_model(&model){return Err("local_brief_model_not_configured".into())}
 Ok(model)
}
fn local_options(brief:bool,packet_bytes:usize,device:Option<&str>)->Result<Value,String>{
 let context=if brief&&packet_bytes<=18000{8192}else{16384};
 let mut options=json!({"num_ctx":context,"num_predict":if brief{1536}else{4096},"temperature":0});
 match device {None|Some("auto")=>{},Some("cpu")=>options["num_gpu"]=json!(0),_=>return Err("local_analysis_device_invalid".into())}
 Ok(options)
}
pub(crate) async fn infer_local(model:&str,instructions:&str,input:Value,schema:Value,purpose:&str)->Result<(String,Value),String>{
 static LOCAL_INFERENCE:tokio::sync::Mutex<()>=tokio::sync::Mutex::const_new(());
 let _permit=LOCAL_INFERENCE.lock().await;
 let expected=if purpose=="briefing_synthesis"{local_model()?}else{
  let(provider,configured)=route()?;if provider!="ollama"{return Err("local_analysis_not_enabled".into())}readiness().require()?;configured
 };
 if expected!=model{return Err("local_analysis_configuration_changed".into())}
 // Fixed loopback destination; no proxies, redirects, cloud tags, pulls or tools.
 if input.to_string().len()+instructions.len()+schema.to_string().len()>48000{return Err("local_email_context_budget".into())}
 let device=std::env::var("OLYMPUS_LOCAL_DEVICE").ok();
 let options=local_options(purpose=="briefing_synthesis",input.to_string().len()+instructions.len()+schema.to_string().len(),device.as_deref())?;
 // CPU inference shares the machine with normal work; retain a finite deadline
 // but allow prompt processing and generation to finish without a GPU dependency.
 let limit=if device.as_deref()==Some("cpu"){300}else{120};
 let client=reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(3)).timeout(Duration::from_secs(limit)).build().map_err(|_|"local_email_client_failed")?;
 let tags=bounded_json(client.get("http://127.0.0.1:11434/api/tags").send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !tags["models"].as_array().is_some_and(|ms|ms.iter().any(|m|m["name"]==model&&m["size"].as_u64().unwrap_or(0)>0)){return Err("local_email_model_not_installed".into())}
 let info=bounded_json(client.post("http://127.0.0.1:11434/api/show").json(&json!({"model":model})).send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !info["remote_host"].is_null()||!info["remote_model"].is_null(){return Err("local_email_cloud_model_denied".into())}
 let body=json!({"model":model,"stream":false,"think":false,"format":&schema,"keep_alive":"1m","options":options,"messages":[{"role":"system","content":instructions},{"role":"user","content":input.to_string()}]});
 let value=bounded_json(client.post("http://127.0.0.1:11434/api/chat").json(&body).send().await.map_err(|e|if e.is_timeout(){"local_email_request_timeout"}else{"local_email_request_failed"})?).await?;
 let answer=local_output(&value,&model,&schema)?;
 Ok((answer,json!({"provider":"ollama","requestedModel":model,"actualModel":value["model"],"purpose":purpose,"status":"completed","at":now(),"inputTokens":value["prompt_eval_count"],"outputTokens":value["eval_count"]})))
}
#[cfg(test)]
mod tests{use super::*;
 #[test]fn cpu_execution_is_explicit_and_invalid_devices_fail_closed(){
  assert_eq!(local_options(true,1000,Some("cpu")).unwrap()["num_gpu"],0);
  assert!(local_options(false,20000,None).unwrap()["num_gpu"].is_null());
  assert!(local_options(false,20000,Some("remote")).is_err());
 }
 #[test]fn local_analyzer_respects_nested_contract(){
  let schema=json!({"type":"object","properties":{"items":{"type":"array","items":{"type":"string"}}},"required":["items"],"additionalProperties":false});
  let v=json!({"done":true,"done_reason":"stop","model":"fixture:8b","message":{"content":"{\"items\":[3]}"}});
  assert!(local_output(&v,"fixture:8b",&schema).is_err());
 }
 #[test]fn incomplete_wrong_model_and_malformed_outputs_are_rejected(){
  let mut v=json!({"done":true,"done_reason":"stop","model":"fixture:8b","message":{"content":"{}"}});assert!(local_output(&v,"fixture:8b",&json!({"type":"object"})).is_ok());assert!(local_output(&v,"other",&json!({"type":"object"})).is_err());v["done_reason"]=json!("length");assert!(local_output(&v,"fixture:8b",&json!({"type":"object"})).is_err());v["done_reason"]=json!("stop");v["message"]["content"]=json!("not JSON");assert!(local_output(&v,"fixture:8b",&json!({"type":"object"})).is_err());
 }
}
