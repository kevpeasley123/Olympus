use super::super::vault_write::content_fingerprint;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub attachment_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mail {
    pub provider: String,
    pub account_id: String,
    pub id: String,
    pub thread_id: String,
    pub history_id: String,
    pub sender: String,
    pub recipients: String,
    pub cc: String,
    pub subject: String,
    pub internal_date: i64,
    pub rfc_message_id: String,
    pub in_reply_to: String,
    pub references: String,
    pub labels: Vec<String>,
    pub canonical_text: String,
    pub clean_text: String,
    pub snippet: String,
    pub attachments: Vec<Attachment>,
    pub retrieved_at: String,
    pub body_status: String,
    pub fingerprint: String,
}
fn header(part: &Value, name: &str) -> String {
    part["headers"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|h| h["name"].as_str().unwrap_or("").eq_ignore_ascii_case(name))
        .and_then(|h| h["value"].as_str())
        .unwrap_or("")
        .chars()
        .take(2000)
        .collect()
}
// A bad part degrades the body status instead of failing the batch: one
// undecodable message would otherwise replay the same cursor indefinitely.
fn decode(part: &Value, degraded: &mut bool) -> String {
    let data = part["body"]["data"].as_str().unwrap_or("");
    if data.len() > 2_000_000 {
        *degraded = true;
        return String::new();
    }
    let Ok(bytes) = URL_SAFE_NO_PAD.decode(data.trim_end_matches('=')) else {
        *degraded = true;
        return String::new();
    };
    let content_type = header(part, "Content-Type").to_lowercase();
    let charset = content_type
        .split(';')
        .find_map(|s| s.trim().strip_prefix("charset="))
        .unwrap_or("utf-8")
        .trim_matches('"');
    let encoding = match encoding_rs::Encoding::for_label(charset.as_bytes()) {
        Some(encoding) => encoding,
        None if std::str::from_utf8(&bytes).is_ok() => encoding_rs::UTF_8,
        None => {
            *degraded = true;
            encoding_rs::WINDOWS_1252
        }
    };
    let (decoded, _, errors) = encoding.decode(&bytes);
    *degraded |= errors;
    decoded.into_owned()
}
// html2text 0.12's from_read panics on deep nesting; use the fallible API and
// contain any remaining panic so the sync worker always writes its receipt.
fn html_text(html: &str, degraded: &mut bool) -> String {
    let converted = std::panic::catch_unwind(|| {
        html2text::config::plain()
            .allow_width_overflow()
            .string_from_read(html.as_bytes(), 100)
    });
    match converted {
        Ok(Ok(text)) => text,
        _ => {
            *degraded = true;
            String::new()
        }
    }
}
fn body(
    part: &Value,
    depth: usize,
    attachments: &mut Vec<Attachment>,
    degraded: &mut bool,
) -> (String, bool) {
    if depth > 20 || attachments.len() > 100 {
        *degraded = true;
        return (String::new(), false);
    }
    let mime = part["mimeType"].as_str().unwrap_or("");
    let filename = part["filename"].as_str().unwrap_or("");
    if !filename.is_empty() || part["body"]["attachmentId"].is_string() {
        attachments.push(Attachment {
            filename: filename.chars().take(500).collect(),
            mime_type: mime.into(),
            size: part["body"]["size"].as_u64().unwrap_or(0),
            attachment_id: part["body"]["attachmentId"].as_str().map(str::to_string),
        });
        return (String::new(), filename.is_empty());
    }
    if mime == "text/plain" {
        return (decode(part, degraded), false);
    }
    if mime == "text/html" {
        let html = decode(part, degraded);
        return (html_text(&html, degraded), false);
    }
    let mut values = Vec::new();
    let mut missing = false;
    if let Some(parts) = part["parts"].as_array() {
        if parts.len() > 100 {
            *degraded = true;
        }
        for child in parts.iter().take(100) {
            let (text, m) = body(child, depth + 1, attachments, degraded);
            missing |= m;
            values.push((child["mimeType"].as_str().unwrap_or(""), text));
        }
    }
    if mime == "multipart/alternative" {
        if let Some((_, text)) = values
            .iter()
            .find(|(m, t)| *m == "text/plain" && !t.trim().is_empty())
        {
            return (text.clone(), missing);
        }
        return (
            values
                .into_iter()
                .rev()
                .find(|(_, t)| !t.trim().is_empty())
                .map(|(_, t)| t)
                .unwrap_or_default(),
            missing,
        );
    }
    (
        values
            .into_iter()
            .map(|(_, t)| t)
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        missing,
    )
}
pub const BODY_NOT_RETAINED: &str = "body_not_retained_out_of_scope";
fn scope_labels(labels: &[String]) -> bool {
    !labels.iter().any(|l| l == "SPAM" || l == "TRASH")
        && labels.iter().any(|l| l == "INBOX" || l == "SENT")
}
pub fn normalize(account: &str, value: &Value) -> Result<Mail, String> {
    let id = value["id"]
        .as_str()
        .filter(|id| super::provider_id(id))
        .ok_or("invalid_message_id")?;
    let thread = value["threadId"]
        .as_str()
        .filter(|id| super::provider_id(id))
        .ok_or("invalid_thread_id")?;
    let payload = &value["payload"];
    let labels: Vec<String> = value["labelIds"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect();
    // Spam, trash, drafts and archived mail are never read for their bodies.
    let scoped = scope_labels(&labels);
    let mut attachments = Vec::new();
    let mut degraded = false;
    let (mut text, missing) = if scoped {
        body(payload, 0, &mut attachments, &mut degraded)
    } else {
        (String::new(), false)
    };
    if text.len() > 1_000_000 {
        let mut end = 1_000_000;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        degraded = true;
    }
    let internal_date = value["internalDate"]
        .as_str()
        .and_then(|v| v.parse().ok())
        .or_else(|| {
            chrono::DateTime::parse_from_rfc2822(&header(payload, "Date"))
                .ok()
                .map(|d| d.timestamp_millis())
        })
        .ok_or("invalid_message_timestamp")?;
    let mut mail = Mail {
        provider: "gmail".into(),
        account_id: account.into(),
        id: id.into(),
        thread_id: thread.into(),
        history_id: value["historyId"].as_str().unwrap_or("").into(),
        sender: header(payload, "From"),
        recipients: header(payload, "To"),
        cc: header(payload, "Cc"),
        subject: header(payload, "Subject"),
        internal_date,
        rfc_message_id: header(payload, "Message-ID"),
        in_reply_to: header(payload, "In-Reply-To"),
        references: header(payload, "References"),
        labels,
        canonical_text: text.clone(),
        clean_text: text.trim().into(),
        snippet: value["snippet"]
            .as_str()
            .unwrap_or("")
            .chars()
            .take(1000)
            .collect(),
        attachments,
        retrieved_at: String::new(),
        body_status: if !scoped {
            BODY_NOT_RETAINED
        } else if degraded && text.trim().is_empty() {
            "body_undecodable"
        } else if degraded {
            "body_partially_decoded"
        } else if missing {
            "partial_body_attachment_not_downloaded"
        } else if text.trim().is_empty() {
            "body_unavailable"
        } else {
            "text_available"
        }
        .into(),
        fingerprint: String::new(),
    };
    // Content only. historyId and labels such as UNREAD change without the
    // message changing, and would otherwise trigger paid re-analysis.
    // Gmail attachment IDs are not stable across reads, so they are excluded too.
    let attachments = mail
        .attachments
        .iter()
        .map(|a| (&a.filename, &a.mime_type, a.size))
        .collect::<Vec<_>>();
    mail.fingerprint = content_fingerprint(
        &serde_json::to_string(&(
            (&mail.id, &mail.thread_id, &mail.sender, &mail.recipients, &mail.cc),
            (&mail.subject, mail.internal_date, &mail.rfc_message_id),
            (&mail.in_reply_to, &mail.references, &mail.canonical_text),
            (&mail.snippet, attachments, &mail.body_status),
        ))
        .map_err(|_| "normalize_serialization")?,
    );
    mail.retrieved_at = super::now();
    Ok(mail)
}
pub fn in_scope(mail: &Mail, horizon: u32) -> bool {
    mail.internal_date >= chrono::Utc::now().timestamp_millis() - i64::from(horizon) * 86_400_000
        && scope_labels(&mail.labels)
}
