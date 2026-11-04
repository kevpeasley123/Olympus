# Guarded briefing synthesis

`briefing_synthesize` is a separate optional native synthesis entrypoint. It accepts
a revision-bound packet of already selected evidence and uses the existing Claude
subscription job adapter. The unchanged subscription readiness gate runs before
input processing, request recording, credentials, executable lookup or model work.
The current gate refuses generation. Neither an installed CLI nor an OAuth login
opens it, and no paid API or Codex fallback is introduced.

The packet carries a SHA-256-shaped revision, preparation time and bounded evidence
records (ID, revision, kind, observation time and text). Kinds distinguish mail,
project records, memory and coverage. All evidence is explicitly lower-authority
data, not instructions. Packet age, byte size, field lengths, duplicate IDs and
future observation times are checked before a runner can start.

Optional authority labels distinguish source facts, direct operator statements,
remembered context, hypotheses and unspecified legacy evidence. These labels are
caller assertions, not backend authentication of authorship. Direct operator
resolution should suppress the resolved concern unless materially new evidence
contradicts it; it does not grant action permission or override generation gates.
Context-only evidence can inform a new highlight but cannot be its sole cited
source. This prevents an acknowledged old concern from returning solely because
it was retrieved as context. Callers retain protected corrections verbatim.

The synthesis instruction asks for conversational priorities: what changed, why it
matters, and whether Kevin needs to act. It rejects merchant-only shipment joins,
invented arrival dates, routine stale receipts, redundant invoices and product
specifications irrelevant to the decision. Uncertainty must remain explicit.

Cross-domain linkage is provisional unless source identity supports it. Timing or
a shared sender does not prove that two notices describe the same instruction,
transaction or obligation. When missing identity or amounts matter, ask one useful
confirmation question rather than proposing compensating action. Fictional tests
exercise setup/cancellation notices, possible relevance to a recurring expense,
and an explicit operator statement that resolves the concern as intentional and
unrelated. Injected outputs test the transport contract, not actual model reasoning.

Output is strict bounded JSON. Every item references known unique evidence IDs;
unknown fields, oversized prose, absent citations and fabricated source IDs are
rejected. An empty item list means no supported substantive item was produced.
Output returns the caller's revision and preparation time, plus model_synthesis
provenance from the completed runner: provider, actual model and request ID.
Frontend source revalidation remains necessary before display or acknowledgment.
The backend binds citations to packet IDs; it does not independently reload or
authenticate the packet's source records. The caller must supply eligible evidence
and reject results if source revisions, account or conversation scope changed.

Schema and citation validation do not prove semantic truth. A model can still
misinterpret correctly cited evidence. Until permitted live quality acceptance is
completed, this is tested wiring, not a qualified reasoning experience. Deterministic
fallback prose must remain distinguishable from model-generated synthesis.

The command does not sync Gmail, send mail, change source records, write a brief to
the vault, acknowledge evidence, or execute any action proposed in output. Only an
eligible inference attempt creates model diagnostic records. A blocked call creates
none. Tests use an injected fake runner and an in-memory database; no real provider
or credential store is needed to validate the contract.

## Native source and persistence qualification

The aggregate IPC entry point has an independent closed source-qualification gate,
after generation readiness. Lifting a spending gate cannot implicitly qualify
caller-authored evidence. The native resolver prototype reads a transaction snapshot
of eligible Gmail and remembered context using source references rather than caller
prose. It checks native account, embedded identity, revisions, freshness and scope.
Memory stays lower-authority context; quoted mail instructions do not become operator
statements. Source facts mean stored source assertions, not independent truth.
The resolver is not exposed over IPC. Authenticated session scope, reference issuance,
operator correction retrieval and relevance selection remain unimplemented.

Briefing origin now travels through both opening/requested message paths into the
existing immutable conversation turn metadata. Fallback and model origins differ;
older records have unknown origin. Metadata stores bounded references and revisions,
not copies of email or remembered text. Model-history labels preserve this distinction.
Model origin additionally requires a completed native briefing request and a native
binding to exact displayed content digest, conversation, origin metadata (including
packet and source revisions), and time. A request cannot be reused for a new message.
There is deliberately no production binding issuer until native composition and scope
are qualified. Missing bindings fail closed. Synthetic fixtures exercise issuance;
they are not live model results. No new schema migration is needed.

