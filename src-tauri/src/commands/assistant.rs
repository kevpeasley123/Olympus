use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::get_vault_path;
use super::vault_context::{load_vault_memory, VaultMemory};

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
/// Routes a declined request to Anthropic's recommended fallback model rather
/// than surfacing the refusal.
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
const MODEL: &str = "claude-opus-5";
const MAX_TOKENS: u32 = 8_000;
const EFFORT: &str = "medium";
/// Bounds cost and latency as a conversation grows. The vault, not the message
/// log, is the long-term memory.
const MAX_HISTORY_MESSAGES: usize = 40;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub name: String,
    pub status: String,
    pub branch: String,
    pub repo_state: String,
    #[serde(default)]
    pub vision: String,
    #[serde(default)]
    pub last_commit: String,
    pub next_step: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantContext {
    pub projects_root_path: String,
    #[serde(default)]
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Deserialize)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantReply {
    pub content: String,
    /// The model that actually answered — differs from MODEL when a fallback served the turn.
    pub model: String,
    /// Set when the turn ended for a reason the operator needs to know about.
    ///
    /// **Appended, never substituted.** Text that streamed is text that happened
    /// (and was billed); retracting it would leave the operator unable to tell a
    /// misread from a broken app. `content` always holds everything that
    /// arrived, and this rides alongside it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notice: Option<AssistantNotice>,
    /// The model that declined, when a mid-stream fallback changed who was
    /// answering. `None` on an ordinary turn.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fell_back_from: Option<String>,
}

/// An app-level statement about the turn, never model-generated prose.
///
/// It carries a `kind` rather than pre-composed wording so the webview owns
/// presentation — the point is that it must not look like something the
/// assistant said.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantNotice {
    /// `refusal` | `truncated`
    pub kind: &'static str,
    pub message: String,
}

#[derive(Debug, Serialize)]
struct ApiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OutputConfig {
    effort: &'static str,
}

#[derive(Debug, Serialize)]
struct CacheControl {
    #[serde(rename = "type")]
    control_type: &'static str,
}

impl CacheControl {
    fn ephemeral() -> Self {
        Self {
            control_type: "ephemeral",
        }
    }
}

/// The system prompt is sent as blocks rather than one string so a cache
/// breakpoint can be placed between the stable and volatile halves.
#[derive(Debug, Serialize)]
struct SystemBlock {
    #[serde(rename = "type")]
    block_type: &'static str,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<CacheControl>,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: &'static str,
    max_tokens: u32,
    system: Vec<SystemBlock>,
    messages: Vec<ApiMessage>,
    output_config: OutputConfig,
    fallbacks: &'static str,
    /// The whole reason this path exists. Without it the response arrives as one
    /// complete body and there is no moment at which text *starts* — which is
    /// the moment the omega's speaking state is derived from.
    ///
    /// **This does not touch prompt caching.** Caching is a prefix match over
    /// the rendered `system` and `messages`; `stream` is a transport flag and is
    /// not part of that prefix. The stable/volatile split and the breakpoint
    /// between them are unchanged.
    stream: bool,
}

/// Permissive on purpose: responses carry `thinking` and `fallback` blocks
/// alongside `text`, and unknown block types must not break parsing.
#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    #[serde(default)]
    text: Option<String>,
}

/// One decoded SSE event. Permissive by construction: the wire carries event
/// types this app does not read (`content_block_stop`, `ping`, and whatever ships
/// next), and an unknown `type` must be skipped rather than fail the turn.
///
/// **The nesting is `delta.type`, not a flat field.** A text chunk is
/// `content_block_delta` → `delta: {type: "text_delta", text: "..."}`; thinking is
/// the same envelope with `thinking_delta`. Matching on the outer type alone
/// cannot tell them apart, and on this model that distinction is the entire
/// signal — see `StreamOutcome::first_text_at`.
#[derive(Debug, Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    message: Option<StreamMessage>,
    #[serde(default)]
    content_block: Option<ContentBlock>,
    #[serde(default)]
    delta: Option<StreamDelta>,
}

/// The `message_start` envelope. Names the model that is actually answering —
/// which is not necessarily `MODEL`, because the request carries a server-side
/// fallback header.
#[derive(Debug, Deserialize)]
struct StreamMessage {
    #[serde(default)]
    model: Option<String>,
}

