use super::super::situation_contract as contract;
use super::*;
use crate::commands::{models, pantheon, research_retrieval, responses};
use std::collections::BTreeSet;

fn phase(c: &Connection, id: &str, name: &str, detail: Value) -> Result<(), String> {
    c.execute("UPDATE communication_runs SET payload_json=json_set(payload_json,'$.phase',?2) WHERE id=?1",params![id,name]).map_err(err)?;
    c.execute("INSERT INTO communication_events(run_id,node,state,at,result_json) VALUES(?1,?2,'completed',?3,?4)",params![id,name,now(),detail.to_string()]).map_err(err)?;
    Ok(())
}
fn guard(
    c: &Connection,
    a: &store::Account,
    rev: i64,
    signatures: &BTreeMap<String, (String, i64)>,
) -> Result<(), String> {
    let live = account(c)?;
    if live.id != a.id
        || live.horizon_days != a.horizon_days
        || revision(c, &a.id)? != rev
        || thread_signatures(c, &live)? != *signatures
    {
        return Err("situation_context_changed_retry".into());
    }
    Ok(())
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
        people.extend(participant_emails(&format!("{} {} {}",m.sender,m.recipients,m.cc)));
        json!({"id":m.id,"threadId":id,"fingerprint":m.fingerprint,"timestamp":m.internal_date,"sender":m.sender,"recipients":m.recipients,"cc":m.cc,"subject":m.subject,"text":m.clean_text.chars().take(2000).collect::<String>(),"truncated":m.clean_text.chars().count()>2000,"sent":m.labels.iter().any(|s|s=="SENT")})
    }).collect::<Vec<_>>();
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
        ["balance alert","account verification","verification code","membership activation","paperless","payment succeeded","thank you for your purchase","thank you for your steam purchase","new account reported","personal information appearing","icloud subscription","storage upgrade","welcome to dashpass"].iter().any(|pattern|subject.contains(pattern))
    })
}

