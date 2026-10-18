//! Native-only speech provider. No credential is returned to the webview.

use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};
use base64::Engine;
use futures_util::future::{select, Either};
use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::oneshot;
use super::persistence::Db;
use super::models;

const MAX_JOBS: usize = 128;
const MAX_AUDIO: usize = 8 * 1024 * 1024;
const API: &str = "https://api.elevenlabs.io/v1";
struct Job { at: Instant, cancel: Option<oneshot::Sender<()>> }
#[derive(Default)]
struct Jobs { entries: HashMap<String, Job> }
impl Jobs {
    fn prune(&mut self) {
        self.entries.retain(|_,v| v.cancel.is_some() || v.at.elapsed()<Duration::from_secs(120));
        if self.entries.len()>=MAX_JOBS {
            let oldest=self.entries.iter().filter(|(_,v)|v.cancel.is_none()).min_by_key(|(_,v)|v.at).map(|(k,_)|k.clone());
            if let Some(k)=oldest {self.entries.remove(&k);}
        }
    }
    fn register(&mut self,id:&str)->Result<oneshot::Receiver<()>,String> {
        self.prune();
        if self.entries.contains_key(id) {return Err("Speech request already stopped or submitted.".into());}
        if self.entries.values().filter(|v|v.cancel.is_some()).count()>=2 {return Err("Speech is busy. Stop the current voice before trying again.".into());}
        let (tx,rx)=oneshot::channel();
        self.entries.insert(id.into(),Job{at:Instant::now(),cancel:Some(tx)});Ok(rx)
    }
    fn cancel(&mut self,id:&str) {
        self.prune();
        if let Some(job)=self.entries.get_mut(id) {if let Some(tx)=job.cancel.take(){let _=tx.send(());}job.at=Instant::now();}
        else if self.entries.len()<MAX_JOBS {self.entries.insert(id.into(),Job{at:Instant::now(),cancel:None});}
    }
    fn finish(&mut self,id:&str) {if let Some(job)=self.entries.get_mut(id){job.cancel=None;job.at=Instant::now();}}
}
static JOBS: Lazy<Mutex<Jobs>>=Lazy::new(||Mutex::new(Jobs::default()));
fn guard()->Result<(),String>{if super::acceptance::active(){Err("ElevenLabs is disabled in the isolated acceptance profile.".into())}else{Ok(())}}
fn identifier(value:&str)->bool{!value.is_empty()&&value.len()<=128&&value.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'_'||c==b'-')}
fn validate(id:&str,voice:&str,model:&str,text:&str)->Result<(),String>{
    if !identifier(id)||!identifier(voice)||!identifier(model){return Err("Enter a valid voice ID and model ID.".into());}
    if text.trim().is_empty()||text.chars().count()>10_000{return Err("Speech must contain 1–10,000 characters.".into());}Ok(())
}
fn payload(text:&str,model:&str)->Value{json!({"text":text,"model_id":model,"language_code":"en"})}
fn speech_request(text:&str,model:&str,voice:&str)->(String,Value){
    if model=="eleven_v4" {
        ("text-to-dialogue?output_format=mp3_44100_128".into(),json!({"inputs":[{"text":text,"voice_id":voice}],"model_id":model,"language_code":"en"}))
    }else{
        (format!("text-to-speech/{voice}?output_format=mp3_44100_128"),payload(text,model))
    }
}
fn http_error(status:u16)->String{match status{
    401=>"ElevenLabs rejected the API key. Replace it in Voice Settings.",
    403=>"ElevenLabs denied access. Check the API key permissions and voice access.",
    404=>"The selected ElevenLabs voice or model is unavailable. Check Voice Settings.",
    422|400=>"ElevenLabs rejected the voice, model or speech settings. No alternative was substituted.",
    429=>"ElevenLabs reached an account or rate limit. Check your credits and try again explicitly.",
    _=>"ElevenLabs could not complete the request. Your written answer remains available.",
}.into()}
fn entry()->Result<keyring::Entry,String>{guard()?;keyring::Entry::new("Olympus.ElevenLabs","api-key").map_err(|_|"Windows credential storage is unavailable.".into())}
fn key()->Result<String,String>{entry()?.get_password().map_err(|_|"Connect your ElevenLabs API key in Voice Settings first.".into())}
#[derive(Serialize)]
pub struct CredentialStatus { configured: bool }
#[tauri::command]
pub fn elevenlabs_status()->Result<CredentialStatus,String>{
    match entry()?.get_password(){Ok(_)=>Ok(CredentialStatus{configured:true}),Err(keyring::Error::NoEntry)=>Ok(CredentialStatus{configured:false}),Err(_)=>Err("Windows credential storage could not be read.".into())}
}
#[tauri::command]
pub fn elevenlabs_disconnect()->Result<(),String>{
    match entry()?.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>Ok(()),Err(_)=>Err("The ElevenLabs credential could not be removed.".into())}
}
#[tauri::command]
pub async fn elevenlabs_connect()->Result<bool,String>{
    guard()?;
    tauri::async_runtime::spawn_blocking(prompt_key).await.map_err(|_|"The credential dialog could not open.".to_string())?
}

