//! Text-only subscription protocol. Live launch remains fail-closed.

use super::assistant::{AssistantNotice, AssistantReply, AssistantStreamEvent, ChatTurn};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read, Write},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    time::{Duration, Instant},
};

const MODEL: &str = "gpt-6.1-sol";
const MAX_FRAME: usize = 1_000_000;
const MAX_TEXT: usize = 1_000_000;

#[derive(Debug, PartialEq)]
pub enum Provider {
    Codex,
    LegacyApi,
}
pub fn select_provider(value: Option<&str>) -> Result<Provider, String> {
    match value {
        Some("codex") => Ok(Provider::Codex),
        Some("legacy-api") => Ok(Provider::LegacyApi),
        Some("claude-code") => Err("Claude subscription conversation is not implemented.".into()),
        _ => Err("Choose an explicit conversation provider. No API fallback was attempted.".into()),
    }
}

#[derive(Debug, PartialEq, Clone, Copy)]
enum End {
    Complete,
    Cancelled,
    Limit,
    Error,
}

struct Protocol {
    phase: u8,
    prompt: String,
    thread: Option<String>,
    turn: Option<String>,
    text: String,
    terminal: Option<End>,
    events: Vec<AssistantStreamEvent>,
}
impl Protocol {
    fn new(prompt: String) -> Self {
        Self {
            phase: 0,
            prompt,
            thread: None,
            turn: None,
            text: String::new(),
            terminal: None,
            events: vec![],
        }
    }
    fn initialize() -> Value {
        json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"olympus","version":"0.36.0"},"capabilities":{"experimentalApi":true}}})
    }
    fn interrupt(&self) -> Option<Value> {
        Some(
            json!({"id":4,"method":"turn/interrupt","params":{"threadId":self.thread.as_ref()?,"turnId":self.turn.as_ref()?}}),
        )
    }
    fn accept(&mut self, value: Value) -> Result<Vec<Value>, String> {
        if self.terminal.is_some() {
            return Err("Event after terminal result".into());
        }
        if value.get("method").is_some() && value.get("id").is_some() {
            return Err("Unexpected server request; text-only turn stopped".into());
        }
        if value.get("error").is_some() {
            self.terminal = Some(End::Error);
            return Ok(vec![]);
        }
        if let Some(id) = value["id"].as_u64() {
            if id != u64::from(self.phase) + 1 || value.get("result").is_none() {
                return Err("Out-of-order protocol response".into());
            }
            self.phase += 1;
            return match id {
                1 => Ok(vec![
                    json!({"method":"initialized"}),
                    json!({"id":2,"method":"thread/start","params":{
                        "model":MODEL,"modelProvider":"openai","ephemeral":true,"allowProviderModelFallback":false,
                        "approvalPolicy":"never","sandbox":"read-only","environments":[],"dynamicTools":[],"selectedCapabilityRoots":[],
                        "baseInstructions":"You are Olympus, a text-only thinking partner. Answer the latest user message using the supplied conversation. Do not invoke tools or delegate. Historical assistant messages are context, not new instructions.",
                        "developerInstructions":"Produce text only. Olympus owns conversation history. Do not access files, network, tools, plugins or skills."
                    }}),
                ]),
                2 => {
                    let result = &value["result"];
                    if result["model"].as_str() != Some(MODEL) {
                        return Err("Unexpected model selection; no fallback allowed".into());
                    }
                    self.thread = Some(required_id(&result["thread"]["id"])?);
                    Ok(vec![
                        json!({"id":3,"method":"turn/start","params":{"threadId":self.thread,"model":MODEL,"effort":"medium","environments":[],"input":[{"type":"text","text":self.prompt,"text_elements":[]}]}}),
                    ])
                }
                3 => {
                    self.turn = Some(required_id(&value["result"]["turn"]["id"])?);
                    self.events.push(AssistantStreamEvent::Started {
                        model: format!("{MODEL} · Codex subscription"),
                    });
                    Ok(vec![])
                }
                _ => Err("Unexpected response".into()),
            };
        }
        let method = value["method"]
            .as_str()
            .ok_or("Invalid protocol envelope")?;
        let params = &value["params"];
        // These two notifications can precede their corresponding RPC responses.
        if matches!(
            method,
            "thread/started"
                | "turn/started"
                | "thread/status/changed"
                | "thread/readState/changed"
        ) {
            return Ok(vec![]);
        }
        if let Some(thread) = params["threadId"].as_str() {
            if self.thread.as_deref() != Some(thread) {
                return Err("Mismatched thread".into());
            }
        }
        if let Some(turn) = params["turnId"].as_str() {
            if self.turn.as_deref() != Some(turn) {
                return Err("Mismatched turn".into());
            }
        }
        match method {
            "item/agentMessage/delta" => {
                if self.phase != 3
                    || params["threadId"].as_str() != self.thread.as_deref()
                    || params["turnId"].as_str() != self.turn.as_deref()
                {
                    return Err("Unscoped text delta".into());
                }
                let text = params["delta"].as_str().ok_or("Invalid text delta")?;
                if self.text.len() + text.len() > MAX_TEXT {
                    return Err("Text limit exceeded".into());
                }
                self.text.push_str(text);
                self.events
                    .push(AssistantStreamEvent::Delta { text: text.into() });
            }
            "item/started" | "item/completed" => {
                if !matches!(
                    params["item"]["type"].as_str(),
                    Some("agentMessage" | "userMessage" | "reasoning")
                ) {
                    return Err("Non-text item; turn stopped".into());
                }
            }
            "turn/completed" => {
                if self.phase != 3
                    || params["threadId"].as_str() != self.thread.as_deref()
                    || params["turn"]["id"].as_str() != self.turn.as_deref()
                {
                    return Err("Unscoped terminal result".into());
                }
                self.terminal = Some(match params["turn"]["status"].as_str() {
                    Some("completed") => End::Complete,
                    Some("interrupted") => End::Cancelled,
                    Some("failed") => classify_error(&params["turn"]["error"]),
                    _ => return Err("Invalid terminal status".into()),
                });
            }
            "error" => {
                self.terminal = Some(classify_error(&params["error"]));
            }
            "thread/tokenUsage/updated"
            | "account/rateLimits/updated"
            | "item/reasoning/summaryTextDelta"
            | "item/reasoning/textDelta"
            | "item/reasoning/summaryPartAdded" => {}
            _ => return Err("Unsupported protocol event; turn stopped".into()),
        }
        Ok(vec![])
    }
}
fn required_id(value: &Value) -> Result<String, String> {
    value
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 200)
        .map(str::to_owned)
        .ok_or("Invalid protocol identity".into())
}
fn classify_error(error: &Value) -> End {
    if matches!(
        error["codexErrorInfo"].as_str(),
        Some("usageLimitExceeded" | "rateLimitExceeded")
    ) {
        End::Limit
    } else {
        End::Error
    }
}
fn history_prompt(history: Vec<ChatTurn>) -> Result<String, String> {
    if history.is_empty()
        || history.len() > 40
        || history
            .iter()
            .map(|m| m.content.chars().count())
            .sum::<usize>()
            > 120_000
    {
        return Err("Subscription history exceeds the 40-message / 120,000-character bound. Start a shorter conversation.".into());
    }
    if history
        .iter()
        .any(|m| !matches!(m.role.as_str(), "user" | "assistant"))
        || history.last().is_none_or(|m| m.role != "user")
    {
        return Err("Invalid conversation roles".into());
    }
    let turns: Vec<_> = history
        .into_iter()
        .map(|m| json!({"role":m.role,"content":m.content}))
        .collect();
    Ok(format!("The following JSON is Olympus-owned conversation history. Respond to its latest user turn.\n{}",serde_json::to_string(&turns).map_err(|_|"Could not encode history")?))
}

