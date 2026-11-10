//! Durable output journal. A prepared answer can finish without another inference.
use super::*;

pub(super) struct Claim {pub id:String,pub attempt:i64}

pub(super) struct Prepared {
    pub id: String,
    pub attempt: i64,
    pub before: Option<String>,
    pub result: String,
    pub answer: Answer,
}

// This snapshot invalidates work; it never grants execution permission. Missing
// metadata is null so synthetic workers need no accounts. Production dispatch
// independently requires readiness and the transport's live account preflight.
fn route_binding(c:&Connection)->Result<String,String>{
    let selected=provider(c)?;
    let model=if selected=="ollama" {
        super::super::inference_routes::configured_local_model(super::super::inference_routes::LocalTask::Memory).ok()
    } else {super::super::subscription_jobs::selected_model(&selected,super::super::subscription_jobs::Tier::Deep).ok()};
    let account=match selected.as_str(){
        "claude-code"=>super::super::subscription_jobs::app_data().and_then(super::super::claude_subscription::authorization_binding).ok(),
        "codex"=>super::super::codex_authorization::confirmed_binding().ok(),
        _=>None,
    };
    Ok(json!({"provider":selected,"model":model,"accountConfirmation":account}).to_string())
}

pub(super) fn require_route(c:&Connection,id:&str)->Result<(),String>{
    let expected:String=c.query_row("SELECT route_binding_json FROM memory_contributions WHERE id=?1",[id],|r|r.get(0)).map_err(|_|"memory_contribution_changed")?;
    if route_binding(c).as_deref()!=Ok(expected.as_str()) {
        c.execute("UPDATE memory_contributions SET state='superseded',error='memory_route_changed',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND state IN ('claimed','prepared')",[id]).map_err(|e|e.to_string())?;
        return Err("memory_route_changed".into());
    }
    Ok(())
}

// Exact bytes already on disk can be receipted without another provider call.
pub(super) fn written_chats(c:&Connection,current:&str,root:&Path)->Result<Vec<Chat>,String>{
    let mut statement=c.prepare("SELECT DISTINCT c.id,c.title,c.title_source,c.summary,c.created_at,c.vault_path,c.vault_watermark,c.memory_watermark,c.legacy FROM conversations c JOIN memory_contributions j ON j.conversation_id=c.id AND j.from_watermark=c.memory_watermark WHERE j.state='prepared' AND ((j.result_note=?1 AND (j.before_note IS NULL OR j.before_note<>j.result_note)) OR json_extract(j.answer_json,'$.manifest.receipt') IS NOT NULL) ORDER BY j.rowid LIMIT ?2").map_err(|e|e.to_string())?;
    let rows=statement.query_map(params![current,CHATS_PER_TICK],|r|Ok(Chat{id:r.get(0)?,title:r.get(1)?,title_source:r.get(2)?,summary:r.get(3)?,created_at:r.get(4)?,vault_path:r.get(5)?,vault_watermark:r.get(6)?,memory_watermark:r.get(7)?,legacy:r.get(8)?,vault_due:false,memory_due:true})).map_err(|e|e.to_string())?;
    let chats=rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    Ok(chats.into_iter().filter(|chat| {
        let raw:Option<String>=c.query_row("SELECT answer_json FROM memory_contributions WHERE conversation_id=?1 AND state='prepared' AND from_watermark=?2 ORDER BY rowid DESC LIMIT 1",params![chat.id,chat.memory_watermark],|r|r.get(0)).ok();
        raw.and_then(|s|serde_json::from_str::<Answer>(&s).ok()).map(|a|a.manifest.map(|m|super::super::learned_records::published(root,&m.receipt)).unwrap_or(true)).unwrap_or(false)
    }).collect())
}

pub(super) fn supersede_sources(db:&Db,chat:&Chat,revision:&str,seen:i64)->Result<(),String>{
    db.0.lock().map_err(|e|e.to_string())?.execute("UPDATE memory_contributions SET state='superseded',error='memory_source_changed',updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?1 AND from_watermark=?2 AND state='prepared' AND (source_revision<>?3 OR through_watermark<>?4)",params![chat.id,chat.memory_watermark,revision,seen]).map_err(|e|e.to_string())?;
    Ok(())
}