/// Carries both the incremental content (`content_block_delta`) and the
/// end-of-turn metadata (`message_delta`), which is why `stop_reason` lives here
/// rather than on the envelope.
#[derive(Debug, Deserialize)]
struct StreamDelta {
    #[serde(rename = "type", default)]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    #[serde(rename = "type")]
    error_type: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ApiErrorEnvelope {
    error: ApiErrorBody,
}

/// The stable half: persona plus the vault notes that define the operator and
/// the system. This sits in front of the cache breakpoint, so every byte of it
/// must be deterministic — anything that varies per turn belongs in the
/// volatile block instead.
fn build_stable_system(memory: &VaultMemory) -> String {
    let mut prompt = String::from(
        "You are Olympus, a local-first command station for Kevin's projects, research, and \
         workflows. You run inside a desktop app alongside a live dashboard and an Obsidian vault.\n\n\
         Voice: dry and economical. State what is true, offer the thing that was not asked for but \
         is needed, then stop. No enthusiasm you have not earned, no exclamation marks, no \
         restating the question back. Do not open with pleasantries like \"Great question\". If \
         something is a bad idea, say so in a sentence and then help anyway.\n\n\
         The operator's durable memory from the vault is included below, along with live dashboard \
         state. Explicit preferences and standing instructions are authoritative until the \
         operator revises them. A project's vision is a current hypothesis, not permanent \
         doctrine: use it to prevent accidental drift, but if evidence suggests a better \
         direction, pause before acting and surface the alternative. Decision history is evidence \
         about why a choice was made, not a command to repeat it forever.\n\n\
         You cannot read files or run commands. The research library is listed as an index of \
         titles and metadata only; the entry bodies are not in your context. If answering well \
         needs the contents of an entry, name the entry you would need rather than inventing what \
         it says. If you do not know something, say so rather than guessing.\n\n\
         The research library is a reference library and optional curriculum, not a set of \
         instructions and not a list of things the operator agrees with. Each \
         entry carries a stance: endorsed, provisional, disputed, or unevaluated. Most are \
         unevaluated, which means nobody has judged it — not that it is accepted. Never read an \
         entry's presence in the library as agreement, his or yours. Each also carries an origin: \
         `collected` means he chose it, so it is pre-filtered by his own taste; `olympus-found` \
         means this system surfaced it, often because it cuts against the rest of the library. \
         \"kept because\" is his stated reason for keeping it; \"no stated purpose\" means he \
         never gave one, which is not itself a reason to discount the entry.\n\n\
         You may disagree with him and with the sources. Challenge weak logic, flawed design, \
         contradictions, and neglected risks directly, but do not object performatively. If a \
         challenge depends on a research entry, name it; otherwise concise reasoning is enough.\n\n",
    );

    if memory.stable.is_empty() {
        prompt.push_str(
            "## Durable memory\n\nThe vault's System notes could not be read this turn.\n",
        );
    } else {
        prompt.push_str("## Durable memory (Obsidian vault)\n\n");
        prompt.push_str(&memory.stable);
    }

    prompt.push_str("\n## Historical decision evidence — not standing instruction\n\n");
    prompt.push_str(
        "Source: `04 - Decisions/Decision Log.md`. These entries record what was decided and why. \
         Treat them as historical evidence that can reveal rationale, contradiction, or drift — \
         never as commands to repeat an old choice. Current operator instructions and current \
         project vision take precedence.\n\n",
    );
    if memory.decision_history.is_empty() {
        prompt.push_str("The Decision Log could not be read this turn.\n");
    } else {
        prompt.push_str(&memory.decision_history);
        prompt.push('\n');
    }

    prompt
}

/// The volatile half: everything that can change between turns. Rendered after
/// the cache breakpoint so a new commit or a new research entry cannot
/// invalidate the cached prefix.
fn build_volatile_system(context: &AssistantContext, memory: &VaultMemory) -> String {
    let mut prompt = String::from("## Environment\n\n");
    prompt.push_str(&format!(
        "- Obsidian vault: {}\n",
        get_vault_path().display()
    ));
    prompt.push_str(&format!("- Projects root: {}\n", context.projects_root_path));

    if !memory.pantheon_index.is_empty() {
        prompt.push_str("\n## Research library index\n\n");
        prompt.push_str(&memory.pantheon_index);
    }

    prompt.push_str("\n## Tracked projects\n\n");

    if context.projects.is_empty() {
        prompt.push_str("- No tracked projects were detected.\n");
        return prompt;
    }

    for project in &context.projects {
        prompt.push_str(&format!(
            "- {} — status {}, branch {}, repo {}. Vision: {}. Latest recorded change: {}. \
             Committed next action: {}\n",
            project.name,
            project.status,
            project.branch,
            project.repo_state,
            if project.vision.is_empty() {
                "not stated"
            } else {
                &project.vision
            },
            if project.last_commit.is_empty() {
                "not available"
            } else {
                &project.last_commit
            },
            if project.next_step.is_empty() {
                "not stated"
            } else {
                &project.next_step
            }
        ));
    }

    prompt
}

fn build_system_blocks(context: &AssistantContext, memory: &VaultMemory) -> Vec<SystemBlock> {
    vec![
        SystemBlock {
            block_type: "text",
            text: build_stable_system(memory),
            cache_control: Some(CacheControl::ephemeral()),
        },
        SystemBlock {
            block_type: "text",
            text: build_volatile_system(context, memory),
            cache_control: None,
        },
    ]
}

/// The API requires the first message to be from the user, and accepts only
/// user/assistant roles. Seeded system and assistant turns are dropped rather
/// than rewritten so nothing is put in the operator's mouth.
fn prepare_messages(history: Vec<ChatTurn>) -> Vec<ApiMessage> {
    let mut messages: Vec<ApiMessage> = history
        .into_iter()
        .filter(|turn| turn.role == "user" || turn.role == "assistant")
        .filter(|turn| !turn.content.trim().is_empty())
        .map(|turn| ApiMessage {
            role: turn.role,
            content: turn.content,
        })
        .collect();

    if messages.len() > MAX_HISTORY_MESSAGES {
        messages.drain(..messages.len() - MAX_HISTORY_MESSAGES);
    }

    let first_user = messages.iter().position(|message| message.role == "user");
    match first_user {
        Some(index) => {
            messages.drain(..index);
            messages
        }
        None => Vec::new(),
    }
}

fn api_key() -> Result<String, String> {
    match std::env::var("ANTHROPIC_API_KEY") {
        Ok(key) if !key.trim().is_empty() => Ok(key.trim().to_string()),
        _ => Err(
            "No ANTHROPIC_API_KEY found. Add it to the .env file in the Olympus project root, \
             then restart the app."
                .to_string(),
        ),
    }
}

/// Splits an SSE byte stream into complete `data:` payloads.
///
/// **The hazard this exists to close is the chunk boundary.** Bytes arrive in
/// whatever sizes the transport chooses, so a single JSON event is routinely
/// split across two reads — and parsing a half-object yields a decode error that
/// looks exactly like a malformed API response. Only whole lines are ever
/// handed on, so a partial line waits in the buffer for the rest of itself.
///
/// `event:` lines are ignored on purpose: the Anthropic wire format repeats the
/// type inside the `data:` JSON, so reading one source rather than two removes a
/// way for them to disagree.
#[derive(Debug, Default)]
struct SseDecoder {
    buffer: String,
}

impl SseDecoder {
    fn push(&mut self, chunk: &str) -> Vec<String> {
        self.buffer.push_str(chunk);
        let mut payloads = Vec::new();

        while let Some(index) = self.buffer.find('\n') {
            let line: String = self.buffer.drain(..=index).collect();
            let line = line.trim_end_matches(['\n', '\r']);

            if let Some(rest) = line.strip_prefix("data:") {
                let payload = rest.trim();
                if !payload.is_empty() {
                    payloads.push(payload.to_string());
                }
            }
        }

        payloads
    }
}

/// Everything the turn produced, assembled from the event stream.
#[derive(Debug, Default)]
struct StreamOutcome {
    text: String,
    model: Option<String>,
    stop_reason: Option<String>,
    /// Set when a `fallback` content block appeared, naming the model that
    /// declined. On a stream this block is the *complete* signal — sticky
    /// routing is not consulted for streaming requests, so there is no second
    /// channel to reconcile against.
    fell_back_from: Option<String>,
    /// Index of the first `text_delta`, counted in events. Non-`None` means the
    /// turn reached the speaking state.
    first_text_event: Option<usize>,
    events_seen: usize,
}

/// Folds one decoded event into the outcome.
///
/// **Only `text_delta` contributes to the reply.** A `thinking_delta` is
/// deliberately dropped: `display` is left at its default of `omitted`, so those
/// deltas carry empty text anyway, and treating them as content would put the
/// model's reasoning into the transcript. The distinction lives in `delta.type`,
/// not the event type — both arrive as `content_block_delta`.
fn apply_stream_event(outcome: &mut StreamOutcome, event: &StreamEvent) {
    outcome.events_seen += 1;

    match event.event_type.as_str() {
        "message_start" => {
            if let Some(model) = event.message.as_ref().and_then(|m| m.model.clone()) {
                // A pre-output fallback means this names the *second* model; the
                // first one never got to open a message.
                outcome.model = Some(model);
            }
        }
        "content_block_start" => {
            // A fallback arrives as an ordinary content block, not a distinct SSE
            // event type. Nothing announces it but this.
            if let Some(block) = event.content_block.as_ref() {
                if block.block_type == "fallback" {
                    outcome.fell_back_from = outcome.model.clone();
                }
            }
        }
        "content_block_delta" => {
            let Some(delta) = event.delta.as_ref() else {
                return;
            };
            if delta.delta_type.as_deref() != Some("text_delta") {
                return;
            }
            if let Some(text) = delta.text.as_deref() {
                if outcome.first_text_event.is_none() && !text.is_empty() {
                    outcome.first_text_event = Some(outcome.events_seen);
                }
                outcome.text.push_str(text);
            }
        }
        "message_delta" => {
            if let Some(reason) = event.delta.as_ref().and_then(|d| d.stop_reason.clone()) {
                outcome.stop_reason = Some(reason);
            }
        }
        _ => {}
    }
}

/// Derives the app-level notice, if the turn earned one.
///
/// Returns `None` for an ordinary completion. A refusal or a token-limit stop
/// produces a notice *beside* the text rather than replacing it.
fn notice_for(stop_reason: Option<&str>, text: &str) -> Option<AssistantNotice> {
    match stop_reason {
        Some("refusal") if !text.is_empty() => Some(AssistantNotice {
            kind: "refusal",
            message: "Anthropic's safety classifiers stopped this response partway. \
                      What appears above is what was produced before it stopped."
                .to_string(),
        }),
        Some("max_tokens") => Some(AssistantNotice {
            kind: "truncated",
            message: "Response stopped at the token limit. It is incomplete.".to_string(),
        }),
        _ => None,
    }
}

/// What the webview receives while the turn is in flight.
///
/// A per-invocation `Channel` rather than a global Tauri event: two chat requests
/// can never interleave on it, so there is no request id to filter on and no way
/// to get that filtering wrong.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum AssistantStreamEvent {
    /// The turn opened. `model` is who is actually answering.
    Started { model: String },
    /// Text arrived. **The first of these is the speaking signal** — it is the
    /// moment `producing` becomes true for the omega.
    Delta { text: String },
    /// A mid-turn handoff. Both models are named because the readout shows the
    /// transition rather than silently swapping one value for the other.
    FellBack { from: String, to: String },
}

