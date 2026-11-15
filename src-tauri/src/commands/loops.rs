//! Olympus's loops, written down, and how each is doing (docs/LOOPS.md).
//!
//! A contract names a loop's five parts (trigger, goal, verifier, actions,
//! memory) with its cap and Kevin's gate, so a missing part is visible and the
//! weekly vision review has something to check against. The scorecard is read
//! from what Olympus already records (`agent_runs`, `agent_events`,
//! `delegation_runs`); nothing here estimates.

use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use tauri::State;

use super::persistence::Db;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopContract {
    pub id: &'static str,
    pub name: &'static str,
    pub trigger: &'static str,
    pub goal: &'static str,
    /// How the result is judged, and by what: `code`, `model` or `tests`.
    pub verifier: &'static str,
    pub verifier_kind: &'static [&'static str],
    pub actions: &'static str,
    pub memory: &'static str,
    pub cap: &'static str,
    pub gate: &'static str,
    /// The part this loop most lacks, in the plan's words.
    pub gap: &'static str,
}

pub const CONTRACTS: &[LoopContract] = &[
    LoopContract {
        id: "ask", name: "Ask Olympus",
        trigger: "Kevin, in chat (/ask)",
        goal: "An answer whose claims cite what was read and survive Themis's check",
        verifier: "Schema and citation checks in code; Themis checks Athena's claims against the sources",
        verifier_kind: &["code", "model"],
        actions: "Read-only: vault, learned memory, project list",
        memory: "Within the run: the plan, each report, Themis's objections",
        cap: "12 turns a phase, two hand-offs, one revision round",
        gate: "None: read-only",
        gap: "The content check is a model, not a rule",
    },
    LoopContract {
        id: "opening-brief", name: "Opening brief",
        trigger: "App open, or New briefing",
        goal: "A spoken brief of what changed, why it matters and what needs Kevin, citing only what was read",
        verifier: "Schema, length and citation checks in code",
        verifier_kind: &["code"],
        actions: "Read-only: recent activity, mail, vault, projects, memory",
        memory: "The previous brief, matters Kevin settled, his recent chat words",
        cap: "24 turns, no retry",
        gate: "None: read-only",
        gap: "Nothing checks the content against Kevin's stated preferences, and a failed brief is not retried",
    },
    LoopContract {
        id: "single-olympian", name: "One Olympian from chat",
        trigger: "Kevin names Athena or Themis in chat, or asks a sourced question",
        goal: "A sourced answer, or verdicts on the claims given",
        verifier: "Schema and citation checks in code",
        verifier_kind: &["code"],
        actions: "Read-only: that Olympian's tools",
        memory: "Within the run",
        cap: "The Olympian's turn limit, no retry",
        gate: "None: read-only",
        gap: "No independent check",
    },
    LoopContract {
        id: "coding-delegation", name: "Coding delegation (Hephaestus)",
        trigger: "Kevin approves a scoped task",
        goal: "A change in an isolated worktree that passes the recorded checks",
        verifier: "Real checks (tests, build) run on request",
        verifier_kind: &["tests"],
        actions: "Edits inside the approved worktree only",
        memory: "None across attempts",
        cap: "One attempt, then review",
        gate: "Approval before, review after",
        gap: "A failed check is reported, never retried; no memory of attempts",
    },
    LoopContract {
        id: "background-jobs", name: "Background jobs",
        trigger: "A chat goes quiet; timers while Olympus is open",
        goal: "Learned memory, mail analysis and situations kept current",
        verifier: "Schema and provenance checks in code",
        verifier_kind: &["code"],
        actions: "One model request each, no tools; writes only Olympus's own records",
        memory: "None across attempts",
        cap: "One attempt",
        gate: "None: Olympus's own records only",
        gap: "Outside-service failures are not retried",
    },
];

/// The loop a skill run belongs to.
pub fn loop_for_skill(skill_id: &str) -> &'static str {
    match skill_id {
        "work-request" => "ask",
        "opening-brief" => "opening-brief",
        _ => "single-olympian",
    }
}

#[derive(Debug, Default, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoopScore {
    pub runs: i64,
    pub completed: i64,
    pub failed: i64,
    /// Completed without a revision or retry.
    pub first_pass: i64,
    pub revisions: i64,
    /// Revisions after which the final check found nothing refuted.
    pub revisions_resolved: i64,
    /// Runs stopped because they used every step allowed.
    pub cap_hits: i64,
    pub awaiting_review: i64,
    pub seconds: f64,
    pub reported_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopCard {
    #[serde(flatten)]
    pub contract: LoopContract,
    pub score: LoopScore,
}

const CAP_HIT: &str = "used every step it was allowed";

