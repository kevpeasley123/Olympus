# Source-grounded briefing synthesis

The native `briefing_local_prepare` / `briefing_local` entry points retain their
compatibility names and support the selected investigative subscription or local
workflow. The legacy `briefing_synthesize` entry point retains bounded evidence and
native qualification checks. Installing a CLI or signing in alone does not authorize
generation; see `SUBSCRIPTION-CONVERSATION.md`.

## Olympians workflow (current default)

Selected by `briefing.workflow.v1 = harness` (Preferences > Subscription engines >
Briefing workflow, "Olympians"). Chosen on 2026-11-13 because the investigative
workflow ran on the Codex subscription, which had stopped every brief since
November 13 with a purchased-credits refusal.

- The interface starts the `opening-brief` skill (SKILL-RUNNER.md) on Claude Code,
  on app open when Opening Briefing is on and on **New briefing**. A brief already
  running is joined, not refused. If a Gmail sync is in progress (the first one
  after a reconnect can take minutes) the brief waits for it, up to three minutes. The run shows in the Activity Deck; the spoken
  text is saved to the chat as a briefing message.
- Zeus gets the previous completed brief, its delivery time and what it said was
  waiting on Kevin, then calls `recent_activity` first (OLYMPUS-TOOLS.md), reads
  what he intends to mention, and answers in the brief schema.
- The instructions (`BRIEF_INSTRUCTIONS` in `skill_runner.rs`) define a brief as
  what changed, why it matters to Kevin and whether he must act; rank anything
  waiting on him first; exclude promotions, routine notices, Olympus bookkeeping
  and anything the previous brief said that has not changed; and forbid an
  all-clear while mail is stale. After a stale period it looks back to when mail
  was last current, and it opens any message about money or an account before
  calling it routine. Since 0.67.0 the brief is written to be heard: about 50 to
  90 words (110 asked, 140 accepted), short sentences, days instead of dates,
  no version numbers or labels, no narration of sources unless one is broken,
  and any action last. Exact dates and amounts stay in `items`. Since 0.69.0
  Olympus prefixes a greeting from the PC's clock ("Good morning/afternoon/
  evening, sir.", or "Welcome back, sir." within three hours of the last
  brief); the model does not greet.
- Since 0.70.0 Kevin's word settles a matter. Zeus gets `<kevin_said>`, his own
  words in saved chats since the previous brief (14 days and 5000 characters at
  most; omitted when Preferences > Memory turns chat memory use off), and
  `<settled_by_kevin>`, the `settled` entries of the briefs of the last 30 days.
  A settled matter stays out of the brief unless evidence dated after his
  statement says something new, and then the brief says it is new. New
  settlements are recorded in the brief's optional `settled` array.
- A failure is shown as such. Nothing substitutes a brief from another engine.

The investigative and legacy workflows below remain selectable.

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

## Rejected briefs (0.78.0)

A brief item that cites a tool the run never called loses that citation
instead of failing the brief (Kevin's 2026-11-15 brief failed on a `search_mail`
citation after a `read_mail_thread` read); an item left with no source is
dropped. A run that called no tools is not repaired. Any brief Olympus's checks
still reject is written again once, with the exact reason, and the second
verdict stands. The retry shows on the timeline and counts on the loop
scorecard (docs/LOOPS.md). Answers and verdicts keep the strict rule.

Since 0.83.0 a brief stopped by Claude's usage limit is replaced in the chat by
a spoken notice from the run itself: "Claude's usage limit is reached until
6:30 PM, so this has to wait. Try again after that." The reset time comes from
the recorded Claude reading; without one the notice says it is unknown. It is
not a brief and the run stays failed.

## Says it once, and can see its own settings (0.85.0)

The brief of 2026-11-16 led with an Olympus change, said it could not see which
email analysis route Kevin had picked (he had picked one), and told him the
same thing to do twice. Three changes:

- `recent_activity` reports `thisOlympus.emailAnalysis`: the chosen route and
  when a situation was last updated. The instructions say never to ask Kevin to
  check a setting, and that a working thing needs nothing from him.
- A change to Olympus ranks after matters in his own life.
- Two checks join the spoken-brief expectation and the one rewrite:
  `brief.says-it-once` (a sentence made almost wholly of words already spoken)
  and `brief.no-build-notes` (commit, merged, pull request and the like). On 29
  of Kevin's recorded briefs they flag five, all real.

## When a brief is prepared (0.86.0)

- **Reopening within twenty minutes shows the brief already prepared**, silently,
  instead of preparing another (`reusableBrief`). On 2026-11-15 seventeen
  reopenings prepared seventeen briefs. New briefing always prepares one.
- **Returning to an Olympus left open** asks for a brief when the last attempt
  started more than eight hours ago (`staleBrief`), on window focus, and only
  while Opening Briefing is on. Without it an Olympus left open overnight said
  nothing the next morning. Added on Claude's judgment on 2026-11-16; Kevin has
  not yet confirmed it.
- The brief hears the self-check's findings (docs/LOOPS.md, "Scheduled loops").
