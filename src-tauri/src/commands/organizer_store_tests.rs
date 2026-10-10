use super::*;

fn db() -> Connection {
    let c = Connection::open_in_memory().unwrap();
    c.execute_batch(include_str!("../../schema.sql")).unwrap();
    c.execute("INSERT INTO projects(id,name,status,signal,description,payload_json) VALUES('p','Project','active','','','{}')", []).unwrap();
    c
}
fn input() -> TaskInput {
    TaskInput {
        project_id: "p".into(),
        title: "Research workflow".into(),
        objective: "Make a reviewable result".into(),
        criteria: vec!["Evidence is saved".into()],
        steps: vec![],
        priority: "normal".into(),
        priority_reason: String::new(),
        due_date: None,
        sources: vec![],
        intent: "committed".into(),
    }
}
#[test]
fn organizer_schema_is_additive_and_identity_survives_edits() {
    let mut c = db();
    let t = create(&mut c, input()).unwrap();
    c.execute_batch(include_str!("../../schema.sql")).unwrap();
    let mut edit = input();
    edit.title = "Edited title".into();
    let next = update(&mut c, &t.id, t.revision, edit).unwrap();
    assert_eq!(t.id, next.id);
    assert_eq!(next.revision, 2);
    assert_eq!(list(&c, "p").unwrap().len(), 1);
}
#[test]
fn organizer_conflicting_edit_retains_latest_task() {
    let mut c = db();
    let t = create(&mut c, input()).unwrap();
    let mut edit = input();
    edit.title = "Latest".into();
    update(&mut c, &t.id, 1, edit).unwrap();
    let err = update(&mut c, &t.id, 1, input()).unwrap_err();
    assert_eq!(err.code, "conflict");
    assert_eq!(err.current_task.unwrap().title, "Latest");
    assert_eq!(get(&c, &t.id).unwrap().revision, 2);
}
#[test]
fn organizer_validates_lengths_project_dates_and_source_paths() {
    let mut c = db();
    let mut i = input();
    i.title = "x".repeat(161);
    assert!(create(&mut c, i).is_err());
    let mut i = input();
    i.criteria = vec!["test".into(); 13];
    assert!(create(&mut c, i).is_err());
    let mut i = input();
    i.project_id = "missing".into();
    assert!(create(&mut c, i).is_err());
    let mut i = input();
    i.due_date = Some("2026-02-30".into());
    assert!(create(&mut c, i).is_err());
    assert!(validate_source(
        &Source {
            kind: "vault".into(),
            reference: "../secret".into(),
            captured_text: None,
            sha256: None,
            line: None
        },
        Path::new("C:/vault")
    )
    .is_err());
    assert!(validate_source(
        &Source {
            kind: "url".into(),
            reference: "javascript:alert(1)".into(),
            captured_text: None,
            sha256: None,
            line: None
        },
        Path::new("C:/vault")
    )
    .is_err());
    assert!(validate_source(
        &Source {
            kind: "url".into(),
            reference: "https://example.com/source".into(),
            captured_text: None,
            sha256: None,
            line: None
        },
        Path::new("C:/vault")
    )
    .is_ok());
}
#[test]
fn organizer_move_respects_priority_and_revisions() {
    let mut c = db();
    let a = create(&mut c, input()).unwrap();
    let b = create(&mut c, input()).unwrap();
    let moved = move_task(&mut c, &b.id, 1, Some(&a.id)).unwrap();
    assert_eq!(moved[0].id, b.id);
    assert!(move_task(&mut c, &b.id, 1, None).is_err());
    let mut i = input();
    i.priority = "high".into();
    let high = create(&mut c, i).unwrap();
    assert!(move_task(&mut c, &high.id, 1, Some(&a.id)).is_err());
}
#[test]
fn organizer_persists_across_database_reopen() {
    let p = std::env::temp_dir().join(format!("organizer-{}.sqlite", new_id()));
    let id = {
        let mut c = Connection::open(&p).unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        c.execute("INSERT INTO projects(id,name,status,signal,description,payload_json) VALUES('p','P','active','','','{}')",[]).unwrap();
        create(&mut c, input()).unwrap().id
    };
    {
        let c = Connection::open(&p).unwrap();
        assert_eq!(get(&c, &id).unwrap().criteria, vec!["Evidence is saved"]);
    }
    std::fs::remove_file(p).unwrap();
}

