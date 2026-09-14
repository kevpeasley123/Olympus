use super::*;
#[test]
fn private_context_is_ui_only_and_account_scoped() {
    let db=database();let mut c=db.0.lock().unwrap();
    c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture','house','Home','now')",[]).unwrap();
    c.execute("INSERT INTO communication_situation_contexts VALUES('fixture','house',?1,'now')",[json!({"summary":"PRIVATE_DOCUMENT_SENTINEL","entities":[]}).to_string()]).unwrap();
    c.execute("INSERT INTO communication_situation_contexts VALUES('other','house','{\"summary\":\"OTHER_ACCOUNT\"}','now')",[]).unwrap();
    assert!(!json!(situations(&c,"fixture").unwrap()).to_string().contains("PRIVATE_DOCUMENT_SENTINEL"));
    let ui=snapshot(&c).unwrap().to_string();assert!(ui.contains("PRIVATE_DOCUMENT_SENTINEL"));assert!(!ui.contains("OTHER_ACCOUNT"));
    assert_eq!(edit(&mut c,"house",Edit::Merge,"house").unwrap_err(),"cannot_merge_into_itself");
}
pub(super) fn database() -> Db {
    let c = Connection::open_in_memory().unwrap();
    c.execute_batch(include_str!("../../../../schema.sql"))
        .unwrap();
    store::connect(&c, "fixture", "operator@example.invalid", 30).unwrap();
    ensure(&c, "fixture").unwrap();
    Db(std::sync::Mutex::new(c))
}
pub(super) fn mail(db: &Db, id: &str, body: &str) {
    let c = db.0.lock().unwrap();
    let time = chrono::Utc::now().timestamp_millis() - 1000;
    let m = json!({"provider":"gmail","accountId":"fixture","id":id,"threadId":id,"historyId":"1","sender":"Lender <lender@example.invalid>","recipients":"operator@example.invalid","cc":"agent@example.invalid","subject":"Purchase documents","internalDate":time,"rfcMessageId":"","inReplyTo":"","references":"","labels":["INBOX"],"canonicalText":body,"cleanText":body,"snippet":body,"attachments":[],"retrievedAt":now(),"bodyStatus":"text_available","fingerprint":content_fingerprint(body)});
    c.execute(
        "INSERT OR REPLACE INTO gmail_messages VALUES('fixture',?1,?1,?2,1,1,?3,?4)",
        params![id, time, content_fingerprint(body), m.to_string()],
    )
    .unwrap();
}
#[test]
fn merge_preserves_sources_updates_and_drafts_and_restore_is_scoped() {
    let db = database();
    let mut c = db.0.lock().unwrap();
    for id in ["a", "b"] {
        c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture',?1,?1,'now')",[id]).unwrap();
    }
    c.execute(
        "INSERT INTO communication_situation_sources VALUES('fixture','aa','fp','a','{}','now')",
        [],
    )
    .unwrap();
    c.execute("INSERT INTO communication_situation_updates VALUES('fixture','u','a','Operator context','now')",[]).unwrap();
    c.execute(
        "INSERT INTO communication_situation_drafts VALUES('fixture','d','a','aa','{}',1,'now')",
        [],
    )
    .unwrap();
    edit(&mut c, "a", Edit::Merge, "b").unwrap();
    for table in [
        "communication_situation_sources",
        "communication_situation_updates",
        "communication_situation_drafts",
    ] {
        let id: String = c
            .query_row(&format!("SELECT situation_id FROM {table}"), [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(id, "b")
    }
    assert!(edit(&mut c, "a", Edit::Restore, "").is_err());
    assert!(edit(&mut c, "unknown", Edit::Rename, "x").is_err());
    edit(&mut c, "b", Edit::Dismiss, "").unwrap();
    edit(&mut c, "b", Edit::Restore, "").unwrap();
    assert_eq!(revision(&c, "fixture").unwrap(), 3);
}
#[test]
fn account_disconnect_hides_situations() {
    let db = database();
    let c = db.0.lock().unwrap();
    store::disconnect(&c, "fixture").unwrap();
    assert!(snapshot(&c).is_err());
}
