use serde_json::{json,Value};
const SOURCE:&str="Claude Code statusline (passive local)";
fn normalize(value:&Value,now:i64)->Value {
 let mut windows=Vec::new();let mut oldest:Option<i64>=None;
 if value["version"]==1 {
  for (name,label,period) in [("five_hour","5-hour window","5 hours"),("seven_day","Weekly window","7 days")] {
   let w=&value["windows"][name];
   let Some(used)=w["usedPercentage"].as_f64().filter(|n|n.is_finite()&&(0.0..=100.0).contains(n)) else {continue};
   let Some(reset)=w["resetsAt"].as_i64().filter(|n|*n>now&&*n<=now+8*86400) else {continue};
   let Some(observed)=w["observedAt"].as_str().and_then(|t|chrono::DateTime::parse_from_rfc3339(t).ok()).map(|t|t.timestamp()).filter(|n|*n>=0&&*n<=now) else {continue};
   oldest=Some(oldest.map_or(observed,|old|old.min(observed)));
   windows.push(json!({"label":label,"remaining":{"value":100.0-used,"unit":"%","period":period},"resetsAt":chrono::DateTime::from_timestamp(reset,0).map(|t|t.to_rfc3339())}));
  }
 }
 let ready=!windows.is_empty();
 json!({"provider":"Claude","capabilityCategory":"models-subscriptions","scope":"Account","source":SOURCE,"observedAt":oldest.and_then(|n|chrono::DateTime::from_timestamp(n,0)).map(|t|t.to_rfc3339_opts(chrono::SecondsFormat::Secs,true)),"windows":windows,"balance":null,"ytdConsumption":null,"ytdSpend":null,"status":if ready{"ready"}else{"disconnected"},"detail":if ready{"Passive reading from ordinary Claude Code activity. Refresh reads a local file, not the provider. Absolute token allowance is unknown."}else{"No unexpired passive quota reading yet. Waiting for ordinary authorized Claude Code activity; no generation was requested."}})
}
pub(crate) fn read()->Result<Value,String> {
 use std::io::Read;
 let now=chrono::Utc::now().timestamp();
 let Some(root)=std::env::var_os("LOCALAPPDATA") else{return Ok(normalize(&Value::Null,now))};
 let path=std::path::PathBuf::from(root).join("Olympus").join("telemetry").join("claude-quota.json");
 let file=match std::fs::File::open(path){Ok(file)=>file,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(normalize(&Value::Null,now)),Err(_)=>return Err("Passive Claude quota file could not be read.".into())};
 let mut bytes=Vec::new();file.take(8193).read_to_end(&mut bytes).map_err(|_|"Passive Claude quota file could not be read.")?;
 if bytes.len()>8192{return Err("Passive Claude quota file exceeds the size limit.".into())}
 let value=serde_json::from_slice(&bytes).map_err(|_|"Passive Claude quota file is invalid. Waiting for a valid statusline update.")?;
 Ok(normalize(&value,now))
}
#[cfg(test)] mod tests {
 use super::*;
 #[test] fn passive_windows_expire_and_keep_observation_time(){
  let v=json!({"version":1,"observedAt":"2027-01-15T08:00:00Z","windows":{"five_hour":{"usedPercentage":10.125,"resetsAt":1800001000,"observedAt":"2027-01-15T08:00:00Z"},"seven_day":{"usedPercentage":0,"resetsAt":1800600000,"observedAt":"2027-01-15T08:00:00Z"}}});
  let s=normalize(&v,1800000000);assert_eq!(s["status"],"ready");assert_eq!(s["windows"][0]["remaining"]["value"],89.875);assert_eq!(s["windows"][1]["remaining"]["value"],100.0);assert_eq!(s["observedAt"],"2027-01-15T08:00:00Z");assert!(s["balance"].is_null());
  let expired=normalize(&v,1800600000);assert_eq!(expired["status"],"disconnected");assert_eq!(expired["windows"],json!([]));
 }
 #[test] fn missing_invalid_future_and_partial_are_unknown(){
  for v in [json!({}),json!({"version":1,"windows":{"five_hour":{"usedPercentage":null,"resetsAt":1800001000,"observedAt":"2027-01-15T08:00:00Z"}}}),json!({"version":1,"windows":{"five_hour":{"usedPercentage":0,"resetsAt":1800001000,"observedAt":"2099-01-01T00:00:00Z"}}})] {assert_eq!(normalize(&v,1800000000)["status"],"disconnected");}
 }
}
