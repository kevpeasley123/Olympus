use super::{index, record, retrieve, Query};
use rusqlite::Connection;
use std::{collections::HashSet, fs, path::PathBuf, time::Instant};
struct Fixture {
    root: PathBuf,
    vault: PathBuf,
    db: Connection,
}
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "olympus-memory-{}",
            super::super::delegation::run_id()
        ));
        fs::create_dir_all(root.join("vault")).unwrap();
        let vault = root.join("vault");
        let db = index::open(&root.join("index.sqlite"), &vault).unwrap();
        Self { root, vault, db }
    }
    fn write(&self, path: &str, text: &str) {
        let target = self.vault.join(path);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(target, text).unwrap();
    }
    fn sync(&mut self) {
        index::reconcile(&mut self.db, &self.vault, true, &HashSet::new(), false).unwrap();
    }
    fn query(&self, question: &str, scope: Option<&str>) -> retrieve::Packet {
        retrieve::retrieve(
            &self.db,
            &self.vault,
            &Query {
                question: question.into(),
                active_project: scope.map(str::to_string),
                recent_questions: vec![],
            },
        )
        .unwrap()
    }
    fn project(&self, id: &str, title: &str) {
        self.write(&format!("01 - Projects/{title}.md"),&format!("---\nschema_version: 1\nrecord_id: project-{id}\nproject_id: {id}\ntitle: {title}\ntype: project\naliases: [{title}]\n---\n# Current state\n{title} has ongoing implementation; native acceptance remains unknown.\n"));
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let db = std::mem::replace(&mut self.db, Connection::open_in_memory().unwrap());
        drop(db);
        if let (Ok(root), Ok(temp)) = (
            self.root.canonicalize(),
            std::env::temp_dir().canonicalize(),
        ) {
            if root.starts_with(temp)
                && root
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("olympus-memory-")
            {
                let _ = fs::remove_dir_all(root);
            }
        }
    }
}
fn session(id: &str, project: &str, extra: &str, body: &str) -> String {
    format!("---\nschema_version: 1\nrecord_id: {id}\ntype: session-record\nproject_ids: [{project}]\nobserved_at: '2026-10-08T20:00:00-07:00'\n{extra}\n---\n# Outcome\n{body}\n")
}

