# Olympus model routing

Approved architecture, implemented 2026-09-08. The Olympus identity, project truth, local conversation, curated memory, voice answer contract and execution approval gates remain shared.

## Routes

`src-tauri/src/commands/models.rs` is the only production model-ID catalog:

| Capability | Provider / model | Effort |
|---|---|---|
| PRIMARY | OpenAI gpt-6-sol | medium |
| DEEP_REASONING | OpenAI gpt-6-astra | high |
| CLAUDE_COMPARISON | Anthropic claude-opus-5 | medium |
| Realtime speech | OpenAI gpt-realtime-2.1 | n/a |
| Transcription | OpenAI gpt-4o-mini-transcribe | n/a |
| Delegated code execution | Claude Code sonnet | existing driver |

Next answer selects a single request, then resets to PRIMARY, including on failure. Voice turns use the same selector and reasoning path. No automatic cross-provider retry or recursive escalation exists. The existing Anthropic-specific fallback metadata remains scoped to explicit comparison.

The GPT-6 migration changes the shared PRIMARY route from GPT-5.6 Sol to GPT-6 Sol, preserving medium effort. Communication Intelligence v3, situation discovery/briefings and on-demand reply drafts also resolve PRIMARY. Astra remains explicit Deep Analysis at high effort. Speech, transcription and Claude Code use their separate routes. No prompt or execution-authority changes accompany this model update.

## API boundary

`assistant.rs` builds the existing identity, bounded local history, vault memory and project/research context. `responses.rs` sends Responses requests with `store: false`, explicit effort and `reasoning.context: current_turn`; no provider-side conversation ID or reasoning history is persisted. The existing structured voice answer is requested using strict `text.format` JSON schema. Only existing navigation actions are parsed; this adds no execution tools.

The SSE decoder handles UTF-8 chunk boundaries, actual model metadata, text deltas, completion, refusal, incomplete output and transport interruption. Partial text has a truncation notice; partial structured voice JSON is rejected. Errors remain visible without silently changing providers.

## Diagnostics and persistence

SQLite `model_requests` stores prompt-free request records: requested/actual model, provider, capability/purpose, effort, timestamp, total and first-token latency, status, reported usage, error code, escalation reason and fallback source when reported. Unknown actual models are labelled requested/unconfirmed. Requests interrupted by application restart are marked accordingly.

`conversation_model` binds a persisted assistant message to an existing backend request ID. The browser cannot fabricate the stored model metadata. Messages and project context retain their existing persistence paths. Preferences → Model diagnostics shows the latest 100 records. Clearing visible conversation removes message links but retains diagnostic records.

Realtime credential creation is recorded by Rust. Audio, previews and input transcription report bounded client telemetry, with model identity explicitly unconfirmed and client-reported purpose labels. Token usage is stored only when supplied by the API; terminal audio event ordering can leave usage unavailable. No per-request dollar estimate is fabricated. Diagnostics are local and may grow over time; no retention policy is introduced here.

## GPT-6 migration verification — 2026-09-23

Source baseline: 0.18.0, commit `cb25daf`, Olympus Memory Worktree. The installed executable also reports 0.18.0; binary/source equivalence was not established.

- Frontend production build passed, with output outside OneDrive. Existing buffer externalization, eval and bundle-size warnings remain.
- Rust regression suite: 317 passed, zero failed, two paid tests ignored in the offline suite. This includes a new regression for nested streaming provider error codes.
- The pre-migration `live_olympus_behavior` baseline failed on its first request. After migration, `live_openai_routes` also failed on its first GPT-6 Sol text request, so its Astra and structured voice checks did not run.
- A minimal synthetic diagnostic received HTTP 200 followed by a streaming `error` and `response.failed`, identifying `credit_balance_exhausted`. No successful model completion, quality comparison, latency comparison, or cost comparison is claimed. The adapter now retains nested `error.code` instead of reporting only `response_failed`.
- No installed-app update, version bump, database migration or production-data API evaluation was performed. Changes remain a release candidate pending live acceptance.

After restoring API credits, run `cargo test --lib --manifest-path src-tauri/Cargo.toml live_openai_routes -- --ignored --nocapture` and the same command with `live_olympus_behavior`. Complete synthetic communications assessment/briefing/draft checks and desktop acceptance for provenance after restart and one-request Deep Analysis reset. Compare against the previous model using the baseline revision in isolation. Only then prepare the versioned installer and preserve the previous installer/database backup before updating the installed app. Rollback is the prior installer or reverting the PRIMARY catalog change; historical model provenance must remain intact.

## Historical verification — 0.9.0

- Production TypeScript/Vite build; 211 Rust tests passed, two paid tests ignored by default.
- Both paid suites were run separately: three live adapter checks (Sol, Astra, Sol structured voice), and five shared Olympus prompt scenarios with synthetic project/research data (role, attention/next move, source citation, allowed navigation, voice continuity).
- Local HTTP 401 test confirms no provider switch. Streaming/refusal/truncation, route closure, backend provenance and existing authorization regressions pass.
- The automated console fixture in the in-app browser did not pass its initial focus/open-transcript check; it is not counted as passing. Native desktop checks are recorded separately.
- 55 frontend voice protocol checks and model selector/diagnostics browser fixture passed. Physical microphone and listening quality still require operator acceptance.

## Future changes

Update the backend catalog, route tests and this table together. Verify current official model/API documentation and live account access before changing IDs or effort. Do not reuse Anthropic request options in Responses. Do not put model IDs in UI components or permit arbitrary frontend model names.

Official references: [GPT-6 migration](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart), [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
