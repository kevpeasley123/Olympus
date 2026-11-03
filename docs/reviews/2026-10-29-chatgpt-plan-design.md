# Olympus ChatGPT-plan connection: bounded design for approval

October 28 MST / October 29 UTC. Proposed authentication change, not implemented.
Baseline `316f72b8305e2e8b09a7cd1d3254a90a2404baee` plus preserved working diff.

## Decision requested

Approve adding Olympus-owned Sign in with ChatGPT authorization to the existing
Codex app-server adapter. This adds protected credential ownership and renewal to
Olympus; it does not replace conversation storage, the UI, the action controller,
or the Claude adapter. Implementation and offline tests come first. Browser consent,
account-setting changes and live acceptance remain separate explicit actions.

Alternative: keep relying on Codex's existing login. That is less code, but no
included-only control has been verified for that route, and connected-app credit
controls cannot be assumed to apply to the Codex app's own login. Recommended:
the documented app-owned grant, because attribution and consent identify Olympus.

## Existing adapter versus required contract

| Boundary | Existing code in commands/subscription.rs | Proposed connection |
| --- | --- | --- |
| Identity | CLI account; modelProvider=openai | Validated Olympus-issued OAuth registration; modelProvider=openai_chatgpt_plan |
| Launch | app-server --stdio plus isolation overrides | Verify installed CLI supports --listen stdio:// and documented provider config; preserve isolation overrides |
| Credentials | No app-owned token | Backend protected token store; access token only in owned child's environment, never argv/UI/logs |
| Initialization | olympus + version, experimentalApi | Add title Olympus; stable app identity matches registration; request only required capabilities |
| Spending | Historical zero-credit snapshot heuristic, behind unconditional denial | Provider connected-app credit control verified before first inference; quota never substitutes for it |
| History | Olympus bounded history/context; ephemeral thread each turn | Retain this model initially; no provider-owned canonical history or background resumption |
| Events | Started, deltas, terminal status; interrupt + process cleanup | Reuse; enforce thread/turn identity on item lifecycle; no invented progress |
| Recovery | Fail without fallback | Auth/consent/limit errors remain distinct; no automatic generation retry after ambiguous submission |

The current rateLimits preflight assumes Codex-owned ChatGPT auth. A custom provider
using an Olympus token may not expose that same account reader. Do not reuse it as
proof of grant or spend protection, and do not remove it from the current route.
Implement the new route explicitly behind the closed outer generation gate.

## Bounded implementation

1. Add backend-only account connection state and OAuth flow using the existing
   native browser/loopback and credential-store patterns where suitable. Persist
   one opaque stable host ID. Per attempt: random state/nonce, PKCE S256, exact
   127.0.0.1 callback URI, bounded listener lifetime, one-use callback.
2. Validate callback state, issued client ID, token signature/issuer/audience,
   expiry/nonce and granted plan-use scope. Never treat identity-only login as plan
   authorization. Store each issued client ID with its validated subject. Keep
   pending attempts separate; never replace another account on a failed callback.
3. Store tokens in Windows Credential Manager, with non-secret registration
   metadata in app-local storage. Serialize refreshes; clear/revoke only this
   Olympus session on explicit disconnect. Do not read Codex credential files.
4. Supply the new access token to app-server's child environment under the
   documented custom Responses provider. Keep API-key variables excluded. Do not
   persist provider overrides in the user's Codex configuration. Pin/verify CLI
   capabilities; fail if the required isolation contract is unsupported.
5. Expose connection status in existing Subscription engines settings. Preserve
   UI identity. Connect is not Send. Keep live generation disabled until the
   spending verification below is satisfied and a reopening diff is reviewed.

Offline tests: state mismatch/replay, denial, missing issued client ID, wrong
audience/nonce/signature/identity, missing scope, refresh serialization, redaction,
account separation, cancellation before submission, scoped events, token expiry,
unknown spending state and no fallback. Use fixture tokens/local test keys only.
No real grant or model response is needed to build and verify these boundaries.

## Exact later user actions (not performed)

1. In the prepared Olympus build, choose Continue with ChatGPT. The browser must
   be OpenAI's authorization page and identify the new client as Olympus. Select
   Kevin's Pro account and approve Use your ChatGPT plan. This shares identity and
   plan-use authority, not existing ChatGPT conversations or memories.
2. In that same account's ChatGPT Settings > Usage > App limits, verify Olympus
   appears, select the intended weekly percentage cap, and verify "Allow other
   apps to use credits after reaching your usage limit" is OFF. If it is ON,
   stop: changing it affects connected apps and requires Kevin's explicit action.
   Do not infer this state from zero usage, credit balance or an OAuth scope.
3. Record the account/client association, source and observation time. Before the
   first minimal request, review the displayed configuration. No generation is
   triggered by connecting or viewing usage. Disconnect is available through
   ChatGPT Settings > Security and login > Sign in with ChatGPT > Olympus.

The docs expose a provider setting but no verified machine-readable endpoint for
its current value. Thus unattended per-turn verification remains unresolved. An
explicit user-confirmed session with invalidation on account/grant change is a
possible policy, not an implemented guarantee. If hard automated verification is
required, keep generation blocked until a supported reader/control exists.

## Claude: corrected suitability conclusion

The Agent SDK overview restricts third-party products offering claude.ai login
without prior approval. The fuller legal/compliance document also explicitly
permits an end user signing into an unmodified Claude Code binary with their own
subscription, including when a platform hosts it. It describes ordinary individual
Claude Code/Agent SDK usage in subscription limits. Those statements are materially
different from a blanket prohibition on embedding.

Olympus's candidate personal CLI adapter uses the unmodified binary and its own
native authentication flow; Olympus must not collect/intermediate Claude tokens,
impersonate a first-party client, resell access or implement a substitute login.
This is the supported direction to evaluate, rather than buying API access by
default. The documentation does not conclusively classify this exact wrapper;
distributing a product or routing on behalf of other users changes the scope and
requires a separate support/terms decision. No legal assurance is claimed.

Technical blockers remain independently: current sign-out, version-specific
capability isolation, and fresh pre-launch overage-off evidence. Missing plugin
inventory alone does not establish impossibility. No further auth probe or model
request was made for this design.

## Sources

- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://learn.chatgpt.com/docs/sign-in-with-chatgpt
- https://learn.chatgpt.com/docs/app-server
- https://code.claude.com/docs/en/legal-and-compliance
- https://code.claude.com/docs/en/agent-sdk/overview