#[tauri::command]
pub async fn send_assistant_message(
    history: Vec<ChatTurn>,
    context: AssistantContext,
    on_event: tauri::ipc::Channel<AssistantStreamEvent>,
) -> Result<AssistantReply, String> {
    let key = api_key()?;
    let messages = prepare_messages(history);

    if messages.is_empty() {
        return Err("There is no conversation to send yet.".to_string());
    }

    // Reading the vault walks the filesystem, so it goes to the blocking pool
    // rather than the event loop.
    let memory = tauri::async_runtime::spawn_blocking(load_vault_memory)
        .await
        .map_err(|error| format!("Vault context task panicked: {error}"))?;

    let payload = AnthropicRequest {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: build_system_blocks(&context, &memory),
        messages,
        output_config: OutputConfig { effort: EFFORT },
        fallbacks: "default",
        stream: true,
    };

    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("Could not build the HTTP client: {error}"))?;

    let response = client
        .post(ANTHROPIC_URL)
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("anthropic-beta", FALLBACK_BETA)
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Could not reach the Anthropic API: {error}"))?;

    let status = response.status();

    // An error response is an ordinary JSON body, not a stream — read it whole.
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        // Surface the API's own message — it names the offending field, which is
        // far more useful than a generic failure.
        let detail = serde_json::from_str::<ApiErrorEnvelope>(&body)
            .map(|envelope| format!("{}: {}", envelope.error.error_type, envelope.error.message))
            .unwrap_or_else(|_| body.chars().take(400).collect());
        return Err(format!("Anthropic API error ({status}). {detail}"));
    }

    let mut decoder = SseDecoder::default();
    let mut outcome = StreamOutcome::default();
    let mut announced_model: Option<String> = None;
    let mut stream = response.bytes_stream();
    let started = std::time::Instant::now();
    let mut first_text_at: Option<std::time::Duration> = None;

    while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await {
        let chunk = chunk.map_err(|error| format!("The response stream failed: {error}"))?;
        let text = String::from_utf8_lossy(&chunk).into_owned();

        for payload in decoder.push(&text) {
            // An event this build does not model must not end the turn — the wire
            // format gains types faster than this file does.
            let Ok(event) = serde_json::from_str::<StreamEvent>(&payload) else {
                continue;
            };

            let had_text = outcome.first_text_event.is_some();
            let fell_back_before = outcome.fell_back_from.is_some();
            apply_stream_event(&mut outcome, &event);

            if announced_model.is_none() {
                if let Some(model) = outcome.model.clone() {
                    announced_model = Some(model.clone());
                    on_event.send(AssistantStreamEvent::Started { model }).ok();
                }
            }

            if !fell_back_before {
                if let Some(from) = outcome.fell_back_from.clone() {
                    // The block names no successor, so the model that follows it is
                    // whatever `message_start` already gave us.
                    let to = outcome.model.clone().unwrap_or_else(|| MODEL.to_string());
                    on_event.send(AssistantStreamEvent::FellBack { from, to }).ok();
                }
            }

            if !had_text && outcome.first_text_event.is_some() {
                first_text_at = Some(started.elapsed());
            }

            if event.event_type == "content_block_delta" {
                if let Some(text) = event
                    .delta
                    .as_ref()
                    .filter(|d| d.delta_type.as_deref() == Some("text_delta"))
                    .and_then(|d| d.text.clone())
                {
                    on_event.send(AssistantStreamEvent::Delta { text }).ok();
                }
            }
        }
    }

    let content = outcome.text.trim().to_string();

    // Nothing streamed. There is no output to preserve, so an error is the honest
    // surface — the append-never-retract rule applies to text that *arrived*.
    if content.is_empty() {
        return match outcome.stop_reason.as_deref() {
            Some("refusal") => Err(
                "That request was declined by Anthropic's safety classifiers before any \
                 text was produced."
                    .to_string(),
            ),
            other => Err(format!(
                "The model returned no text (stop reason: {}).",
                other.unwrap_or("unknown")
            )),
        };
    }

    // Speaking-state timing, logged rather than tuned. The floor question — whether
    // a short reply flashes the state — should be decided from this distribution,
    // not from an impression of one reply.
    if let Some(first) = first_text_at {
        eprintln!(
            "[Olympus::Assistant] speaking window {}ms (first text at {}ms of {}ms total, {} events)",
            started.elapsed().saturating_sub(first).as_millis(),
            first.as_millis(),
            started.elapsed().as_millis(),
            outcome.events_seen
        );
    }

    Ok(AssistantReply {
        notice: notice_for(outcome.stop_reason.as_deref(), &content),
        content,
        model: outcome.model.unwrap_or_else(|| MODEL.to_string()),
        fell_back_from: outcome.fell_back_from,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(role: &str, content: &str) -> ChatTurn {
        ChatTurn {
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    #[test]
    fn drops_seeded_system_and_leading_assistant_turns() {
        let prepared = prepare_messages(vec![
            turn("system", "command-center mode"),
            turn("assistant", "seeded greeting"),
            turn("user", "hello"),
            turn("assistant", "hi"),
        ]);

        assert_eq!(prepared.len(), 2);
        assert_eq!(prepared[0].role, "user");
        assert_eq!(prepared[0].content, "hello");
    }

    #[test]
    fn returns_empty_when_no_user_turn_exists() {
        let prepared = prepare_messages(vec![
            turn("system", "command-center mode"),
            turn("assistant", "seeded greeting"),
        ]);

        assert!(prepared.is_empty());
    }

    #[test]
    fn trims_history_but_still_starts_on_a_user_turn() {
        let mut history = vec![turn("system", "seed")];
        for index in 0..60 {
            history.push(turn("user", &format!("q{index}")));
            history.push(turn("assistant", &format!("a{index}")));
        }

        let prepared = prepare_messages(history);

        assert!(prepared.len() <= MAX_HISTORY_MESSAGES);
        assert_eq!(prepared[0].role, "user");
    }

    /// Feeds a whole SSE transcript through the decoder in one push.
    fn drain(transcript: &str) -> StreamOutcome {
        let mut decoder = SseDecoder::default();
        let mut outcome = StreamOutcome::default();
        for payload in decoder.push(transcript) {
            let event: StreamEvent = serde_json::from_str(&payload).unwrap();
            apply_stream_event(&mut outcome, &event);
        }
        outcome
    }

    /// Replaces the old `skips_thinking_blocks_when_extracting_text`, which
    /// tested a whole-body parser that no longer exists. The property is the
    /// same and it now runs against the code that actually ships: only
    /// `text_delta` reaches the transcript.
    ///
    /// **[V] The transcript below is the real wire shape, captured from the live
    /// API on 2026-07-30 — and it is not what the reference implies.** At
    /// `display: "omitted"` a thinking block emits **`signature_delta`**, not
    /// `thinking_delta`; no `thinking_delta` arrives at all. A test written from
    /// the reference alone would have asserted exclusion of an event this
    /// configuration never sends. Both are covered here: `signature_delta`
    /// because it is what actually arrives, `thinking_delta` because it would if
    /// `display` were ever changed.
    #[test]
    fn thinking_deltas_never_reach_the_reply() {
        let outcome = drain(concat!(
            "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"thinking\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"signature_delta\",\"signature\":\"abc123\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"secret reasoning\"}}\n\n",
            "data: {\"type\":\"content_block_stop\"}\n\n",
            "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"text\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"the answer\"}}\n\n",
        ));

        assert_eq!(outcome.text, "the answer");
        assert!(
            !outcome.text.contains("secret") && !outcome.text.contains("abc123"),
            "a non-text delta leaked into the reply"
        );
    }

    /// **[V] Captured live on 2026-07-30.** A trivial prompt skips the thinking
    /// block entirely — `message_start` goes straight to a text block — while a
    /// substantive one opens thinking first. The speaking signal has to be
    /// correct in both shapes, and in the first there is no thinking block for it
    /// to be confused by.
    #[test]
    fn a_reply_with_no_thinking_block_still_reports_its_first_text() {
        let outcome = drain(concat!(
            "data: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-opus-5\"}}\n\n",
            "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"text\"}}\n\n",
            "data: {\"type\":\"ping\"}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"ready\"}}\n\n",
            "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"}}\n\n",
        ));

        assert_eq!(outcome.first_text_event, Some(4));
        assert_eq!(outcome.text, "ready");
        assert_eq!(outcome.stop_reason.as_deref(), Some("end_turn"));
    }

    /// **The speaking signal is the first `text_delta`, not the first event.**
    /// A thinking block opens first and `message_start` precedes everything, so
    /// deriving `producing` from either would fire during the thinking phase and
    /// collapse the two states into one.
    #[test]
    fn speaking_starts_at_the_first_text_delta_not_before() {
        let outcome = drain(concat!(
            "data: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-opus-5\"}}\n\n",
            "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"thinking\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"\"}}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"hi\"}}\n\n",
        ));

        assert_eq!(
            outcome.first_text_event,
            Some(4),
            "speaking must begin on the text delta, not on message_start or the thinking block"
        );
    }

    /// The chunk boundary is the whole reason the decoder buffers. A JSON object
    /// split mid-object must not be parsed, and must not be lost.
    #[test]
    fn a_json_event_split_across_chunks_survives() {
        let mut decoder = SseDecoder::default();

        assert!(
            decoder.push("data: {\"type\":\"content_bl").is_empty(),
            "a partial line must yield nothing"
        );
        assert!(
            decoder
                .push("ock_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"ok\"}}")
                .is_empty(),
            "a line without its newline is still incomplete"
        );

        let payloads = decoder.push("\n\n");
        assert_eq!(payloads.len(), 1, "the completed line must emerge exactly once");

        let event: StreamEvent = serde_json::from_str(&payloads[0]).unwrap();
        assert_eq!(event.delta.unwrap().text.as_deref(), Some("ok"));
    }

    /// Replaces `parses_a_refusal_response`. A refusal now arrives as a
    /// `stop_reason` on `message_delta`, *after* text may already have streamed —
    /// so the notice is appended beside that text rather than replacing it.
    #[test]
    fn a_refusal_after_partial_text_keeps_the_text_and_adds_a_notice() {
        let outcome = drain(concat!(
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"partial answer\"}}\n\n",
            "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"refusal\"}}\n\n",
        ));

        assert_eq!(outcome.stop_reason.as_deref(), Some("refusal"));
        assert_eq!(outcome.text, "partial answer");

        let notice = notice_for(outcome.stop_reason.as_deref(), &outcome.text)
            .expect("a refusal with text must produce a notice");
        assert_eq!(notice.kind, "refusal");
    }

    /// A refusal that produced nothing has no text to preserve, so there is
    /// nothing for a notice to sit beside — the command errors instead.
    #[test]
    fn a_refusal_with_no_text_produces_no_notice() {
        assert!(notice_for(Some("refusal"), "").is_none());
    }

    #[test]
    fn a_token_limit_stop_is_a_distinct_notice_from_a_refusal() {
        let truncated = notice_for(Some("max_tokens"), "partial").unwrap();
        assert_eq!(truncated.kind, "truncated");
        assert!(
            !truncated.message.to_lowercase().contains("declin"),
            "a token-limit stop must not read as a refusal"
        );
        assert!(notice_for(Some("end_turn"), "all done").is_none());
    }

    /// A fallback is announced by an ordinary content block, not its own event
    /// type — nothing else on the stream marks the handoff.
    #[test]
    fn a_fallback_content_block_records_the_model_that_declined() {
        let outcome = drain(concat!(
            "data: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-opus-5\"}}\n\n",
            "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"fallback\"}}\n\n",
        ));

        assert_eq!(outcome.fell_back_from.as_deref(), Some("claude-opus-5"));
    }

    /// The wire format outruns this file. An unmodelled event type must be inert,
    /// not fatal.
    #[test]
    fn unknown_event_types_are_ignored_rather_than_fatal() {
        let outcome = drain(concat!(
            "data: {\"type\":\"ping\"}\n\n",
            "data: {\"type\":\"some_future_event\",\"whatever\":1}\n\n",
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"still here\"}}\n\n",
        ));

        assert_eq!(outcome.text, "still here");
    }

    /// The request body cannot be verified against the live API from CI, so the
    /// shape is pinned here instead. `temperature`, `top_p`, `top_k`, and
    /// `budget_tokens` are all rejected with a 400 on this model, and `effort`
    /// must be nested inside `output_config` rather than sent top-level.
    #[test]
    fn request_payload_matches_the_model_contract() {
        let payload = AnthropicRequest {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: build_system_blocks(&context_fixture(), &VaultMemory::default()),
            messages: vec![ApiMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
            }],
            output_config: OutputConfig { effort: EFFORT },
            fallbacks: "default",
            stream: true,
        };

        let json: serde_json::Value = serde_json::to_value(&payload).unwrap();

        assert_eq!(json["model"], "claude-opus-5");
        assert_eq!(json["output_config"]["effort"], EFFORT);
        assert_eq!(json["fallbacks"], "default");
        assert_eq!(json["stream"], true);
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["system"][0]["type"], "text");

        // **Equality on the field set, not a subset check.** A denylist of known-
        // rejected keys only catches the fields someone thought to name; a new
        // top-level field would slip in unpinned, which is the floor-assertion
        // failure wearing different clothes. Adding a field to the payload must
        // fail here and be justified.
        let mut sent: Vec<&str> = json
            .as_object()
            .expect("payload must serialize to an object")
            .keys()
            .map(String::as_str)
            .collect();
        sent.sort_unstable();

        assert_eq!(
            sent,
            vec![
                "fallbacks",
                "max_tokens",
                "messages",
                "model",
                "output_config",
                "stream",
                "system",
            ],
            "the payload's field set changed; confirm the new field is accepted by {MODEL} \
             before pinning it here"
        );
    }

    fn context_fixture() -> AssistantContext {
        AssistantContext {
            projects_root_path: "C:/projects".to_string(),
            projects: vec![ProjectSummary {
                name: "Olympus".to_string(),
                status: "active".to_string(),
                branch: "main".to_string(),
                repo_state: "git-active".to_string(),
                vision: "Keep project state trustworthy.".to_string(),
                last_commit: "abc123 Add live project scanning".to_string(),
                next_step: "wire the chat panel".to_string(),
            }],
        }
    }

    #[test]
    fn system_prompt_lists_tracked_projects() {
        let prompt = build_volatile_system(&context_fixture(), &VaultMemory::default());

        assert!(prompt.contains("C:/projects"));
        assert!(prompt.contains("Olympus"));
        assert!(prompt.contains("wire the chat panel"));
    }

    /// The vault path is Rust's to know. If it ever comes back from the caller,
    /// the app has two sources of truth for where the vault lives again.
    #[test]
    fn vault_path_in_the_prompt_comes_from_rust() {
        let prompt = build_volatile_system(&context_fixture(), &VaultMemory::default());

        assert!(prompt.contains(&get_vault_path().display().to_string()));
    }

    /// Caching is a prefix match, so the breakpoint must sit on the stable block
    /// and the volatile block must carry no marker. If these move, every turn
    /// pays a full cache write instead of a read.
    #[test]
    fn only_the_stable_block_carries_the_cache_breakpoint() {
        let blocks = build_system_blocks(&context_fixture(), &VaultMemory::default());
        let json: serde_json::Value = serde_json::to_value(&blocks).unwrap();

        assert_eq!(blocks.len(), 2);
        assert_eq!(json[0]["cache_control"]["type"], "ephemeral");
        assert!(json[1].get("cache_control").is_none());
    }

    /// Git state and the research index change between turns. Keeping them out
    /// of the cached block is what makes the breakpoint worth having.
    #[test]
    fn volatile_state_stays_out_of_the_cached_block() {
        let memory = VaultMemory {
            stable: "### Operator profile\n\nPrefers dense interfaces.".to_string(),
            decision_history: "## 2026-08-04\nChose evidence over instruction.".to_string(),
            pantheon_index: "- \"Some entry\" — talk, 2026-04-28, ~900 words".to_string(),
        };
        let blocks = build_system_blocks(&context_fixture(), &memory);

        assert!(blocks[0].text.contains("Prefers dense interfaces"));
        assert!(blocks[0].text.contains("Chose evidence over instruction"));
        assert!(!blocks[0].text.contains("Some entry"));
        assert!(!blocks[0].text.contains("git-active"));

        assert!(!blocks[1].text.contains("Chose evidence over instruction"));
        assert!(blocks[1].text.contains("Some entry"));
        assert!(blocks[1].text.contains("git-active"));
    }

    #[test]
    fn decision_history_is_labelled_as_evidence_below_current_direction() {
        let memory = VaultMemory {
            decision_history: "## Old choice\nUse the first design forever.".to_string(),
            ..VaultMemory::default()
        };

        let prompt = build_stable_system(&memory);

        assert!(prompt.contains("Historical decision evidence — not standing instruction"));
        assert!(prompt.contains("04 - Decisions/Decision Log.md"));
        assert!(prompt.contains("historical evidence"));
        assert!(prompt.contains("never as commands to repeat an old choice"));
        assert!(
            prompt.contains(
                "Current operator instructions and current project vision take precedence"
            )
        );
        assert!(prompt.contains("Use the first design forever"));
    }

    /// The index lists titles without bodies, which invites the model to invent
    /// contents. The instruction against that must survive prompt edits.
    #[test]
    fn stable_prompt_warns_against_inventing_entry_contents() {
        let prompt = build_stable_system(&VaultMemory::default());

        assert!(prompt.contains("titles and metadata only"));
        assert!(prompt.contains("rather than inventing"));
    }
}
