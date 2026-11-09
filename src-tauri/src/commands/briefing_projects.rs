//! Native registered-project progress snapshots. No IPC, membership writes or provider calls.
//! Git subjects are quoted source data, never operator instructions or completion proof.
//! Eligibility uses all locally reachable OIDs, not commit dates. Oversized or
//! unreadable histories fail closed. No unseen commit is silently baselined away.
use super::{Authority,Evidence};
use crate::commands::{briefing::{DisplayPlan,DisplayCursor,DeliveredItem},project_registry,projects};
use rusqlite::{Connection,OptionalExtension};
use serde_json::json;
use sha2::{Digest,Sha256};
use std::{collections::HashSet,path::PathBuf};

#[derive(Clone)]
pub(super) struct Snapshot{page_size:usize,ids:Vec<String>,observed:i64,revision:String,evidence:Vec<Evidence>,mapping:Vec<ProjectMapping>}
#[derive(Clone)]
struct CommitMapping{id:String,oid:String}
#[derive(Clone)]
struct ProjectMapping{source:String,oids:Vec<String>,commits:Vec<CommitMapping>}
impl Snapshot{
    pub(super) fn revision(&self)->&str{&self.revision}
    pub(super) fn observed_at(&self)->i64{self.observed}
    pub(super) fn evidence(&self)->&[Evidence]{&self.evidence}
    pub(super) fn checked_inventory_count(&self)->usize{self.ids.len()}
}
fn invalid()->String{"briefing_project_snapshot_unavailable".into()}
fn digest(v:&impl serde::Serialize)->String{format!("{:x}",Sha256::digest(serde_json::to_vec(v).expect("native project serialization")))}
fn oid(s:&str)->bool{matches!(s.len(),40|64)&&s.bytes().all(|b|b.is_ascii_hexdigit())}
fn briefing_candidate(subject:&str)->bool{
    let s=subject.to_lowercase();
    if ["security","vulnerability","cve-"].iter().any(|term|s.contains(term)){return true;}
    let dependency_housekeeping=["preserve ","pin ","bump ","update "].iter().any(|prefix|s.starts_with(prefix))
        && ["dependency version","dependency pin","lockfile"].iter().any(|term|s.contains(term))
        && !["fix","repair","recover","prevent","resolve","restore"].iter().any(|term|s.contains(term));
    !["docs:","docs(","chore(deps)","build(deps)"].iter().any(|prefix|s.starts_with(prefix))
        && !dependency_housekeeping
}

