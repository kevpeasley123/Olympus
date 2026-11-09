# Subscription text conversation

## Account and spending boundary

Codex and Claude Code reasoning use provider-owned CLI sign-in and an explicit
operator confirmation that paid extra usage and automatic credit purchases are
disabled. The confirmation is bound to account identity and can be withdrawn in
Engine Settings. It is an operator assertion, not a provider-enforced per-request
spending cap. Installing a CLI or signing in alone does not authorize generation.
Paid API reasoning remains denied; no subscription failure falls back to an API.

Codex reads the current account through its isolated app-server before each turn,
checks it against the saved identity, then checks available quota and credit state.
Changed accounts, unknown eligibility, exhausted allowance and unexpected billing
signals fail closed. Confirmation uses metadata only; Olympus does not copy the
provider's credentials.

Claude accepts a matching Pro or Max claude.ai / firstParty account with no API-key
source. It checks the reviewed executable and refuses managed policy that could
change isolation. The pre-prompt handshake must report the expected model and empty
tools, plugins and MCP inventory. Per-process settings disable bundled mods/skills
and hooks without changing the user's Claude configuration. Successful result
acceptance additionally requires explicit telemetry showing no overage in use and
organization-level disabled state. This retrospective check cannot undo provider
work already accepted and does not substitute for the operator's account setting.

## Process and protocol ownership

Adapters launch in a neutral directory with a restricted environment, validate
frames, bound output, reject tool/reroute requests and require terminal results.
Windows children enter a kill-on-close job before execution. Cancellation stops
owned processes; identity and source revalidation prevent canceled work from being
published. Actual model, selected provider, timing, usage and failure status are
recorded independently of the user's requested model.

Olympus owns conversation history and retrieved context. Provider-owned chat
history is not imported. Coding delegation is a separate capability with separate
eligibility checks; enabling subscription reasoning does not enable repository edits.

## Structured background work

`commands/execution.rs` selects exactly the requested Codex, Claude Code or local
adapter. `commands/subscription_jobs.rs` owns bounded subscription jobs and native
account checks. Gmail extraction uses its configured analysis provider; investigative
briefs use the saved briefing provider. Local transport lives outside Gmail in
`commands/local_inference.rs`, with task-specific model resolution in
`commands/inference_routes.rs`. Unknown or unavailable providers do not trigger
fallback. See `MODEL-ROUTING.md` and `BRIEFING-SYNTHESIS.md`.

Paid realtime voice/transcription remains denied. Local Whisper/Kokoro is independent
of subscription reasoning. ElevenLabs retains its separate included-character and
no-overage preflight; its account inspection remains available.

## Acceptance and legacy connection controller

Synthetic tests cover account mismatch, tool isolation, malformed streams, EOF,
cancellation and request provenance without mailbox access. Ignored live tests
require explicit opt-in and use synthetic prompts. Private briefing acceptance uses
a coherent database backup and writes artifacts outside the repository. Dated
production and desktop evidence belongs in `NEXT-SESSION.md` and review records.

The experimental ChatGPT-plan OAuth controller remains debug-testable but is not
shown in Engine Settings. Its connection and generation gates remain closed; it
is not the production Codex subscription route. The isolated Claude native test
profile also remains separate from production data and background work.
