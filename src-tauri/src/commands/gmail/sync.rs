use super::{
    mime::{normalize, Mail},
    store::Account,
    Api, ApiError,
};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    time::{Duration, Instant},
};
pub struct Batch {
    pub messages: Vec<Mail>,
    pub deleted: Vec<String>,
    pub cursor: String,
    pub full: bool,
    pub fallback: bool,
}
fn cursor(v: &Value) -> Result<String, ApiError> {
    v["historyId"]
        .as_str()
        .filter(|s| !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit()))
        .map(str::to_string)
        .ok_or_else(|| ApiError::Other("gmail_history_missing".into()))
}
pub fn collect(
    api: &mut impl Api,
    account: &Account,
    cached: &[String],
) -> Result<Batch, ApiError> {
    let start = Instant::now();
    let mut full = account.history_id.is_none();
    let mut fallback = false;
    let mut ids = BTreeSet::new();
    let mut deleted = BTreeSet::new();
    let mut next = String::new();
    let mut latest = String::new();
    if let Some(history) = &account.history_id {
        for page in 0..20 {
            let value = match api.get(
                "history",
                &[
                    ("startHistoryId", history.clone()),
                    ("pageToken", next.clone()),
                    ("maxResults", "500".into()),
                ],
            ) {
                Err(ApiError::NotFound) => {
                    full = true;
                    fallback = true;
                    ids.clear();
                    deleted.clear();
                    break;
                }
                other => other?,
            };
            latest = cursor(&value)?;
            for record in value["history"].as_array().into_iter().flatten() {
                for item in record["messagesDeleted"].as_array().into_iter().flatten() {
                    if let Some(id) = item["message"]["id"].as_str() {
                        deleted.insert(id.to_string());
                    }
                }
                for key in ["messagesAdded", "labelsAdded", "labelsRemoved"] {
                    for item in record[key].as_array().into_iter().flatten() {
                        if let Some(id) = item["message"]["id"].as_str() {
                            ids.insert(id.to_string());
                        }
                    }
                }
            }
            next = value["nextPageToken"].as_str().unwrap_or("").into();
            if next.is_empty() {
                break;
            }
            if page == 19 {
                return Err(ApiError::Other("gmail_history_page_limit".into()));
            }
        }
    }
    if full {
        latest = cursor(&api.get("profile", &[])?)?;
        next.clear();
        for page in 0..20 {
            let value = api.get(
                "messages",
                &[
                    (
                        "q",
                        format!(
                            "newer_than:{}d {{in:inbox in:sent}} -in:spam -in:trash",
                            account.horizon_days
                        ),
                    ),
                    ("maxResults", "100".into()),
                    ("pageToken", next.clone()),
                    ("includeSpamTrash", "false".into()),
                ],
            )?;
            for message in value["messages"].as_array().into_iter().flatten() {
                if let Some(id) = message["id"].as_str() {
                    ids.insert(id.to_string());
                }
            }
            next = value["nextPageToken"].as_str().unwrap_or("").into();
            if next.is_empty() {
                break;
            }
            if page == 19 {
                return Err(ApiError::Other("gmail_scope_limit_reduce_horizon".into()));
            }
        }
        // Re-read previously cached scope members to distinguish removal from deletion.
        ids.extend(cached.iter().cloned());
    }
    if ids.len() > 2000 {
        return Err(ApiError::Other("gmail_scope_limit_reduce_horizon".into()));
    }
    let mut messages = Vec::new();
    let mut text_bytes = 0usize;
    for id in ids {
        if !super::provider_id(&id) {
            return Err(ApiError::Other("gmail_invalid_provider_id".into()));
        }
        if start.elapsed() > Duration::from_secs(600) {
            return Err(ApiError::Other("gmail_sync_budget_reduce_horizon".into()));
        }
        // Fetch current state even if duplicate/out-of-order history includes deletion.
        match api.get(&format!("messages/{id}"), &[("format", "full".into())]) {
            Ok(value) => {
                deleted.remove(&id);
                let mail = normalize(&account.id, &value).map_err(ApiError::Other)?;
                text_bytes += mail.canonical_text.len() + mail.clean_text.len();
                if text_bytes > 32_000_000 {
                    return Err(ApiError::Other("gmail_batch_limit_reduce_horizon".into()));
                }
                messages.push(mail)
            }
            Err(ApiError::NotFound) => {
                deleted.insert(id);
            }
            Err(e) => return Err(e),
        }
    }
    Ok(Batch {
        messages,
        deleted: deleted.into_iter().collect(),
        cursor: latest,
        full,
        fallback,
    })
}
