use super::super::situation_contract as contract;
use super::*;
use crate::commands::{pantheon, research_retrieval};
use std::collections::BTreeSet;
const DISCOVERY_POLICY_VERSION:i64=2;

fn phase(c: &Connection, id: &str, name: &str, detail: Value) -> Result<(), String> {
    c.execute("UPDATE communication_runs SET payload_json=json_set(payload_json,'$.phase',?2) WHERE id=?1",params![id,name]).map_err(err)?;
    c.execute("INSERT INTO communication_events(run_id,node,state,at,result_json) VALUES(?1,?2,'completed',?3,?4)",params![id,name,now(),detail.to_string()]).map_err(err)?;
    Ok(())
}
fn guard(
    c: &Connection,
    a: &store::Account,
    rev: i64,
    dependencies: &BTreeMap<String, Option<(String, i64)>>,
    snapshot_at: i64,
) -> Result<(), String> {
    let live = account(c)?;
    let signatures = thread_signatures_for_window(c, &live, snapshot_at)?;
    if live.id != a.id
        || live.horizon_days != a.horizon_days
        || revision(c, &a.id)? != rev
        || dependencies.iter().any(|(id, expected)| signatures.get(id) != expected.as_ref())
    {
        return Err("situation_context_changed_retry".into());
    }
    Ok(())
}
fn bind_dependencies(
    dependencies:&mut BTreeMap<String,Option<(String,i64)>>,
    signatures:&BTreeMap<String,(String,i64)>,
    ids:impl IntoIterator<Item=String>,
) {
    for id in ids {dependencies.entry(id.clone()).or_insert_with(||signatures.get(&id).cloned());}
}
fn situation_dependencies(situation:&Value, observations:&[Value])->Vec<String> {
    let mut ids=observations.iter().filter(|o|o["situationId"]==situation["id"])
        .filter_map(|o|o["threadId"].as_str().map(str::to_owned)).collect::<Vec<_>>();
    ids.extend(situation["briefing"]["sourceSignatures"].as_array().into_iter().flatten()
        .filter_map(|pair|pair.get(0).and_then(Value::as_str).map(str::to_owned)));
    ids
}
pub(super) fn participant_emails(text: &str) -> BTreeSet<String> {
    text.split(|c: char| !c.is_ascii_alphanumeric() && !"@._+-".contains(c))
        .filter(|s| {
            s.len() <= 254
                && s.split_once('@')
                    .is_some_and(|(a, b)| !a.is_empty() && b.contains('.') && !b.ends_with('.'))
        })
        .map(str::to_lowercase)
        .collect()
}
pub(super) fn thread(c: &Connection, a: &store::Account, id: &str) -> Result<Value, String> {
    let messages = store::thread_messages(c, &a.id, id, 4)?;
    let mut people = BTreeSet::new();
    let time = chrono::Utc::now().timestamp_millis();
    let messages=messages.into_iter().filter(|m|m.internal_date<=time).map(|m|{
        let (text,normalized_html)=super::super::readable_cached_text(&m.clean_text)?;
        people.extend(participant_emails(&format!("{} {} {}",m.sender,m.recipients,m.cc)));
        Ok::<Value,String>(json!({"id":m.id,"threadId":id,"fingerprint":m.fingerprint,"timestamp":m.internal_date,"sender":m.sender,"recipients":m.recipients,"cc":m.cc,"subject":m.subject,"text":text.chars().take(2000).collect::<String>(),"truncated":text.chars().count()>2000,"normalizedFromHtml":normalized_html,"sent":m.labels.iter().any(|s|s=="SENT")}))
    }).collect::<Result<Vec<_>,_>>()?;
    people.remove(&a.email.to_lowercase());
    if people.len() > 24 || messages.is_empty() {
        return Err("situation_thread_bounds".into());
    }
    // Match exact addresses locally; no private document text or contacts are
    // copied to the provider. A candidate is a hint, not a forced assignment.
    let contexts=rows(c,"SELECT payload_json FROM communication_situation_contexts x JOIN communication_situations s ON x.account_id=s.account_id AND x.situation_id=s.id WHERE x.account_id=?1 AND s.state IN ('active','emerging')",&a.id)?;
    let candidates=contexts.iter().filter(|ctx|ctx["entities"].as_array().is_some_and(|entities|entities.iter().any(|e|e["contacts"].as_array().is_some_and(|contacts|contacts.iter().filter_map(Value::as_str).any(|contact|people.contains(&contact.to_lowercase())))))).filter_map(|ctx|ctx["situationId"].as_str()).collect::<Vec<_>>();
    Ok(json!({"threadId":id,"participants":people,"messages":messages,"localSituationCandidates":candidates}))
}

