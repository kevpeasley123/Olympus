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
 json!({"provider":"Claude","capabilityCategory":"models-subscriptions","scope":"Account","source":SOURCE,"observedAt":oldest.and_then(|n|chrono::DateTime::from_timestamp(n,0)).map(|t|t.to_rfc3339_opts(chrono::SecondsFormat::Secs,true)),"windows":windows,"balance":null,"ytdConsumption":null,"ytdSpend":null,"status":if ready{"ready"}else{"disconnected"},"detail":if ready{"Passive reading from Claude Code activity, including Olympus's own runs. Refresh reads a local file, not the provider. Absolute token allowance is unknown."}else{"No unexpired passive quota reading yet. Waiting for ordinary authorized Claude Code activity; no generation was requested."}})
}
fn timestamp(value:&Value,now:i64)->Option<i64> {
 value.as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).map(|t|t.timestamp()).filter(|t|*t>=0&&*t<=now)
}
fn choose(passive:&Value,historical:&Value,now:i64)->Value {
 let live=normalize(passive,now);
 let Some(observed)=timestamp(&historical["observedAt"],now) else{return live};
 let Some(used)=historical["usedPercentage"].as_f64().filter(|v|v.is_finite()&&(0.0..=100.0).contains(v)) else{return live};
 if historical["version"]!=1 || historical["source"]!="https://claude.ai/settings/usage" {return live}
 // A newer authenticated sample retires the fallback even after its reset.
 let latest=if passive["version"]==1 { ["five_hour","seven_day"].iter().filter_map(|name|{
  let w=&passive["windows"][name];
  w["usedPercentage"].as_f64().filter(|v|v.is_finite()&&(0.0..=100.0).contains(v))?;
  let seen=timestamp(&w["observedAt"],now)?;
  w["resetsAt"].as_i64().filter(|r|*r>seen&&*r<=seen+8*86400)?;
  Some(seen)
 }).max()}else{None};
 if latest.is_some_and(|seen|seen>=observed){return live}
 json!({"provider":"Claude","capabilityCategory":"models-subscriptions","scope":"Account","source":"https://claude.ai/settings/usage (manually observed)","observedAt":historical["observedAt"],"evidence":"historical","windows":[{"label":"Weekly window — last observed","remaining":{"value":100.0-used,"unit":"%","period":"7 days"},"resetsAt":null}],"balance":null,"ytdConsumption":null,"ytdSpend":null,"status":"ready","detail":"Historical snapshot, not current usage. Observation time is approximate. Reset unknown; absolute token allowance unknown. A newer Claude Code quota sample replaces this snapshot on Refresh."})
}
fn load(path:&std::path::Path)->Result<Value,String> {
 use std::io::Read;
 let file=match std::fs::File::open(path){Ok(file)=>file,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(Value::Null),Err(_)=>return Err("Local Claude quota file could not be read.".into())};
 let mut bytes=Vec::new();file.take(8193).read_to_end(&mut bytes).map_err(|_|"Passive Claude quota file could not be read.")?;
 if bytes.len()>8192{return Err("Passive Claude quota file exceeds the size limit.".into())}
 serde_json::from_slice(&bytes).map_err(|_|"Local Claude quota file is invalid.".into())
}
fn root()->Option<std::path::PathBuf> {
 std::env::var_os("LOCALAPPDATA").map(|r|std::path::PathBuf::from(r).join("Olympus").join("telemetry"))
}
/// Windows from one Claude Code `rate_limit_event`. Newer CLIs report each
/// window's utilization; older ones only say whether the request was allowed,
/// so only a rejection (the window is spent) yields a figure.
fn from_event(info:&Value,observed:&str)->Value {
 let mut windows=serde_json::Map::new();
 for name in ["five_hour","seven_day"] {
  let w=&info["unifiedWindows"][name];
  if let (Some(used),Some(reset))=(w["utilization"].as_f64().filter(|u|u.is_finite()&&(0.0..=1.0).contains(u)),w["resetsAt"].as_i64()) {
   windows.insert(name.into(),json!({"usedPercentage":used*100.0,"resetsAt":reset,"observedAt":observed}));
  }
 }
 if info["status"]=="rejected" {
  if let (Some(name),Some(reset))=(info["rateLimitType"].as_str().filter(|n|["five_hour","seven_day"].contains(n)),info["resetsAt"].as_i64()) {
   windows.insert(name.into(),json!({"usedPercentage":100.0,"resetsAt":reset,"observedAt":observed}));
  }
 }
 json!({"version":1,"windows":windows})
}
/// Per window, the newer of two passive readings.
fn merge(a:&Value,b:&Value)->Value {
 let mut windows=serde_json::Map::new();
 for name in ["five_hour","seven_day"] {
  let seen=|v:&Value|if v["version"]==1{v["windows"][name]["observedAt"].as_str().and_then(|t|chrono::DateTime::parse_from_rfc3339(t).ok()).map(|t|t.timestamp())}else{None};
  let pick=match (seen(a),seen(b)) {(Some(x),Some(y))=>if y>x{b}else{a},(None,Some(_))=>b,_=>a};
  if pick["version"]==1 && pick["windows"][name].is_object() {windows.insert(name.into(),pick["windows"][name].clone());}
 }
 json!({"version":1,"windows":windows})
}
/// Olympus's own Claude Code runs report the account's limits; keep the
/// latest so the Usage dock has a reading without the statusline collector.
/// Best effort: a failed write never affects the run.
pub(crate) fn record_event(info:&Value) {
 let Some(root)=root() else{return};
 let observed=chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs,true);
 let fresh=from_event(info,&observed);
 if fresh["windows"].as_object().is_none_or(|w|w.is_empty()){return}
 let path=root.join("claude-runs.json");
 let merged=merge(&load(&path).unwrap_or(Value::Null),&fresh);
 if std::fs::create_dir_all(&root).is_err(){return}
 let tmp=root.join("claude-runs.json.tmp");
 if std::fs::write(&tmp,merged.to_string()).is_ok(){let _=std::fs::rename(&tmp,&path);}
}
pub(crate) fn read()->Result<Value,String> {
 let now=chrono::Utc::now().timestamp();
 let Some(root)=root() else{return Ok(normalize(&Value::Null,now))};
 let runs=load(&root.join("claude-runs.json")).unwrap_or(Value::Null);
 let passive=merge(&load(&root.join("claude-quota.json"))?,&runs);
 // A damaged optional fallback must never hide valid collector data.
 let historical=load(&root.join("claude-observed.json")).unwrap_or(Value::Null);
 Ok(choose(&passive,&historical,now))
}
#[cfg(test)] mod tests {
 use super::*;
 fn historical()->Value {json!({"version":1,"source":"https://claude.ai/settings/usage","observedAt":"2027-01-15T07:00:00Z","usedPercentage":10})}
 #[test] fn historical_snapshot_is_dated_stale_and_reset_unknown(){
  let s=choose(&Value::Null,&historical(),1800000000);
  assert_eq!(s["windows"][0]["remaining"]["value"],90.0);
  assert!(s["windows"][0]["resetsAt"].is_null());
  assert_eq!(s["evidence"],"historical");
  assert_eq!(s["observedAt"],"2027-01-15T07:00:00Z");
  assert!(s["detail"].as_str().unwrap().contains("Reset unknown"));
  assert_eq!(choose(&Value::Null,&json!({}),1800000000)["status"],"disconnected");
 }
 #[test] fn newer_passive_reading_supersedes_history_even_after_expiry(){
  let passive=json!({"version":1,"windows":{"seven_day":{"usedPercentage":25,"resetsAt":1800001000,"observedAt":"2027-01-15T08:00:00Z"}}});
  let current=choose(&passive,&historical(),1800000000);
  assert_eq!(current["windows"][0]["remaining"]["value"],75.0);
  assert!(current["evidence"].is_null());
  assert_eq!(choose(&passive,&historical(),1800001000)["status"],"disconnected");
  let mut older=passive.clone();older["windows"]["seven_day"]["observedAt"]=json!("2027-01-15T06:00:00Z");
  assert_eq!(choose(&older,&historical(),1800000000)["evidence"],"historical");
 }
 #[test] fn passive_windows_expire_and_keep_observation_time(){
  let v=json!({"version":1,"observedAt":"2027-01-15T08:00:00Z","windows":{"five_hour":{"usedPercentage":10.125,"resetsAt":1800001000,"observedAt":"2027-01-15T08:00:00Z"},"seven_day":{"usedPercentage":0,"resetsAt":1800600000,"observedAt":"2027-01-15T08:00:00Z"}}});
  let s=normalize(&v,1800000000);assert_eq!(s["status"],"ready");assert_eq!(s["windows"][0]["remaining"]["value"],89.875);assert_eq!(s["windows"][1]["remaining"]["value"],100.0);assert_eq!(s["observedAt"],"2027-01-15T08:00:00Z");assert!(s["balance"].is_null());
  let expired=normalize(&v,1800600000);assert_eq!(expired["status"],"disconnected");assert_eq!(expired["windows"],json!([]));
 }
 #[test] fn run_events_give_windows_and_newer_readings_win(){
  let info=json!({"status":"allowed","resetsAt":1800001000,"rateLimitType":"five_hour","unifiedWindows":{"five_hour":{"utilization":0.09,"resetsAt":1800001000},"seven_day":{"utilization":0.4,"resetsAt":1800500000}}});
  let fresh=from_event(&info,"2027-01-15T08:00:00Z");
  let s=normalize(&fresh,1800000000);assert_eq!(s["status"],"ready");assert_eq!(s["windows"][1]["remaining"]["value"],60.0);
  let old=from_event(&json!({"status":"allowed"}),"2027-01-15T07:00:00Z");assert_eq!(old["windows"],json!({}));
  let spent=from_event(&json!({"status":"rejected","rateLimitType":"five_hour","resetsAt":1800001000}),"2027-01-15T09:00:00Z");
  let m=merge(&fresh,&spent);assert_eq!(m["windows"]["five_hour"]["usedPercentage"],100.0);assert_eq!(m["windows"]["seven_day"]["usedPercentage"],40.0);
  assert_eq!(merge(&spent,&fresh)["windows"]["five_hour"]["usedPercentage"],100.0);
 }
 #[test] fn missing_invalid_future_and_partial_are_unknown(){
  for v in [json!({}),json!({"version":1,"windows":{"five_hour":{"usedPercentage":null,"resetsAt":1800001000,"observedAt":"2027-01-15T08:00:00Z"}}}),json!({"version":1,"windows":{"five_hour":{"usedPercentage":0,"resetsAt":1800001000,"observedAt":"2099-01-01T00:00:00Z"}}})] {assert_eq!(normalize(&v,1800000000)["status"],"disconnected");}
 }
}
