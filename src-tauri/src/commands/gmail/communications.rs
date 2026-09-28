use super::store;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
const DAY: i64 = 86_400_000;
// Only bounded metadata crosses into this local aggregation; bodies stay in SQLite.
pub fn workspace(
    c: &Connection,
    days: u32,
    group: &str,
    sender: &str,
    page: u32,
    now: i64,
) -> Result<Value, String> {
    if ![7, 30, 90, 180, 365].contains(&days)
        || !["inbox", "attention", "actions", "projects", "people"].contains(&group)
        || page > 100
        || sender.len() > 2000
    {
        return Err("gmail_invalid_view".into());
    }
    let a = store::account(c)?
        .filter(|a| a.enabled)
        .ok_or("gmail_not_connected")?;
    let days = days.min(a.horizon_days);
    let cutoff = now - i64::from(days) * DAY;
    let mut stmt=c.prepare("SELECT json_object('id',m.id,'threadId',m.thread_id,'timestamp',m.internal_date,'fingerprint',m.fingerprint,'sender',json_extract(m.snapshot_json,'$.sender'),'subject',json_extract(m.snapshot_json,'$.subject'),'preview',substr(coalesce(json_extract(m.snapshot_json,'$.snippet'),''),1,1000),'labels',json_extract(m.snapshot_json,'$.labels'),'candidates',json((SELECT coalesce(json_group_array(json_object('kind',g.kind,'text',g.text)),'[]') FROM gmail_candidates g WHERE g.account_id=m.account_id AND g.message_id=m.id AND g.source_fingerprint=m.fingerprint))) FROM gmail_messages m WHERE m.account_id=?1 AND m.available=1 AND m.in_scope=1 AND m.internal_date>=?2 AND m.internal_date<=?3 ORDER BY m.internal_date DESC,m.id LIMIT 2001").map_err(|_|"gmail_database_read_failed")?;
    let raw = stmt
        .query_map(params![a.id, cutoff, now], |r| r.get::<_, String>(0))
        .map_err(|_| "gmail_database_read_failed")?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "gmail_database_read_failed")?;
    if raw.len() > 2000 {
        return Err("gmail_scope_limit_reduce_horizon".into());
    }
    let mut rows: Vec<Value> = raw
        .iter()
        .map(|s| serde_json::from_str(s).map_err(|_| "gmail_normalization_failed".to_string()))
        .collect::<Result<_, _>>()?;
    for row in &mut rows {
        let snippet = row["preview"].as_str().unwrap_or("");
        // Provider snippets are display text. Escape literal brackets before entity
        // decoding; never use converted body markup or alter stored evidence.
        let escaped = snippet.replace('<', "&lt;").replace('>', "&gt;");
        row["preview"] = Value::String(
            html2text::from_read(escaped.as_bytes(), 10000)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .chars()
                .take(180)
                .collect(),
        );
    }
    let has = |r: &Value, k: &str| {
        r["candidates"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["kind"] == k)
    };
    let label = |r: &Value, k: &str| {
        r["labels"]
            .as_array()
            .is_some_and(|v| v.iter().any(|x| x == k))
    };
    let attention = rows
        .iter()
        .filter(|r| !r["candidates"].as_array().unwrap().is_empty())
        .count();
    let actions = rows
        .iter()
        .filter(|r| has(r, "possible_response_needed"))
        .count();
    let deadlines = rows.iter().filter(|r| has(r, "possible_deadline")).count();
    let projects = rows
        .iter()
        .filter(|r| has(r, "possible_project_relationship"))
        .count();
    let mut senders: BTreeMap<String, usize> = BTreeMap::new();
    let mut activity = BTreeMap::<i64, (usize, usize)>::new();
    for day in cutoff / DAY..=now / DAY {
        activity.insert(day, (0, 0));
    }
    for r in &rows {
        let sent = label(r, "SENT");
        if !sent {
            *senders
                .entry(r["sender"].as_str().unwrap_or("").into())
                .or_default() += 1;
        }
        let bucket = activity
            .entry(r["timestamp"].as_i64().unwrap() / DAY)
            .or_default();
        if sent {
            bucket.1 += 1
        } else {
            bucket.0 += 1
        }
    }
    let mut people = senders
        .into_iter()
        .map(|(sender, count)| json!({"sender":sender,"count":count}))
        .collect::<Vec<_>>();
    people.sort_by(|a, b| {
        b["count"]
            .as_u64()
            .cmp(&a["count"].as_u64())
            .then(a["sender"].as_str().cmp(&b["sender"].as_str()))
    });
    let selected: Vec<_> = rows
        .iter()
        .filter(|r| match group {
            "inbox" => label(r, "INBOX"),
            "attention" => !r["candidates"].as_array().unwrap().is_empty(),
            "actions" => has(r, "possible_response_needed"),
            "projects" => has(r, "possible_project_relationship"),
            "people" => !label(r, "SENT") && (sender.is_empty() || r["sender"] == sender),
            _ => false,
        })
        .collect();
    Ok(
        json!({"days":days,"horizonDays":a.horizon_days,"total":rows.len(),"attention":attention,"actions":actions,"deadlines":deadlines,"projects":projects,"inbox":rows.iter().filter(|r|label(r,"INBOX")).count(),"sent":rows.iter().filter(|r|label(r,"SENT")).count(),"threads":rows.iter().map(|r|r["threadId"].as_str().unwrap()).collect::<BTreeSet<_>>().len(),"people":people,"activity":activity.into_iter().map(|(d,(received,sent))|json!({"timestamp":d*DAY,"received":received,"sent":sent})).collect::<Vec<_>>(),"matches":selected.len(),"signals":rows.iter().filter(|r|!r["candidates"].as_array().unwrap().is_empty()).take(3).collect::<Vec<_>>(),"rows":selected.into_iter().skip(page as usize*40).take(40).collect::<Vec<_>>(),"page":page,"comparison":null}),
    )
}