#[test]
fn legacy_adapter_dates_identity_and_eligibility() {
    let raw=b"---\ntitle: Source\ntype: research\ncreated: '2026-10-08'\ntags: [olympus/research]\n---\nAn argument.";
    let parsed = record::parse("02 - Research/Source.md", raw)
        .unwrap()
        .unwrap();
    assert!(parsed.record.provisional);
    assert_eq!(parsed.record.source_date, None);
    assert_eq!(parsed.record.recorded_at.as_deref(), Some("2026-10-08"));
    assert!(record::parse("07 - Templates/Source.md", raw)
        .unwrap()
        .is_none());
    assert!(record::parse("09 - System/Profile Observations.md", raw)
        .unwrap()
        .is_none());
    assert!(record::parse(
        "08 - Daily Briefs/Sessions/bad.md",
        b"---\nschema_version: 99\n---\nX"
    )
    .is_err());
    assert!(record::parse(
        "08 - Daily Briefs/Sessions/bad.md",
        b"---\nschema_version: 1\ntype: session-record\n---\nX"
    )
    .is_err());
    let fixture = raw.to_vec();
    let s = String::from_utf8(fixture)
        .unwrap()
        .replace("type: research", "type: research\ntest_fixture: true");
    assert!(record::parse("02 - Research/Test.md", s.as_bytes())
        .unwrap()
        .is_none());
}
#[test]
fn chunk_offsets_are_utf8_safe_and_cover_late_evidence() {
    let body = format!(
        "# Background\n{}\n\n# Verification\nImportant late proof.",
        "水λ ".repeat(3000)
    );
    let chunks = record::chunks(&body, 19);
    assert!(chunks.len() > 5);
    for chunk in &chunks {
        assert!(chunk.body.len() <= record::CHUNK_BYTES);
        assert_eq!(chunk.body, &body[chunk.start - 19..chunk.end - 19]);
    }
    assert!(chunks
        .iter()
        .any(|c| c.heading.contains("Verification") && c.body.contains("late proof")));
}
#[test]
fn project_scope_followups_and_explicit_override() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.project("ledger", "Ledger");
    f.write(
        "08 - Daily Briefs/Sessions/one.md",
        &session(
            "one",
            "olympus",
            "",
            "Orbit spacing was verified in Chromium.",
        ),
    );
    f.write(
        "08 - Daily Briefs/Sessions/two.md",
        &session(
            "two",
            "ledger",
            "",
            "Tax import remains an unapproved recommendation.",
        ),
    );
    f.sync();
    let packet = f.query("Where did we leave off?", Some("olympus"));
    assert_eq!(packet.scope, vec!["olympus"]);
    assert!(packet.sources.iter().any(|s| s.record.id == "one"));
    assert!(!packet.json().contains("Tax import"));
    let packet = f.query("Where does Ledger stand?", Some("olympus"));
    assert_eq!(packet.scope, vec!["ledger"]);
    assert!(!packet.json().contains("Orbit spacing"));
    assert_eq!(
        f.query("Where did we leave off?", None).status,
        "scope_required"
    );
    let query = Query {
        question: "Where did we leave off?".into(),
        active_project: None,
        recent_questions: vec!["Let us work on Olympus".into()],
    };
    assert_eq!(
        retrieve::retrieve(&f.db, &f.vault, &query).unwrap().scope,
        vec!["olympus"]
    );
}
#[test]
fn old_decision_brings_its_reversal_and_does_not_promote_advice() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.write("04 - Decisions/old.md","---\nschema_version: 1\nrecord_id: old\ntype: decision\nproject: Olympus\ndecision_status: current\nsource_date: '2020-01-01'\n---\n# Neptune protocol\nThe operator selected Neptune protocol.");
    f.write("04 - Decisions/new.md","---\nschema_version: 1\nrecord_id: reversal\ntype: decision\nproject: Olympus\ndecision_status: current\nsupersedes: [old]\n---\n# Changed direction\nThe operator explicitly replaced the previous selection with Triton.");
    f.write(
        "08 - Daily Briefs/Sessions/advice.md",
        &session(
            "advice",
            "olympus",
            "decision_status: proposed",
            "Neptune protocol might be useful again. This is unapproved advice.",
        ),
    );
    f.sync();
    let p = f.query("Why did we choose Neptune protocol?", Some("olympus"));
    assert!(p.sources.iter().any(|s| s.record.id == "old"));
    assert!(p.sources.iter().any(|s| s.record.id == "reversal"));
    assert!(p
        .sources
        .iter()
        .filter(|s| s.record.id == "advice")
        .all(|s| s.record.status == "proposed"));
    assert!(p.json().len() <= retrieve::MAX_PACKET_BYTES);
}
#[test]
fn late_correction_is_included_and_invalid_correction_blocks_original() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.write("04 - Decisions/old.md","---\nrecord_id: old\ntype: decision\nproject: Olympus\n---\n# Neptune\nUse Neptune protocol.");
    f.write("04 - Decisions/new.md",&format!("---\nrecord_id: reversal\ntype: decision\nproject: Olympus\nsupersedes: [old]\n---\n# Background\n{}\n\n# Correction\nReplace the earlier choice with Triton.","Background detail. ".repeat(170)));
    f.sync();
    let packet = f.query("Why Neptune?", Some("olympus"));
    assert!(packet.sources.iter().any(|s| s.record.id == "old"));
    assert!(packet
        .sources
        .iter()
        .any(|s| s.record.id == "reversal" && s.excerpt.contains("Triton")));
    f.write(
        "04 - Decisions/new.md",
        "---\ninvalid: [\n---\nAn interrupted correction save.",
    );
    f.sync();
    let packet = f.query("Why Neptune?", Some("olympus"));
    assert!(!packet.sources.iter().any(|s| s.record.id == "old"));
    assert!(packet
        .warnings
        .iter()
        .any(|w| w.contains("known correction links")));
}