fn measured(detail: Option<String>) -> (f64, f64) {
    let v: Value = detail.as_deref().and_then(|d| serde_json::from_str(d).ok()).unwrap_or(Value::Null);
    let ms = v["duration_ms"].as_f64().or_else(|| v["latency_ms"].as_f64()).unwrap_or(0.0);
    (ms / 1000.0, v["total_cost_usd"].as_f64().unwrap_or(0.0))
}

pub fn scorecard(connection: &Connection, days: i64) -> rusqlite::Result<Vec<LoopCard>> {
    let since = format!("-{} days", days.clamp(1, 365));
    let mut scores: Vec<(&'static str, LoopScore)> = CONTRACTS.iter().map(|c| (c.id, LoopScore::default())).collect();
    let score = |scores: &mut Vec<(&'static str, LoopScore)>, id: &str| -> usize { scores.iter().position(|(k, _)| *k == id).expect("known loop") };

    // Skill runs: one root run is one pass of its loop; its hand-offs belong to it.
    let mut roots = connection.prepare(
        "SELECT id, skill_id, status, COALESCE(error, '') FROM agent_runs WHERE parent_run IS NULL AND status <> 'running' \
         AND started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)",
    )?;
    let rows: Vec<(String, String, String, String)> = roots.query_map([&since], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?.collect::<Result<_, _>>()?;
    for (id, skill, status, error) in rows {
        let i = score(&mut scores, loop_for_skill(&skill));
        let family = format!("{id}-h%");
        let retried: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM agent_events WHERE run_id = ?1 AND kind = 'message' AND summary LIKE 'Retry:%')",
            [&id], |r| r.get(0))?;
        let mut outcome = connection.prepare("SELECT detail FROM agent_events WHERE (run_id = ?1 OR run_id LIKE ?2) AND kind IN ('result','error') AND subagent = 0")?;
        let measures: Vec<Option<String>> = outcome.query_map(params![id, family], |r| r.get(0))?.collect::<Result<_, _>>()?;
        let s = &mut scores[i].1;
        s.runs += 1;
        for detail in measures {
            let (seconds, cost) = measured(detail);
            s.seconds += seconds;
            s.reported_cost_usd += cost;
        }
        if status == "completed" {
            s.completed += 1;
            if !retried { s.first_pass += 1; }
        } else {
            s.failed += 1;
            if error.contains(CAP_HIT) { s.cap_hits += 1; }
        }
        if retried {
            s.revisions += 1;
            // Resolved when the last check after the revision refuted nothing.
            let last_check: Option<String> = connection.query_row(
                "SELECT output_json FROM agent_runs WHERE parent_run = ?1 AND skill_id = 'verification-assignment' AND status = 'completed' ORDER BY id DESC LIMIT 1",
                [&id], |r| r.get(0)).ok().flatten();
            let refuted = last_check.as_deref().and_then(|o| serde_json::from_str::<Value>(o).ok())
                .is_some_and(|o| o["verdicts"].as_array().is_some_and(|v| v.iter().any(|v| v["verdict"] == "does_not_hold")));
            if last_check.is_some() && !refuted { s.revisions_resolved += 1; }
        }
    }

    // Background jobs: one start and one outcome each, in the event stream only.
    let mut jobs = connection.prepare(
        "SELECT e.kind, e.detail FROM agent_events e WHERE e.kind IN ('result','error') AND e.subagent = 0 \
         AND e.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1) \
         AND e.run_id NOT IN (SELECT id FROM agent_runs) AND e.run_id NOT IN (SELECT id FROM delegation_runs) AND e.run_id NOT LIKE 'chat-%' \
         AND EXISTS (SELECT 1 FROM agent_events s WHERE s.run_id = e.run_id AND s.kind = 'run_started' AND s.summary LIKE '% on %')",
    )?;
    let job_rows: Vec<(String, Option<String>)> = jobs.query_map([&since], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?;
    let i = score(&mut scores, "background-jobs");
    for (kind, detail) in job_rows {
        let s = &mut scores[i].1;
        s.runs += 1;
        let (seconds, cost) = measured(detail);
        s.seconds += seconds;
        s.reported_cost_usd += cost;
        if kind == "result" { s.completed += 1; s.first_pass += 1; } else { s.failed += 1; }
    }

    // Coding delegation: its own table, by where each run ended up.
    let has_delegation: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'delegation_runs')", [], |r| r.get(0))?;
    if has_delegation {
        let mut delegations = connection.prepare("SELECT phase, COALESCE(outcome, '') FROM delegation_runs WHERE started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)")?;
        let phases: Vec<(String, String)> = delegations.query_map([&since], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<Result<_, _>>()?;
        let i = score(&mut scores, "coding-delegation");
        for (phase, outcome) in phases {
            let s = &mut scores[i].1;
            s.runs += 1;
            match phase.as_str() {
                "awaiting_review" => s.awaiting_review += 1,
                "failed" | "cancelled" | "interrupted" => s.failed += 1,
                "completed" | "accepted" | "merged" => { s.completed += 1; if outcome != "retried" { s.first_pass += 1; } }
                _ => {}
            }
        }
    }

    Ok(CONTRACTS.iter().zip(scores).map(|(contract, (_, score))| LoopCard { contract: contract.clone(), score }).collect())
}

#[tauri::command]
pub fn loop_scorecard(db: State<Db>, days: Option<i64>) -> Result<Vec<LoopCard>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    scorecard(&connection, days.unwrap_or(7)).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&connection).unwrap();
        connection
    }
    fn run(c: &Connection, id: &str, skill: &str, status: &str, parent: Option<&str>, output: Option<&str>, error: Option<&str>) {
        c.execute("INSERT INTO agent_runs (id, skill_id, skill_version, engine, agent, status, parent_run, output_json, error, tool_calls, started_at) VALUES (?1, ?2, 1, 'claude-code', 'olympus', ?3, ?4, ?5, ?6, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
            params![id, skill, status, parent, output, error]).unwrap();
    }
    fn event(c: &Connection, run: &str, kind: &str, summary: &str, detail: Option<&str>) {
        c.execute("INSERT INTO agent_events (run_id, engine, agent, kind, summary, detail, subagent) VALUES (?1, 'claude-code', 'olympus', ?2, ?3, ?4, 0)", params![run, kind, summary, detail]).unwrap();
    }

    #[test]
    fn every_loop_has_all_five_parts_a_cap_and_a_gate() {
        for c in CONTRACTS {
            for part in [c.trigger, c.goal, c.verifier, c.actions, c.memory, c.cap, c.gate, c.gap] {
                assert!(!part.trim().is_empty(), "{} is missing a part", c.id);
            }
            assert!(!c.verifier_kind.is_empty());
        }
        assert_eq!(loop_for_skill("work-request"), "ask");
        assert_eq!(loop_for_skill("research-assignment"), "single-olympian");
    }

    #[test]
    fn the_scorecard_counts_only_what_was_recorded() {
        let c = db();
        let empty = scorecard(&c, 7).unwrap();
        assert!(empty.iter().all(|card| card.score == LoopScore::default()), "nothing recorded scores nothing");

        // An /ask that passed first time, one that needed and resolved a revision, one that hit its cap.
        run(&c, "a1", "work-request", "completed", None, None, None);
        event(&c, "a1", "result", "done", Some(r#"{"duration_ms": 30000, "total_cost_usd": 0.25}"#));
        run(&c, "a2", "work-request", "completed", None, None, None);
        event(&c, "a2", "message", "Retry: Themis found claims that do not hold; Athena revises once", None);
        run(&c, "a2-h2", "verification-assignment", "completed", Some("a2"), Some(r#"{"verdicts":[{"verdict":"does_not_hold"}]}"#), None);
        run(&c, "a2-h4", "verification-assignment", "completed", Some("a2"), Some(r#"{"verdicts":[{"verdict":"holds"}]}"#), None);
        event(&c, "a2-h4", "result", "done", Some(r#"{"duration_ms": 10000, "total_cost_usd": 0.1}"#));
        run(&c, "a3", "work-request", "failed", None, None, Some("Claude used every step it was allowed without finishing. No fallback was attempted."));
        run(&c, "b1", "opening-brief", "completed", None, None, None);
        run(&c, "r1", "running-skill", "running", None, None, None);
        // A background job: a labelled start and its outcome.
        event(&c, "job-1", "run_started", "Memory contribution on claude-opus", None);
        event(&c, "job-1", "error", "Stopped Memory contribution", Some(r#"{"latency_ms": 2000}"#));
        // A chat turn is not a loop.
        event(&c, "chat-1", "result", "done", None);

        let cards = scorecard(&c, 7).unwrap();
        let ask = &cards.iter().find(|card| card.contract.id == "ask").unwrap().score;
        assert_eq!((ask.runs, ask.completed, ask.failed, ask.first_pass, ask.revisions, ask.revisions_resolved, ask.cap_hits), (3, 2, 1, 1, 1, 1, 1));
        assert!((ask.reported_cost_usd - 0.35).abs() < 1e-9 && (ask.seconds - 40.0).abs() < 1e-9, "a run's cost includes its hand-offs");
        assert_eq!(cards.iter().find(|card| card.contract.id == "opening-brief").unwrap().score.runs, 1);
        let jobs = &cards.iter().find(|card| card.contract.id == "background-jobs").unwrap().score;
        assert_eq!((jobs.runs, jobs.failed), (1, 1), "a job counts once and a chat turn not at all");
        assert_eq!(cards.iter().find(|card| card.contract.id == "single-olympian").unwrap().score.runs, 0, "a running run is not scored yet");
    }
}
