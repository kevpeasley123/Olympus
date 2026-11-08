//! Explicit conversational statements applied only to saved, revision-bound email context.
use super::*;

#[derive(Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Source {
    account_id: String,
    thread_id: String,
    signature: String,
    revision: i64,
    subject: String,
}
#[derive(Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Context {
    kind: String,
    item_count: usize,
    sources: Vec<Source>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pending_message_id: Option<String>,
}
fn intent(words: &str) -> Option<&'static str> {
    let words = words.trim();
    if words.is_empty()
        || words.chars().count() > 1000
        || words.contains(['\n', '\r', '?', '"', '`', '>'])
    {
        return None;
    }
    let normalized = words
        .trim_end_matches(['.', '!'])
        .to_lowercase()
        .replace('’', "'");
    let direct = normalized.strip_prefix("actually, ").unwrap_or(&normalized);
    if [
        "i already handled that",
        "i handled that",
        "i've handled that",
        "i have handled that",
        "i already took care of that",
        "i took care of that",
        "i already did that",
    ]
    .contains(&direct)
    {
        return Some("handled");
    }
    let clause = ["actually, ", "correction: ", "that's not right: "]
        .iter()
        .find_map(|prefix| normalized.strip_prefix(prefix));
    if let Some(clause) = clause {
        // Discourse markers alone do not identify a correction. Only bounded
        // assertions about an email detail qualify; requests and uncertainty
        // continue through ordinary chat without changing the current state.
        let uncertain = [
            " if ",
            " could ",
            " might ",
            " maybe ",
            " would ",
            " suppose ",
        ]
        .iter()
        .any(|part| clause.contains(part));
        let detail = [
            "deadline",
            "due date",
            "meeting",
            "appointment",
            "amount",
            "sender",
            "recipient",
            "request",
            "status",
        ]
        .iter()
        .any(|field| {
            ["is", "was"].iter().any(|verb| {
                let prefix = format!("the {field} {verb} ");
                clause
                    .strip_prefix(&prefix)
                    .is_some_and(|value| !value.trim().is_empty())
            })
        });
        if detail && !uncertain {
            return Some("corrected");
        }
    }
    None
}
fn normalized(words: &str) -> String {
    words.trim().trim_end_matches(['.', '!']).to_lowercase()
}
fn result(content: String, feedback: Option<Context>) -> Value {
    json!({"content":content,"feedback":feedback})
}
fn remember_result(c: &Connection, message: &str, value: &Value, brief: &str) -> Result<(), String> {
    c.execute("INSERT INTO conversation_turn_context(message_id,context_json) VALUES(?1,json_object('feedbackResult',json(?2),'feedbackBriefingMessageId',?3)) ON CONFLICT(message_id) DO UPDATE SET context_json=json_set(context_json,'$.feedbackResult',json(?2),'$.feedbackBriefingMessageId',?3)",params![message,value.to_string(),brief]).map_err(err)?;
    Ok(())
}