pub(super) fn capture(c:&Connection,ids:&[String],now:i64)->Result<Snapshot,String>{
    capture_page(c,ids,now,8)
}
pub(super) fn capture_page(c:&Connection,ids:&[String],now:i64,page_size:usize)->Result<Snapshot,String>{
    if !(1..=8).contains(&page_size)||now<0||ids.len()>3||ids.iter().any(|id|id.is_empty()||id.len()>160||id.chars().any(char::is_control))||ids.iter().collect::<HashSet<_>>().len()!=ids.len(){return Err(invalid());}
    let mut evidence=Vec::new();let mut mapping=Vec::new();let mut bindings=Vec::new();let mut paths=HashSet::new();
    for id in ids{
        let member=project_registry::get(c,id).map_err(|_|invalid())?;
        if member.visibility!="visible"||member.project.path.is_empty(){return Err(invalid());}
        // Registry identity must agree with its primary-key row; don't accept a
        // payload claiming another project's ID.
        let stored_id:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM project_members WHERE id=?1 AND json_extract(payload,'$.id')=?1)",[id],|r|r.get(0)).map_err(|_|invalid())?;
        if !stored_id{return Err(invalid());}
        let path=PathBuf::from(&member.project.path);
        if !path.is_absolute()||path.ancestors().any(crate::commands::repository_inspection::linked){return Err(invalid());}
        let canonical=path.canonicalize().map_err(|_|invalid())?;
        if !paths.insert(canonical.clone()){return Err(invalid());}
        if !member.sources.iter().any(|s|s.kind=="folder"&&project_registry::path_key(&s.location)==project_registry::path_key(&member.project.path)){return Err(invalid());}
        if let Some(root)=crate::commands::acceptance::projects_root(){if !canonical.starts_with(root.canonicalize().map_err(|_|invalid())?){return Err(invalid());}}
        if !path.join(".git").exists()||crate::commands::repository_inspection::linked(&path.join(".git")){return Err(invalid());}
        let git_root=projects::git_command(&path,&["rev-parse","--show-toplevel"]).map_err(|_|invalid())?;
        if PathBuf::from(git_root).canonicalize().map_err(|_|invalid())?!=canonical{return Err(invalid());}
        // A separate namespace prevents legacy timestamp cursors from treating
        // undisplayed history as acknowledged. Sentinel time zero denotes an
        // append-only OID set; native display acknowledgment unions only cited IDs.
        let ledger_key=format!("project-oid-v1:{}",digest(&json!({"projectId":id,"path":canonical.to_string_lossy()})));
        let cursor:Option<(i64,String)>=c.query_row("SELECT observed_ms,oids FROM project_brief_cursors WHERE source=?1",[&ledger_key],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(|_|invalid())?;
        let previous_oids=if let Some((at,raw))=&cursor{
            let mut oids:Vec<String>=serde_json::from_str(raw).map_err(|_|invalid())?;
            if *at!=0||oids.len()>4096||oids.iter().any(|s|!oid(s)){return Err(invalid());}
            oids.sort();oids.dedup();oids
        }else{Vec::new()};
        let mut commits=projects::checked_reachable_commits(&path,4096).map_err(|_|invalid())?;
        for commit in &commits{
            let when=chrono::DateTime::parse_from_rfc3339(&commit.at).map_err(|_|invalid())?.timestamp_millis();
            if when>now||commit.oid.as_ref().is_none_or(|s|!oid(s)){return Err(invalid());}
        }
        commits.sort_by(|a,b|chrono::DateTime::parse_from_rfc3339(&a.at).unwrap().timestamp_millis().cmp(&chrono::DateTime::parse_from_rfc3339(&b.at).unwrap().timestamp_millis()).then_with(||a.oid.cmp(&b.oid)));
        // Low-value housekeeping remains unacknowledged in history; it does not
        // consume the small synthesis page ahead of behavior changes.
        let selected:HashSet<_>=commits.iter().rev().filter(|c|!c.subject.starts_with("Merge ")).chain(commits.iter().rev().filter(|c|c.subject.starts_with("Merge "))).filter(|c|briefing_candidate(&c.subject)).filter_map(|commit|commit.oid.as_ref()).filter(|hash|!previous_oids.contains(hash)).take(page_size).cloned().collect();
        let mut mapped=Vec::new();let mut acknowledgments=Vec::new();
        for commit in commits.iter().rev(){
            let hash=commit.oid.as_ref().ok_or_else(invalid)?;
            let source_id=format!("project:{id}:commit:{hash}");
            // Receipt identity is independent of the moving cursor or other
            // commits, so a selected newer commit stays suppressed behind a gap.
            let revision=digest(&json!({"projectId":id,"source":member.project.path,"commit":commit}));
            let acknowledged=previous_oids.contains(hash);
            acknowledgments.push(json!({"id":source_id,"acknowledged":acknowledged}));
            mapped.push(CommitMapping{id:source_id.clone(),oid:hash.clone()});
            if selected.contains(hash){
                let text=json!({"source":"registered_project_git_commit","projectId":id,"name":member.project.name,"commit":commit,"interpretation":"Recorded Git commit; not proof of deployment, completion, or operator commitment."}).to_string();
                if text.chars().count()>2000{return Err("briefing_project_snapshot_too_large".into());}
                evidence.push(Evidence{id:source_id,revision,kind:"project".into(),text,observed_at:now,authority:Authority::SourceFact,context_only:false});
            }
        }
        bindings.push(json!({"member":member,"cursor":cursor,"ledgerKey":ledger_key,"commits":commits,"acknowledgments":acknowledgments}));
        mapping.push(ProjectMapping{source:ledger_key,oids:previous_oids,commits:mapped});
    }
    Ok(Snapshot{page_size,ids:ids.to_vec(),observed:now,revision:digest(&bindings),evidence,mapping})
}

