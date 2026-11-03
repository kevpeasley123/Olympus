//! Olympus-owned OAuth preparation. No browser, token exchange or inference yet.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use reqwest::Url;
pub mod tokens;
pub mod transport;
pub mod controller;
pub mod connection;

pub struct Pending {
    state: String,
    nonce: String,
    verifier: String,
    redirect: String,
    client: Option<String>,
    consumed: bool,
}
pub struct Exchange {
    pub client_id: String,
    pub code: String,
    pub verifier: String,
    pub redirect: String,
    pub nonce: String,
}
impl Pending {
    pub fn new(port: u16, client: Option<String>) -> Result<Self, &'static str> {
        let random = || { let mut bytes = [0u8;32]; getrandom::getrandom(&mut bytes).map_err(|_| "random unavailable")?; Ok::<_, &'static str>(URL_SAFE_NO_PAD.encode(bytes)) };
        if port == 0 || client.as_ref().is_some_and(|c| c.is_empty() || c == "dynamic_agent_client") { return Err("invalid registration"); }
        Ok(Self { state:random()?, nonce:random()?, verifier:random()?, redirect:format!("http://127.0.0.1:{port}/auth/callback"), client, consumed:false })
    }
    pub fn authorize_url(&self, host: &str) -> Result<Url, &'static str> {
        if self.consumed || host.is_empty() || host.len()>256 { return Err("invalid attempt"); }
        let mut url=Url::parse("https://auth.openai.com/api/accounts/authorize").map_err(|_|"invalid endpoint")?;
        let challenge=URL_SAFE_NO_PAD.encode(Sha256::digest(self.verifier.as_bytes()));
        url.query_pairs_mut().extend_pairs([
            ("client_id",self.client.as_deref().unwrap_or("dynamic_agent_client")),
            ("ext_agent_host_id",host),("response_type","code"),
            ("redirect_uri",self.redirect.as_str()),
            ("scope","openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"),
            ("resource","https://api.openai.com/v1"),("state",self.state.as_str()),
            ("nonce",self.nonce.as_str()),("code_challenge_method","S256"),("code_challenge",challenge.as_str())]);
        if self.client.is_none() { url.query_pairs_mut().append_pair("agent_name_hint","Olympus"); }
        Ok(url)
    }
    pub fn callback(&mut self, raw: &str) -> Result<Exchange, &'static str> {
        if self.consumed { return Err("attempt already consumed"); }
        // Every received callback closes this attempt, including rejected ones.
        self.consumed=true;
        if raw.len()>16384 { return Err("invalid callback"); }
        let url=Url::parse(raw).map_err(|_|"invalid callback")?;
        let mut endpoint=url.clone(); endpoint.set_query(None);
        if endpoint.as_str()!=self.redirect || url.fragment().is_some() { return Err("callback address mismatch"); }
        let mut fields=std::collections::HashMap::new();
        for (key,value) in url.query_pairs() {
            if fields.insert(key.into_owned(),value.into_owned()).is_some() { return Err("duplicate callback field"); }
        }
        if fields.get("state")!=Some(&self.state) { return Err("callback state mismatch"); }
        if fields.contains_key("error") { return Err("authorization declined"); }
        let client=match (&self.client,fields.get("client_id")) {
            (Some(saved),Some(given)) if saved!=given => return Err("registration mismatch"),
            (Some(saved),_)=>saved.clone(),
            (None,Some(given)) if !given.is_empty() && given!="dynamic_agent_client"=>given.clone(),
            _=>return Err("registration incomplete"),
        };
        let code=fields.remove("code").filter(|c|!c.is_empty()).ok_or("missing authorization code")?;
        Ok(Exchange { client_id:client,code,verifier:std::mem::take(&mut self.verifier),redirect:self.redirect.clone(),nonce:std::mem::take(&mut self.nonce) })
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn callback(p: &Pending, extra: &str) -> String { format!("{}?state={}&code=fixture-code{extra}",p.redirect,p.state) }
    #[test]
    fn registration_uses_pkce_and_plan_scope_without_secret() {
        let p=Pending::new(32123,None).unwrap();
        let url=p.authorize_url("urn:uuid:fixture-host").unwrap();
        let q:std::collections::HashMap<_,_>=url.query_pairs().collect();
        assert_eq!(url.host_str(),Some("auth.openai.com"));
        assert_eq!(q["client_id"],"dynamic_agent_client");
        assert_eq!(q["agent_name_hint"],"Olympus");
        assert_eq!(q["code_challenge_method"],"S256");
        assert_ne!(q["code_challenge"],p.verifier);
        assert!(q["scope"].split_whitespace().any(|s|s=="chatgpt.tokens.use.direct"));
        assert!(!q.contains_key("client_secret"));
    }
    #[test]
    fn callback_is_bound_and_consumed_once() {
        let mut p=Pending::new(32123,None).unwrap();
        let url=callback(&p,"&client_id=oaiapp_fixture");
        let e=p.callback(&url).unwrap();
        assert_eq!(e.client_id,"oaiapp_fixture");
        assert_eq!(e.code,"fixture-code");
        assert!(p.callback(&url).is_err());
    }
    #[test]
    fn callback_rejects_wrong_state_origin_duplicates_and_client_swap() {
        for bad in ["&state=other", "&client_id=other", "&error=access_denied"] {
            let mut p=Pending::new(32123,Some("oaiapp_fixture".into())).unwrap();
            let url=callback(&p,bad);
            assert!(p.callback(&url).is_err());
        }
        let mut p=Pending::new(32123,None).unwrap();
        let url=callback(&p,"&client_id=oaiapp_fixture").replace("127.0.0.1","localhost");
        assert!(p.callback(&url).is_err());
        let mut p=Pending::new(32123,None).unwrap();
        assert!(p.callback(&callback(&p,"")).is_err());
    }
}
