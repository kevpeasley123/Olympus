//! Kevin's expectations of Olympus and how well it meets them
//! (docs/VISION-REVIEW.md).
//!
//! Kevin cannot put the vision in numbers, so Olympus takes them from his own
//! words: each expectation quotes what he said, when and where, and names the
//! code checks that test it. A check is a rule with no opinion; an expectation
//! without one waits for the weekly review's judgment. New expectations arrive
//! as proposals and count only once Kevin approves them; he can retire any.
//! The vision score is the share of approved expectations' checks that passed
//! over the last week.

use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;
use tauri::State;

use super::persistence::Db;

pub struct Seed {
    pub id: &'static str,
    pub statement: &'static str,
    pub kevin_said: &'static str,
    /// The day he said it, or only the month when the day is not on record.
    pub said_on: &'static str,
    pub source: &'static str,
    pub checks: &'static [&'static str],
}

/// What Kevin has asked of Olympus, in his words, proposed for his approval.
/// Statements address him, since he reads and approves them.
/// Add to the end; an id once shipped keeps its meaning.
pub const SEEDS: &[Seed] = &[
    Seed { id: "brief-spoken", statement: "The opening brief sounds like a spoken update, not a typed report: short, plain, no labels or bookkeeping.",
        kevin_said: "It sounds too much like a typed response I would see. I want to make it seem conversational. It can touch on all of these same points but this is too wordy for a verbal update.",
        said_on: "2026-11-14", source: "Claude Code session",
        checks: &["brief.spoken-length", "brief.no-written-dates", "brief.no-version-numbers", "brief.no-labels", "brief.no-source-narration", "brief.no-exclamation", "brief.says-it-once", "brief.no-build-notes"] },
    Seed { id: "brief-greeting", statement: "Each opening brief starts with a greeting suited to the time of day.",
        kevin_said: "For these opening briefs, can you have olympus start with \"Good evening, sir.\" Or \"Good morning, sir\" or \"Welcome back\".",
        said_on: "2026-11-14", source: "Claude Code session", checks: &["brief.greeting"] },
    Seed { id: "brief-settled", statement: "Something you've said is handled stays out of later briefs unless something new happens.",
        kevin_said: "Why would it keep appearing in briefs if I just told you it was resolved. You should be able to put together in future briefs that we establsihed it here.",
        said_on: "2026-11-14", source: "Olympus chat", checks: &["brief.settled-stays-out"] },
    Seed { id: "brief-delivered", statement: "A brief arrives whenever Olympus opens; a failed brief is the exception.",
        kevin_said: "Not having a brief is problematic because it makes me doubt if olympus is maintaining an understanding of my life and workflows.",
        said_on: "2026-11", source: "Claude Code session", checks: &["brief.delivered"] },
    Seed { id: "bounded-retries", statement: "Self-correction never runs away with the token allowance: every retry is capped.",
        kevin_said: "Obviously I don't want an infinite retry loop to destroy my token allowance, so having some safety nets to prevent that would be nice.",
        said_on: "2026-11-15", source: "Claude Code session", checks: &["loops.capped"] },
    Seed { id: "stop-for-writes", statement: "Olympus acts on its own for reading and stops for your approval before anything it writes.",
        kevin_said: "Approve the last step means olympus stopping for writes for now. I might revisit that later too.",
        said_on: "2026-11-15", source: "Claude Code session", checks: &[] },
    Seed { id: "no-babysitting", statement: "Once you've communicated a vision, Olympus carries it forward and improves without being driven turn by turn.",
        kevin_said: "I generally don't want to have to babysit an idea if I feel like i've communicated the vision to olympus. I want it to be able to improve itself over time because it knows my workflows and preferences.",
        said_on: "2026-11-15", source: "Claude Code session", checks: &[] },
    Seed { id: "fix-without-testing", statement: "Problems are found and fixed without you having to test back and forth.",
        kevin_said: "This back and forth isn't working for me. You need to find a better solution so you can be troubleshooting these issues. Needing me to manually test so often is a problem.",
        said_on: "2026-11", source: "Claude Code session", checks: &[] },
    Seed { id: "chat-or-voice", statement: "You talk to Olympus only through the chat window or the microphone, so everything you need is reachable there.",
        kevin_said: "I'm only going to be communicating with olympus through that chat window or microphone.",
        said_on: "2026-11", source: "Claude Code session", checks: &[] },
];

