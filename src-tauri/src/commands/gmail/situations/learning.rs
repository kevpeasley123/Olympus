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
        let source:Value=serde_json::from_str(&source.ok_or("learning_source_changed")?).map_err(|_|"learning_source_changed")?;
        let original=source["attention"].clone();
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