pub(super) fn require_prepared(c:&Connection,prepared:&Prepared)->Result<(),String>{
    let answer=serde_json::to_string(&prepared.answer).map_err(|e|e.to_string())?;
    let matching:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM memory_contributions WHERE id=?1 AND state='prepared' AND attempts=?2 AND result_note=?3 AND answer_json=?4 AND before_note IS ?5)",params![prepared.id,prepared.attempt,prepared.result,answer,prepared.before],|r|r.get(0)).map_err(|e|e.to_string())?;
    if matching {Ok(())} else {Err("memory_contribution_changed".into())}
}

pub(super) fn recover(db:&Db,chat:&Chat,revision:&str,seen:i64,current:Option<&str>,written_only:bool,root:&Path)->Result<Option<Prepared>,String>{
    let c=db.0.lock().map_err(|e|e.to_string())?;
    let rows=c.prepare("SELECT id,before_note,result_note,answer_json,attempts FROM memory_contributions WHERE conversation_id=?1 AND from_watermark=?2 AND source_revision=?3 AND through_watermark=?4 AND state='prepared' ORDER BY rowid DESC")
        .map_err(|e|e.to_string())?.query_map(params![chat.id,chat.memory_watermark,revision,seen],|r|Ok((r.get::<_,String>(0)?,r.get::<_,Option<String>>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,i64>(4)?)))
        .map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    for (id,before,result,raw,attempt) in rows {
        let answer:Answer=checked(serde_json::from_str(&raw).map_err(|_|"memory_contribution_invalid")?)?;
        let already_written=answer.manifest.as_ref().is_some_and(|m|super::super::learned_records::published(root,&m.receipt)) || before.as_deref()!=Some(result.as_str()) && current==Some(result.as_str());
        if written_only && !already_written {continue;}
        if !already_written && require_route(&c,&id).is_err() {continue;}
        if current==before.as_deref() || already_written {
            return Ok(Some(Prepared{id,attempt,before,result,answer}));
        }
        c.execute("UPDATE memory_contributions SET state='superseded',error='memory_note_changed',updated_at=CURRENT_TIMESTAMP WHERE id=?1",[id]).map_err(|e|e.to_string())?;
    }
    Ok(None)
}

