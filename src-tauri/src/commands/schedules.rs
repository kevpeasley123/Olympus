//! Scheduled loops: work Olympus does on a rhythm while it is open, without
//! being asked (docs/LOOPS.md, "Scheduled loops").
//!
//! Kevin asked for Olympus to evaluate "constantly and periodically" whether it
//! is meeting his vision, and for safety nets so nothing runs away with his
//! allowance. So a schedule is a fixed entry in `SCHEDULES`, never something a
//! model or a note can add; it runs at most once per period; one that spends
//! engine usage goes through that skill's own guards; and each can be switched
//! off. History lives in `processing_logs` under `schedule.<id>`.

use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};

use super::persistence::Db;

#[derive(Clone, Copy)]
pub struct Schedule {
    pub id: &'static str,
    pub name: &'static str,
    pub every_hours: i64,
    pub does: &'static str,
    /// What a run costs Kevin, in his terms.
    pub cost: &'static str,
    /// The setting that switches it off when it holds "false".
    pub setting: &'static str,
}

pub const SCHEDULES: &[Schedule] = &[
    Schedule {
        id: "self-check", name: "Self-check", every_hours: 6,
        does: "Reads Olympus's own records for what is broken or waiting on you: failed briefs, rules a brief keeps breaking, stalled email analysis, a Gmail disconnect, decisions left open. The next brief hears what it finds.",
        cost: "No engine usage", setting: "schedule.self-check.enabled",
    },
    Schedule {
        id: "vision-review", name: "Weekly review", every_hours: 24 * 7,
        does: "Reads the week against your expectations and proposes improvements for you to accept.",
        cost: "One Claude run a week; never when a usage window is below a fifth", setting: "vision.review.enabled",
    },
];

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub id: String,
    /// True when only Kevin can clear it.
    pub needs_kevin: bool,
    pub text: String,
}

fn finding(id: &str, needs_kevin: bool, text: String) -> Finding {
    Finding { id: id.into(), needs_kevin, text }
}

fn count(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |r| r.get(0)).unwrap_or(0)
}

/// What Olympus can tell is wrong with itself, or is waiting on Kevin, from its
/// own records. Rules only: no model reads anything, so it costs nothing and
/// says the same thing twice for the same state. A table this build lacks is
/// simply not a finding.
pub fn self_check(connection: &Connection) -> Vec<Finding> {
    let mut found = Vec::new();
    let day = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')";

    let last_brief: Option<(String, Option<String>)> = connection
        .query_row("SELECT status, error FROM agent_runs WHERE skill_id = 'opening-brief' AND status <> 'running' ORDER BY started_at DESC LIMIT 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .ok();
    if let Some((status, error)) = last_brief {
        if status == "failed" {
            let why: String = error.unwrap_or_default().chars().take(160).collect();
            found.push(finding("brief-failed", false, format!("The last opening brief failed. {why}").trim().to_string()));
        }
    }

    let failures = count(connection, &format!("SELECT count(*) FROM agent_runs WHERE status = 'failed' AND started_at >= {day}"));
    if failures >= 3 {
        found.push(finding("runs-failing", false, format!("{failures} runs failed in the last day.")));
    }

    if let Ok(mut statement) = connection.prepare(&format!("SELECT check_id, count(*) FROM expectation_checks WHERE passed = 0 AND created_at >= {day} GROUP BY check_id HAVING count(*) >= 2 ORDER BY 2 DESC LIMIT 3")) {
        let broken: Vec<String> = statement.query_map([], |r| r.get::<_, String>(0)).map(|rows| rows.filter_map(Result::ok).collect()).unwrap_or_default();
        if !broken.is_empty() {
            found.push(finding("rules-breaking", false, format!("Briefs keep breaking the same rules in the last day: {}.", broken.join(", "))));
        }
    }

    let gmail: Option<String> = connection.query_row("SELECT status FROM gmail_accounts WHERE enabled = 1 LIMIT 1", [], |r| r.get(0)).ok();
    if gmail.as_deref().is_some_and(|status| status == "authentication_required") {
        found.push(finding("gmail-disconnected", true, "Gmail needs reconnecting, so mail is going stale.".into()));
    }

    if let Ok(mut statement) = connection.prepare("SELECT status FROM communication_runs ORDER BY rowid DESC LIMIT 3") {
        let recent: Vec<String> = statement.query_map([], |r| r.get::<_, String>(0)).map(|rows| rows.filter_map(Result::ok).collect()).unwrap_or_default();
        if recent.len() == 3 && recent.iter().all(|status| status == "failed") {
            found.push(finding("email-analysis-stalled", true, "Email analysis has failed three times running. The Email analysis choice in the Gmail panel picks its route.".into()));
        }
    }

    let proposals = count(connection, "SELECT count(*) FROM vision_proposals WHERE status = 'proposed' AND created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')");
    if proposals > 0 {
        found.push(finding("proposals-waiting", true, format!("{proposals} proposal{} from the weekly review {} waiting on you. Saying \"accept the proposals\" puts them into effect.", if proposals == 1 { "" } else { "s" }, if proposals == 1 { "is" } else { "are" })));
    }
    let expectations = count(connection, "SELECT count(*) FROM expectations WHERE status = 'proposed'");
    if expectations > 0 && count(connection, "SELECT count(*) FROM expectations WHERE status = 'approved'") == 0 {
        found.push(finding("expectations-waiting", true, "None of your expectations is approved yet, so nothing is scored against them. Saying \"approve the expectations\" starts that.".into()));
    }

    let reviews = count(connection, "SELECT count(*) FROM delegation_runs WHERE phase = 'awaiting_review' AND updated_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')");
    if reviews > 0 {
        found.push(finding("coding-review-waiting", true, format!("{reviews} piece{} of Hephaestus's work {} waited more than a day for your review.", if reviews == 1 { "" } else { "s" }, if reviews == 1 { "has" } else { "have" })));
    }
    found
}

fn event(id: &str) -> String {
    format!("schedule.{id}")
}

fn enabled(connection: &Connection, schedule: &Schedule) -> bool {
    connection.query_row("SELECT value FROM settings WHERE key = ?1", [schedule.setting], |r| r.get::<_, String>(0)).ok().as_deref() != Some("false")
}

/// When a schedule last ran, with what it recorded.
fn last(connection: &Connection, id: &str) -> Option<(DateTime<Utc>, String, Value)> {
    connection
        .query_row("SELECT created_at, message, payload_json FROM processing_logs WHERE event_type = ?1 ORDER BY id DESC LIMIT 1", [event(id)], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)))
        .ok()
        .and_then(|(at, message, payload)| Some((NaiveDateTime::parse_from_str(&at, "%Y-%m-%d %H:%M:%S").ok()?.and_utc(), message, serde_json::from_str(&payload).unwrap_or(Value::Null))))
}

