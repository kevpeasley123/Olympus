use super::*;
use super::learning::{change, snapshot as learned, project, LearningRequest};

fn fixture() -> (Db, String) {
    let db = tests::database(); tests::mail(&db, "thread", "Please review enrollment.");
    let signature = {
        let c=db.0.lock().unwrap(); let a=account(&c).unwrap();
        let sig=thread_signatures(&c,&a).unwrap()["thread"].0.clone();
        c.execute("INSERT INTO communication_situation_sources VALUES('fixture','thread',?1,NULL,?2,'now')",params![sig,json!({"threadId":"thread","subject":"Enrollment","timestamp":chrono::Utc::now().timestamp_millis(),"attention":{"title":"Review enrollment","why":"Email asks for review","action":"Review selections","messageId":"thread","quote":"Please review enrollment."}}).to_string()]).unwrap(); sig
    }; (db,signature)
}
fn request(sig:&str, rev:i64, action:&str, text:&str) -> LearningRequest {
    LearningRequest {account_id:"fixture".into(),thread_id:"thread".into(),signature:sig.into(),expected_revision:rev,action:action.into(),text:text.into()}
}
fn list(c:&Connection) -> Vec<Value> { let a=account(c).unwrap();learned(c,&a.id,&thread_signatures(c,&a).unwrap()).unwrap() }
#[test]
fn learning_correction_is_durable_source_scoped_and_revision_checked() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    change(&mut c,request(&sig,0,"corrected","I already submitted; wait for confirmation.")).unwrap();
    let rows=list(&c);assert_eq!(rows[0]["correction"],"I already submitted; wait for confirmation.");
    assert_eq!(rows[0]["revision"],1);assert_eq!(rows[0]["current"],true);assert_eq!(rows[0]["canUndo"],true);
    assert_eq!(revision(&c,"fixture").unwrap(),1);
    assert_eq!(change(&mut c,request(&sig,0,"corrected","stale")).unwrap_err(),"learning_revision_changed");
    let mut other=request(&sig,1,"corrected","wrong account");other.account_id="other".into();assert!(change(&mut c,other).is_err());
    assert_eq!(change(&mut c,request("obsolete",1,"corrected","bad")).unwrap_err(),"learning_source_changed");
    assert_eq!(list(&c),rows); // conflict changed nothing
    assert_eq!(c.query_row("SELECT count(*) FROM gmail_messages",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    let path=std::env::temp_dir().join(format!("olympus-learning-{}.sqlite",crate::commands::delegation::run_id()));
    c.execute("VACUUM INTO ?1",[path.to_string_lossy()]).unwrap();
    let reopened=Connection::open(&path).unwrap();assert_eq!(list(&reopened),rows);drop(reopened);std::fs::remove_file(path).unwrap();
}
#[test]
fn learning_undo_restores_prior_feedback_and_forget_redacts_history() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    change(&mut c,request(&sig,0,"corrected","PRIVATE_CORRECTION")).unwrap();
    change(&mut c,request(&sig,1,"handled","")).unwrap();assert_eq!(list(&c)[0]["action"],"handled");
    change(&mut c,request(&sig,2,"undo","")).unwrap();assert_eq!(list(&c)[0]["correction"],"PRIVATE_CORRECTION");
    change(&mut c,request(&sig,3,"forget","")).unwrap();
    let raw:String=c.query_row("SELECT payload_json FROM email_learning",[],|r|r.get(0)).unwrap();
    assert!(!raw.contains("PRIVATE_CORRECTION"));assert!(!raw.contains("Please review enrollment"));
    assert_eq!(list(&c)[0]["action"],"forgotten");assert_eq!(list(&c)[0]["canUndo"],false);
    assert_eq!(change(&mut c,request(&sig,4,"undo","")).unwrap_err(),"learning_nothing_to_undo");
    let sources=vec![json!({"threadId":"thread","signature":sig,"current":true,"attention":{"title":"Old inference"}})];
    assert!(project(&sources,&list(&c),0).is_empty());
}
#[test]
fn learning_projection_rejects_changed_sources_and_handles_snooze_without_completion() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    let sources=vec![json!({"threadId":"thread","signature":sig,"current":true,"attention":{"title":"Review","action":"old"}})];
    change(&mut c,request(&sig,0,"snoozed","")).unwrap();let rows=list(&c);
    assert!(project(&sources,&rows,chrono::Utc::now().timestamp_millis()).is_empty());
    assert_eq!(project(&sources,&rows,chrono::Utc::now().timestamp_millis()+86_400_001).len(),1);
    change(&mut c,request(&sig,1,"corrected","Wait for confirmation")).unwrap();
    let corrected=project(&sources,&list(&c),0);assert_eq!(corrected[0]["operatorCorrection"],"Wait for confirmation");
    c.execute("UPDATE gmail_messages SET fingerprint='changed'",[]).unwrap();
    let rows=list(&c);assert_eq!(rows[0]["current"],false);
    let mut changed=sources.clone();changed[0]["signature"]=json!("new");
    assert!(project(&changed,&rows,0)[0]["operatorCorrection"].is_null());
    // Forget stale learning is possible; it never mutates the new email.
    change(&mut c,request(&sig,2,"forget","")).unwrap();
    assert_eq!(list(&c)[0]["action"],"forgotten");
}
#[test]
fn learning_bounds_atomicity_and_cache_purge() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    for text in ["".to_string(),"x".repeat(1001)] {assert!(change(&mut c,request(&sig,0,"corrected",&text)).is_err());}
    assert!(list(&c).is_empty());
    c.execute_batch("CREATE TRIGGER learning_fail BEFORE UPDATE ON communication_situation_state BEGIN SELECT RAISE(ABORT,'fixture'); END;").unwrap();
    assert!(change(&mut c,request(&sig,0,"corrected","valid")).is_err());assert!(list(&c).is_empty());
    c.execute_batch("DROP TRIGGER learning_fail;").unwrap();
    change(&mut c,request(&sig,0,"corrected","valid")).unwrap();
    assert_eq!(store::cache_counts(&c,"fixture",None,chrono::Utc::now().timestamp_millis()).unwrap()["learningRecords"],1);
    store::remove_cache(&mut c,"fixture").unwrap();
    assert_eq!(c.query_row("SELECT count(*) FROM email_learning",[],|r|r.get::<_,i64>(0)).unwrap(),0);
}

