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
fn decode(part: &Value) -> Result<String, String> {
    let data = part["body"]["data"].as_str().unwrap_or("");
    if data.len() > 2_000_000 {
        return Err("mime_body_too_large".into());
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(data.trim_end_matches('='))
        .map_err(|_| "malformed_mime_base64")?;
    let content_type = header(part, "Content-Type").to_lowercase();
    let charset = content_type
        .split(';')
        .find_map(|s| s.trim().strip_prefix("charset="))
        .unwrap_or("utf-8")
        .trim_matches('"');
    let encoding =
        encoding_rs::Encoding::for_label(charset.as_bytes()).ok_or("unsupported_mime_charset")?;
    let (decoded, _, errors) = encoding.decode(&bytes);
    if errors {
        return Err("malformed_mime_text".into());
    }
    Ok(decoded.into_owned())
}
fn body(
    part: &Value,
    depth: usize,
    attachments: &mut Vec<Attachment>,
) -> Result<(String, bool), String> {
    if depth > 20 || attachments.len() > 100 {
        return Err("mime_structure_limit".into());
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
        return Ok((String::new(), filename.is_empty()));
    }
    if mime == "text/plain" {
        return Ok((decode(part)?, false));
    }
    if mime == "text/html" {
        let html = decode(part)?;
        return Ok((html2text::from_read(html.as_bytes(), 100), false));
    }
    let mut values = Vec::new();
    let mut missing = false;
    if let Some(parts) = part["parts"].as_array() {
        if parts.len() > 100 {
            return Err("mime_structure_limit".into());
        }
        for child in parts {
            let (text, m) = body(child, depth + 1, attachments)?;
            missing |= m;
            values.push((child["mimeType"].as_str().unwrap_or(""), text));
        }
    }
    if mime == "multipart/alternative" {
        if let Some((_, text)) = values
            .iter()
            .find(|(m, t)| *m == "text/plain" && !t.trim().is_empty())
        {
            return Ok((text.clone(), missing));
        }
        return Ok((
            values
                .into_iter()
                .rev()
                .find(|(_, t)| !t.trim().is_empty())
                .map(|(_, t)| t)
                .unwrap_or_default(),
            missing,
        ));
    }
    Ok((
        values
            .into_iter()
            .map(|(_, t)| t)
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        missing,
    ))
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
    let mut attachments = Vec::new();
    let (text, missing) = body(payload, 0, &mut attachments)?;
    if text.len() > 1_000_000 {
        return Err("normalized_body_limit".into());
    }
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
        internal_date: value["internalDate"]
            .as_str()
            .and_then(|v| v.parse().ok())
            .ok_or("invalid_message_timestamp")?,
        rfc_message_id: header(payload, "Message-ID"),
        in_reply_to: header(payload, "In-Reply-To"),
        references: header(payload, "References"),
        labels: value["labelIds"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
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
        body_status: if missing {
            "partial_body_attachment_not_downloaded"
        } else if text.trim().is_empty() {
            "body_unavailable"
        } else {
            "text_available"
        }
        .into(),
        fingerprint: String::new(),
    };
    mail.fingerprint =
        content_fingerprint(&serde_json::to_string(&mail).map_err(|_| "normalize_serialization")?);
    mail.retrieved_at = super::now();
    Ok(mail)
}
pub fn in_scope(mail: &Mail, horizon: u32) -> bool {
    mail.internal_date >= chrono::Utc::now().timestamp_millis() - i64::from(horizon) * 86_400_000
        && !mail.labels.iter().any(|l| l == "SPAM" || l == "TRASH")
        && mail.labels.iter().any(|l| l == "INBOX" || l == "SENT")
}