/// The caller must keep its native session lease and DB transaction through
/// composition/adoption. A filesystem cannot provide an atomic Git+SQLite snapshot;
/// this checks a fresh observation immediately before the callback, not future state.
pub(super) fn with_revalidated<T>(c:&Connection,snapshot:&Snapshot,now:i64,selected:&[String],use_snapshot:impl FnOnce(&[Evidence],&DisplayPlan)->Result<T,String>)->Result<T,String>{
    if now<snapshot.observed||now.saturating_sub(snapshot.observed)>900_000{return Err("briefing_project_snapshot_expired".into());}
    if selected.iter().collect::<HashSet<_>>().len()!=selected.len(){return Err(invalid());}
    let current=capture_page(c,&snapshot.ids,now,snapshot.page_size)?;
    if current.revision!=snapshot.revision{return Err("briefing_project_snapshot_changed".into());}
    let mut items=Vec::new();let mut cursors=Vec::new();
    for id in selected{
        let e=snapshot.evidence.iter().find(|e|e.id==*id).ok_or_else(invalid)?;
        items.push(DeliveredItem{id:id.clone(),revision:e.revision.clone()});
    }
    for project in &snapshot.mapping{
        if !project.commits.iter().any(|commit|selected.contains(&commit.id)){continue;}
        let mut chosen:Vec<String>=project.commits.iter().filter(|commit|selected.contains(&commit.id)).map(|commit|commit.oid.clone()).collect();chosen.sort();chosen.dedup();
        let union=project.oids.iter().chain(chosen.iter()).collect::<HashSet<_>>();
        if union.len()>4096{return Err("briefing_project_acknowledgment_capacity".into());}
        cursors.push(DisplayCursor{source:project.source.clone(),at:0,oids:chosen});
    }
    use_snapshot(&snapshot.evidence,&DisplayPlan{prepared_at:snapshot.observed,items,cursors})
}