#[test]
fn status_retrieval_reserves_project_milestones_before_global_research() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.write(
        "08 - Daily Briefs/Sessions/work.md",
        &session("work", "olympus", "", "Native acceptance remains pending."),
    );
    for i in 0..12 {
        f.write(&format!("02 - Research/r{i}.md"),&format!("---\ntype: research\ntags: [olympus/research]\ntitle: Status report {i}\n---\nStatus status status. Unrelated research {i}."));
    }
    f.sync();
    let packet = f.query("What is Olympus current status?", None);
    assert!(packet.sources.iter().any(|s| s.record.id == "work"));
}

#[test]
fn diagnostic_budgets_apply_to_utf8_and_early_return_states() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.sync();
    let mut status = index::status(&f.db).unwrap();
    status.warnings = (0..20)
        .map(|i| format!("{i}: {}", "界".repeat(800)))
        .collect();
    f.db.execute(
        "INSERT OR REPLACE INTO meta VALUES('status',?1)",
        [serde_json::to_string(&status).unwrap()],
    )
    .unwrap();
    for (question, scope) in [
        ("Where did we leave off?", None),
        ("What is Olympus current status?", Some("olympus")),
    ] {
        let packet = f.query(question, scope);
        assert!(packet.json().len() <= retrieve::MAX_PACKET_BYTES);
        if scope.is_some() {
            assert!(
                packet.sources.iter().any(|s| s.record.kind == "project"),
                "bounded diagnostics must leave room for valid evidence"
            );
        }
        assert!(packet
            .warnings
            .iter()
            .any(|w| w.contains("Additional diagnostics omitted")));
    }
}

#[test]
fn edits_deletions_rebuild_and_unavailable_vault_are_distinct() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    let path = "08 - Daily Briefs/Sessions/work.md";
    f.write(
        path,
        &session(
            "work",
            "olympus",
            "",
            "Orbit phase has version one evidence.",
        ),
    );
    f.sync();
    f.write(
        path,
        &session(
            "work",
            "olympus",
            "",
            "Orbit phase has version two evidence.",
        ),
    );
    let p = f.query("Orbit phase", Some("olympus"));
    assert_eq!(p.status, "stale");
    assert!(!p.sources.iter().any(|s| s.record.id == "work"));
    f.sync();
    assert!(f
        .query("Orbit phase", Some("olympus"))
        .json()
        .contains("version two"));
    let before = fs::read(f.vault.join(path)).unwrap();
    index::reconcile(&mut f.db, &f.vault, true, &HashSet::new(), true).unwrap();
    assert_eq!(before, fs::read(f.vault.join(path)).unwrap());
    fs::remove_file(f.vault.join(path)).unwrap();
    f.sync();
    assert!(!f
        .query("Orbit phase", Some("olympus"))
        .json()
        .contains("version two"));
    let count = index::status(&f.db).unwrap().documents;
    assert!(index::reconcile(
        &mut f.db,
        &f.root.join("absent"),
        true,
        &HashSet::new(),
        false
    )
    .is_err());
    assert_eq!(index::status(&f.db).unwrap().documents, count);
}
#[test]
fn duplicate_ids_aliases_and_bad_formats_never_choose_a_winner() {
    let mut f = Fixture::new();
    f.project("a", "Shared");
    f.write("01 - Projects/other.md","---\ntype: project\nproject_id: b\ntitle: Other\naliases: [Shared]\n---\nDifferent project.");
    f.write(
        "08 - Daily Briefs/Sessions/one.md",
        &session("duplicate", "a", "", "First source."),
    );
    f.write(
        "08 - Daily Briefs/Sessions/two.md",
        &session("duplicate", "a", "", "Conflicting source."),
    );
    f.sync();
    assert_eq!(f.query("Shared status", None).status, "ambiguous_scope");
    assert!(index::status(&f.db).unwrap().issues >= 2);
    assert!(!f
        .query("First source", Some("a"))
        .sources
        .iter()
        .any(|s| s.record.id == "duplicate"));
    fs::remove_file(f.vault.join("08 - Daily Briefs/Sessions/two.md")).unwrap();
    f.sync();
    assert!(f
        .query("First source", Some("a"))
        .sources
        .iter()
        .any(|s| s.record.id == "duplicate"));
}
#[test]
fn same_timestamp_change_is_detected_by_integrity_reconciliation() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    let path = "08 - Daily Briefs/Sessions/work.md";
    f.write(path, &session("work", "olympus", "", "Aardvark one."));
    f.sync();
    let full = f.vault.join(path);
    let modified = fs::metadata(&full).unwrap().modified().unwrap();
    f.write(path, &session("work", "olympus", "", "Aardvark two."));
    fs::File::options()
        .write(true)
        .open(&full)
        .unwrap()
        .set_times(fs::FileTimes::new().set_modified(modified))
        .unwrap();
    f.sync();
    assert!(f
        .query("Aardvark", Some("olympus"))
        .json()
        .contains("Aardvark two"));
}
#[test]
fn supplied_evidence_receipts_are_backend_owned_and_survive_index_rebuild() {
    let db =
        super::super::persistence::Db(std::sync::Mutex::new(Connection::open_in_memory().unwrap()));
    db.0.lock()
        .unwrap()
        .execute_batch(include_str!("../../../schema.sql"))
        .unwrap();
    let request = super::super::models::RequestRecord::new(
        &super::super::models::resolve(super::super::models::Capability::Primary),
        "test",
    );
    super::super::models::save(&db, &request).unwrap();
    let first = super::Packet::unavailable("First immutable receipt");
    super::save_packet(&db, &request.id, &first).unwrap();
    super::save_packet(&db, &request.id, &super::Packet::unavailable("Replacement")).unwrap();
    let saved: String =
        db.0.lock()
            .unwrap()
            .query_row(
                "SELECT packet_json FROM request_memory WHERE request_id=?1",
                [request.id],
                |r| r.get(0),
            )
            .unwrap();
    assert!(saved.contains("First immutable receipt"));
    assert!(!saved.contains("Replacement"));
}

