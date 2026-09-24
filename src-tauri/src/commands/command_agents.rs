//! Read-only operational HUD projection. Never reads Agent Index or runs recovery.
use super::{
    get_vault_path, models,
    persistence::Db,
    research_agents::{self, RESEARCH, VERIFY},
};
use rusqlite::Connection;
use serde_json::{json, Value};
use tauri::State;

fn history(connection: &Connection, role: &str) -> Result<Value, String> {
    // Count dispatched child executions, not parent workflows or planned children.
    let predicate="FROM research_verification_runs r, json_each(r.record_json,'$.agents') a WHERE json_extract(a.value,'$.definition.id')=?1 AND json_extract(a.value,'$.startedAt') IS NOT NULL";
    let count: i64 = connection
        .query_row(&format!("SELECT count(*) {predicate}"), [role], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    let mut query=connection.prepare(&format!("SELECT r.id,json_extract(r.record_json,'$.question'),json_extract(a.value,'$.id'),json_extract(a.value,'$.startedAt'),json_extract(a.value,'$.status'),json_extract(a.value,'$.definition.version') {predicate} ORDER BY json_extract(a.value,'$.startedAt') DESC,r.rowid DESC LIMIT 5")).map_err(|e|e.to_string())?;
    let recent=query.query_map([role],|r|Ok(json!({"parentRunId":r.get::<_,String>(0)?,"question":r.get::<_,String>(1)?,"id":r.get::<_,String>(2)?,"startedAt":r.get::<_,String>(3)?,"status":r.get::<_,String>(4)?,"version":r.get::<_,u32>(5)?}))).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    Ok(
        json!({"count":count,"lastAt":recent.first().and_then(|r|r.get("startedAt")),"recent":recent,"unit":"executions"}),
    )
}
fn snapshot(
    connection: &Connection,
    key_present: bool,
    source_present: bool,
) -> Result<Value, String> {
    let ready = key_present && source_present;
    let reason = if !key_present {
        "OpenAI credentials unavailable"
    } else if !source_present {
        "Research sources unavailable"
    } else {
        "Configured for an attempt; provider access and credit are unverified"
    };
    let mut agents = Vec::new();
    for id in [RESEARCH, VERIFY] {
        let definition = research_agents::definition(id)?;
        let skills = definition
            .skills
            .iter()
            .map(|reference| {
                let label = match reference.as_str() {
                    "research-retrieval@1" => "Research Retrieval",
                    "evidence-synthesis@1" => "Evidence Synthesis",
                    "claim-verification@1" => "Claim Verification",
                    _ => reference,
                };
                json!({"id":reference,"name":label})
            })
            .collect::<Vec<_>>();
        agents.push(json!({"id":id,"name":definition.name,"version":definition.version,"kind":"agent","status":if ready{"AVAILABLE"}else{"UNAVAILABLE"},"tone":if ready{"ready"}else{"unavailable"},"description":if id==RESEARCH{"Finds and synthesizes scoped evidence."}else{"Checks claims against supplied evidence."},"role":definition.purpose,"skills":skills,"authority":"Read-only evidence assessment. No source, project or memory writes; no approval or policy authority.","sourceScope":"Scoped Pantheon Research excerpts only","workflows":[{"id":research_agents::GRAPH,"name":"Research Verification v1","destination":"research"}],"peers":definition.peers,"modelStrategy":format!("{} · {}",models::PRIMARY_MODEL,"medium"),"availability":reason,"history":history(connection,id)?,"evidence":"Compiled role; quality and live acceptance must be assessed from saved runs."}));
    }
    let (count,completed,last):(i64,i64,Option<String>)=connection.query_row("SELECT count(*),coalesce(sum(CASE WHEN phase='completed' THEN 1 ELSE 0 END),0),max(started_at) FROM delegation_runs",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(|e|e.to_string())?;
    agents.push(json!({"id":"coding-delegate","name":"Coding Delegate","version":null,"kind":"legacy","status":if completed==0{"UNPROVEN"}else{"RECORDED"},"tone":"muted","description":"Bounded implementation executor.","role":"Existing Claude Code delegation adapter with separate planning and implementation approval gates.","skills":[],"authority":"Only the explicitly approved project, stage and worktree. Completion requires recorded checks and operator review.","sourceScope":"Approved project / isolated worktree","workflows":[{"id":"coding-delegation","name":"Project delegation","destination":"projects"}],"peers":[],"modelStrategy":models::CODING_MODEL,"availability":"Driver detected in the September 23 audit (Claude Code 2.1.222); current readiness not probed here.","history":{"count":count,"lastAt":last,"recent":[],"unit":"recorded runs"},"evidence":if completed==0{"No completed Olympus delegation runs found. Potentially dormant; not deprecated."}else{"Completed delegation records exist; inspect their project review evidence."}}));
    Ok(
        json!({"observedAt":chrono::Utc::now().to_rfc3339(),"orchestrator":{"id":"olympus","name":"Olympus Core","kind":"orchestrator","version":null,"status":"ACTIVE","tone":"ready","description":"Coordinates workflows, agents, skills and execution.","role":"Coordinates the application's compiled workflows and bounded agents.","capabilities":["Planning","Routing","Fixed graph execution","Bounded agent coordination","Synthesis"],"authority":"Backend-owned routes and existing approval gates. Chat cannot launch agent runs or grant execution consent; writes and Coding execution use their dedicated approval flows.","sourceScope":"Evidence supplied through configured application routes","usedBy":"System-wide orchestration"},"agents":agents}),
    )
}
#[tauri::command]
pub fn command_agent_catalog(db: State<Db>) -> Result<Value, String> {
    let key = std::env::var("OPENAI_API_KEY").is_ok_and(|s| !s.trim().is_empty());
    let sources = get_vault_path().join("02 - Research").is_dir();
    let connection = db.0.lock().map_err(|e| e.to_string())?;
    snapshot(&connection, key, sources)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../../schema.sql")).unwrap();
        super::super::research_verification::recover(&c).unwrap();
        c
    }
    #[test]
    fn hud_has_only_compiled_operational_roles_and_unversioned_coding() {
        let c = db();
        let before = c.total_changes();
        let view = snapshot(&c, true, true).unwrap();
        assert_eq!(c.total_changes(), before);
        assert_eq!(
            view["agents"]
                .as_array()
                .unwrap()
                .iter()
                .map(|a| a["id"].as_str().unwrap())
                .collect::<Vec<_>>(),
            vec!["research", "verification", "coding-delegate"]
        );
        assert_eq!(view["orchestrator"]["id"], "olympus");
        assert_eq!(view["agents"][0]["version"], 1);
        assert!(view["agents"][2]["version"].is_null());
        assert_eq!(view["agents"][2]["status"], "UNPROVEN");
        assert!(!view.to_string().contains("Research Analyst"));
        assert_eq!(view["agents"][0]["history"]["count"], 0);
        assert_eq!(
            snapshot(&c, false, true).unwrap()["agents"][0]["status"],
            "UNAVAILABLE"
        );
        assert_eq!(
            snapshot(&c, true, false).unwrap()["agents"][1]["status"],
            "UNAVAILABLE"
        );
    }
    #[test]
    fn history_counts_dispatched_children_without_recovery_or_fabricated_activity() {
        let c = db();
        let raw = json!({"question":"saved question","agents":[{"id":"r0","definition":{"id":"research","version":1},"startedAt":"2026-09-24T01:00:00Z","status":"completed"},{"id":"r1","definition":{"id":"research","version":1},"startedAt":"2026-09-24T01:02:00Z","status":"failed"},{"id":"v0","definition":{"id":"verification","version":1},"startedAt":null,"status":"pending"}]});
        c.execute("INSERT INTO research_verification_runs(id,status,record_json) VALUES ('parent','running',?1)",params![raw.to_string()]).unwrap();
        let changes = c.total_changes();
        let view = snapshot(&c, true, true).unwrap();
        assert_eq!(view["agents"][0]["history"]["count"], 2);
        assert_eq!(
            view["agents"][0]["history"]["recent"][0]["parentRunId"],
            "parent"
        );
        assert_eq!(
            view["agents"][0]["history"]["lastAt"],
            "2026-09-24T01:02:00Z"
        );
        assert_eq!(view["agents"][1]["history"]["count"], 0);
        assert_eq!(c.total_changes(), changes);
        assert_eq!(
            c.query_row("SELECT status FROM research_verification_runs", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
            "running"
        );
        if let Ok(path) = std::env::var("OLYMPUS_COMMAND_CATALOG_FIXTURE") {
            std::fs::write(
                path,
                serde_json::to_string_pretty(
                    &json!({"empty":snapshot(&db(),true,true).unwrap(),"history":view}),
                )
                .unwrap(),
            )
            .unwrap();
        }
    }
}