pub(crate) fn apply(
    c: &mut Connection,
    conversation_id: &str,
    message_id: &str,
    temporary: bool,
) -> Result<Option<Value>, String> {
    if temporary {
        return Ok(None);
    }
    if conversation_id.is_empty()
        || conversation_id.len() > 160
        || message_id.is_empty()
        || message_id.len() > 160
    {
        return Err("Invalid conversation reference.".into());
    }
    let tx = c.transaction().map_err(err)?;
    for key in ["chatMemory.learn", "chatMemory.use"] {
        let preference: Option<String> = tx
            .query_row("SELECT value FROM settings WHERE key=?1", [key], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        if preference.as_deref() == Some("false") {
            return Ok(None);
        }
    }
    // Read the saved current operator turn, not source text composed for the model.
    let user:Option<(i64,String,Option<String>)>=tx.query_row("SELECT m.rowid,m.content,t.context_json FROM conversation_messages m LEFT JOIN conversation_turn_context t ON t.message_id=m.id JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?1 AND m.conversation_id=?2 AND m.role='user' AND c.legacy=0 AND m.created_at>=datetime('now','-2 minutes') AND m.created_at<=datetime('now','+1 minute') AND m.rowid=(SELECT max(rowid) FROM conversation_messages WHERE conversation_id=?2 AND role='user') AND NOT EXISTS(SELECT 1 FROM conversation_imports WHERE message_id=m.id)",params![message_id,conversation_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(err)?;
    let Some((rowid, words, metadata)) = user else {
        return Ok(None);
    };
    let metadata: Value = serde_json::from_str(metadata.as_deref().unwrap_or("{}"))
        .map_err(|_| "Conversation context is unreadable.")?;
    if metadata.get("attachment").is_some_and(|v| !v.is_null()) {
        return Ok(None);
    }
    if let Some(receipt) = metadata.get("feedbackResult") {
        return Ok(Some(receipt.clone()));
    }
    let previous:Option<(String,String,Option<String>,bool)>=tx.query_row("SELECT m.id,m.role,t.context_json,EXISTS(SELECT 1 FROM conversation_imports WHERE message_id=m.id) FROM conversation_messages m LEFT JOIN conversation_turn_context t ON t.message_id=m.id WHERE m.conversation_id=?1 AND m.rowid<?2 AND m.created_at>=datetime('now','-1 day') ORDER BY m.rowid DESC LIMIT 1",params![conversation_id,rowid],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional().map_err(err)?;
    let Some((briefing_message_id, role, Some(raw), imported)) = previous else {
        return Ok(None);
    };
    if imported || role != "assistant" || raw.len() > 16000 {
        return Ok(None);
    }
    let previous: Value =
        serde_json::from_str(&raw).map_err(|_| "Conversation context is unreadable.")?;
    let Some(raw) = previous.get("feedback") else {
        return Ok(None);
    };
    let Ok(mut context) = serde_json::from_value::<Context>(raw.clone()) else {
        return Ok(None);
    };
    if !["brief", "clarification", "acknowledgment"].contains(&context.kind.as_str())
        || !(1..=3).contains(&context.item_count)
        || context.sources.is_empty()
        || context.sources.len() > 3
        || context.sources.len() > context.item_count
        || context.sources.iter().any(|s| {
            s.account_id.is_empty()
                || s.account_id.len() > 256
                || s.thread_id.is_empty()
                || s.thread_id.len() > 256
                || s.signature.is_empty()
                || s.signature.len() > 256
                || s.revision < 0
                || s.subject.chars().count() > 200
        })
    {
        return Ok(None);
    }
    // A follow-up can reuse a native brief only through the exact response
    // previously issued by this handler. Renderer-supplied IDs are not authority.
    let briefing_message_id = if context.kind == "brief" {
        briefing_message_id
    } else {
        let receipt: Option<(String,String)> = tx.query_row(
            "SELECT a.content,t.context_json FROM conversation_messages a JOIN conversation_messages u ON u.rowid=(SELECT max(rowid) FROM conversation_messages WHERE conversation_id=?1 AND rowid<a.rowid) JOIN conversation_turn_context t ON t.message_id=u.id WHERE a.id=?2 AND a.conversation_id=?1 AND u.conversation_id=?1 AND u.role='user' AND NOT EXISTS(SELECT 1 FROM conversation_imports WHERE message_id=u.id)",
            params![conversation_id,briefing_message_id], |r| Ok((r.get(0)?,r.get(1)?))).optional().map_err(err)?;
        let Some((content,raw_receipt))=receipt else {return Ok(None)};
        let receipt:Value=serde_json::from_str(&raw_receipt).map_err(|_| "Conversation context is unreadable.")?;
        if receipt["feedbackResult"]["content"]!=content || receipt["feedbackResult"]["feedback"]!=*raw {return Ok(None)}
        let Some(id)=receipt["feedbackBriefingMessageId"].as_str() else {return Ok(None)};
        id.to_string()
    };
    let mut statement_id = message_id.to_string();
    let mut statement = words.clone();
    let mut chosen = None;
    if context.kind == "clarification" {
        if normalized(&words) == "no" {
            return Ok(Some(result(
                "Okay. I haven't changed the email understanding.".into(),
                None,
            )));
        }
        chosen = context.sources.iter().position(|s| {
            normalized(&words) == normalized(&s.subject)
                || normalized(&words) == format!("the {} email", normalized(&s.subject))
        });
        if context
            .sources
            .iter()
            .filter(|s| {
                normalized(&words) == normalized(&s.subject)
                    || normalized(&words) == format!("the {} email", normalized(&s.subject))
            })
            .count()
            > 1
        {
            chosen = None
        }
        if context.sources.len() == 1
            && ["yes", "yes, that email", "yes that email"].contains(&normalized(&words).as_str())
        {
            chosen = Some(0)
        }
        if chosen.is_some() {
            let Some(id) = &context.pending_message_id else {
                return Ok(None);
            };
            let original:Option<String>=tx.query_row("SELECT content FROM conversation_messages WHERE id=?1 AND conversation_id=?2 AND role='user' AND rowid<?3 AND NOT EXISTS(SELECT 1 FROM conversation_imports WHERE message_id=?1)",params![id,conversation_id,rowid],|r|r.get(0)).optional().map_err(err)?;
            let Some(original) = original else {
                return Ok(None);
            };
            statement_id = id.clone();
            statement = original;
        }
    }
    let Some(action) = intent(&statement) else {
        return Ok(None);
    };
    if chosen.is_none()
        && context.item_count == 1
        && context.sources.len() == 1
        && context.kind != "clarification"
    {
        chosen = Some(0)
    }
    if chosen.is_none() {
        context.kind = "clarification".into();
        context.pending_message_id = Some(statement_id);
        let question = if context.sources.len() == 1 {
            format!(
                "Do you mean the email about {}? I haven't changed anything yet.",
                context.sources[0].subject
            )
        } else {
            format!("Which email do you mean: {}? Reply with its subject. I haven't changed anything yet.",context.sources.iter().map(|s|s.subject.as_str()).collect::<Vec<_>>().join(" or "))
        };
        let answer = result(question, Some(context));
        remember_result(&tx, message_id, &answer, &briefing_message_id)?;
        tx.commit().map_err(err)?;
        return Ok(Some(answer));
    }
    let mut source = context.sources[chosen.unwrap()].clone();
    let request = learning::LearningRequest {
        account_id: source.account_id.clone(),
        thread_id: source.thread_id.clone(),
        signature: source.signature.clone(),
        expected_revision: source.revision,
        action: action.into(),
        text: if action == "corrected" {
            statement.clone()
        } else {
            String::new()
        },
    };
    let origin = json!({"conversationId":conversation_id,"briefingMessageId":briefing_message_id,"messageId":message_id,"statementMessageId":statement_id,"statement":statement});
    if let Err(error) = learning::apply(&tx, request, Some(origin)) {
        let content=match error.as_str(){"learning_account_changed"|"gmail_not_connected"=>"The connected email account changed. I haven't applied that correction.","learning_revision_changed"|"learning_source_changed"=>"That email or its understanding changed since this brief. I haven't applied the correction; request a fresh update first.",_=>return Err("I couldn't save the correction. No email understanding was changed.".into())};
        return Ok(Some(result(content.into(), None)));
    }
    source.revision += 1;
    let content = if action == "handled" {
        format!("I've recorded that you handled the email about {}. Its current recommendation is cleared; this doesn't mark a project task complete.",source.subject)
    } else {
        format!(
            "I've recorded your correction for the email about {}: {}",
            source.subject, statement
        )
    };
    let answer = result(
        content,
        Some(Context {
            kind: "acknowledgment".into(),
            item_count: 1,
            sources: vec![source],
            pending_message_id: None,
        }),
    );
    remember_result(&tx, message_id, &answer, &briefing_message_id)?;
    tx.commit().map_err(err)?;
    Ok(Some(answer))
}

#[tauri::command]
pub fn conversation_feedback(
    db: State<'_, Db>,
    conversation_id: String,
    message_id: String,
    temporary: bool,
) -> Result<Option<Value>, String> {
    let mut c = db.0.lock().map_err(|_| "Conversation storage is busy.")?;
    apply(&mut c, &conversation_id, &message_id, temporary)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn message(c: &mut Connection, id: &str, role: &str, content: &str, feedback: Option<Value>) {
        let m = serde_json::from_value(
            json!({"id":id,"role":role,"content":content,"timestamp":"12:00"}),
        )
        .unwrap();
        crate::commands::persistence::store_messages(c, "chat", vec![m]).unwrap();
        if let Some(feedback) = feedback {
            c.execute(
                "INSERT INTO conversation_turn_context VALUES(?1,?2)",
                params![id, json!({"feedback":feedback}).to_string()],
            )
            .unwrap();
        }
    }
    fn context(signature: &str, count: usize) -> Value {
        json!({"kind":"brief","itemCount":count,"sources":[{"accountId":"fixture","threadId":"thread","signature":signature,"revision":0,"subject":"Enrollment"}]})
    }
    #[test]
    fn ordinary_handled_statement_changes_attention_once_with_provenance() {
        let (db, sig) = super::super::learning_tests::fixture();
        let mut c = db.0.lock().unwrap();
        message(
            &mut c,
            "brief",
            "assistant",
            "Email recommendation: review enrollment.",
            Some(context(&sig, 1)),
        );
        message(&mut c, "u", "user", "I already handled that.", None);
        let result = apply(&mut c, "chat", "u", false)
            .unwrap()
            .expect("ordinary statement should be applied");
        assert!(result["content"].as_str().unwrap().contains("recorded"));
        assert!(snapshot(&c).unwrap()["attention"]
            .as_array()
            .unwrap()
            .is_empty());
        let raw: String = c
            .query_row("SELECT payload_json FROM email_learning", [], |r| r.get(0))
            .unwrap();
        assert!(raw.contains("I already handled that.") && raw.contains("statementMessageId"));
        assert_eq!(apply(&mut c, "chat", "u", false).unwrap(), Some(result));
        assert_eq!(
            learning::stored_revision(&c, "fixture", "thread").unwrap(),
            1
        );
    }
    #[test]
    fn discourse_requests_and_hypotheticals_preserve_handled_email() {
        for words in [
            "Actually, tell me about Helios.",
            "Actually, I prefer working on Helios.",
            "Actually, is the deadline Friday",
            "Actually, if the deadline is Friday, we could wait.",
            "Actually, the deadline is Friday if they approve.",
            "Correction: can you tell me about Helios",
        ] {
            let (db, sig) = super::super::learning_tests::fixture();
            let mut c = db.0.lock().unwrap();
            message(
                &mut c,
                "brief",
                "assistant",
                "Email recommendation.",
                Some(context(&sig, 1)),
            );
            message(&mut c, "u", "user", "I already handled that.", None);
            let acknowledgment = apply(&mut c, "chat", "u", false).unwrap().unwrap();
            message(
                &mut c,
                "ack",
                "assistant",
                acknowledgment["content"].as_str().unwrap(),
                Some(acknowledgment["feedback"].clone()),
            );
            message(&mut c, "follow-up", "user", words, None);
            assert!(
                apply(&mut c, "chat", "follow-up", false).unwrap().is_none(),
                "{words}: must follow ordinary chat routing"
            );
            assert_eq!(
                learning::stored_revision(&c, "fixture", "thread").unwrap(),
                1,
                "{words}"
            );
            assert!(
                snapshot(&c).unwrap()["attention"]
                    .as_array()
                    .unwrap()
                    .is_empty(),
                "{words}"
            );
        }
    }
    #[test]
    fn duplicate_subjects_cannot_select_an_arbitrary_email() {
        for words in ["Enrollment", "The Enrollment email"] {
            let (db, sig) = super::super::learning_tests::fixture();
            let mut c = db.0.lock().unwrap();
            let mut refs = context(&sig, 2);
            let mut second = refs["sources"][0].clone();
            second["threadId"] = json!("second-thread");
            refs["sources"].as_array_mut().unwrap().push(second);
            message(&mut c, "brief", "assistant", "Two emails.", Some(refs));
            message(&mut c, "u", "user", "I already handled that.", None);
            let question = apply(&mut c, "chat", "u", false).unwrap().unwrap();
            message(
                &mut c,
                "clarify",
                "assistant",
                question["content"].as_str().unwrap(),
                Some(question["feedback"].clone()),
            );
            message(&mut c, "selection", "user", words, None);
            apply(&mut c, "chat", "selection", false).unwrap();
            assert_eq!(
                learning::stored_revision(&c, "fixture", "thread").unwrap(),
                0,
                "{words}"
            );
        }
    }
    #[test]
    fn mixed_brief_needs_conversational_confirmation() {
        let (db, sig) = super::super::learning_tests::fixture();
        let mut c = db.0.lock().unwrap();
        message(
            &mut c,
            "brief",
            "assistant",
            "Email and project update.",
            Some(context(&sig, 2)),
        );
        message(&mut c, "u", "user", "I already handled that.", None);
        let question = apply(&mut c, "chat", "u", false)
            .unwrap()
            .expect("clarify ambiguous reference");
        assert!(question["content"].as_str().unwrap().contains("Enrollment"));
        assert_eq!(
            learning::stored_revision(&c, "fixture", "thread").unwrap(),
            0
        );
        message(
            &mut c,
            "clarify",
            "assistant",
            question["content"].as_str().unwrap(),
            Some(question["feedback"].clone()),
        );
        message(&mut c, "yes", "user", "Yes.", None);
        let acknowledgment = apply(&mut c, "chat", "yes", false).unwrap().unwrap();
        let mut fixture: Value = serde_json::from_str(include_str!(
            "../../../../../scripts/fixtures/conversation-feedback.json"
        ))
        .unwrap();
        // Source fingerprints include fixture timestamps; compare the actual binding.
        for key in ["question", "acknowledgment"] {
            fixture[key]["feedback"]["sources"][0]["signature"] = json!(sig);
        }
        assert_eq!(
            fixture,
            json!({"question":question,"acknowledgment":acknowledgment})
        );
        if let Ok(path) = std::env::var("OLYMPUS_CORRECTION_FIXTURE") {
            std::fs::write(
                path,
                serde_json::to_string_pretty(
                    &json!({"question":question,"acknowledgment":acknowledgment}),
                )
                .unwrap(),
            )
            .unwrap();
        }
        assert_eq!(
            learning::stored_revision(&c, "fixture", "thread").unwrap(),
            1
        );
    }
    #[test]
    fn correction_preserves_operator_words_over_generated_recommendation() {
        let (db, sig) = super::super::learning_tests::fixture();
        let mut c = db.0.lock().unwrap();
        message(
            &mut c,
            "brief",
            "assistant",
            "Email recommendation.",
            Some(context(&sig, 1)),
        );
        message(
            &mut c,
            "u",
            "user",
            "Actually, the deadline is Friday, not Thursday.",
            None,
        );
        assert!(apply(&mut c, "chat", "u", false).unwrap().is_some());
        assert_eq!(
            snapshot(&c).unwrap()["attention"][0]["operatorCorrection"],
            "Actually, the deadline is Friday, not Thursday."
        );
    }
    #[test]
    fn quoted_negative_and_private_turns_never_apply() {
        let mut empty = Connection::open_in_memory().unwrap();
        assert!(apply(&mut empty, "chat", "u", true).unwrap().is_none());
        for words in [
            "I haven't handled that.",
            "Have I already handled that?",
            "If I already handled that, what next?",
            "\"I already handled that\"",
            "The email says: I already handled that.",
            "Actually, should I handle that?",
        ] {
            let (db, sig) = super::super::learning_tests::fixture();
            let mut c = db.0.lock().unwrap();
            message(
                &mut c,
                "brief",
                "assistant",
                "Email recommendation.",
                Some(context(&sig, 1)),
            );
            message(&mut c, "u", "user", words, None);
            assert!(
                apply(&mut c, "chat", "u", false).unwrap().is_none(),
                "{words}"
            );
            assert_eq!(
                learning::stored_revision(&c, "fixture", "thread").unwrap(),
                0
            );
        }
    }
    #[test]
    fn attached_or_imported_intervening_context_cannot_reuse_an_older_brief() {
        for attachment in [true, false] {
            let (db, sig) = super::super::learning_tests::fixture();
            let mut c = db.0.lock().unwrap();
            message(
                &mut c,
                "brief",
                "assistant",
                "Email recommendation.",
                Some(context(&sig, 1)),
            );
            if !attachment {
                message(
                    &mut c,
                    "imported",
                    "assistant",
                    "Unrelated imported reply",
                    None,
                );
                c.execute(
                    "INSERT INTO conversation_imports(message_id) VALUES('imported')",
                    [],
                )
                .unwrap();
            }
            message(&mut c, "u", "user", "I already handled that.", None);
            if attachment {
                c.execute("INSERT INTO conversation_turn_context VALUES('u',?1)",[json!({"attachment":{"kind":"project-snapshot","context":"Different project"}}).to_string()]).unwrap();
            }
            assert!(apply(&mut c, "chat", "u", false).unwrap().is_none());
            assert_eq!(
                learning::stored_revision(&c, "fixture", "thread").unwrap(),
                0
            );
        }
    }
    #[test]
    fn account_source_revision_privacy_and_age_changes_never_write_feedback() {
        for change in [
            "account", "source", "revision", "private", "old", "imported",
        ] {
            let (db, sig) = super::super::learning_tests::fixture();
            let mut c = db.0.lock().unwrap();
            message(
                &mut c,
                "brief",
                "assistant",
                "Email recommendation.",
                Some(context(&sig, 1)),
            );
            message(&mut c, "u", "user", "I already handled that.", None);
            match change {
                "account" => {
                    store::disconnect(&c, "fixture").unwrap();
                    store::connect(&c, "other", "other@example.invalid", 7).unwrap();
                }
                "source" => {
                    c.execute("UPDATE gmail_messages SET fingerprint='changed'", [])
                        .unwrap();
                }
                "revision" => {
                    learning::change(
                        &mut c,
                        learning::LearningRequest {
                            account_id: "fixture".into(),
                            thread_id: "thread".into(),
                            signature: sig.clone(),
                            expected_revision: 0,
                            action: "corrected".into(),
                            text: "Prior correction".into(),
                        },
                    )
                    .unwrap();
                }
                "private" => {
                    c.execute(
                        "INSERT INTO settings(key,value) VALUES('chatMemory.learn','false')",
                        [],
                    )
                    .unwrap();
                }
                "old" => {
                    c.execute("UPDATE conversation_messages SET created_at=datetime('now','-1 hour') WHERE id='u'",[]).unwrap();
                }
                _ => {
                    c.execute(
                        "INSERT INTO conversation_imports(message_id) VALUES('u')",
                        [],
                    )
                    .unwrap();
                }
            }
            let before = learning::stored_revision(&c, "fixture", "thread").unwrap();
            apply(&mut c, "chat", "u", false).unwrap();
            assert_eq!(
                learning::stored_revision(&c, "fixture", "thread").unwrap(),
                before,
                "{change}"
            );
        }
    }
    #[test]
    fn failure_to_save_turn_receipt_rolls_back_learning() {
        let (db, sig) = super::super::learning_tests::fixture();
        let mut c = db.0.lock().unwrap();
        message(
            &mut c,
            "brief",
            "assistant",
            "Email recommendation.",
            Some(context(&sig, 1)),
        );
        message(&mut c, "u", "user", "I already handled that.", None);
        c.execute_batch("CREATE TRIGGER refuse_receipt BEFORE INSERT ON conversation_turn_context WHEN NEW.message_id='u' BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END;").unwrap();
        assert!(apply(&mut c, "chat", "u", false).is_err());
        assert_eq!(
            learning::stored_revision(&c, "fixture", "thread").unwrap(),
            0
        );
    }
}