## Scope capabilities and contextual candidates

The isolated native resolver now uses a non-serializable owner/session capability.
Lifecycle changes revoke issued selections; foreign owners, temporary scope, invalid
identifiers, expired selections and exhausted generations fail closed. References
are issued from native rows and revalidated against current source revisions.
The eventual application lifecycle must supply trusted state; no webview can acquire
this capability and there is no production IPC hookup.

Operator feedback retrieval is read-only and restricted to selected current mail
threads. It retains complete stored corrections and their exact thread signature;
changed/forgotten source feedback is not carried forward. Handled remains a feedback
state, not proof that an external action completed. Memory-use preferences apply.

A conservative lexical candidate selector requires multiple distinctive terms from
one current mail item, limits results, and keeps remembered summaries lower-authority.
It is neither model reasoning nor proof of causal relevance. It can miss important
connections and cannot qualify injection resistance or disclosure safety for live
inference; the independent source and generation gates remain closed.

Expired snoozes carry an explicit inactive flag while retaining their underlying correction. Resolved packets are opaque and require a checked native lease for use; trusted callbacks must not defer work outside that lease. Actual asynchronous dispatch and adoption still require source revalidation and are not wired.

## Native lifecycle startup and dispatch qualification

Startup initializes a revoked NativeSession from the same backend-owned
ApprovalState used by operator-session persistence. No frontend session ID or
resumable-conversation guess activates it. Native saved-conversation selection
validates the stored session, nonlegacy conversation, and currently selected enabled
read-only Gmail account; invalid selection revokes prior capability. No IPC selects
this state. UI chat/hydration/unmount transitions now revoke scope through a revocation-only IPC. No UI operation selects scope; production briefing scope remains unavailable by default.

Dispatch/result sequencing is currently an offline cfg(test) harness. It re-reads
sources under the original issued capability, checks expiry and injected policy,
refuses to invoke a fake runner for stale input, and rechecks before accepting its
result. Pending results are consumed. These tests do not establish real pre-call
spending enforcement, asynchronous cancellation, or atomic durable adoption. Their
SQLite transaction rolls back; production transport and binding issuance remain
closed and unimplemented.

Native selection validation, lifecycle publication, capability creation and clear are serialized by one adapter transition mutex. Raw owner access from this adapter is test-only. UI transitions clear scope for new or Temporary conversations. Generation-bound acknowledgments and preparation predicates reject stale A-to-B-to-A attempts. Native selection remains unconnected.


Result adoption now consumes the bound model request in the same SQLite transaction
as the message, provenance, delivery receipts and index. Consumption survives chat
deletion; bound requests are immutable to generic diagnostic saves. Exact reloads
and voice updates are idempotent. Failure injection verifies rollback at four
stages. This is synthetic qualification of persistence, not a production issuer,
provider dispatch or spending guarantee. Future request purges must retain consumed
request tombstones or permanently retire those identifiers.


Native mail-only composition and transactional issuance are now implemented as
private, unconnected primitives; see reviews/2026-11-04-native-composition.md.
Final text, exact relevant operator corrections, native one-to-one mail receipts,
output digest binding, consumption and message persistence share native validation
and an atomic transaction. The production dispatcher that records the immutable
result envelope is still absent. Combined receipts/project cursors are unsupported.
Current offline suite: 729 passed, 26 ignored, real-vault diagnostic filtered.


Latest general-source qualification: reviews/2026-11-04-general-brief-acceptance.md.
The private native path now supports registered-project per-commit evidence and
selected receipt/cursor mappings alongside mail. It reuses existing Git inspection
and native display acknowledgment. Omitted commits remain eligible; handled mail
is removed before mixed-source inference. The actual frontend acknowledgment
service passes synthetic ordering/retry tests. No real UI/provider route is enabled.
Earlier mail-only/project-unsupported notes describe prior milestones. Independent
project scope without a fresh Gmail account, backdated Git reachability and broad
uncommitted/task sources remain outside this qualified path.


Latest corrections supersede prior Gmail-coupling/timestamp-limit notes: project-only
native capabilities need no Gmail account/freshness and cannot read mail. Project
eligibility uses a protected, durable selected-OID ledger over bounded full local
reachability (4,096 cap, eight-item pages), detecting backdated reachable commits.
See reviews/2026-11-04-whole-patch-review.md for complete acceptance and merge limits.
