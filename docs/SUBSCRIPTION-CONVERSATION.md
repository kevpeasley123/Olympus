# Subscription text conversation

Unreleased offline implementation on `codex/engine-status-usage`. Live subscription generation remains disabled. No successful real-provider turn is claimed.

## Routing and history

Preferences > Subscription engines offers an explicit session-only conversation provider choice. No choice means no request. Codex subscription branches at the existing assistant command before skill review, repository enrichment, memory retrieval or paid API routing. Legacy API remains available only after an explicit choice; its existing model picker and provider behavior are unchanged. There is no subscription-to-API fallback. Claude subscription conversation is not implemented; Claude delegation remains blocked.

Olympus still stores and supplies the conversation. Each Codex turn starts a fresh ephemeral app-server thread, with the Olympus user/assistant history encoded as JSON in a text input. The current bound is 40 messages and 120,000 characters; oversized or invalid histories are refused rather than silently truncated. This slice uses conversation history and explicit attached text, not the legacy route's additional memory/source enrichment. Voice is refused on the subscription route.

## Protocol and process ownership

The wire fields were checked against schemas generated locally by installed `codex-cli 0.163.0-alpha.10.2`, without starting an inference session. The adapter uses initialize, thread/start, turn/start and best-effort turn/interrupt; requests `gpt-6.1-sol`, ephemeral history, read-only sandbox, no approvals, empty environments/dynamic tools/capability roots, and no provider model fallback. These settings are not proof that inherited tools or plugins are disabled.

Text deltas use the existing assistant channel. Completion, cancellation, limit and error have explicit terminal events. Unexpected server requests, non-text items, rerouting, malformed/oversized frames, missing terminal output and unknown events stop the turn without retry. Partial text is preserved with an app-level notice. Process stdin/stdout have separate bounded workers so a stalled child cannot hold the cancellation loop. Every result kills and reaps the child; cooperative cancellation waits for cleanup before releasing the existing active-turn slot. Cancellation cannot promise reversal of provider work already accepted.

## Live blockers

The production launch gate rejects before executable discovery or process creation. No supported no-overage proof is wired. Independently, app-server tool/config isolation is unverified: this installed app-server does not expose exec's `--ignore-user-config` switch, and its schema says disabledPluginIds does not yet filter plugin capabilities. Removing only the billing refusal would still leave the isolation refusal. There is no UI override or test bypass at the IPC boundary.

Before enabling live acceptance, establish supported billing eligibility, configuration/tool isolation and exact executable/protocol version compatibility. Real authentication, stream event ordering, model availability, cancellation, limit events and billing behavior are unverified. Protocol tests use synthetic data, not recordings represented as real observations.

## Offline checks

`node scripts/test-subscription-selection.mjs` covers explicit choice, Codex IPC routing without API skill review, and no retry after refusal. Rust `subscription::tests` covers handshake, bounds, role validation, scoped events, limits, unexpected tools/reroutes, terminal events, cooperative cancellation, and synthetic PowerShell subprocess streams for success, malformed output, EOF and blocked stdin. The synthetic subprocesses do not execute Codex or call providers.