/// Adds any seed not yet in the ledger as a proposal. Never touches one that
/// exists, so Kevin's approval or retirement stands.
pub fn seed(connection: &Connection) -> rusqlite::Result<()> {
    for s in SEEDS {
        connection.execute(
            "INSERT OR IGNORE INTO expectations (id, statement, kevin_said, said_on, source, checks_json, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'proposed')",
            params![s.id, s.statement, s.kevin_said, s.said_on, s.source, serde_json::to_string(s.checks).unwrap_or_else(|_| "[]".into())],
        )?;
        // Which checks measure a seeded expectation is code's to say; Kevin's status on it stands.
        connection.execute("UPDATE expectations SET checks_json = ?2 WHERE id = ?1 AND checks_json <> ?2", params![s.id, serde_json::to_string(s.checks).unwrap_or_else(|_| "[]".into())])?;
    }
    Ok(())
}

/// A new expectation from Kevin's own words, found by the weekly review, as a
/// proposal he decides on. The same quote twice is one proposal.
pub fn propose(connection: &Connection, statement: &str, kevin_said: &str, said_on: &str, source: &str) -> rusqlite::Result<()> {
    if statement.trim().is_empty() || kevin_said.trim().is_empty() {
        return Ok(());
    }
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    kevin_said.trim().to_lowercase().hash(&mut hasher);
    connection.execute(
        "INSERT OR IGNORE INTO expectations (id, statement, kevin_said, said_on, source, checks_json, status) VALUES (?1, ?2, ?3, ?4, ?5, '[]', 'proposed')",
        params![format!("said-{:x}", hasher.finish()), statement.trim(), kevin_said.trim(), said_on.trim(), source],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct CheckResult {
    pub id: &'static str,
    pub passed: bool,
    pub detail: String,
}
fn result(id: &'static str, failures: Vec<String>) -> CheckResult {
    CheckResult { id, passed: failures.is_empty(), detail: failures.join("; ") }
}

const MONTHS: &[&str] = &["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december"];
const NARRATION: &[&str] = &["gmail is connected", "mail is current", "since your last brief", "since the last brief", "no new mail has come in", "i checked", "i looked at", "according to my sources"];
const STOP: &[&str] = &["that", "this", "with", "from", "your", "have", "still", "about", "kevin", "there", "their", "which", "would", "been", "were", "they", "what", "when", "will"];

/// How a commit or a release is described, which is never how a change is said to Kevin.
const BUILD_NOTES: &[&str] = &["pull request", " commit", "merged", " branch", "has an update that", "new release"];
/// "analysis" and "analyze", "shipped" and "shipping": close enough to count as the same word heard twice.
fn stem(word: &str) -> String { word.chars().take(5).collect() }

/// Kevin's expectations of the spoken brief, as rules. `brief` is the spoken
/// text without Olympus's greeting; `settled` the matters he has closed.
pub fn check_brief(brief: &str, settled: &[String]) -> Vec<CheckResult> {
    let lower = brief.to_lowercase();
    let words: Vec<&str> = brief.split_whitespace().collect();
    let mut checks = Vec::new();

    let count = words.len();
    checks.push(result("brief.spoken-length", if count > 110 { vec![format!("{count} words, over the 110 a spoken brief allows")] } else { vec![] }));

    let mut dates = Vec::new();
    for pair in words.windows(2) {
        let first = pair[0].trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
        if MONTHS.contains(&first.as_str()) && pair[1].chars().next().is_some_and(|c| c.is_ascii_digit()) {
            dates.push(format!("\"{} {}\"", pair[0], pair[1].trim_end_matches(|c: char| !c.is_alphanumeric())));
        }
    }
    for word in &words {
        let token = word.trim_matches(|c: char| !c.is_alphanumeric());
        let numeric = token.split(['/', '-']).collect::<Vec<_>>();
        if numeric.len() >= 2 && numeric.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())) {
            dates.push(format!("\"{token}\""));
        }
    }
    checks.push(result("brief.no-written-dates", dates));

    let versions: Vec<String> = words.iter().map(|w| w.trim_matches(|c: char| !c.is_alphanumeric() && c != '.').trim_end_matches('.')).filter(|w| {
        let parts: Vec<&str> = w.trim_start_matches('v').split('.').collect();
        parts.len() >= 3 && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
    }).map(|w| format!("\"{w}\"")).collect();
    checks.push(result("brief.no-version-numbers", versions));

    let chars: Vec<char> = brief.chars().collect();
    let mut labels = Vec::new();
    for (i, c) in chars.iter().enumerate() {
        match c {
            ';' => labels.push("a semicolon".to_string()),
            '(' | ')' => labels.push("parentheses".to_string()),
            ':' if !(i > 0 && chars[i - 1].is_ascii_digit() && chars.get(i + 1).is_some_and(|n| n.is_ascii_digit())) => labels.push("a colon".to_string()),
            _ => {}
        }
    }
    labels.dedup();
    checks.push(result("brief.no-labels", labels));

    checks.push(result("brief.no-source-narration", NARRATION.iter().filter(|p| lower.contains(*p)).map(|p| format!("\"{p}\"")).collect()));
    checks.push(result("brief.no-exclamation", if brief.contains('!') { vec!["an exclamation mark".into()] } else { vec![] }));

    let mut reopened = Vec::new();
    for matter in settled {
        let keys: Vec<String> = matter.to_lowercase().split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4 && !STOP.contains(w)).map(str::to_string).collect();
        if keys.len() >= 2 && keys.iter().filter(|k| lower.contains(k.as_str())).count() * 10 >= keys.len() * 6 {
            reopened.push(format!("mentions \"{matter}\""));
        }
    }
    checks.push(result("brief.settled-stays-out", reopened));

    // The brief of 2026-11-16 told Kevin the same thing to do twice. A sentence made
    // almost wholly of words already spoken is a repeat, whatever order they come in.
    let mut heard: Vec<String> = Vec::new();
    let mut repeats = Vec::new();
    for sentence in brief.split_inclusive(['.', '?']).map(str::trim).filter(|s| !s.is_empty()) {
        let mut keys: Vec<String> = sentence.to_lowercase().split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4 && !STOP.contains(w)).map(stem).collect();
        keys.dedup();
        if keys.len() >= 4 && keys.iter().filter(|k| heard.contains(k)).count() * 5 >= keys.len() * 4 {
            repeats.push(format!("\"{sentence}\" repeats what was already said"));
        }
        heard.extend(keys);
    }
    checks.push(result("brief.says-it-once", repeats));
    checks.push(result("brief.no-build-notes", BUILD_NOTES.iter().filter(|p| lower.contains(*p)).map(|p| format!("\"{}\"", p.trim())).collect()));
    checks
}

