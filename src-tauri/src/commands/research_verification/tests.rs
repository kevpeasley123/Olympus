use super::*;
use std::path::PathBuf;
use std::sync::Mutex;

struct Fixture {
    responses: Mutex<Vec<Value>>,
    fail: bool,
    cancel: bool,
}
impl Model for Fixture {
    fn call<'a>(
        &'a self,
        _: &'a AgentDefinition,
        _: Value,
        record: &'a mut RequestRecord,
    ) -> ModelFuture<'a> {
        Box::pin(async move {
            if self.cancel {
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
            if self.fail {
                return Err("fixture_agent_failure".into());
            }
            record.status = "completed".into();
            record.actual_model = Some("fixture-model".into());
            record.latency_ms = Some(10);
            Ok(self.responses.lock().unwrap().remove(0).to_string())
        })
    }
}
fn fixture(values: Vec<Value>) -> Fixture {
    Fixture {
        responses: Mutex::new(values),
        fail: false,
        cancel: false,
    }
}
fn setup() -> (Db, PathBuf, Run) {
    let c = rusqlite::Connection::open_in_memory().unwrap();
    recover(&c).unwrap();
    c.execute_batch(include_str!("../../../schema.sql"))
        .unwrap();
    let db = Db(Mutex::new(c));
    let root = std::env::temp_dir().join(format!(
        "olympus-research-test-{}",
        models::RequestRecord::new(&models::resolve(models::Capability::Primary), "fixture").id
    ));
    std::fs::create_dir_all(root.join("02 - Research")).unwrap();
    for i in 0..4 {
        std::fs::write(root.join(format!("02 - Research/{i}.md")),format!("---\ntitle: Agent research {i}\ntags: [olympus/research]\nstance: provisional\n---\nIndependent verification can detect unsupported claims. More agent research evidence {i}.\n")).unwrap();
    }
    let (run, _) = begin(
        &db,
        Start {
            id: "fixture-run".into(),
            question: "agent research".into(),
        },
    )
    .unwrap();
    (db, root, run)
}
fn research(sources: &[Source]) -> ResearchOutput {
    ResearchOutput {
        claims: vec![Claim {
            id: "c1".into(),
            text: "Verification can detect unsupported claims.".into(),
            evidence: vec![citation(&sources[0])],
        }],
        contradictions: vec![],
        unanswered: vec![],
    }
}
fn citation(s: &Source) -> Citation {
    Citation {
        source_id: s.id.clone(),
        fingerprint: s.fingerprint.clone(),
        quote: "Independent verification can detect unsupported claims.".into(),
    }
}
fn verified(research: &ResearchOutput, status: Verdict, clarify: bool) -> VerificationOutput {
    VerificationOutput {
        findings: research
            .claims
            .iter()
            .map(|c| Finding {
                claim_id: c.id.clone(),
                status: status.clone(),
                explanation: "Fixture assessment against the supplied excerpt.".into(),
                evidence: if status == Verdict::Insufficient {
                    vec![]
                } else {
                    c.evidence.clone()
                },
            })
            .collect(),
        clarification: if clarify {
            Some(Clarification {
                question: "Additional agent research evidence?".into(),
                claim_ids: vec!["c1".into()],
            })
        } else {
            None
        },
    }
}
fn finish(db: &Db, root: &Path, run: Run, model: &dyn Model) -> Run {
    tauri::async_runtime::block_on(execute(db, root, run, model)).unwrap()
}
fn cleanup(root: PathBuf) {
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn definitions_are_roles_not_models_and_skills_grant_no_effects() {
    let mut r = definition(RESEARCH).unwrap();
    let v = definition(VERIFY).unwrap();
    assert_eq!((r.id.as_str(), r.version), ("research", 1));
    assert_eq!((v.id.as_str(), v.version), ("verification", 1));
    r.model_strategy = json!({"requestedModel":"other"});
    assert_eq!(r.id, "research");
    for d in [r, v] {
        assert_eq!(
            d.capabilities,
            vec!["read_parent_evidence", "structured_model_response"]
        );
        for p in [
            "source_write",
            "memory_write",
            "project_write",
            "approval",
            "policy_change",
        ] {
            assert!(d.prohibited_effects.contains(&p.to_string()));
        }
    }
    assert_eq!(skills().len(), 3);
    assert!(definition("candidate").is_err());
    assert!(available(false, true).is_err());
    assert!(available(true, false).is_err());
    assert!(available(true, true).is_ok());
}

#[test]
fn unavailable_start_is_blocked_before_any_run_or_request_is_created() {
    let (db, root, run) = setup();
    // Existing request identity is inspection, not a retry, even if credentials disappear.
    assert!(
        !prepare(
            &db,
            &root,
            Start {
                id: run.id,
                question: run.question
            },
            false
        )
        .unwrap()
        .1
    );
    assert!(prepare(
        &db,
        &root,
        Start {
            id: "new-request".into(),
            question: "agent research".into()
        },
        false
    )
    .unwrap_err()
    .contains("credentials"));
    assert!(prepare(
        &db,
        &root.join("missing"),
        Start {
            id: "new-request".into(),
            question: "agent research".into()
        },
        true
    )
    .unwrap_err()
    .contains("source"));
    let c = db.0.lock().unwrap();
    assert_eq!(
        c.query_row("SELECT count(*) FROM research_verification_runs", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        c.query_row("SELECT count(*) FROM model_requests", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    drop(c);
    assert!(serde_json::from_value::<Start>(json!({"id":"new-request","question":"test","allowedSources":["private"],"operatorApproval":true})).is_err());
    cleanup(root);
}

#[test]
fn final_save_cannot_overwrite_concurrent_cancellation() {
    let (db, root, mut run) = setup();
    run.status = "completed".into();
    event(&mut run, "join", "completed", "test");
    cancel(&db, &run.id).unwrap();
    assert_eq!(checkpoint(&db, &run).unwrap_err(), "cancelled");
    assert_eq!(load(&db, &run.id).unwrap().status, "running");
    cleanup(root);
}
#[test]
fn direct_flow_retains_separate_outputs_and_deterministic_brief() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let v = verified(&r, Verdict::Supported, false);
    let result = finish(&db, &root, run, &fixture(vec![json!(r), json!(v)]));
    assert_eq!(result.status, "completed");
    assert_eq!(result.agents.len(), 2);
    assert_eq!(result.messages.len(), 2);
    assert_eq!(result.brief.as_ref().unwrap().supported.len(), 1);
    assert_eq!(result.agents[0].output, Some(json!(r)));
    assert_ne!(result.agents[0].id, result.agents[1].id);
    assert_eq!(
        load(&db, &result.id).unwrap().agents[0].definition.version,
        1
    );
    let mut later = definition(RESEARCH).unwrap();
    later.version = 2;
    assert_eq!(
        load(&db, &result.id).unwrap().agents[0].definition.version,
        1
    );
    assert_eq!(
        std::fs::read_dir(root.join("02 - Research"))
            .unwrap()
            .count(),
        4
    );
    cleanup(root);
}

#[test]
fn catalog_reads_do_not_recover_or_mutate_runs_and_can_export_synthetic_ui_fixture() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let initial = verified(&r, Verdict::Insufficient, true);
    let final_result = verified(&r, Verdict::Supported, false);
    let result = finish(
        &db,
        &root,
        run,
        &fixture(vec![
            json!(r),
            json!(initial),
            json!(r),
            json!(final_result),
        ]),
    );
    assert_eq!(result.status, "completed");
    let changes = db.0.lock().unwrap().total_changes();
    let catalog = catalog(&db, &root, true).unwrap();
    assert_eq!(db.0.lock().unwrap().total_changes(), changes);
    assert_eq!(catalog["codingDelegate"]["completedRuns"], 0);
    assert_eq!(catalog["executable"].as_array().unwrap().len(), 2);
    assert_eq!(catalog["codingDelegate"]["version"], Value::Null);
    if let Ok(path) = std::env::var("OLYMPUS_RESEARCH_FIXTURE") {
        std::fs::write(
            path,
            serde_json::to_string_pretty(&json!({"catalog":catalog,"run":result})).unwrap(),
        )
        .unwrap();
    }
    cleanup(root);
}

#[test]
fn join_rechecks_correlation_output_identity_and_source_evidence() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let v = verified(&r, Verdict::Supported, false);
    let result = finish(&db, &root, run, &fixture(vec![json!(r), json!(v)]));
    assert_eq!(result.status, "completed");
    for case in 0..5 {
        let mut changed = result.clone();
        match case {
            0 => changed.messages.last_mut().unwrap().correlation = "stale".into(),
            1 => changed.agents[1].status = "failed".into(),
            2 => changed.messages.last_mut().unwrap().sender.run = "another-agent-run".into(),
            3 => changed.sources[0].fingerprint = "changed".into(),
            _ => changed.agents[1].output = Some(json!({"findings":[],"clarification":null})),
        }
        assert!(join(&changed, &r, &v, 0).is_err(), "case {case}");
    }
    cleanup(root);
}

#[test]
fn read_only_scope_ignores_nonresearch_and_does_not_modify_source_files() {
    let (db, root, run) = setup();
    std::fs::create_dir_all(root.join("04 - Projects")).unwrap();
    std::fs::write(
        root.join("04 - Projects/private.md"),
        "agent research secret material",
    )
    .unwrap();
    std::fs::write(
        root.join("02 - Research/not-tagged.md"),
        "---\ntags: [other]\n---\nagent research unapproved",
    )
    .unwrap();
    let before = std::fs::read(root.join("02 - Research/0.md")).unwrap();
    let sources = collect(&root, &run.question, &[]).unwrap();
    assert_eq!(sources.len(), 3);
    assert!(sources
        .iter()
        .all(|s| !s.source.source_file.contains("private")
            && !s.source.source_file.contains("not-tagged")));
    let r = research(&sources);
    let v = verified(&r, Verdict::Supported, false);
    let result = finish(&db, &root, run, &fixture(vec![json!(r), json!(v)]));
    assert_eq!(result.status, "completed");
    assert_eq!(
        std::fs::read(root.join("02 - Research/0.md")).unwrap(),
        before
    );
    assert_eq!(
        std::fs::read_to_string(root.join("04 - Projects/private.md")).unwrap(),
        "agent research secret material"
    );
    cleanup(root);
}
#[test]
fn clarification_is_one_real_round_and_history_is_not_rewritten() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let initial = verified(&r, Verdict::Insufficient, true);
    let final_result = verified(&r, Verdict::Supported, false);
    let result = finish(
        &db,
        &root,
        run,
        &fixture(vec![
            json!(r),
            json!(initial),
            json!(r),
            json!(final_result),
        ]),
    );
    assert_eq!(result.status, "completed");
    assert_eq!(result.agents.len(), 4);
    assert_eq!(result.sources.len(), 4);
    assert_eq!(result.messages.len(), 5);
    assert_eq!(result.agents[1].output, Some(json!(initial)));
    assert_eq!(result.evaluation["clarificationRoundsExecuted"], 1);
    assert_eq!(result.evaluation["insufficiencyResolved"], json!(["c1"]));
    cleanup(root);
}
#[test]
fn second_clarification_is_rejected_and_cannot_be_success() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let v = verified(&r, Verdict::Insufficient, true);
    let result = finish(
        &db,
        &root,
        run,
        &fixture(vec![json!(r), json!(v), json!(r), json!(v)]),
    );
    assert_eq!(result.status, "failed");
    assert!(result.brief.is_none());
    assert!(result.error.unwrap().contains("clarification"));
    cleanup(root);
}
#[test]
fn no_additional_sources_stops_with_insufficiency() {
    let (db, root, run) = setup();
    std::fs::remove_file(root.join("02 - Research/3.md")).unwrap();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let v = verified(&r, Verdict::Insufficient, true);
    let result = finish(&db, &root, run, &fixture(vec![json!(r), json!(v)]));
    assert_eq!(result.status, "insufficient");
    assert_eq!(result.agents.len(), 2);
    assert!(result.brief.unwrap().supported.is_empty());
    cleanup(root);
}
#[test]
fn failures_invalid_schema_and_forged_evidence_never_join() {
    for case in 0..3 {
        let (db, root, run) = setup();
        let mut r = research(&collect(&root, &run.question, &[]).unwrap());
        let model = match case {
            0 => Fixture {
                responses: Mutex::new(vec![]),
                fail: true,
                cancel: false,
            },
            1 => fixture(vec![json!({"claims":[],"approval":true})]),
            _ => {
                r.claims[0].evidence[0].fingerprint = "forged".into();
                fixture(vec![json!(r)])
            }
        };
        let result = finish(&db, &root, run, &model);
        assert_eq!(result.status, "failed");
        assert!(result.brief.is_none());
        assert_eq!(result.agents[0].status, "failed");
        cleanup(root);
    }
}
#[test]
fn unsupported_claims_cannot_enter_supported_answer() {
    let (db, root, run) = setup();
    let r = research(&collect(&root, &run.question, &[]).unwrap());
    let mut v = verified(&r, Verdict::Supported, false);
    v.findings[0].evidence.clear();
    assert!(validate_verification(&v, &r, &[], 0).is_err());
    let result = finish(
        &db,
        &root,
        run,
        &fixture(vec![
            json!(r),
            json!(verified(&r, Verdict::Insufficient, false)),
        ]),
    );
    assert_eq!(result.status, "insufficient");
    assert_eq!(result.brief.unwrap().insufficient.len(), 1);
    cleanup(root);
}
#[test]
fn cancel_propagates_into_inflight_agent_without_verification() {
    let (db, root, run) = setup();
    let result = tauri::async_runtime::block_on(async {
        let model = Fixture {
            responses: Mutex::new(vec![]),
            fail: false,
            cancel: true,
        };
        let task = execute(&db, &root, run, &model);
        let stop = async {
            tokio::time::sleep(Duration::from_millis(200)).await;
            cancel(&db, "fixture-run").unwrap();
        };
        futures_util::future::join(task, stop).await.0.unwrap()
    });
    assert_eq!(result.status, "cancelled");
    assert_eq!(result.agents.len(), 1);
    assert_eq!(result.agents[0].status, "cancelled");
    assert_eq!(
        result.agents[0].request.as_ref().unwrap().status,
        "cancelled"
    );
    assert!(result.brief.is_none());
    cleanup(root);
}
#[test]
fn deadlines_and_restart_never_fabricate_success_or_finish_time() {
    let (db, root, mut run) = setup();
    run.deadline = (Utc::now() - chrono::Duration::seconds(1)).to_rfc3339();
    let result = finish(&db, &root, run, &fixture(vec![]));
    assert_eq!(result.status, "timed_out");
    cleanup(root);
    let (db, root, mut run) = setup();
    child(&mut run, RESEARCH, 0);
    event(&mut run, "research", "pending", "test");
    checkpoint(&db, &run).unwrap();
    recover(&db.0.lock().unwrap()).unwrap();
    let result = load(&db, &run.id).unwrap();
    assert_eq!(result.status, "interrupted");
    assert!(result.finished_at.is_none());
    assert_eq!(result.agents[0].status, "interrupted");
    cleanup(root);
}
#[test]
fn changed_sources_and_claim_rewrites_are_rejected() {
    let (db, root, run) = setup();
    let sources = collect(&root, &run.question, &[]).unwrap();
    let r = research(&sources);
    let mut changed = r.clone();
    changed.claims[0].text = "A different claim".into();
    assert!(validate_research(&changed, &sources, Some(&r)).is_err());
    std::fs::write(root.join(&sources[0].source.source_file), "changed").unwrap();
    assert!(source_health(&root, &sources).is_err());
    assert!(read_source(&root, "02 - Research/../private.md").is_err());
    assert!(read_source(&root, "project.md").is_err());
    drop(db);
    cleanup(root);
}
#[test]
fn duplicate_identity_does_not_repeat_a_run_and_terminal_history_is_immutable() {
    let (db, root, run) = setup();
    assert!(
        !begin(
            &db,
            Start {
                id: run.id.clone(),
                question: run.question.clone()
            }
        )
        .unwrap()
        .1
    );
    assert!(begin(
        &db,
        Start {
            id: run.id.clone(),
            question: "other".into()
        }
    )
    .is_err());
    assert!(begin(
        &db,
        Start {
            id: "other-run".into(),
            question: run.question.clone()
        }
    )
    .is_err());
    cancel(&db, &run.id).unwrap();
    let mut result = finish(&db, &root, run, &fixture(vec![]));
    result.question = "overwrite".into();
    event(&mut result, "test", "overwrite", "test");
    assert!(checkpoint(&db, &result).is_err());
    assert_eq!(load(&db, &result.id).unwrap().question, "agent research");
    cleanup(root);
}
#[test]
fn message_validation_rejects_wrong_identity_edge_schema_correlation_duplicate_late_round_evidence_and_authority(
) {
    let (db, root, mut run) = setup();
    run.sources = collect(&root, &run.question, &[]).unwrap();
    let r = research(&run.sources);
    let ri = child(&mut run, RESEARCH, 0);
    let vi = child(&mut run, VERIFY, 0);
    let sender = endpoint(&run, ri);
    let recipient = endpoint(&run, vi);
    run.agents[ri].status = "completed".into();
    run.agents[ri].output = Some(json!(r));
    let ids = run.sources.iter().map(|s| s.id.clone()).collect();
    send(
        &mut run,
        sender.clone(),
        recipient.clone(),
        0,
        Packet::EvidencePacket {
            research: r,
            source_ids: ids,
        },
    )
    .unwrap();
    let original = run.messages.pop().unwrap();
    for case in 0..10 {
        let mut m = original.clone();
        match case {
            0 => m.sender.agent = "coding".into(),
            1 => m.recipient.run = "wrong".into(),
            2 => {
                m.packet = Packet::ClarificationRequest(Clarification {
                    question: "test".into(),
                    claim_ids: vec!["c1".into()],
                })
            }
            3 => m.correlation = "old".into(),
            4 => m.id = "duplicate".into(),
            5 => m.at = (Utc::now() + chrono::Duration::seconds(500)).to_rfc3339(),
            6 => m.round = 2,
            7 => m.evidence.clear(),
            8 => m.requested_action = "approve_write".into(),
            _ => m.sender.version = 2,
        };
        assert!(
            validate_message(&run, &m, &sender, &recipient, 0).is_err(),
            "case {case}"
        );
    }
    let mut forged = json!(original);
    forged["operatorApproval"] = json!(true);
    assert!(serde_json::from_value::<Message>(forged).is_err());
    assert!(serde_json::from_value::<Packet>(json!({"type":"ExecuteTool","data":{}})).is_err());
    run.messages.push(original.clone());
    assert!(validate_message(&run, &original, &sender, &recipient, 0).is_err());
    drop(db);
    cleanup(root);
}
