# Subscription text conversation

## Current generation boundary

Claude and Codex generation entry points fail closed before authorization lookup,
executable discovery or transport while pre-launch spending protection remains
unestablished. Account/usage inspection remains separate and available. Saved keys,
subscription sign-in, quota snapshots and historical confirmations do not open this
gate. There is no subscription-to-API fallback. Current dated evidence and remaining
acceptance steps are in `NEXT-SESSION.md`.

The UI retains explicit provider/model selection and shows blocked generation.
Olympus owns bounded history, memory and vault context. The existing Claude model
choices and adapters are retained for later verified reopening, not proof of current
native acceptance. The older Codex no-credit-snapshot eligibility implementation
cannot bypass the outer generation refusal.

## Claude isolation and account confirmation

The adapter selects the reviewed Claude executable version, uses a neutral temporary
working directory, a restricted environment with automatic CLI updates disabled,
safe/restricted CLI flags, empty tools
and MCP, and validates initialization metadata. Existing or unreadable managed file
and registry policy refuses launch. The account-bound operator confirmation lives in
backend-owned app data; signed-in claude.ai / firstParty / Max must match it. That
record is a user assertion, not a live provider observation of billing settings.
The separate subscription sign-in inspection also disables automatic CLI updates
in its child environment; inspection does not reopen the generation gate.

Only the previously approved `agents-md` and `telemetry` built-ins are accepted.
Any additional plugin, tool, MCP server, model mismatch or API-key source is refused.
The system/init inventory can arrive after prompt submission; rejecting it cannot
prove no provider work occurred. Official documentation says built-ins are omitted
from `plugin list`, so that read-only list is not sufficient preflight proof.

Successful result acceptance additionally requires rate-limit telemetry explicitly
showing no overage in use, overage rejected and organization-level disabled state.
Missing or ambiguous telemetry is not success. This check is retrospective; it does
not replace the pre-launch gate. Overage revokes the normal saved confirmation.

## Process and protocol ownership

Both adapters bound history, frames and output; reject unknown/tool/reroute events;
preserve partial text with explicit failure notices; and provide terminal events.
Codex item lifecycle events require the active thread and turn before acceptance;
missing identities cannot be treated as activity belonging to the current reply.
Windows children start suspended and enter a kill-on-close job before resuming.
Cancellation closes owned processes and reaps children before releasing the active
turn. It cannot undo provider work already accepted. Synthetic tests cover success,
malformed streams, EOF, blocked stdin and cancellation without calling providers.

## Background jobs and voice

The structured job runner retains Claude model routing for memory, email analysis,
reply drafts, inspection and research, but reports unavailable while Claude's outer
generation gate is closed. Codex fallback is removed. Paid OpenAI/Anthropic reasoning
and OpenAI realtime voice/transcription remain denied by the shared spending policy.

ElevenLabs retains its separate pre-request subscription check: usage-based billing
must be disabled and enough included characters must remain. Quota access and this
working integration are preserved. Opening briefings and speech use the same guarded
synthesis boundary. This work did not exercise real speech.

## Isolated native acceptance profile

The debug-only `com.projectolympus.claudeacceptance` identifier requires a fixture
profile. Explicit opt-in can read the existing production account confirmation;
it cannot copy, create, withdraw or delete that record. Overage revocation is local
to the acceptance process. Background model work, Gmail and speech are disabled.
The profile does not bypass either generation gate. The separate Tauri configuration
is `scripts/acceptance/tauri.claude-acceptance.json`. A prepared profile is not a
built, launched or accepted native app.

## Supported references

- [Claude plugin CLI](https://code.claude.com/docs/en/plugins/cli-reference)
- [Built-in plugins](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude usage and costs](https://code.claude.com/docs/en/costs)

Historical live successes and subsequent failures are retained in the archived
handoff. They do not establish present billing protection or native acceptance.