fn due(connection: &Connection, schedule: &Schedule, now: DateTime<Utc>) -> bool {
    enabled(connection, schedule) && last(connection, schedule.id).is_none_or(|(at, _, _)| now - at >= Duration::hours(schedule.every_hours))
}

fn record(connection: &Connection, id: &str, message: &str, payload: &Value) -> rusqlite::Result<()> {
    connection.execute("INSERT INTO processing_logs (event_type, message, payload_json) VALUES (?1, ?2, ?3)", params![event(id), message, payload.to_string()])?;
    // A handful of rows a day; two months is plenty to see a pattern.
    connection.execute("DELETE FROM processing_logs WHERE event_type LIKE 'schedule.%' AND created_at < datetime('now', '-60 days')", [])?;
    Ok(())
}

/// Runs the self-check and records what it found. Returns the findings.
pub fn run_self_check(connection: &Connection) -> rusqlite::Result<Vec<Finding>> {
    let found = self_check(connection);
    let message = match found.len() {
        0 => "Nothing wrong and nothing waiting.".to_string(),
        n => format!("{n} finding{}, {} needing you.", if n == 1 { "" } else { "s" }, found.iter().filter(|f| f.needs_kevin).count()),
    };
    record(connection, "self-check", &message, &json!({ "findings": found }))?;
    Ok(found)
}

/// The newest self-check's findings for the brief: what is broken or waiting,
/// in sentences. Empty when the last check found nothing or none has run.
pub fn findings_for_brief(connection: &Connection) -> Value {
    match last(connection, "self-check") {
        Some((at, _, payload)) => json!({ "checkedAt": at.to_rfc3339(), "findings": payload["findings"].as_array().cloned().unwrap_or_default() }),
        None => json!({ "checkedAt": Value::Null, "findings": [] }),
    }
}

/// One pass over the schedules. Called from the ticker; safe to call at any time.
pub fn run_due(app: &AppHandle) {
    let now = Utc::now();
    let db = app.state::<Db>();
    let review_due = {
        let Ok(connection) = db.0.lock() else { return };
        if due(&connection, &SCHEDULES[0], now) {
            let _ = run_self_check(&connection);
        }
        due(&connection, &SCHEDULES[1], now)
    };
    if review_due {
        // The review has its own, stricter guards (once a week, one attempt a day, usage above a fifth).
        // Only a review that actually started is recorded, so a refusal is asked again at the next tick
        // without costing anything.
        if let Ok(None) = super::skill_runner::start_due_vision_review(app.clone()) {
            if let Ok(connection) = db.0.lock() {
                let _ = record(&connection, "vision-review", "Started the weekly review.", &Value::Null);
            }
        }
    }
}

/// Checks the schedules while Olympus is open: first a few minutes after start,
/// so the opening brief has the engine to itself, then every quarter hour.
pub fn start_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(6 * 60));
        loop {
            run_due(&app);
            std::thread::sleep(std::time::Duration::from_secs(15 * 60));
        }
    });
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleCard {
    id: &'static str,
    name: &'static str,
    cadence: String,
    does: &'static str,
    cost: &'static str,
    enabled: bool,
    last_ran: Option<String>,
    last_result: Option<String>,
    next_due: Option<String>,
    findings: Vec<Value>,
}