/// The greeting Olympus adds is its own check, made on the text Kevin hears.
pub fn check_greeting(spoken: &str, greetings: &[&str]) -> CheckResult {
    result("brief.greeting", if greetings.iter().any(|g| spoken.starts_with(g)) { vec![] } else { vec!["no greeting".into()] })
}

/// Records one run's checks. A rewrite of the same run replaces its earlier result.
pub fn record(connection: &Connection, run_id: &str, results: &[CheckResult]) -> rusqlite::Result<()> {
    for r in results {
        connection.execute(
            "INSERT INTO expectation_checks (check_id, run_id, passed, detail) VALUES (?1, ?2, ?3, ?4) \
             ON CONFLICT(check_id, run_id) DO UPDATE SET passed = excluded.passed, detail = excluded.detail, created_at = excluded.created_at",
            params![r.id, run_id, r.passed as i64, (!r.detail.is_empty()).then_some(&r.detail)],
        )?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckStat {
    pub id: String,
    pub passed: i64,
    pub total: i64,
    pub last_failure: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Expectation {
    pub id: String,
    pub statement: String,
    pub kevin_said: String,
    pub said_on: String,
    pub source: String,
    pub status: String,
    pub checks: Vec<CheckStat>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionReport {
    /// Passed over total for approved expectations' checks this week; none before anything ran.
    pub score: Option<f64>,
    pub passed: i64,
    pub total: i64,
    pub expectations: Vec<Expectation>,
}

fn stat(connection: &Connection, check: &str, since: &str) -> rusqlite::Result<CheckStat> {
    // Two checks are read from what runs did rather than recorded per run.
    let (passed, total): (i64, i64) = match check {
        "brief.delivered" => connection.query_row(
            "SELECT COALESCE(SUM(status = 'completed'), 0), COUNT(*) FROM agent_runs WHERE skill_id = 'opening-brief' AND status <> 'running' AND started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1)",
            [since], |r| Ok((r.get(0)?, r.get(1)?)))?,
        "loops.capped" => connection.query_row(
            "SELECT COALESCE(SUM(n <= 1), 0), COUNT(*) FROM (SELECT r.id, (SELECT COUNT(*) FROM agent_events e WHERE e.run_id = r.id AND e.kind = 'message' AND e.summary LIKE 'Retry:%') AS n \
             FROM agent_runs r WHERE r.parent_run IS NULL AND r.status <> 'running' AND r.started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1))",
            [since], |r| Ok((r.get(0)?, r.get(1)?)))?,
        _ => connection.query_row(
            "SELECT COALESCE(SUM(passed), 0), COUNT(*) FROM expectation_checks WHERE check_id = ?1 AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?2)",
            params![check, since], |r| Ok((r.get(0)?, r.get(1)?)))?,
    };
    let last_failure = match check {
        "brief.delivered" => connection.query_row(
            "SELECT error FROM agent_runs WHERE skill_id = 'opening-brief' AND status = 'failed' AND started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1) ORDER BY started_at DESC LIMIT 1",
            [since], |r| r.get(0)).ok().flatten(),
        "loops.capped" => None,
        _ => connection.query_row(
            "SELECT detail FROM expectation_checks WHERE check_id = ?1 AND passed = 0 AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?2) ORDER BY created_at DESC LIMIT 1",
            params![check, since], |r| r.get(0)).ok().flatten(),
    };
    Ok(CheckStat { id: check.into(), passed, total, last_failure })
}

pub fn report(connection: &Connection, days: i64) -> rusqlite::Result<VisionReport> {
    seed(connection)?;
    let since = format!("-{} days", days.clamp(1, 365));
    let mut statement = connection.prepare("SELECT id, statement, kevin_said, said_on, source, status, checks_json FROM expectations ORDER BY status = 'retired', created_at, rowid")?;
    let rows: Vec<(String, String, String, String, String, String, String)> = statement.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)))?.collect::<Result<_, _>>()?;
    let (mut passed, mut total) = (0, 0);
    let mut expectations = Vec::new();
    for (id, statement, kevin_said, said_on, source, status, checks_json) in rows {
        let ids: Vec<String> = serde_json::from_str::<Value>(&checks_json).ok().and_then(|v| v.as_array().cloned()).unwrap_or_default().into_iter().filter_map(|v| v.as_str().map(str::to_string)).collect();
        let checks = ids.iter().map(|c| stat(connection, c, &since)).collect::<Result<Vec<_>, _>>()?;
        if status == "approved" {
            passed += checks.iter().map(|c| c.passed).sum::<i64>();
            total += checks.iter().map(|c| c.total).sum::<i64>();
        }
        expectations.push(Expectation { id, statement, kevin_said, said_on, source, status, checks });
    }
    Ok(VisionReport { score: (total > 0).then(|| passed as f64 / total as f64), passed, total, expectations })
}

#[tauri::command]
pub fn vision_report(db: State<Db>, days: Option<i64>) -> Result<VisionReport, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    report(&connection, days.unwrap_or(7)).map_err(|e| e.to_string())
}

