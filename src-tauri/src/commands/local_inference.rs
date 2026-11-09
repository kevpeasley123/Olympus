//! Shared local transport for bounded model tasks; no connector ownership.
use serde_json::{json, Value};
use std::time::Duration;

async fn bounded_json(mut response:reqwest::Response)->Result<Value,String>{
 if !response.status().is_success(){
  #[cfg(test)]
  capture_http_error(response).await;
  return Err("local_email_request_failed".into())
 }
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"local_email_response_failed")?{if bytes.len()+chunk.len()>262144{return Err("local_email_response_too_large".into())}bytes.extend_from_slice(&chunk)}
 serde_json::from_slice(&bytes).map_err(|_|"local_email_invalid_json".into())
}
// Explicit ignored acceptance diagnostics only; never compiled into production.
#[cfg(test)]
async fn capture_http_error(mut response:reqwest::Response){
 let Some(path)=std::env::var_os("OLYMPUS_LOCAL_ANALYSIS_TEST_DB").map(std::path::PathBuf::from) else{return};
 if !path.is_absolute()||path.file_name().and_then(|n|n.to_str())!=Some("olympus-local-analysis-test.sqlite"){return;}
 let status=response.status().as_u16();let endpoint=response.url().path().to_owned();
 let mut bytes=Vec::new();let mut truncated=false;let mut read_failed=false;
 while let Some(next)=response.chunk().await.transpose(){
  let chunk=match next {Ok(chunk)=>chunk,Err(_)=>{read_failed=true;break}};
  let remaining=16384usize.saturating_sub(bytes.len());
  bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
  if chunk.len()>remaining {truncated=true;break;}
 }
 let diagnostic=json!({"status":status,"endpoint":endpoint,"body":String::from_utf8_lossy(&bytes),"truncated":truncated,"readFailed":read_failed});
 if let Ok(encoded)=serde_json::to_vec_pretty(&diagnostic){let _=std::fs::write(path.with_file_name("local-analysis-http-error.json"),encoded);}
}

fn local_output(value:&Value,model:&str,schema:&Value)->Result<String,String>{
 if value["done"]!=true||value["done_reason"]!="stop"||value["model"]!=model{return Err("local_email_incomplete_or_wrong_model".into())}
 let content=value["message"]["content"].as_str().filter(|s|!s.trim().is_empty()).ok_or("local_email_empty_output")?;
 let output:Value=serde_json::from_str(content).map_err(|_|"local_email_invalid_output")?;crate::commands::structured_output::validate(&output,schema)?;Ok(content.into())
}
pub(crate) fn local_model()->Result<String,String>{
 crate::commands::inference_routes::configured_local_model(crate::commands::inference_routes::LocalTask::Briefing)
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
 let expected=crate::commands::inference_routes::configured_local_model(crate::commands::inference_routes::task_for(purpose))?;
 if expected!=model{return Err("local_analysis_configuration_changed".into())}
 // Fixed loopback destination; no proxies, redirects, cloud tags, pulls or tools.
 if input.to_string().len()+instructions.len()+schema.to_string().len()>48000{return Err("local_email_context_budget".into())}
 let device=crate::commands::inference_routes::configured_local_device(crate::commands::inference_routes::task_for(purpose))?;
 let options=local_options(purpose.starts_with("briefing_"),input.to_string().len()+instructions.len()+schema.to_string().len(),Some(device.as_str()))?;
 // CPU inference shares the machine with normal work; retain a finite deadline
 // but allow prompt processing and generation to finish without a GPU dependency.
 let limit=if device=="cpu"{300}else{120};
 let client=reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(3)).timeout(Duration::from_secs(limit)).build().map_err(|_|"local_email_client_failed")?;
 let tags=bounded_json(client.get("http://127.0.0.1:11434/api/tags").send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !tags["models"].as_array().is_some_and(|ms|ms.iter().any(|m|m["name"]==model&&m["size"].as_u64().unwrap_or(0)>0)){return Err("local_email_model_not_installed".into())}
 let info=bounded_json(client.post("http://127.0.0.1:11434/api/show").json(&json!({"model":model})).send().await.map_err(|_|"local_email_service_unavailable")?).await?;
 if !info["remote_host"].is_null()||!info["remote_model"].is_null(){return Err("local_email_cloud_model_denied".into())}
 let body=json!({"model":model,"stream":false,"think":false,"format":&schema,"keep_alive":"1m","options":options,"messages":[{"role":"system","content":instructions},{"role":"user","content":input.to_string()}]});
 let value=bounded_json(client.post("http://127.0.0.1:11434/api/chat").json(&body).send().await.map_err(|e|if e.is_timeout(){"local_email_request_timeout"}else{"local_email_request_failed"})?).await?;
 #[cfg(test)]
 eprintln!("Local inference completion: {}",json!({"purpose":purpose,"requestedModel":model,"actualModel":value["model"],"done":value["done"],"doneReason":value["done_reason"],"inputTokens":value["prompt_eval_count"],"outputTokens":value["eval_count"]}));
 let answer=local_output(&value,&model,&schema)?;
 Ok((answer,json!({"provider":"ollama","requestedModel":model,"actualModel":value["model"],"purpose":purpose,"status":"completed","at":chrono::Utc::now().to_rfc3339(),"inputTokens":value["prompt_eval_count"],"outputTokens":value["eval_count"]})))
}
#[cfg(test)]
mod tests{use super::*;
 #[test]fn task_device_selection_controls_gpu_layers(){
  use crate::commands::inference_routes::{local_device_for,task_for};
  let extraction=local_device_for(task_for("email_extraction"),Some("cpu"),Some("auto"),None,None).unwrap();
  assert!(local_options(false,1000,Some(extraction)).unwrap()["num_gpu"].is_null());
  let briefing=local_device_for(task_for("briefing_investigation"),Some("auto"),None,Some("cpu"),None).unwrap();
  assert_eq!(local_options(true,1000,Some(briefing)).unwrap()["num_gpu"],0);
  let memory=local_device_for(task_for("memory_contribution"),Some("auto"),None,Some("cpu"),None).unwrap();
  assert!(local_options(false,1000,Some(memory)).unwrap()["num_gpu"].is_null());
 }
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
