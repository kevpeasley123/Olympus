use super::super::assessment_v3 as assessment;
use super::*;
use crate::commands::{models, responses};
pub const GRAPH: &str = "communication-intelligence/v3";
fn graph() -> Vec<GraphNode> {
    let mut nodes = definition();
    for node in &mut nodes {
        if node.id == "assess" {
            node.kind = "communication-assess@2".into();
            node.max_iterations = 3;
        }
    }
    nodes
}
fn guard(c: &Connection, account: &str, days: u32, stamp: &str) -> Result<(), String> {
    let current = store::account(c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected")?;
    if current.id != account || current.horizon_days < days {
        return Err("intelligence_scope_changed".into());
    }
    if signature(c, account)? != stamp {
        return Err("intelligence_cache_changed".into());
    }
    Ok(())
}
fn trace(c: &Connection, id: &str, node: &str, state: &str, value: Value) -> Result<(), String> {
    event(c, id, node, state, value)
}
pub async fn run(db: &Db, root: &Path, request: Request) -> Result<Value, String> {
    run_with(db, root, request, |input, mut record| async move {
        let route = models::resolve(models::Capability::Primary);
        let output = responses::structured(
            &route,
            assessment::INSTRUCTIONS,
            input,
            assessment::schema(),
            &mut record,
        )
        .await;
        (output, record)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }
    fn fixture() -> (Db, std::path::PathBuf) {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../../schema.sql"))
            .unwrap();
        store::connect(&c, "fixture", "operator@example.invalid", 7).unwrap();
        let root = std::env::temp_dir().join(format!(
            "olympus-v3-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap()
        ));
        std::fs::create_dir_all(root.join("01 - Projects")).unwrap();
        (Db(std::sync::Mutex::new(c)), root)
    }
    fn mail(db: &Db, id: &str, thread: &str, text: &str, offset: i64) {
        let date = Utc::now().timestamp_millis() - offset;
        let snapshot = json!({"provider":"gmail","accountId":"fixture","id":id,"threadId":thread,"historyId":"1","sender":"fixture@example.invalid","recipients":"operator@example.invalid","cc":"","subject":"Delivery update","internalDate":date,"rfcMessageId":"","inReplyTo":"","references":"","labels":["INBOX"],"canonicalText":text,"cleanText":text,"snippet":"Fixture","attachments":[],"retrievedAt":now(),"bodyStatus":"text_available","fingerprint":format!("hash-{id}")});
        db.0.lock()
            .unwrap()
            .execute(
                "INSERT INTO gmail_messages VALUES('fixture',?1,?2,?3,1,1,?4,?5)",
                params![id, thread, date, format!("hash-{id}"), snapshot.to_string()],
            )
            .unwrap();
    }
    fn request(id: &str) -> Request {
        Request {
            id: id.into(),
            days: 7,
        }
    }
    fn response(input: &Value, expansion: &str) -> String {
        json!({"assessments":input["threads"].as_array().unwrap().iter().map(|thread|{
            let i:skill::ThreadInput=serde_json::from_value(thread["thread"].clone()).unwrap();
            let missing=expansion!="none";
            json!({"threadId":i.messages[0].evidence.thread_id,"whatHappened":"Delivery update arrived.","whatChanged":"The delivery is earlier.","operatorImpact":"Fixture interpretation.","attention":if missing{"uncertain"}else{"background"},"priority":"low","recommendation":if missing{"verify"}else{"no_action"},"recommendedNextMove":"No response needed if the earlier date works.","evidenceRefs":i.refs(),"evidenceState":if missing{"insufficient"}else{"sufficient"},"missingContextReason":if missing{json!("Need the previous delivery date.")}else{Value::Null},"expansion":expansion})
        }).collect::<Vec<_>>()}).to_string()
    }
    #[test]
    fn genuine_loop_expands_then_stops_with_background_and_receipts() {
        let (db, root) = fixture();
        for n in 0..4 {
            mail(
                &db,
                &format!("m{n}"),
                "thread",
                &"x".repeat(1800),
                4000 - n * 1000,
            );
        }
        let mut calls = 0;
        let result = runtime()
            .block_on(run_with(
                &db,
                &root,
                request("loop"),
                |input, mut record| {
                    calls += 1;
                    let expansion = match calls {
                        1 => "older_messages",
                        2 => "fuller_excerpt",
                        _ => "none",
                    };
                    assert_eq!(input["threads"].as_array().unwrap().len(), 1);
                    let messages = input["threads"][0]["thread"]["messages"]
                        .as_array()
                        .unwrap();
                    assert_eq!(messages.len(), if calls == 1 { 2 } else { 4 });
                    assert_eq!(
                        messages[0]["text"].as_str().unwrap().len(),
                        if calls < 3 { 1000 } else { 1800 }
                    );
                    record.status = "completed".into();
                    record.actual_model = Some("fixture-model".into());
                    record.usage = Some(json!({"input_tokens":42}));
                    std::future::ready((Ok(response(&input, expansion)), record))
                },
            ))
            .unwrap();
        assert_eq!(calls, 3);
        assert_eq!(result["status"], "completed");
        assert_eq!(
            result["items"][0]["recommendation"]["disposition"],
            "no_action"
        );
        assert_eq!(result["items"][0]["stopReason"], "evidence_sufficient");
        assert_eq!(result["usage"].as_array().unwrap().len(), 3);
        assert_eq!(
            result["items"][0]["recommendation"]["evidenceRefs"]
                .as_array()
                .unwrap()
                .len(),
            4
        );
        assert_eq!(
            db.0.lock()
                .unwrap()
                .query_row("SELECT count(*) FROM model_requests", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            3
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn loop_without_new_evidence_stops_uncertain_and_never_no_action() {
        let (db, root) = fixture();
        mail(&db, "m", "thread", "Short fixture", 1000);
        let mut calls = 0;
        let result = runtime()
            .block_on(run_with(
                &db,
                &root,
                request("no-context"),
                |input, mut record| {
                    calls += 1;
                    record.status = "completed".into();
                    std::future::ready((Ok(response(&input, "older_messages")), record))
                },
            ))
            .unwrap();
        assert_eq!(calls, 1);
        assert_eq!(result["items"][0]["stopReason"], "no_new_evidence");
        assert_eq!(
            result["items"][0]["assessment"]["evidenceState"],
            "insufficient"
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn changed_cache_or_disconnect_during_inference_withholds_brief_without_locking_db() {
        for disconnect in [false, true] {
            let (db, root) = fixture();
            mail(&db, "m", "thread", "Short fixture", 1000);
            let result = runtime()
                .block_on(run_with(
                    &db,
                    &root,
                    request("changed"),
                    |input, mut record| {
                        let c = db.0.try_lock().expect("No lock may cross inference");
                        c.execute(
                            if disconnect {
                                "UPDATE gmail_accounts SET enabled=0"
                            } else {
                                "UPDATE gmail_messages SET fingerprint='changed'"
                            },
                            [],
                        )
                        .unwrap();
                        record.status = "completed".into();
                        std::future::ready((Ok(response(&input, "none")), record))
                    },
                ))
                .unwrap();
            assert_eq!(result["status"], "failed");
            assert_eq!(result["items"], json!([]));
            std::fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn invalid_model_result_fails_closed_and_preserves_history() {
        let (db, root) = fixture();
        mail(&db, "m", "thread", "Short fixture", 1000);
        let result = runtime()
            .block_on(run_with(&db, &root, request("invalid"), |_, mut record| {
                record.status = "completed".into();
                std::future::ready((Ok("{}".into()), record))
            }))
            .unwrap();
        assert_eq!(result["status"], "failed");
        assert_eq!(result["items"], json!([]));
        assert_eq!(
            result["usage"][0]["errorCode"],
            "assessment_contract_rejected"
        );
        let again = runtime()
            .block_on(run_with(&db, &root, request("invalid"), |_, _record| {
                panic!("Idempotent replay must not call model");
                #[allow(unreachable_code)]
                std::future::ready((Ok(String::new()), _record))
            }))
            .unwrap();
        assert_eq!(again, result);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn selection_is_bounded_and_includes_recent_unflagged_updates() {
        let (db, root) = fixture();
        for n in 0..10 {
            mail(&db, &format!("m{n}"), &format!("t{n}"), "Receipt", 1000 + n);
        }
        let c = db.0.lock().unwrap();
        let chosen = selected(&c, "fixture", 7, Utc::now().timestamp_millis(), true).unwrap();
        assert_eq!(chosen.len(), 6);
        assert_eq!(chosen[0].messages[0].evidence.thread_id, "t0");
        drop(c);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn third_pass_cannot_expand_again_and_feedback_is_scoped() {
        let (db, root) = fixture();
        for n in 0..4 {
            mail(
                &db,
                &format!("m{n}"),
                "t",
                &"x".repeat(1800),
                4000 - n * 1000,
            );
        }
        let mut calls = 0;
        let result = runtime()
            .block_on(run_with(
                &db,
                &root,
                request("budget"),
                |input, mut record| {
                    calls += 1;
                    record.status = "completed".into();
                    std::future::ready((
                        Ok(response(
                            &input,
                            if calls == 2 {
                                "older_messages"
                            } else {
                                "fuller_excerpt"
                            },
                        )),
                        record,
                    ))
                },
            ))
            .unwrap();
        assert_eq!(calls, 3);
        assert_eq!(result["status"], "completed");
        assert_eq!(result["items"][0]["stopReason"], "pass_budget_exhausted");
        assert_eq!(result["items"][0]["triage"]["attention"], "uncertain");
        let c = db.0.lock().unwrap();
        record_feedback(&c, "budget", "t", Feedback::MissedNeedsMe).unwrap();
        assert!(record_feedback(&c, "budget", "foreign", Feedback::Useful).is_err());
        c.execute("UPDATE gmail_accounts SET enabled=0", [])
            .unwrap();
        assert!(record_feedback(&c, "budget", "t", Feedback::Incorrect).is_err());
        assert_eq!(
            c.query_row("SELECT count(*) FROM communication_evaluations", [], |r| {
                r.get::<_, i64>(0)
            })
            .unwrap(),
            1
        );
        drop(c);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn empty_v3_run_and_historical_replay_never_call_model() {
        let (db, root) = fixture();
        let result = runtime()
            .block_on(run_with(&db, &root, request("empty-v3"), |_, record| {
                std::future::ready((Err("must not call".into()), record))
            }))
            .unwrap();
        assert_eq!(result["status"], "completed");
        assert_eq!(result["usage"], json!([]));
        assert_eq!(result["loop"]["passes"], 0);
        let historical = json!({"id":"old-v2","accountId":"fixture","requestedDays":7,"graph":"communication-intelligence/v2","items":[]});
        db.0.lock()
            .unwrap()
            .execute(
                "INSERT INTO communication_runs VALUES('old-v2','fixture',7,'completed',?1)",
                [historical.to_string()],
            )
            .unwrap();
        let result = runtime()
            .block_on(run_with(&db, &root, request("old-v2"), |_, record| {
                std::future::ready((Err("must not call".into()), record))
            }))
            .unwrap();
        assert_eq!(result, historical);
        std::fs::remove_dir_all(root).unwrap();
    }
}
async fn run_with<F, Fut>(
    db: &Db,
    root: &Path,
    request: Request,
    mut infer: F,
) -> Result<Value, String>
where
    F: FnMut(Value, models::RequestRecord) -> Fut,
    Fut: std::future::Future<Output = (Result<String, String>, models::RequestRecord)>,
{
    if request.id.is_empty()
        || request.id.len() > 80
        || !request
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
        || ![7, 30, 90, 180, 365].contains(&request.days)
    {
        return Err("invalid_intelligence_request".into());
    }
    let time = Utc::now().timestamp_millis();
    let started = std::time::Instant::now();
    let (account, days, mut run) = {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        let account = store::account(&c)?
            .filter(|a| a.enabled)
            .ok_or("gmail_not_connected")?;
        let old: Option<String> = c
            .query_row(
                "SELECT payload_json FROM communication_runs WHERE id=?1",
                [&request.id],
                |r| r.get(0),
            )
            .optional()
            .map_err(err)?;
        if let Some(old) = old {
            let value: Value = serde_json::from_str(&old).map_err(err)?;
            if value["accountId"] != account.id || value["requestedDays"] != request.days {
                return Err("intelligence_request_id_conflict".into());
            }
            return Ok(value);
        }
        let days = request.days.min(account.horizon_days);
        let value = json!({"id":request.id,"accountId":account.id,"graph":GRAPH,"definition":graph(),"skills":skill::registry(),"requestedDays":request.days,"days":days,"status":"running","startedAt":now(),"finishedAt":null,"durationMs":null,"model":models::PRIMARY_MODEL,"usage":[],"items":[],"error":null,"stale":false,"loop":{"maxPasses":3,"passes":0},"selectionPolicy":"up to four flagged threads first, then most recent remaining threads; six-thread cap"});
        c.execute("INSERT INTO communication_runs(id,account_id,days,status,payload_json) VALUES(?1,?2,?3,'running',?4)",params![request.id,account.id,days,value.to_string()]).map_err(err)?;
        (account.id, days, value)
    };
    let mut active = "snapshot";
    let result:Result<Vec<Value>,String>=async{
        let (stamp,inputs,catalog)={
            let c=db.0.lock().map_err(|_|"database_busy")?;
            trace(&c,&request.id,"snapshot","running",json!({}))?;
            let stamp=signature(&c,&account)?;
            let counts=super::super::communications::workspace(&c,days,"attention","",0,time)?;
            run["snapshot"]=json!({"signature":stamp,"cachedThreads":counts["threads"],"cachedMessages":counts["total"],"candidateMessages":counts["attention"]});
            trace(&c,&request.id,"snapshot","completed",run["snapshot"].clone())?;
            active="select";
            trace(&c,&request.id,"select","running",json!({}))?;
            let inputs=selected(&c,&account,days,time,true)?;
            run["selectedThreads"]=json!(inputs.len());
            trace(&c,&request.id,"select","completed",json!({"selectedThreads":inputs.len(),"threadLimit":6,"messageLimitPerThread":4,"textLimitPerMessage":2000,"policy":run["selectionPolicy"],"evidenceRefs":inputs.iter().flat_map(|i|i.refs()).collect::<Vec<_>>()}))?;
            active="project";
            trace(&c,&request.id,"project","running",json!({"method":"bounded_name_alias_match"}))?;
            let catalog=if inputs.is_empty(){vec![]}else{projects(root)?};
            run["projectSignature"]=if inputs.is_empty(){Value::Null}else{json!(project_signature(&catalog))};
            trace(&c,&request.id,"project","catalog_snapshot",json!({"sources":catalog,"method":"bounded_name_alias_match","discoveryIterations":0}))?;
            (stamp,inputs,catalog)
        };
        let mut contexts=inputs.into_iter().map(assessment::Context::new).collect::<Result<Vec<_>,_>>()?;
        let mut pending=(0..contexts.len()).collect::<Vec<_>>();
        let mut results:Vec<Option<assessment::Assessment>>=vec![None;contexts.len()];
        let mut stops=vec![String::new();contexts.len()];
        active="assess";
        {let c=db.0.lock().map_err(|_|"database_busy")?;trace(&c,&request.id,"assess","running",json!({"skill":"communication-assess@2","maxPasses":3,"model":models::PRIMARY_MODEL}))?;}
        for pass in 1..=3 {
            if pending.is_empty(){break;}
            {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&account,days,&stamp)?;}
            if started.elapsed().as_secs()>=185 {return Err("assessment_run_deadline".into())}
            let visible=pending.iter().map(|&i|contexts[i].visible.clone()).collect::<Vec<_>>();
            let batch=pending.iter().map(|&i|{
                let context=&contexts[i];
                let relevance=crate::commands::project_relevance::match_projects(&skill::artifact(&context.visible)?,&catalog)?;
                Ok(json!({"thread":context.visible,"availableExpansion":context.availability(),"projectSuggestions":relevance}))
            }).collect::<Result<Vec<_>,String>>()?;
            let route=models::resolve(models::Capability::Primary);
            let mut record=models::RequestRecord::new(&route,"communication_assessment");
            models::save(db,&record)?;
            {let c=db.0.lock().map_err(|_|"database_busy")?;trace(&c,&request.id,"assess","pass_started",json!({"pass":pass,"requestId":record.id,"evidenceRefs":visible.iter().map(|i|i.refs()).collect::<Vec<_>>(),"excerptFingerprints":visible.iter().map(|i|content_fingerprint(&json!(i).to_string())).collect::<Vec<_>>(),"characters":visible.iter().flat_map(|i|&i.messages).map(|m|m.text.chars().count()).sum::<usize>()}))?;}
            // No database lock crosses this network await. Only explicitly selected excerpts leave Rust.
            let (output,returned)=infer(json!({"snapshotTime":time,"threads":batch}),record).await;
            record=returned;
            let parsed=output.and_then(|raw|assessment::parse(&raw,&visible));
            if parsed.is_err() && record.status=="completed" {record.status="failed".into();record.error_code=Some("assessment_contract_rejected".into());}
            models::save(db,&record)?;
            run["usage"].as_array_mut().unwrap().push(json!(record));
            run["loop"]["passes"]=json!(pass);
            {let c=db.0.lock().map_err(|_|"database_busy")?;trace(&c,&request.id,"assess","model_result",json!({"pass":pass,"request":record}))?;guard(&c,&account,days,&stamp)?;}
            let parsed=parsed?;
            let mut next=Vec::new();
            for (&index,a) in pending.iter().zip(parsed) {
                let decision=if a.evidence_state=="sufficient" {"evidence_sufficient"}
                    else if pass==3 {"pass_budget_exhausted"}
                    else if a.expansion=="none" {"context_unavailable"}
                    else if contexts[index].expand(&a.expansion) {next.push(index);"expanded"}
                    else {"no_new_evidence"};
                let c=db.0.lock().map_err(|_|"database_busy")?;
                trace(&c,&request.id,"assess","iteration",json!({"pass":pass,"threadId":a.thread_id,"assessment":a,"stopReason":decision,"nextEvidenceRefs":contexts[index].visible.refs()}))?;
                stops[index]=decision.into();results[index]=Some(a);
            }
            pending=next;
        }
        let c=db.0.lock().map_err(|_|"database_busy")?;
        guard(&c,&account,days,&stamp)?;
        trace(&c,&request.id,"assess","completed",json!({"passes":run["loop"]["passes"],"assessedThreads":results.len(),"stopReasons":stops}))?;
        active="project";
        if run["projectSignature"].is_string() && run["projectSignature"]!=project_signature(&projects(root)?) {return Err("project_context_changed_during_run".into())}
        let relevance=contexts.iter().map(|i|crate::commands::project_relevance::match_projects(&skill::artifact(&i.visible)?,&catalog)).collect::<Result<Vec<_>,String>>()?;
        trace(&c,&request.id,"project","completed",json!(relevance))?;
        active="synthesize";
        trace(&c,&request.id,"synthesize","running",json!({"policy":"validated assessment; needs_you then uncertainty then background"}))?;
        let mut items=Vec::new();
        for (((context,result),project),stop) in contexts.iter().zip(results).zip(relevance).zip(stops) {
            let a=result.ok_or("join_missing_branch_output")?;
            let refs=context.visible.refs();
            let expected=skill::artifact(&context.visible)?.parts.into_iter().map(|p|p.source).collect::<Vec<_>>();
            if json!(a.evidence_refs)!=json!(refs) || project.evidence_refs!=expected {return Err("join_source_identity_mismatch".into())}
            let last=context.visible.messages.last().unwrap();
            items.push(json!({"threadId":a.thread_id,"subject":last.subject,"sender":last.sender,"assessment":a,"stopReason":stop,
                "triage":{"attention":a.attention,"summary":a.operator_impact,"reasonCodes":[],"evidenceRefs":refs},
                "summary":{"whatHappened":a.what_happened,"whatChanged":a.what_changed,"whatMatters":a.operator_impact,"evidenceRefs":refs},
                "project":project,"recommendation":{"disposition":a.recommendation,"guidance":a.recommended_next_move,"priority":a.priority,"evidenceRefs":refs}}));
        }
        items.sort_by_key(|i|(match i["triage"]["attention"].as_str(){Some("needs_you")=>0,Some("uncertain")=>1,_=>2},match i["recommendation"]["priority"].as_str(){Some("high")=>0,Some("normal")=>1,_=>2}));
        trace(&c,&request.id,"synthesize","completed",json!({"items":items,"selectedThreads":contexts.len(),"wholeMailboxAssessment":false}))?;
        Ok(items)
    }.await;
    let c = db.0.lock().map_err(|_| "database_busy")?;
    match result {
        Ok(items) => {
            run["items"] = json!(items);
            run["status"] = json!("completed");
        }
        Err(error) => {
            run["status"] = json!("failed");
            run["error"] = json!(error);
            trace(
                &c,
                &request.id,
                active,
                "failed",
                json!({"error":error,"stopReason":"failed_closed"}),
            )?;
            for n in graph() {
                if n.id != active {
                    let complete:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM communication_events WHERE run_id=?1 AND node=?2 AND state='completed')",params![request.id,n.id],|r|r.get(0)).map_err(err)?;
                    if !complete {
                        trace(
                            &c,
                            &request.id,
                            &n.id,
                            "stopped",
                            json!({"stopReason":"upstream_failure"}),
                        )?;
                    }
                }
            }
        }
    }
    run["finishedAt"] = json!(now());
    run["durationMs"] = json!(started.elapsed().as_millis() as u64);
    c.execute(
        "UPDATE communication_runs SET status=?2,payload_json=?3 WHERE id=?1",
        params![request.id, run["status"].as_str(), run.to_string()],
    )
    .map_err(err)?;
    Ok(run)
}