#[test]
fn project_summary_is_substantive_and_search_finds_late_rationale() {
    let mut f = Fixture::new();
    f.write("01 - Projects/Olympus.md","---\nschema_version: 1\nrecord_id: project\nproject_id: olympus\ntitle: Olympus\ntype: project\n---\n# Olympus\n\n## Purpose\nA command station for useful work.\n\n## Verified current state\nConversation and overview are separate views with a persistent composer.\n\n## Decision rationale\nZephyr isolation keeps source history independent of current operating policy.");
    f.sync();
    let resumed = f.query("Where did we leave off?", Some("olympus"));
    assert!(resumed
        .sources
        .iter()
        .any(|s| s.excerpt.contains("separate views")));
    let why = f.query("Why Zephyr isolation?", Some("olympus"));
    assert!(why
        .sources
        .iter()
        .any(|s| s.excerpt.contains("source history independent")));
}
#[test]
fn missing_collection_and_malformed_rewrite_preserve_inventory_but_not_stale_evidence() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    let relative = "08 - Daily Briefs/Sessions/work.md";
    f.write(
        relative,
        &session("work", "olympus", "", "Spectral work verified."),
    );
    f.sync();
    fs::rename(f.vault.join("08 - Daily Briefs"), f.root.join("offline")).unwrap();
    f.sync();
    assert_eq!(index::status(&f.db).unwrap().state, "partial");
    assert_eq!(index::status(&f.db).unwrap().documents, 2);
    let rebuilt = index::reconcile(&mut f.db, &f.vault, true, &HashSet::new(), true).unwrap();
    assert_eq!(rebuilt.state, "partial");
    assert_eq!(
        rebuilt.documents, 2,
        "rebuild must retain temporarily offline inventory"
    );
    assert!(!f
        .query("Spectral", Some("olympus"))
        .sources
        .iter()
        .any(|s| s.record.id == "work"));
    fs::rename(f.root.join("offline"), f.vault.join("08 - Daily Briefs")).unwrap();
    f.write(relative, "---\ninvalid: [\n---\nPartial save");
    f.sync();
    assert!(index::status(&f.db).unwrap().issues > 0);
    assert!(!f
        .query("Spectral", Some("olympus"))
        .sources
        .iter()
        .any(|s| s.record.id == "work"));
}
#[test]
fn rename_stable_identity_survives_and_restart_reads_committed_generation() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    let p = "08 - Daily Briefs/Sessions/old.md";
    f.write(
        p,
        &session("stable", "olympus", "", "Copper protocol state."),
    );
    f.sync();
    fs::rename(
        f.vault.join(p),
        f.vault.join("08 - Daily Briefs/Sessions/new.md"),
    )
    .unwrap();
    f.sync();
    let reader = index::reader(&f.root.join("index.sqlite")).unwrap();
    let result = retrieve::retrieve(
        &reader,
        &f.vault,
        &Query {
            question: "Copper protocol".into(),
            active_project: Some("olympus".into()),
            recent_questions: vec![],
        },
    )
    .unwrap();
    assert!(result
        .sources
        .iter()
        .any(|s| s.record.id == "stable" && s.record.path.ends_with("new.md")));
    assert_eq!(result.generation, 2);
}
#[test]
fn index_corruption_recovery_is_separate_from_source_storage() {
    let f = Fixture::new();
    let cache = f.root.join("memory-index.sqlite");
    fs::write(&cache, b"not sqlite").unwrap();
    assert!(index::open(&cache, &f.vault).is_err());
    index::archive_unreadable_index(&cache).unwrap();
    assert!(index::open(&cache, &f.vault).is_ok());
    assert!(index::archive_unreadable_index(&f.vault.join("Project.md")).is_err());
}
#[test]
fn stale_summary_coverage_is_reported_and_session_is_still_retrieved() {
    let mut f = Fixture::new();
    f.write("01 - Projects/Olympus.md","---\ntype: project\nproject_id: olympus\ntitle: Olympus\nsource_revisions: {work: old-revision}\n---\n## Current state\nA summary that has not incorporated recent work.");
    f.write(
        "08 - Daily Briefs/Sessions/work.md",
        &session(
            "work",
            "olympus",
            "",
            "The palette implementation changed after the summary.",
        ),
    );
    f.sync();
    let packet = f.query("Where did we leave off?", Some("olympus"));
    assert!(packet
        .warnings
        .iter()
        .any(|w| w.contains("summary may be stale")));
    assert!(packet.sources.iter().any(|s| s.record.id == "work"));
}
#[test]
fn native_worker_indexes_changes_without_a_request_scan() {
    let f = Fixture::new();
    f.project("olympus", "Olympus");
    let service = super::MemoryService::start(f.vault.clone(), f.root.join("worker.sqlite"));
    let start = Instant::now();
    while service.health.lock().unwrap().generation == 0 {
        assert!(start.elapsed().as_secs() < 5);
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    f.write(
        "08 - Daily Briefs/Sessions/watch.md",
        &session("watched", "olympus", "", "Amethyst watcher milestone."),
    );
    let query = Query {
        question: "Amethyst watcher".into(),
        active_project: Some("olympus".into()),
        recent_questions: vec![],
    };
    loop {
        if service
            .reader()
            .query(&query)
            .sources
            .iter()
            .any(|s| s.record.id == "watched")
        {
            break;
        }
        assert!(
            start.elapsed().as_secs() < 8,
            "native watcher did not publish the source change"
        );
        std::thread::sleep(std::time::Duration::from_millis(40));
    }
    drop(service);
    std::thread::sleep(std::time::Duration::from_millis(100));
}
#[test]
fn both_concurrent_reports_remain_evidence_and_portfolio_is_bounded() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.write(
        "08 - Daily Briefs/Sessions/a.md",
        &session(
            "branch-a",
            "olympus",
            "",
            "Quartz test passed on branch alpha; native acceptance unknown.",
        ),
    );
    f.write(
        "08 - Daily Briefs/Sessions/b.md",
        &session(
            "branch-b",
            "olympus",
            "",
            "Quartz test failed on branch beta; do not infer acceptance.",
        ),
    );
    f.sync();
    let packet = f.query("Quartz test", Some("olympus"));
    assert!(packet.sources.iter().any(|s| s.record.id == "branch-a"));
    assert!(packet.sources.iter().any(|s| s.record.id == "branch-b"));
    for i in 0..10 {
        f.project(&format!("p{i}"), &format!("Project{i}"));
    }
    f.sync();
    let packet = f.query("Brief my projects", None);
    assert!(packet.truncated);
    assert!(packet.sources.len() <= retrieve::MAX_PASSAGES);
    assert!(packet.json().len() <= retrieve::MAX_PACKET_BYTES);
}

