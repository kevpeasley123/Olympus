use std::time::Duration;

use serde::{Deserialize, Serialize};

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
    pub next_step: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantContext {
    pub vault_path: String,
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

#[derive(Debug, Deserialize)]
struct StopDetails {
    #[serde(default)]
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    #[serde(default)]
    content: Vec<ContentBlock>,
    #[serde(default)]
    stop_reason: Option<String>,
    #[serde(default)]
    stop_details: Option<StopDetails>,
    #[serde(default)]
    model: Option<String>,
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
         state. Treat the vault notes as authoritative about their preferences, standing \
         instructions, and how this system is meant to work — they are the operator's own words, \
         not suggestions. Use them when relevant and ignore them when they are not.\n\n\
         You cannot read files or run commands. The research library is listed as an index of \
         titles and metadata only; the entry bodies are not in your context. If answering well \
         needs the contents of an entry, name the entry you would need rather than inventing what \
         it says. If you do not know something, say so rather than guessing.\n\n",
    );

    if memory.stable.is_empty() {
        prompt.push_str(
            "## Durable memory\n\nThe vault's System notes could not be read this turn.\n",
        );
        return prompt;
    }

    prompt.push_str("## Durable memory (Obsidian vault)\n\n");
    prompt.push_str(&memory.stable);
    prompt
}

/// The volatile half: everything that can change between turns. Rendered after
/// the cache breakpoint so a new commit or a new research entry cannot
/// invalidate the cached prefix.
fn build_volatile_system(context: &AssistantContext, memory: &VaultMemory) -> String {
    let mut prompt = String::from("## Environment\n\n");
    prompt.push_str(&format!("- Obsidian vault: {}\n", context.vault_path));
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
            "- {} — status {}, branch {}, repo {}. Next: {}\n",
            project.name, project.status, project.branch, project.repo_state, project.next_step
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

fn extract_text(blocks: &[ContentBlock]) -> String {
    blocks
        .iter()
        .filter(|block| block.block_type == "text")
        .filter_map(|block| block.text.as_deref())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

#[tauri::command]
pub async fn send_assistant_message(
    history: Vec<ChatTurn>,
    context: AssistantContext,
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
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read the Anthropic response: {error}"))?;

    if !status.is_success() {
        // Surface the API's own message — it names the offending field, which is
        // far more useful than a generic failure.
        let detail = serde_json::from_str::<ApiErrorEnvelope>(&body)
            .map(|envelope| format!("{}: {}", envelope.error.error_type, envelope.error.message))
            .unwrap_or_else(|_| body.chars().take(400).collect());
        return Err(format!("Anthropic API error ({status}). {detail}"));
    }

    let parsed: AnthropicResponse = serde_json::from_str(&body)
        .map_err(|error| format!("Could not parse the Anthropic response: {error}"))?;

    // A refusal is a successful HTTP 200 with empty or partial content, so this
    // has to be checked before reading the content blocks.
    if parsed.stop_reason.as_deref() == Some("refusal") {
        let category = parsed
            .stop_details
            .and_then(|details| details.category)
            .unwrap_or_else(|| "unspecified".to_string());
        return Err(format!(
            "That request was declined by Anthropic's safety classifiers (category: {category})."
        ));
    }

    let content = extract_text(&parsed.content);

    if content.is_empty() {
        return Err(format!(
            "The model returned no text (stop reason: {}).",
            parsed.stop_reason.as_deref().unwrap_or("unknown")
        ));
    }

    Ok(AssistantReply {
        content,
        model: parsed.model.unwrap_or_else(|| MODEL.to_string()),
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

    #[test]
    fn skips_thinking_blocks_when_extracting_text() {
        let blocks = vec![
            ContentBlock {
                block_type: "thinking".to_string(),
                text: None,
            },
            ContentBlock {
                block_type: "text".to_string(),
                text: Some("  the answer  ".to_string()),
            },
        ];

        assert_eq!(extract_text(&blocks), "the answer");
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
        };

        let json: serde_json::Value = serde_json::to_value(&payload).unwrap();

        assert_eq!(json["model"], "claude-opus-5");
        assert_eq!(json["output_config"]["effort"], EFFORT);
        assert_eq!(json["fallbacks"], "default");
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["system"][0]["type"], "text");

        for rejected in ["temperature", "top_p", "top_k", "budget_tokens", "thinking", "effort"] {
            assert!(
                json.get(rejected).is_none(),
                "`{rejected}` must not be sent to {MODEL}"
            );
        }
    }

    /// A refusal arrives as HTTP 200 with no text block, so the parser must not
    /// treat the empty content array as a malformed response.
    #[test]
    fn parses_a_refusal_response() {
        let parsed: AnthropicResponse = serde_json::from_str(
            r#"{"content":[],"stop_reason":"refusal","stop_details":{"type":"refusal","category":"cyber"},"model":"claude-opus-5"}"#,
        )
        .unwrap();

        assert_eq!(parsed.stop_reason.as_deref(), Some("refusal"));
        assert_eq!(parsed.stop_details.unwrap().category.as_deref(), Some("cyber"));
        assert!(extract_text(&parsed.content).is_empty());
    }

    fn context_fixture() -> AssistantContext {
        AssistantContext {
            vault_path: "C:/vault".to_string(),
            projects_root_path: "C:/projects".to_string(),
            projects: vec![ProjectSummary {
                name: "Olympus".to_string(),
                status: "active".to_string(),
                branch: "main".to_string(),
                repo_state: "git-active".to_string(),
                next_step: "wire the chat panel".to_string(),
            }],
        }
    }

    #[test]
    fn system_prompt_lists_tracked_projects() {
        let prompt = build_volatile_system(&context_fixture(), &VaultMemory::default());

        assert!(prompt.contains("C:/vault"));
        assert!(prompt.contains("Olympus"));
        assert!(prompt.contains("wire the chat panel"));
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
            pantheon_index: "- \"Some entry\" — talk, 2026-04-28, ~900 words".to_string(),
        };
        let blocks = build_system_blocks(&context_fixture(), &memory);

        assert!(blocks[0].text.contains("Prefers dense interfaces"));
        assert!(!blocks[0].text.contains("Some entry"));
        assert!(!blocks[0].text.contains("git-active"));

        assert!(blocks[1].text.contains("Some entry"));
        assert!(blocks[1].text.contains("git-active"));
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
