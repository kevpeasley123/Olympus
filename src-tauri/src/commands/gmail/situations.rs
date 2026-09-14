//! Incremental situation state and explicit operator edits. Sending is deliberately absent.
pub mod drafts;
pub mod documents;
pub mod engine;
#[cfg(test)]
mod tests;
use super::{now, store};
use crate::commands::{persistence::Db, vault_write::content_fingerprint};
pub use drafts::{situation_draft, situation_save_draft};
pub use engine::situation_refresh;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use tauri::{Manager, State};
const GRAPH: &str = "communication-situations/v1";
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn account(c: &Connection) -> Result<store::Account, String> {
    store::account(c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected".into())
}
fn ensure(c: &Connection, id: &str) -> Result<(), String> {
    c.execute(
        "INSERT OR IGNORE INTO communication_situation_state(account_id) VALUES(?1)",
        [id],
    )
    .map_err(err)?;
    Ok(())
}
fn revision(c: &Connection, id: &str) -> Result<i64, String> {
    c.query_row(
        "SELECT context_revision FROM communication_situation_state WHERE account_id=?1",
        [id],
        |r| r.get(0),
    )
    .map_err(err)
}
fn bump(c: &Connection, id: &str) -> Result<(), String> {
    c.execute("UPDATE communication_situation_state SET context_revision=context_revision+1,last_attempt=0 WHERE account_id=?1",[id]).map_err(err)?;
    Ok(())
}
fn rows(c: &Connection, sql: &str, id: &str) -> Result<Vec<Value>, String> {
    let mut q = c.prepare(sql).map_err(err)?;
    let raw = q
        .query_map([id], |r| r.get::<_, String>(0))
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    raw.into_iter()
        .map(|s| serde_json::from_str(&s).map_err(err))
        .collect()
}
fn situations(c: &Connection, id: &str) -> Result<Vec<Value>, String> {
    rows(c,"SELECT json_object('id',id,'title',title,'state',state,'mergedInto',merged_into,'briefing',json(briefing_json),'updatedAt',updated_at) FROM communication_situations WHERE account_id=?1 ORDER BY CASE WHEN state IN ('emerging','active') THEN 0 ELSE 1 END,updated_at DESC,rowid DESC LIMIT 96",id)
}
fn updates(c: &Connection, id: &str) -> Result<Vec<Value>, String> {
    rows(c,"SELECT json_object('id',id,'situationId',situation_id,'text',text,'at',at) FROM (SELECT * FROM communication_situation_updates WHERE account_id=?1 ORDER BY rowid DESC LIMIT 32) ORDER BY at",id)
}
fn observations(c: &Connection, id: &str) -> Result<Vec<Value>, String> {
    rows(c,"SELECT json_set(payload_json,'$.situationId',situation_id,'$.signature',signature,'$.updatedAt',updated_at) FROM communication_situation_sources WHERE account_id=?1 ORDER BY updated_at DESC,rowid DESC LIMIT 2000",id)
}
/// Fingerprints cover all eligible messages, even those outside the four-message excerpt cap.
fn thread_signatures(
    c: &Connection,
    a: &store::Account,
) -> Result<BTreeMap<String, (String, i64)>, String> {
    let mut q=c.prepare("SELECT id,thread_id,fingerprint,internal_date FROM gmail_messages WHERE account_id=?1 AND available=1 AND in_scope=1 AND internal_date BETWEEN ?2 AND ?3 ORDER BY thread_id,internal_date,id LIMIT 2001").map_err(err)?;
    let time = chrono::Utc::now().timestamp_millis();
    let rows = q
        .query_map(
            params![a.id, time - i64::from(a.horizon_days) * 86_400_000, time],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            },
        )
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    if rows.len() > 2000 {
        return Err("situation_cache_budget".into());
    }
    let mut grouped: BTreeMap<String, (String, i64)> = BTreeMap::new();
    for (id, t, fp, date) in rows {
        let entry = grouped.entry(t).or_default();
        entry.0.push_str(&format!("{id}:{fp}:{date}\n"));
        entry.1 = date;
    }
    for value in grouped.values_mut() {
        value.0 = content_fingerprint(&value.0);
    }
    Ok(grouped)
}
fn current(o: &Value, signatures: &BTreeMap<String, (String, i64)>) -> bool {
    o["threadId"]
        .as_str()
        .and_then(|id| signatures.get(id))
        .is_some_and(|s| o["signature"] == s.0)
}
fn snapshot(c: &Connection) -> Result<Value, String> {
    let a = account(c)?;
    ensure(c, &a.id)?;
    let signatures = thread_signatures(c, &a)?;
    let mut sources = observations(c, &a.id)?;
    for s in &mut sources {
        s["current"] = json!(current(s, &signatures));
    }
    let mut situations = situations(c, &a.id)?;
    for s in &mut situations {
        // Attach only at the UI boundary. Discovery and drafts use situations(),
        // which deliberately does not load private document context.
        let local: Option<String> = c.query_row(
            "SELECT payload_json FROM communication_situation_contexts WHERE account_id=?1 AND situation_id=?2",
            params![a.id,s["id"].as_str()], |r|r.get(0),
        ).optional().map_err(err)?;
        if let Some(local) = local { s["localContext"] = serde_json::from_str(&local).map_err(err)?; }
        s["stale"] = json!(
            s["briefing"]["contextRevision"] != revision(c, &a.id)?
                || s["briefing"]["sourceSignatures"]
                    != engine::source_signatures(&sources, &s["id"], &signatures)
        );
    }
    let latest=c.query_row("SELECT payload_json FROM communication_runs WHERE account_id=?1 AND json_extract(payload_json,'$.graph')=?2 ORDER BY rowid DESC LIMIT 1",params![a.id,GRAPH],|r|r.get::<_,String>(0)).optional().map_err(err)?.map(|s|serde_json::from_str::<Value>(&s).map_err(err)).transpose()?;
    let enabled: bool = c
        .query_row(
            "SELECT enabled FROM communication_situation_state WHERE account_id=?1",
            [&a.id],
            |r| r.get(0),
        )
        .map_err(err)?;
    let mut drafts=rows(c,"SELECT json_set(payload_json,'$.id',id,'$.threadId',thread_id,'$.situationId',situation_id,'$.revision',revision,'$.updatedAt',updated_at) FROM communication_situation_drafts WHERE account_id=?1 ORDER BY updated_at DESC LIMIT 100",&a.id)?;
    for d in &mut drafts {
        d["stale"] = json!(d["threadId"]
            .as_str()
            .and_then(|id| signatures.get(id))
            .is_none_or(|s| d["sourceStamp"] != s.0));
    }
    let background_error: Option<String> = c
        .query_row(
            "SELECT last_error FROM communication_situation_state WHERE account_id=?1",
            [&a.id],
            |r| r.get(0),
        )
        .map_err(err)?;
    Ok(
        json!({"backgroundError":background_error,"accountId":a.id,"enabled":enabled,"situations":situations,"observations":sources.into_iter().filter(|s|s["relevant"]==true).collect::<Vec<_>>(),"updates":updates(c,&a.id)?,"drafts":drafts,"run":latest,"horizonDays":a.horizon_days}),
    )
}
#[tauri::command]
pub fn situation_snapshot(db: State<'_, Db>) -> Result<Value, String> {
    snapshot(&*db.0.lock().map_err(|_| "database_busy")?)
}
#[tauri::command]
pub fn situation_set_background(db: State<'_, Db>, enabled: bool) -> Result<(), String> {
    let c = db.0.lock().map_err(|_| "database_busy")?;
    let a = account(&c)?;
    ensure(&c, &a.id)?;
    c.execute("UPDATE communication_situation_state SET enabled=?2,context_revision=context_revision+1,last_attempt=0 WHERE account_id=?1",params![a.id,enabled]).map_err(err)?;
    Ok(())
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRequest {
    pub situation_id: String,
    pub text: String,
}
#[tauri::command]
pub fn situation_update(db: State<'_, Db>, request: UpdateRequest) -> Result<(), String> {
    if !super::situation_contract::bounded(&request.text, 12000) {
        return Err("update_requires_1_to_12000_characters".into());
    }
    let mut c = db.0.lock().map_err(|_| "database_busy")?;
    let a = account(&c)?;
    ensure(&c, &a.id)?;
    editable(&c, &a.id, &request.situation_id)?;
    let tx = c.transaction().map_err(err)?;
    tx.execute(
        "INSERT INTO communication_situation_updates VALUES(?1,?2,?3,?4,?5)",
        params![
            a.id,
            crate::commands::delegation::run_id(),
            request.situation_id,
            request.text,
            now()
        ],
    )
    .map_err(err)?;
    bump(&tx, &a.id)?;
    tx.commit().map_err(err)
}
fn editable(c: &Connection, account: &str, id: &str) -> Result<(), String> {
    let yes:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM communication_situations WHERE account_id=?1 AND id=?2 AND state NOT IN ('dismissed','merged'))",params![account,id],|r|r.get(0)).map_err(err)?;
    if yes {
        Ok(())
    } else {
        Err("situation_unavailable".into())
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Edit {
    Rename,
    Dismiss,
    Restore,
    Merge,
    Close,
}
#[tauri::command]
pub fn situation_edit(
    db: State<'_, Db>,
    id: String,
    action: Edit,
    value: String,
) -> Result<(), String> {
    edit(
        &mut *db.0.lock().map_err(|_| "database_busy")?,
        &id,
        action,
        &value,
    )
}
fn edit(c: &mut Connection, id: &str, action: Edit, value: &str) -> Result<(), String> {
    let a = account(c)?;
    ensure(c, &a.id)?;
    let source = situations(c, &a.id)?
        .into_iter()
        .find(|s| s["id"] == id)
        .ok_or("situation_unavailable")?;
    if source["state"] == "merged" {
        return Err("situation_already_merged".into());
    }
    let tx = c.transaction().map_err(err)?;
    match action {
        Edit::Rename => {
            if !super::situation_contract::bounded(value, 100) {
                return Err("title_requires_1_to_100_characters".into());
            }
            tx.execute("UPDATE communication_situations SET title=?3,updated_at=?4 WHERE account_id=?1 AND id=?2",params![a.id,id,value,now()]).map_err(err)?;
        }
        Edit::Merge => {
            if id == value {
                return Err("cannot_merge_into_itself".into());
            }
            editable(&tx, &a.id, value)?;
            let has_context: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM communication_situation_contexts WHERE account_id=?1 AND situation_id IN (?2,?3))",params![a.id,id,value],|r|r.get(0)).map_err(err)?;
            if has_context { return Err("document_context_merge_requires_review".into()); }
            tx.execute("UPDATE communication_situations SET state='merged',merged_into=?3 WHERE account_id=?1 AND id=?2",params![a.id,id,value]).map_err(err)?;
            for table in [
                "communication_situation_sources",
                "communication_situation_updates",
                "communication_situation_drafts",
            ] {
                tx.execute(&format!("UPDATE {table} SET situation_id=?3 WHERE account_id=?1 AND situation_id=?2"),params![a.id,id,value]).map_err(err)?;
            }
        }
        _ => {
            let state = match action {
                Edit::Dismiss => "dismissed",
                Edit::Close => "closed",
                _ => "active",
            };
            tx.execute("UPDATE communication_situations SET state=?3,updated_at=?4 WHERE account_id=?1 AND id=?2",params![a.id,id,state,now()]).map_err(err)?;
        }
    }
    bump(&tx, &a.id)?;
    tx.commit().map_err(err)
}
fn record_outcome(db: &Db, result: &Result<(), String>) {
    if let Ok(c) = db.0.lock() {
        if let Ok(a) = account(&c) {
            if ensure(&c, &a.id).is_ok() {
                let _ = c.execute(
                    "UPDATE communication_situation_state SET last_error=?2 WHERE account_id=?1",
                    params![a.id, result.as_ref().err()],
                );
            }
        }
    }
}
pub fn start_cadence(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(20)).await;
        loop {
            // Unlike the display, this worker remains active when Communications is not selected.
            let db = app.state::<Db>();
            let result = engine::refresh(&db, false).await;
            record_outcome(&db, &result);
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        }
    });
}
