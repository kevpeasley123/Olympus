//! Immutable source-linked interpretation transitions; never display acknowledgments.
use super::*;
pub(super) fn record(c:&Connection,account:&str,id:&str,reason:&str)->Result<(),String>{
    let row:Option<(String,String,String)>=c.query_row("SELECT title,state,briefing_json FROM communication_situations WHERE account_id=?1 AND id=?2",params![account,id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(err)?;
    let Some((title,state,briefing))=row else{return Ok(())};
    let briefing:Value=serde_json::from_str(&briefing).map_err(err)?;
    let mut q=c.prepare("SELECT thread_id,signature,payload_json FROM communication_situation_sources WHERE account_id=?1 AND situation_id=?2 ORDER BY thread_id").map_err(err)?;
    let source_rows=q.query_map(params![account,id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    let mut sources=Vec::new();let mut interpretations=Vec::new();let mut event_time=None::<i64>;let mut feedback=Vec::new();
    for(thread,signature,raw)in source_rows {
        let source:Value=serde_json::from_str(&raw).map_err(err)?;
        if let Some(at)=source["timestamp"].as_i64(){event_time=Some(event_time.map_or(at,|old|old.max(at)));}
        sources.push(json!({"threadId":thread,"signature":signature,"evidenceRefs":source["evidenceRefs"]}));
        interpretations.push(json!({"threadId":thread,"summary":source["summary"],"details":source["details"],"trackingKind":source["trackingKind"],"transactionKey":source["transactionKey"]}));
        let revision:Option<i64>=c.query_row("SELECT revision FROM email_learning WHERE account_id=?1 AND thread_id=?2",params![account,thread],|r|r.get(0)).optional().map_err(err)?;
        if let Some(revision)=revision{feedback.push(json!({"threadId":thread,"revision":revision}));}
    }
    // Operator update text stays in its canonical table, not an immutable journal.
    let mut updates=c.prepare("SELECT id FROM communication_situation_updates WHERE account_id=?1 AND situation_id=?2 ORDER BY id").map_err(err)?;
    let update_refs=updates.query_map(params![account,id],|r|r.get::<_,String>(0)).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    let payload=json!({"title":title,"state":state,"whereThingsStand":briefing["whereThingsStand"],"whatChanged":briefing["whatChanged"],"nextMoves":briefing["nextMoves"],"interpretations":interpretations,"operatorUpdateRefs":update_refs});
    let input=content_fingerprint(&json!([payload,sources,feedback]).to_string());
    let prior:Option<(String,String)>=c.query_row("SELECT revision,input_digest FROM communication_situation_changes WHERE account_id=?1 AND situation_id=?2 ORDER BY sequence DESC LIMIT 1",params![account,id],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(err)?;
    if prior.as_ref().is_some_and(|p|p.1==input){return Ok(());}
    let previous=prior.map(|p|p.0);
    let revision=content_fingerprint(&json!([previous,input]).to_string());
    let kind=if previous.is_none(){"initial"}else if reason=="operator_feedback"{"operator_feedback"}else{"reconciled"};
    c.execute("INSERT OR IGNORE INTO communication_situation_changes(account_id,situation_id,revision,input_digest,previous_revision,kind,event_time,observed_at,claim_status,source_refs_json,feedback_refs_json,payload_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",params![account,id,revision,input,previous,kind,event_time,now(),if reason=="operator_feedback"{"operator_correction_reference"}else{"interpretation"},json!(sources).to_string(),json!(feedback).to_string(),payload.to_string()]).map_err(err)?;
    Ok(())
}
/// Latest bounded historical transitions, filtering explicitly forgotten source revisions.
pub(super) fn history(c:&Connection,account:&str,id:&str,learned:&[Value])->Result<Value,String>{
    let mut q=c.prepare("SELECT revision,previous_revision,kind,event_time,observed_at,claim_status,source_refs_json,feedback_refs_json,payload_json FROM communication_situation_changes WHERE account_id=?1 AND situation_id=?2 ORDER BY sequence DESC LIMIT 9").map_err(err)?;
    let mut entries=q.query_map(params![account,id],|r|Ok(json!({"revision":r.get::<_,String>(0)?,"previousRevision":r.get::<_,Option<String>>(1)?,"kind":r.get::<_,String>(2)?,"eventTime":r.get::<_,Option<i64>>(3)?,"observedAt":r.get::<_,String>(4)?,"claimStatus":r.get::<_,String>(5)?,"sourceRefs":serde_json::from_str::<Value>(&r.get::<_,String>(6)?).map_err(|_|rusqlite::Error::InvalidQuery)?,"feedbackRefs":serde_json::from_str::<Value>(&r.get::<_,String>(7)?).map_err(|_|rusqlite::Error::InvalidQuery)?,"interpretation":serde_json::from_str::<Value>(&r.get::<_,String>(8)?).map_err(|_|rusqlite::Error::InvalidQuery)?}))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    let has_more=entries.len()>8;entries.truncate(8);
    entries.retain(|e|!e["sourceRefs"].as_array().into_iter().flatten().any(|source|learned.iter().any(|l|l["threadId"]==source["threadId"]&&l["forgottenSignatures"].as_array().is_some_and(|s|s.contains(&source["signature"])))));
    Ok(json!({"items":entries,"hasMore":has_more}))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn journal_feedback_references_never_preserve_withdrawn_correction_text() {
        let (db,sig)=super::super::learning_tests::fixture();let mut c=db.0.lock().unwrap();
        c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture','order','Order','now')",[]).unwrap();
        c.execute("UPDATE communication_situation_sources SET situation_id='order'",[]).unwrap();
        for (revision,action,text) in [(0,"corrected","PRIVATE_CORRECTION"),(1,"handled",""),(2,"forget","")] {
            learning::change(&mut c,learning::LearningRequest{account_id:"fixture".into(),thread_id:"thread".into(),signature:sig.clone(),expected_revision:revision,action:action.into(),text:text.into()}).unwrap();
        }
        assert_eq!(c.query_row("SELECT count(*) FROM communication_situation_changes",[],|r|r.get::<_,i64>(0)).unwrap(),3);
        let payload:String=c.query_row("SELECT group_concat(payload_json) FROM communication_situation_changes",[],|r|r.get(0)).unwrap();assert!(!payload.contains("PRIVATE_CORRECTION"));
        let learned=learning::snapshot(&c,"fixture",&BTreeMap::new()).unwrap();
        assert!(history(&c,"fixture","order",&learned).unwrap()["items"].as_array().unwrap().is_empty());
    }
    #[test]
    fn journal_retains_prior_revision_and_retries_are_idempotent_after_reopen() {
        let db=super::super::tests::database();
        let c=db.0.lock().unwrap();
        c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture','order','Order A','now')",[]).unwrap();
        record(&c,"fixture","order","reconciled").unwrap();
        record(&c,"fixture","order","reconciled").unwrap();
        assert_eq!(c.query_row("SELECT count(*) FROM communication_situation_changes",[],|r|r.get::<_,i64>(0)).unwrap(),1);
        let first:String=c.query_row("SELECT revision FROM communication_situation_changes",[],|r|r.get(0)).unwrap();
        c.execute("UPDATE communication_situations SET briefing_json=?1",[json!({"whereThingsStand":"Order delayed"}).to_string()]).unwrap();
        record(&c,"fixture","order","reconciled").unwrap();
        let prior:String=c.query_row("SELECT previous_revision FROM communication_situation_changes ORDER BY sequence DESC LIMIT 1",[],|r|r.get(0)).unwrap();assert_eq!(prior,first);
        let path=std::env::temp_dir().join(format!("olympus-journal-{}.sqlite",crate::commands::delegation::run_id()));
        c.execute("VACUUM INTO ?1",[path.to_string_lossy()]).unwrap();
        let reopened=Connection::open(&path).unwrap();record(&reopened,"fixture","order","reconciled").unwrap();
        assert_eq!(reopened.query_row("SELECT count(*) FROM communication_situation_changes",[],|r|r.get::<_,i64>(0)).unwrap(),2);
        assert_eq!(reopened.query_row("SELECT kind FROM communication_situation_changes ORDER BY sequence LIMIT 1",[],|r|r.get::<_,String>(0)).unwrap(),"initial");
        drop(reopened);std::fs::remove_file(path).unwrap();
    }
}
