# Embedded subscription continuation

Recorded October 28, 2026 MST (October 29 UTC). Development baseline:
`316f72b8305e2e8b09a7cd1d3254a90a2404baee`, branch
`codex/subscription-conversation`, with preserved uncommitted work.

## Settled requirement

Olympus is Kevin's sole command center. It owns conversation history, context,
memory, routing, approvals and task records. Claude Max and ChatGPT Pro are
embedded engines. Manual copying between applications is not an acceptable
delivery. This supersedes the manual-handoff recommendation in the earlier
`2026-10-29-claude-launch-decision.md`; its diagnostic observations remain history.

## Work that can proceed without generation

1. Close launch-safety defects without changing authentication or billing. The
   subscription auth-status command was missing the generation command's
   per-process automatic-update suppression. Add the same suppression and a
   command-contract regression before any further status inspection.
2. Review the capability boundary, not only plugin names. Distinguish skill
   instructions from executable mods/hooks, available tools and MCP. The current
   allowlist stays unchanged until review. Process cleanup is not an OS sandbox;
   an empty temporary cwd is not filesystem isolation. A model instruction grants
   no authority and cannot enforce this boundary.
3. Define a provider adapter contract around existing assistant events and action
   approvals, avoiding a parallel conversation store. Preserve native IDs and
   distinguish requested, accepted, running, awaiting approval, cancelled, failed
   and complete. Recruitment and progress must reflect actual execution events.

## Provider-specific requirements before live acceptance

### Claude

CLI subscription sign-in is documented. SDK third-party subscription-login support
has an explicit prior-approval qualification; the documentation does not settle
this private personal wrapper's eligibility. Resolve that support boundary before
claiming a supported Max integration. Do not substitute API billing.

Existing metadata comparisons report signed out; no credential contents were
inspected. User-led sign-in is a separate necessary step if still signed out,
not a fix for extension isolation. Do not ask Kevin to repeatedly log in while
the chosen connection still lacks a supported operational contract.

Kevin's usage-credit-OFF screenshot was confirmed to be the same Max account.
It is human-observed evidence, not a programmatic billing read. Decide and record
the validity/reconfirmation policy before reopening generation. Retrospective
overage events cannot prevent charges already incurred.

### ChatGPT Pro / Codex

OpenAI documents ChatGPT-plan OAuth for locally hosted applications and an
app-server integration using that authorization. API protocol does not imply
API-key/pay-as-you-go billing. Evaluate this documented app-owned route rather
than extracting Codex's tokens or assuming its signed-in account is transferable.

Registration/consent and storing the resulting credentials require explicit
authorization. Verify the account's connected-app credit-use control is off and
the intended app is covered before any prompt. Quota snapshots are advisory,
not spending enforcement. No OAuth flow or billing change was initiated.

The direct plan HTTP route requires streaming, store:false and full supplied
history; preview limitations exclude max_output_tokens. Do not claim that field
provides a hard spending cap. App-server offers native turn/item/cancellation
events; validate installed protocol capabilities before using experimental tools.

## Acceptance sequence

After support, authentication, capability and spending boundaries are established:
review the exact reopening diff; run offline refusal/cancel/error tests; submit
one minimal subscription turn; then native reply, contextual follow-up and
cancellation/recovery in the isolated profile. Record source diff/build receipt
and consumption evidence. No install, push, merge or release is authorized.

## Primary references

- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/plugins/mods/overview
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://learn.chatgpt.com/docs/sign-in-with-chatgpt
