use super::auth::Secrets;
use super::*;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use std::{
    cell::RefCell,
    collections::{HashMap, VecDeque},
};
fn db() -> Connection {
    let c = Connection::open_in_memory().unwrap();
    c.execute_batch(include_str!("../../../schema.sql"))
        .unwrap();
    store::connect(&c, "fixture-account", "operator@example.invalid", 90).unwrap();
    c
}
fn message(id: &str, thread: &str, text: &str) -> Value {
    json!({"id":id,"threadId":thread,"historyId":"100","internalDate":chrono::Utc::now().timestamp_millis().to_string(),"labelIds":["INBOX","IMPORTANT"],"payload":{"mimeType":"text/plain","headers":[{"name":"From","value":"Brandon <brandon@example.invalid>"},{"name":"To","value":"operator@example.invalid"},{"name":"Subject","value":"Atlas closing documents"},{"name":"Message-ID","value":"<fixture@example.invalid>"}],"body":{"data":URL_SAFE_NO_PAD.encode(text)}}})
}
fn mail(id: &str) -> mime::Mail {
    mime::normalize("fixture-account",&message(id,"aabb","Atlas deadline due by Friday. Can you review the closing documents?\n-- \nSignature\n> Quoted historical text")).unwrap()
}
struct FakeApi {
    responses: VecDeque<(&'static str, Result<Value, ApiError>)>,
    calls: Vec<(String, Vec<(String, String)>)>,
}
impl FakeApi {
    fn new(v: Vec<(&'static str, Result<Value, ApiError>)>) -> Self {
        Self {
            responses: v.into(),
            calls: Vec::new(),
        }
    }
}
impl Api for FakeApi {
    fn get(&mut self, p: &str, q: &[(&str, String)]) -> Result<Value, ApiError> {
        self.calls.push((
            p.into(),
            q.iter().map(|(k, v)| (k.to_string(), v.clone())).collect(),
        ));
        let (expected, result) = self.responses.pop_front().expect("Unexpected API request");
        assert!(expected == p, "Unexpected route");
        result
    }
}
#[test]
fn oauth_state_and_duplicate_parameters_rejected() {
    assert!(auth::callback("/oauth/callback?state=good&code=opaque", "good").is_ok());
    for path in [
        "/oauth/callback?state=bad&code=opaque",
        "/oauth/callback?state=good&state=good&code=opaque",
        "/oauth/callback?code=opaque",
        "/oauth/callback?state=good&code=a&code=b",
        "/other?state=good&code=a",
    ] {
        assert!(auth::callback(path, "good").is_err())
    }
}
#[test]
fn oauth_cancel_and_missing_code_are_safe_codes() {
    assert!(
        auth::callback("/oauth/callback?state=s&error=access_denied", "s").unwrap_err()
            == "oauth_cancelled"
    );
    assert!(auth::callback("/oauth/callback?state=s", "s").unwrap_err() == "oauth_code_missing")
}
#[test]
fn pkce_matches_rfc7636_vector() {
    assert!(
        auth::challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
            == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
    let a = auth::random().unwrap();
    let b = auth::random().unwrap();
    assert!(a.len() == 43 && a != b)
}
#[test]
fn plain_source_retains_quotes_signature_and_provenance() {
    let m = mail("abcd");
    assert!(m.canonical_text.contains("Signature") && m.canonical_text.contains("> Quoted"));
    assert!(
        m.provider == "gmail"
            && m.thread_id == "aabb"
            && m.rfc_message_id == "<fixture@example.invalid>"
            && !m.fingerprint.is_empty()
    );
    assert!(m.clean_text == m.canonical_text.trim())
}
#[test]
fn alternatives_prefer_plain_nested_attachments_metadata_only() {
    let mut v = message("ab", "aa", "");
    v["payload"] = json!({"mimeType":"multipart/mixed","parts":[{"mimeType":"multipart/alternative","parts":[{"mimeType":"text/plain","body":{"data":URL_SAFE_NO_PAD.encode("plain body")}},{"mimeType":"text/html","body":{"data":URL_SAFE_NO_PAD.encode("<b>html alternative</b>")}}]},{"mimeType":"application/pdf","filename":"fixture.pdf","body":{"attachmentId":"attachment-opaque","size":450}}]});
    let m = mime::normalize("a", &v).unwrap();
    assert!(
        m.canonical_text == "plain body"
            && m.attachments.len() == 1
            && m.attachments[0].size == 450
    )
}
#[test]
fn html_becomes_inert_text() {
    let mut v = message("ab", "aa", "");
    v["payload"]["mimeType"] = json!("text/html");
    v["payload"]["body"]["data"]=json!(URL_SAFE_NO_PAD.encode("<div>Hello <b>world</b></div><script>alert('bad')</script><img src='https://invalid.example/tracker'>"));
    let m = mime::normalize("a", &v).unwrap();
    assert!(
        m.canonical_text.contains("Hello")
            && !m.canonical_text.contains("<script")
            && !m.canonical_text.contains("<img")
    );
}
#[test]
fn malformed_mime_aborts_without_fabrication() {
    let mut v = message("ab", "aa", "");
    v["payload"]["body"]["data"] = json!("***");
    assert!(mime::normalize("a", &v).is_err());
    v["payload"]["body"] = json!({"attachmentId":"opaque","size":5000});
    let m = mime::normalize("a", &v).unwrap();
    assert!(
        m.canonical_text.is_empty() && m.body_status == "partial_body_attachment_not_downloaded"
    )
}
#[test]
fn fingerprint_stable_across_retrieval_time_changes_on_source_change() {
    let v = message("ab", "aa", "one");
    let a = mime::normalize("a", &v).unwrap();
    let b = mime::normalize("a", &v).unwrap();
    assert!(a.fingerprint == b.fingerprint);
    let mut v = v;
    v["labelIds"] = json!(["SENT"]);
    assert!(mime::normalize("a", &v).unwrap().fingerprint != a.fingerprint)
}
#[test]
fn spam_trash_and_old_mail_excluded() {
    for label in ["SPAM", "TRASH"] {
        let mut m = mail("ab");
        m.labels.push(label.into());
        assert!(!mime::in_scope(&m, 90))
    }
    let mut m = mail("ab");
    m.internal_date = 1;
    assert!(!mime::in_scope(&m, 90))
}
#[test]
fn initial_sync_paginates_and_captures_cursor_before_listing() {
    let c = db();
    let a = store::account(&c).unwrap().unwrap();
    let mut api = FakeApi::new(vec![
        ("profile", Ok(json!({"historyId":"100"}))),
        (
            "messages",
            Ok(json!({"messages":[{"id":"ab"}],"nextPageToken":"page2"})),
        ),
        ("messages", Ok(json!({"messages":[{"id":"ac"}]}))),
        ("messages/ab", Ok(message("ab", "aa", "one"))),
        ("messages/ac", Ok(message("ac", "aa", "two"))),
    ]);
    let b = sync::collect(&mut api, &a, &[]).unwrap();
    assert!(b.messages.len() == 2 && b.cursor == "100" && b.full);
    assert!(api.calls[2]
        .1
        .iter()
        .any(|(k, v)| k == "pageToken" && v == "page2"));
    assert!(api.calls[1]
        .1
        .iter()
        .any(|(k, v)| k == "q" && v.contains("newer_than:90d")))
}
#[test]
fn duplicate_history_and_pagination_fetch_once() {
    let c = db();
    let mut a = store::account(&c).unwrap().unwrap();
    a.history_id = Some("100".into());
    let mut api = FakeApi::new(vec![
        (
            "history",
            Ok(
                json!({"historyId":"110","nextPageToken":"next","history":[{"messagesAdded":[{"message":{"id":"ab"}},{"message":{"id":"ab"}}]}]}),
            ),
        ),
        (
            "history",
            Ok(json!({"historyId":"120","history":[{"labelsRemoved":[{"message":{"id":"ab"}}]}]})),
        ),
        ("messages/ab", Ok(message("ab", "aa", "changed"))),
    ]);
    let b = sync::collect(&mut api, &a, &[]).unwrap();
    assert!(b.messages.len() == 1 && b.cursor == "120" && !b.full);
    assert!(api.calls.len() == 3)
}
#[test]
fn expired_cursor_reconciles_without_first_wiping_cache() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    let a = store::account(&c).unwrap().unwrap();
    let mut api = FakeApi::new(vec![
        ("history", Err(ApiError::NotFound)),
        ("profile", Ok(json!({"historyId":"200"}))),
        ("messages", Ok(json!({"messages":[]}))),
        ("messages/ab", Err(ApiError::NotFound)),
    ]);
    let b = sync::collect(&mut api, &a, &["ab".into()]).unwrap();
    assert!(b.fallback && b.full && b.deleted.len() == 1);
    assert!(store::search(&c, "closing", true).unwrap().len() == 1);
    store::commit(&mut c, &a, &b.messages, &b.deleted, &b.cursor, b.full, &[]).unwrap();
    assert!(store::search(&c, "closing", true).unwrap().is_empty());
    assert!(
        c.query_row("SELECT count(*) FROM gmail_messages", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 1
    )
}
#[test]
fn partial_api_failure_does_not_advance_cursor() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    let a = store::account(&c).unwrap().unwrap();
    let mut api = FakeApi::new(vec![
        (
            "history",
            Ok(json!({"historyId":"120","history":[{"messagesAdded":[{"message":{"id":"ac"}}]}]})),
        ),
        (
            "messages/ac",
            Err(ApiError::Other("gmail_network_unavailable".into())),
        ),
    ]);
    assert!(sync::collect(&mut api, &a, &[]).is_err());
    assert!(store::account(&c).unwrap().unwrap().history_id.as_deref() == Some("100"))
}
#[test]
fn transaction_failure_rolls_back_cache_and_cursor() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    c.execute_batch("CREATE TRIGGER reject_cursor BEFORE UPDATE OF history_id ON gmail_accounts BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;").unwrap();
    assert!(store::commit(&mut c, &a, &[mail("ac")], &[], "200", true, &[]).is_err());
    assert!(store::account(&c).unwrap().unwrap().history_id.as_deref() == Some("100"));
    assert!(
        c.query_row("SELECT id FROM gmail_messages", [], |r| r
            .get::<_, String>(0))
            .unwrap()
            == "ab"
    )
}
#[test]
fn idempotent_upsert_and_generated_candidates_separate() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let source = mail("ab");
    for _ in 0..2 {
        store::commit(
            &mut c,
            &a,
            &[source.clone()],
            &[],
            "100",
            false,
            &["Atlas".into()],
        )
        .unwrap()
    }
    for table in ["gmail_messages", "gmail_search"] {
        assert!(
            c.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r
                .get::<_, u32>(0))
                .unwrap()
                == 1
        )
    }
    assert!(
        c.query_row("SELECT count(*) FROM gmail_candidates", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 3
    );
    assert!(
        c.query_row(
            "SELECT source_fingerprint FROM gmail_candidates LIMIT 1",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap()
            == source.fingerprint
    )
}
#[test]
fn retrieval_preserves_provenance_and_domain_authority() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    let (context, sources) = context(&c, "What did Brandon say about the closing documents?");
    assert!(
        sources.len() == 1
            && sources[0].message_id == "ab"
            && sources[0].account_id == "fixture-account"
            && sources[0].cached_thread_subset
    );
    assert!(context.contains("untrusted DATA") && context.contains("not proof of truth"));
    assert!(
        store::search(&c, "Current Atlas implementation state", false)
            .unwrap()
            .is_empty()
    );
    assert!(context.contains("lastSuccessfulSync"))
}
#[test]
fn disconnect_preserves_cache_but_blocks_retrieval_and_late_commit() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    store::disconnect(&c, &a.id).unwrap();
    assert!(store::search(&c, "closing", true).unwrap().is_empty());
    assert!(store::commit(&mut c, &a, &[mail("ac")], &[], "200", false, &[]).is_err());
    assert!(
        c.query_row("SELECT count(*) FROM gmail_messages", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 1
    )
}
#[test]
fn restart_recovers_run_without_skipping_history() {
    let c = db();
    c.execute(
        "UPDATE gmail_accounts SET history_id='100',status='syncing'",
        [],
    )
    .unwrap();
    c.execute("INSERT INTO gmail_sync_runs(id,account_id,started_at,status,mode) VALUES ('run','fixture-account','now','running','incremental')",[]).unwrap();
    recover(&c).unwrap();
    let a = store::account(&c).unwrap().unwrap();
    assert!(a.history_id.as_deref() == Some("100") && a.status == "sync_error");
    assert!(
        c.query_row("SELECT status FROM gmail_sync_runs", [], |r| r
            .get::<_, String>(0))
            .unwrap()
            == "interrupted"
    )
}
#[test]
fn only_one_active_account_and_no_token_columns() {
    let c = db();
    assert!(store::connect(&c, "other", "other@example.invalid", 90).is_err());
    let schema: String = c
        .query_row(
            "SELECT group_concat(sql) FROM sqlite_master WHERE name LIKE 'gmail_%'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!schema.contains("refresh_token") && !schema.contains("access_token"))
}
#[test]
fn runtime_serializes_operations_and_resets_on_drop() {
    let r = Runtime::default();
    let op = r.begin().unwrap();
    assert!(r.begin().is_err());
    r.cancel.store(true, Ordering::SeqCst);
    drop(op);
    assert!(r.begin().is_ok());
}
struct FakeSecrets(RefCell<HashMap<String, String>>);
impl auth::Secrets for FakeSecrets {
    fn get(&self, a: &str) -> Result<String, String> {
        self.0
            .borrow()
            .get(a)
            .cloned()
            .ok_or("gmail_credential_missing".into())
    }
    fn set(&self, a: &str, v: &str) -> Result<(), String> {
        self.0.borrow_mut().insert(a.into(), v.into());
        Ok(())
    }
    fn delete(&self, a: &str) -> Result<(), String> {
        self.0.borrow_mut().remove(a);
        Ok(())
    }
}
#[test]
fn credential_store_contract_roundtrip_and_idempotent_delete() {
    let secrets = FakeSecrets(RefCell::new(HashMap::new()));
    assert!(secrets.get("a").is_err());
    secrets.set("a", "synthetic-opaque").unwrap();
    assert!(secrets.get("a").is_ok());
    secrets.delete("a").unwrap();
    secrets.delete("a").unwrap();
    assert!(secrets.get("a").is_err())
}

#[test]
fn secure_store_compensates_failed_account_commit() {
    let c = db();
    let secrets = FakeSecrets(RefCell::new(HashMap::new()));
    secrets.set("fixture-account", "synthetic-old").unwrap();
    c.execute_batch("CREATE TRIGGER refuse_connect BEFORE UPDATE ON gmail_accounts BEGIN SELECT RAISE(ABORT,'fixture failure'); END;").unwrap();
    assert!(auth::save_connection(
        &secrets,
        &c,
        "fixture-account",
        "operator@example.invalid",
        90,
        "synthetic-new"
    )
    .is_err());
    assert!(secrets.get("fixture-account").unwrap() == "synthetic-old");
}
#[test]
fn native_disconnect_contract_removes_secret_retains_snapshot() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    let secrets = FakeSecrets(RefCell::new(HashMap::new()));
    secrets.set(&a.id, "synthetic").unwrap();
    auth::disconnect(&secrets, &c, &a.id).unwrap();
    assert!(secrets.get(&a.id).is_err());
    assert!(!store::account(&c).unwrap().unwrap().enabled);
    assert!(
        c.query_row("SELECT count(*) FROM gmail_messages", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 1
    )
}
#[test]
fn sqlite_reopen_preserves_sources_and_cursor() {
    let path = std::env::temp_dir().join(format!(
        "olympus-gmail-fixture-{}.sqlite",
        auth::random().unwrap()
    ));
    {
        let mut c = Connection::open(&path).unwrap();
        c.execute_batch(include_str!("../../../schema.sql"))
            .unwrap();
        store::connect(&c, "fixture-account", "operator@example.invalid", 90).unwrap();
        let a = store::account(&c).unwrap().unwrap();
        store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    }
    {
        let c = Connection::open(&path).unwrap();
        let a = store::account(&c).unwrap().unwrap();
        assert!(a.history_id.as_deref() == Some("100"));
        let hits = store::search(&c, "closing documents", true).unwrap();
        assert!(hits.len() == 1 && hits[0].provider == "gmail" && !hits[0].fingerprint.is_empty());
    }
    std::fs::remove_file(path).unwrap();
}

#[test]
fn older_matching_message_remains_in_thread_context() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let mut all = Vec::new();
    for i in 0..7 {
        let mut m = mail(&format!("a{i}"));
        m.internal_date -= i * 1000;
        m.subject = "Generic".into();
        m.sender = "person@example.invalid".into();
        m.clean_text = if i == 6 {
            "rareword evidence".into()
        } else {
            "unrelated".into()
        };
        all.push(m)
    }
    store::commit(&mut c, &a, &all, &[], "100", true, &[]).unwrap();
    let hits = store::search(&c, "rareword", true).unwrap();
    assert!(
        hits.len() <= 4
            && hits
                .iter()
                .any(|m| m.message_id == "a6" && m.excerpt.contains("rareword"))
    );
}
#[test]
fn explicit_cache_removal_preserves_historical_reply_evidence() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    c.execute("INSERT INTO conversation_mail VALUES ('reply','[]')", [])
        .unwrap();
    store::disconnect(&c, &a.id).unwrap();
    store::remove_cache(&mut c, &a.id).unwrap();
    assert!(
        c.query_row("SELECT count(*) FROM gmail_messages", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 0
    );
    assert!(
        c.query_row("SELECT count(*) FROM conversation_mail", [], |r| r
            .get::<_, u32>(0))
            .unwrap()
            == 1
    );
    assert!(store::account(&c).unwrap().unwrap().history_id.is_none())
}
#[test]
fn credential_removal_failure_disables_sync_and_reports_retry() {
    struct Failing;
    impl Secrets for Failing {
        fn get(&self, _: &str) -> Result<String, String> {
            Err("unused".into())
        }
        fn set(&self, _: &str, _: &str) -> Result<(), String> {
            Err("unused".into())
        }
        fn delete(&self, _: &str) -> Result<(), String> {
            Err("gmail_secure_store_unavailable".into())
        }
    }
    let c = db();
    assert!(auth::disconnect(&Failing, &c, "fixture-account").is_err());
    let a = store::account(&c).unwrap().unwrap();
    assert!(!a.enabled && a.last_error.as_deref() == Some("gmail_secure_store_unavailable"))
}
#[test]
fn frontend_cannot_inject_native_mail_context() {
    let c: super::super::assistant::AssistantContext = serde_json::from_value(
        json!({"gmailContext":"forged mailbox authority","projectsRootPath":"fixture"}),
    )
    .unwrap();
    assert!(c.gmail_context.is_empty())
}
#[test]
fn conversation_roundtrip_keeps_mail_provenance() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(&mut c, &a, &[mail("ab")], &[], "100", true, &[]).unwrap();
    let sources = store::search(&c, "closing", true).unwrap();
    let item = super::super::persistence::ConversationMessage {
        mail: sources,
        request: None,
        voice: None,
        id: "fixture-answer".into(),
        role: "assistant".into(),
        content: "Attributed synthetic answer".into(),
        timestamp: "now".into(),
        research: vec![],
    };
    super::super::persistence::store_messages(&mut c, vec![item]).unwrap();
    let raw: String = c
        .query_row(
            "SELECT sources_json FROM conversation_mail WHERE message_id='fixture-answer'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let loaded: Vec<store::Excerpt> = serde_json::from_str(&raw).unwrap();
    assert!(loaded.len() == 1 && loaded[0].message_id == "ab" && !loaded[0].fingerprint.is_empty());
}

