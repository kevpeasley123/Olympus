use super::{mime::Mail, now, SCOPE};
pub fn remove_cache(c: &mut Connection, id: &str) -> Result<(), String> {
    let tx = c.transaction().map_err(|_| "gmail_database_write_failed")?;
    for table in [
        "gmail_messages",
        "gmail_search",
        "gmail_candidates",
        "gmail_sync_runs",
    ] {
        tx.execute(&format!("DELETE FROM {table} WHERE account_id=?1"), [id])
            .map_err(|_| "gmail_database_write_failed")?;
    }
    tx.execute("UPDATE gmail_accounts SET history_id=NULL,last_success=NULL,last_attempt=NULL WHERE id=?1 AND enabled=0",[id]).map_err(|_|"gmail_database_write_failed")?;
    tx.commit()
        .map_err(|_| "gmail_database_commit_failed".into())
}
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub email: String,
    pub enabled: bool,
    pub status: String,
    pub scopes: String,
    pub connected_at: String,
    pub horizon_days: u32,
    pub history_id: Option<String>,
    pub last_attempt: Option<String>,
    pub last_success: Option<String>,
    pub last_error: Option<String>,
    pub next_sync: Option<String>,
}
pub fn account(c: &Connection) -> Result<Option<Account>, String> {
    c.query_row("SELECT id,email,enabled,status,scopes,connected_at,horizon_days,history_id,last_attempt,last_success,last_error,next_sync FROM gmail_accounts ORDER BY enabled DESC,connected_at DESC LIMIT 1",[],|r|Ok(Account{id:r.get(0)?,email:r.get(1)?,enabled:r.get(2)?,status:r.get(3)?,scopes:r.get(4)?,connected_at:r.get(5)?,horizon_days:r.get(6)?,history_id:r.get(7)?,last_attempt:r.get(8)?,last_success:r.get(9)?,last_error:r.get(10)?,next_sync:r.get(11)?})).optional().map_err(|_|"gmail_database_read_failed".into())
}
pub fn connect(c: &Connection, id: &str, email: &str, horizon: u32) -> Result<(), String> {
    c.execute("INSERT INTO gmail_accounts(id,email,enabled,status,scopes,connected_at,horizon_days) VALUES (?1,?2,1,'connected',?3,?4,?5) ON CONFLICT(id) DO UPDATE SET enabled=1,status='connected',scopes=excluded.scopes,connected_at=excluded.connected_at,horizon_days=excluded.horizon_days,history_id=NULL,last_error=NULL",params![id,email,SCOPE,now(),horizon]).map_err(|_|"gmail_database_write_failed")?;
    Ok(())
}
pub fn cached_ids(c: &Connection, account: &str, horizon: u32) -> Result<Vec<String>, String> {
    let mut s=c.prepare("SELECT id FROM gmail_messages WHERE account_id=?1 AND in_scope=1 AND internal_date>=?2 LIMIT 2001").map_err(|_|"gmail_database_read_failed")?;
    let rows = s
        .query_map(
            params![
                account,
                chrono::Utc::now().timestamp_millis() - i64::from(horizon) * 86_400_000
            ],
            |r| r.get(0),
        )
        .map_err(|_| "gmail_database_read_failed")?;
    rows.collect::<Result<_, _>>()
        .map_err(|_| "gmail_database_read_failed".into())
}
pub fn disconnect(c: &Connection, id: &str) -> Result<(), String> {
    c.execute("UPDATE gmail_accounts SET enabled=0,status='disconnected',next_sync=NULL,last_error=NULL WHERE id=?1",[id]).map_err(|_|"gmail_database_write_failed")?;
    Ok(())
}
pub fn commit(
    c: &mut Connection,
    account: &Account,
    messages: &[Mail],
    deleted: &[String],
    cursor: &str,
    full: bool,
    projects: &[String],
) -> Result<(), String> {
    let tx = c.transaction().map_err(|_| "gmail_database_write_failed")?;
    let enabled: bool = tx
        .query_row(
            "SELECT enabled FROM gmail_accounts WHERE id=?1",
            [&account.id],
            |r| r.get(0),
        )
        .map_err(|_| "gmail_database_read_failed")?;
    if !enabled {
        return Err("gmail_disconnected_during_sync".into());
    }
    if full {
        tx.execute(
            "UPDATE gmail_messages SET in_scope=0 WHERE account_id=?1",
            [&account.id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_search WHERE account_id=?1",
            [&account.id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_candidates WHERE account_id=?1",
            [&account.id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
    }
    for mail in messages {
        let scope = super::mime::in_scope(mail, account.horizon_days);
        tx.execute("INSERT INTO gmail_messages(account_id,id,thread_id,internal_date,available,in_scope,fingerprint,snapshot_json) VALUES (?1,?2,?3,?4,1,?5,?6,?7) ON CONFLICT(account_id,id) DO UPDATE SET thread_id=excluded.thread_id,internal_date=excluded.internal_date,available=1,in_scope=excluded.in_scope,fingerprint=excluded.fingerprint,snapshot_json=excluded.snapshot_json",params![account.id,mail.id,mail.thread_id,mail.internal_date,scope,mail.fingerprint,serde_json::to_string(mail).map_err(|_|"gmail_normalization_failed")?]).map_err(|_|"gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_search WHERE account_id=?1 AND message_id=?2",
            params![account.id, mail.id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_candidates WHERE account_id=?1 AND message_id=?2",
            params![account.id, mail.id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        if scope {
            tx.execute("INSERT INTO gmail_search(account_id,message_id,subject,sender,body) VALUES (?1,?2,?3,?4,?5)",params![account.id,mail.id,mail.subject,mail.sender,mail.clean_text]).map_err(|_|"gmail_database_write_failed")?;
            if mail.labels.iter().any(|l| l == "INBOX") {
                let text = format!("{} {}", mail.subject, mail.clean_text).to_lowercase();
                let matches = projects
                    .iter()
                    .filter(|p| p.chars().count() >= 4 && text.contains(&p.to_lowercase()))
                    .take(3)
                    .cloned()
                    .collect::<Vec<_>>();
                let important = mail.labels.iter().any(|l| l == "IMPORTANT") || !matches.is_empty();
                let mut candidates = Vec::new();
                if !matches.is_empty() {
                    candidates.push((
                        "possible_project_relationship",
                        format!(
                            "Possible project relationship: {}. Review against project intent.",
                            matches.join(", ")
                        ),
                    ));
                }
                if important && text.contains('?') {
                    candidates.push(("possible_response_needed","Possible response needed; question detected in relevant or Gmail-important mail. Review the source.".into()));
                }
                if important && (text.contains("deadline") || text.contains("due by")) {
                    candidates.push((
                        "possible_deadline",
                        "Possible deadline mentioned. This is not an operator commitment.".into(),
                    ));
                }
                for (kind, text) in candidates {
                    tx.execute("INSERT INTO gmail_candidates(account_id,message_id,source_fingerprint,kind,text,created_at) VALUES (?1,?2,?3,?4,?5,?6)",params![account.id,mail.id,mail.fingerprint,kind,text,now()]).map_err(|_|"gmail_database_write_failed")?;
                }
            }
        }
    }
    for id in deleted {
        tx.execute(
            "UPDATE gmail_messages SET available=0,in_scope=0 WHERE account_id=?1 AND id=?2",
            params![account.id, id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_search WHERE account_id=?1 AND message_id=?2",
            params![account.id, id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
        tx.execute(
            "DELETE FROM gmail_candidates WHERE account_id=?1 AND message_id=?2",
            params![account.id, id],
        )
        .map_err(|_| "gmail_database_write_failed")?;
    }
    // Scope rolls forward even if Gmail reports no changes to old messages.
    let cutoff =
        chrono::Utc::now().timestamp_millis() - i64::from(account.horizon_days) * 86_400_000;
    tx.execute(
        "UPDATE gmail_messages SET in_scope=0 WHERE account_id=?1 AND internal_date<?2",
        params![account.id, cutoff],
    )
    .map_err(|_| "gmail_database_write_failed")?;
    tx.execute("DELETE FROM gmail_search WHERE account_id=?1 AND message_id IN (SELECT id FROM gmail_messages WHERE account_id=?1 AND in_scope=0)",[&account.id]).map_err(|_|"gmail_database_write_failed")?;
    tx.execute("DELETE FROM gmail_candidates WHERE account_id=?1 AND message_id IN (SELECT id FROM gmail_messages WHERE account_id=?1 AND in_scope=0)",[&account.id]).map_err(|_|"gmail_database_write_failed")?;
    tx.execute("UPDATE gmail_accounts SET history_id=?2,status='connected',last_success=?3,last_error=NULL,next_sync=?4 WHERE id=?1 AND enabled=1",params![account.id,cursor,now(),(chrono::Utc::now()+chrono::Duration::minutes(5)).to_rfc3339()]).map_err(|_|"gmail_database_write_failed")?;
    tx.commit()
        .map_err(|_| "gmail_database_commit_failed".into())
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Excerpt {
    pub provider: String,
    pub account_id: String,
    pub message_id: String,
    pub thread_id: String,
    pub sender: String,
    pub subject: String,
    pub timestamp: i64,
    pub excerpt: String,
    pub fingerprint: String,
    pub retrieved_at: String,
    pub body_status: String,
    pub cached_thread_subset: bool,
}
pub fn communication_query(q: &str) -> bool {
    let q = q.to_lowercase();
    [
        "email",
        "e-mail",
        "gmail",
        "mailbox",
        "inbox",
        "closing documents",
        "what did",
        "who said",
        "did anyone",
        "message from",
    ]
    .iter()
    .any(|p| q.contains(p))
}
pub fn search(c: &Connection, question: &str, explicit: bool) -> Result<Vec<Excerpt>, String> {
    if !explicit && !communication_query(question) {
        return Ok(Vec::new());
    }
    let stop = [
        "what", "did", "say", "said", "about", "email", "emails", "gmail", "anyone", "recently",
        "the", "and", "from", "with", "have", "does", "this", "that", "tell", "show", "mail",
        "messages", "message",
    ];
    let words = question
        .split(|c: char| !c.is_alphanumeric())
        .map(str::to_lowercase)
        .filter(|s| s.chars().count() > 2 && !stop.contains(&s.as_str()))
        .take(12)
        .collect::<Vec<_>>();
    let Some(account) = account(c)?.filter(|a| a.enabled) else {
        return Ok(Vec::new());
    };
    let cutoff =
        chrono::Utc::now().timestamp_millis() - i64::from(account.horizon_days) * 86_400_000;
    let mut threads = Vec::new();
    let mut matched = std::collections::HashMap::<String, Mail>::new();
    if let Some(id) = question
        .split("[Gmail thread: ")
        .nth(1)
        .and_then(|s| s.split(']').next())
        .filter(|s| super::provider_id(s))
    {
        threads.push(id.to_string());
    } else if words.is_empty() {
        let mut s=c.prepare("SELECT thread_id FROM gmail_messages WHERE account_id=?1 AND available=1 AND in_scope=1 AND internal_date>=?2 GROUP BY thread_id ORDER BY max(internal_date) DESC LIMIT 2").map_err(|_|"gmail_search_failed")?;
        threads = s
            .query_map(params![account.id, cutoff], |r| r.get(0))
            .map_err(|_| "gmail_search_failed")?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|_| "gmail_search_failed")?;
    } else {
        let query = words
            .iter()
            .map(|w| format!("\"{w}\"*"))
            .collect::<Vec<_>>()
            .join(" AND ");
        let mut s=c.prepare("SELECT m.thread_id,m.snapshot_json FROM gmail_search JOIN gmail_messages m ON m.account_id=gmail_search.account_id AND m.id=gmail_search.message_id WHERE gmail_search MATCH ?1 AND m.account_id=?2 AND m.available=1 AND m.in_scope=1 AND m.internal_date>=?3 ORDER BY rank LIMIT 12").map_err(|_|"gmail_search_failed")?;
        let values = s
            .query_map(params![query, account.id, cutoff], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|_| "gmail_search_failed")?;
        for value in values {
            let (value, snapshot) = value.map_err(|_| "gmail_search_failed")?;
            let mail: Mail = serde_json::from_str(&snapshot).map_err(|_| "gmail_cache_corrupt")?;
            matched.entry(value.clone()).or_insert(mail);
            if !threads.contains(&value) {
                threads.push(value)
            }
            if threads.len() == 2 {
                break;
            }
        }
    }
    let mut result = Vec::new();
    for thread in threads {
        let mut messages = thread_messages(c, &account.id, &thread, 4)?;
        if let Some(hit) = matched.remove(&thread) {
            if !messages.iter().any(|m| m.id == hit.id) {
                if messages.len() == 4 {
                    messages.remove(0);
                }
                messages.push(hit);
                messages.sort_by_key(|m| m.internal_date);
            }
        }
        for mail in messages {
            result.push(Excerpt {
                provider: "gmail".into(),
                account_id: account.id.clone(),
                message_id: mail.id,
                thread_id: mail.thread_id,
                sender: mail.sender,
                subject: mail.subject,
                timestamp: mail.internal_date,
                excerpt: relevant_excerpt(&mail.clean_text, &words),
                fingerprint: mail.fingerprint,
                retrieved_at: mail.retrieved_at,
                body_status: mail.body_status,
                cached_thread_subset: true,
            })
        }
    }
    Ok(result)
}
pub fn thread_messages(
    c: &Connection,
    account: &str,
    thread: &str,
    limit: usize,
) -> Result<Vec<Mail>, String> {
    let mut s=c.prepare("SELECT snapshot_json FROM gmail_messages WHERE account_id=?1 AND thread_id=?2 AND available=1 AND in_scope=1 AND internal_date>=?4 ORDER BY internal_date DESC LIMIT ?3").map_err(|_|"gmail_search_failed")?;
    let horizon: u32 = c
        .query_row(
            "SELECT horizon_days FROM gmail_accounts WHERE id=?1",
            [account],
            |r| r.get(0),
        )
        .map_err(|_| "gmail_search_failed")?;
    let cutoff = chrono::Utc::now().timestamp_millis() - i64::from(horizon) * 86_400_000;
    let rows = s
        .query_map(params![account, thread, limit.min(100), cutoff], |r| {
            r.get::<_, String>(0)
        })
        .map_err(|_| "gmail_search_failed")?;
    let mut result = rows
        .map(|r| {
            serde_json::from_str(&r.map_err(|_| "gmail_search_failed")?)
                .map_err(|_| "gmail_cache_corrupt".to_string())
        })
        .collect::<Result<Vec<Mail>, String>>()?;
    result.reverse();
    Ok(result)
}

fn relevant_excerpt(text: &str, words: &[String]) -> String {
    let lower = text.to_lowercase();
    let byte = words
        .iter()
        .filter_map(|w| lower.find(w))
        .min()
        .unwrap_or(0);
    let char_index = lower[..byte].chars().count();
    let start = char_index.saturating_sub(400);
    let excerpt: String = text.chars().skip(start).take(2500).collect();
    format!(
        "{}{}{}",
        if start > 0 { "[excerpt begins] " } else { "" },
        excerpt,
        if text.chars().count() > start + 2500 {
            " [excerpt continues]"
        } else {
            ""
        }
    )
}
