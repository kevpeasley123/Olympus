//! Native startup/session adapter. No IPC selection or generation entry point.
use super::native_evidence::{NativeOwner,Capability};
use crate::commands::approvals::ApprovalState;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct NativeSession {session_id:String,owner:NativeOwner,transition:Mutex<()>}
impl NativeSession {
 pub fn new(authority:&ApprovalState)->Self{Self{session_id:authority.session_id.clone(),owner:NativeOwner::new(),transition:Mutex::new(())}}
 /// Called only by a future trusted native conversation transition. A UI string
 /// alone is never a capability. Temporary/new transitions must use clear().
 pub fn select_saved(&self,c:&Connection,conversation:&str)->Result<Capability,String>{
  self.select_checked(conversation,||{
   if conversation.is_empty()||conversation.len()>160||conversation.trim()!=conversation||conversation.chars().any(char::is_control){return Err("briefing_lifecycle_unavailable".to_string());}
   let present:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM operator_sessions WHERE id=?1)",[&self.session_id],|r|r.get(0)).map_err(|_|"briefing_lifecycle_unavailable")?;
   let saved:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM conversations WHERE id=?1 AND legacy=0)",[conversation],|r|r.get(0)).map_err(|_|"briefing_lifecycle_unavailable")?;
   if !present||!saved{return Err("briefing_lifecycle_unavailable".into());}
   let account=crate::commands::gmail::store::account(c)?.filter(|a|a.enabled&&a.status=="connected"&&a.scopes==crate::commands::gmail::SCOPE).ok_or("briefing_lifecycle_unavailable")?;
   Ok(account.id)
  })
 }
 /// Native project scope needs a saved operator session/conversation, not Gmail.
 pub fn select_projects_saved(&self,c:&Connection,conversation:&str)->Result<Capability,String>{
  let _transition=self.transition.lock().map_err(|_|"briefing_lifecycle_unavailable")?;
  let selected=(||{
   let saved:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM operator_sessions WHERE id=?1) AND EXISTS(SELECT 1 FROM conversations WHERE id=?2 AND legacy=0)",rusqlite::params![self.session_id,conversation],|r|r.get(0)).map_err(|_|"briefing_lifecycle_unavailable")?;
   if !saved{return Err("briefing_lifecycle_unavailable".to_string());}
   self.owner.apply_project_lifecycle(&self.session_id,conversation)?;self.owner.capability()
  })();
  if selected.is_err(){self.owner.revoke()?;}selected
 }
 fn select_checked(&self,conversation:&str,validate:impl FnOnce()->Result<String,String>)->Result<Capability,String>{
  let _transition=self.transition.lock().map_err(|_|"briefing_lifecycle_unavailable")?;
  let selected=(||{let account=validate()?;self.owner.apply_trusted_lifecycle(&self.session_id,&account,conversation,false)?;self.owner.capability()})();
  if selected.is_err(){self.owner.revoke()?;}
  selected
 }
 pub fn clear(&self)->Result<(),String>{let _transition=self.transition.lock().map_err(|_|"briefing_lifecycle_unavailable")?;self.owner.revoke()}
 #[cfg(test)] fn owner(&self)->&NativeOwner{&self.owner}
}
/// Revocation is the only UI operation: no caller can grant an evidence scope.
#[tauri::command]
pub fn briefing_revoke_scope(state:tauri::State<'_,NativeSession>)->Result<(),String>{state.clear()}
#[cfg(test)]mod tests{
 use super::*;
 fn fixture()->(Connection,NativeSession){
  let c=Connection::open_in_memory().unwrap();crate::commands::migrations::apply(&c).unwrap();
  c.execute("INSERT INTO operator_sessions(id) VALUES('native-session')",[]).unwrap();
  c.execute("INSERT INTO conversations(id,title,created_at,updated_at) VALUES('saved-chat','Fixture',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",[]).unwrap();
  c.execute("INSERT INTO gmail_accounts(id,email,enabled,status,scopes,connected_at) VALUES('native-account','fixture@example.invalid',1,'connected',?1,'2026-11-04T00:00:00Z')",[crate::commands::gmail::SCOPE]).unwrap();
  (c,NativeSession::new(&ApprovalState::new("native-session".into())))
 }
 #[test]fn project_selection_needs_native_session_but_no_gmail(){
  let(c,session)=fixture();c.execute("DELETE FROM gmail_accounts",[]).unwrap();
  assert!(session.select_projects_saved(&c,"saved-chat").is_ok());
  c.execute("DELETE FROM operator_sessions",[]).unwrap();assert!(session.select_projects_saved(&c,"saved-chat").is_err());assert!(session.owner().capability().is_err());
 }
 #[test]fn startup_is_revoked_and_saved_selection_uses_native_authority(){
  let(c,session)=fixture();assert!(session.owner().capability().is_err());
  assert!(session.select_saved(&c,"saved-chat").is_ok());assert!(session.owner().capability().is_ok());
  session.clear().unwrap();assert!(session.owner().capability().is_err());
 }
 #[test]fn invalid_selection_revokes_prior_scope(){
  for mutation in ["DELETE FROM operator_sessions","UPDATE conversations SET legacy=1","UPDATE gmail_accounts SET enabled=0"]{
   let(c,session)=fixture();session.select_saved(&c,"saved-chat").unwrap();c.execute_batch(mutation).unwrap();
   assert!(session.select_saved(&c,"saved-chat").is_err());assert!(session.owner().capability().is_err());
  }
 }
 #[test]fn arbitrary_or_legacy_ui_session_id_cannot_establish_native_session(){
  let(c,_)=fixture();let forged=NativeSession::new(&ApprovalState::new("ui-session".into()));
  assert!(forged.select_saved(&c,"saved-chat").is_err());
 }
}

#[cfg(test)]mod concurrency_tests{
 use super::*;
 #[test]fn clear_cannot_be_overtaken_by_a_selection_still_validating(){
  use std::sync::{Arc,mpsc};use std::time::Duration;
  let session=Arc::new(NativeSession::new(&ApprovalState::new("native".into())));
  let(entered_tx,entered_rx)=mpsc::channel();let(release_tx,release_rx)=mpsc::channel();
  let selecting=session.clone();let selected=std::thread::spawn(move||selecting.select_checked("chat",||{entered_tx.send(()).unwrap();release_rx.recv().unwrap();Ok("account".into())}));
  entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
  let(done_tx,done_rx)=mpsc::channel();let clearing=session.clone();let cleared=std::thread::spawn(move||{clearing.clear().unwrap();done_tx.send(()).unwrap();});
  let cleared_while_validating=done_rx.recv_timeout(Duration::from_millis(200)).is_ok();
  release_tx.send(()).unwrap();selected.join().unwrap().unwrap();cleared.join().unwrap();
  assert!(!cleared_while_validating,"clear must serialize with the complete selection transition");
  assert!(session.owner().capability().is_err(),"old validation cannot restore cleared scope");
 }
}
