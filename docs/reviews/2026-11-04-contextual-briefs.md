# Contextual briefing implementation and remaining architecture

## Engineering choice under the delegated implementation request

The current fallback reads subjects and selected facts. Rewording alone cannot
produce the cross-domain reasoning Kevin wants. Enabling an unqualified provider
would violate the existing gates. This isolated change therefore improves evidence
selection/reconciliation now and wires a bounded, fail-closed synthesis route.
Neither synthetic outputs nor deterministic heuristics qualify live intelligence.

The target across domains is: identify a consequential change, connect it to relevant
current context as a hypothesis when necessary, state what is unknown, and ask one
useful question or explain the next safe verification step. An operator's explicit
resolution must prevent the same concern being repeatedly presented. It does not
authorize unrelated actions or create a general preference.

## What this branch implements

- Concise deterministic shipment updates; explicit same-thread/order reconciliation;
  routine receipt/confirmation filtering; current ETA handling; action prioritization.
- Bounded native message history instead of only the latest message per thread.
- Generic recurring-instruction change signals without inferring account linkage,
  instruction identity, financial obligation or permission to transact.
- Gated native synthesis with bounded source IDs/revisions, actual model provenance,
  structured uncertainty/actions and no provider fallback.
- Scoped remembered and operator-confirmed context distinct from source facts.
  Context-only evidence may inform a headline but cannot alone generate one.
- Frontend revision validation, protected operator corrections, preserved uncertainty,
  selective display receipts, and current-source checks before display.

Fictional tests use an account-service change and studio dues. They test packet
authority, missing linkage, explicit resolution and suppression without storing
Kevin's private account details or his confirmation in live data.

## Concrete gaps before the desired experience is qualified

1. **Inference availability:** Claude/Codex pre-launch spending/provider-isolation
   protection is still unqualified. The command refuses before request recording,
   credential lookup or inference. No live analysis was performed.
2. **Context retrieval:** a bounded selection and a few learned summaries are not a
   complete relationship or obligation graph. Richer retrieval must distinguish
   current commitments, user statements, remembered summaries and model hypotheses.
   Shared names or temporal proximity cannot establish a causal relationship.
3. **Semantic verification:** schema validation and existing citations prove shape
   and source membership, not that prose is supported. A qualification set must
   test contradiction, missing dates/amounts/identity, stale context, prompt injection,
   multiple similar accounts/orders, and requests for unnecessary action.
4. **Resolution lifecycle:** existing source-bound corrections can supply context.
   General cross-thread resolution needs explicit concern IDs, source links, scope,
   freshness, supersession and reopen conditions. A meaningful new change may reopen
   a concern; a routine retry or refreshed timestamp must not. No live resolution
   record was created from the conversation's example.
5. **Privacy and authority:** retrieve only necessary local evidence; keep credentials
   and unrelated mail out of prompts. Respect memory opt-out/temporary scope and
   deletion. Provider disclosure requires the existing approved route. Retrieved
   messages are untrusted evidence, never instructions. A brief never sends mail,
   changes an account or schedules a transaction.
6. **Runtime verification:** installed-build tests must verify actual invocation,
   gated failure, source invalidation during analysis, display receipts, useful
   spoken brevity, and consent/spending protections. None is established by a mock.

Acceptance must evaluate usefulness as well as accuracy: concise prioritized
synthesis, appropriate uncertainty, one pertinent clarification, no unsupported
linkage or compensating action, and silence after a resolved concern absent new
evidence. Shipping and fictional account-change cases are examples, not a list of
vendor-specific rules. Communications UI work remains in its separate session.
