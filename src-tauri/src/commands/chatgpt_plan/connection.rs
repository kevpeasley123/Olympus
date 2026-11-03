//! Production connection lifecycle, dependency-injected for offline verification.
//! The public production entrypoint remains closed before filesystem/network work.
use super::{Pending,Exchange,tokens::{Session,Store,WindowsStore}};
use serde::{Serialize,Deserialize};
use serde_json::Value;
use std::{path::{Path,PathBuf},net::TcpListener,io::{Read,Write},sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},time::{Duration,Instant}};

pub trait Provider {fn exchange(&self,attempt:&Exchange)->Result<(Value,Value),String>;fn revoke(&self,client:&str,refresh:&str)->Result<(),String>;}
pub struct OpenAi;
impl Provider for OpenAi {
    fn exchange(&self,a:&Exchange)->Result<(Value,Value),String>{Ok((super::transport::exchange(a)?,super::transport::signing_keys()?))}
    fn revoke(&self,c:&str,t:&str)->Result<(),String>{super::transport::revoke(c,t)}
}
#[derive(Clone,Serialize,Deserialize)]
pub struct Registration {pub client_id:String,pub subject:String}
#[derive(Default,Serialize,Deserialize)]
struct Metadata {host_id:String,registrations:Vec<Registration>}
pub struct Connection<S:Store> {directory:PathBuf,session:Session<S>,operation:Mutex<()>,cancel:Arc<AtomicBool>}
impl<S:Store> Connection<S> {
    pub fn new(directory:PathBuf,store:S)->Self{Self{directory,session:Session::new(store),operation:Mutex::new(()),cancel:Arc::new(AtomicBool::new(false))}}
    pub fn cancel(&self){self.cancel.store(true,Ordering::Release);}
    fn metadata(&self)->Result<Metadata,String>{
        let path=self.directory.join("chatgpt-plan.json");
        match std::fs::read(path){Ok(bytes) if bytes.len()<=65536=>serde_json::from_slice(&bytes).map_err(|_|"Connection metadata invalid".into()),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(Metadata::default()),_=>Err("Connection metadata unavailable".into())}
    }
    fn save(&self,m:&Metadata)->Result<(),String>{
        std::fs::create_dir_all(&self.directory).map_err(|_|"Connection directory unavailable")?;
        let bytes=serde_json::to_vec(m).map_err(|_|"Connection metadata invalid")?;
        let temp=self.directory.join("chatgpt-plan.pending.json");
        std::fs::write(&temp,bytes).map_err(|_|"Connection metadata could not be saved")?;
        std::fs::rename(temp,self.directory.join("chatgpt-plan.json")).map_err(|_|"Connection metadata could not be replaced".into())
    }
    pub fn connect(&self,selected:Option<Registration>,provider:&impl Provider,open:impl FnOnce(&str)->Result<(),String>,now:u64)->Result<Registration,String>{
        let started=Instant::now();
        let _guard=self.operation.try_lock().map_err(|_|"Connection attempt already running")?;
        let mut metadata=self.metadata()?;
        if let Some(s)=&selected {if !metadata.registrations.iter().any(|r|r.client_id==s.client_id&&r.subject==s.subject){return Err("Unknown account registration".into());}}
        if metadata.host_id.is_empty(){let mut bytes=[0u8;16];getrandom::getrandom(&mut bytes).map_err(|_|"Secure random unavailable")?;bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;let h:String=bytes.iter().map(|v|format!("{v:02x}")).collect();metadata.host_id=format!("urn:uuid:{}-{}-{}-{}-{}",&h[..8],&h[8..12],&h[12..16],&h[16..20],&h[20..]);self.save(&metadata)?;}
        let listener=TcpListener::bind(("127.0.0.1",0)).map_err(|_|"Local callback listener unavailable")?;
        let mut pending=Pending::new(listener.local_addr().map_err(|_|"Callback address unavailable")?.port(),selected.as_ref().map(|s|s.client_id.clone()))?;
        open(pending.authorize_url(&metadata.host_id)?.as_str())?;
        let callback=wait_callback(listener,&self.cancel,Duration::from_secs(300))?;
        let attempt=pending.callback(&callback)?;
        if self.cancel.load(Ordering::Acquire){return Err("Connection cancelled".into());}
        let (response,keys)=provider.exchange(&attempt)?;
        let credentials=self.session.accept(&attempt.client_id,Some(&attempt.nonce),selected.as_ref().map(|s|s.subject.as_str()),&response,&keys,now.saturating_add(started.elapsed().as_secs()))?;
        if self.cancel.load(Ordering::Acquire){return Err("Connection cancelled".into());}
        let registration=Registration{client_id:attempt.client_id,subject:credentials.subject().into()};
        if !metadata.registrations.iter().any(|r|r.client_id==registration.client_id&&r.subject==registration.subject){metadata.registrations.push(registration.clone());}
        // Metadata alone never authorizes generation; save it first so a failed
        // metadata write cannot strand a credential with no discoverable owner.
        self.save(&metadata)?;
        self.session.persist(&credentials)?;
        Ok(registration)
    }
    pub fn disconnect(&self,registration:&Registration,provider:&impl Provider)->Result<bool,String>{
        self.cancel();let _guard=self.operation.lock().map_err(|_|"Connection busy")?;
        self.session.disconnect(&registration.client_id,&registration.subject,|c,t|provider.revoke(c,t))
    }
    fn selected(&self,requested:Option<Registration>)->Result<Option<Registration>,String>{
        let registrations=self.metadata()?.registrations;
        match requested {Some(r) if registrations.iter().any(|s|s.client_id==r.client_id&&s.subject==r.subject)=>Ok(Some(r)),Some(_)=>Err("Unknown account registration".into()),None if registrations.len()<=1=>Ok(registrations.into_iter().next()),None=>Err("Select an account registration".into())}
    }
}
/// Native lifecycle dispatcher. The same compile-time-closed consent gate
/// precedes path resolution, browser launch, keyring and all provider traffic.
#[tauri::command]
pub async fn chatgpt_plan_action(app:tauri::AppHandle,action:String,registration:Option<Registration>)->Result<super::controller::View,String>{
    use tauri::Manager;
    use tauri_plugin_opener::OpenerExt;
    if crate::commands::acceptance::acceptance_dir().is_some() {
        return super::controller::chatgpt_plan_test_action(action);
    }
    if action=="status" && require_production_consent().is_err(){return super::controller::chatgpt_plan_test_action(action);}
    require_production_consent()?;
    static SERVICE:std::sync::OnceLock<Connection<WindowsStore>>=std::sync::OnceLock::new();
    static STATE:Mutex<Option<(String,String)>>=Mutex::new(None);
    static ACTIVE:AtomicBool=AtomicBool::new(false);
    let directory=app.path().app_data_dir().map_err(|_|"Connection directory unavailable")?;
    let service=SERVICE.get_or_init(||Connection::new(directory,WindowsStore));
    let status=||->Result<super::controller::View,String>{let saved=STATE.lock().map_err(|_|"Connection state unavailable")?;let (phase,message)=saved.clone().unwrap_or(("disconnected".into(),"Connect or reauthorize your saved ChatGPT account.".into()));Ok(super::controller::View{available:true,phase,message,generation_enabled:false,synthetic:false})};
    if action=="status" {return status();}
    if action=="cancel" {service.cancel();return status();}
    if ACTIVE.compare_exchange(false,true,Ordering::AcqRel,Ordering::Acquire).is_err(){return status();}
    let selected=match service.selected(registration){Ok(r)=>r,Err(e)=>{ACTIVE.store(false,Ordering::Release);return Err(e);}};
    service.cancel.store(false,Ordering::Release);
    *STATE.lock().map_err(|_|"Connection state unavailable")?=Some(("awaitingBrowser".into(),"Complete the connection in your browser, or cancel here.".into()));
    tauri::async_runtime::spawn_blocking(move||{
        let result=(||->Result<(&str,&str),String>{
            let now=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|"System clock unavailable")?.as_secs();
            match action.as_str(){
                "connect"=>{service.connect(selected,&OpenAi,|url|app.opener().open_url(url,None::<&str>).map_err(|_|"Browser could not be opened".into()),now)?;Ok(("connected","Connected. Generation remains blocked."))},
                "renew"=>{let r=selected.ok_or("No saved account registration")?;service.session.access(&r.client_id,&r.subject,now,super::transport::refresh)?;Ok(("connected","Session renewed. Generation remains blocked."))},
                "disconnect"=>{let r=selected.ok_or("No saved account registration")?;Ok(("disconnected",if service.disconnect(&r,&OpenAi)?{"Disconnected."}else{"Disconnected locally; remote revocation was not confirmed."}))},
                _=>Err("Unsupported connection action".into()),
            }
        })();
        if let Ok(mut state)=STATE.lock(){*state=Some(match result{Ok((p,m))=>(p.into(),m.into()),Err(e)=>("error".into(),e)});}
        ACTIVE.store(false,Ordering::Release);
    });
    status()
}
fn wait_callback(listener:TcpListener,cancel:&AtomicBool,limit:Duration)->Result<String,String>{
    listener.set_nonblocking(true).map_err(|_|"Callback listener unavailable")?;
    let address=listener.local_addr().map_err(|_|"Callback listener unavailable")?;
    let deadline=Instant::now()+limit;
    loop {
        if cancel.load(Ordering::Acquire){return Err("Connection cancelled".into());}
        if Instant::now()>=deadline{return Err("Connection attempt expired".into());}
        match listener.accept(){
            Ok((mut socket,peer))=>{
                if !peer.ip().is_loopback(){continue;}
                socket.set_nonblocking(false).map_err(|_|"Callback unavailable")?;
                socket.set_read_timeout(Some(Duration::from_millis(100))).map_err(|_|"Callback unavailable")?;
                socket.set_write_timeout(Some(Duration::from_secs(2))).map_err(|_|"Callback unavailable")?;
                let mut raw=Vec::new();let mut buffer=[0u8;1024];
                while raw.len()<16384&&!raw.windows(4).any(|w|w==b"\r\n\r\n") {
                    if cancel.load(Ordering::Acquire){return Err("Connection cancelled".into());}
                    if Instant::now()>=deadline{return Err("Connection attempt expired".into());}
                    match socket.read(&mut buffer){Ok(0)=>break,Ok(n)=>raw.extend_from_slice(&buffer[..n]),Err(e) if matches!(e.kind(),std::io::ErrorKind::WouldBlock|std::io::ErrorKind::TimedOut)=>continue,Err(_)=>return Err("Callback request unavailable".into())}
                }
                let text=std::str::from_utf8(&raw).map_err(|_|"Invalid callback request")?;
                let first=text.lines().next().ok_or("Invalid callback request")?;
                let words:Vec<_>=first.split_whitespace().collect();
                if raw.len()>=16384||words.len()!=3||words[0]!="GET"||!words[1].starts_with("/auth/callback?"){return Err("Invalid callback request".into());}
                let url=format!("http://{address}{}",words[1]);
                let body="Return to Olympus to see the connection result.";
                let _=write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",body.len(),body);
                return Ok(url);
            },Err(e) if e.kind()==std::io::ErrorKind::WouldBlock=>std::thread::sleep(Duration::from_millis(20)),Err(_)=>return Err("Callback listener failed".into())
        }
    }
}
fn require_production_consent()->Result<(),String>{
    Err("Production ChatGPT connection is disabled pending separate consent authorization".into())
}
pub fn production_connect(directory:&Path,open:impl FnOnce(&str)->Result<(),String>)->Result<Registration,String>{
    // This gate precedes construction, browser, listener, network and storage.
    require_production_consent()?;
    let now=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|"System clock unavailable")?.as_secs();
    Connection::new(directory.to_path_buf(),WindowsStore).connect(None,&OpenAi,open,now)
}

