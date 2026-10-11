//! Email-only inference route. No model downloads, cloud fallback or effect on chat routing.
use super::*;
use std::time::Duration;
use crate::commands::{models,responses};
pub(super) fn route()->Result<(String,String),String>{
 let provider=std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_|"openai".into());
 match provider.as_str(){
  "openai"=>Ok((provider,models::PRIMARY_MODEL.into())),
  "ollama"=>{let model=std::env::var("OLYMPUS_EMAIL_MODEL").unwrap_or_default();if model.trim().is_empty()||model.len()>128||model.contains("cloud")||!model.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_.:/".contains(&b)){return Err("local_email_model_not_configured".into())}Ok((provider,model))},
  _=>Err("email_analysis_provider_unknown".into())
 }
}
async fn bounded_json(mut response:reqwest::Response)->Result<Value,String>{
 if !response.status().is_success(){return Err("local_email_request_failed".into())}
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"local_email_response_failed")?{if bytes.len()+chunk.len()>262144{return Err("local_email_response_too_large".into())}bytes.extend_from_slice(&chunk)}
 serde_json::from_slice(&bytes).map_err(|_|"local_email_invalid_json".into())
}
fn local_output(value:&Value,model:&str)->Result<String,String>{
 if value["done"]!=true||value["done_reason"]!="stop"||value["model"]!=model{return Err("local_email_incomplete_or_wrong_model".into())}
 let content=value["message"]["content"].as_str().filter(|s|!s.trim().is_empty()).ok_or("local_email_empty_output")?;
 serde_json::from_str::<Value>(content).map_err(|_|"local_email_invalid_output")?;Ok(content.into())
}
pub(super) async fn infer(db:&Db,instructions:&str,input:Value,schema:Value,purpose:&str)->Result<(String,Value),String>{
 if input.to_string().len()>220000{return Err("situation_model_input_budget".into())}
 let (provider,model)=route()?;
 if provider=="openai"{
  let route=models::resolve(models::Capability::Primary);let mut r=models::RequestRecord::new(&route,purpose);models::save(db,&r)?;
  let answer=responses::structured(&route,instructions,input,schema,&mut r).await;models::save(db,&r)?;return answer.map(|a|(a,json!(r)))
 }
 // Fixed loopback destination; no proxies, redirects, cloud tags, pulls or tools.
 if input.to_string().len()+instructions.len()+schema.to_string().len()>48000{return Err("local_email_context_budget".into())}
 let client=reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(3)).timeout(Duration::from_secs(120)).build().map_err(|_|"local_email_client_failed")?;
 let tags=bounded_json(client.get("http://127.0.0.1:11434/api/tags").send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !tags["models"].as_array().is_some_and(|ms|ms.iter().any(|m|m["name"]==model&&m["size"].as_u64().unwrap_or(0)>0)){return Err("local_email_model_not_installed".into())}
 let info=bounded_json(client.post("http://127.0.0.1:11434/api/show").json(&json!({"model":model})).send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !info["remote_host"].is_null()||!info["remote_model"].is_null(){return Err("local_email_cloud_model_denied".into())}
 let body=json!({"model":model,"stream":false,"think":false,"format":schema,"keep_alive":"1m","options":{"num_ctx":16384,"num_predict":4096,"temperature":0},"messages":[{"role":"system","content":instructions},{"role":"user","content":input.to_string()}]});
 let value=bounded_json(client.post("http://127.0.0.1:11434/api/chat").json(&body).send().await.map_err(|_|"local_email_request_failed")?).await?;
 let answer=local_output(&value,&model)?;
 Ok((answer,json!({"provider":"ollama","requestedModel":model,"actualModel":value["model"],"purpose":purpose,"status":"completed","at":now(),"inputTokens":value["prompt_eval_count"],"outputTokens":value["eval_count"]})))
}
#[cfg(test)]
mod tests{use super::*;
 #[test]fn incomplete_wrong_model_and_malformed_outputs_are_rejected(){
  let mut v=json!({"done":true,"done_reason":"stop","model":"fixture:8b","message":{"content":"{}"}});assert!(local_output(&v,"fixture:8b").is_ok());assert!(local_output(&v,"other").is_err());v["done_reason"]=json!("length");assert!(local_output(&v,"fixture:8b").is_err());v["done_reason"]=json!("stop");v["message"]["content"]=json!("not JSON");assert!(local_output(&v,"fixture:8b").is_err());
 }
}