/// Every production entry rejects before executable discovery or process launch.
/// Billing proof and app-server configuration isolation are not established.
fn authorize_launch() -> Result<(), String> {
    super::engines::require_generation_eligibility(&super::engines::SignIn::Unknown {
        detail: "No supported no-overage proof is available".into(),
    })?;
    Err("Codex app-server tool/config isolation is not verified. Nothing was started.".into())
}

struct CancelOnDrop(Arc<AtomicBool>);
impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        self.0.store(true, Ordering::Release);
    }
}
struct Process(Child);
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

pub async fn complete(
    history: Vec<ChatTurn>,
    voice: bool,
    on_event: tauri::ipc::Channel<AssistantStreamEvent>,
    cancel: tokio::sync::oneshot::Receiver<()>,
) -> Result<AssistantReply, String> {
    if voice {
        return Err("Subscription conversation currently supports text only.".into());
    }
    let prompt = history_prompt(history)?;
    authorize_launch()?;
    let executable = super::engines::codex_executable()?;
    let cancelled = Arc::new(AtomicBool::new(false));
    let _cancel = CancelOnDrop(cancelled.clone());
    let worker_cancel = cancelled.clone();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new(executable);
        super::delegation::allowed_environment(&mut command);
        super::delegation::hide_console(&mut command).args(["app-server", "--stdio"]);
        run_process(
            command,
            prompt,
            worker_cancel,
            |event| {
                let _ = on_event.send(event);
            },
            Duration::from_secs(240),
        )
    });
    await_worker(
        async {
            worker
                .await
                .map_err(|_| "Subscription worker failed".to_string())?
        },
        cancel,
        cancelled,
    )
    .await
}

