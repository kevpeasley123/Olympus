//! Read-only curated vault evidence for an investigative brief.
use super::memory::{MemoryReader,Packet,Query};
use serde::{Deserialize,Serialize};
#[derive(Clone,Debug,PartialEq,Eq,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct SourceBinding {pub id:String,pub path:String,pub revision:String,pub excerpt_hash:String}
const MAX_QUERY_CHARS:usize=512;
const MAX_PACKET_BYTES:usize=24_000;
const MAX_SOURCES:usize=8;
fn validate_query(question:&str,project:Option<&str>)->Result<(),String>{
    if question.chars().count()>MAX_QUERY_CHARS||project.is_some_and(|p|p.chars().count()>256){return Err("briefing_vault_query_bound".into());}
    Ok(())
}
pub(crate) fn query(reader:&MemoryReader,question:&str,active_project:Option<&str>)->Result<Packet,String>{
    validate_query(question,active_project)?;
    if question.trim().is_empty(){let mut packet=Packet::unavailable("");packet.status="not_requested".into();packet.warnings.clear();return Ok(packet);}
    // Use the existing indexed reader, including correction bundles, source-byte
    // validation and coverage diagnostics. Never fall back to walking the vault.
    let packet=reader.query(&Query{question:question.into(),active_project:active_project.map(str::to_owned),recent_questions:vec![]});
    if packet.sources.len()>MAX_SOURCES||packet.json().len()>MAX_PACKET_BYTES{return Err("briefing_vault_packet_bound".into());}
    Ok(packet)
}
pub(crate) fn bindings(packet:&Packet)->Vec<SourceBinding>{
    use sha2::{Digest,Sha256};
    packet.sources.iter().map(|source|SourceBinding{id:source.record.id.clone(),path:source.record.path.clone(),revision:source.record.revision.clone(),excerpt_hash:format!("{:x}",Sha256::digest(source.excerpt.as_bytes()))}).collect()
}
pub(crate) fn revalidate(reader:&MemoryReader,request:&Query,selected:&[SourceBinding])->Result<(),String>{
    if selected.is_empty(){return Ok(());}
    if !request.recent_questions.is_empty(){return Err("briefing_vault_query_bound".into());}
    let fresh=query(reader,&request.question,request.active_project.as_deref())?;
    check_current(selected,&fresh)
}
fn check_current(selected:&[SourceBinding],fresh:&Packet)->Result<(),String>{
    if selected.len()>MAX_SOURCES{return Err("briefing_vault_selection_bound".into());}
    let current=bindings(fresh);
    if selected.iter().any(|source|!current.contains(source)){return Err("briefing_vault_source_changed_or_omitted".into());}
    // A newly recorded correction can invalidate a claim without changing the
    // original file. It must be included in a fresh synthesis, never ignored.
    if fresh.sources.iter().any(|source|source.record.corrects.iter().chain(&source.record.supersedes).any(|id|selected.iter().any(|bound|&bound.id==id))&&!selected.iter().any(|bound|bound.id==source.record.id&&bound.revision==source.record.revision)){
        return Err("briefing_vault_correction_changed".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::memory::MemoryService;
    use std::{fs,path::PathBuf,time::{Duration,Instant}};
    struct Fixture {root:PathBuf,vault:PathBuf,service:Option<MemoryService>}
    impl Fixture {
        fn new()->Self {
            let root=std::env::temp_dir().join(format!("olympus-brief-vault-{}",crate::commands::delegation::run_id()));let vault=root.join("vault");
            fs::create_dir_all(vault.join("01 - Projects")).unwrap();fs::create_dir_all(vault.join("08 - Daily Briefs/Sessions")).unwrap();
            fs::write(vault.join("01 - Projects/Review Project.md"),"---\nschema_version: 1\nrecord_id: project-review\nproject_id: review-project\ntitle: Review Project\ntype: project\naliases: [Review Project]\n---\n# Current state\nCarousel work is active.\n").unwrap();
            fs::write(vault.join("08 - Daily Briefs/Sessions/decision.md"),"---\nschema_version: 1\nrecord_id: source-decision\ntype: session-record\nproject_ids: [review-project]\nstatus: active\nrecorded_at: '2020-01-01T00:00:00Z'\n---\n# Outcome\nThe carousel deadline is Friday.\n").unwrap();
            fs::write(vault.join("08 - Daily Briefs/Sessions/excluded.md"),"---\nrecord_id: excluded\ntype: session-record\nproject_ids: [review-project]\nmemory_exclude: true\n---\nEXCLUDED_SOURCE_SENTINEL carousel deadline").unwrap();
            let service=MemoryService::start(vault.clone(),root.join("index.sqlite"));let reader=service.reader();
            let deadline=Instant::now()+Duration::from_secs(10);
            while reader.query(&request()).generation==0 {assert!(Instant::now()<deadline,"fixture index did not become ready");std::thread::sleep(Duration::from_millis(10));}
            Self{root,vault,service:Some(service)}
        }
        fn reader(&self)->MemoryReader{self.service.as_ref().unwrap().reader()}
    }
    impl Drop for Fixture {
        fn drop(&mut self){
            drop(self.service.take());
            let(Ok(root),Ok(temp))=(self.root.canonicalize(),std::env::temp_dir().canonicalize())else{return};
            if !root.starts_with(temp)||!root.file_name().is_some_and(|n|n.to_string_lossy().starts_with("olympus-brief-vault-")){return;}
            for _ in 0..40{if fs::remove_dir_all(&root).is_ok(){return;}std::thread::sleep(Duration::from_millis(25));}
        }
    }
    fn request()->Query{Query{question:"carousel deadline".into(),active_project:Some("review-project".into()),recent_questions:vec![]}}
    #[test]
    fn curated_recall_retains_exact_old_session_source_and_bounds_queries(){
        let f=Fixture::new();let reader=f.reader();
        let packet=query(&reader,"carousel deadline",Some("review-project")).unwrap();
        assert!(packet.sources.iter().any(|s|s.record.id=="source-decision"&&s.excerpt.contains("Friday")));
        assert!(!packet.json().contains("EXCLUDED_SOURCE_SENTINEL"));
        let selected=bindings(&packet);assert!(!selected.is_empty());revalidate(&reader,&request(),&selected).unwrap();
        assert!(query(&reader,&"x".repeat(513),None).is_err());
        assert!(query(&reader,"",None).unwrap().sources.is_empty());
        let mut corrected=packet.clone();let mut correction=corrected.sources.iter().find(|s|s.record.id=="source-decision").unwrap().clone();
        correction.record.id="new-correction".into();correction.record.corrects=vec!["source-decision".into()];corrected.sources.push(correction);
        assert_eq!(check_current(&selected,&corrected).unwrap_err(),"briefing_vault_correction_changed");
    }
    #[test]
    fn omitted_changed_and_deleted_source_cannot_be_reused(){
        for deleted in [false,true] {
            let f=Fixture::new();let reader=f.reader();let packet=query(&reader,"carousel deadline",Some("review-project")).unwrap();
            let selected=bindings(&packet).into_iter().filter(|s|s.id=="source-decision").collect::<Vec<_>>();assert_eq!(selected.len(),1);
            let mut omitted=packet.clone();omitted.sources.clear();assert!(check_current(&selected,&omitted).is_err());
            let path=f.vault.join("08 - Daily Briefs/Sessions/decision.md");
            if deleted {fs::remove_file(path).unwrap();}else{let mut text=fs::read_to_string(&path).unwrap();text.push_str("The deadline was withdrawn.\n");fs::write(path,text).unwrap();}
            assert!(revalidate(&reader,&request(),&selected).is_err());
        }
    }
}