// The Windows dialog owns password entry; IPC carries only success/cancellation.
#[cfg(windows)]
fn prompt_key()->Result<bool,String>{
    use std::{ffi::c_void, sync::atomic::{AtomicBool,Ordering}};
    static OPEN:AtomicBool=AtomicBool::new(false);
    if OPEN.swap(true,Ordering::SeqCst){return Err("The credential dialog is already open.".into());}
    struct Reset;
    impl Drop for Reset{fn drop(&mut self){OPEN.store(false,Ordering::SeqCst);}}
    let _reset=Reset;
    #[repr(C)]
    struct Info {size:u32,owner:*mut c_void,message:*const u16,caption:*const u16,banner:*mut c_void}
    #[link(name="Credui")]
    extern "system" {fn CredUIPromptForCredentialsW(info:*const Info,target:*const u16,reserved:*mut c_void,error:u32,user:*mut u16,user_max:u32,password:*mut u16,password_max:u32,save:*mut i32,flags:u32)->u32;}
    fn wide(text:&str)->Vec<u16>{text.encode_utf16().chain(Some(0)).collect()}
    let caption=wide("Olympus · Connect ElevenLabs");
    let message=wide("Paste your ElevenLabs API key into the Password field. Olympus stores it in Windows Credential Manager. Leave the user name unchanged.");
    let target=wide("Olympus.ElevenLabs");
    let info=Info{size:std::mem::size_of::<Info>() as u32,owner:std::ptr::null_mut(),message:message.as_ptr(),caption:caption.as_ptr(),banner:std::ptr::null_mut()};
    let mut user=[0u16;128];let name=wide("ElevenLabs API key");user[..name.len()].copy_from_slice(&name);
    let mut password=[0u16;1024];let mut save=0;
    // GENERIC_CREDENTIALS | ALWAYS_SHOW_UI | DO_NOT_PERSIST. We persist only
    // the password, under our fixed keyring entry, after successful validation.
    let code=unsafe{CredUIPromptForCredentialsW(&info,target.as_ptr(),std::ptr::null_mut(),0,user.as_mut_ptr(),128,password.as_mut_ptr(),1024,&mut save,0x40000|0x80|0x2)};
    let result=if code==1223 {Ok(false)}else if code!=0 {Err("Windows could not open the credential dialog.".into())}else{
        let end=password.iter().position(|x|*x==0).unwrap_or(password.len());
        let mut secret=String::from_utf16(&password[..end]).map_err(|_|"Invalid API key.".to_string())?;
        let result=if secret.len()<16 || secret.len()>512 || !secret.bytes().all(|b|b.is_ascii_graphic()) {Err("Enter the API key without spaces or surrounding quotes.".into())}
        else {entry()?.set_password(&secret).map(|_|true).map_err(|_|"Windows could not save the API key.".into())};
        // Best effort removal of this owned temporary, never logged or returned.
        unsafe{for byte in secret.as_bytes_mut(){std::ptr::write_volatile(byte,0);}}result
    };
    for unit in &mut password {unsafe{std::ptr::write_volatile(unit,0);}}
    result
}
#[cfg(not(windows))]
fn prompt_key()->Result<bool,String>{Err("ElevenLabs credential setup currently requires Windows.".into())}

