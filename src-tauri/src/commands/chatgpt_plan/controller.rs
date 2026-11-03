//! Debug acceptance controller: synthetic identity only, never OAuth network calls.
use super::{Pending,tokens::{Session,Store}};
use serde::Serialize;
use serde_json::{json,Value};
use std::{path::PathBuf,sync::{Mutex,OnceLock},time::{Duration,Instant}};

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct View { pub available:bool,pub phase:String,pub message:String,pub generation_enabled:bool,pub synthetic:bool }
fn view(phase:&str,message:&str)->View { View {available:true,phase:phase.into(),message:message.into(),generation_enabled:false,synthetic:true} }
struct LocalStore(PathBuf);
impl Store for LocalStore {
    fn delete(&self,_key:&str)->Result<(),String>{match std::fs::remove_file(&self.0){Ok(())=>Ok(()),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(()),Err(_)=>Err("Synthetic credentials could not be cleared".into())}}
    fn load(&self,_key:&str)->Result<Option<String>,String> {
        match std::fs::read_to_string(&self.0) { Ok(s)=>Ok(Some(s)),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(None),Err(_)=>Err("Synthetic connection unavailable".into()) }
    }
    fn save(&self,_key:&str,value:&str)->Result<(),String> {
        std::fs::write(&self.0,value).map_err(|_|"Synthetic connection could not be saved".into())
    }
}
pub struct Controller { directory:PathBuf,pending:Option<(Pending,Instant)>,clock:u64 }
impl Controller {
    fn new(directory:PathBuf)->Self { Self{directory,pending:None,clock:1900000000} }
    fn path(&self)->PathBuf { self.directory.join("synthetic-chatgpt-connection.json") }
    fn session(&self)->Session<LocalStore> { Session::new(LocalStore(self.path())) }
    fn action(&mut self,action:&str)->Result<View,String> {
        match action {
            "status"=>Ok(if self.pending.is_some(){view("awaitingConsent","Synthetic consent is awaiting your choice.")} else if self.path().is_file(){view("connected","Synthetic account connected. Generation remains blocked.")}else{view("disconnected","Offline test profile. No real account will be used.")}),
            "connect"=>{
                if self.pending.is_some(){return Ok(view("awaitingConsent","Synthetic consent is already open."));}
                let mut pending=Pending::new(32123,None)?;
                pending.nonce="fixture-nonce".into();
                self.pending=Some((pending,Instant::now()));
                Ok(view("awaitingConsent","Approve a synthetic account connection. No browser, provider or real credentials are involved."))
            },
            "cancel"=>{self.pending=None;self.action("status")},
            "approve"|"expired"|"mismatch"=>{
                let (mut p,started)=self.pending.take().ok_or("No pending connection")?;
                if action=="expired" || started.elapsed()>Duration::from_secs(300){return Ok(view("error","Connection attempt expired. Start again."));}
                let callback=format!("{}?state={}&code=synthetic-code&client_id=oaiapp_fixture",p.redirect,p.state);
                let exchange=p.callback(&callback)?;
                let f:Value=serde_json::from_str(include_str!("fixture.json")).map_err(|_|"Fixture unavailable")?;
                let response=fixture_response(&f);
                let session=self.session();
                let expected=if action=="mismatch" {Some("different-account")}else{None};
                let credentials=match session.accept(&exchange.client_id,Some(&exchange.nonce),expected,&response,&f["jwks"],self.clock){Ok(c)=>c,Err(_)=>return Ok(view("error","Account validation failed. Existing connection was preserved."))};
                std::fs::create_dir_all(&self.directory).map_err(|_|"Fixture directory unavailable")?;
                session.persist(&credentials)?;
                Ok(view("connected","Synthetic account connected. Generation remains blocked."))
            },
            "renew"|"renewFail"=>{
                self.clock+=100;
                let f:Value=serde_json::from_str(include_str!("fixture.json")).map_err(|_|"Fixture unavailable")?;
                match self.session().access("oaiapp_fixture","fixture-user",self.clock,|_,_|{
                    if action=="renewFail" {Err("Synthetic renewal failure".into())}else{Ok((fixture_response(&f),f["jwks"].clone()))}
                }) {Ok(_)=>Ok(view("connected","Synthetic session renewed. Generation remains blocked.")),Err(_)=>Ok(view("error","Renewal failed. No request was sent; reconnect or disconnect."))}
            },
            "disconnect"|"revokeFail"=>{
                self.pending=None;
                match std::fs::remove_file(self.path()){Ok(())=>{},Err(e) if e.kind()==std::io::ErrorKind::NotFound=>{},Err(_)=>return Err("Synthetic credentials could not be cleared".into())}
                Ok(view("disconnected",if action=="revokeFail"{"Disconnected locally. Synthetic remote revocation was not confirmed."}else{"Synthetic session revoked and disconnected."}))
            },
            _=>Err("Unknown test connection action".into())
        }
    }
}
fn fixture_response(f:&Value)->Value {json!({"token_type":"Bearer","id_token":f["token"],"access_token":"synthetic-access","refresh_token":"synthetic-refresh","scope":"openid resource.invoke chatgpt.tokens.use.direct","expires_in":120})}