#[test]
#[ignore = "Read-only real-vault recall diagnostic; derived index is created in a temporary directory"]
fn real_vault_index_recall() {
    let mut f = Fixture::new();
    let real = std::env::var_os("OLYMPUS_MEMORY_RESTORE_VAULT")
        .map(PathBuf::from)
        .unwrap_or_else(super::super::get_vault_path);
    // A separate cache owner prevents accidentally reusing a fixture or real app index.
    let mut db = index::open(&f.root.join("real-readonly.sqlite"), &real).unwrap();
    let status = index::reconcile(&mut db, &real, true, &HashSet::new(), false).unwrap();
    assert!(status.documents > 0);
    let packet = retrieve::retrieve(
        &db,
        &real,
        &Query {
            question: "Where did we leave off with Olympus?".into(),
            active_project: Some("olympus".into()),
            recent_questions: vec![],
        },
    )
    .unwrap();
    assert!(packet
        .sources
        .iter()
        .any(|s| s.record.path == "01 - Projects/Project Olympus.md"));
    assert!(packet.sources.iter().any(|s| s.record.kind == "session"));
    assert!(packet
        .sources
        .iter()
        .all(|s| !s.record.path.contains("Profile")));
    eprintln!(
        "real vault: documents={} chunks={} issues={} packet_bytes={} sources={} status={}",
        status.documents,
        status.chunks,
        status.issues,
        packet.json().len(),
        packet.sources.len(),
        packet.status
    );
    for warning in status.warnings {
        eprintln!("index diagnostic: {warning}");
    }
    drop(db);
    f.sync();
}