/// Kevin's decision on one expectation: approve a proposal, or retire any.
#[tauri::command]
pub fn set_expectation_status(db: State<Db>, id: String, status: String) -> Result<(), String> {
    if !["approved", "retired", "proposed"].contains(&status.as_str()) {
        return Err("An expectation is proposed, approved or retired.".into());
    }
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    let changed = connection
        .execute("UPDATE expectations SET status = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1", params![id, status])
        .map_err(|e| e.to_string())?;
    if changed == 0 { return Err("No such expectation.".into()); }
    Ok(())
}

/// Skills a proposal may name; `none` is for work that is not about one skill.
pub const PROPOSAL_SKILLS: &[&str] = &["opening-brief", "work-request", "answer-from-sources", "research-assignment", "verification-assignment", "vision-review", "none"];

/// Stores a review's proposals for Kevin to decide on. Running the same review twice changes nothing.
pub fn store_proposals(connection: &Connection, run_id: &str, proposals: &[Value]) -> rusqlite::Result<()> {
    for (position, p) in proposals.iter().enumerate() {
        let skill = p["skill"].as_str().filter(|s| PROPOSAL_SKILLS.contains(s)).unwrap_or("none");
        connection.execute(
            "INSERT OR IGNORE INTO vision_proposals (run_id, position, kind, skill, title, detail, expectation) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![run_id, position as i64, p["kind"].as_str().unwrap_or("build"), skill, p["title"].as_str().unwrap_or(""), p["detail"].as_str().unwrap_or(""), p["expectation"].as_str().unwrap_or("new")],
        )?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Proposal {
    pub id: i64,
    pub run_id: String,
    pub kind: String,
    pub skill: String,
    pub title: String,
    pub detail: String,
    pub expectation: String,
    pub status: String,
    pub created_at: String,
    pub decided_at: Option<String>,
}

/// Build proposals a release has since delivered, by the title the review gave them.
/// Kevin accepted both on 2026-11-15; 0.83.0 built them.
const BUILT: &[&str] = &["Fall back when the usage limit stops a brief", "Stop specialist skills from calling disallowed tools"];

pub fn proposals(connection: &Connection) -> rusqlite::Result<Vec<Proposal>> {
    for title in BUILT {
        connection.execute("UPDATE vision_proposals SET status = 'done', decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE kind = 'build' AND title = ?1 AND status IN ('proposed', 'accepted')", [title])?;
    }
    let mut statement = connection.prepare(
        "SELECT id, run_id, kind, skill, title, detail, expectation, status, created_at, decided_at FROM vision_proposals \
         WHERE status IN ('proposed', 'accepted') OR decided_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days') ORDER BY status <> 'proposed', id DESC LIMIT 60",
    )?;
    let rows = statement.query_map([], |r| Ok(Proposal { id: r.get(0)?, run_id: r.get(1)?, kind: r.get(2)?, skill: r.get(3)?, title: r.get(4)?, detail: r.get(5)?, expectation: r.get(6)?, status: r.get(7)?, created_at: r.get(8)?, decided_at: r.get(9)? }))?;
    rows.collect()
}

/// Kevin's approved instructions for one skill, oldest first: what Olympus has
/// learned to do differently, by his decision. Bounded so guidance never crowds out the task.
pub fn standing_guidance(connection: &Connection, skill: &str) -> Vec<String> {
    let Ok(mut statement) = connection.prepare("SELECT title, detail FROM vision_proposals WHERE kind = 'instruction' AND skill = ?1 AND status = 'accepted' ORDER BY decided_at, id LIMIT 12") else { return Vec::new() };
    statement.query_map([skill], |r| Ok(format!("{}: {}", r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map(|rows| rows.filter_map(Result::ok).map(|line| line.chars().take(1000).collect()).collect()).unwrap_or_default()
}

#[tauri::command]
pub fn vision_proposals(db: State<Db>) -> Result<Vec<Proposal>, String> {
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    proposals(&connection).map_err(|e| e.to_string())
}

/// Kevin's decision on a proposal. Accepting an instruction puts it into effect for its skill;
/// dismissing an accepted one takes it out. `done` marks built work.
#[tauri::command]
pub fn decide_proposal(db: State<Db>, id: i64, status: String) -> Result<(), String> {
    if !["accepted", "dismissed", "done", "proposed"].contains(&status.as_str()) {
        return Err("A proposal is proposed, accepted, dismissed or done.".into());
    }
    let connection = db.0.lock().map_err(|_| "Database unavailable".to_string())?;
    let changed = connection.execute("UPDATE vision_proposals SET status = ?2, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1", params![id, status]).map_err(|e| e.to_string())?;
    if changed == 0 { return Err("No such proposal.".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        crate::commands::migrations::apply(&connection).unwrap();
        connection
    }
    fn failed(results: &[CheckResult]) -> Vec<&'static str> {
        results.iter().filter(|r| !r.passed).map(|r| r.id).collect()
    }

    #[test]
    fn a_spoken_brief_passes_and_a_typed_one_says_what_broke() {
        let spoken = "Quiet one, nothing needs you. Your HexClad pans are still due Wednesday, and the 9:30 call moved to tomorrow.";
        assert!(failed(&check_brief(spoken, &[])).is_empty(), "{:?}", check_brief(spoken, &[]));
        let typed = "Olympus 0.65.0 is now installed! Gmail is connected and current. Still open: the PLC Mountaintop FedEx (tracking 123); HexClad due Nov 18 or 11/18.";
        let results = check_brief(typed, &[]);
        assert_eq!(failed(&results), vec!["brief.no-written-dates", "brief.no-version-numbers", "brief.no-labels", "brief.no-source-narration", "brief.no-exclamation"]);
        assert!(results[1].detail.contains("\"Nov 18\"") && results[1].detail.contains("\"11/18\""), "{}", results[1].detail);
        assert!(results[3].detail.contains("a colon") && results[3].detail.contains("parentheses") && results[3].detail.contains("a semicolon"));
        assert_eq!(failed(&check_brief(&"word ".repeat(111), &[])), vec!["brief.spoken-length"]);
    }

    #[test]
    fn a_settled_matter_counts_only_when_the_brief_names_it() {
        let settled = vec!["FedEx package from PLC Mountaintop".to_string(), "Google passkey sign-in alert".to_string()];
        let reopened = check_brief("The FedEx package from PLC Mountaintop still hasn't arrived.", &settled);
        assert_eq!(failed(&reopened), vec!["brief.settled-stays-out"]);
        assert!(reopened.iter().find(|r| r.id == "brief.settled-stays-out").unwrap().detail.contains("FedEx package"));
        assert!(failed(&check_brief("A new FedEx is due Friday.", &settled)).is_empty(), "one shared word is not the same matter");
        assert!(check_greeting("Good evening, sir. Quiet one.", &["Good evening, sir."]).passed);
        assert!(!check_greeting("Quiet one.", &["Good evening, sir."]).passed);
    }

    #[test]
    fn the_score_counts_approved_expectations_only_and_kevins_decisions_stand() {
        let c = db();
        let first = report(&c, 7).unwrap();
        assert_eq!(first.expectations.len(), SEEDS.len());
        assert!(first.expectations.iter().all(|e| e.status == "proposed") && first.score.is_none(), "nothing counts until Kevin approves it");
        let quoted = first.expectations.iter().find(|e| e.id == "brief-settled").unwrap();
        assert!(quoted.kevin_said.starts_with("Why would it keep appearing") && quoted.said_on == "2026-11-14");

        record(&c, "b1", &check_brief("Olympus 0.65.0 shipped.", &[])).unwrap();
        record(&c, "b2", &check_brief("Quiet one, nothing needs you.", &[])).unwrap();
        c.execute("UPDATE expectations SET status = 'approved' WHERE id = 'brief-spoken'", []).unwrap();
        c.execute("UPDATE expectations SET status = 'retired' WHERE id = 'chat-or-voice'", []).unwrap();
        let later = report(&c, 7).unwrap();
        assert_eq!((later.passed, later.total), (15, 16), "eight rules on two briefs, one broken");
        let version = later.expectations[0].checks.iter().find(|s| s.id == "brief.no-version-numbers").unwrap();
        assert_eq!((version.passed, version.total, version.last_failure.as_deref()), (1, 2, Some("\"0.65.0\"")));
        seed(&c).unwrap();
        assert_eq!(report(&c, 7).unwrap().expectations.iter().find(|e| e.id == "chat-or-voice").unwrap().status, "retired", "seeding never undoes Kevin's decision");

        propose(&c, "Weather in the brief", "I want the brief to mention the weather", "2026-11-15", "Olympus chat").unwrap();
        propose(&c, "Weather, again", "I want the brief to mention the weather", "2026-11-16", "Olympus chat").unwrap();
        assert_eq!(report(&c, 7).unwrap().expectations.iter().filter(|e| e.kevin_said.contains("weather")).count(), 1, "one quote, one proposal");
        record(&c, "b2", &[CheckResult { id: "brief.no-exclamation", passed: false, detail: "x".into() }]).unwrap();

        let proposed = vec![
            serde_json::json!({"kind": "instruction", "skill": "opening-brief", "title": "Skip tracking numbers", "detail": "Say the carrier and day only.", "expectation": "brief-spoken"}),
            serde_json::json!({"kind": "build", "skill": "made-up", "title": "Retry timeouts", "detail": "d", "expectation": "new"})];
        store_proposals(&c, "v1", &proposed).unwrap();
        store_proposals(&c, "v1", &proposed).unwrap();
        let listed = proposals(&c).unwrap();
        assert_eq!(listed.len(), 2, "the same review stored twice is stored once");
        assert_eq!(listed.iter().find(|p| p.kind == "build").unwrap().skill, "none", "an unknown skill is not trusted");
        assert!(standing_guidance(&c, "opening-brief").is_empty(), "nothing is in effect before Kevin accepts it");
        let id = listed.iter().find(|p| p.kind == "instruction").unwrap().id;
        c.execute("UPDATE vision_proposals SET status = 'accepted', decided_at = 'x' WHERE id = ?1", [id]).unwrap();
        assert_eq!(standing_guidance(&c, "opening-brief"), vec!["Skip tracking numbers: Say the carrier and day only.".to_string()]);
        assert!(standing_guidance(&c, "work-request").is_empty());
        assert_eq!(report(&c, 7).unwrap().passed, 14, "a rewrite replaces the run's earlier result");
    }

    #[test]
    fn a_brief_says_each_thing_once_and_leaves_out_how_it_was_built() {
        // Heard by Kevin on 2026-11-16.
        let heard = "The email analysis choice has moved. Olympus now has an update that puts it in the Gmail connection panel instead of Preferences. I still can't see which route you picked. So check it there, then run Analyze by hand in Communications. Also, your HexClad pots and pans and the deep saute pan are due Wednesday. Hugmoom hasn't answered your order status question. Your Hue order has shipped. Check the email analysis choice in the Gmail panel, then run Analyze.";
        let results = check_brief(heard, &[]);
        assert_eq!(failed(&results), vec!["brief.says-it-once", "brief.no-build-notes"]);
        assert!(results.iter().find(|r| r.id == "brief.says-it-once").unwrap().detail.contains("then run Analyze."));
        let fine = "Your HexClad pots and pans are due Wednesday. Hugmoom still hasn't answered about your order. Your Hue order has shipped. Email analysis is running again, so Communications is current. Nothing needs you tonight.";
        assert!(failed(&check_brief(fine, &[])).is_empty());
    }

    #[test]
    fn seeding_again_adds_new_checks_and_keeps_kevins_decision() {
        let c = db();
        seed(&c).unwrap();
        c.execute("UPDATE expectations SET status = 'approved', checks_json = '[\"brief.spoken-length\"]' WHERE id = 'brief-spoken'", []).unwrap();
        seed(&c).unwrap();
        let (status, checks): (String, String) = c.query_row("SELECT status, checks_json FROM expectations WHERE id = 'brief-spoken'", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        assert!(status == "approved" && checks.contains("brief.says-it-once"));
    }

    #[test]
    fn a_build_proposal_a_release_delivered_reads_as_done() {
        let c = db();
        store_proposals(&c, "r1", &[serde_json::json!({"kind": "build", "skill": "none", "title": BUILT[0], "detail": "d", "expectation": "e"}),
            serde_json::json!({"kind": "build", "skill": "none", "title": "Something not built", "detail": "d", "expectation": "e"})]).unwrap();
        let found = proposals(&c).unwrap();
        assert_eq!(found.iter().find(|p| p.title == BUILT[0]).unwrap().status, "done");
        assert_eq!(found.iter().find(|p| p.title == "Something not built").unwrap().status, "proposed");
    }
}