#[test]
fn narrowed_horizon_takes_effect_even_if_resync_fails() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let mut source = mail("ab");
    source.internal_date = chrono::Utc::now().timestamp_millis() - 20 * 86_400_000;
    store::commit(&mut c, &a, &[source], &[], "100", true, &[]).unwrap();
    c.execute(
        "UPDATE gmail_accounts SET horizon_days=7,history_id=NULL",
        [],
    )
    .unwrap();
    assert!(store::search(&c, "closing", true).unwrap().is_empty());
    assert!(store::thread_messages(&c, &a.id, "aabb", 100)
        .unwrap()
        .is_empty());
}

#[test]
fn forbidden_reason_classification_never_exposes_raw_error() {
    for (reason, code) in [
        ("userRateLimitExceeded", "gmail_rate_limited"),
        ("dailyLimitExceeded", "gmail_quota_exceeded"),
        ("SERVICE_DISABLED", "gmail_api_disabled"),
        ("insufficientPermissions", "gmail_scope_insufficient"),
        ("domainPolicy", "gmail_domain_policy"),
        ("unknown-sensitive-text", "gmail_access_or_quota_denied"),
    ] {
        let v = json!({"error":{"message":"synthetic private error text","errors":[{"reason":reason}]}});
        assert!(auth::forbidden_code(&v) == code);
    }
    assert!(
        auth::forbidden_code(&json!({"error":{"details":[{"reason":"SERVICE_DISABLED"}]}}))
            == "gmail_api_disabled"
    );
}