#[test]
#[ignore = "Local synthetic index scalability benchmark; no provider or real vault access"]
fn scale_100_10000_100000_records() {
    let mut f = Fixture::new();
    f.project("olympus", "Olympus");
    f.write(
        "08 - Daily Briefs/Sessions/target.md",
        &session(
            "target",
            "olympus",
            "",
            "Quasar handover preserves the approved orbit decision.",
        ),
    );
    f.sync();
    let mut inserted = 0;
    for size in [100, 10_000, 100_000] {
        let start = Instant::now();
        let tx = f.db.transaction().unwrap();
        for i in inserted..size {
            let text=format!("---\nschema_version: 1\nrecord_id: distraction-{i}\ntype: research\ntags: [olympus/research]\n---\n# Gardening\nIndependent gardening reference {i}. {}","Compost and seasonal garden advice. ".repeat(if i%100==0{120}else{3}));
            let parsed = record::parse(&format!("02 - Research/fixture-{i}.md"), text.as_bytes())
                .unwrap()
                .unwrap();
            index::put(&tx, &parsed, "fixture", text.len()).unwrap();
        }
        tx.commit().unwrap();
        inserted = size;
        let mut times = Vec::new();
        for _ in 0..30 {
            let query_start = Instant::now();
            let p = f.query("Quasar handover", Some("olympus"));
            assert!(p.sources.iter().any(|s| s.record.id == "target"));
            assert!(p.json().len() <= retrieve::MAX_PACKET_BYTES);
            times.push(query_start.elapsed().as_micros());
        }
        times.sort();
        let chunks: u64 =
            f.db.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
                .unwrap();
        let bytes: u64 =
            f.db.query_row("SELECT SUM(bytes) FROM documents", [], |r| r.get(0))
                .unwrap();
        eprintln!("memory scale records={size} chunks={chunks} source_bytes={bytes} batch_and_queries_ms={} warm_p95_us={}",start.elapsed().as_millis(),times[28]);
        assert!(
            times[28] < 250_000,
            "warm retrieval exceeded proposed 250ms target"
        );
    }
}