fn client()->Result<reqwest::Client,String>{reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(50)).build().map_err(|_|"Speech networking could not initialize.".into())}
fn request(client:&reqwest::Client,method:reqwest::Method,path:&str,secret:&str)->Result<reqwest::RequestBuilder,String>{
    let mut header=reqwest::header::HeaderValue::from_str(secret).map_err(|_|"Stored API key is invalid. Replace it in Voice Settings.".to_string())?;header.set_sensitive(true);
    Ok(client.request(method,format!("{API}/{path}")).header("xi-api-key",header))
}
async fn body(mut response:reqwest::Response,max:usize)->Result<Vec<u8>,String>{
    if !response.status().is_success(){return Err(http_error(response.status().as_u16()));}
    if response.content_length().is_some_and(|n|n>max as u64){return Err("ElevenLabs returned an oversized response.".into());}
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"ElevenLabs response was interrupted.".to_string())? {
        if bytes.len()+chunk.len()>max{return Err("ElevenLabs returned an oversized response.".into());}bytes.extend_from_slice(&chunk);
    }Ok(bytes)
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ConnectionCheck { voice_name:String, model_name:String }
#[tauri::command]
pub async fn elevenlabs_check(voice_id:String,model_id:String)->Result<ConnectionCheck,String>{
    guard()?;validate("check",&voice_id,&model_id,"check")?;
    let secret=key()?;let client=client()?;
    let voice=request(&client,reqwest::Method::GET,&format!("voices/{voice_id}"),&secret)?.send().await.map_err(|_|"ElevenLabs connection failed or timed out.".to_string())?;
    let voice:Value=serde_json::from_slice(&body(voice,1024*1024).await?).map_err(|_|"ElevenLabs returned invalid voice data.".to_string())?;
    let models=request(&client,reqwest::Method::GET,"models",&secret)?.send().await.map_err(|_|"ElevenLabs connection failed or timed out.".to_string())?;
    let models:Vec<Value>=serde_json::from_slice(&body(models,1024*1024).await?).map_err(|_|"ElevenLabs returned invalid model data.".to_string())?;
    let model=models.iter().find(|m|m["model_id"].as_str()==Some(&model_id)&&m["can_do_text_to_speech"].as_bool()==Some(true)).ok_or("The selected speech model is unavailable. Choose a supported model explicitly.")?;
    Ok(ConnectionCheck{voice_name:voice["name"].as_str().unwrap_or(&voice_id).into(),model_name:model["name"].as_str().unwrap_or(&model_id).into()})
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct SpeechAudio { audio_base64:String }
fn generation_credits(headers:&reqwest::header::HeaderMap)->Option<f64>{
    headers.get("character-cost")?.to_str().ok()?.parse::<f64>().ok().filter(|v|v.is_finite()&&*v>=0.0)
}
fn validate_lab(text:&str)->Result<(),String>{if text.trim().is_empty()||text.split_whitespace().count()>5||text.chars().count()>200{Err("Voice Lab supports one to five words, up to 200 characters.".into())}else{Ok(())}}
#[tauri::command]
pub fn elevenlabs_cancel(request_id:String)->Result<(),String>{
    guard()?;if !identifier(&request_id){return Err("Invalid speech request ID.".into());}
    JOBS.lock().map_err(|_|"Speech cancellation is unavailable.".to_string())?.cancel(&request_id);Ok(())
}
#[tauri::command]
pub async fn elevenlabs_synthesize(db:tauri::State<'_,Db>,request_id:String,voice_id:String,model_id:String,text:String,preview:bool,lab:Option<bool>)->Result<SpeechAudio,String>{
    guard()?;validate(&request_id,&voice_id,&model_id,&text)?;
    if lab.unwrap_or(false){validate_lab(&text)?;}
    let cancelled=JOBS.lock().map_err(|_|"Speech is unavailable.".to_string())?.register(&request_id)?;
    let started=Instant::now();
    let mut record=models::RequestRecord::new(&models::resolve(models::Capability::Primary),if preview{"speech_preview"}else{"speech_output"});
    record.provider="elevenlabs".into();record.requested_model=model_id.clone();record.capability="TTS".into();record.reasoning_effort=None;
    record.usage=Some(json!({"billing_status":"not_submitted","input_characters":text.chars().count()}));
    let result=async {
        models::save(&db,&record)?;
        let speech=async {
            let secret=key()?;let client=client()?;
            let (path,payload)=speech_request(&text,&model_id,&voice_id);
            let pending=request(&client,reqwest::Method::POST,&path,&secret)?.json(&payload);
            record.usage=Some(json!({"billing_status":"unconfirmed","input_characters":text.chars().count()}));
            models::save(&db,&record)?;
            let response=pending.send().await.map_err(|_|"ElevenLabs connection failed or timed out. No automatic retry was made.".to_string())?;
            if let Some(credits)=generation_credits(response.headers()){
                record.usage=Some(json!({"billing_status":"confirmed","credits":credits,"input_characters":text.chars().count()}));
                models::save(&db,&record)?;
            }
            let data=body(response,MAX_AUDIO).await?;
            if data.is_empty(){return Err("ElevenLabs returned no audio.".into());}
            Ok(SpeechAudio{audio_base64:base64::engine::general_purpose::STANDARD.encode(data)})
        };
        futures_util::pin_mut!(speech,cancelled);
        match select(cancelled,speech).await {Either::Left(_)=>Err("Speech cancelled.".into()),Either::Right((result,_))=>result}
    }.await;
    if let Ok(mut jobs)=JOBS.lock(){jobs.finish(&request_id);}
    record.latency_ms=Some(started.elapsed().as_millis() as u64);
    record.status=match &result{Ok(_)=>"audio_generated",Err(e) if e=="Speech cancelled."=>"cancelled",Err(_)=>"failed"}.into();
    // The API doesn't confirm an actual model ID in the audio body. Never
    // manufacture attribution or a playback receipt from a requested model.
    record.error_code=result.as_ref().err().map(|_|"elevenlabs_speech_failed".into());
    let _=models::save(&db,&record);result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_text_and_path_segments() {
        assert!(validate("request-1", "Voice123", "eleven_v4", "Hello").is_ok());
        for voice in ["../bad", "a/b", "", "voice?x=1"] {
            assert!(validate("request-1", voice, "eleven_v4", "Hello").is_err());
        }
        assert!(validate("request-1", "Voice123", "eleven_v4", "  ").is_err());
        assert!(validate("request-1", "Voice123", "eleven_v4", &"x".repeat(10_001)).is_err());
    }
    #[test]
    fn provider_errors_never_return_raw_response_or_credentials() {
        assert!(http_error(401).contains("API key"));
        assert!(http_error(429).contains("limit"));
        assert!(http_error(404).contains("voice or model"));
    }
    #[test]
    fn cancellation_before_registration_prevents_request() {
        let mut jobs = Jobs::default();
        jobs.cancel("request-1");
        assert!(jobs.register("request-1").is_err());
        assert!(jobs.register("request-2").is_ok());
        assert!(jobs.register("request-2").is_err());
    }
    #[test]
    fn cancellation_is_bounded_and_signals_active_request() {
        let mut jobs = Jobs::default();
        let mut receiver=jobs.register("active").unwrap();
        jobs.cancel("active");
        assert!(receiver.try_recv().is_ok());
        for n in 0..1000 {jobs.cancel(&format!("cancel-{n}"));}
        assert!(jobs.entries.len()<=MAX_JOBS);
    }
    #[test]
    fn request_contains_only_speech_input() {
        let value=payload("Say this", "eleven_v4");
        assert_eq!(value, serde_json::json!({"text":"Say this","model_id":"eleven_v4","language_code":"en"}));
    }
    #[test]
    fn v4_uses_dialogue_with_the_selected_voice() {
        let (path,value)=speech_request("Hello", "eleven_v4", "Voice123");
        assert_eq!(path,"text-to-dialogue?output_format=mp3_44100_128");
        assert_eq!(value,json!({"inputs":[{"text":"Hello","voice_id":"Voice123"}],"model_id":"eleven_v4","language_code":"en"}));
        let (path,value)=speech_request("Hello", "eleven_multilingual_v2", "Voice123");
        assert_eq!(path,"text-to-speech/Voice123?output_format=mp3_44100_128");
        assert_eq!(value["text"],"Hello");
    }
    #[test]
    fn acceptance_profile_blocks_keyring_and_cancel() {
        super::super::acceptance::with_profile(std::path::Path::new("C:/synthetic-eleven-acceptance"),||{
            assert!(elevenlabs_status().is_err());
            assert!(elevenlabs_disconnect().is_err());
            assert!(elevenlabs_cancel("fixture".into()).is_err());
            assert!(key().is_err());
        });
    }
    #[test]
    fn rejects_oversized_http_body_and_sanitizes_provider_body() {
        use std::io::{Read,Write};
        for (response,expected) in [
            ("HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n", "oversized"),
            ("HTTP/1.1 401 Unauthorized\r\nContent-Length: 12\r\nConnection: close\r\n\r\nprivate-data", "API key"),
        ] {
            let server=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let addr=server.local_addr().unwrap();
            let worker=std::thread::spawn(move||{let (mut socket,_)=server.accept().unwrap();let mut input=[0;4096];let _=socket.read(&mut input);socket.write_all(response.as_bytes()).unwrap();});
            let runtime=tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            let result=runtime.block_on(async{let response=client().unwrap().get(format!("http://{addr}")).send().await.unwrap();body(response,32).await});
            let error=result.unwrap_err();assert!(error.contains(expected));assert!(!error.contains("private-data"));worker.join().unwrap();
        }
    }
}

#[cfg(test)]
mod lab_tests {
    use super::*;
    #[test] fn lab_bounds_are_enforced_before_network(){assert!(validate_lab("Olympus, tell me something useful.").is_ok());assert!(validate_lab("one two three four five six").is_err());assert!(validate_lab(&"x".repeat(201)).is_err());assert!(validate_lab(" ").is_err());}
    #[test] fn only_valid_reported_credits_are_accepted(){let mut headers=reqwest::header::HeaderMap::new();assert_eq!(generation_credits(&headers),None);for invalid in ["NaN","-1","infinity","invalid"] {headers.insert("character-cost",invalid.parse().unwrap());assert_eq!(generation_credits(&headers),None);}headers.insert("character-cost","12.5".parse().unwrap());assert_eq!(generation_credits(&headers),Some(12.5));}
}

/// Read-only quota using the existing backend credential; never returned over IPC.
pub(crate) async fn subscription_quota()->Result<Value,String>{
 guard()?;let secret=key()?;let client=client()?;
 let response=request(&client,reqwest::Method::GET,"user/subscription",&secret)?.timeout(Duration::from_secs(20)).send().await.map_err(|_|"ElevenLabs quota connection failed or timed out.".to_string())?;
 match response.status().as_u16(){
  401=>{
   // Inspect only bounded structured error identifiers; never expose raw bodies.
   let mut response=response;let mut bytes=Vec::new();
   while let Ok(Some(chunk))=response.chunk().await{if bytes.len()+chunk.len()>8192{break;}bytes.extend_from_slice(&chunk);}
   let v:Value=serde_json::from_slice(&bytes).unwrap_or(Value::Null);
   let code=match v["detail"]["status"].as_str(){Some("invalid_api_key")=>"invalid_api_key",Some("missing_permissions")=>"missing_permissions",Some("unauthorized")=>"unauthorized",_=>"unclassified_authentication_error"};
   return Err(if code=="missing_permissions"{"ElevenLabs quota returned HTTP 401 (missing_permissions). The saved key needs permission to read user subscription information. No permissions were changed.".into()}else{format!("ElevenLabs quota returned HTTP 401 ({code}). Verify the saved credential in Voice Settings. No account changes were made.")});
  },
  403=>return Err("The saved ElevenLabs key cannot read subscription quota. Account user-read permission is required; no permissions were changed.".into()),
  429=>return Err("ElevenLabs rate-limited the quota check. Try Refresh later.".into()),
  n if !(200..300).contains(&n)=>return Err("ElevenLabs quota service is unavailable.".into()),_=>{}
 }
 serde_json::from_slice(&body(response,256*1024).await?).map_err(|_|"Invalid ElevenLabs quota response.".into())
}
