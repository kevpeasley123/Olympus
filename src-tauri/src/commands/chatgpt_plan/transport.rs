//! Fixed-origin OAuth requests. Not exposed through IPC during offline development.
use serde_json::Value;
use std::io::Read;
const TOKEN:&str="https://auth.openai.com/api/accounts/oauth/token";
fn client()->Result<reqwest::blocking::Client,String> {
    reqwest::blocking::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(15)).build().map_err(|_|"authorization transport unavailable".into())
}
fn json(response:reqwest::blocking::Response)->Result<Value,String> {
    if !response.status().is_success() { return Err("authorization request rejected".into()); }
    let mut bytes=Vec::new();
    response.take(262145).read_to_end(&mut bytes).map_err(|_|"authorization response unavailable")?;
    if bytes.len()>262144 { return Err("authorization response too large".into()); }
    serde_json::from_slice(&bytes).map_err(|_|"invalid authorization response".into())
}
pub fn signing_keys()->Result<Value,String> {
    let c=client()?;
    let discovery=json(c.get("https://auth.openai.com/.well-known/openid-configuration").send().map_err(|_|"identity discovery unavailable")?)?;
    if discovery["issuer"]!="https://auth.openai.com" { return Err("identity issuer mismatch".into()); }
    let url=key_url(&discovery)?;
    json(c.get(url).send().map_err(|_|"signing keys unavailable")?)
}
fn key_url(discovery:&Value)->Result<reqwest::Url,String> {
    let url=reqwest::Url::parse(discovery["jwks_uri"].as_str().ok_or("signing keys unavailable")?).map_err(|_|"invalid signing key endpoint")?;
    if url.scheme()!="https" || url.host_str()!=Some("auth.openai.com") || url.port_or_known_default()!=Some(443) || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() { return Err("untrusted signing key endpoint".into()); }
    Ok(url)
}
pub fn exchange(attempt:&super::Exchange)->Result<Value,String> {
    json(client()?.post(TOKEN).form(&[("grant_type","authorization_code"),("client_id",attempt.client_id.as_str()),("code",attempt.code.as_str()),("code_verifier",attempt.verifier.as_str()),("redirect_uri",attempt.redirect.as_str()),("resource","https://api.openai.com/v1")]).send().map_err(|_|"authorization exchange unavailable")?)
}
pub fn refresh(client_id:&str,token:&str)->Result<(Value,Value),String> {
    let response=json(client()?.post(TOKEN).form(&[("grant_type","refresh_token"),("client_id",client_id),("refresh_token",token),("resource","https://api.openai.com/v1")]).send().map_err(|_|"authorization renewal unavailable")?)?;
    Ok((response,signing_keys()?))
}
pub fn revoke(client_id:&str,token:&str)->Result<(),String>{
    let c=client()?;
    let discovery=json(c.get("https://auth.openai.com/.well-known/openid-configuration").send().map_err(|_|"revocation discovery unavailable")?)?;
    if discovery["issuer"]!="https://auth.openai.com"{return Err("identity issuer mismatch".into());}
    let endpoint=key_url(&serde_json::json!({"jwks_uri":discovery["revocation_endpoint"]}))?;
    let response=c.post(endpoint).form(&[("token",token),("token_type_hint","refresh_token"),("client_id",client_id)]).send().map_err(|_|"remote revocation unconfirmed")?;
    if response.status()==reqwest::StatusCode::OK{Ok(())}else{Err("remote revocation unconfirmed".into())}
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn discovery_cannot_redirect_signing_key_trust() {
        for uri in ["http://auth.openai.com/keys","https://evil.example/keys","https://auth.openai.com:444/keys","https://user@auth.openai.com/keys","https://auth.openai.com/keys#x"] { assert!(key_url(&serde_json::json!({"jwks_uri":uri})).is_err()); }
        assert!(key_url(&serde_json::json!({"jwks_uri":"https://auth.openai.com/keys"})).is_ok());
    }
}