#[tauri::command]
pub fn chatgpt_plan_test_action(action:String)->Result<View,String> {
    let Some(directory)=crate::commands::acceptance::acceptance_dir() else {
        if action=="status" {return Ok(View{available:false,phase:"disabled".into(),message:"Production connection is disabled pending browser-consent approval.".into(),generation_enabled:false,synthetic:true});}
        return Err("Connection actions are restricted to the isolated test profile".into());
    };
    static CONTROLLER:OnceLock<Mutex<Option<Controller>>>=OnceLock::new();
    let mut slot=CONTROLLER.get_or_init(||Mutex::new(None)).lock().map_err(|_|"Connection busy")?;
    if slot.as_ref().is_none_or(|c|c.directory!=directory){*slot=Some(Controller::new(directory));}
    slot.as_mut().unwrap().action(&action)
}

#[cfg(test)]mod tests {
    use super::*;
    #[test]fn lifecycle_cancel_repeat_expiry_mismatch_restart_and_revocation(){
        let dir=std::env::temp_dir().join(format!("olympus-oauth-fixture-{}",uuid()));
        let mut c=Controller::new(dir.clone());
        assert_eq!(c.action("connect").unwrap().phase,"awaitingConsent");
        c.action("connect").unwrap();c.action("cancel").unwrap();
        assert!(c.action("approve").is_err());
        c.action("connect").unwrap();assert_eq!(c.action("expired").unwrap().phase,"error");
        c.action("connect").unwrap();assert_eq!(c.action("mismatch").unwrap().phase,"error");assert!(!c.path().exists());
        c.action("connect").unwrap();assert_eq!(c.action("approve").unwrap().phase,"connected");
        let mut restarted=Controller::new(dir.clone());assert_eq!(restarted.action("status").unwrap().phase,"connected");
        assert_eq!(restarted.action("renewFail").unwrap().phase,"error");assert!(restarted.path().exists());
        assert_eq!(restarted.action("renew").unwrap().phase,"connected");
        assert!(restarted.action("revokeFail").unwrap().message.contains("not confirmed"));assert!(!restarted.path().exists());
        std::fs::remove_dir_all(dir).unwrap();
    }
    fn uuid()->String{let mut b=[0u8;16];getrandom::getrandom(&mut b).unwrap();b.iter().map(|v|format!("{v:02x}")).collect()}
    #[test]fn production_cannot_connect_or_write(){assert!(!chatgpt_plan_test_action("status".into()).unwrap().available);for a in ["connect","approve","disconnect","renew"]{assert!(chatgpt_plan_test_action(a.into()).is_err());}}
}