#[test]
fn organizer_proposal_binding_requires_committed_unchanged_task() {
    let mut c = db();
    let mut i = input();
    i.intent = "proposed".into();
    let t = create(&mut c, i).unwrap();
    assert!(bind_proposal(&c, "proposal", "run", &t).is_err());
    let t = update(&mut c, &t.id, t.revision, input()).unwrap();
    bind_proposal(&c, "proposal", "run", &t).unwrap();
    assert_eq!(
        validate_binding(&c, "proposal", "run").unwrap().unwrap().id,
        t.id
    );
    assert!(validate_binding(&c, "proposal", "wrong-run").is_err());
    update(&mut c, &t.id, t.revision, input()).unwrap();
    assert!(validate_binding(&c, "proposal", "run").is_err());
    assert!(validate_binding(&c, "legacy-proposal", "legacy-run")
        .unwrap()
        .is_none());
}

#[test]
fn organizer_reorder_ignores_closed_tasks() {
    let mut c = db();
    let a = create(&mut c, input()).unwrap();
    let closed = create(&mut c, input()).unwrap();
    let b = create(&mut c, input()).unwrap();
    super::super::organizer_lifecycle::finish(
        &mut c,
        &closed.id,
        1,
        "complete_manual",
        "Completed by the operator manually",
    )
    .unwrap();
    let moved = move_task(&mut c, &b.id, 1, Some(&a.id)).unwrap();
    let open: Vec<_> = moved.iter().filter(|t| t.state == "open").collect();
    assert_eq!(open[0].id, b.id);
    assert_eq!(get(&c, &closed.id).unwrap().revision, 2);
}
#[test]
fn organizer_active_link_refuses_edits_and_resume_checks_revision() {
    let mut c = db();
    let t = create(&mut c, input()).unwrap();
    c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone) VALUES('r','p','P','Task','test','test','waiting','fixture','b','base','','Waiting')",[]).unwrap();
    bind_proposal(&c, "proposal", "r", &t).unwrap();
    link_started_run(&c, "proposal", "r").unwrap();
    assert!(update(&mut c, &t.id, 1, input()).is_err());
    assert_eq!(get(&c, &t.id).unwrap().revision, 1);
    validate_linked_run(&c, "r").unwrap();
    c.execute(
        "UPDATE delegation_runs SET phase='cancelled' WHERE id='r'",
        [],
    )
    .unwrap();
    update(&mut c, &t.id, 1, input()).unwrap();
    assert!(validate_linked_run(&c, "r").is_err());
}

#[test]
fn organizer_duplicate_start_returns_only_the_consumed_bound_run() {
    let mut c = db();
    let t = create(&mut c, input()).unwrap();
    c.execute("INSERT INTO delegation_runs(id,project_id,project_name,task,driver,model,phase,workspace,branch,base_commit,agent_session_id,milestone) VALUES('r','p','P','Task','test','test','waiting','fixture','b','base','','Waiting')",[]).unwrap();
    bind_proposal(&c, "proposal", "r", &t).unwrap();
    link_started_run(&c, "proposal", "r").unwrap();
    assert_eq!(recorded_start(&c, "proposal", "s").unwrap(), None);
    c.execute("INSERT INTO operator_sessions(id) VALUES('s')", [])
        .unwrap();
    c.execute("INSERT INTO operator_approvals(id,session_id,run_id,stage,task_text,task_hash,subject_json,subject_hash) VALUES('proposal','s','r','plan','task','h','{}','h')",[]).unwrap();
    c.execute(
        "INSERT INTO approval_consumptions(approval_id,run_id,stage) VALUES('proposal','r','plan')",
        [],
    )
    .unwrap();
    assert_eq!(
        recorded_start(&c, "proposal", "s").unwrap(),
        Some("r".into())
    );
    assert_eq!(
        recorded_start(&c, "proposal", "other-session").unwrap(),
        None
    );
    assert_eq!(recorded_start(&c, "missing", "s").unwrap(), None);
}
