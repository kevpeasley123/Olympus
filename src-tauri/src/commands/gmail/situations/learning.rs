//! Explicit feedback for one account/thread source revision. Never inferred from inactivity.
use super::*;
use serde::Serialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LearningRequest {
    pub account_id: String,
    pub thread_id: String,
    pub signature: String,
    pub expected_revision: i64,
    pub action: String,
    #[serde(default)]
    pub text: String,
}
#[derive(Clone, Serialize, Deserialize)]
struct Feedback {
    #[serde(default)]
    origin: Option<Value>,
    signature: String,
    action: String,
    correction: String,
    original: Value,
    at: String,
    until: Option<i64>,
}
#[derive(Serialize, Deserialize)]
struct Record {
    state: Feedback,
    history: Vec<Feedback>,
    #[serde(default)]
    forgotten_signatures: Vec<String>,
}
fn load(c: &Connection, account_id: &str, thread_id: &str) -> Result<Option<(i64, Record)>, String> {
    let row: Option<(i64,String)> = c.query_row("SELECT revision,payload_json FROM email_learning WHERE account_id=?1 AND thread_id=?2",params![account_id,thread_id],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(err)?;
    row.map(|(rev,raw)|serde_json::from_str(&raw).map(|record|(rev,record)).map_err(|_|"learning_record_unreadable".into())).transpose()
}
pub(super) fn stored_revision(c:&Connection, account_id:&str, thread_id:&str)->Result<i64,String> {
    Ok(load(c,account_id,thread_id)?.map_or(0,|r|r.0))
}

pub(super) fn change(c: &mut Connection, request: LearningRequest) -> Result<(), String> {
    let tx=c.transaction().map_err(err)?;
    apply(&tx,request,None)?;
    tx.commit().map_err(err)
}

pub(super) fn apply(c: &Connection, request: LearningRequest, origin:Option<Value>) -> Result<(), String> {
    if request.thread_id.is_empty() || request.thread_id.len()>256 || request.signature.len()>256 || request.expected_revision<0 {
        return Err("learning_invalid_request".into());
    }
    let a=account(c)?;
    if a.id!=request.account_id { return Err("learning_account_changed".into()); }
    let tx=c;
    let old=load(&tx,&a.id,&request.thread_id)?;
    let revision=old.as_ref().map_or(0,|r|r.0);
    if revision!=request.expected_revision { return Err("learning_revision_changed".into()); }
    let next_revision=revision.checked_add(1).ok_or("learning_revision_limit")?;
    let time=now();
    let forgotten_signatures=old.as_ref().map(|(_,r)|r.forgotten_signatures.clone()).unwrap_or_default();
    let prior_correction=old.as_ref().filter(|(_,r)|r.state.signature==request.signature&&r.state.action!="forgotten")
        .map(|(_,r)|r.state.correction.clone()).unwrap_or_default();
    let record=if matches!(request.action.as_str(),"undo"|"forget") {
        let (_,mut record)=old.ok_or("learning_record_missing")?;
        if record.state.signature!=request.signature { return Err("learning_source_changed".into()); }
        if request.action=="forget" {
            if !record.forgotten_signatures.contains(&record.state.signature) {
                if record.forgotten_signatures.len()>=128 {return Err("learning_forget_limit".into());}
                record.forgotten_signatures.push(record.state.signature.clone());
            }
            record.state.action="forgotten".into();record.state.origin=None;record.state.correction.clear();record.state.original=Value::Null;
            record.state.until=None;record.state.at=time.clone();record.history.clear();
        } else {
            if record.state.action=="forgotten" { return Err("learning_nothing_to_undo".into()); }
            record.state=record.history.pop().ok_or("learning_nothing_to_undo")?;
        }
        record
    } else {
        if !matches!(request.action.as_str(),"corrected"|"handled"|"dismissed"|"snoozed") { return Err("learning_invalid_action".into()); }
        let correction=request.text.trim();
        if (request.action=="corrected" && (correction.is_empty() || correction.chars().count()>1000)) || (request.action!="corrected" && !correction.is_empty()) {
            return Err("learning_invalid_correction".into());
        }
        let signatures=thread_signatures(&tx,&a)?;
        if !signatures.get(&request.thread_id).is_some_and(|s|s.0==request.signature) { return Err("learning_source_changed".into()); }
        let source:Option<String>=tx.query_row("SELECT payload_json FROM communication_situation_sources WHERE account_id=?1 AND thread_id=?2 AND signature=?3",params![a.id,request.thread_id,request.signature],|r|r.get(0)).optional().map_err(err)?;
        let source:Value=source.map(|s|serde_json::from_str(&s)).transpose().map_err(|_|"learning_source_changed")?.unwrap_or(Value::Null);
        let original=if source["attention"].is_object(){source["attention"].clone()}else{native_brief_original(tx,origin.as_ref(),&request)?};
        if !original.is_object() || original.to_string().len()>12000 { return Err("learning_source_changed".into()); }
        let baseline=Feedback { origin:None, signature:request.signature.clone(),action:"restored".into(),correction:String::new(),original:original.clone(),at:time.clone(),until:None };
        let mut history=match old {
            Some((_,mut record))=>{if record.state.action=="forgotten" {vec![]} else {record.history.push(record.state);record.history}},
            None=>vec![baseline],
        };
        if history.len()>20 {history.drain(..history.len()-20);}
        if revision==0 {
            let count:i64=tx.query_row("SELECT count(*) FROM email_learning WHERE account_id=?1",[&a.id],|r|r.get(0)).map_err(err)?;
            if count>=2000 {return Err("learning_record_limit".into());}
        }
        // Only a new explicit instruction for the same source may replace its tombstone.
        let forgotten_signatures=forgotten_signatures.into_iter().filter(|sig|sig!=&request.signature).collect();
        Record {state:Feedback {origin,signature:request.signature.clone(),action:request.action.clone(),correction:if request.action=="corrected" {correction.into()} else {prior_correction},original,at:time.clone(),until:if request.action=="snoozed" {Some(chrono::Utc::now().timestamp_millis()+86_400_000)} else {None}},history,forgotten_signatures}
    };
    let decision=if matches!(record.state.action.as_str(),"handled"|"dismissed"|"snoozed"|"forgotten") {
        json!({"state":if record.state.action=="forgotten" {"dismissed"} else {&record.state.action},"at":record.state.at,"until":record.state.until})
    } else {Value::Null};
    tx.execute("INSERT INTO email_learning(account_id,thread_id,revision,payload_json,updated_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(account_id,thread_id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json,updated_at=excluded.updated_at",params![a.id,request.thread_id,next_revision,serde_json::to_string(&record).map_err(err)?,time]).map_err(err)?;
    // Compatibility for existing source readers; changed-source decisions are never carried over.
    tx.execute("UPDATE communication_situation_sources SET payload_json=json_set(payload_json,'$.attentionDecision',CASE WHEN signature=?3 THEN json(?4) ELSE NULL END) WHERE account_id=?1 AND thread_id=?2",params![a.id,request.thread_id,record.state.signature,decision.to_string()]).map_err(err)?;
    let situation:Option<String>=tx.query_row("SELECT situation_id FROM communication_situation_sources WHERE account_id=?1 AND thread_id=?2",params![a.id,request.thread_id],|r|r.get(0)).optional().map_err(err)?.flatten();
    if let Some(id)=situation {changes::record(tx,&a.id,&id,"operator_feedback")?;}
    ensure(&tx,&a.id)?;bump(&tx,&a.id)?;Ok(())
}

pub(super) fn snapshot(c:&Connection, account_id:&str, signatures:&BTreeMap<String,(String,i64)>) -> Result<Vec<Value>,String> {
    let mut q=c.prepare("SELECT thread_id,revision,payload_json,updated_at FROM email_learning WHERE account_id=?1 ORDER BY updated_at DESC,thread_id LIMIT 2000").map_err(err)?;
    let records=q.query_map([account_id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    records.into_iter().map(|(thread,rev,raw,updated)|{
        let record:Record=serde_json::from_str(&raw).map_err(|_|"learning_record_unreadable")?;
        let state=record.state;
        Ok(json!({"threadId":thread,"signature":state.signature,"revision":rev,"action":state.action,"correction":state.correction,"original":state.original,"updatedAt":updated,"until":state.until,"current":signatures.get(&thread).is_some_and(|s|s.0==state.signature),"canUndo":state.action!="forgotten"&&!record.history.is_empty(),"forgottenSignatures":record.forgotten_signatures,"sourceForgotten":signatures.get(&thread).is_some_and(|s|record.forgotten_signatures.contains(&s.0))}))
    }).collect()
}

/// Apply operator feedback at the boundary; never write it into generated observations.
pub(super) fn project(sources:&[Value], learning:&[Value], now_ms:i64) -> Vec<Value> {
    let mut projected=Vec::new();
    for source in sources {
        let record=learning.iter().find(|l|l["threadId"]==source["threadId"]);
        if record.is_some_and(|r|r["forgottenSignatures"].as_array().is_some_and(|signatures|signatures.contains(&source["signature"]))) {continue;}
        let feedback=record.filter(|l|l["signature"]==source["signature"]&&l["current"]==true);
        if feedback.is_some_and(|f|matches!(f["action"].as_str(),Some("handled"|"dismissed"|"forgotten")) || (f["action"]=="snoozed"&&f["until"].as_i64().unwrap_or(i64::MAX)>now_ms)) {continue;}
        let mut current=source.clone();
        if feedback.is_some() {current["attentionDecision"]=Value::Null;}
        let Some(mut item)=attention::visible(&[current],now_ms).pop() else {continue};
        if let Some(r)=record {item["learningRevision"]=r["revision"].clone();}
        if let Some(f)=feedback {
            if f["correction"].as_str().is_some_and(|s|!s.is_empty()) {item["operatorCorrection"]=f["correction"].clone();}
        }
        projected.push(item);
    }
    projected.sort_by_key(|s|std::cmp::Reverse(s["timestamp"].as_i64().unwrap_or(0)));projected.truncate(20);projected
}
#[tauri::command]
pub fn email_learning_change(db:State<'_,Db>,request:LearningRequest)->Result<(),String> {
    let mut c=db.0.lock().map_err(|_|"database_busy")?;change(&mut c,request)
}

/// Read-only, source-bound operator feedback for already-selected mail threads.
/// This does not classify new conversation text or infer completion from handling.
pub(crate) fn briefing_resolutions(c:&Connection,account_id:&str,threads:&[String])->Result<Vec<Value>,String>{
    if threads.len()>12||threads.iter().any(|t|t.is_empty()||t.len()>256){return Err("briefing_resolution_scope_invalid".into());}
    let preference:Option<String>=c.query_row("SELECT value FROM settings WHERE key='chatMemory.use'",[],|r|r.get(0)).optional().map_err(err)?;
    if preference.as_deref()==Some("false"){return Ok(vec![]);}
    let a=account(c)?;if a.id!=account_id{return Err("briefing_resolution_account_changed".into());}
    let signatures=thread_signatures(c,&a)?;
    let mut seen=std::collections::HashSet::new();let mut result=Vec::new();
    for thread in threads{
        if !seen.insert(thread){continue;}
        let Some((revision,record))=load(c,account_id,thread)? else{continue;};
        let state=record.state;
        if !signatures.get(thread).is_some_and(|s|s.0==state.signature)||record.forgotten_signatures.contains(&state.signature)||!matches!(state.action.as_str(),"corrected"|"handled"|"dismissed"|"snoozed"){continue;}
        if state.correction.chars().count()>1000{return Err("briefing_resolution_invalid".into());}
        let active=state.action!="snoozed"||state.until.is_some_and(|until|until>chrono::Utc::now().timestamp_millis());
        result.push(json!({"threadId":thread,"signature":state.signature,"revision":revision,"action":state.action,"active":active,"correction":state.correction,"at":state.at,"until":state.until}));
    }
    Ok(result)
}

/// Native binding for conversational feedback on the exact cited mail threads.
pub(crate) fn briefing_feedback(c:&Connection,threads:&std::collections::HashMap<String,String>,item_count:usize)->Result<Option<Value>,String>{
 if threads.is_empty()||threads.len()>3{return Ok(None)}
 let a=account(c)?;let signatures=thread_signatures(c,&a)?;let mut sources=Vec::new();
 let mut ordered=threads.iter().collect::<Vec<_>>();ordered.sort_by_key(|(id,_)|*id);
 for(thread,subject)in ordered{
  let Some((signature,_))=signatures.get(thread)else{return Ok(None)};
  sources.push(json!({"accountId":a.id,"threadId":thread,"signature":signature,"revision":stored_revision(c,&a.id,thread)?,"subject":subject.chars().take(200).collect::<String>()}));
 }
 Ok(Some(json!({"kind":"brief","itemCount":item_count.max(sources.len()),"sources":sources})))
}

// Explicit feedback may refer to a natively composed brief before the background
// classifier has created an attention recommendation. Never manufacture one.
fn native_brief_original(c:&Connection,origin:Option<&Value>,request:&LearningRequest)->Result<Value,String>{
 use sha2::{Digest,Sha256};
 let invalid=||"learning_source_changed".to_string();let origin=origin.ok_or_else(invalid)?;
 let chat=origin["conversationId"].as_str().ok_or_else(invalid)?;
 let id=origin["briefingMessageId"].as_str().ok_or_else(invalid)?;
 let row:Option<(String,String)>=c.query_row("SELECT m.content,t.context_json FROM conversation_messages m JOIN conversation_turn_context t ON t.message_id=m.id WHERE m.id=?1 AND m.conversation_id=?2 AND m.role='assistant' AND NOT EXISTS(SELECT 1 FROM conversation_imports WHERE message_id=m.id)",params![id,chat],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(err)?;
 let(content,context)=row.ok_or_else(invalid)?;let context:Value=serde_json::from_str(&context).map_err(|_|invalid())?;
 let brief=&context["briefing"];if brief["kind"]!="model_synthesis"{return Err(invalid())}
 let request_id=brief["requestId"].as_str().ok_or_else(invalid)?;
 let raw:String=c.query_row("SELECT record_json FROM model_requests WHERE id=?1",[request_id],|r|r.get(0)).map_err(|_|invalid())?;
 let record:Value=serde_json::from_str(&raw).map_err(|_|invalid())?;
 if record["status"]!="completed"||record["usage"]["briefing_consumed"]!=json!({"messageId":id,"conversationId":chat})||record["usage"]["briefing_binding"]["origin"]!=*brief||record["usage"]["briefing_binding"]["contentDigest"]!=format!("{:x}",Sha256::digest(content.as_bytes())){return Err(invalid())}
 let mut matches=false;
 for source in brief["sources"].as_array().ok_or_else(invalid)?{
  let prefix=format!("mail:{}:",request.account_id);
  if let Some(message)=source["id"].as_str().and_then(|s|s.strip_prefix(&prefix)){
   matches|=c.query_row("SELECT EXISTS(SELECT 1 FROM gmail_messages WHERE account_id=?1 AND id=?2 AND thread_id=?3 AND available=1 AND in_scope=1)",params![request.account_id,message,request.thread_id],|r|r.get::<_,bool>(0)).map_err(err)?;
  }
 }
 if !matches{return Err(invalid())}
 Ok(json!({"kind":"native_brief","messageId":id,"content":content}))
}

#[cfg(test)]
mod durable_tests {
    use super::*;
    #[test]
    fn explicit_correction_survives_age_but_withdrawal_removes_it() {
        let (db,sig)=super::super::learning_tests::fixture();
        let mut c=db.0.lock().unwrap();
        let request=|action:&str,revision:i64,text:&str|LearningRequest{account_id:"fixture".into(),thread_id:"thread".into(),signature:sig.clone(),expected_revision:revision,action:action.into(),text:text.into()};
        change(&mut c,request("corrected",0,"Autopay is enabled; no manual payment.")).unwrap();
        c.execute("UPDATE email_learning SET updated_at='2020-01-01',payload_json=json_set(payload_json,'$.state.at','2020-01-01')",[]).unwrap();
        let old=durable_corrections(&c,"fixture",&["thread".into()]).unwrap();
        assert_eq!(old[0]["correction"],"Autopay is enabled; no manual payment.");
        assert_eq!(old[0]["claimStatus"],"operator_statement");
        c.execute("UPDATE gmail_messages SET fingerprint='new'",[]).unwrap();
        let changed=durable_corrections(&c,"fixture",&["thread".into()]).unwrap();
        assert_eq!(changed[0]["current"],false);
        change(&mut c,request("forget",1,"")).unwrap();
        assert!(durable_corrections(&c,"fixture",&["thread".into()]).unwrap().is_empty());
    }
}

/// Explicit operator statements are durable, but their applicability is source-scoped.
/// A changed/aged-out source is returned as historical context, never a live resolution.
pub(crate) fn durable_corrections(c:&Connection,account_id:&str,threads:&[String])->Result<Vec<Value>,String>{
    if threads.len()>48||threads.iter().any(|id|id.is_empty()||id.len()>256){return Err("durable_correction_scope_invalid".into());}
    let enabled:Option<String>=c.query_row("SELECT value FROM settings WHERE key='chatMemory.use'",[],|r|r.get(0)).optional().map_err(err)?;
    if enabled.as_deref()==Some("false"){return Ok(vec![]);}
    let a=account(c)?;if a.id!=account_id{return Err("durable_correction_account_changed".into());}
    let signatures=thread_signatures(c,&a)?;
    let mut result=Vec::new();let mut seen=std::collections::BTreeSet::new();
    for thread in threads {
        if !seen.insert(thread){continue;}
        let Some((revision,record))=load(c,account_id,thread)? else{continue};
        let state=record.state;
        if state.correction.is_empty()||matches!(state.action.as_str(),"forgotten"|"restored")||record.forgotten_signatures.contains(&state.signature){continue;}
        result.push(json!({"threadId":thread,"signature":state.signature,"revision":revision,"action":state.action,"correction":state.correction,"at":state.at,"current":signatures.get(thread).is_some_and(|s|s.0==state.signature),"claimStatus":"operator_statement","origin":state.origin}));
    }
    Ok(result)
}
