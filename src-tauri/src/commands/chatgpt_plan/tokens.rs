//! Backend-only credentials. No credential type implements Debug.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use sha2::{Digest,Sha256};
fn store_key(client:&str,subject:&str)->String {
    let tuple=serde_json::to_vec(&(client,subject)).expect("string tuple is serializable");
    URL_SAFE_NO_PAD.encode(Sha256::digest(tuple))
}

#[derive(Deserialize, Serialize)]
pub struct Credentials {
    client_id: String,
    subject: String,
    access_token: String,
    refresh_token: String,
    id_token: String,
    scope: String,
    expires_at: u64,
}
impl Credentials { pub fn subject(&self)->&str { &self.subject } }

pub fn validate_id_token(token: &str, jwks: &Value, client: &str, nonce: Option<&str>, subject: Option<&str>, now: u64) -> Result<String, &'static str> {
    if token.len()>32768 { return Err("invalid identity token"); }
    let parts: Vec<_>=token.split('.').collect();
    if parts.len()!=3 { return Err("invalid identity token"); }
    let decode=|s:&str|URL_SAFE_NO_PAD.decode(s).map_err(|_|"invalid identity token");
    let header:Value=serde_json::from_slice(&decode(parts[0])?).map_err(|_|"invalid identity token")?;
    if header["alg"]!="RS256" || header.get("crit").is_some() { return Err("unsupported signature"); }
    let kid=header["kid"].as_str().ok_or("missing signing key")?;
    let keys=jwks["keys"].as_array().ok_or("invalid signing keys")?;
    let candidates:Vec<_>=keys.iter().filter(|k|k["kid"]==kid).collect();
    if candidates.len()!=1 { return Err("ambiguous signing key"); }
    let key=candidates[0];
    if key["kty"]!="RSA" || key.get("use").is_some_and(|v|v!="sig") || key.get("alg").is_some_and(|v|v!="RS256") { return Err("invalid signing key"); }
    let n=decode(key["n"].as_str().ok_or("invalid signing key")?)?;
    let e=decode(key["e"].as_str().ok_or("invalid signing key")?)?;
    ring::signature::RsaPublicKeyComponents { n:&n,e:&e }.verify(&ring::signature::RSA_PKCS1_2048_8192_SHA256,format!("{}.{}",parts[0],parts[1]).as_bytes(),&decode(parts[2])?).map_err(|_|"identity signature rejected")?;
    let claims:Value=serde_json::from_slice(&decode(parts[1])?).map_err(|_|"invalid identity claims")?;
    let audience=claims["aud"].as_str()==Some(client) || claims["aud"].as_array().is_some_and(|a|a.iter().any(|v|v==client) && (a.len()==1 || claims["azp"]==client));
    if claims["iss"]!="https://auth.openai.com" || !audience || claims["exp"].as_u64().is_none_or(|t|t<=now) || claims.get("nbf").is_some_and(|v|v.as_u64().is_none_or(|t|t>now)) || nonce.is_some_and(|n|claims["nonce"]!=n) { return Err("identity claims rejected"); }
    let sub=claims["sub"].as_str().filter(|s|!s.is_empty() && s.len()<=256).ok_or("invalid account identity")?;
    if subject.is_some_and(|s|s!=sub) { return Err("account mismatch"); }
    Ok(sub.to_string())
}