/// Hold the existing active-turn guard until the worker has killed/reaped its child.
async fn await_worker<T>(
    work: impl std::future::Future<Output = Result<T, String>>,
    cancel: tokio::sync::oneshot::Receiver<()>,
    cancelled: Arc<AtomicBool>,
) -> Result<T, String> {
    match futures_util::future::select(Box::pin(work), Box::pin(cancel)).await {
        futures_util::future::Either::Left((result, _)) => result,
        futures_util::future::Either::Right((_, work)) => {
            cancelled.store(true, Ordering::Release);
            work.await
        }
    }
}

/// The same transport runs synthetic subprocesses in tests; no test bypass exists at IPC.
fn run_process(
    mut command: Command,
    prompt: String,
    cancelled: Arc<AtomicBool>,
    mut emit: impl FnMut(AssistantStreamEvent),
    limit: Duration,
) -> Result<AssistantReply, String> {
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = Process(
        command
            .spawn()
            .map_err(|_| "Could not start subscription process")?,
    );
    let mut input = child.0.stdin.take().ok_or("Missing process input")?;
    let output = child.0.stdout.take().ok_or("Missing process output")?;
    let (send, recv) = mpsc::sync_channel(16);
    // Writes can block if the child stops reading a large history payload.
    // Keep them off the cancellation loop; killing the child closes the pipe.
    let (writes, write_recv) = mpsc::sync_channel::<Value>(8);
    let write_errors = send.clone();
    let writer = std::thread::spawn(move || {
        while let Ok(frame) = write_recv.recv() {
            if let Err(error) = write_frame(&mut input, &frame) {
                let _ = write_errors.send(Err(error));
                break;
            }
        }
    });
    let reader = std::thread::spawn(move || {
        let mut stream = BufReader::new(output);
        loop {
            let mut bytes = Vec::new();
            let read = stream
                .by_ref()
                .take((MAX_FRAME + 1) as u64)
                .read_until(b'\n', &mut bytes);
            let frame = match read {
                Ok(0) => Err("Process ended before a terminal result".to_string()),
                Ok(_) if bytes.len() > MAX_FRAME => Err("Oversized protocol frame".to_string()),
                Ok(_) => serde_json::from_slice::<Value>(&bytes)
                    .map_err(|_| "Invalid protocol frame".into()),
                Err(_) => Err("Process stream failed".into()),
            };
            let bad = frame.is_err();
            if send.send(frame).is_err() || bad {
                break;
            }
        }
    });
    let mut protocol = Protocol::new(prompt);
    let start = Instant::now();
    let mut failure = None;
    let result = (|| -> Result<(), String> {
        queue_frame(&writes, Protocol::initialize())?;
        while protocol.terminal.is_none() {
            if cancelled.load(Ordering::Acquire) || start.elapsed() > limit {
                if let Some(interrupt) = protocol.interrupt() {
                    let _ = queue_frame(&writes, interrupt);
                }
                protocol.terminal = Some(End::Cancelled);
                break;
            }
            match recv.recv_timeout(Duration::from_millis(25)) {
                Ok(frame) => {
                    for reply in protocol.accept(frame?)? {
                        queue_frame(&writes, reply)?;
                    }
                    for event in protocol.events.drain(..) {
                        emit(event);
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("Process ended before a terminal result".into())
                }
            }
        }
        Ok(())
    })();
    if let Err(error) = result {
        failure = Some(error);
        protocol.terminal = Some(End::Error);
    }
    // Kill and reap even on malformed output, cancelled futures and complete turns.
    drop(writes);
    drop(child);
    drop(recv);
    let _ = writer.join();
    let _ = reader.join();
    let end = protocol.terminal.unwrap_or(End::Error);
    let message=match end {End::Complete=>None,End::Cancelled=>Some("Stopped. No fallback was attempted. Provider work already accepted may still count toward usage.".to_string()),End::Limit=>Some("Subscription limit reached. No retry, purchase or API fallback was attempted.".into()),End::Error=>Some(failure.unwrap_or_else(||"Subscription turn failed. No fallback was attempted.".into()))};
    if let Some(message) = &message {
        emit(AssistantStreamEvent::Progress {
            message: message.clone(),
        });
    }
    emit(AssistantStreamEvent::Ended {
        reason: match end {
            End::Complete => "completed",
            End::Cancelled => "cancelled",
            End::Limit => "limit",
            End::Error => "error",
        },
    });
    if let Some(message) = &message {
        if protocol.text.is_empty() {
            return Err(message.clone());
        }
    }
    Ok(AssistantReply {
        mail: vec![],
        request: None,
        voice: None,
        research: vec![],
        content: protocol.text,
        model: format!("{MODEL} · Codex subscription"),
        notice: message.map(|message| AssistantNotice {
            kind: "truncated",
            message,
        }),
        fell_back_from: None,
    })
}
fn write_frame(input: &mut impl Write, value: &Value) -> Result<(), String> {
    serde_json::to_writer(&mut *input, value).map_err(|_| "Process input failed")?;
    input
        .write_all(b"\n")
        .and_then(|_| input.flush())
        .map_err(|_| "Process input failed".into())
}
fn queue_frame(sender: &mpsc::SyncSender<Value>, frame: Value) -> Result<(), String> {
    sender
        .try_send(frame)
        .map_err(|_| "Process input queue unavailable".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn cancellation_waits_for_worker_cleanup() {
        tauri::async_runtime::block_on(async {
            let cancel_flag = Arc::new(AtomicBool::new(false));
            let done = Arc::new(AtomicBool::new(false));
            let done_worker = done.clone();
            let worker_flag = cancel_flag.clone();
            let (send, recv) = tokio::sync::oneshot::channel();
            send.send(()).unwrap();
            let work = async move {
                tokio::time::sleep(Duration::from_millis(25)).await;
                assert!(worker_flag.load(Ordering::Acquire));
                done_worker.store(true, Ordering::Release);
                Ok::<_, String>(())
            };
            await_worker(work, recv, cancel_flag).await.unwrap();
            assert!(done.load(Ordering::Acquire));
        });
    }
    #[cfg(windows)]
    fn fixture_command(tail: &str) -> Command {
        let mut command = Command::new(
            std::path::PathBuf::from(std::env::var_os("SystemRoot").unwrap())
                .join("System32/WindowsPowerShell/v1.0/powershell.exe"),
        );
        command.args(["-NoProfile","-NonInteractive","-Command",&format!(r#"
            $null=[Console]::ReadLine(); [Console]::WriteLine('{{"id":1,"result":{{}}}}');
            $null=[Console]::ReadLine(); $null=[Console]::ReadLine();
            [Console]::WriteLine('{{"id":2,"result":{{"thread":{{"id":"t"}},"model":"gpt-6.1-sol"}}}}');
            {tail}
        "#)]);
        command
    }
    #[cfg(windows)]
    #[test]
    fn synthetic_subprocess_success_limit_malformed_and_eof() {
        let start = r#"$null=[Console]::ReadLine(); [Console]::WriteLine('{"id":3,"result":{"turn":{"id":"u"}}}'); [Console]::WriteLine('{"method":"item/agentMessage/delta","params":{"threadId":"t","turnId":"u","delta":"hello"}}');"#;
        for (tail, notice) in [
            (
                r#"[Console]::WriteLine('{"method":"turn/completed","params":{"threadId":"t","turn":{"id":"u","status":"completed"}}}');"#,
                false,
            ),
            (
                r#"[Console]::WriteLine('{"method":"error","params":{"threadId":"t","turnId":"u","error":{"codexErrorInfo":"usageLimitExceeded"},"willRetry":true}}');"#,
                true,
            ),
            ("[Console]::WriteLine('malformed');", true),
            ("", true),
        ] {
            let elapsed = Instant::now();
            let mut events = vec![];
            let reply = run_process(
                fixture_command(&format!("{start}{tail}")),
                "hello".into(),
                Arc::new(AtomicBool::new(false)),
                |e| events.push(e),
                Duration::from_secs(10),
            )
            .unwrap();
            assert_eq!(reply.content, "hello");
            assert_eq!(reply.notice.is_some(), notice);
            assert!(reply.fell_back_from.is_none());
            assert!(events
                .iter()
                .any(|e| matches!(e,AssistantStreamEvent::Delta{text} if text=="hello")));
            let terminal = events
                .last()
                .map(|e| serde_json::to_value(e).unwrap())
                .unwrap();
            assert_eq!(terminal["kind"], "ended");
            assert_eq!(
                terminal["reason"],
                if notice {
                    if tail.contains("usageLimitExceeded") {
                        "limit"
                    } else {
                        "error"
                    }
                } else {
                    "completed"
                }
            );
            assert!(
                elapsed.elapsed() < Duration::from_secs(3),
                "EOF must terminate promptly"
            );
        }
    }
    #[cfg(windows)]
    #[test]
    fn stalled_subprocess_input_cannot_defeat_deadline() {
        let start = Instant::now();
        let result = run_process(
            fixture_command("Start-Sleep -Seconds 4"),
            "x".repeat(120000),
            Arc::new(AtomicBool::new(false)),
            |_| {},
            Duration::from_millis(700),
        );
        assert!(result.is_err());
        assert!(
            start.elapsed() < Duration::from_secs(3),
            "stalled stdin defeated cancellation deadline"
        );
    }
    #[test]
    fn explicit_provider_is_required_and_unknown_never_falls_back() {
        assert!(select_provider(None).is_err());
        assert!(select_provider(Some("typo")).is_err());
        assert_eq!(
            select_provider(Some("legacy-api")).unwrap(),
            Provider::LegacyApi
        );
        assert_eq!(select_provider(Some("codex")).unwrap(), Provider::Codex);
        assert!(select_provider(Some("claude-code")).is_err());
        assert!(authorize_launch().is_err());
    }
    fn ready() -> Protocol {
        let mut p = Protocol::new("history".into());
        p.accept(json!({"id":1,"result":{}})).unwrap();
        p.accept(json!({"id":2,"result":{"thread":{"id":"t"},"model":"gpt-6.1-sol"}}))
            .unwrap();
        p.accept(json!({"id":3,"result":{"turn":{"id":"u"}}}))
            .unwrap();
        p
    }
    #[test]
    fn status_notifications_are_not_tools_and_rerouting_is_rejected() {
        let mut p = ready();
        assert!(p.accept(json!({"method":"thread/status/changed","params":{"threadId":"t","status":{"type":"active"}}})).is_ok());
        assert!(p
            .accept(json!({"method":"model/rerouted","params":{"threadId":"t","turnId":"u"}}))
            .is_err());
    }
    #[test]
    fn handshake_is_ephemeral_and_forbids_model_fallback() {
        let mut p = Protocol::new("history".into());
        let out = p.accept(json!({"id":1,"result":{}})).unwrap();
        assert_eq!(out[1]["params"]["ephemeral"], true);
        assert_eq!(out[1]["params"]["allowProviderModelFallback"], false);
        assert_eq!(out[1]["params"]["environments"], json!([]));
        let out = p
            .accept(json!({"id":2,"result":{"thread":{"id":"t"},"model":"gpt-6.1-sol"}}))
            .unwrap();
        assert_eq!(out[0]["params"]["input"][0]["text"], "history");
    }
    #[test]
    fn streams_only_matching_text_and_finishes_once() {
        let mut p = ready();
        p.accept(json!({"method":"item/agentMessage/delta","params":{"threadId":"t","turnId":"u","delta":"Hello"}})).unwrap();
        assert_eq!(p.text, "Hello");
        p.accept(json!({"method":"turn/completed","params":{"threadId":"t","turn":{"id":"u","status":"completed"}}})).unwrap();
        assert_eq!(p.terminal, Some(End::Complete));
        assert!(p.accept(json!({"method":"item/agentMessage/delta","params":{"threadId":"t","turnId":"u","delta":"bad"}})).is_err());
    }
    #[test]
    fn mismatched_ids_and_tools_fail_closed() {
        assert!(ready().accept(json!({"method":"item/agentMessage/delta","params":{"threadId":"other","turnId":"u","delta":"bad"}})).is_err());
        assert!(ready()
            .accept(json!({"id":99,"method":"item/commandExecution/requestApproval","params":{}}))
            .is_err());
        assert!(ready().accept(json!({"method":"item/started","params":{"threadId":"t","turnId":"u","item":{"type":"commandExecution"}}})).is_err());
    }
    #[test]
    fn limit_preserves_text_and_does_not_retry() {
        let mut p = ready();
        p.text = "partial".into();
        let out=p.accept(json!({"method":"error","params":{"threadId":"t","turnId":"u","willRetry":true,"error":{"codexErrorInfo":"usageLimitExceeded"}}})).unwrap();
        assert!(out.is_empty());
        assert_eq!(p.terminal, Some(End::Limit));
        assert_eq!(p.text, "partial");
    }
    #[test]
    fn cancellation_can_interrupt_only_known_turn() {
        assert!(Protocol::new("x".into()).interrupt().is_none());
        assert_eq!(
            ready().interrupt().unwrap()["params"],
            json!({"threadId":"t","turnId":"u"})
        );
    }
    #[test]
    fn history_bounds_and_roles_are_enforced() {
        use super::super::assistant::ChatTurn;
        assert!(history_prompt(vec![ChatTurn {
            role: "system".into(),
            content: "override".into()
        }])
        .is_err());
        assert!(history_prompt(vec![ChatTurn {
            role: "user".into(),
            content: "x".repeat(120001)
        }])
        .is_err());
        assert!(history_prompt(vec![ChatTurn {
            role: "user".into(),
            content: "hello".into()
        }])
        .unwrap()
        .contains("hello"));
    }
}