pub(super) fn claim(db:&Db,chat:&Chat,revision:&str,lines:&[Line],seen:i64,before:Option<&str>)->Result<Claim,String>{
    let c=db.0.lock().map_err(|e|e.to_string())?;
    let selected=provider(&c)?;
    let binding=route_binding(&c)?;
    let id=format!("memory-{}",vw::content_fingerprint(&json!([chat.id,chat.memory_watermark,seen,revision,before,binding]).to_string()));
    let refs:Vec<Value>=lines.iter().map(|l|json!({"messageId":l.id,"rowid":l.rowid,"role":l.role,"createdAt":l.created_at,"fingerprint":l.fingerprint})).collect();
    let claimed=c.execute(
        "INSERT INTO memory_contributions(id,conversation_id,from_watermark,through_watermark,source_revision,source_refs_json,provider,state,before_note,route_binding_json) VALUES(?1,?2,?3,?4,?5,?6,?7,'claimed',?8,?9) ON CONFLICT(id) DO UPDATE SET state='claimed',attempts=attempts+1,error=NULL,request_id=NULL,result_note=NULL,answer_json=NULL,updated_at=CURRENT_TIMESTAMP WHERE state IN ('failed','superseded') OR (state='claimed' AND updated_at<=datetime('now','-10 minutes'))",
        params![id,chat.id,chat.memory_watermark,seen,revision,json!(refs).to_string(),selected,before,binding]).map_err(|e|e.to_string())?;
    if claimed!=1 {return Err("analysis_waiting:memory_in_flight".into());}
    let attempt=c.query_row("SELECT attempts FROM memory_contributions WHERE id=?1",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    Ok(Claim{id,attempt})
}

pub(super) fn fail(db:&Db,claim:&Claim,error:&str){
    if let Ok(c)=db.0.lock(){let _=c.execute("UPDATE memory_contributions SET state='failed',error=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND state='claimed' AND attempts=?3",params![claim.id,error.chars().take(500).collect::<String>(),claim.attempt]);}
}

pub(super) fn prepare(db:&Db,claim:&Claim,before:Option<&str>,answer:Answer)->Result<Prepared,String>{
    let result=if answer.contributions.is_some() || before.map(|note|split_memory(note).sections.to_string()).unwrap_or_default()==answer.memory.trim() {
        before.unwrap_or_default().to_string()
    } else {render_memory(before,&answer.memory)};
    let c=db.0.lock().map_err(|e|e.to_string())?;
    require_route(&c,&claim.id)?;
    let changed=c.execute(
        "UPDATE memory_contributions SET state='prepared',result_note=?2,answer_json=?3,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND state='claimed' AND attempts=?4",
        params![claim.id,result,serde_json::to_string(&answer).map_err(|e|e.to_string())?,claim.attempt]
    ).map_err(|e|e.to_string())?;
    if changed!=1 {return Err("memory_contribution_changed".into());}
    Ok(Prepared{id:claim.id.clone(),attempt:claim.attempt,before:before.map(str::to_owned),result,answer})
}

pub(super) async fn analyze(db:&Db,mut input:Value)->Result<String,String>{
    let id=input.as_object_mut().and_then(|o|o.remove("_memoryContributionId")).and_then(|v|v.as_str().map(str::to_owned)).ok_or("memory_contribution_missing")?;
    let attempt=input.as_object_mut().and_then(|o|o.remove("_memoryAttempt")).and_then(|v|v.as_i64()).ok_or("memory_contribution_missing")?;
    let selected={
        let c=db.0.lock().map_err(|e|e.to_string())?;
        require_route(&c,&id)?;
        readiness(&c).require()?;
        c.query_row("SELECT provider FROM memory_contributions WHERE id=?1 AND state='claimed' AND attempts=?2",params![id,attempt],|r|r.get::<_,String>(0)).map_err(|_|"memory_contribution_changed")?
    };
    let mut record=super::super::models::RequestRecord::new(&super::super::models::resolve(super::super::models::Capability::Primary),"memory_contribution");
    record.provider=selected.clone();record.requested_model="runtime-selected".into();record.reasoning_effort=None;record.escalation_reason=None;
    super::super::models::save(db,&record)?;
    let _pending=super::super::assistant::PendingReceipt::new(db,&record.id);
    let linked=db.0.lock().map_err(|e|e.to_string())?.execute("UPDATE memory_contributions SET request_id=?2 WHERE id=?1 AND state='claimed' AND attempts=?3",params![id,record.id,attempt]).map_err(|e|e.to_string())?;
    if linked!=1 {return Err("memory_contribution_changed".into());}
    {let c=db.0.lock().map_err(|e|e.to_string())?;require_route(&c,&id)?;}
    let result=super::super::execution::structured(&selected,"memory_contribution",INSTRUCTIONS,input,schema(),&mut record).await;
    let mut metadata=record.usage.take().unwrap_or_else(||json!({}));
    if let Some(object)=metadata.as_object_mut(){object.insert("memoryContributionId".into(),json!(id));object.insert("memoryContributionAttempt".into(),json!(attempt));}
    record.usage=Some(metadata);
    super::super::models::save(db,&record)?;
    result.and_then(|raw| {
        let answer:Answer=serde_json::from_str(&raw).map_err(|_|"memory_pass_invalid_output")?;
        if answer.contributions.is_none(){return Err("memory_candidates_required".into());}
        Ok(raw)
    })
}

pub(super) fn latest(c:&Connection)->Result<Option<Value>,String>{
    c.query_row("SELECT j.id,j.state,j.provider,j.source_revision,j.source_refs_json,j.request_id,j.attempts,j.created_at,j.updated_at,j.error,r.record_json FROM memory_contributions j LEFT JOIN model_requests r ON r.id=j.request_id ORDER BY j.rowid DESC LIMIT 1",[],|r|{
        let refs:String=r.get(4)?;let record:Option<String>=r.get(10)?;
        let record:Value=record.and_then(|raw|serde_json::from_str(&raw).ok()).unwrap_or(Value::Null);
        Ok(json!({"id":r.get::<_,String>(0)?,"state":r.get::<_,String>(1)?,"provider":r.get::<_,String>(2)?,"sourceRevision":r.get::<_,String>(3)?,"sources":serde_json::from_str::<Value>(&refs).unwrap_or(Value::Null),"requestId":r.get::<_,Option<String>>(5)?,"attempts":r.get::<_,i64>(6)?,"createdAt":r.get::<_,String>(7)?,"updatedAt":r.get::<_,String>(8)?,"error":r.get::<_,Option<String>>(9)?,"actualModel":record["actualModel"],"requestStatus":record["status"]}))
    }).optional().map_err(|e|e.to_string())
}

pub(super) fn provider(c:&Connection)->Result<String,String>{
    let selected=c.query_row("SELECT value FROM settings WHERE key='chatMemory.provider.v1'",[],|r|r.get::<_,String>(0)).optional().map_err(|e|e.to_string())?.unwrap_or_else(||"claude-code".into());
    if matches!(selected.as_str(),"codex"|"claude-code"|"ollama") {Ok(selected)} else {Err("memory_provider_not_configured".into())}
}
pub(super) fn readiness(c:&Connection)->super::super::analysis_readiness::AnalysisReadiness {
    use super::super::analysis_readiness::{AnalysisReadiness,acceptance_wait};
    if super::super::acceptance::active() {return acceptance_wait();}
    match provider(c) {
        Ok(selected) if selected=="ollama" => match super::super::inference_routes::configured_local_model(super::super::inference_routes::LocalTask::Memory) {
            Ok(_)=>AnalysisReadiness::unverified("Local memory route configured; model quality and availability remain unverified."),
            Err(error)=>AnalysisReadiness::waiting("blocked","local_model",error),
        },
        Ok(selected)=>super::super::subscription_jobs::readiness_on(&selected),
        Err(error)=>AnalysisReadiness::waiting("blocked","provider",error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn changed_memory_route_is_rejected_before_dispatch() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let message=serde_json::from_value(json!({"id":"u","role":"user","content":"Remember this","timestamp":"12:00"})).unwrap();
        crate::commands::persistence::store_messages(&mut c,"talk",vec![message]).unwrap();c.execute("UPDATE conversations SET updated_at='2026-01-01 00:00:00'",[]).unwrap();
        let chat=due(&c,settings(&c)).unwrap().remove(0);let lines=lines_after(&c,"talk",0).unwrap();let db=Db(std::sync::Mutex::new(c));
        let claim=claim(&db,&chat,"revision",&lines,1,None).unwrap();
        db.0.lock().unwrap().execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1','ollama')",[]).unwrap();
        let result=tauri::async_runtime::block_on(analyze(&db,json!({"_memoryContributionId":claim.id,"_memoryAttempt":claim.attempt})));
        assert_eq!(result.unwrap_err(),"memory_route_changed");
        let c=db.0.lock().unwrap();assert_eq!(latest(&c).unwrap().unwrap()["state"],"superseded");
        assert_eq!(c.query_row("SELECT count(*) FROM model_requests",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }
    #[test]
    fn synthetic_model_or_confirmation_revision_change_invalidates_claim() {
        // Explicit synthetic stale metadata avoids changing global environment,
        // production confirmation files, or relying on any signed-in account.
        for field in ["model","accountConfirmation"] {
            let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
            let message=serde_json::from_value(json!({"id":"u","role":"user","content":"Remember this","timestamp":"12:00"})).unwrap();
            crate::commands::persistence::store_messages(&mut c,"talk",vec![message]).unwrap();c.execute("UPDATE conversations SET updated_at='2026-01-01 00:00:00'",[]).unwrap();
            let chat=due(&c,settings(&c)).unwrap().remove(0);let lines=lines_after(&c,"talk",0).unwrap();let db=Db(std::sync::Mutex::new(c));
            let claim=claim(&db,&chat,"revision",&lines,1,None).unwrap();
            {let c=db.0.lock().unwrap();let mut binding:Value=serde_json::from_str(&route_binding(&c).unwrap()).unwrap();
             binding[field]=json!("synthetic-obsolete-revision");
             c.execute("UPDATE memory_contributions SET route_binding_json=?2 WHERE id=?1",params![claim.id,binding.to_string()]).unwrap();}
            let result=tauri::async_runtime::block_on(analyze(&db,json!({"_memoryContributionId":claim.id,"_memoryAttempt":claim.attempt})));
            assert_eq!(result.unwrap_err(),"memory_route_changed");
            assert_eq!(latest(&db.0.lock().unwrap()).unwrap().unwrap()["state"],"superseded");
        }
    }
    #[test]
    fn returning_to_prior_route_reclaims_superseded_work_with_a_new_attempt() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let message=serde_json::from_value(json!({"id":"u","role":"user","content":"Remember this","timestamp":"12:00"})).unwrap();
        crate::commands::persistence::store_messages(&mut c,"talk",vec![message]).unwrap();c.execute("UPDATE conversations SET updated_at='2026-01-01 00:00:00'",[]).unwrap();
        let chat=due(&c,settings(&c)).unwrap().remove(0);let lines=lines_after(&c,"talk",0).unwrap();let db=Db(std::sync::Mutex::new(c));
        let first=claim(&db,&chat,"revision",&lines,1,None).unwrap();
        {let c=db.0.lock().unwrap();
         c.execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1','ollama')",[]).unwrap();
         assert_eq!(require_route(&c,&first.id).unwrap_err(),"memory_route_changed");
         c.execute("DELETE FROM settings WHERE key='chatMemory.provider.v1'",[]).unwrap();}
        let second=claim(&db,&chat,"revision",&lines,1,None).unwrap();
        assert_eq!(second.id,first.id);assert!(second.attempt>first.attempt);
        let answer=Answer{contributions:None,manifest:None,title:"t".into(),summary:"s".into(),memory:"## Other\n- x".into()};
        assert!(matches!(prepare(&db,&first,None,answer),Err(e) if e=="memory_contribution_changed"));
    }
    #[test]
    fn expired_claim_cannot_overwrite_a_new_attempt() {
        let mut c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        let message=serde_json::from_value(json!({"id":"u","role":"user","content":"Remember this","timestamp":"12:00"})).unwrap();
        crate::commands::persistence::store_messages(&mut c,"talk",vec![message]).unwrap();
        c.execute("UPDATE conversations SET updated_at='2026-01-01 00:00:00'",[]).unwrap();
        let chat=due(&c,settings(&c)).unwrap().remove(0);let lines=lines_after(&c,"talk",0).unwrap();
        let db=Db(std::sync::Mutex::new(c));
        let first=claim(&db,&chat,"revision",&lines,1,None).unwrap();
        db.0.lock().unwrap().execute("UPDATE memory_contributions SET updated_at=datetime('now','-11 minutes')",[]).unwrap();
        let _second=claim(&db,&chat,"revision",&lines,1,None).unwrap();
        let answer=Answer{contributions:None,manifest:None,title:"t".into(),summary:"s".into(),memory:"## Other\n- x".into()};
        assert!(prepare(&db,&first,None,answer).is_err(),"A late result from the old lease must be rejected");
    }
    #[test]
    fn memory_provider_is_explicit_and_invalid_choices_never_fall_back() {
        let c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
        assert_eq!(provider(&c).unwrap(),"claude-code");
        for choice in ["codex","ollama","claude-code"] {
            c.execute("INSERT INTO settings(key,value) VALUES('chatMemory.provider.v1',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[choice]).unwrap();
            assert_eq!(provider(&c).unwrap(),choice);
        }
        c.execute("UPDATE settings SET value='openai' WHERE key='chatMemory.provider.v1'",[]).unwrap();
        assert!(provider(&c).is_err());
    }
}
