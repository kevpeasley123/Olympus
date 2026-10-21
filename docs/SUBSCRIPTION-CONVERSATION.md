# Subscription text conversation

Unreleased safety and adapter work on `codex/subscription-conversation`, based on installed 0.42.0 (master `5d4c75dde61a9af00f8c9e4b64e8f1d3d341d7ef`). Live subscription generation remains disabled. No successful real-provider turn is claimed.

## Routing and history

Preferences > Subscription engines offers an explicit session-only conversation provider choice. No choice means no request. Codex subscription branches at the existing assistant command before skill review, repository enrichment, memory retrieval or paid API routing. Legacy API selection now reaches a backend spending denial before consuming skill approval or submitting a request. Saved provider settings remain intact. There is no subscription-to-API fallback. Claude subscription routing and an offline-tested process adapter are implemented; live Claude conversation and delegation remain blocked.

Olympus still stores and supplies the conversation. Each Codex turn starts a fresh ephemeral app-server thread, with the Olympus user/assistant history encoded as JSON in a text input. The current bound is 40 messages and 120,000 characters; oversized or invalid histories are refused rather than silently truncated. This slice uses conversation history and explicit attached text, not the legacy route's additional memory/source enrichment. Voice is refused on the subscription route.

## Protocol and process ownership

The wire fields were checked against schemas generated locally by installed `codex-cli 0.163.0-alpha.10.2`, without starting an inference session. The adapter uses initialize, thread/start, turn/start and best-effort turn/interrupt; requests `gpt-6.1-sol`, ephemeral history, read-only sandbox, no approvals, empty environments/dynamic tools/capability roots, and no provider model fallback. These settings are not proof that inherited tools or plugins are disabled.

Text deltas use the existing assistant channel. Completion, cancellation, limit and error have explicit terminal events. Unexpected server requests, non-text items, rerouting, malformed/oversized frames, missing terminal output and unknown events stop the turn without retry. Partial text is preserved with an app-level notice. Process stdin/stdout have separate bounded workers so a stalled child cannot hold the cancellation loop. Both adapters use a Windows process owner that starts suspended, assigns a kill-on-close job before resuming, and closes the job before joining pipe workers. Unsupported containment refuses launch. Every result kills the owned process tree and reaps the child; cooperative cancellation waits for cleanup before releasing the existing active-turn slot. Cancellation cannot promise reversal of provider work already accepted.

## Live blockers

The production launch gate rejects before executable discovery or process creation. No supported no-overage proof is wired. Independently, app-server tool/config isolation is unverified: this installed app-server does not expose exec's `--ignore-user-config` switch, and its schema says disabledPluginIds does not yet filter plugin capabilities. Removing only the billing refusal would still leave the isolation refusal. There is no UI override or test bypass at the IPC boundary.

Before enabling live acceptance, establish supported billing eligibility, configuration/tool isolation and exact executable/protocol version compatibility. Real authentication, stream event ordering, model availability, cancellation, limit events and billing behavior are unverified. Protocol tests use synthetic data, not recordings represented as real observations.

## Offline checks

`node scripts/test-subscription-selection.mjs` covers explicit choice, Codex IPC routing without API skill review, and no retry after refusal. Rust `subscription::tests` covers handshake, bounds, role validation, scoped events, limits, unexpected tools/reroutes, terminal events, cooperative cancellation, and synthetic PowerShell subprocess streams for success, malformed output, EOF and blocked stdin. The synthetic subprocesses do not execute Codex or call providers.

## Shared spending boundary (unreleased)

`commands/spending_policy.rs` denies paid generation before credential access or transport. It covers OpenAI Responses (including structured background memory and communications calls), Anthropic messages, realtime voice/transcription, and ElevenLabs synthesis. Read-only account quota requests remain available. There is no spending grant or UI override in this change.

## Claude adapter and billing evidence

The Claude adapter uses bounded stream-JSON parsing, validates model and session identity, rejects tools and unknown events, preserves partial output on failure, and uses the shared process-tree owner on cancellation. Token limits, refusals, empty replies and timeouts have explicit terminal handling. Tests use synthetic processes and fixtures. The pinned Sonnet 4.6 model identifier is not verified against this account; actual CLI event compatibility remains unverified.

Production rejects before executable discovery or launch. Claude's supported account-level restriction is disabling usage credits. Kevin has confirmed doing so; that is user-reported evidence, not independent visual verification. A zero balance, disabled auto-reload or estimated `--max-budget-usd` does not prove zero additional spending. Codex ChatGPT authentication likewise does not prohibit purchased-credit consumption, and no supported included-plan-only control has been verified for this account. Quota availability is not generation authorization.

## Authorized Claude acceptance attempt

An explicit ignored Rust test uses the real adapter command builder and transport,
without opening production IPC. The reviewed npm executable is 2.1.284; default
native discovery currently finds 2.1.74, which rejects `--safe-mode`. The isolated
auth preflight reports claude.ai, firstParty, Max. Managed file, registry and cached
remote policy checks found no policy. The single authorized attempt rejected the
initialization frame before accepting answer text. Its former generic error does
not establish which field differed or whether provider work had begun. No automatic
retry occurred; safe field/count diagnostics now distinguish future failures.

