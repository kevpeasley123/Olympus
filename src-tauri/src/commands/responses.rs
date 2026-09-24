//! OpenAI Responses adapter; no provider-owned conversation or execution authority.
use super::assistant::{AssistantNotice, AssistantStreamEvent};
use super::models::{RequestRecord, Route};
use serde_json::{json, Value};
pub fn voice_schema() -> Value {
    json!({"type":"object","additionalProperties":false,"required":["spokenResponse","visualResponse","proposedActions","requiresConfirmation","conversationState"],"properties":{
    "spokenResponse":{"type":"string"},"visualResponse":{"type":"string"},"requiresConfirmation":{"type":"boolean"},"conversationState":{"type":"string","enum":["awaiting_input"]},
    "proposedActions":{"type":"array","maxItems":3,"items":{"anyOf":[
    {"type":"object","additionalProperties":false,"required":["type","status"],"properties":{"type":{"type":"string","enum":["show_projects"]},"status":{"type":["string","null"],"enum":["ALL","NEEDS_YOU","READY","IN_PROGRESS","BLOCKED","WAITING","MONITORING","UNKNOWN","COMPLETE",null]}}},
    {"type":"object","additionalProperties":false,"required":["type","projectId"],"properties":{"type":{"type":"string","enum":["open_project","review_proposal"]},"projectId":{"type":"string"}}}
    ]}}}})
}
pub fn payload(route: &Route, instructions: &str, messages: Vec<Value>, voice: bool) -> Value {
    let mut v = json!({"model":route.model,"instructions":instructions,"input":messages,"store":false,"stream":true,"reasoning":{"effort":route.effort,"context":"current_turn"},"max_output_tokens":8000});
    if voice {
        v["text"] = json!({"format":{"type":"json_schema","name":"olympus_voice_answer","strict":true,"schema":voice_schema()}});
    }
    v
}
#[derive(Default)]
pub struct Decoder {
    pending: Vec<u8>,
    data: Vec<String>,
}
impl Decoder {
    pub fn feed(&mut self, chunk: &[u8]) -> Result<Vec<Value>, String> {
        self.pending.extend_from_slice(chunk);
        let mut events = vec![];
        while let Some(end) = self.pending.iter().position(|b| *b == b'\n') {
            let bytes = self.pending.drain(..=end).collect::<Vec<_>>();
            let line = std::str::from_utf8(&bytes)
                .map_err(|_| "invalid_utf8_stream")?
                .trim_end_matches(['\r', '\n']);
            if line.is_empty() {
                if !self.data.is_empty() {
                    let data = self.data.join("\n");
                    self.data.clear();
                    if data != "[DONE]" {
                        events
                            .push(serde_json::from_str(&data).map_err(|_| "invalid_json_stream")?);
                    }
                }
            } else if let Some(data) = line.strip_prefix("data:") {
                self.data.push(data.trim_start().into());
            }
        }
        if self.pending.len() > 2_000_000 {
            return Err("oversized_stream_event".into());
        }
        Ok(events)
    }
}
#[derive(Default)]
pub struct Output {
    pub text: String,
    pub refusal: String,
    pub terminal: bool,
    pub notice: Option<AssistantNotice>,
    pub failure: Option<String>,
}
impl Output {
    pub fn event(&mut self, e: &Value, r: &mut RequestRecord) -> Option<AssistantStreamEvent> {
        if let Some(response) = e.get("response") {
            if let Some(model) = response["model"].as_str() {
                r.actual_model = Some(model.into());
            }
            if let Some(usage) = response.get("usage").filter(|v| !v.is_null()) {
                r.usage = Some(usage.clone());
            }
        }
        match e["type"].as_str().unwrap_or("") {
            "response.created" => r
                .actual_model
                .clone()
                .map(|model| AssistantStreamEvent::Started { model }),
            "response.output_text.delta" => {
                let text = e["delta"].as_str().unwrap_or("").to_string();
                self.text.push_str(&text);
                Some(AssistantStreamEvent::Delta { text })
            }
            "response.refusal.delta" => {
                self.refusal.push_str(e["delta"].as_str().unwrap_or(""));
                None
            }
            "response.completed" => {
                self.terminal = true;
                r.status = if self.refusal.is_empty() {
                    "completed"
                } else {
                    "refused"
                }
                .into();
                None
            }
            "response.incomplete" | "response.failed" | "error" => {
                self.terminal = true;
                r.status = if e["type"] == "response.incomplete" {
                    "incomplete"
                } else {
                    "failed"
                }
                .into();
                let code = e
                    .pointer("/response/incomplete_details/reason")
                    .or_else(|| e.pointer("/response/error/code"))
                    .or_else(|| e.pointer("/error/code"))
                    .or_else(|| e.get("code"))
                    .and_then(Value::as_str)
                    .unwrap_or("response_failed");
                r.error_code = Some(code.into());
                self.failure = Some(code.into());
                None
            }
            _ => None,
        }
    }
    fn finish(mut self, r: &mut RequestRecord) -> Result<Self, String> {
        if !self.terminal {
            r.status = "failed".into();
            if r.error_code.is_none() {
                r.error_code = Some("stream_interrupted".into());
            }
            self.failure = r.error_code.clone();
        }
        if !self.refusal.is_empty() {
            r.status = "refused".into();
            self.notice = Some(AssistantNotice {
                kind: "refusal",
                message: "The provider declined this request. No fallback was attempted.".into(),
            });
            if self.text.trim().is_empty() {
                self.text = self.refusal.clone();
            }
        } else if let Some(code) = self.failure.clone() {
            if self.text.trim().is_empty() {
                return Err(format!(
                    "OpenAI response failed ({code}). No alternate provider was used."
                ));
            }
            self.notice=Some(AssistantNotice{kind:"truncated",message:format!("Response interrupted ({code}). This is the output received before interruption.")});
        }
        if self.text.trim().is_empty() {
            r.status = "failed".into();
            r.error_code = Some("empty_output".into());
            return Err("OpenAI returned no answer text.".into());
        }
        Ok(self)
    }
}
pub async fn complete(
    route: &Route,
    instructions: &str,
    messages: Vec<Value>,
    voice: bool,
    channel: &tauri::ipc::Channel<AssistantStreamEvent>,
    record: &mut RequestRecord,
) -> Result<Output, String> {
    complete_at(
        route,
        instructions,
        messages,
        voice,
        channel,
        record,
        "https://api.openai.com/v1/responses",
        None,
    )
    .await
}
async fn complete_at(
    route: &Route,
    instructions: &str,
    messages: Vec<Value>,
    voice: bool,
    channel: &tauri::ipc::Channel<AssistantStreamEvent>,
    record: &mut RequestRecord,
    endpoint: &str,
    test_key: Option<&str>,
) -> Result<Output, String> {
    transport(
        payload(route, instructions, messages, voice),
        channel,
        record,
        endpoint,
        test_key,
        240,
    )
    .await
}
/// Strict structured work shares the chat transport but never accepts partial/refused output.
pub async fn structured(
    route: &Route,
    instructions: &str,
    input: Value,
    schema: Value,
    record: &mut RequestRecord,
) -> Result<String, String> {
    let mut body = payload(
        route,
        instructions,
        vec![json!({"role":"user","content":input.to_string()})],
        false,
    );
    body["text"] = json!({"format":{"type":"json_schema","name":"communication_assessment","strict":true,"schema":schema}});
    let output = transport(
        body,
        &tauri::ipc::Channel::new(|_| Ok(())),
        record,
        "https://api.openai.com/v1/responses",
        None,
        60,
    )
    .await?;
    structured_text(output, record)
}
fn structured_text(output: Output, record: &RequestRecord) -> Result<String, String> {
    if !output.terminal || !output.refusal.is_empty() || output.failure.is_some() || record.status != "completed" {
        return Err("assessment_provider_incomplete_or_refused".into());
    }
    if output.text.len()>128_000 {return Err("assessment_output_budget".into())}
    Ok(output.text)
}
async fn transport(
    body: Value,
    channel: &tauri::ipc::Channel<AssistantStreamEvent>,
    record: &mut RequestRecord,
    endpoint: &str,
    test_key: Option<&str>,
    timeout_secs: u64,
) -> Result<Output, String> {
    let start = std::time::Instant::now();
    let result=async{
 let key=test_key.map(str::to_owned).or_else(||std::env::var("OPENAI_API_KEY").ok()).filter(|v|!v.trim().is_empty()).ok_or("OpenAI reasoning needs OPENAI_API_KEY in the Olympus project .env.")?;
 let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(timeout_secs)).build().map_err(|_|"OpenAI HTTP client unavailable")?;
 let response=client.post(endpoint).bearer_auth(key.trim()).json(&body).send().await.map_err(|_|"OpenAI connection failed or timed out. Retry explicitly; no alternate provider was used.")?;
 if !response.status().is_success(){let status=response.status().as_u16();record.error_code=Some(format!("http_{status}"));let data=response.json::<Value>().await.unwrap_or(Value::Null);let code=data.pointer("/error/code").and_then(Value::as_str).unwrap_or("request_rejected");return Err(format!("OpenAI request failed (HTTP {status}, {code}). Check API access, quota and configuration; no alternate provider was used."));}
 let mut stream=response.bytes_stream();let mut decoder=Decoder::default();let mut output=Output::default();
 while let Some(chunk)=futures_util::StreamExt::next(&mut stream).await{
 let events=match chunk{Ok(bytes)=>decoder.feed(&bytes),Err(_)=>Err("stream_interrupted".into())};
 let events=match events{Ok(events)=>events,Err(code)=>{record.error_code=Some(code.clone());output.failure=Some(code);break;}};
 for e in events{if let Some(ui)=output.event(&e,record){if matches!(ui,AssistantStreamEvent::Delta{..})&&record.first_token_ms.is_none(){record.first_token_ms=Some(start.elapsed().as_millis() as u64);}channel.send(ui).ok();}}
 if output.terminal{break;}
 }output.finish(record)
 }.await;
    record.latency_ms = Some(start.elapsed().as_millis() as u64);
    if result.is_err() && record.status == "started" {
        record.status = "failed".into();
        if record.error_code.is_none() {
            record.error_code = Some("transport_or_credentials".into());
        }
    }
    result
}
#[cfg(test)]
mod tests {
    use super::super::models::{resolve, Capability};
    use super::*;
    #[test]
    fn structured_assessment_rejects_partial_refused_and_nonterminal_text() {
        let mut r=RequestRecord::new(&resolve(Capability::Primary),"fixture");r.status="completed".into();
        let valid=||Output{text:"{}".into(),terminal:true,..Default::default()};
        assert_eq!(structured_text(valid(),&r).unwrap(),"{}");
        let mut partial=valid();partial.failure=Some("max_output_tokens".into());assert!(structured_text(partial,&r).is_err());
        let mut refused=valid();refused.refusal="Refused".into();assert!(structured_text(refused,&r).is_err());
        let mut unfinished=valid();unfinished.terminal=false;assert!(structured_text(unfinished,&r).is_err());
    }
    #[test]
    fn nested_stream_error_preserves_provider_code() {
        let mut record = RequestRecord::new(&resolve(Capability::Primary), "test");
        let mut output = Output::default();
        output.event(
            &json!({"type":"error","error":{"type":"insufficient_quota","code":"credit_balance_exhausted"}}),
            &mut record,
        );
        let error = output.finish(&mut record).err().unwrap();
        assert!(error.contains("credit_balance_exhausted"));
        assert_eq!(record.status, "failed");
        assert_eq!(record.error_code.as_deref(), Some("credit_balance_exhausted"));
        assert!(record.fallback_from.is_none());
    }
    #[test]
    fn payload_keeps_local_state_and_voice_contract() {
        let b = payload(&resolve(Capability::Primary), "identity", vec![], true);
        assert_eq!(b["store"], false);
        assert_eq!(b["reasoning"]["effort"], "medium");
        assert_eq!(b["text"]["format"]["strict"], true);
        assert!(b.get("tools").is_none());
        assert!(b.get("fallbacks").is_none());
        assert!(b.get("system").is_none());
        assert_eq!(
            payload(&resolve(Capability::DeepReasoning), "", vec![], false)["reasoning"]["effort"],
            "high"
        );
    }
    #[test]
    fn utf8_stream_survives_byte_boundaries() {
        let raw = format!("data: {{\"delta\":\"{}\"}}\r\n\r\n", '\u{03a9}');
        let mut d = Decoder::default();
        let mut e = vec![];
        for b in raw.as_bytes() {
            e.extend(d.feed(&[*b]).unwrap());
        }
        assert_eq!(e[0]["delta"], "\u{03a9}");
    }
    #[test]
    fn interruption_preserves_partial_text() {
        let mut r = RequestRecord::new(&resolve(Capability::Primary), "test");
        let mut o = Output::default();
        o.event(
            &json!({"type":"response.output_text.delta","delta":"Partial"}),
            &mut r,
        );
        let o = o.finish(&mut r).unwrap();
        assert_eq!(o.text, "Partial");
        assert_eq!(o.notice.unwrap().kind, "truncated");
        assert_eq!(r.status, "failed");
    }
    #[test]
    fn completion_records_actual_model_and_usage() {
        let mut r = RequestRecord::new(&resolve(Capability::Primary), "test");
        let mut o = Output::default();
        o.event(
            &json!({"type":"response.created","response":{"model":"actual-snapshot"}}),
            &mut r,
        );
        o.event(
            &json!({"type":"response.output_text.delta","delta":"Done"}),
            &mut r,
        );
        o.event(
            &json!({"type":"response.completed","response":{"usage":{"input_tokens":42}}}),
            &mut r,
        );
        o.finish(&mut r).unwrap();
        assert_eq!(r.actual_model.as_deref(), Some("actual-snapshot"));
        assert_eq!(r.usage.unwrap()["input_tokens"], 42);
    }
    #[test]
    fn refusal_never_falls_back() {
        let mut r = RequestRecord::new(&resolve(Capability::Primary), "test");
        let mut o = Output::default();
        o.event(
            &json!({"type":"response.refusal.delta","delta":"Cannot assist."}),
            &mut r,
        );
        o.event(&json!({"type":"response.completed"}), &mut r);
        assert_eq!(o.finish(&mut r).unwrap().notice.unwrap().kind, "refusal");
        assert!(r.fallback_from.is_none());
    }
    #[test]
    fn failure_without_text_is_error() {
        let mut r = RequestRecord::new(&resolve(Capability::Primary), "test");
        let mut o = Output::default();
        o.event(
            &json!({"type":"response.failed","response":{"error":{"code":"server_error"}}}),
            &mut r,
        );
        assert!(o.finish(&mut r).is_err());
        assert_eq!(r.error_code.as_deref(), Some("server_error"));
    }
    #[test]
    #[ignore = "Paid API smoke; run explicitly with a configured project key"]
    fn live_openai_routes() {
        dotenvy::from_path(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.env")).ok();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
     for (capability,voice) in [(Capability::Primary,false),(Capability::DeepReasoning,false),(Capability::Primary,true)] {
       let route=resolve(capability);let mut record=RequestRecord::new(&route,"acceptance_fixture");
       let channel=tauri::ipc::Channel::new(|_|Ok(()));
       let instructions=if voice {super::super::voice::response_instructions("ANSWER")}else{"You are Olympus. Reply concisely. Recommendations are not commitments. Never claim execution.".into()};
       let messages=vec![json!({"role":"user","content":"Fixture project Atlas has a recorded next action but no approved run. What needs my attention? Explain that review is required, without claiming execution."})];
       let result=complete(&route,&instructions,messages,voice,&channel,&mut record).await;
       println!("LIVE_ROUTE {} voice={} status={} model={:?} latency={:?} error={:?}",route.model,voice,record.status,record.actual_model,record.latency_ms,record.error_code);
       let output=result.expect("Live Responses request must succeed");
       if voice {super::super::voice::parse_answer(&output.text,"ANSWER").unwrap();}
       assert_eq!(record.status,"completed");assert!(record.usage.is_some());assert!(!output.text.is_empty());
     }
   });
    }
    #[test]
    fn http_failure_does_not_switch_provider() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        listener.set_nonblocking(true).unwrap();
        let server = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
            let (mut socket, _) = loop {
                match listener.accept() {
                    Ok(v) => break v,
                    Err(e)
                        if e.kind() == std::io::ErrorKind::WouldBlock
                            && std::time::Instant::now() < deadline =>
                    {
                        std::thread::sleep(std::time::Duration::from_millis(10))
                    }
                    Err(e) => panic!("mock server connection: {e}"),
                }
            };
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut buffer = [0; 8192];
            let _ = socket.read(&mut buffer);
            let body = r#"{"error":{"code":"invalid_api_key"}}"#;
            write!(socket,"HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        });
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let mut record = RequestRecord::new(&resolve(Capability::Primary), "failure_fixture");
        let result = runtime.block_on(complete_at(
            &resolve(Capability::Primary),
            "fixture",
            vec![],
            false,
            &tauri::ipc::Channel::new(|_| Ok(())),
            &mut record,
            &format!("http://{address}"),
            Some("fixture-not-a-key"),
        ));
        server.join().unwrap();
        assert!(result.err().unwrap().contains("HTTP 401"));
        assert_eq!(record.status, "failed");
        assert_eq!(record.error_code.as_deref(), Some("http_401"));
        assert!(record.fallback_from.is_none());
        assert!(record.actual_model.is_none());
    }
}
