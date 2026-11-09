# Source-grounded briefing synthesis

The native `briefing_local_prepare` / `briefing_local` entry points retain their
compatibility names and support the selected investigative subscription or local
workflow. The legacy `briefing_synthesize` entry point retains bounded evidence and
native qualification checks. Installing a CLI or signing in alone does not authorize
generation; see `SUBSCRIPTION-CONVERSATION.md`.

## Investigative workflow

The saved `briefing.workflow.v1` setting selects `investigative`, `legacy` or
`shadow`; `briefing.provider.v1` explicitly selects Codex, Claude Code or local
inference. The legacy default makes rollout reversible. Investigation is owned by
`commands/briefing_investigator.rs`: bounded situation-change pages, eligible related
threads and long-message sections, query-aware memory and registered project reads.
The model cannot execute tools directly. Native code validates each requested read,
enforces twelve calls and a shared two-minute deadline, and binds exact source
revisions and operator corrections. Composition and a same-engine claim check share
that deadline. A verifier is another model judgment, not independent factual proof.

Curated vault recall uses the existing indexed memory reader rather than scanning
arbitrary files. Selected notes retain record IDs, file revisions and excerpt hashes;
changed, removed or newly corrected evidence must be investigated again. Memory-off
and temporary scope exclude recall, and remembered context remains lower authority
than current source evidence and explicit operator corrections.

Mail sections use readable text, including safe MIME conversion for legacy cached
HTML. Section offsets describe that representation; original raw source revisions
still bind publication and display receipts. Per-source and total packet bounds
are enforced while reading, with partial coverage retained in diagnostics.

Quiet purchases remain tracked without automatically becoming attention items.
Changes have durable revision history; matching relies on source identity and
transaction references rather than a shared sender alone. Durable operator context
outranks learned interpretations. Forget, account removal, changed content or scope
revocation invalidate affected output before publication. Shadow mode records a
comparison request without writing knowledge or acknowledging display.

A dated last completed eligible brief appears while work runs. It has no speech or
display receipt. Cancel revokes the native ticket and stops the owned job. Failure
retains the dated preview with a status; a successful empty result says nothing new
was found among the checked sources rather than substituting a generic factual
brief. A newly saved and displayed brief alone can autoplay and acknowledge its
exact cited revisions.

The local route uses `briefing_local_prepare` followed by `briefing_local`. It is
available when the operator has configured an installed `OLYMPUS_BRIEF_MODEL`,
independently of the email analysis provider. Without that override it inherits
`OLYMPUS_EMAIL_MODEL` only when `OLYMPUS_EMAIL_ANALYSIS_PROVIDER` is `ollama`.
Task routing lives in `commands/inference_routes.rs`; shared local transport lives
in `commands/local_inference.rs`, outside Gmail. It uses the same fixed
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
classification normalizes body whitespace so MIME line wrapping cannot split a condition or problem exception.
Newsletter and clear multi-article vendor roundups do not fill spare briefing slots,
even when Gmail labels them Updates. Direct account requests and personal work reports
remain eligible. These retrieval hints are heuristic; the model must separately
establish personal relevance and must not turn advertised capabilities into the
operator's own workflow. Selected project changes are presented newest-first.
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
from generation and saving, so unshown results do not consume evidence. Generation
failure retains the dated previous brief; it does not replace it with a reassuring
but unanalysed status summary. A successful brief is not presented as a full mailbox,
task or run audit.

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
An investigative failure retains the dated previous brief and reports the failure;
it does not publish a replacement operational summary.