Response acceptance, real cancellation and fresh usage observation remain open.
The passive quota file was absent before and after; safe mode disables the normal
statusline. Production launch remains blocked until executable selection, protocol
acceptance and a durable operator authorization path are implemented and reviewed.

## Claude launch gate (Claude handoff, 2026-10-20)

Claude text chat now launches only when both hold at send time. First, the
operator has confirmed, in Preferences > Subscription engines, the exact
statement that Claude usage credits are off; the confirmation is written by a
dedicated backend command to a `claude-subscription-authorization` JSON file in the app
data folder, never to the webview-writable `settings` table, and binds the
claude.ai email and organization signed in at that moment. Second, a bounded
`auth status --json` taken under the chat's own isolation reports a logged-in
claude.ai, firstParty, Max account matching that record. A sign-out, another
account, an API-key or cloud-provider login, or a changed statement refuses the
turn before any prompt is written. Withdraw confirmation deletes the record.
Anthropic exposes no programmatic usage-credit check, so the confirmation is the
operator's word, not an observation. Codex chat and all delegation stay blocked.

On 2026-10-20 the CLI was found signed out (`loggedIn: false`, empty saved
sign-in, file last changed 2026-10-18 11:36, between Codex's two live attempts).
The later "metadata-only handshake" therefore ran signed out, so the handshake's
`tokenSource == "none"` expectation is unverified for a real Max sign-in; it fails
closed before any user message if it differs.

## Claude live acceptance and picker (2026-10-20)

After `claude auth login`, the Rust adapter returned exactly `OLYMPUS_OK` through
the Max sign-in for Opus 5.5, Sonnet 5.5, Fable 5.1 and Haiku 4.5
(`output/claude-live-*.txt`). Observed 2.1.284 behaviour now encoded: a signed-in
initialize reports `subscriptionType: "Claude Max"` and no `tokenSource`; init
reports `apiKeySource: "none"`; a `system/status` and a `rate_limit_event` arrive
per turn; Haiku names itself by dated snapshot. The rate-limit event reported
`overageStatus: rejected`, `overageDisabledReason: org_level_disabled`,
`isUsingOverage: false`: the first provider-side evidence that usage credits are
off. Any turn reporting overage in use or allowed stops and deletes the
confirmation. Built-in plugins `agents-md` and `telemetry` are tolerated (Kevin
approved); once, a third built-in, `plugin-authoring`, loaded and the turn was
refused. Tools and MCP servers must still be empty.

The chat's model picker now lists the four Claude models, and a disabled Codex row,
under "Subscriptions"; Sol, Astra and Claude API sit under "APIs". Was "Claude · Max
subscription" beside the API routes, with the confirmation inline. A Claude
choice is remembered across launches; an API choice never is. Native UI chat passed on
2026-10-20 22:32 in the dev build (Sonnet 5.5, typed, Auto Speak on): Kevin saw a
streamed answer. With Auto Speak on, subscription turns now send text only rather
than refusing. Still missing: project, memory and vault context, which only the
legacy route adds. About ten short test turns used included
Max allowance on 2026-10-20; none used API billing.

## Codex chat gate (2026-10-20, Kevin asked for Codex chat)

Codex still has no per-request "included allowance only" switch, so the adapter
uses what the account reports. Each turn first sends `account/rateLimits/read`;
the thread starts only if every snapshot shows `hasCredits: false`,
`unlimited: false`, a zero or absent balance, no spend control or limit reached,
and each window under 90% used. Any `account/rateLimits/updated` during the turn
showing credits, a limit, or a window at 100% stops it. This bounds, rather than
provably prevents, extra spend: a purchase or auto top-up made mid-turn could
still be drawn on before the update arrives. On 2026-10-20 the balance was 0
(it was 62.67 on 2026-10-17) and stayed 0 after the live turn.

The app server starts in an empty temporary folder with the credential-free
environment, every MCP server disabled, and these features disabled and verified
via `features list`: the quota reader's set plus shells, browsers, computer use,
image generation, view image, multi-agent, fast and ultrafast modes, tool suggest,
skill search, sleep, goals, local automation, workspace dependencies and
realtime. `unified_exec` cannot be switched off in codex-cli 0.163; with
`shell_tool` off it offers no shell. Any non-text item, server request, unknown
event, non-ChatGPT `account/updated`, or remote control other than `disabled`
stops the turn. Two warnings are tolerated: an unrecognized key in the user's own
Codex configuration file (observed: `computer_use.windows.always_allowed_app_ids`) and the
confirmation that code mode fails closed. One live turn returned `OLYMPUS_OK`
(`output/codex-live-acceptance-2026-10-20k.txt`). The picker lists Codex · GPT-6.1
Sol under Subscriptions. Kevin confirmed a native dev-build Codex chat on
2026-10-20. Codex delegation stays blocked.