#[test]
fn rate_backoff_respects_server_delay_and_bounds_wait() {
    assert!(auth::retry_delay(0, None).unwrap().as_secs() == 5);
    assert!(auth::retry_delay(1, None).unwrap().as_secs() == 10);
    assert!(auth::retry_delay(0, Some(30)).unwrap().as_secs() == 30);
    assert!(auth::retry_delay(0, Some(300)).is_err());
}
#[test]
fn communications_counts_filters_bounds_and_fingerprint_match() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    let mut mails = vec![mail("aa"), mail("bb"), mail("cc")];
    mails[1].labels = vec!["SENT".into()];
    mails[1].thread_id = "bbbb".into();
    mails[2].internal_date = now - 8 * 86_400_000;
    store::commit(&mut c, &a, &mails, &[], "200", true, &["Atlas".into()]).unwrap();
    let v = communications::workspace(&c, 7, "inbox", "", 0, now + 1000).unwrap();
    assert_eq!(v["total"], 2);
    assert_eq!(v["inbox"], 1);
    assert_eq!(v["sent"], 1);
    assert_eq!(v["threads"], 2);
    assert_eq!(v["attention"], 1);
    assert_eq!(v["actions"], 1);
    assert_eq!(v["deadlines"], 1);
    assert_eq!(v["people"][0]["count"], 1);
    assert_eq!(
        v["activity"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["received"].as_u64().unwrap() + d["sent"].as_u64().unwrap())
            .sum::<u64>(),
        2
    );
    assert!(v["rows"][0].get("canonicalText").is_none());
    assert!(v["comparison"].is_null());
    assert_eq!(
        communications::workspace(&c, 7, "people", "nobody", 0, now + 1000).unwrap()["matches"],
        0
    );
    assert_eq!(
        communications::workspace(&c, 7, "actions", "", 1, now + 1000).unwrap()["rows"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
    c.execute("UPDATE gmail_candidates SET source_fingerprint='stale'", [])
        .unwrap();
    assert_eq!(
        communications::workspace(&c, 7, "attention", "", 0, now + 1000).unwrap()["attention"],
        0
    );
    c.execute("UPDATE gmail_accounts SET horizon_days=7", [])
        .unwrap();
    assert_eq!(
        communications::workspace(&c, 90, "inbox", "", 0, now + 1000).unwrap()["days"],
        7
    );
    store::disconnect(&c, &a.id).unwrap();
    assert!(communications::workspace(&c, 7, "inbox", "", 0, now).is_err());
}
#[test]
fn communications_explicit_thread_scope_preserves_provenance() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let mut mails = Vec::new();
    for i in 0..6 {
        mails.push(mail(&format!("a{i}")))
    }
    store::commit(&mut c, &a, &mails, &[], "200", true, &[]).unwrap();
    let result = store::search(&c, "Summarize Gmail [Gmail thread: aabb]", false).unwrap();
    assert_eq!(result.len(), 4);
    assert!(result
        .iter()
        .all(|e| e.thread_id == "aabb" && !e.fingerprint.is_empty()));
    assert!(
        store::search(&c, "Summarize Gmail [Gmail thread: deadbeef]", false)
            .unwrap()
            .is_empty()
    );
}
#[test]
fn communications_workspace_question_uses_local_counts_and_bounded_evidence() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    store::commit(
        &mut c,
        &a,
        &[mail("aa")],
        &[],
        "200",
        true,
        &["Atlas".into()],
    )
    .unwrap();
    let (packet, sources) = context(&c, "[Gmail workspace] What needs my attention?");
    assert!(packet.contains("sevenDaySourceAnalyticsAndCandidateCounts"));
    assert!(packet.contains("\"total\":1"));
    assert_eq!(sources.len(), 1);
    assert_eq!(sources[0].message_id, "aa");
    let (packet, _) = context(
        &c,
        "[Gmail workspace] Who has emailed me the most this week?",
    );
    assert!(packet.contains("Brandon"));
}
#[test]
fn communication_preview_uses_provider_snippet_without_rewriting_evidence() {
    let mut c = db();
    let a = store::account(&c).unwrap().unwrap();
    let mut rental = mail("fa");
    rental.canonical_text = "[View receipt](https://rental.example.invalid/tracking)".into();
    rental.clean_text = rental.canonical_text.clone();
    rental.snippet = "Your rental receipt is ready &amp; available".into();
    let mut literal = mail("fb");
    literal.snippet = "Literal [text](https://example.invalid) <angle>".into();
    store::commit(
        &mut c,
        &a,
        &[rental.clone(), literal],
        &[],
        "200",
        true,
        &["Atlas".into()],
    )
    .unwrap();
    let v = communications::workspace(
        &c,
        7,
        "inbox",
        "",
        0,
        chrono::Utc::now().timestamp_millis() + 1000,
    )
    .unwrap();
    let rows = v["rows"].as_array().unwrap();
    assert_eq!(
        rows.iter().find(|r| r["id"] == "fa").unwrap()["preview"],
        "Your rental receipt is ready & available"
    );
    assert_eq!(
        rows.iter().find(|r| r["id"] == "fb").unwrap()["preview"],
        "Literal [text](https://example.invalid) <angle>"
    );
    assert_eq!(
        store::thread_messages(&c, &a.id, "aabb", 100)
            .unwrap()
            .iter()
            .find(|r| r.id == "fa")
            .unwrap()
            .canonical_text,
        rental.canonical_text
    );
    assert!(!v["signals"].as_array().unwrap().is_empty());
}
#[test]
fn intelligence_real_cache_graph_retains_evidence_and_fails_closed_on_missing_project_context(){
 use super::intelligence::{analyze,Request};
 let mut c=db();let a=store::account(&c).unwrap().unwrap();let source=mail("ab");let source_fingerprint=source.fingerprint.clone();store::commit(&mut c,&a,&[source],&[],"100",true,&["Atlas".into()]).unwrap();
 let root=std::env::temp_dir().join(format!("olympus-intelligence-test-{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
 std::fs::create_dir_all(root.join("01 - Projects")).unwrap();
 std::fs::write(root.join("01 - Projects/Atlas.md"),"---\ntype: project\nstatus: active\nname: Atlas\nvision: Review closing documents\n---\n").unwrap();
 let r=analyze(&c,&root,Request{id:"complete".into(),days:7}).unwrap();assert_eq!(r["status"],"completed");assert_eq!(r["items"].as_array().unwrap().len(),1);assert_eq!(r["items"][0]["recommendation"]["disposition"],"verify");assert_eq!(r["items"][0]["project"]["state"],"suggested");assert_eq!(r["items"][0]["recommendation"]["evidenceRefs"][0]["fingerprint"],source_fingerprint);
 let loops:i64=c.query_row("SELECT count(*) FROM communication_events WHERE run_id='complete' AND state='iteration'",[],|r|r.get(0)).unwrap();assert_eq!(loops,0);
 let failed=analyze(&c,&root.join("missing"),Request{id:"failure".into(),days:7}).unwrap();assert_eq!(failed["status"],"failed");assert_eq!(failed["items"],json!([]));
 let brief_success:i64=c.query_row("SELECT count(*) FROM communication_events WHERE run_id='failure' AND node='synthesize' AND state='completed'",[],|r|r.get(0)).unwrap();assert_eq!(brief_success,0);
 // Fixture directory is uniquely created by this test and contains synthetic data only.
 std::fs::remove_dir_all(root).unwrap();
}