#[cfg(test)]mod tests{
    use super::*;
    use base64::{Engine,engine::general_purpose::URL_SAFE_NO_PAD};
    use std::collections::HashMap;
    #[derive(Clone,Default)]struct Memory(Arc<Mutex<HashMap<String,String>>>);
    impl Store for Memory{fn load(&self,k:&str)->Result<Option<String>,String>{Ok(self.0.lock().unwrap().get(k).cloned())}fn save(&self,k:&str,v:&str)->Result<(),String>{self.0.lock().unwrap().insert(k.into(),v.into());Ok(())}fn delete(&self,k:&str)->Result<(),String>{self.0.lock().unwrap().remove(k);Ok(())}}
    struct FakeProvider;
    impl Provider for FakeProvider{
        fn exchange(&self,a:&Exchange)->Result<(Value,Value),String>{
            let key=ring::signature::RsaKeyPair::from_pkcs8(include_bytes!("test-signing-key.pk8")).unwrap();
            let header=URL_SAFE_NO_PAD.encode(br#"{"alg":"RS256","kid":"fixture"}"#);
            let claims=serde_json::json!({"iss":"https://auth.openai.com","aud":a.client_id,"sub":"fixture-user","nonce":a.nonce,"exp":2000000000});
            let unsigned=format!("{header}.{}",URL_SAFE_NO_PAD.encode(serde_json::to_vec(&claims).unwrap()));
            let mut signature=vec![0;key.public().modulus_len()];key.sign(&ring::signature::RSA_PKCS1_SHA256,&ring::rand::SystemRandom::new(),unsigned.as_bytes(),&mut signature).unwrap();
            let fixture:Value=serde_json::from_str(include_str!("fixture.json")).unwrap();
            Ok((serde_json::json!({"id_token":format!("{unsigned}.{}",URL_SAFE_NO_PAD.encode(signature)),"access_token":"synthetic-access","refresh_token":"synthetic-refresh","token_type":"Bearer","scope":"openid resource.invoke chatgpt.tokens.use.direct","expires_in":120}),fixture["jwks"].clone()))
        }
        fn revoke(&self,_:&str,_:&str)->Result<(),String>{Err("synthetic network failure".into())}
    }
    fn fake_browser(url:&str)->Result<(),String>{
        let url=reqwest::Url::parse(url).unwrap();let q:HashMap<_,_>=url.query_pairs().into_owned().collect();
        let redirect=reqwest::Url::parse(&q["redirect_uri"]).unwrap();let port=redirect.port().unwrap();let state=q["state"].clone();
        std::thread::spawn(move||{let mut socket=std::net::TcpStream::connect(("127.0.0.1",port)).unwrap();write!(socket,"GET /auth/callback?state={state}&code=synthetic&client_id=oaiapp_fixture HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();let mut response=String::new();socket.read_to_string(&mut response).unwrap();});Ok(())
    }
    #[test]fn production_lifecycle_connect_reauthorize_restart_disconnect_with_mock_provider(){
        let mut id=[0u8;16];getrandom::getrandom(&mut id).unwrap();let dir=std::env::temp_dir().join(format!("olympus-connection-{}",URL_SAFE_NO_PAD.encode(id)));
        let store=Memory::default();let connection=Connection::new(dir.clone(),store.clone());
        let first=connection.connect(None,&FakeProvider,fake_browser,1900000000).unwrap();assert_eq!(first.subject,"fixture-user");
        let host=connection.metadata().unwrap().host_id;
        let restarted=Connection::new(dir.clone(),store.clone());
        assert_eq!(restarted.selected(None).unwrap().unwrap().subject,"fixture-user");
        assert!(restarted.selected(Some(Registration{client_id:"wrong".into(),subject:"wrong".into()})).is_err());
        let second=restarted.connect(Some(first),&FakeProvider,fake_browser,1900000000).unwrap();assert_eq!(restarted.metadata().unwrap().host_id,host);
        assert!(!restarted.disconnect(&second,&FakeProvider).unwrap());assert!(store.0.lock().unwrap().is_empty());assert_eq!(restarted.metadata().unwrap().registrations.len(),1);
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]fn listener_accepts_only_bound_callback_and_honors_cancel_and_expiry(){
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
        let send=std::thread::spawn(move||{let mut s=std::net::TcpStream::connect(("127.0.0.1",port)).unwrap();s.write_all(b"GET /auth/callback?state=fixture HTTP/1.1\r\nHost: localhost\r\n\r\n").unwrap();let mut response=String::new();s.read_to_string(&mut response).unwrap();assert!(!response.contains("state="));});
        assert!(wait_callback(listener,&AtomicBool::new(false),Duration::from_secs(2)).unwrap().contains("/auth/callback?state=fixture"));send.join().unwrap();
        for cancel in [true,false]{let listener=TcpListener::bind("127.0.0.1:0").unwrap();assert!(wait_callback(listener,&AtomicBool::new(cancel),Duration::ZERO).is_err());}
    }
    #[test]fn partial_callback_cannot_extend_the_deadline(){
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
        let peer=std::thread::spawn(move||{let mut s=std::net::TcpStream::connect(("127.0.0.1",port)).unwrap();s.write_all(b"GET ").unwrap();std::thread::sleep(Duration::from_millis(500));});
        let started=Instant::now();assert!(wait_callback(listener,&AtomicBool::new(false),Duration::from_millis(50)).is_err());
        assert!(started.elapsed()<Duration::from_millis(400));peer.join().unwrap();
    }
    #[test]fn production_gate_precedes_all_side_effects(){assert!(production_connect(Path::new("must-not-exist"),|_|panic!("browser opened")).is_err());}
}
