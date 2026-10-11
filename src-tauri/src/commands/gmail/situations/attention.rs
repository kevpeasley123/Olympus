//! Source-bound attention decisions; these never modify Gmail or create tasks.
use super::*;
pub(super) fn visible(sources:&[Value], now_ms:i64)->Vec<Value>{
 let mut items=sources.iter().filter(|s|s["current"]==true&&s["attention"].is_object()).filter(|s|{
  let d=&s["attentionDecision"];
  !matches!(d["state"].as_str(),Some("dismissed"|"handled")) && !(d["state"]=="snoozed"&&d["until"].as_i64().unwrap_or(0)>now_ms)
 }).map(|s|json!({"threadId":s["threadId"],"signature":s["signature"],"subject":s["subject"],"timestamp":s["evidenceRefs"].as_array().and_then(|refs|refs.iter().find(|r|r["messageId"]==s["attention"]["messageId"])).map(|r|r["timestamp"].clone()).unwrap_or(s["timestamp"].clone()),"suggestion":s["attention"]})).collect::<Vec<_>>();
 items.sort_by_key(|s|std::cmp::Reverse(s["timestamp"].as_i64().unwrap_or(0)));items.truncate(20);items
}
fn decide(c:&Connection, account_id:&str, thread_id:&str, signature:&str, action:&str)->Result<(),String>{
 if !["dismissed","handled","snoozed"].contains(&action){return Err("attention_invalid_action".into())}
 let a=account(c)?;if a.id!=account_id{return Err("attention_account_changed".into())}
 let signatures=thread_signatures(c,&a)?;
 if !signatures.get(thread_id).is_some_and(|s|s.0==signature){return Err("attention_source_changed".into())}
 let decision=json!({"state":action,"at":now(),"until":if action=="snoozed"{Some(chrono::Utc::now().timestamp_millis()+86_400_000)}else{None}});
 let count=c.execute("UPDATE communication_situation_sources SET payload_json=json_set(payload_json,'$.attentionDecision',json(?4)) WHERE account_id=?1 AND thread_id=?2 AND signature=?3 AND json_type(payload_json,'$.attention')='object'",params![account_id,thread_id,signature,decision.to_string()]).map_err(err)?;
 if count!=1{return Err("attention_source_changed".into())}Ok(())
}
#[tauri::command]
pub fn email_attention_decide(db:State<'_,Db>,account_id:String,thread_id:String,signature:String,action:String)->Result<(),String>{
 let c=db.0.lock().map_err(|_|"database_busy")?;decide(&c,&account_id,&thread_id,&signature,&action)
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]
 fn stale_and_suppressed_suggestions_never_surface(){
  let mut s=json!({"current":true,"attention":{"title":"Review"},"timestamp":1});
  assert_eq!(visible(&[s.clone()],10).len(),1);
  for state in ["dismissed","handled"]{s["attentionDecision"]=json!({"state":state});assert!(visible(&[s.clone()],10).is_empty());}
  s["attentionDecision"]=json!({"state":"snoozed","until":20});assert!(visible(&[s.clone()],10).is_empty());assert_eq!(visible(&[s.clone()],20).len(),1);
  s["current"]=json!(false);assert!(visible(&[s],30).is_empty());
 }
 #[test]
 fn decisions_are_account_and_source_bound_and_leave_mail_unchanged(){
  let db=super::super::tests::database();super::super::tests::mail(&db,"aa","Security change reported");let c=db.0.lock().unwrap();let a=account(&c).unwrap();let sig=thread_signatures(&c,&a).unwrap()["aa"].0.clone();
  c.execute("INSERT INTO communication_situation_sources VALUES('fixture','aa',?1,NULL,?2,'now')",params![sig,json!({"attention":{"title":"Review"}}).to_string()]).unwrap();
  assert!(decide(&c,"other","aa",&sig,"handled").is_err());assert!(decide(&c,"fixture","aa","stale","handled").is_err());assert!(decide(&c,"fixture","aa",&sig,"send").is_err());
  decide(&c,"fixture","aa",&sig,"handled").unwrap();assert_eq!(observations(&c,"fixture").unwrap()[0]["attentionDecision"]["state"],"handled");
  assert_eq!(c.query_row("SELECT count(*) FROM gmail_messages",[],|r|r.get::<_,i64>(0)).unwrap(),1);
 }
}