/// These standalone automated events are evidence at most, never new situations.
fn routine_notification(t:&Value)->bool {
    let messages=t["messages"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    if messages.iter().any(|m|m["sent"]==true) { return false; }
    messages.iter().any(|m|{
        let subject=m["subject"].as_str().unwrap_or("").to_lowercase();
        ["balance alert","account verification","verification code","membership activation","paperless","payment succeeded","new account reported","personal information appearing","icloud subscription","storage upgrade","welcome to dashpass"].iter().any(|pattern|subject.contains(pattern))
    })
}

#[cfg(test)]
mod eligibility_tests {
    use super::*;
    #[test]
    fn routine_events_do_not_become_new_maps_but_replies_can_be_reviewed() {
        for subject in ["Chase credit card balance alert","DashPass membership activation","New account reported","Paperless confirmation: Statements"] {
            assert!(routine_notification(&json!({"messages":[{"subject":subject,"sent":false}]})));
        }
        assert!(!routine_notification(&json!({"messages":[{"subject":"Lender requested document","sent":false}]})));
        assert!(!routine_notification(&json!({"messages":[{"subject":"Re: Balance alert - disputed charge","sent":true}]})));
    }
    #[test]
    fn local_contact_matching_does_not_export_document_text() {
        let db=super::super::tests::database();super::super::tests::mail(&db,"thread","Requested document");
        let c=db.0.lock().unwrap();
        c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture','house','Home','now')",[]).unwrap();
        c.execute("UPDATE communication_situations SET state='active'",[]).unwrap();
        c.execute("INSERT INTO communication_situation_contexts VALUES('fixture','house',?1,'now')",[json!({"situationId":"house","summary":"PRIVATE_SENTINEL","entities":[{"contacts":["lender@example.invalid"]}]}).to_string()]).unwrap();
        let result=thread(&c,&account(&c).unwrap(),"thread").unwrap();
        assert_eq!(result["localSituationCandidates"],json!(["house"]));
        assert!(!result.to_string().contains("PRIVATE_SENTINEL"));
    }
    #[test]
    fn extraction_reads_visible_cached_html_before_applying_excerpt_bound() {
        let db=super::super::tests::database();
        let body=format!("<!doctype html><html><head><style>{}</style></head><body><p>Please confirm the inspection on Friday.</p></body></html>","HIDDEN_CSS_SENTINEL ".repeat(5000));
        super::super::tests::mail(&db,"thread",&body);
        let c=db.0.lock().unwrap();
        let before:String=c.query_row("SELECT snapshot_json FROM gmail_messages WHERE id='thread'",[],|r|r.get(0)).unwrap();
        let result=thread(&c,&account(&c).unwrap(),"thread").unwrap();
        assert!(result["messages"][0]["text"].as_str().unwrap().contains("confirm the inspection on Friday"));
        assert!(!result.to_string().contains("HIDDEN_CSS_SENTINEL"));
        assert_eq!(result["messages"][0]["fingerprint"],content_fingerprint(&body));
        let after:String=c.query_row("SELECT snapshot_json FROM gmail_messages WHERE id='thread'",[],|r|r.get(0)).unwrap();
        assert_eq!(before,after,"Rendering must not mutate original evidence");
    }
}
fn research(entries: &[pantheon::PantheonEntry], query: &str) -> Vec<Value> {
    research_retrieval::retrieve(entries, query)
        .into_iter()
        .map(|mut r| {
            if r.excerpt.chars().count() > 2000 {
                r.excerpt = r.excerpt.chars().take(2000).collect();
                r.truncated = true;
            }
            json!(r)
        })
        .collect()
}
fn research_stamp(entries: &[pantheon::PantheonEntry]) -> String {
    let mut sources = entries
        .iter()
        .map(|e| {
            format!(
                "{}:{}",
                e.source_file,
                content_fingerprint(&serde_json::to_string(e).unwrap_or_default())
            )
        })
        .collect::<Vec<_>>();
    sources.sort();
    content_fingerprint(&sources.join("\n"))
}
pub(super) fn source_signatures(
    observations: &[Value],
    id: &Value,
    signatures: &BTreeMap<String, (String, i64)>,
) -> Value {
    let mut sources = observations
        .iter()
        .filter(|o| o["situationId"] == *id && current(o, signatures))
        .map(|o| {
            (
                o["threadId"].as_str().unwrap_or_default(),
                o["signature"].as_str().unwrap_or_default(),
            )
        })
        .collect::<Vec<_>>();
    sources.sort();
    json!(sources)
}

// A literal order reference plus the source mailbox is stronger identity than
// a generated title or a shared sender alone. No order ID means no automatic link.
fn transaction_key(o:&contract::Observation,t:&Value)->Option<String> {
    let detail=o.details.iter().find(|d|d.kind=="reference"&&d.label.eq_ignore_ascii_case("order")&&d.quote.contains(&d.value))?;
    let message=t["messages"].as_array()?.iter().find(|m|m["id"]==detail.message_id)?;
    let sender=participant_emails(message["sender"].as_str()?);
    if sender.len()!=1{return None;}
    Some(content_fingerprint(&json!([sender,detail.value]).to_string()))
}
fn discovery_catalog(known:&[Value],observations:&[Value],threads:&[Value])->Vec<Value>{
    let ids=threads.iter().filter_map(|t|t["threadId"].as_str()).collect::<BTreeSet<_>>();
    let bound=observations.iter().filter(|o|o["threadId"].as_str().is_some_and(|id|ids.contains(id))).filter_map(|o|o["situationId"].as_str()).collect::<BTreeSet<_>>();
    let candidates=threads.iter().flat_map(|t|t["localSituationCandidates"].as_array().into_iter().flatten()).filter_map(Value::as_str).collect::<BTreeSet<_>>();
    let mut ranked=known.iter().collect::<Vec<_>>();
    ranked.sort_by_key(|s|if bound.contains(s["id"].as_str().unwrap_or("")){0}else if candidates.contains(s["id"].as_str().unwrap_or("")){1}else{2});
    ranked.into_iter().take(96).map(|s|json!({"id":s["id"],"title":s["title"],"state":s["state"],"summary":s["briefing"]["whereThingsStand"].as_str().unwrap_or("").chars().take(300).collect::<String>()})).collect()
}
fn has_forgotten_dependencies(c:&Connection,account:&str,id:&str)->Result<bool,String>{
    Ok(c.query_row("SELECT EXISTS(SELECT 1 FROM communication_situation_sources s JOIN email_learning l ON l.account_id=s.account_id AND l.thread_id=s.thread_id,json_each(json_extract(l.payload_json,'$.forgotten_signatures')) f WHERE s.account_id=?1 AND s.situation_id=?2 AND f.value=s.signature UNION ALL SELECT 1 FROM communication_situation_changes h,json_each(h.source_refs_json) ref JOIN email_learning l ON l.account_id=h.account_id AND l.thread_id=json_extract(ref.value,'$.threadId'),json_each(json_extract(l.payload_json,'$.forgotten_signatures')) f WHERE h.account_id=?1 AND h.situation_id=?2 AND f.value=json_extract(ref.value,'$.signature'))",params![account,id],|r|r.get(0)).map_err(err)?)
}
fn forgotten_source(source:&Value,learned:&[Value])->bool {
    learned.iter().any(|l|l["threadId"]==source["threadId"]&&l["forgottenSignatures"].as_array().is_some_and(|s|s.contains(&source["signature"])))
}
fn forgotten_message_revisions(c:&Connection,account:&str,learned:&[Value])->Result<(BTreeSet<(String,String)>,BTreeSet<String>),String>{
    let sql="WITH refs AS (SELECT s.thread_id,s.signature,json_extract(e.value,'$.messageId') AS message_id,json_extract(e.value,'$.fingerprint') AS fingerprint FROM communication_situation_sources s,json_each(json_extract(s.payload_json,'$.evidenceRefs')) e WHERE s.account_id=?1 UNION SELECT json_extract(s.value,'$.threadId'),json_extract(s.value,'$.signature'),json_extract(e.value,'$.messageId'),json_extract(e.value,'$.fingerprint') FROM communication_situation_changes h,json_each(h.source_refs_json) s,json_each(json_extract(s.value,'$.evidenceRefs')) e WHERE h.account_id=?1) SELECT DISTINCT refs.thread_id,refs.signature,refs.message_id,coalesce(refs.fingerprint,'') FROM refs JOIN email_learning l ON l.account_id=?1 AND l.thread_id=refs.thread_id,json_each(json_extract(l.payload_json,'$.forgotten_signatures')) f WHERE refs.signature=f.value AND refs.message_id IS NOT NULL LIMIT 2001";
    let mut q=c.prepare(sql).map_err(err)?;
    let refs=q.query_map([account],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    if refs.len()>2000{return Err("situation_forget_evidence_budget".into());}
    let covered=refs.iter().map(|r|(r.0.as_str(),r.1.as_str())).collect::<BTreeSet<_>>();
    let mut blocked=BTreeSet::new();
    for record in learned { for signature in record["forgottenSignatures"].as_array().into_iter().flatten().filter_map(Value::as_str) {
        let thread=record["threadId"].as_str().unwrap_or("");
        if !covered.contains(&(thread,signature)){blocked.insert(thread.to_owned());}
    }}
    Ok((refs.into_iter().map(|r|(r.2,r.3)).collect(),blocked))
}
async fn infer(
    db: &Db,
    instructions: &str,
    input: Value,
    schema: Value,
    purpose: &str,
) -> Result<(String, Value), String> {
    super::analysis_provider::infer(db,instructions,input,schema,purpose).await
}
#[tauri::command]
pub async fn situation_refresh(app: tauri::AppHandle) -> Result<(), String> {
    let db = app.state::<Db>();
    refresh(&db, true).await.map(|_| ())
}
pub(super) async fn refresh(db: &Db, manual: bool) -> Result<RefreshOutcome, String> {
    let started_account = {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        account(&c)?.id
    };
    let result = refresh_account(db, manual, &started_account).await;
    record_outcome(db, &started_account, &result);
    result
}

async fn refresh_account(db: &Db, manual: bool, started_account: &str) -> Result<RefreshOutcome, String> {
    {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        let a = account(&c)?;
        if a.id != started_account { return Err("situation_account_changed_retry".into()); }
        ensure(&c, &a.id)?;
        let (enabled,last):(bool,i64)=c.query_row("SELECT enabled,last_attempt FROM communication_situation_state WHERE account_id=?1",[&a.id],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
        if !manual && (!enabled || chrono::Utc::now().timestamp_millis() - last < 300_000) {
            return Ok(RefreshOutcome::Skipped);
        }
        if a.status == "syncing" || a.status == "authentication_required" {
            return Ok(RefreshOutcome::Skipped);
        }
    }
    super::analysis_provider::readiness().require()?;
    let entries = tauri::async_runtime::spawn_blocking(pantheon::parse_pantheon_from_vault)
        .await
        .map_err(err)??;
    let expected = research_stamp(&entries);
    refresh_checked(
        db,
        manual,
        started_account,
        entries,
        |instructions, input, schema, purpose| infer(db, instructions, input, schema, purpose),
        move || {
            let fresh = pantheon::parse_pantheon_from_vault()?;
            if research_stamp(&fresh) != expected {
                return Err("situation_research_changed_retry".into());
            }
            Ok(())
        },
    )
    .await
}
async fn refresh_checked<F, Fut, V>(
    db: &Db,
    manual: bool,
    started_account: &str,
    entries: Vec<pantheon::PantheonEntry>,
    model: F,
    check_research: V,
) -> Result<RefreshOutcome, String>
where
    F: FnMut(&'static str, Value, Value, &'static str) -> Fut,
    Fut: std::future::Future<Output = Result<(String, Value), String>>,
    V: FnOnce() -> Result<(), String>,
{
    let provider=std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_default();
    refresh_batched(db,manual,started_account,entries,model,check_research,if provider=="ollama"{2}else{6}).await
}

async fn refresh_batched<F, Fut, V>(
    db: &Db,
    manual: bool,
    started_account: &str,
    entries: Vec<pantheon::PantheonEntry>,
    mut model: F,
    check_research: V,
    batch_size: usize,
) -> Result<RefreshOutcome, String>
where
    F: FnMut(&'static str, Value, Value, &'static str) -> Fut,
    Fut: std::future::Future<Output = Result<(String, Value), String>>,
    V: FnOnce() -> Result<(), String>,
{
    if !(1..=6).contains(&batch_size){return Err("situation_extraction_batch_invalid".into());}
    let time = chrono::Utc::now().timestamp_millis();
    let stamp = research_stamp(&entries);
    let (a, rev, signatures, mut known, mut observations, operator_updates, threads, id) = {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        let a = account(&c)?;
        if a.id != started_account { return Err("situation_account_changed_retry".into()); }
        ensure(&c, &a.id)?;
        let enabled: bool = c
            .query_row(
                "SELECT enabled FROM communication_situation_state WHERE account_id=?1",
                [&a.id],
                |r| r.get(0),
            )
            .map_err(err)?;
        if !manual && !enabled {
            return Ok(RefreshOutcome::Skipped);
        }
        let rev = revision(&c, &a.id)?;
        let signatures = thread_signatures_for_window(&c, &a, time)?;
        let learned=learning::snapshot(&c,&a.id,&signatures)?;
        let (forgotten_messages,blocked_threads)=forgotten_message_revisions(&c,&a.id,&learned)?;
        let mut known = situations(&c, &a.id)?;
        for situation in &mut known {if has_forgotten_dependencies(&c,&a.id,situation["id"].as_str().ok_or("situation_identity_invalid")?)? {situation["title"]=json!("Situation context withheld");situation["briefing"]=Value::Null;}}
        let mut observations = observations(&c, &a.id)?;
        for observation in &mut observations {observation["forgotten"]=json!(forgotten_source(observation,&learned));}
        let operator_updates = updates(&c, &a.id)?;
        let mut changed = signatures
            .iter()
            .filter(|(id, s)| {
                !blocked_threads.contains(*id) && !learned.iter().any(|l|l["threadId"]==**id&&l["forgottenSignatures"].as_array().is_some_and(|f|f.contains(&json!(s.0)))) && !observations
                    .iter()
                    .any(|o| o["threadId"] == **id && o["signature"] == s.0 && o["attentionVersion"] == DISCOVERY_POLICY_VERSION && o["deferred"].is_null())
            })
            .collect::<Vec<_>>();
        changed.sort_by(|a, b| b.1 .1.cmp(&a.1 .1).then_with(|| a.0.cmp(b.0)));
        let mut threads = Vec::new();
        for (tid, signature) in changed {
            if threads.len() == 6 {
                break;
            }
            match thread(&c, &a, tid) {
                Ok(mut t) => {
                    let messages=t["messages"].as_array_mut().ok_or("situation_thread_bounds")?;
                    let before=messages.len();
                    messages.retain(|m|{let id=m["id"].as_str().unwrap_or("").to_owned();let fp=m["fingerprint"].as_str().unwrap_or("").to_owned();!forgotten_messages.contains(&(id.clone(),fp))&&!forgotten_messages.contains(&(id,String::new()))});
                    if messages.is_empty(){continue;}
                    let withheld=before-messages.len();
                    let mut people=BTreeSet::new();for m in messages {people.extend(participant_emails(&format!("{} {} {}",m["sender"].as_str().unwrap_or(""),m["recipients"].as_str().unwrap_or(""),m["cc"].as_str().unwrap_or(""))));}people.remove(&a.email.to_lowercase());
                    t["participants"]=json!(people);t["withheldMessageCount"]=json!(withheld);threads.push(t);
                },
                // Recorded as observed so one oversized thread cannot fail every batch.
                Err(e) if matches!(e.as_str(),"situation_thread_bounds"|"gmail_cached_text_unavailable"|"gmail_cached_text_too_large") => {
                    let record = json!({"threadId":tid,"relevant":false,"situationId":"","title":"","summary":"Not analyzed: the stored thread could not be read within extraction bounds.","people":[],"relationships":[],"details":[],"skipped":e});
                    c.execute("INSERT INTO communication_situation_sources VALUES(?1,?2,?3,NULL,?4,?5) ON CONFLICT(account_id,thread_id) DO UPDATE SET signature=excluded.signature,situation_id=NULL,payload_json=excluded.payload_json,updated_at=excluded.updated_at",params![a.id,tid,signature.0,record.to_string(),now()]).map_err(err)?;
                }
                Err(e) => return Err(e),
            }
        }
        let dirty = known
            .iter()
            .filter(|s| !matches!(s["state"].as_str(), Some("dismissed" | "merged" | "closed")))
            .any(|s| {
                s["briefing"]["contextRevision"] != rev
                    || s["briefing"]["researchSignature"] != stamp
                    || s["briefing"]["sourceSignatures"]
                        != source_signatures(&observations, &s["id"], &signatures)
            });
        if threads.is_empty() && !dirty && !manual {
            return Ok(RefreshOutcome::Skipped);
        }
        let id = crate::commands::delegation::run_id();
        let run = json!({"id":id,"accountId":a.id,"graph":GRAPH,"status":"running","phase":"Reading changed correspondence","startedAt":now(),"finishedAt":null,"durationMs":null,"days":a.horizon_days,"items":[],"definition":[{"id":"snapshot","effect":"local_read"},{"id":"discover","after":["snapshot"],"contract":"situation-discovery@1","effect":"model_read"},{"id":"brief","after":["discover"],"contract":"situation-briefing@1","effect":"model_read"},{"id":"validate","after":["brief"],"effect":"local_read"},{"id":"publish","after":["validate"],"effect":"generated_local_write"}],"skills":["situation-discovery@1","situation-briefing@1"],"error":null,"stale":false,"model":super::analysis_provider::route().ok().map(|r|r.1),"provider":std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap_or_else(|_|"openai".into())});
        c.execute(
            "INSERT INTO communication_runs VALUES(?1,?2,?3,'running',?4)",
            params![id, a.id, a.horizon_days, run.to_string()],
        )
        .map_err(|_| "communication_analysis_already_running")?;
        c.execute(
            "UPDATE communication_situation_state SET last_attempt=?2 WHERE account_id=?1",
            params![a.id, time],
        )
        .map_err(err)?;
        (
            a,
            rev,
            signatures,
            known,
            observations,
            operator_updates,
            threads,
            id,
        )
    };
    let result:Result<(),String>=async{
        let mut changed_ids=BTreeSet::new();let mut fresh=Vec::new();let mut new_situations=Vec::new();
        let mut dependencies=BTreeMap::new();
        bind_dependencies(&mut dependencies,&signatures,threads.iter().filter_map(|t|t["threadId"].as_str().map(str::to_owned)));
        // Keep the refresh transaction intact while bounding each local response.
        // new:N identifiers belong to one request; only canonical IDs and literal
        // transaction evidence can join observations across requests.
        for batch_threads in threads.chunks(batch_size){
            let threads=batch_threads;
            let catalog=discovery_catalog(&known,&observations,&threads);
            for situation in known.iter().filter(|s|catalog.iter().any(|candidate|candidate["id"]==s["id"])) {
                bind_dependencies(&mut dependencies,&signatures,situation_dependencies(situation,&observations));
            }
            let update_context=operator_updates.iter().rev().take(8).map(|u|json!({"situationId":u["situationId"],"at":u["at"],"text":u["text"].as_str().unwrap_or("").chars().take(2000).collect::<String>()})).collect::<Vec<_>>();
            let known_ids:BTreeSet<String>=catalog.iter().filter_map(|s|s["id"].as_str().map(str::to_string)).collect();
            {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;}
            let (raw,receipt)=model(contract::EXTRACT,json!({"snapshotTime":time,"operatorEmail":a.email,"knownSituations":catalog,"operatorUpdates":update_context,"threads":threads}),contract::grounded_schema(&threads,&known_ids,false),"situation_discovery").await?;
            let (parsed,omissions)=match contract::parse_observations_with_optional_omissions(&raw,&threads,&known_ids) {
                Ok(parsed)=>parsed,
                Err(e) if matches!(e.as_str(),"person_not_in_evidence"|"relationship_not_in_evidence"|"situation_output_bounds")=>{
                    {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;phase(&c,&id,"Rechecking relationships",json!({"reason":e,"request":receipt}))?;}
                    let schema=contract::grounded_schema(&threads,&known_ids,true);
                    let (repair,repair_receipt)=model(contract::MAP_ONLY,json!({"snapshotTime":time,"operatorEmail":a.email,"knownSituations":catalog,"operatorUpdates":update_context,"threads":threads}),schema,"situation_discovery_retry").await?;
                    let parsed=contract::parse_observations(&repair,&threads,&known_ids)?;
                    if parsed.iter().any(|o|!o.details.is_empty()){return Err("map_retry_must_omit_details".into())}
                    let c=db.0.lock().map_err(|_|"database_busy")?;phase(&c,&id,"Relationships rechecked",json!({"request":repair_receipt,"optionalDetailsOmitted":true}))?;(parsed,vec![])
                },
                Err(e)=>return Err(e)
            };
            if !omissions.is_empty(){let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;phase(&c,&id,"Optional details withheld",json!({"omittedOptionalDetailCount":omissions.len(),"omittedOptionalDetails":omissions,"request":receipt}))?;}
            let mut new_keys:BTreeMap<String,String>=BTreeMap::new();
            for (mut o,t) in parsed.into_iter().zip(threads.iter()){
                if o.situation_id.starts_with("new:")&&routine_notification(t){
                    o.relevant=false;o.situation_id.clear();o.title.clear();o.people.clear();o.relationships.clear();o.details.clear();
                    o.summary="Routine notification; no ongoing situation warranted.".into();
                }
                let transaction=transaction_key(&o,t);
                let mut record=json!(o);let tid=o.thread_id.clone();
                let omitted=omissions.iter().filter(|d|d.thread_id==tid).map(|d|json!({"detailIndex":d.detail_index,"reason":d.reason})).collect::<Vec<_>>();
                record["omittedOptionalDetailCount"]=json!(omitted.len());record["omittedOptionalDetails"]=json!(omitted);
                record["trackingKind"]=json!(if transaction.is_some(){"transaction"}else{"situation"});
                record["transactionKey"]=json!(transaction);
                if let Some(old)=observations.iter().find(|s|s["threadId"]==tid){if let Some(id)=old["situationId"].as_str(){changed_ids.insert(id.to_string());}}
                if o.relevant {
                    let prior_target=observations.iter().find(|old|old["threadId"]==tid).and_then(|old|old["situationId"].as_str()).filter(|id|known.iter().any(|s|s["id"]==*id)).map(str::to_owned);
                    let transaction_target=transaction.as_ref().and_then(|key|observations.iter().find(|old|old["transactionKey"]==*key).and_then(|old|old["situationId"].as_str()).map(str::to_owned));
                    let group_key=transaction.as_ref().map(|key|format!("transaction:{key}")).unwrap_or_else(||o.situation_id.clone());
                    let target=if let Some(id)=prior_target.or(transaction_target){Some(id)}else if o.situation_id.starts_with("new:")||transaction.is_some(){
                        if let Some(id)=new_keys.get(&group_key){Some(id.clone())}
                        else {
                            let sid=crate::commands::delegation::run_id();new_keys.insert(group_key,sid.clone());
                            let s=json!({"id":sid,"title":o.title,"state":"emerging","briefing":{},"updatedAt":now()});known.push(s.clone());new_situations.push(s);Some(sid)
                        }
                    }else{Some(o.situation_id)};
                    if let Some(mut target)=target{
                        for _ in 0..96{let s=known.iter().find(|s|s["id"]==target).ok_or("unknown_situation")?;if let Some(next)=s["mergedInto"].as_str(){target=next.into()}else{break;}}
                        record["situationId"]=json!(target);changed_ids.insert(target);
                    }else{
                        // An observation without an identity cannot be published as a situation.
                        record["situationId"]=Value::Null;record["relevant"]=json!(false);
                    }
                }else{record["situationId"]=Value::Null;}
                record["signature"]=json!(signatures.get(&tid).ok_or("source_disappeared")?.0);
                record["attentionVersion"]=json!(DISCOVERY_POLICY_VERSION);
                record["withheldMessageCount"]=t["withheldMessageCount"].clone();
                if let Some(old)=observations.iter().find(|o|o["threadId"]==tid&&o["signature"]==record["signature"]){record["attentionDecision"]=old["attentionDecision"].clone();}
                record["evidenceRefs"]=json!(t["messages"].as_array().unwrap().iter().map(|m|json!({"messageId":m["id"],"threadId":tid,"fingerprint":m["fingerprint"],"timestamp":m["timestamp"]})).collect::<Vec<_>>());
                record["subject"]=t["messages"].as_array().unwrap().last().unwrap()["subject"].clone();
                record["timestamp"]=t["messages"].as_array().unwrap().last().unwrap()["timestamp"].clone();record["updatedAt"]=json!(now());
                if let Some(old)=observations.iter_mut().find(|s|s["threadId"]==tid){*old=record.clone()}else{observations.push(record.clone())}fresh.push(record);
            }
            let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;phase(&c,&id,"Building relationships",json!({"request":receipt,"observations":fresh}))?;
        }
        let mut targets=known.iter().filter(|s|!matches!(s["state"].as_str(),Some("dismissed"|"merged"|"closed"))).filter(|s|manual||changed_ids.contains(s["id"].as_str().unwrap())||s["briefing"]["contextRevision"]!=rev||s["briefing"]["researchSignature"]!=stamp||s["briefing"]["sourceSignatures"]!=source_signatures(&observations,&s["id"],&signatures)).collect::<Vec<_>>();
        targets.sort_by_key(|s|(!changed_ids.contains(s["id"].as_str().unwrap()),s["updatedAt"].as_str().unwrap_or("")));
        let contexts=targets.into_iter().take(6).map(|s|{
            bind_dependencies(&mut dependencies,&signatures,situation_dependencies(s,&observations));
            let updates=operator_updates.iter().filter(|u|u["situationId"]==s["id"]).rev().take(4).map(|u|json!({"id":u["id"],"at":u["at"],"text":u["text"].as_str().unwrap_or("").chars().take(4000).collect::<String>(),"truncated":u["text"].as_str().unwrap_or("").chars().count()>4000})).collect::<Vec<_>>();
            let query=format!("{} {}",s["title"].as_str().unwrap_or(""),updates.iter().filter_map(|u|u["text"].as_str()).collect::<Vec<_>>().join(" "));
            let mut obs=observations.iter().filter(|o|o["situationId"]==s["id"]&&o["relevant"]==true&&o["forgotten"]!=true&&current(o,&signatures)).cloned().collect::<Vec<_>>();obs.sort_by_key(|o|std::cmp::Reverse(o["timestamp"].as_i64().unwrap_or(0)));obs.truncate(8);
            for o in &mut obs {if let Some(details)=o["details"].as_array_mut(){details.truncate(5);for d in details {d.as_object_mut().unwrap().remove("quote");}} o.as_object_mut().unwrap().remove("evidenceRefs");}
            json!({"id":s["id"],"title":s["title"],"priorBriefing":s["briefing"]["whereThingsStand"],"observations":obs,"operatorUpdates":updates,"research":research(&entries,&query)})
        }).collect::<Vec<_>>();
        let briefings=if contexts.is_empty(){vec![]}else{
            {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;phase(&c,&id,"Updating situation briefings",json!({"situations":contexts.iter().map(|c|&c["id"]).collect::<Vec<_>>()}))?;}
            let (raw,receipt)=model(contract::BRIEF,json!({"snapshotTime":time,"situations":contexts}),contract::grounded_briefing_schema(&contexts),"situation_briefing").await?;
            let parsed=contract::parse_briefings(&raw,&contexts)?;
            let c=db.0.lock().map_err(|_|"database_busy")?;phase(&c,&id,"Checking evidence",json!({"request":receipt}))?;parsed
        };
        check_research()?;
        let mut c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&dependencies,time)?;
        let tx=c.transaction().map_err(err)?;
        for s in new_situations{tx.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES(?1,?2,?3,?4)",params![a.id,s["id"].as_str(),s["title"].as_str(),now()]).map_err(err)?;}
        for o in fresh{tx.execute("INSERT INTO communication_situation_sources VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(account_id,thread_id) DO UPDATE SET signature=excluded.signature,situation_id=excluded.situation_id,payload_json=json_set(excluded.payload_json,'$.attentionDecision',CASE WHEN communication_situation_sources.signature=excluded.signature THEN json_extract(communication_situation_sources.payload_json,'$.attentionDecision') ELSE NULL END),updated_at=excluded.updated_at",params![a.id,o["threadId"].as_str(),o["signature"].as_str(),o["situationId"].as_str(),o.to_string(),now()]).map_err(err)?;}
        let mut journal_ids=changed_ids.clone();
        journal_ids.extend(contexts.iter().filter_map(|c|c["id"].as_str().map(str::to_owned)));
        for (b,context) in briefings.into_iter().zip(contexts){let mut payload=json!(b);payload["contextRevision"]=json!(rev);payload["researchSignature"]=json!(stamp);payload["sourceSignatures"]=source_signatures(&observations,&context["id"],&signatures);payload["research"]=context["research"].clone();
            tx.execute("UPDATE communication_situations SET briefing_json=?3,updated_at=?4 WHERE account_id=?1 AND id=?2",params![a.id,b.situation_id,payload.to_string(),now()]).map_err(err)?;}
        for situation_id in journal_ids {changes::record(&tx,&a.id,&situation_id,"reconciled")?;}
        phase(&tx,&id,"Situation map updated",json!({"changedThreads":threads.len(),"newRelationshipsAreGenerated":true}))?;tx.commit().map_err(err)?;Ok(())
    }.await;
    let c = db.0.lock().map_err(|_| "database_busy")?;
    c.execute("UPDATE communication_runs SET status=?2,payload_json=json_set(payload_json,'$.status',?2,'$.error',?3,'$.finishedAt',?4,'$.durationMs',?5) WHERE id=?1",params![id,if result.is_ok(){"completed"}else{"failed"},result.as_ref().err(),now(),chrono::Utc::now().timestamp_millis()-time]).map_err(err)?;
    result.map(|_| RefreshOutcome::Completed)
}

#[cfg(test)]
async fn refresh_with<F, Fut>(
    db: &Db,
    manual: bool,
    entries: Vec<pantheon::PantheonEntry>,
    model: F,
) -> Result<(), String>
where
    F: FnMut(&'static str, Value, Value, &'static str) -> Fut,
    Fut: std::future::Future<Output = Result<(String, Value), String>>,
{
    let started_account = account(&db.0.lock().unwrap())?.id;
    refresh_checked(db, manual, &started_account, entries, model, || Ok(())).await.map(|_| ())
}
#[cfg(test)]
mod tests {
    use super::super::tests::{database, mail};
    use super::*;
    #[test]
    fn change_pages_prioritize_recent_changes_before_historical_identity(){
        let db=database();mail(&db,"receipt","Order A receipt");let c=db.0.lock().unwrap();
        for n in 0..30{c.execute("INSERT INTO communication_situations(account_id,id,title,state,updated_at) VALUES('fixture',?1,'Old','closed','2020-01-01')",[format!("a{n:03}")]).unwrap();}
        c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture','z-new','New change','2026-11-09')",[]).unwrap();
        let first=change_page(&c,None,2).unwrap();assert_eq!(first["items"][0]["id"],"z-new");assert_eq!(first["hasMore"],true);
        let second=change_page(&c,first["nextCursor"].as_str(),2).unwrap();assert_ne!(second["items"][0]["id"],"z-new");
    }
    #[test]
    fn change_pages_preserve_identity_and_ignore_unrelated_revisions() {
        let db=database(); mail(&db,"receipt","Order A receipt");
        let c=db.0.lock().unwrap();
        for id in ["a","b","c"] { c.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES('fixture',?1,'Order','now')",[id]).unwrap(); }
        let signature=thread_signatures(&c,&account(&c).unwrap()).unwrap()["receipt"].0.clone();
        let source=json!({"threadId":"receipt","summary":"Order A placed","evidenceRefs":[{"messageId":"receipt","threadId":"receipt","fingerprint":"fp","timestamp":1}]});
        c.execute("INSERT INTO communication_situation_sources VALUES('fixture','receipt',?1,'a',?2,'now')",params![signature,source.to_string()]).unwrap();
        let first=change_page(&c,None,2).unwrap();
        assert_eq!(first["items"].as_array().unwrap().len(),2);
        assert_eq!(first["nextCursor"],"b");
        assert_eq!(first["items"][0]["sources"][0]["evidenceRefs"][0]["messageId"],"receipt");
        let second=change_page(&c,Some("b"),2).unwrap();
        assert_eq!(second["items"][0]["id"],"c"); assert_eq!(second["hasMore"],false);
        c.execute("UPDATE communication_situations SET title='Unrelated edit' WHERE id='b'",[]).unwrap();
        assert_eq!(change_page(&c,None,2).unwrap()["items"][0]["revision"],first["items"][0]["revision"]);
        c.execute("UPDATE gmail_messages SET fingerprint='new-evidence'",[]).unwrap();
        let changed=change_page(&c,None,2).unwrap();
        assert_ne!(changed["items"][0]["revision"],first["items"][0]["revision"]);
        assert_eq!(changed["items"][0]["sources"][0]["current"],false);
        assert!(change_page(&c,None,25).is_err());
    }
    #[test]
    fn quiet_purchase_is_tracked_without_an_attention_item() {
        tauri::async_runtime::block_on(async {
            let db=database(); mail(&db,"receipt","Thank you for your purchase. Order A-123.");
            db.0.lock().unwrap().execute("UPDATE gmail_messages SET snapshot_json=json_set(snapshot_json,'$.subject','Thank you for your purchase')",[]).unwrap();
            refresh_with(&db,false,vec![],|_,input,_,purpose|std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))).await.unwrap();
            let result=snapshot(&db.0.lock().unwrap()).unwrap();
            assert_eq!(result["situations"].as_array().unwrap().len(),1);
            assert!(result["attention"].as_array().unwrap().is_empty());
            assert_eq!(result["observations"][0]["evidenceRefs"][0]["messageId"],"receipt");
        });
    }
    #[test]
    fn unrelated_orders_with_same_title_are_not_merged() {
        tauri::async_runtime::block_on(async {
            let db=database();
            for id in ["order-a","order-b"] {
                mail(&db,id,&format!("Receipt for {id}"));
                refresh_with(&db,false,vec![],|_,input,_,purpose|std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))).await.unwrap();
            }
            let c=db.0.lock().unwrap();let sources=observations(&c,"fixture").unwrap();
            assert_eq!(sources.len(),2);assert_ne!(sources[0]["situationId"],sources[1]["situationId"]);
        });
    }
    #[test]
    fn receipt_shipment_delay_and_cancellation_keep_source_history() {
        tauri::async_runtime::block_on(async {
            let db=database();
            for (id,text) in [("receipt","Order A-123 received"),("shipment","Order A-123 shipped"),("delay","Order A-123 delayed"),("cancel","Order A-123 canceled")] {
                mail(&db,id,text);
                refresh_with(&db,false,vec![],|_,input,_,purpose| {
                    let mut response=answer(purpose,&input);
                    if purpose=="situation_discovery" {
                        for o in response["observations"].as_array_mut().unwrap() {
                            o["details"]=json!([{"kind":"reference","label":"order","value":"A-123","messageId":id,"quote":text}]);
                            o["summary"]=json!(text);
                        }
                    }
                    std::future::ready(Ok((response.to_string(),json!({}))))
                }).await.unwrap();
            }
            let c=db.0.lock().unwrap(); let page=change_page(&c,None,24).unwrap();
            assert_eq!(page["items"].as_array().unwrap().len(),1);
            let sources=page["items"][0]["sources"].as_array().unwrap();
            assert_eq!(sources.len(),4);
            for id in ["receipt","shipment","delay","cancel"] {
                assert!(sources.iter().any(|s|s["threadId"]==id&&s["evidenceRefs"][0]["messageId"]==id));
            }
            assert!(sources.iter().any(|s|s["summary"]=="Order A-123 canceled"));
        });
    }
    #[test]
    fn different_order_references_override_a_shared_model_group() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"order-a","Order A-123 received");mail(&db,"order-b","Order B-456 received");
            refresh_with(&db,false,vec![],|_,input,_,purpose| {
                let mut response=answer(purpose,&input);
                if purpose=="situation_discovery" {for o in response["observations"].as_array_mut().unwrap() {
                    let id=o["threadId"].as_str().unwrap().to_owned();let value=if id=="order-a"{"A-123"}else{"B-456"};
                    o["details"]=json!([{"kind":"reference","label":"order","value":value,"messageId":id,"quote":format!("Order {value} received")}]);
                }}
                std::future::ready(Ok((response.to_string(),json!({}))))
            }).await.unwrap();
            let c=db.0.lock().unwrap();let sources=observations(&c,"fixture").unwrap();
            assert_eq!(sources.len(),2);assert_ne!(sources[0]["situationId"],sources[1]["situationId"]);
        });
    }
    #[test]
    fn formerly_deferred_transaction_is_rediscovered_without_closing_another() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"deferred","Order pending");
            {let c=db.0.lock().unwrap();let sig=thread_signatures(&c,&account(&c).unwrap()).unwrap()["deferred"].0.clone();
             c.execute("INSERT INTO communication_situation_sources VALUES('fixture','deferred',?1,NULL,?2,'now')",params![sig,json!({"threadId":"deferred","attentionVersion":1,"deferred":"situation_limit_close_or_merge_some"}).to_string()]).unwrap();}
            let mut discoveries=0;
            refresh_with(&db,false,vec![],|_,input,_,purpose|{if purpose=="situation_discovery"{discoveries+=1;}std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))}).await.unwrap();
            assert_eq!(discoveries,1);
            let c=db.0.lock().unwrap();assert!(observations(&c,"fixture").unwrap()[0]["situationId"].is_string());
        });
    }
    #[test]
    fn appointment_cancellation_retains_original_source_and_superseded_interpretation() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"appointment","Appointment scheduled for tomorrow.");
            for cancel in [false,true] {
                if cancel {mail(&db,"cancellation","The appointment is canceled.");let c=db.0.lock().unwrap();c.execute("UPDATE gmail_messages SET thread_id='appointment',snapshot_json=json_set(snapshot_json,'$.threadId','appointment') WHERE id='cancellation'",[]).unwrap();}
                refresh_with(&db,false,vec![],|_,input,_,purpose| {
                    let mut response=answer(purpose,&input);
                    if purpose=="situation_discovery" {response["observations"][0]["summary"]=json!(if cancel{"Appointment canceled; prior schedule superseded."}else{"Appointment scheduled for tomorrow."});}
                    std::future::ready(Ok((response.to_string(),json!({}))))
                }).await.unwrap();
            }
            let c=db.0.lock().unwrap();let page=change_page(&c,None,24).unwrap();
            assert_eq!(page["items"].as_array().unwrap().len(),1);
            assert_eq!(page["items"][0]["sources"][0]["evidenceRefs"].as_array().unwrap().len(),2);
            let history=page["items"][0]["changeJournal"]["items"].as_array().unwrap();
            assert_eq!(history.len(),2);assert_eq!(history[0]["previousRevision"],history[1]["revision"]);
            assert_eq!(history[0]["interpretation"]["interpretations"][0]["summary"],"Appointment canceled; prior schedule superseded.");
            assert_eq!(history[1]["interpretation"]["interpretations"][0]["summary"],"Appointment scheduled for tomorrow.");
        });
    }
    #[test]
    fn review_regression_forgotten_source_withholds_every_dependent_aggregate() {
        let (db,sig)=super::super::learning_tests::fixture();let mut c=db.0.lock().unwrap();
        let sentinel="FORGOTTEN_PRIVATE_SENTINEL";
        c.execute("INSERT INTO communication_situations(account_id,id,title,briefing_json,updated_at) VALUES('fixture','s',?1,?2,'now')",params![sentinel,json!({"whereThingsStand":sentinel,"whatChanged":sentinel,"nextMoves":[{"explanation":sentinel}]}).to_string()]).unwrap();
        c.execute("UPDATE communication_situation_sources SET situation_id='s'",[]).unwrap();
        learning::change(&mut c,learning::LearningRequest{account_id:"fixture".into(),thread_id:"thread".into(),signature:sig.clone(),expected_revision:0,action:"corrected".into(),text:sentinel.into()}).unwrap();
        learning::change(&mut c,learning::LearningRequest{account_id:"fixture".into(),thread_id:"thread".into(),signature:sig,expected_revision:1,action:"forget".into(),text:String::new()}).unwrap();
        let page=change_page(&c,None,24).unwrap();assert!(!page.to_string().contains(sentinel));
        c.execute("DELETE FROM communication_situation_sources",[]).unwrap();
        assert!(!change_page(&c,None,24).unwrap().to_string().contains(sentinel),"historical dependency must survive source removal");
    }
    #[test]
    fn review_regression_old_policy_receipt_is_reconsidered_exactly_once() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"old-receipt","Order received.");
            {let c=db.0.lock().unwrap();let sig=thread_signatures(&c,&account(&c).unwrap()).unwrap()["old-receipt"].0.clone();
             c.execute("INSERT INTO communication_situation_sources VALUES('fixture','old-receipt',?1,NULL,?2,'now')",params![sig,json!({"threadId":"old-receipt","relevant":false,"attentionVersion":1,"summary":"Routine notification"}).to_string()]).unwrap();}
            let mut discoveries=0;
            for _ in 0..2 {refresh_with(&db,false,vec![],|_,input,_,purpose|{if purpose=="situation_discovery"{discoveries+=1;}std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))}).await.unwrap();}
            assert_eq!(discoveries,1);let c=db.0.lock().unwrap();assert!(observations(&c,"fixture").unwrap()[0]["situationId"].is_string());
        });
    }
    #[test]
    fn review_regression_discovery_catalog_prioritizes_matching_identity_beyond_first_page() {
        let known=(0..120).map(|i|json!({"id":format!("s{i:03}"),"title":"Order","state":"active","briefing":{}})).collect::<Vec<_>>();
        let observations=vec![json!({"threadId":"changed","situationId":"s119"})];
        let threads=vec![json!({"threadId":"changed","localSituationCandidates":["s118"],"messages":[]})];
        let catalog=discovery_catalog(&known,&observations,&threads);
        assert_eq!(catalog.len(),96);assert_eq!(catalog[0]["id"],"s119");assert_eq!(catalog[1]["id"],"s118");
    }
    #[test]
    fn review_regression_background_egress_omits_forgotten_claims_and_message_revisions() {
        tauri::async_runtime::block_on(async {
            let db=database();let sentinel="FORGOTTEN_EGRESS_SENTINEL";mail(&db,"old",sentinel);
            {let mut c=db.0.lock().unwrap();let a=account(&c).unwrap();let sig=thread_signatures(&c,&a).unwrap()["old"].0.clone();
             let source=thread(&c,&a,"old").unwrap();let m=&source["messages"][0];
             c.execute("INSERT INTO communication_situations(account_id,id,title,briefing_json,updated_at) VALUES('fixture','s',?1,?2,'now')",params![sentinel,json!({"whereThingsStand":sentinel,"whatChanged":sentinel}).to_string()]).unwrap();
             c.execute("INSERT INTO communication_situation_sources VALUES('fixture','old',?1,'s',?2,'now')",params![sig,json!({"threadId":"old","relevant":true,"summary":sentinel,"attentionVersion":2,"attention":{"title":"Review","why":"Review","action":"Review"},"evidenceRefs":[{"messageId":m["id"],"fingerprint":m["fingerprint"],"threadId":"old"}]}).to_string()]).unwrap();
             for (revision,action,text)in [(0,"corrected","Already handled"),(1,"forget","")] {learning::change(&mut c,learning::LearningRequest{account_id:"fixture".into(),thread_id:"old".into(),signature:sig.clone(),expected_revision:revision,action:action.into(),text:text.into()}).unwrap();}}
            mail(&db,"new","New safe evidence.");{let c=db.0.lock().unwrap();c.execute("UPDATE gmail_messages SET thread_id='old',snapshot_json=json_set(snapshot_json,'$.threadId','old') WHERE id='new'",[]).unwrap();}
            let mut calls=Vec::new();
            refresh_with(&db,false,vec![],|_,input,_,purpose|{assert!(!input.to_string().contains(sentinel),"{purpose} leaked forgotten context");calls.push(purpose.to_owned());std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))}).await.unwrap();
            assert!(calls.iter().any(|s|s=="situation_discovery"));assert!(calls.iter().any(|s|s=="situation_briefing"));
        });
    }
    #[test]
    fn elapsed_window_and_unrelated_arrival_do_not_invalidate_selected_sources() {
        let db=database();mail(&db,"old","Still stored evidence");
        let snapshot_at=chrono::Utc::now().timestamp_millis()-60_000;
        let(a,rev,signatures)={
            let c=db.0.lock().unwrap();let a=account(&c).unwrap();
            let at=snapshot_at-i64::from(a.horizon_days)*86_400_000+1000;
            c.execute("UPDATE gmail_messages SET internal_date=?1 WHERE id='old'",[at]).unwrap();
            let signatures=thread_signatures_for_window(&c,&a,snapshot_at).unwrap().into_iter().map(|(k,v)|(k,Some(v))).collect::<BTreeMap<_,_>>();
            assert_eq!(signatures.len(),1);
            assert!(thread_signatures(&c,&a).unwrap().is_empty(),"the message aged out of a newly started window");
            let rev=revision(&c,&a.id).unwrap();
            guard(&c,&a,rev,&signatures,snapshot_at).unwrap();
            (a,rev,signatures)
        };
        mail(&db,"new","A newer reply arrived after the snapshot");
        let c=db.0.lock().unwrap();
        guard(&c,&a,rev,&signatures,snapshot_at).unwrap();
        c.execute("UPDATE gmail_messages SET fingerprint='changed' WHERE id='old'",[]).unwrap();
        assert_eq!(guard(&c,&a,rev,&signatures,snapshot_at).unwrap_err(),"situation_context_changed_retry");
    }
    #[test]
    fn dependency_removal_and_return_from_absent_baseline_invalidate() {
        let db=database();mail(&db,"selected","Current request");
        let c=db.0.lock().unwrap();let a=account(&c).unwrap();
        let time=chrono::Utc::now().timestamp_millis();let rev=revision(&c,&a.id).unwrap();
        let signatures=thread_signatures_for_window(&c,&a,time).unwrap();
        let mut dependencies=BTreeMap::new();
        bind_dependencies(&mut dependencies,&signatures,vec!["selected".into()]);
        c.execute("UPDATE gmail_messages SET available=0 WHERE thread_id='selected'",[]).unwrap();
        assert_eq!(guard(&c,&a,rev,&dependencies,time).unwrap_err(),"situation_context_changed_retry");
        let absent=thread_signatures_for_window(&c,&a,time).unwrap();dependencies.clear();
        bind_dependencies(&mut dependencies,&absent,vec!["selected".into()]);
        guard(&c,&a,rev,&dependencies,time).unwrap();
        c.execute("UPDATE gmail_messages SET available=1 WHERE thread_id='selected'",[]).unwrap();
        assert_eq!(guard(&c,&a,rev,&dependencies,time).unwrap_err(),"situation_context_changed_retry");
    }
    #[test]
    fn sync_and_auth_waits_do_not_reset_real_retry_history() {
        tauri::async_runtime::block_on(async {
            let db = database();
            let mut retry = Backoff::default();
            retry.record(Some("fixture"), &Err("model_failed".into()), 100);
            for state in ["syncing", "authentication_required"] {
                db.0.lock().unwrap().execute("UPDATE gmail_accounts SET status=?1", [state]).unwrap();
                let result = refresh(&db, false).await;
                retry.record(Some("fixture"), &result, 200);
            }
            retry.record(Some("fixture"), &Err("model_failed_again".into()), 300);
            assert_eq!(retry.for_account("fixture"), (2, 600300));
        });
    }
    fn answer(purpose: &str, input: &Value) -> Value {
        if purpose == "situation_discovery" {
            json!({"observations":input["threads"].as_array().unwrap().iter().map(|t|json!({"threadId":t["threadId"],"relevant":true,"situationId":"new:purchase","title":"Purchase","summary":"A document was requested.","people":[{"email":"lender@example.invalid","name":"Lender","role":"Lending contact"}],"relationships":[],"details":[]})).collect::<Vec<_>>()})
        } else {
            json!({"briefings":input["situations"].as_array().unwrap().iter().map(|s|json!({"situationId":s["id"],"whereThingsStand":"Documents are being reviewed.","whatChanged":"A statement was requested.","nextMoves":[]})).collect::<Vec<_>>()})
        }
    }
    #[test]
    fn optional_detail_filter_keeps_transaction_identity_without_model_retry(){
        tauri::async_runtime::block_on(async{
            let db=database();mail(&db,"order","Order A-123 costs $20. We are preparing it.");let mut discovery=0;let mut retries=0;
            refresh_with(&db,false,vec![],|_,input,_,purpose|{
                let output=if matches!(purpose,"situation_discovery"|"situation_discovery_retry"){
                    if purpose=="situation_discovery"{discovery+=1;}else{retries+=1;}
                    let details=if purpose=="situation_discovery"{json!([
                        {"kind":"reference","label":"order","value":"A-123","messageId":"order","quote":"Order A-123 costs $20."},
                        {"kind":"payment","label":"amount","value":"$20","messageId":"order","quote":"Order A-123 costs $20."},
                        {"kind":"reference","label":"status","value":"Preparing for shipment","messageId":"order","quote":"We are preparing it."}])}else{json!([])};
                    json!({"observations":[{"threadId":"order","relevant":true,"situationId":"new:1","title":"Order","summary":"An order is being prepared.","people":[],"relationships":[],"details":details,"attention":null}]})
                }else{answer(purpose,&input)};
                std::future::ready(Ok((output.to_string(),json!({}))))
            }).await.unwrap();
            assert_eq!(discovery,1);assert_eq!(retries,0,"bad optional detail caused destructive model retry");let c=db.0.lock().unwrap();let records=observations(&c,"fixture").unwrap();let record=&records[0];assert_eq!(record["details"].as_array().unwrap().len(),2);assert_eq!(record["trackingKind"],"transaction");assert!(record["transactionKey"].as_str().is_some());assert_eq!(record["omittedOptionalDetailCount"],1);assert_eq!(record["omittedOptionalDetails"],json!([{"detailIndex":2,"reason":"detail_value_not_in_quote"}]));
        });
    }
    #[test]
    fn local_discovery_batches_six_sources_without_reusing_new_identity_keys() {
        tauri::async_runtime::block_on(async {
            let db=database();for i in 0..6 {mail(&db,&format!("t{i}"),"Please provide a statement.");}
            let mut sizes=Vec::new();let mut catalogs=Vec::new();
            refresh_batched(&db,false,"fixture",vec![],|_,input,_,purpose| {
                let mut response=answer(purpose,&input);
                if purpose=="situation_discovery" {
                    sizes.push(input["threads"].as_array().unwrap().len());
                    catalogs.push(input["knownSituations"].as_array().unwrap().len());
                    for observation in response["observations"].as_array_mut().unwrap(){observation["situationId"]=json!("new:1");}
                }
                std::future::ready(Ok((response.to_string(),json!({}))))
            },||Ok(()),2).await.unwrap();
            assert_eq!(sizes,vec![2,2,2]);assert_eq!(catalogs,vec![0,1,2]);
            let c=db.0.lock().unwrap();assert_eq!(observations(&c,"fixture").unwrap().len(),6);
            assert_eq!(situations(&c,"fixture").unwrap().len(),3,"new:1 is local to a request; later catalogs carry canonical identities");
        });
    }
    #[test]
    fn local_discovery_later_failure_or_source_change_never_publishes_partial_batches() {
        tauri::async_runtime::block_on(async {
            for mutate in [false,true] {
                let db=database();for i in 0..6 {mail(&db,&format!("t{i}"),"Please provide a statement.");}
                let mut calls=0;
                let result=refresh_batched(&db,false,"fixture",vec![],|_,input,_,purpose| {
                    if purpose=="situation_discovery" {
                        calls+=1;
                        if mutate&&calls==1 {db.0.lock().unwrap().execute("UPDATE gmail_messages SET fingerprint='changed-during-first-batch' WHERE id='t5'",[]).unwrap();}
                        if !mutate&&calls==2 {return std::future::ready(Err("synthetic_second_batch_failed".into()));}
                    }
                    std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
                },||Ok(()),2).await;
                assert_eq!(result.unwrap_err(),if mutate{"situation_context_changed_retry"}else{"synthetic_second_batch_failed"});
                assert_eq!(calls,if mutate{1}else{2});
                let c=db.0.lock().unwrap();assert!(observations(&c,"fixture").unwrap().is_empty());assert!(situations(&c,"fixture").unwrap().is_empty());
            }
        });
    }
    #[test]
    fn related_threads_share_a_persistent_situation_and_unchanged_inputs_skip_models() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Please provide a statement.");
            mail(&db, "ab", "The inspection is arranged.");
            let mut calls = 0;
            refresh_with(&db, false, vec![], |_, input, _, purpose| {
                calls += 1;
                std::future::ready(Ok((
                    answer(purpose, &input).to_string(),
                    json!({"synthetic":true}),
                )))
            })
            .await
            .unwrap();
            assert_eq!(calls, 2);
            let before = snapshot(&db.0.lock().unwrap()).unwrap();
            assert_eq!(before["situations"].as_array().unwrap().len(), 1);
            assert_eq!(before["observations"].as_array().unwrap().len(), 2);
            assert_eq!(before["situations"][0]["stale"], false);
            refresh_with(&db, false, vec![], |_, _, _, _| {
                calls += 1;
                std::future::ready(Err("must not call model".into()))
            })
            .await
            .unwrap();
            assert_eq!(calls, 2);
            mail(&db, "aa", "Updated document request.");
            let mut seen = 0;
            refresh_with(&db, false, vec![], |_, input, _, purpose| {
                if purpose == "situation_discovery" {
                    seen = input["threads"].as_array().unwrap().len();
                }
                std::future::ready(Ok((answer(purpose, &input).to_string(), json!({}))))
            })
            .await
            .unwrap();
            assert_eq!(seen, 1);
            let after = snapshot(&db.0.lock().unwrap()).unwrap();
            assert_eq!(after["situations"][0]["id"], before["situations"][0]["id"]);
        });
    }
    #[test]
    fn operator_changes_during_model_work_prevent_publication() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Document request");
            let result = refresh_with(&db, false, vec![], |_, input, _, purpose| {
                bump(&db.0.lock().unwrap(), "fixture").unwrap();
                std::future::ready(Ok((answer(purpose, &input).to_string(), json!({}))))
            })
            .await;
            assert_eq!(result.unwrap_err(), "situation_context_changed_retry");
            let c = db.0.lock().unwrap();
            assert!(situations(&c, "fixture").unwrap().is_empty());
            let status: String = c
                .query_row("SELECT status FROM communication_runs", [], |r| r.get(0))
                .unwrap();
            assert_eq!(status, "failed");
        });
    }
    #[test]
    fn unrelated_arrival_during_model_work_does_not_discard_the_batch() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"selected","Document request");
            refresh_with(&db,false,vec![],|_,input,_,purpose|{
                if purpose=="situation_discovery" {mail(&db,"unrelated","An unrelated new message");}
                std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
            }).await.unwrap();
            let c=db.0.lock().unwrap();
            assert_eq!(observations(&c,"fixture").unwrap().len(),1);
            assert_eq!(observations(&c,"fixture").unwrap()[0]["threadId"],"selected");
        });
    }
    #[test]
    fn unreadable_cached_thread_does_not_starve_other_extraction_work() {
        tauri::async_runtime::block_on(async {
            for body in ["","<html><head><style>.hidden {color:red}</style></head></html>"] {
                let db=database();mail(&db,"unreadable",body);mail(&db,"valid","Please confirm the inspection");
                refresh_with(&db,false,vec![],|_,input,_,purpose|{
                    if purpose=="situation_discovery" {
                        assert_eq!(input["threads"].as_array().unwrap().len(),1);
                        assert_eq!(input["threads"][0]["threadId"],"valid");
                    }
                    std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
                }).await.unwrap();
                let c=db.0.lock().unwrap();let saved=observations(&c,"fixture").unwrap();
                assert!(saved.iter().any(|o|o["threadId"]=="unreadable"&&o["skipped"]=="gmail_cached_text_unavailable"));
                assert!(saved.iter().any(|o|o["threadId"]=="valid"&&o["relevant"]==true));
            }
        });
    }
    #[test]
    fn participating_thread_change_during_model_work_still_rejects_publication() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"selected","Document request");
            let result=refresh_with(&db,false,vec![],|_,input,_,purpose|{
                if purpose=="situation_briefing" {mail(&db,"selected","The request was cancelled");}
                std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
            }).await;
            assert_eq!(result.unwrap_err(),"situation_context_changed_retry");
            assert!(observations(&db.0.lock().unwrap(),"fixture").unwrap().is_empty());
        });
    }
    #[test]
    fn prior_situation_sources_remain_bound_when_no_discovery_is_needed() {
        tauri::async_runtime::block_on(async {
            let db=database();mail(&db,"prior","A document was requested");
            refresh_with(&db,true,vec![],|_,input,_,purpose|
                std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
            ).await.unwrap();
            let result=refresh_with(&db,true,vec![],|_,input,_,purpose|{
                assert_eq!(purpose,"situation_briefing");
                mail(&db,"prior","The earlier request is withdrawn");
                std::future::ready(Ok((answer(purpose,&input).to_string(),json!({}))))
            }).await;
            assert_eq!(result.unwrap_err(),"situation_context_changed_retry");
        });
    }
    #[test]
    fn dismissed_situation_is_not_recreated_by_changed_mail() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Document request");
            refresh_with(&db, false, vec![], |_, i, _, p| {
                std::future::ready(Ok((answer(p, &i).to_string(), json!({}))))
            })
            .await
            .unwrap();
            let id = situations(&db.0.lock().unwrap(), "fixture").unwrap()[0]["id"]
                .as_str()
                .unwrap()
                .to_string();
            edit(&mut db.0.lock().unwrap(), &id, Edit::Dismiss, "").unwrap();
            mail(&db, "aa", "New request");
            refresh_with(&db, false, vec![], |_, i, _, p| {
                let mut a = answer(p, &i);
                a["observations"][0]["title"] = json!("A different model title");
                std::future::ready(Ok((a.to_string(), json!({}))))
            })
            .await
            .unwrap();
            let all = situations(&db.0.lock().unwrap(), "fixture").unwrap();
            assert_eq!(all.len(), 1);
            assert_eq!(all[0]["state"], "dismissed");
        });
    }
    #[test]
    fn paused_background_does_not_start_a_run() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Request");
            db.0.lock()
                .unwrap()
                .execute("UPDATE communication_situation_state SET enabled=0", [])
                .unwrap();
            refresh(&db, false).await.unwrap();
            let count: i64 =
                db.0.lock()
                    .unwrap()
                    .query_row("SELECT count(*) FROM communication_runs", [], |r| r.get(0))
                    .unwrap();
            assert_eq!(count, 0);
        });
    }
    #[test]
    fn irrelevant_threads_are_remembered_without_creating_situations() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Newsletter promotion");
            refresh_with(&db,false,vec![],|_,input,_,purpose|{assert_eq!(purpose,"situation_discovery");std::future::ready(Ok((json!({"observations":[{"threadId":input["threads"][0]["threadId"],"relevant":false,"situationId":"","title":"","summary":"Routine newsletter noise.","people":[],"relationships":[],"details":[]}]}).to_string(),json!({}))))}).await.unwrap();
            let c = db.0.lock().unwrap();
            assert!(situations(&c, "fixture").unwrap().is_empty());
            assert_eq!(observations(&c, "fixture").unwrap().len(), 1);
            assert!(snapshot(&c).unwrap()["observations"]
                .as_array()
                .unwrap()
                .is_empty());
        });
    }
    #[test]
    fn changed_research_prevents_publication() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Statement requested");
            let result = refresh_checked(
                &db,
                false,
                "fixture",
                vec![],
                |_, input, _, purpose| {
                    std::future::ready(Ok((answer(purpose, &input).to_string(), json!({}))))
                },
                || Err("situation_research_changed_retry".into()),
            )
            .await;
            assert_eq!(result.unwrap_err(), "situation_research_changed_retry");
            assert!(situations(&db.0.lock().unwrap(), "fixture")
                .unwrap()
                .is_empty());
        });
    }
    #[test]
    fn invalid_person_still_gets_one_map_only_retry() {
      tauri::async_runtime::block_on(async {
        let db=database();mail(&db,"aa","Please provide a statement.");let mut calls=vec![];
        refresh_with(&db,false,vec![],|_,input,schema,purpose| {
          calls.push(purpose.to_string());
          let mut output=answer(if purpose=="situation_discovery_retry"{"situation_discovery"}else{purpose},&input);
          if purpose=="situation_discovery" {output["observations"][0]["people"][0]["email"]=json!("outside-source@example.invalid");}
          if purpose=="situation_discovery_retry" {assert_eq!(schema["properties"]["observations"]["items"]["anyOf"][0]["properties"]["details"]["maxItems"],0);}
          std::future::ready(Ok((output.to_string(),json!({"synthetic":true}))))
        }).await.unwrap();
        assert_eq!(calls,vec!["situation_discovery","situation_discovery_retry","situation_briefing"]);
        let snapshot=snapshot(&db.0.lock().unwrap()).unwrap();assert_eq!(snapshot["situations"].as_array().unwrap().len(),1);assert!(snapshot["observations"][0]["details"].as_array().unwrap().is_empty());
      });
    }
    #[test]
    fn over_bound_thread_is_recorded_as_skipped_without_failing_the_batch() {
        tauri::async_runtime::block_on(async {
            let db = database();
            mail(&db, "aa", "Please provide a statement.");
            mail(&db, "bb", "Announcement to a large list.");
            let cc = (0..30).map(|i| format!("person{i}@example.invalid")).collect::<Vec<_>>().join(", ");
            db.0.lock().unwrap().execute("UPDATE gmail_messages SET snapshot_json=json_set(snapshot_json,'$.cc',?1) WHERE id='bb'", [cc]).unwrap();
            let mut discovered = vec![];
            refresh_with(&db, false, vec![], |_, input, _, purpose| {
                if purpose == "situation_discovery" {
                    discovered.extend(input["threads"].as_array().unwrap().iter().map(|t| t["threadId"].clone()));
                }
                std::future::ready(Ok((answer(purpose, &input).to_string(), json!({}))))
            })
            .await
            .unwrap();
            assert_eq!(discovered, vec![json!("aa")]);
            let c = db.0.lock().unwrap();
            let skipped = observations(&c, "fixture").unwrap().into_iter().find(|o| o["threadId"] == "bb").unwrap();
            assert_eq!(skipped["skipped"], "situation_thread_bounds");
            assert_eq!(skipped["relevant"], false);
        });
    }
    #[test]
    fn situation_paging_does_not_drop_new_observations_at_old_admission_cap() {
        tauri::async_runtime::block_on(async {
            let db = database();
            {
                let c = db.0.lock().unwrap();
                for i in 0..24 {
                    c.execute("INSERT INTO communication_situations(account_id,id,title,state,updated_at) VALUES('fixture',?1,?1,'active','now')", [format!("s{i}")]).unwrap();
                }
            }
            mail(&db, "aa", "Please provide a statement.");
            let mut discovery = 0;
            for _ in 0..2 {
                refresh_with(&db, false, vec![], |_, input, _, purpose| {
                    if purpose == "situation_discovery" {
                        discovery += 1;
                    }
                    std::future::ready(Ok((answer(purpose, &input).to_string(), json!({}))))
                })
                .await
                .unwrap();
            }
            assert_eq!(discovery, 1);
            let c = db.0.lock().unwrap();
            assert_eq!(situations(&c, "fixture").unwrap().len(), 25);
            let observed = observations(&c, "fixture").unwrap();
            assert!(observed[0]["situationId"].is_string());
            assert!(observed[0]["deferred"].is_null());
            drop(c);
            edit(&mut db.0.lock().unwrap(), "s0", Edit::Close, "").unwrap();
            assert_eq!(observations(&db.0.lock().unwrap(), "fixture").unwrap().len(), 1);
        });
    }

}

