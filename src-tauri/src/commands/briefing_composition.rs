//! Native mail-only composition. No IPC, scope grant, or provider invocation.
use super::{Input,Output,Authority};
use crate::commands::{persistence,models,briefing};
use rusqlite::{Transaction,OptionalExtension,params};
use serde_json::json;
use sha2::{Digest,Sha256};
use std::collections::HashSet;

// Only the native evidence adoption lease calls this; never sign UI-composed text.
pub(super) fn compose_and_store(tx:&Transaction<'_>,chat:&str,packet:&Input,output:&Output,now:i64)->Result<Option<String>,String>{
    compose_with_projects(tx,chat,packet,output,now,None)
}
pub(super) fn compose_with_projects(tx:&Transaction<'_>,chat:&str,packet:&Input,output:&Output,now:i64,projects:Option<&briefing::DisplayPlan>)->Result<Option<String>,String>{
    let invalid=||"briefing_native_composition_invalid".to_string();
    super::validate_input(packet,now)?;
    if output.revision!=packet.revision||output.prepared_at>packet.prepared_at||now.saturating_sub(output.prepared_at)>900_000{return Err(invalid());}
    crate::commands::structured_output::validate(&json!({"items":output.items}),&super::schema()).map_err(|_|invalid())?;
    let mut cited=HashSet::new();let mut text=Vec::new();
    for item in &output.items{
        let mut local=HashSet::new();let mut deliverable=false;
        for id in &item.source_ids{
            let source=packet.evidence.iter().find(|e|e.id==*id).ok_or_else(invalid)?;
            if !local.insert(id){return Err(invalid());}
            if !source.context_only{
                // Native mail evidence maps one-to-one. Combined receipts and
                // project cursors require their own qualified mapping contract.
                let mail=source.kind=="mail"&&source.id.starts_with("mail:");
                let project=source.kind=="project"&&projects.is_some_and(|p|p.items.iter().any(|r|r.id==source.id&&r.revision==source.revision));
                if !(mail||project)||!matches!(source.authority,Authority::SourceFact){return Err(invalid());}
                deliverable=true;
            }
            cited.insert(id.clone());
        }
        if !deliverable||!super::bounded(&item.text,240){return Err(invalid());}
        let parts=[&item.text,&item.why_it_matters,&item.action,&item.uncertainty].into_iter().filter(|p|!p.trim().is_empty()).map(|p|{
            let p=p.trim(); if p.ends_with(['.','!','?']){p.to_string()}else{format!("{p}.")}
        }).collect::<Vec<_>>();
        text.push(parts.join(" "));
    }
    // Empty synthesis is an explicit no-update outcome, never a fallback.
    if output.items.is_empty(){return Ok(None);}
    let mut selected_threads=std::collections::HashMap::new();
    for e in packet.evidence.iter().filter(|e|cited.contains(&e.id)&&!e.context_only&&e.kind=="mail"){
        let mail:serde_json::Value=serde_json::from_str(&e.text).map_err(|_|invalid())?;
        let thread=mail["threadId"].as_str().ok_or_else(invalid)?;
        let subject=mail["subject"].as_str().ok_or_else(invalid)?;
        selected_threads.insert(thread.to_string(),subject.chars().take(80).collect::<String>());
    }
    // Keep exact native operator corrections visible, not rewritten by the model.
    for e in packet.evidence.iter().filter(|e|matches!(e.authority,Authority::OperatorStatement)){
        let v:serde_json::Value=serde_json::from_str(&e.text).map_err(|_|invalid())?;
        if v["source"]!="stored_operator_resolution"{return Err(invalid());}
        let thread=v["resolution"]["threadId"].as_str().ok_or_else(invalid)?;
        let Some(subject)=selected_threads.get(thread) else {continue};
        let correction=v["resolution"]["correction"].as_str().ok_or_else(invalid)?;
        if !correction.is_empty(){if !super::bounded(correction,1000){return Err(invalid());}text.push(format!("Your clarification about {subject}: {correction}"));cited.insert(e.id.clone());}
    }
    // Coverage stays bound to native provenance, outside the spoken prose.
    let coverage=Some(persistence::BriefingCoverage{mail:packet.evidence.iter().any(|e|e.kind=="mail"),projects:packet.evidence.iter().any(|e|e.kind=="project")});
    let content=text.join("\n\n");if content.len()>16000{return Err(invalid());}
    let sources=packet.evidence.iter().filter(|e|cited.contains(&e.id)).map(|e|persistence::BriefingSource{id:e.id.clone(),revision:e.revision.clone()}).collect();
    let mut plan=briefing::DisplayPlan{prepared_at:output.prepared_at,items:packet.evidence.iter().filter(|e|cited.contains(&e.id)&&!e.context_only).map(|e|briefing::DeliveredItem{id:e.id.clone(),revision:e.revision.clone()}).collect(),cursors:vec![]};
    if let Some(mapped)=projects{
        if mapped.items.iter().any(|r|!cited.contains(&r.id)||!packet.evidence.iter().any(|e|e.id==r.id&&e.revision==r.revision&&e.kind=="project"&&!e.context_only)){return Err(invalid());}
        plan.cursors=serde_json::from_value(serde_json::to_value(&mapped.cursors).map_err(|_|invalid())?).map_err(|_|invalid())?;
    }
    let provenance=&output.provenance;
    let raw:String=tx.query_row("SELECT record_json FROM model_requests WHERE id=?1",[&provenance.request_id],|r|r.get(0)).optional().map_err(|_|invalid())?.ok_or_else(invalid)?;
    let mut record:models::RequestRecord=serde_json::from_str(&raw).map_err(|_|invalid())?;
    if record.id!=provenance.request_id||record.purpose!="briefing_synthesis"||record.status!="completed"||record.provider!=provenance.provider||record.actual_model.as_ref()!=Some(&provenance.model)||!super::bounded(&provenance.provider,128)||!super::bounded(&provenance.model,128){return Err(invalid());}
    let expected_result=json!({"packetRevision":output.revision,"preparedAt":output.prepared_at,"outputDigest":format!("{:x}",Sha256::digest(serde_json::to_vec(output).map_err(|_|invalid())?))});
    if record.usage.as_ref().and_then(|u|u.get("briefing_result"))!=Some(&expected_result){return Err("briefing_native_dispatch_binding_missing".into());}
    let origin=persistence::BriefingOrigin::ModelSynthesis{prepared_at:output.prepared_at,sources,packet_revision:packet.revision.clone(),provider:provenance.provider.clone(),model:provenance.model.clone(),request_id:provenance.request_id.clone(),coverage};
    let usage=record.usage.get_or_insert_with(||json!({})).as_object_mut().ok_or_else(invalid)?;
    if usage.contains_key("briefing_binding")||usage.contains_key("briefing_consumed"){return Err("briefing_native_result_already_bound".into());}
    usage.insert("briefing_binding".into(),json!({"conversationId":chat,"contentDigest":format!("{:x}",Sha256::digest(content.as_bytes())),"origin":origin,"delivery":plan}));
    let encoded=serde_json::to_string(&record).map_err(|_|invalid())?;
    if tx.execute("UPDATE model_requests SET record_json=?1 WHERE id=?2 AND record_json=?3",params![encoded,record.id,raw]).map_err(|_|invalid())?!=1{return Err(invalid());}
    let id=format!("conversation-briefing-{}",format!("{:x}",Sha256::digest(record.id.as_bytes())));
    let feedback=crate::commands::gmail::situations::learning::briefing_feedback(tx,&selected_threads,output.items.len())?;
    let message=serde_json::from_value(json!({"id":id,"role":"assistant","content":content,"timestamp":chrono::Utc::now().to_rfc3339(),"briefing":origin,"delivery":plan,"feedback":feedback})).map_err(|_|invalid())?;
    persistence::store_messages_in_transaction(tx,chat,vec![message],false)?;
    Ok(Some(id))
}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn qualifiers_and_thread_specific_corrections_survive_native_composition(){
  let now=chrono::Utc::now().timestamp_millis();let mut c=rusqlite::Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
  c.execute("INSERT INTO gmail_accounts(id,email,enabled,status,scopes,connected_at) VALUES('a','fixture@example.invalid',1,'connected',?1,'2026-11-08T00:00:00Z')",[crate::commands::gmail::SCOPE]).unwrap();
  let mut evidence=vec![super::super::Evidence{id:"mail:a:m".into(),revision:"b".repeat(64),kind:"mail".into(),text:json!({"threadId":"t","subject":"Synthetic shipment"}).to_string(),observed_at:now,authority:Authority::SourceFact,context_only:false}];
  for (thread,correction) in [("t","I arranged this; it is unrelated to studio dues."),("other","Unrelated private correction.")]{evidence.push(super::super::Evidence{id:format!("resolution:{thread}"),revision:"c".repeat(64),kind:"memory".into(),text:json!({"source":"stored_operator_resolution","resolution":{"threadId":thread,"correction":correction}}).to_string(),observed_at:now,authority:Authority::OperatorStatement,context_only:true});}
  let packet=Input{revision:"a".repeat(64),prepared_at:now,evidence};
  let mut record=models::RequestRecord::new(&models::resolve(models::Capability::Primary),"briefing_synthesis");record.status="completed".into();record.provider="synthetic".into();record.actual_model=Some("fixture".into());
  let output=Output{revision:packet.revision.clone(),prepared_at:now,items:["The first shipment changed.","The second notice changed."].iter().map(|text|super::super::Item{text:(*text).into(),why_it_matters:"".into(),action:"".into(),uncertainty:"Arrival remains unconfirmed.".into(),source_ids:vec!["mail:a:m".into()]}).collect(),provenance:super::super::Provenance{kind:"model_synthesis",provider:"synthetic".into(),model:"fixture".into(),request_id:record.id.clone()}};
  record.usage=Some(json!({"briefing_result":{"packetRevision":output.revision,"preparedAt":output.prepared_at,"outputDigest":format!("{:x}",Sha256::digest(serde_json::to_vec(&output).unwrap()))}}));
  c.execute("INSERT INTO model_requests(id,record_json) VALUES(?1,?2)",params![record.id,serde_json::to_string(&record).unwrap()]).unwrap();
  let tx=c.transaction().unwrap();compose_and_store(&tx,"chat",&packet,&output,now).unwrap();tx.commit().unwrap();
  let content:String=c.query_row("SELECT content FROM conversation_messages",[],|r|r.get(0)).unwrap();
  assert!(!content.contains("Coverage:"),"Coverage belongs in provenance details, not the spoken briefing");
  let context:String=c.query_row("SELECT context_json FROM conversation_turn_context",[],|r|r.get(0)).unwrap();
  let context:serde_json::Value=serde_json::from_str(&context).unwrap();
  assert_eq!(context["briefing"]["coverage"],json!({"mail":true,"projects":false}));
  assert_eq!(content.matches("Arrival remains unconfirmed.").count(),2);
  assert!(content.contains("Your clarification about Synthetic shipment: I arranged this; it is unrelated to studio dues."));assert!(!content.contains("Unrelated private correction"));
  let payload:String=c.query_row("SELECT payload FROM pending_brief_displays",[],|r|r.get(0)).unwrap();let plan:serde_json::Value=serde_json::from_str(&payload).unwrap();assert_eq!(plan["items"].as_array().unwrap().len(),1);
  let tx=c.transaction().unwrap();assert!(compose_and_store(&tx,"chat",&packet,&output,now).is_err());tx.rollback().unwrap();
 }
}