#[cfg(test)]
mod eligibility_tests {
    use super::*;
    #[test]
    fn routine_events_do_not_become_new_maps_but_replies_can_be_reviewed() {
        for subject in ["Chase credit card balance alert","DashPass membership activation","New account reported","Paperless confirmation: Statements","Thank you for your Steam purchase!"] {
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

fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}
async fn infer(
    db: &Db,
    instructions: &str,
    input: Value,
    schema: Value,
    purpose: &str,
) -> Result<(String, Value), String> {
    if input.to_string().len() > 220_000 {
        return Err("situation_model_input_budget".into());
    }
    let route = models::resolve(models::Capability::Primary);
    let mut r = models::RequestRecord::new(&route, purpose);
    models::save(db, &r)?;
    let answer = responses::structured(&route, instructions, input, schema, &mut r).await;
    models::save(db, &r)?;
    answer.map(|a| (a, json!(r)))
}
#[tauri::command]
pub async fn situation_refresh(app: tauri::AppHandle) -> Result<(), String> {
    let db = app.state::<Db>();
    let result = refresh(&db, true).await;
    record_outcome(&db, &result);
    result
}
pub(super) async fn refresh(db: &Db, manual: bool) -> Result<(), String> {
    {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        let a = account(&c)?;
        ensure(&c, &a.id)?;
        let (enabled,last):(bool,i64)=c.query_row("SELECT enabled,last_attempt FROM communication_situation_state WHERE account_id=?1",[&a.id],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
        if !manual && (!enabled || chrono::Utc::now().timestamp_millis() - last < 300_000) {
            return Ok(());
        }
        if a.status == "syncing" || a.status == "authentication_required" {
            return Ok(());
        }
    }
    let entries = tauri::async_runtime::spawn_blocking(pantheon::parse_pantheon_from_vault)
        .await
        .map_err(err)??;
    let expected = research_stamp(&entries);
    refresh_checked(
        db,
        manual,
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
    entries: Vec<pantheon::PantheonEntry>,
    mut model: F,
    check_research: V,
) -> Result<(), String>
where
    F: FnMut(&'static str, Value, Value, &'static str) -> Fut,
    Fut: std::future::Future<Output = Result<(String, Value), String>>,
    V: FnOnce() -> Result<(), String>,
{
    let time = chrono::Utc::now().timestamp_millis();
    let stamp = research_stamp(&entries);
    let (a, rev, signatures, mut known, mut observations, operator_updates, threads, id) = {
        let c = db.0.lock().map_err(|_| "database_busy")?;
        let a = account(&c)?;
        ensure(&c, &a.id)?;
        let enabled: bool = c
            .query_row(
                "SELECT enabled FROM communication_situation_state WHERE account_id=?1",
                [&a.id],
                |r| r.get(0),
            )
            .map_err(err)?;
        if !manual && !enabled {
            return Ok(());
        }
        let rev = revision(&c, &a.id)?;
        let signatures = thread_signatures(&c, &a)?;
        let known = situations(&c, &a.id)?;
        let observations = observations(&c, &a.id)?;
        let operator_updates = updates(&c, &a.id)?;
        let mut changed = signatures
            .iter()
            .filter(|(id, s)| {
                !observations
                    .iter()
                    .any(|o| o["threadId"] == **id && o["signature"] == s.0)
            })
            .collect::<Vec<_>>();
        changed.sort_by(|a, b| b.1 .1.cmp(&a.1 .1).then_with(|| a.0.cmp(b.0)));
        let threads = changed
            .into_iter()
            .take(6)
            .map(|(id, _)| thread(&c, &a, id))
            .collect::<Result<Vec<_>, _>>()?;
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
            return Ok(());
        }
        let id = crate::commands::delegation::run_id();
        let run = json!({"id":id,"accountId":a.id,"graph":GRAPH,"status":"running","phase":"Reading changed correspondence","startedAt":now(),"finishedAt":null,"durationMs":null,"days":a.horizon_days,"items":[],"definition":[{"id":"snapshot","effect":"local_read"},{"id":"discover","after":["snapshot"],"contract":"situation-discovery@1","effect":"model_read"},{"id":"brief","after":["discover"],"contract":"situation-briefing@1","effect":"model_read"},{"id":"validate","after":["brief"],"effect":"local_read"},{"id":"publish","after":["validate"],"effect":"generated_local_write"}],"skills":["situation-discovery@1","situation-briefing@1"],"error":null,"stale":false,"model":models::PRIMARY_MODEL});
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
        if !threads.is_empty(){
            let catalog=known.iter().map(|s|json!({"id":s["id"],"title":s["title"],"state":s["state"],"summary":s["briefing"]["whereThingsStand"].as_str().unwrap_or("").chars().take(300).collect::<String>()})).collect::<Vec<_>>();
            let update_context=operator_updates.iter().rev().take(8).map(|u|json!({"situationId":u["situationId"],"at":u["at"],"text":u["text"].as_str().unwrap_or("").chars().take(2000).collect::<String>()})).collect::<Vec<_>>();
            let (raw,receipt)=model(contract::EXTRACT,json!({"snapshotTime":time,"operatorEmail":a.email,"knownSituations":catalog,"operatorUpdates":update_context,"threads":threads}),contract::grounded_schema(&threads,false),"situation_discovery").await?;
            let known_ids=known.iter().filter_map(|s|s["id"].as_str().map(str::to_string)).collect();
            let parsed=match contract::parse_observations(&raw,&threads,&known_ids) {
                Ok(parsed)=>parsed,
                Err(e) if matches!(e.as_str(),"person_not_in_evidence"|"relationship_not_in_evidence"|"situation_output_bounds"|"detail_quote_mismatch"|"detail_source_missing"|"detail_invalid"|"portal_not_in_source"|"detail_value_not_in_quote")=>{
                    {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&signatures)?;phase(&c,&id,"Rechecking relationships",json!({"reason":e,"request":receipt}))?;}
                    let schema=contract::grounded_schema(&threads,true);
                    let (repair,repair_receipt)=model(contract::MAP_ONLY,json!({"snapshotTime":time,"operatorEmail":a.email,"knownSituations":catalog,"operatorUpdates":update_context,"threads":threads}),schema,"situation_discovery_retry").await?;
                    let parsed=contract::parse_observations(&repair,&threads,&known_ids)?;
                    if parsed.iter().any(|o|!o.details.is_empty()){return Err("map_retry_must_omit_details".into())}
                    let c=db.0.lock().map_err(|_|"database_busy")?;phase(&c,&id,"Relationships rechecked",json!({"request":repair_receipt,"optionalDetailsOmitted":true}))?;parsed
                },
                Err(e)=>return Err(e)
            };
            let mut new_keys:BTreeMap<String,String>=BTreeMap::new();
            for (mut o,t) in parsed.into_iter().zip(&threads){
                if o.situation_id.starts_with("new:")&&routine_notification(t){
                    o.relevant=false;o.situation_id.clear();o.title.clear();o.people.clear();o.relationships.clear();o.details.clear();
                    o.summary="Routine notification; no ongoing situation warranted.".into();
                }
                let mut record=json!(o);let tid=o.thread_id.clone();
                if let Some(old)=observations.iter().find(|s|s["threadId"]==tid){if let Some(id)=old["situationId"].as_str(){changed_ids.insert(id.to_string());}}
                if o.relevant {
                    let dismissed_target=observations.iter().find(|s|s["threadId"]==tid).and_then(|o|known.iter().find(|s|s["id"]==o["situationId"]&&matches!(s["state"].as_str(),Some("dismissed"|"closed")))).and_then(|s|s["id"].as_str()).map(str::to_owned);
                    let target=if let Some(id)=dismissed_target{id}else if o.situation_id.starts_with("new:"){
                        if let Some(s)=known.iter().find(|s|normalize(s["title"].as_str().unwrap_or(""))==normalize(&o.title)){s["id"].as_str().unwrap().to_string()}
                        else if let Some(id)=new_keys.get(&o.situation_id){id.clone()}
                        else {
                            if known.iter().filter(|s|!matches!(s["state"].as_str(),Some("dismissed"|"merged"|"closed"))).count()>=24{return Err("situation_limit_close_or_merge_some".into())}
                            let sid=crate::commands::delegation::run_id();new_keys.insert(o.situation_id.clone(),sid.clone());
                            let s=json!({"id":sid,"title":o.title,"state":"emerging","briefing":{},"updatedAt":now()});known.push(s.clone());new_situations.push(s);sid
                        }
                    }else{o.situation_id};
                    let mut target=target;
                    for _ in 0..96{let s=known.iter().find(|s|s["id"]==target).ok_or("unknown_situation")?;if let Some(next)=s["mergedInto"].as_str(){target=next.into()}else{break;}}
                    record["situationId"]=json!(target);changed_ids.insert(target);
                }else{record["situationId"]=Value::Null;}
                record["signature"]=json!(signatures.get(&tid).ok_or("source_disappeared")?.0);
                record["evidenceRefs"]=json!(t["messages"].as_array().unwrap().iter().map(|m|json!({"messageId":m["id"],"threadId":tid,"fingerprint":m["fingerprint"],"timestamp":m["timestamp"]})).collect::<Vec<_>>());
                record["subject"]=t["messages"].as_array().unwrap().last().unwrap()["subject"].clone();
                record["timestamp"]=t["messages"].as_array().unwrap().last().unwrap()["timestamp"].clone();record["updatedAt"]=json!(now());
                if let Some(old)=observations.iter_mut().find(|s|s["threadId"]==tid){*old=record.clone()}else{observations.push(record.clone())}fresh.push(record);
            }
            let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&signatures)?;phase(&c,&id,"Building relationships",json!({"request":receipt,"observations":fresh}))?;
        }
        let mut targets=known.iter().filter(|s|!matches!(s["state"].as_str(),Some("dismissed"|"merged"|"closed"))).filter(|s|manual||changed_ids.contains(s["id"].as_str().unwrap())||s["briefing"]["contextRevision"]!=rev||s["briefing"]["researchSignature"]!=stamp||s["briefing"]["sourceSignatures"]!=source_signatures(&observations,&s["id"],&signatures)).collect::<Vec<_>>();
        targets.sort_by_key(|s|(!changed_ids.contains(s["id"].as_str().unwrap()),s["updatedAt"].as_str().unwrap_or("")));
        let contexts=targets.into_iter().take(6).map(|s|{
            let updates=operator_updates.iter().filter(|u|u["situationId"]==s["id"]).rev().take(4).map(|u|json!({"id":u["id"],"at":u["at"],"text":u["text"].as_str().unwrap_or("").chars().take(4000).collect::<String>(),"truncated":u["text"].as_str().unwrap_or("").chars().count()>4000})).collect::<Vec<_>>();
            let query=format!("{} {}",s["title"].as_str().unwrap_or(""),updates.iter().filter_map(|u|u["text"].as_str()).collect::<Vec<_>>().join(" "));
            let mut obs=observations.iter().filter(|o|o["situationId"]==s["id"]&&o["relevant"]==true&&current(o,&signatures)).cloned().collect::<Vec<_>>();obs.sort_by_key(|o|std::cmp::Reverse(o["timestamp"].as_i64().unwrap_or(0)));obs.truncate(8);
            for o in &mut obs {if let Some(details)=o["details"].as_array_mut(){details.truncate(5);for d in details {d.as_object_mut().unwrap().remove("quote");}} o.as_object_mut().unwrap().remove("evidenceRefs");}
            json!({"id":s["id"],"title":s["title"],"priorBriefing":s["briefing"]["whereThingsStand"],"observations":obs,"operatorUpdates":updates,"research":research(&entries,&query)})
        }).collect::<Vec<_>>();
        let briefings=if contexts.is_empty(){vec![]}else{
            {let c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&signatures)?;phase(&c,&id,"Updating situation briefings",json!({"situations":contexts.iter().map(|c|&c["id"]).collect::<Vec<_>>()}))?;}
            let (raw,receipt)=model(contract::BRIEF,json!({"snapshotTime":time,"situations":contexts}),contract::briefing_schema(),"situation_briefing").await?;
            let parsed=contract::parse_briefings(&raw,&contexts)?;
            let c=db.0.lock().map_err(|_|"database_busy")?;phase(&c,&id,"Checking evidence",json!({"request":receipt}))?;parsed
        };
        check_research()?;
        let mut c=db.0.lock().map_err(|_|"database_busy")?;guard(&c,&a,rev,&signatures)?;
        let tx=c.transaction().map_err(err)?;
        for s in new_situations{tx.execute("INSERT INTO communication_situations(account_id,id,title,updated_at) VALUES(?1,?2,?3,?4)",params![a.id,s["id"].as_str(),s["title"].as_str(),now()]).map_err(err)?;}
        for o in fresh{tx.execute("INSERT INTO communication_situation_sources VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(account_id,thread_id) DO UPDATE SET signature=excluded.signature,situation_id=excluded.situation_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at",params![a.id,o["threadId"].as_str(),o["signature"].as_str(),o["situationId"].as_str(),o.to_string(),now()]).map_err(err)?;}
        for (b,context) in briefings.into_iter().zip(contexts){let mut payload=json!(b);payload["contextRevision"]=json!(rev);payload["researchSignature"]=json!(stamp);payload["sourceSignatures"]=source_signatures(&observations,&context["id"],&signatures);payload["research"]=context["research"].clone();
            tx.execute("UPDATE communication_situations SET briefing_json=?3,updated_at=?4 WHERE account_id=?1 AND id=?2",params![a.id,b.situation_id,payload.to_string(),now()]).map_err(err)?;}
        phase(&tx,&id,"Situation map updated",json!({"changedThreads":threads.len(),"newRelationshipsAreGenerated":true}))?;tx.commit().map_err(err)?;Ok(())
    }.await;
    let c = db.0.lock().map_err(|_| "database_busy")?;
    c.execute("UPDATE communication_runs SET status=?2,payload_json=json_set(payload_json,'$.status',?2,'$.error',?3,'$.finishedAt',?4,'$.durationMs',?5) WHERE id=?1",params![id,if result.is_ok(){"completed"}else{"failed"},result.as_ref().err(),now(),chrono::Utc::now().timestamp_millis()-time]).map_err(err)?;
    result
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
    refresh_checked(db, manual, entries, model, || Ok(())).await
}
#[cfg(test)]
mod tests {
    use super::super::tests::{database, mail};
    use super::*;
    fn answer(purpose: &str, input: &Value) -> Value {
        if purpose == "situation_discovery" {
            json!({"observations":input["threads"].as_array().unwrap().iter().map(|t|json!({"threadId":t["threadId"],"relevant":true,"situationId":"new:purchase","title":"Purchase","summary":"A document was requested.","people":[{"email":"lender@example.invalid","name":"Lender","role":"Lending contact"}],"relationships":[],"details":[]})).collect::<Vec<_>>()})
        } else {
            json!({"briefings":input["situations"].as_array().unwrap().iter().map(|s|json!({"situationId":s["id"],"whereThingsStand":"Documents are being reviewed.","whatChanged":"A statement was requested.","nextMoves":[]})).collect::<Vec<_>>()})
        }
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
    fn invalid_optional_quote_gets_one_map_only_retry() {
      tauri::async_runtime::block_on(async {
        let db=database();mail(&db,"aa","Please provide a statement.");let mut calls=vec![];
        refresh_with(&db,false,vec![],|_,input,schema,purpose| {
          calls.push(purpose.to_string());
          let mut output=answer(if purpose=="situation_discovery_retry"{"situation_discovery"}else{purpose},&input);
          if purpose=="situation_discovery" {output["observations"][0]["details"]=json!([{"kind":"request","label":"Document","value":"Statement","messageId":"aa","quote":"An invented quotation"}]);}
          if purpose=="situation_discovery_retry" {assert_eq!(schema["properties"]["observations"]["items"]["anyOf"][0]["properties"]["details"]["maxItems"],0);}
          std::future::ready(Ok((output.to_string(),json!({"synthetic":true}))))
        }).await.unwrap();
        assert_eq!(calls,vec!["situation_discovery","situation_discovery_retry","situation_briefing"]);
        let snapshot=snapshot(&db.0.lock().unwrap()).unwrap();assert_eq!(snapshot["situations"].as_array().unwrap().len(),1);assert!(snapshot["observations"][0]["details"].as_array().unwrap().is_empty());
      });
    }

}