#[cfg(test)]
mod local_acceptance {
    use super::*;
    #[test]
    #[ignore = "requires an isolated copy of the installed DB and approved local model"]
    fn installed_mail_local_analysis_copy() { run_copy("ollama"); }
    #[test]
    #[ignore = "requires explicitly approved private Codex evidence and an isolated sanitized fixture"]
    fn installed_mail_codex_analysis_copy() {
        assert_eq!(std::env::var("OLYMPUS_PRIVATE_CODEX_ANALYSIS_APPROVED").as_deref(),Ok("1"));
        let app_data=std::path::PathBuf::from(std::env::var_os("APPDATA").unwrap()).join("com.projectolympus.commandstation");
        let _=crate::commands::subscription_jobs::APP_DATA_FOR_TESTS.set(app_data);
        run_copy("codex");
    }
    fn run_copy(provider:&str) {
        assert_eq!(std::env::var("OLYMPUS_EMAIL_ANALYSIS_PROVIDER").unwrap(),provider);
        let path=std::path::PathBuf::from(std::env::var_os("OLYMPUS_LOCAL_ANALYSIS_TEST_DB").expect("isolated copy required"));
        assert_eq!(path.file_name().unwrap(),"olympus-local-analysis-test.sqlite");
        let path=path.canonicalize().unwrap();
        let acceptance=std::path::PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap()).join("OlympusAcceptance").canonicalize().unwrap();
        assert!(path.starts_with(acceptance),"private fixture must stay outside the repository and live app directory");
        let diagnostic=path.with_extension("diagnostic.json");
        let c=Connection::open(path).unwrap();let db=Db(std::sync::Mutex::new(c));
        let account_id=account(&db.0.lock().unwrap()).unwrap().id;
        let result=tauri::async_runtime::block_on(refresh_checked(&db,true,&account_id,vec![],|instructions,input,schema,purpose|{
            let diagnostic=diagnostic.clone();let db=&db;
            async move {
                let target=diagnostic.with_file_name(format!("local-analysis-{purpose}.json"));
                let mut capture=json!({"purpose":purpose,"instructions":instructions,"input":input,"schema":schema});
                std::fs::write(&target,serde_json::to_vec_pretty(&capture).unwrap()).unwrap();
                let result=infer(db,instructions,input.clone(),schema,purpose).await;
                if let Ok((raw,_))=&result {
                    capture["output"]=json!(serde_json::from_str::<Value>(raw).ok());
                    std::fs::write(&target,serde_json::to_vec_pretty(&capture).unwrap()).unwrap();
                }
                result
            }
        },||Ok(())));
        if let Err(error)=result{panic!("local analysis failed: {error}");}
        let c=db.0.lock().unwrap();let snapshot=super::super::snapshot(&c).unwrap();
        eprintln!("Selected analysis succeeded: attention={} observations={}",snapshot["attention"].as_array().map_or(0,Vec::len),snapshot["observations"].as_array().map_or(0,Vec::len));
    }
}