pub trait Store { fn load(&self,key:&str)->Result<Option<String>,String>; fn save(&self,key:&str,value:&str)->Result<(),String>; fn delete(&self,key:&str)->Result<(),String>; }
pub struct WindowsStore;
fn entry(key:&str)->Result<keyring::Entry,String> {
    if !cfg!(windows) { return Err("secure store unsupported".into()); }
    keyring::Entry::new("Olympus.ChatGPTPlan",key).map_err(|_|"secure store unavailable".into())
}
impl Store for WindowsStore {
    fn delete(&self,key:&str)->Result<(),String> { match entry(key)?.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>Ok(()),Err(_)=>Err("secure store unavailable".into())} }
    fn load(&self,key:&str)->Result<Option<String>,String> {
        let entry=entry(key)?;
        match entry.get_password() { Ok(v)=>Ok(Some(v)),Err(keyring::Error::NoEntry)=>Ok(None),Err(_)=>Err("secure store unavailable".into()) }
    }
    fn save(&self,key:&str,value:&str)->Result<(),String> {
        entry(key)?.set_password(value).map_err(|_|"secure store unavailable".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    #[derive(Default)] struct MemoryStore(Mutex<HashMap<String,String>>);
    impl Store for MemoryStore {
        fn delete(&self,k:&str)->Result<(),String>{self.0.lock().unwrap().remove(k);Ok(())}
        fn load(&self,k:&str)->Result<Option<String>,String>{Ok(self.0.lock().unwrap().get(k).cloned())}
        fn save(&self,k:&str,v:&str)->Result<(),String>{self.0.lock().unwrap().insert(k.into(),v.into());Ok(())}
    }
    fn fixture()->Value { serde_json::from_str(include_str!("fixture.json")).unwrap() }
    fn response(f:&Value)->Value { serde_json::json!({"token_type":"Bearer","id_token":f["token"],"access_token":"synthetic-access","refresh_token":"synthetic-refresh","expires_in":120,"scope":"openid resource.invoke chatgpt.tokens.use.direct"}) }
    #[test] fn corrupt_credentials_can_be_disconnected_without_revoking_untrusted_data(){
        let store=MemoryStore::default();store.save(&store_key("client","subject"),"invalid-json").unwrap();
        let session=Session::new(store);
        assert!(!session.disconnect("client","subject",|_,_|panic!("untrusted revocation")).unwrap());
        assert!(session.store.load(&store_key("client","subject")).unwrap().is_none());
    }
    #[test] fn signed_identity_rejects_tampering_expiry_and_wrong_binding() {
        let f=fixture(); let t=f["token"].as_str().unwrap();
        assert_eq!(validate_id_token(t,&f["jwks"],"oaiapp_fixture",Some("fixture-nonce"),None,1900000000).unwrap(),"fixture-user");
        for (client,nonce,now) in [("other","fixture-nonce",1900000000),("oaiapp_fixture","other",1900000000),("oaiapp_fixture","fixture-nonce",2000000000)] { assert!(validate_id_token(t,&f["jwks"],client,Some(nonce),None,now).is_err()); }
        let mut tampered=t.to_string(); tampered.replace_range(0..1,"A");
        assert!(validate_id_token(&tampered,&f["jwks"],"oaiapp_fixture",None,None,1900000000).is_err());
    }
    #[test] fn renewal_preserves_identity_and_stores_rotation_before_returning() {
        let f=fixture(); let s=Session::new(MemoryStore::default());
        let saved=s.accept("oaiapp_fixture",Some("fixture-nonce"),None,&response(&f),&f["jwks"],1900000000).unwrap();
        s.persist(&saved).unwrap();
        assert_eq!(s.access("oaiapp_fixture","fixture-user",1900000000,|_,_|panic!("unnecessary refresh")).unwrap(),"synthetic-access");
        let got=s.access("oaiapp_fixture","fixture-user",1900000100,|client,refresh| {assert_eq!(client,"oaiapp_fixture");assert_eq!(refresh,"synthetic-refresh");let mut r=response(&f);r["access_token"]="rotated".into();r["refresh_token"]="rotated-refresh".into();Ok((r,f["jwks"].clone()))}).unwrap();
        assert_eq!(got,"rotated");
        assert!(s.access("oaiapp_fixture","other",1900000100,|_,_|panic!()).is_err());
        let mut denied=response(&f);denied["scope"]="openid".into();
        assert!(s.accept("oaiapp_fixture",None,None,&denied,&f["jwks"],1900000000).is_err());
    }
}
pub struct Session<S> { store:S, refresh_lock:Mutex<()> }
impl<S:Store> Session<S> {
    pub fn new(store:S)->Self { Self { store,refresh_lock:Mutex::new(()) } }
    pub fn accept(&self, client:&str, nonce:Option<&str>, subject:Option<&str>, response:&Value, jwks:&Value, now:u64)->Result<Credentials,String> {
        if client.is_empty() || client=="dynamic_agent_client" || response["token_type"].as_str().is_none_or(|v|!v.eq_ignore_ascii_case("Bearer")) { return Err("invalid token response".into()); }
        let field=|name:&str|response[name].as_str().filter(|s|!s.is_empty() && s.len()<=32768).map(str::to_string).ok_or_else(||"incomplete token response".to_string());
        let id_token=field("id_token")?;
        let identity=validate_id_token(&id_token,jwks,client,nonce,subject,now)?;
        let scope=field("scope")?;
        for required in ["openid","resource.invoke","chatgpt.tokens.use.direct"] { if !scope.split_whitespace().any(|s|s==required) { return Err("plan permission missing".into()); } }
        let lifetime=response["expires_in"].as_u64().filter(|t|*t>0 && *t<=86400).ok_or("invalid token lifetime")?;
        Ok(Credentials { client_id:client.into(),subject:identity,access_token:field("access_token")?,refresh_token:field("refresh_token")?,id_token,scope,expires_at:now.checked_add(lifetime).ok_or("invalid token lifetime")? })
    }
    pub fn persist(&self, credentials:&Credentials)->Result<(),String> {
        let key=store_key(&credentials.client_id,&credentials.subject);
        let value=serde_json::to_string(credentials).map_err(|_|"credential encoding failed")?;
        self.store.save(&key,&value)
    }
    pub fn disconnect(&self,client:&str,subject:&str,revoke:impl FnOnce(&str,&str)->Result<(),String>)->Result<bool,String>{
        let _guard=self.refresh_lock.lock().map_err(|_|"session unavailable")?;
        let key=store_key(client,subject);
        let confirmed=match self.store.load(&key)? {
            None=>true,
            Some(raw)=>match serde_json::from_str::<Credentials>(&raw){
                Ok(saved) if saved.client_id==client && saved.subject==subject=>revoke(client,&saved.refresh_token).is_ok(),
                _=>false,
            }
        };
        self.store.delete(&key)?;
        Ok(confirmed)
    }
    /// Refresh is serialized, including storage, so a rotating token cannot race.
    pub fn access(&self, client:&str, subject:&str, now:u64, refresh:impl FnOnce(&str,&str)->Result<(Value,Value),String>)->Result<String,String> {
        let _guard=self.refresh_lock.lock().map_err(|_|"session unavailable")?;
        let raw=self.store.load(&store_key(client,subject))?.ok_or("connection missing")?;
        let saved:Credentials=serde_json::from_str(&raw).map_err(|_|"invalid saved connection")?;
        if saved.client_id!=client || saved.subject!=subject { return Err("account mismatch".into()); }
        if saved.expires_at>now.saturating_add(60) { return Ok(saved.access_token); }
        let (response,keys)=refresh(client,&saved.refresh_token)?;
        let fresh=self.accept(client,None,Some(subject),&response,&keys,now)?;
        self.persist(&fresh)?;
        Ok(fresh.access_token)
    }
}
