# Subscription conversation implementation plan

## Goal and constraints

Kevin wants Olympus conversation funded only by included Codex/Claude subscription
allowances. No paid credits, API fallback, account changes, credential extraction,
or production launch are authorized. Implementation and fixture verification are
authorized; delivery requires a separate approval. Preserve saved configuration.

## Design

One backend spending policy guards every paid generation boundary before reading
credentials or opening transport. It has no frontend boolean or environment bypass.
Subscription adapters are separate from paid API routes and from quota readers.
Each adapter owns bounded text history, process cleanup, streaming validation and
terminal events. Unknown billing eligibility rejects before process creation.
Read-only quota inspection remains available and cannot authorize generation.

The current provider research establishes no Codex per-request included-only
control. Claude documents disabling account usage credits; that effective account
control has not been verified. Estimated budgets and subscription auth are not
substitutes. Account settings are not changed by this work.

## Implementation sequence

- [x] Isolate branch from master 0.42.0 and inspect current CLI documentation.
- [x] Add spending_policy::require_approval(PaidOperation) and guard Responses,
  Anthropic messages, realtime credentials and ElevenLabs synthesis; ordinary chat
  also rejects before skill review. Background callers use guarded boundaries.
- [x] Add explicit Claude frontend routing alongside Codex; refuse subscription
  voice and prohibit API retries. Test selection and IPC behavior with fixtures.
- [x] Implement Claude stream-JSON adapter with strict text-only events, history
  bounds, cancellation and child cleanup. Reuse existing subscription validators.
- [x] Update Codex client version and verify protocol/terminal handling with
  synthetic frames; retain the unresolved billing/configuration-isolation gate.
- [x] Update readiness and feature documentation with exact remaining blockers.
- [x] Run affected frontend/browser and Rust tests, review paid-call coverage,
  and obtain independent review. Live acceptance only after supported hard
  billing controls and process isolation are established.

- [x] Claude only: replace the unconditional launch refusal with the operator's
  account-bound confirmation plus a per-turn live Max sign-in check
  (`SUBSCRIPTION-CONVERSATION.md`, "Claude launch gate"). Codex stays refused.
- [ ] One live Claude acceptance after `claude auth login`, then a native UI turn.

## Review focus

- Unknown or changed billing state must never become eligible from a quota value.
- A paid request must stop before credential lookup or transport creation.
- Unknown/tool/reroute events must terminate without retry or losing partial text.
- Cancellation must reap the owned child before releasing the active-turn slot.
- Startup and background settings remain saved but cannot bypass the policy.

## Verification limits

Fixture success is not provider acceptance. No model call or production launch is
part of the current verified evidence. Native acceptance and delivery remain
separate steps. Research evidence is retained locally under output/.

Final local verification: 583 Rust tests passed, 20 ignored (no live provider
tests); frontend build, subscription routing, engine quota fixtures/browser,
guidance checks and diff checks passed. Independent re-review found no remaining
actionable defect in spending receipts, stop reasons, empty replies or process
containment. Logs: `output/subscription-policy-rust-final.txt` and
`output/subscription-policy-build-final.txt`. Live acceptance remains blocked;
these are offline results, not evidence of working provider conversation.
