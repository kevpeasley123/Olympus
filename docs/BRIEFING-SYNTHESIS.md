# Source-grounded briefing synthesis

Olympus has two distinct synthesis entry points. The aggregate `briefing_synthesize`
route accepts renderer-selected evidence and remains closed behind the subscription
spending and native-source qualification gates. Installing a CLI or signing in does
not open that route or authorize paid inference.

The local route uses `briefing_local_prepare` followed by `briefing_local`. It is
available only when the operator has configured `OLYMPUS_EMAIL_ANALYSIS_PROVIDER`
as `ollama` and an installed local `OLYMPUS_EMAIL_MODEL`. Optional `OLYMPUS_BRIEF_MODEL`
selects a separate installed local model for the shorter opening-brief packet. It uses the same fixed
loopback transport as local email understanding, with proxies and redirects disabled,
cloud-backed model tags rejected, and no model download or paid-provider fallback.

## Source selection and lifecycle

Preparation establishes a native saved conversation under the current operator
session and returns a generation ticket. The renderer checks that its conversation
is still active before dispatching. Generation requires that same native ticket;
revocation, another conversation, or a later lifecycle transition invalidates it.
The async generation command cannot grant scope itself. Temporary chats do not use
this persisted route.

Mail is loaded from the native cache, never from renderer-provided prose. Account,
read-only scope, sync freshness, message identity, fingerprint, inbox eligibility and
source revisions are checked. Selection excludes promotions and active handled,
dismissed or snoozed concerns before applying its bound, skips displayed revisions,
and diversifies senders. Message bodies are explicitly marked bounded excerpts;
the source revision still binds the full stored message. Relevant remembered context
remains lower-authority context and cannot supply a standalone update. Explicit
operator corrections retain their original meaning.

The renderer selects a bounded set of recently active Git projects. Native capture
checks registered membership and folder identity, then selects recent unseen commits.
Git subjects are source data, not proof of deployment or completed work. Old omitted
commits remain eligible; only actually cited and displayed commit IDs are acknowledged.
Oversized histories and changed sources fail closed.

## Generation and delivery

The local model receives a bounded packet and structured output contract. It should
explain what changed, why it matters and whether the operator needs to act, while
preserving uncertainty and avoiding unsupported shipment joins or expired deadlines.
The native result validates citations and output shape, rechecks source revisions and
lifecycle after inference, and atomically persists the exact composed text with its
request, source provenance and display plan. Native coverage wording identifies the
limited review. Model output is not independent verification of source claims.

Feedback is bound natively to cited mail threads, their current signatures and
understanding revisions. This lets explicit replies such as “I already handled that”
use the existing correction and ambiguity rules. A displayed brief does not itself
mark mail handled, send anything, or perform proposed actions.

The frontend displays the saved text unchanged. Display acknowledgment is separate
from generation and saving, so unshown results do not consume evidence. Source errors,
loading and recorded project blockers/review decisions retain the factual path.
Local generation failure falls back with a visible notice. A successful local brief
is not presented as a full mailbox, task or run audit.

## Validation limits

Schema and citation checks establish provenance, not semantic accuracy. Real local
quality checks must inspect whether generated actions and interpretations follow the
sources. Offline fixtures cover stale/replaced sources, revoked tickets, changed
policy, exact-content binding, feedback and displayed receipts. Live acceptance uses
an isolated private database copy before desktop verification; release evidence is
recorded in the dated review and current handoff.