#[test]
fn learning_undo_to_old_source_does_not_keep_new_source_suppressed() {
    let (db,sig)=fixture(); let mut c=db.0.lock().unwrap();
    change(&mut c,request(&sig,0,"corrected","Old context")).unwrap();
    c.execute("UPDATE gmail_messages SET fingerprint='new'",[]).unwrap();
    let next=thread_signatures(&c,&account(&c).unwrap()).unwrap()["thread"].0.clone();
    c.execute("UPDATE communication_situation_sources SET signature=?1",[&next]).unwrap();
    change(&mut c,request(&next,1,"handled","")).unwrap();
    change(&mut c,request(&next,2,"undo","")).unwrap();
    let mut sources=observations(&c,"fixture").unwrap();sources[0]["current"]=json!(true);
    let restored=project(&sources,&list(&c),0);
    assert_eq!(restored.len(),1,"Undo to stale correction does not suppress new evidence");
    assert_eq!(restored[0]["learningRevision"],3,"Undo invalidates receipt even when earlier feedback is stale");
}
#[test]
fn learning_change_invalidates_snapshot_and_pending_analysis() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    let before=with_revision(super::snapshot(&c).unwrap(),None);
    change(&mut c,request(&sig,0,"corrected","Wait for confirmation")).unwrap();
    let after=with_revision(super::snapshot(&c).unwrap(),None);
    assert_ne!(before["revision"],after["revision"]);
    assert_eq!(after["attention"][0]["operatorCorrection"],"Wait for confirmation");
    assert_eq!(after["observations"].as_array().unwrap().len(),1,"Attention evidence is available without a situation assignment");
    assert_eq!(revision(&c,"fixture").unwrap(),1,"The analyzer publication guard sees a changed context revision");
}

#[test]
fn learning_history_is_bounded_and_forgetting_cannot_be_undone_via_later_edits() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    for rev in 0..25 {change(&mut c,request(&sig,rev,"corrected",&format!("context {rev}"))).unwrap();}
    let raw:String=c.query_row("SELECT payload_json FROM email_learning",[],|r|r.get(0)).unwrap();
    let value:Value=serde_json::from_str(&raw).unwrap();assert_eq!(value["history"].as_array().unwrap().len(),20);
    change(&mut c,request(&sig,25,"forget","")).unwrap();
    change(&mut c,request(&sig,26,"corrected","new context")).unwrap();
    assert_eq!(list(&c)[0]["canUndo"],false);
    let raw:String=c.query_row("SELECT payload_json FROM email_learning",[],|r|r.get(0)).unwrap();assert!(!raw.contains("context 24"));
}

#[test]
fn learning_snooze_expiry_preserves_explicit_correction() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    change(&mut c,request(&sig,0,"corrected","Already submitted; wait for confirmation")).unwrap();
    change(&mut c,request(&sig,1,"snoozed","")).unwrap();
    let mut sources=observations(&c,"fixture").unwrap();sources[0]["current"]=json!(true);
    let after=project(&sources,&list(&c),chrono::Utc::now().timestamp_millis()+86_400_001);
    assert_eq!(after[0]["operatorCorrection"],"Already submitted; wait for confirmation");
}
#[test]
fn learning_forgotten_source_stays_suppressed_after_newer_evidence_disappears() {
    let (db,sig)=fixture();let mut c=db.0.lock().unwrap();
    change(&mut c,request(&sig,0,"corrected","PRIVATE_CORRECTION_A")).unwrap();
    change(&mut c,request(&sig,1,"forget","")).unwrap();
    let old_fingerprint:String=c.query_row("SELECT fingerprint FROM gmail_messages",[],|r|r.get(0)).unwrap();
    c.execute("UPDATE gmail_messages SET fingerprint='new-source'",[]).unwrap();
    let newer=thread_signatures(&c,&account(&c).unwrap()).unwrap()["thread"].0.clone();
    c.execute("UPDATE communication_situation_sources SET signature=?1",[&newer]).unwrap();
    change(&mut c,request(&newer,2,"corrected","New evidence context")).unwrap();
    c.execute("UPDATE gmail_messages SET fingerprint=?1",[old_fingerprint]).unwrap();
    c.execute("UPDATE communication_situation_sources SET signature=?1",[&sig]).unwrap();
    let mut sources=observations(&c,"fixture").unwrap();sources[0]["current"]=json!(true);
    assert!(project(&sources,&list(&c),0).is_empty(),"Returning forgotten source must not resurrect advice");
    let raw:String=c.query_row("SELECT payload_json FROM email_learning",[],|r|r.get(0)).unwrap();assert!(!raw.contains("PRIVATE_CORRECTION_A"));
}