#[cfg(test)] pub(super) use tests::{seed_fixture,Repo,append_fixture_commit};
#[cfg(test)] mod tests{
    use super::*;
    use rusqlite::params;
    const NOW:i64=1793707200000;
    pub(crate) struct Repo(PathBuf);
    impl Drop for Repo{fn drop(&mut self){let root=std::env::temp_dir().canonicalize().unwrap();let target=self.0.canonicalize().unwrap();assert!(target.starts_with(&root)&&target!=root);std::fs::remove_dir_all(target).unwrap();}}
    fn commit(repo:&Repo,label:&str,at:i64){
        let date=chrono::DateTime::from_timestamp_millis(at).unwrap().to_rfc3339_opts(chrono::SecondsFormat::Secs,true);
        let status=std::process::Command::new("git").arg("-C").arg(&repo.0).args(["-c","user.name=Synthetic Fixture","-c","user.email=fixture@example.invalid","-c","core.hooksPath=nonexistent-fixture-hooks","commit","--quiet","--allow-empty","-m",label]).env("GIT_AUTHOR_DATE",&date).env("GIT_COMMITTER_DATE",&date).status().unwrap();assert!(status.success());
    }
    pub(crate) fn append_fixture_commit(repo:&Repo,label:&str,at:i64){commit(repo,label,at)}
    pub(crate) fn seed_fixture(c:&Connection,now:i64)->Repo{
        let root=std::env::temp_dir().join(format!("olympus-project-evidence-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir(&root).unwrap();let repo=Repo(root);projects::git_command(&repo.0,&["init","--quiet"]).unwrap();commit(&repo,"Synthetic studio inspection recorded",now-1000);
        let mut project=project_registry::blank("fixture","Synthetic Studio");project.path=repo.0.to_string_lossy().into_owned();
        c.execute("INSERT INTO project_members(id,visibility,payload) VALUES('fixture','visible',?1)",[serde_json::to_string(&project).unwrap()]).unwrap();
        c.execute("INSERT INTO project_links(source_key,project_id,kind,location) VALUES('fixture-key','fixture','folder',?1)",[&project.path]).unwrap();
        if c.query_row("SELECT count(*) FROM operator_sessions",[],|r|r.get::<_,i64>(0)).unwrap()==0{
            for (id,at) in [("project-previous",now-3600000),("project-current",now)]{c.execute("INSERT INTO operator_sessions(id,started_at) VALUES(?1,?2)",params![id,chrono::DateTime::from_timestamp_millis(at).unwrap().to_rfc3339()]).unwrap();}
        }
        repo
    }
    fn fixture()->(Connection,Repo){
        let c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();let repo=seed_fixture(&c,NOW);(c,repo)
    }
    #[test]fn housekeeping_does_not_crowd_out_behavior_changes_or_acknowledge_history(){
        let(c,repo)=fixture();
        commit(&repo,"Wait for fresh mail before publishing the opening brief",NOW);
        commit(&repo,"Fix security vulnerability in dependency version",NOW+1000);
        commit(&repo,"Preserve locked Windows dependency version",NOW+2000);
        commit(&repo,"docs: record release verification",NOW+3000);
        let snap=capture_page(&c,&["fixture".into()],NOW+4000,2).unwrap();
        assert_eq!(snap.evidence.len(),2);
        assert!(snap.evidence.iter().any(|e|e.text.contains("Wait for fresh mail")));
        assert!(snap.evidence.iter().any(|e|e.text.contains("security vulnerability")));
        assert!(!snap.evidence.iter().any(|e|e.text.contains("Preserve locked")));
        assert_eq!(c.query_row("SELECT count(*) FROM project_brief_cursors",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }
    #[test]fn dependency_terms_do_not_hide_actual_behavior_fixes(){
        let(c,repo)=fixture();
        commit(&repo,"Fix startup crash caused by dependency version mismatch",NOW);
        commit(&repo,"Add lockfile conflict recovery",NOW+1000);
        let snap=capture_page(&c,&["fixture".into()],NOW+2000,2).unwrap();
        assert!(snap.evidence.iter().any(|e|e.text.contains("Fix startup crash")));
        assert!(snap.evidence.iter().any(|e|e.text.contains("Add lockfile conflict recovery")));
    }
    #[test]fn first_page_prioritizes_recent_commits_without_acknowledging_older_gaps(){
      let(c,repo)=fixture();for i in 0..10{commit(&repo,&format!("Recent {i}"),NOW+i*1000);}
      let snap=capture(&c,&["fixture".into()],NOW+20000).unwrap();
      assert_eq!(snap.evidence.len(),8);assert!(snap.evidence.iter().any(|e|e.text.contains("Recent 9")));
      assert!(snap.evidence[0].text.contains("Recent 9"),"The model must receive the newest selected change first, not the oldest unseen item on the page");
      assert!(!snap.evidence.iter().any(|e|e.text.contains("Synthetic studio inspection")));
      assert_eq!(c.query_row("SELECT count(*) FROM project_brief_cursors",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }
    #[test]fn registered_git_snapshot_maps_only_selected_evidence_and_actual_commit_cursor(){
        let (c,_repo)=fixture();let changes=c.total_changes();let snap=capture(&c,&["fixture".into()],NOW).unwrap();
        assert_eq!(snap.evidence().len(),1);assert_eq!(snap.observed_at(),NOW);assert_eq!(snap.revision().len(),64);
        let id=snap.evidence()[0].id.clone();
        with_revalidated(&c,&snap,NOW+1,&[id],|e,plan|{assert_eq!(e.len(),1);assert_eq!(plan.items.len(),1);assert_eq!(plan.cursors[0].at,0);assert_eq!(plan.cursors[0].oids.len(),1);Ok(())}).unwrap();
        with_revalidated(&c,&snap,NOW+1,&[],|_,plan|{assert!(plan.items.is_empty()&&plan.cursors.is_empty());Ok(())}).unwrap();
        assert!(with_revalidated(&c,&snap,NOW,&["invented".into()],|_,_|Ok(())).is_err());
        assert_eq!(c.total_changes(),changes);
    }
    #[test]fn native_membership_cursor_and_git_mutations_invalidate_before_callback(){
        for mode in 0..5{
            let (c,repo)=fixture();let snap=capture(&c,&["fixture".into()],NOW).unwrap();
            match mode{0=>{c.execute("UPDATE project_members SET visibility='removed'",[]).unwrap();},1=>{c.execute("UPDATE project_members SET revision=revision+1",[]).unwrap();},2=>{c.execute("DELETE FROM project_links",[]).unwrap();},3=>{commit(&repo,"Another synthetic observation",NOW);},_=>{c.execute("INSERT INTO project_brief_cursors(source,observed_ms,oids) VALUES(?1,?2,'[]')",params![snap.mapping[0].source,0]).unwrap();}}
            assert!(with_revalidated(&c,&snap,NOW+1,&[],|_,_|->Result<(),String>{panic!("stale project accepted")}).is_err());
        }
    }
    #[test]fn same_time_oids_are_preserved_without_skipping_unseen_commits(){
        let (c,repo)=fixture();let first=capture(&c,&["fixture".into()],NOW).unwrap();
        let first_oid=first.mapping[0].commits[0].oid.clone();
        c.execute("INSERT INTO project_brief_cursors(source,observed_ms,oids) VALUES(?1,?2,?3)",params![first.mapping[0].source,0,json!([first_oid]).to_string()]).unwrap();
        commit(&repo,"Second synthetic inspection",NOW-1000);
        let second=capture(&c,&["fixture".into()],NOW).unwrap();
        assert_eq!(second.evidence.len(),1);let body:serde_json::Value=serde_json::from_str(&second.evidence[0].text).unwrap();assert!(body["commit"].is_object());
        with_revalidated(&c,&second,NOW,&[second.evidence[0].id.clone()],|_,plan|{assert_eq!(plan.cursors[0].at,0);assert_eq!(plan.cursors[0].oids.len(),1);assert!(!plan.cursors[0].oids.contains(&first_oid));Ok(())}).unwrap();
    }
    #[test]fn paths_unknown_ids_and_expiry_fail_closed_without_timestamp_baseline(){
        let (c,repo)=fixture();assert!(capture(&c,&[repo.0.to_string_lossy().into_owned()],NOW).is_err());
        let snap=capture(&c,&["fixture".into()],NOW).unwrap();assert!(with_revalidated(&c,&snap,NOW+900001,&[],|_,_|Ok(())).is_err());assert!(with_revalidated(&c,&snap,NOW-1,&[],|_,_|Ok(())).is_err());
        c.execute("DELETE FROM operator_sessions",[]).unwrap();assert_eq!(capture(&c,&["fixture".into()],NOW).unwrap().evidence.len(),1);
    }
    #[test]fn complete_enumeration_pages_without_acknowledging_omitted_commits(){
        let (mut c,repo)=fixture();for n in 0..8{commit(&repo,&format!("Synthetic change {n}"),NOW-1000);}
        assert_eq!(capture(&c,&["fixture".into()],NOW).unwrap().evidence.len(),8);
        assert_eq!(c.query_row("SELECT count(*) FROM project_brief_cursors",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        acknowledge_all(&mut c,NOW,"conversation-briefing-first-page");
        assert_eq!(capture(&c,&["fixture".into()],NOW+1).unwrap().evidence.len(),1);
    }
    fn store_fixture_plan(c:&Connection,id:&str,plan:&DisplayPlan)->Result<(),String>{
        let mut record=crate::commands::models::RequestRecord::new(&crate::commands::models::resolve(crate::commands::models::Capability::Primary),"briefing_synthesis");
        record.status="completed".into();record.provider="synthetic".into();record.actual_model=Some("fixture".into());
        let origin=json!({"kind":"model_synthesis","preparedAt":plan.prepared_at,"sources":plan.items,"packetRevision":"a".repeat(64),"provider":"synthetic","model":"fixture","requestId":record.id});
        let content="Synthetic commit finding";
        record.usage=Some(json!({"briefing_binding":{"conversationId":"project-test","contentDigest":format!("{:x}",Sha256::digest(content.as_bytes())),"origin":origin,"delivery":plan}}));
        let tx=c.unchecked_transaction().map_err(|e|e.to_string())?;
        tx.execute("INSERT INTO model_requests(id,record_json) VALUES(?1,?2)",params![record.id,serde_json::to_string(&record).unwrap()]).map_err(|e|e.to_string())?;
        let message=serde_json::from_value(json!({"id":id,"role":"assistant","content":content,"timestamp":"12:00","briefing":origin,"delivery":plan})).map_err(|e|e.to_string())?;
        crate::commands::persistence::store_messages_in_transaction(&tx,"project-test",vec![message],false)?;
        tx.commit().map_err(|e|e.to_string())
    }
    #[test]fn selecting_only_newer_commit_does_not_acknowledge_older_omission(){
        let (mut c,repo)=fixture();commit(&repo,"Newer synthetic observation",NOW);
        let snap=capture(&c,&["fixture".into()],NOW).unwrap();assert_eq!(snap.evidence.len(),2);
        let older=snap.evidence[0].id.clone();let newer=snap.evidence[1].id.clone();
        with_revalidated(&c,&snap,NOW,&[newer.clone()],|_,plan|{
            assert_eq!(plan.items.len(),1);assert_eq!(plan.cursors[0].oids.len(),1);
            store_fixture_plan(&c,"conversation-briefing-project-newer",plan)
        }).unwrap();
        crate::commands::briefing::acknowledge_fixture(&mut c,"conversation-briefing-project-newer").unwrap();
        let remaining=capture(&c,&["fixture".into()],NOW+1).unwrap();assert_eq!(remaining.evidence.len(),1);assert_eq!(remaining.evidence[0].id,older);
        with_revalidated(&c,&remaining,NOW+1,&[older],|_,plan|{assert_eq!(plan.cursors[0].at,0);assert_eq!(plan.cursors[0].oids.len(),1);Ok(())}).unwrap();
    }
    #[test]fn same_time_subset_cursor_contains_only_selected_or_acknowledged_oids(){
        let (mut c,repo)=fixture();commit(&repo,"Same-time unmentioned observation",NOW-1000);
        let snap=capture(&c,&["fixture".into()],NOW).unwrap();assert_eq!(snap.evidence.len(),2);
        let selected=snap.evidence[1].id.clone();let omitted=snap.evidence[0].id.clone();
        with_revalidated(&c,&snap,NOW,&[selected],|_,plan|{assert_eq!(plan.cursors[0].at,0);assert_eq!(plan.cursors[0].oids.len(),1);store_fixture_plan(&c,"conversation-briefing-project-same-time",plan)}).unwrap();
        crate::commands::briefing::acknowledge_fixture(&mut c,"conversation-briefing-project-same-time").unwrap();
        let remaining=capture(&c,&["fixture".into()],NOW+1).unwrap();assert_eq!(remaining.evidence.len(),1);assert_eq!(remaining.evidence[0].id,omitted);
    }
    fn acknowledge_all(c:&mut Connection,now:i64,message_id:&str){
        let snap=capture(c,&["fixture".into()],now).unwrap();let ids=snap.evidence.iter().map(|e|e.id.clone()).collect::<Vec<_>>();
        with_revalidated(c,&snap,now,&ids,|_,plan|store_fixture_plan(c,message_id,plan)).unwrap();
        crate::commands::briefing::acknowledge_fixture(c,message_id).unwrap();
    }
    #[test]fn a_new_backdated_commit_remains_eligible_after_display_acknowledgment(){
        let (mut c,repo)=fixture();acknowledge_all(&mut c,NOW,"conversation-briefing-before-backdate");
        commit(&repo,"Newly recorded backdated inspection",NOW-86400000);
        let next=capture(&c,&["fixture".into()],NOW+1).unwrap();assert_eq!(next.evidence.len(),1);assert!(next.evidence[0].text.contains("Newly recorded backdated inspection"));
    }
    #[test]fn newly_reachable_backdated_branch_is_not_lost_to_previous_time_cursor(){
        let (mut c,repo)=fixture();acknowledge_all(&mut c,NOW,"conversation-briefing-before-branch");
        let tree=projects::git_command(&repo.0,&["rev-parse","HEAD^{tree}"]).unwrap();
        let date=chrono::DateTime::from_timestamp_millis(NOW-172800000).unwrap().to_rfc3339_opts(chrono::SecondsFormat::Secs,true);
        let output=std::process::Command::new("git").arg("-C").arg(&repo.0).args(["-c","user.name=Synthetic Fixture","-c","user.email=fixture@example.invalid","commit-tree",&tree,"-m","Previously unreachable backdated branch"]).env("GIT_AUTHOR_DATE",&date).env("GIT_COMMITTER_DATE",&date).output().unwrap();assert!(output.status.success());let hash=String::from_utf8(output.stdout).unwrap().trim().to_string();
        assert!(capture(&c,&["fixture".into()],NOW).unwrap().evidence.is_empty());
        projects::git_command(&repo.0,&["update-ref","refs/heads/fixture-backdated",&hash]).unwrap();
        let next=capture(&c,&["fixture".into()],NOW+1).unwrap();assert_eq!(next.evidence.len(),1);assert!(next.evidence[0].id.ends_with(&hash));
    }
    #[test]fn durable_oid_acknowledgment_survives_receipt_and_conversation_history_removal(){
        let (mut c,repo)=fixture();acknowledge_all(&mut c,NOW,"conversation-briefing-durable-oid");
        c.execute("DELETE FROM settings WHERE key='briefing.displayed.v1'",[]).unwrap();
        crate::commands::conversations::delete(&mut c,"project-test").unwrap();
        assert!(capture(&c,&["fixture".into()],NOW+1).unwrap().evidence.is_empty());
        // Even a forged legacy timestamp cursor cannot hide a new old-dated OID.
        c.execute("INSERT INTO project_brief_cursors(source,observed_ms,oids) VALUES(?1,?2,'[]')",params![repo.0.to_string_lossy(),NOW]).unwrap();
        commit(&repo,"Still unseen older commit",NOW-86400000);
        assert_eq!(capture(&c,&["fixture".into()],NOW+1).unwrap().evidence.len(),1);
    }
    #[test]fn bounded_reachable_enumeration_reports_overflow_instead_of_truncating(){
        let (_c,repo)=fixture();commit(&repo,"Second locally reachable commit",NOW);
        assert!(projects::checked_reachable_commits(&repo.0,1).is_err());assert_eq!(projects::checked_reachable_commits(&repo.0,2).unwrap().len(),2);
    }
    #[test]fn display_ledger_union_overflow_rolls_back_receipts_and_keeps_pending_acknowledgment(){
        for capacity in [300,4096]{
            let (mut c,_repo)=fixture();let snap=capture(&c,&["fixture".into()],NOW).unwrap();
            let id="conversation-briefing-ledger-overflow";
            with_revalidated(&c,&snap,NOW,&[snap.evidence[0].id.clone()],|_,plan|store_fixture_plan(&c,id,plan)).unwrap();
            let full=(0..capacity).map(|n|format!("{n:040x}")).collect::<Vec<_>>();assert!(!full.contains(&snap.mapping[0].commits[0].oid));
            let before=json!(full).to_string();
            c.execute("INSERT INTO project_brief_cursors(source,observed_ms,oids) VALUES(?1,0,?2)",params![snap.mapping[0].source,before]).unwrap();
            let result=crate::commands::briefing::acknowledge_fixture(&mut c,id);
            let after:String=c.query_row("SELECT oids FROM project_brief_cursors WHERE source=?1",[&snap.mapping[0].source],|r|r.get(0)).unwrap();
            let pending:i64=c.query_row("SELECT count(*) FROM pending_brief_displays WHERE message_id=?1",[id],|r|r.get(0)).unwrap();
            let receipts:i64=c.query_row("SELECT count(*) FROM settings WHERE key='briefing.displayed.v1'",[],|r|r.get(0)).unwrap();
            if capacity==4096{assert!(result.is_err());assert_eq!(after,before);assert_eq!(pending,1);assert_eq!(receipts,0);}
            else{assert!(result.unwrap());assert_eq!(serde_json::from_str::<Vec<String>>(&after).unwrap().len(),301);assert_eq!(pending,0);assert_eq!(receipts,1);assert!(capture(&c,&["fixture".into()],NOW+1).unwrap().evidence.is_empty());}
        }
    }
    #[test]fn more_than_256_reachable_commits_are_supported_without_silent_baselining(){
        use std::io::Write;
        let (mut c,repo)=fixture();let mut stream=String::new();
        for n in 0..300{
            let message=format!("Synthetic imported project change {n}");
            stream.push_str(&format!("commit refs/heads/fixture-large\ncommitter Synthetic Fixture <fixture@example.invalid> {} +0000\ndata {}\n{}\n\n",(NOW-2000)/1000,message.len(),message));
        }
        stream.push_str("done\n");
        let mut process=std::process::Command::new("git").arg("-C").arg(&repo.0).args(["fast-import","--quiet"]).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::piped()).spawn().unwrap();
        process.stdin.take().unwrap().write_all(stream.as_bytes()).unwrap();
        let result=process.wait_with_output().unwrap();assert!(result.status.success(),"{}",String::from_utf8_lossy(&result.stderr));
        assert_eq!(projects::checked_reachable_commits(&repo.0,4096).unwrap().len(),301);
        let first=capture(&c,&["fixture".into()],NOW).unwrap();assert_eq!(first.evidence.len(),8);
        let first_ids=first.evidence.iter().map(|e|e.id.clone()).collect::<HashSet<_>>();
        acknowledge_all(&mut c,NOW,"conversation-briefing-large-history-page");
        let next=capture(&c,&["fixture".into()],NOW+1).unwrap();assert_eq!(next.evidence.len(),8);
        assert!(next.evidence.iter().all(|e|!first_ids.contains(&e.id)));
        assert_eq!(next.mapping[0].oids.len(),8,"Only actually displayed commit IDs are acknowledged");
    }

}
