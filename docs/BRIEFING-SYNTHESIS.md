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
and diversifies senders. Clearly conditional routine sign-in notices are omitted from opening and requested local briefs;
explicit blocked or suspicious activity remains eligible. Within that bounded set, subject-based retrieval hints
prefer likely requests, bills, shipment changes and order problems ahead of routine
newsletters; sign-in codes are excluded. These hints do not establish urgency,
legitimacy or an obligation. The model must interpret the actual cited message.
Message bodies are explicitly marked bounded excerpts;
the source revision still binds the full stored message. Relevant remembered context
remains lower-authority context and cannot supply a standalone update. Explicit
operator corrections retain their original meaning.

The renderer selects a bounded set of recently active Git projects. Native capture
checks registered membership and folder identity, then selects recent unseen commits.
Git subjects are source data, not proof of deployment or completed work. Old omitted
commits remain eligible; only actually cited and displayed commit IDs are acknowledged.
Oversized histories and changed sources fail closed.

## Generation and delivery

The local model receives a bounded packet and a compact text-and-citations contract.
Native adaptation fills the canonical explanatory fields with empty strings; it does
not add prose or weaken source validation. Each short passage must carry its own
meaning, action condition and material uncertainty. The prompt includes the PC local
time and offset. It should
explain what changed, why it matters and whether the operator needs to act, while
preserving uncertainty and avoiding unsupported shipment joins or expired deadlines.
Local instructions consolidate each project's changes into at most one item and
omit build housekeeping unless the source establishes a practical consequence.
The writing should paraphrase notices into natural spoken sentences, preserve payment
conditions, use readable dates and avoid unnecessary device or location details.
Those are model instructions, not a guarantee of semantic quality.
The native result validates citations and output shape, rechecks source revisions and
lifecycle after inference, and atomically persists the exact composed text with its
request, source provenance and display plan. Native coverage metadata identifies the
limited review in an expandable About this brief disclosure and subsequent conversation
context; it is not appended to the spoken prose. Historical messages remain unchanged. Model output is not independent verification of source claims.

Feedback is bound natively to cited mail threads, their current signatures and
understanding revisions. This lets explicit replies such as “I already handled that”
use the existing correction and ambiguity rules. A displayed brief does not itself
mark mail handled, send anything, or perform proposed actions.

The frontend displays the saved text unchanged. Display acknowledgment is separate
from generation and saving, so unshown results do not consume evidence. Source errors,
loading and recorded project blockers/review decisions retain the factual path.
Local generation failure falls back with a visible notice. A successful local brief
is not presented as a full mailbox, task or run audit.

Before reserving a local generation ticket, the frontend waits up to twelve seconds
for a due startup sync or in-progress retry. Retryable connection errors retain this
grace period; revoked consent and future retry deadlines do not delay the brief.
Changing conversations during the wait cancels preparation. Native freshness and
source checks still apply after the wait; timeout never makes stale mail eligible.

## Validation limits

Schema and citation checks establish provenance, not semantic accuracy. Real local
quality checks must inspect whether generated actions and interpretations follow the
sources. Offline fixtures cover stale/replaced sources, revoked tickets, changed
policy, exact-content binding, feedback and displayed receipts. Live acceptance uses
an isolated private database copy before desktop verification; release evidence is
recorded in the dated review and current handoff.

Mail excerpts remove layout-only lines and collapse whitespace before the text
budget is applied, preserving source dates that HTML table padding previously hid.
The packet includes the UTC message date; local instructions prefer explicit
source dates, preserve uncertainty when a relative date lacks a sender timezone,
and keep conditional security advice conditional.
These instructions support quality but do not constitute a semantic guarantee.
Local transport failures retain allowlisted diagnostic codes instead of being
misreported as rejected model output. CPU execution is configured as described in
`EMAIL-ATTENTION.md`; it remains local and has a bounded longer deadline.

A successful sync with unchanged evidence does not invalidate generation. Each
selected thread also binds its message identities, content fingerprints and
availability, so a new reply or cancellation invalidates an older in-flight brief.
Old tomorrow-delivery forecasts (older than two days) are omitted as expired
forecasts, never interpreted as delivered. Explicit requests and recognized delivery
problems in the subject or body remain eligible. This bounded phrase filter does
not establish the actual shipment state.

The bounded project page omits recognized documentation/dependency housekeeping
subjects so they do not crowd out behavioral changes. Security/vulnerability
subjects stay eligible. Omitted commits remain in the revision binding and are
not acknowledged as displayed. Commit subjects alone do not prove installation.

A conservative local publication guard rejects observed instruction-override and
credential-disclosure patterns in generated prose before persistence. It can also
reject benign credential warnings, including negations, and rejects the whole
mixed brief; it is not general prompt-injection detection or semantic proof.
The ordinary failure path retains available source-based updates.
