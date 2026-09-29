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
#[test]
fn background_failures_back_off_to_a_bounded_ceiling() {
    assert_eq!(backoff_ms(1), 300_000);
    assert_eq!(backoff_ms(2), 600_000);
    assert_eq!(backoff_ms(5), 4_800_000);
    assert_eq!(backoff_ms(7), 14_400_000);
    assert_eq!(backoff_ms(u32::MAX), 14_400_000);
}
#[test]
fn backoff_is_reported_only_for_the_account_that_failed() {
    let mut state = Backoff::default();
    let failed: Result<(), String> = Err("situation_model_failed".into());
    state.record(Some("fixture"), &failed, 1_000);
    state.record(Some("fixture"), &failed, 2_000);
    assert_eq!(state.for_account("fixture"), (2, 2_000 + backoff_ms(2)));
    assert_eq!(state.for_account("other"), (0, 0));
    let db = database();
    let c = db.0.lock().unwrap();
    let (failures, resume_at) = state.for_account("other");
    assert!(understanding(&c, "other", failures, resume_at, 1_500).unwrap()["nextAttemptAt"].is_null());
    let (failures, resume_at) = state.for_account("fixture");
    assert!(!understanding(&c, "fixture", failures, resume_at, 2_500).unwrap()["nextAttemptAt"].is_null());
    // Another account failing starts its own count and releases the first.
    state.record(Some("other"), &failed, 3_000);
    assert_eq!(state.for_account("other"), (1, 3_000 + backoff_ms(1)));
    assert_eq!(state.for_account("fixture"), (0, 0));
    // Not connected or a busy database is not a failed attempt.
    state.record(None, &Err("gmail_not_connected".into()), 4_000);
    assert_eq!(state.for_account("other"), (1, 3_000 + backoff_ms(1)));
    state.record(Some("other"), &Ok(()), 5_000);
    assert_eq!(state.for_account("other"), (0, 0));
}
#[test]
fn understanding_reports_last_published_run_and_real_backoff_only() {
    let db = database();
    let c = db.0.lock().unwrap();
    let fresh = understanding(&c, "fixture", 0, 0, 1_000).unwrap();
    assert!(fresh["lastSuccessAt"].is_null());
    assert!(fresh["lastAttemptAt"].is_null());
    assert!(fresh["nextAttemptAt"].is_null());
    let run = |id: &str, account: &str, graph: &str, status: &str, finished: &str| {
        c.execute(
            "INSERT INTO communication_runs VALUES(?1,?2,30,?4,?3)",
            params![id, account, json!({"graph":graph,"status":status,"finishedAt":finished}).to_string(), status],
        )
        .unwrap();
    };
    run("ok", "fixture", GRAPH, "completed", "2026-09-12T18:00:00Z");
    run("failed-later", "fixture", GRAPH, "failed", "2026-09-12T19:00:00Z");
    run("thread-triage", "fixture", "communication-intelligence/v4", "completed", "2026-09-12T20:00:00Z");
    run("other-account", "other", GRAPH, "completed", "2026-09-12T21:00:00Z");
    c.execute("UPDATE communication_situation_state SET last_attempt=1757700000000 WHERE account_id='fixture'", []).unwrap();
    // A failed attempt and thread triage do not count as understanding published.
    let status = understanding(&c, "fixture", 2, 5_000, 1_000).unwrap();
    assert_eq!(status["lastSuccessAt"], "2026-09-12T18:00:00Z");
    assert_eq!(status["lastAttemptAt"], "2025-09-12T18:00:00+00:00");
    assert_eq!(status["failures"], 2);
    assert_eq!(status["nextAttemptAt"], "1970-01-01T00:00:05+00:00");
    // A resume time already passed is not presented as a pending backoff.
    assert!(understanding(&c, "fixture", 2, 5_000, 6_000).unwrap()["nextAttemptAt"].is_null());
    assert!(understanding(&c, "fixture", 0, 5_000, 1_000).unwrap()["nextAttemptAt"].is_null());
}
#[test]
fn snapshot_revision_is_stable_and_short_circuits_unchanged_polls() {
    let value = json!({"situations":[{"id":"a","title":"Home"}],"enabled":true});
    let first = with_revision(value.clone(), None);
    let revision = first["revision"].as_str().unwrap().to_string();
    assert_eq!(first["situations"][0]["title"], "Home");
    assert_eq!(with_revision(value.clone(), Some(&revision)), json!({"unchanged":true,"revision":revision}));
    let changed = with_revision(json!({"situations":[{"id":"a","title":"Home purchase"}],"enabled":true}), Some(&revision));
    assert_ne!(changed["revision"], json!(revision));
    assert_eq!(changed["situations"][0]["title"], "Home purchase");
    assert!(changed.get("unchanged").is_none());
}