/// Read-only current revision projection, not an immutable event journal.
/// Pagination is by stable situation identity. Callers must disclose hasMore and
/// source truncation; merely reading this page never acknowledges anything.
pub(crate) fn change_page(c:&Connection,after:Option<&str>,limit:usize)->Result<Value,String>{
    if !(1..=24).contains(&limit)||after.is_some_and(|id|id.len()>256){return Err("situation_page_invalid".into());}
    let a=account(c)?;
    let signatures=thread_signatures(c,&a)?;
    let learned=learning::snapshot(c,&a.id,&signatures)?;
    let mut query=c.prepare("WITH ranked AS (SELECT s.id,s.title,s.state,s.briefing_json,max(COALESCE(unixepoch(s.updated_at)*1000,0),COALESCE((SELECT max(m.internal_date) FROM communication_situation_sources x JOIN gmail_messages m ON m.account_id=x.account_id AND m.thread_id=x.thread_id WHERE x.account_id=s.account_id AND x.situation_id=s.id AND m.available=1 AND m.in_scope=1),0)) AS changed FROM communication_situations s WHERE s.account_id=?1) SELECT id,title,state,briefing_json FROM ranked WHERE ?2='' OR changed<(SELECT changed FROM ranked WHERE id=?2) OR (changed=(SELECT changed FROM ranked WHERE id=?2) AND id>?2) ORDER BY changed DESC,id LIMIT ?3").map_err(err)?;
    let mut rows=query.query_map(params![a.id,after.unwrap_or(""),limit+1],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
    let has_more=rows.len()>limit;rows.truncate(limit);
    let next=if has_more{rows.last().map(|r|r.0.clone())}else{None};
    let mut items=Vec::new();
    for(id,mut title,state,briefing)in rows {
        let mut q=c.prepare("SELECT thread_id,signature,payload_json FROM communication_situation_sources WHERE account_id=?1 AND situation_id=?2 ORDER BY thread_id LIMIT 49").map_err(err)?;
        let mut raw=q.query_map(params![a.id,id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))).map_err(err)?.collect::<Result<Vec<_>,_>>().map_err(err)?;
        let sources_truncated=raw.len()>48;raw.truncate(48);
        let mut sources=Vec::new();let mut threads=Vec::new();
        for(thread,signature,payload)in raw {
            let mut source:Value=serde_json::from_str(&payload).map_err(err)?;
            let current=signatures.get(&thread).is_some_and(|s|s.0==signature);
            let feedback=learned.iter().find(|f|f["threadId"]==thread);
            let suppressed=feedback.is_some_and(|f|f["forgottenSignatures"].as_array().is_some_and(|s|s.contains(&json!(signature)))||(f["signature"]==signature&&current&&(matches!(f["action"].as_str(),Some("handled"|"dismissed"|"forgotten"))||(f["action"]=="snoozed"&&f["until"].as_i64().unwrap_or(i64::MAX)>chrono::Utc::now().timestamp_millis()))));
            source["threadId"]=json!(thread);source["signature"]=json!(signature);source["current"]=json!(current);source["suppressed"]=json!(suppressed);
            source["learningRevision"]=feedback.map(|f|f["revision"].clone()).unwrap_or(json!(0));
            // Forgotten evidence is not returned as context or as a candidate lead.
            if feedback.is_some_and(|f|f["forgottenSignatures"].as_array().is_some_and(|s|s.contains(&source["signature"]))) {continue;}
            threads.push(thread);sources.push(source);
        }
        let corrections=learning::durable_corrections(c,&a.id,&threads)?;
        let mut briefing:Value=serde_json::from_str(&briefing).map_err(err)?;
        let mut journal=changes::history(c,&a.id,&id,&learned)?;
        // A generated aggregate can retain an earlier forgotten claim even after its
        // direct source disappeared from the current page. Without complete aggregate
        // provenance, withhold it rather than promise a text-level redaction.
        let aggregates_withheld=has_forgotten_dependencies(c,&a.id,&id)?;
        if aggregates_withheld {
            title="Situation context withheld".into();briefing=Value::Null;journal=json!({"items":[],"hasMore":false,"withheld":true});
            for source in &mut sources { *source=json!({"threadId":source["threadId"],"signature":source["signature"],"current":source["current"],"suppressed":source["suppressed"],"evidenceRefs":source["evidenceRefs"],"interpretationWithheld":true}); }
        }
        let revision=content_fingerprint(&json!([id,title,state,briefing,sources,corrections,sources_truncated,journal["items"].as_array().and_then(|items|items.first()).map(|entry|&entry["revision"])]).to_string());
        items.push(json!({"id":id,"title":title,"state":state,"revision":revision,"briefing":briefing,"sources":sources,"operatorCorrections":corrections,"sourcesTruncated":sources_truncated,"changeJournal":journal,"aggregatesWithheld":aggregates_withheld}));
    }
    Ok(json!({"accountId":a.id,"items":items,"nextCursor":next,"hasMore":has_more}))
}