pub fn cards(connection: &Connection) -> Vec<ScheduleCard> {
    SCHEDULES.iter().map(|schedule| {
        let ran = last(connection, schedule.id);
        let on = enabled(connection, schedule);
        ScheduleCard {
            id: schedule.id, name: schedule.name, does: schedule.does, cost: schedule.cost, enabled: on,
            cadence: if schedule.every_hours % 24 == 0 { format!("Every {} days", schedule.every_hours / 24) } else { format!("Every {} hours", schedule.every_hours) },
            next_due: on.then(|| ran.as_ref().map(|(at, _, _)| (*at + Duration::hours(schedule.every_hours)).to_rfc3339())).flatten(),
            findings: ran.as_ref().and_then(|(_, _, payload)| payload["findings"].as_array().cloned()).unwrap_or_default(),
            last_ran: ran.as_ref().map(|(at, _, _)| at.to_rfc3339()),
            last_result: ran.map(|(_, message, _)| message),
        }
    }).collect()
}

#[tauri::command]
pub fn schedule_status(db: State<Db>) -> Result<Vec<ScheduleCard>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    Ok(cards(&connection))
}

/// The self-check on request, from Diagnostics. Free, so there is nothing to guard.
#[tauri::command]
pub fn run_self_check_now(db: State<Db>) -> Result<Vec<ScheduleCard>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    run_self_check(&connection).map_err(|e| e.to_string())?;
    Ok(cards(&connection))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&connection).unwrap();
        connection
    }
    fn ids(found: &[Finding]) -> Vec<&str> {
        found.iter().map(|f| f.id.as_str()).collect()
    }

    #[test]
    fn a_healthy_olympus_has_no_findings_and_each_fault_is_named_once() {
        let c = db();
        assert!(self_check(&c).is_empty());

        c.execute("INSERT INTO agent_runs (id, skill_id, skill_version, engine, agent, status, error) VALUES ('b1', 'opening-brief', 1, 'claude-code', 'zeus', 'failed', 'The brief cites a tool it never called.')", []).unwrap();
        c.execute("INSERT INTO expectation_checks (check_id, run_id, passed, detail) VALUES ('brief.says-it-once', 'r1', 0, 'x'), ('brief.says-it-once', 'r2', 0, 'x'), ('brief.greeting', 'r1', 0, 'x')", []).unwrap();
        c.execute("INSERT INTO vision_proposals (run_id, position, kind, skill, title, detail, expectation, created_at) VALUES ('v', 0, 'instruction', 'opening-brief', 't', 'd', 'e', '2026-01-01T00:00:00.000Z')", []).unwrap();
        crate::commands::expectations::seed(&c).unwrap();
        let found = self_check(&c);
        assert_eq!(ids(&found), vec!["brief-failed", "rules-breaking", "proposals-waiting", "expectations-waiting"]);
        assert!(found[0].text.contains("never called") && !found[0].needs_kevin);
        assert!(found[1].text.contains("brief.says-it-once") && !found[1].text.contains("brief.greeting"), "one miss is not a pattern");
        assert!(found[2].needs_kevin && found[2].text.starts_with("1 proposal from the weekly review is waiting"));

        // A later brief that worked, an accepted proposal and an approved expectation clear them.
        c.execute("INSERT INTO agent_runs (id, skill_id, skill_version, engine, agent, status, started_at) VALUES ('b2', 'opening-brief', 1, 'claude-code', 'zeus', 'completed', '2999-01-01T00:00:00.000Z')", []).unwrap();
        c.execute("UPDATE vision_proposals SET status = 'accepted'", []).unwrap();
        c.execute("UPDATE expectations SET status = 'approved' WHERE id = 'brief-spoken'", []).unwrap();
        assert_eq!(ids(&self_check(&c)), vec!["rules-breaking"]);
    }

    #[test]
    fn a_schedule_runs_once_a_period_and_not_when_switched_off() {
        let c = db();
        let check = &SCHEDULES[0];
        let now = Utc::now();
        assert!(due(&c, check, now), "never run is due");
        assert!(run_self_check(&c).unwrap().is_empty());
        assert!(!due(&c, check, now + Duration::hours(5)));
        assert!(due(&c, check, now + Duration::hours(7)));
        c.execute("INSERT INTO settings (key, value) VALUES ('schedule.self-check.enabled', 'false')", []).unwrap();
        assert!(!due(&c, check, now + Duration::hours(7)), "switched off");

        let cards = cards(&c);
        assert_eq!((cards[0].id, cards[0].enabled, cards[0].cadence.as_str(), cards[0].last_result.as_deref()), ("self-check", false, "Every 6 hours", Some("Nothing wrong and nothing waiting.")));
        assert!(cards[0].next_due.is_none() && cards[1].last_ran.is_none() && cards[1].cadence == "Every 7 days");
        assert_eq!(findings_for_brief(&c)["findings"], json!([]));
    }
}
