# Email attention and local analysis

The Mission brief in the console's idle view shows up to three source-grounded suggestions, separately from mission activity and situation maps, with a count of any further ones. Review reveals the source quote; Snooze 1 day, Handled and Dismiss save account/thread/source-signature-bound local decisions. They never modify Gmail or establish an operator commitment. Changed evidence can resurface; unchanged evidence preserves decisions. Stale sources are withheld. Empty suggestions do not prove all mail has been reviewed. Discovery retains bounded six-thread batches and validates exact source quotations, message identities and literal date text. Interpretation remains generated and needs review.

## Source-scoped attention state

Legacy cached bodies can contain HTML even in fields labelled plain text. Layout tables are read linearly without decorative borders or empty padding; source cache bytes remain unchanged. Model
reads use a bounded, read-only MIME text view before applying excerpt limits;
markup must not consume the excerpt ahead of the actual message. The original
cache bytes, message identity and fingerprint remain unchanged. Unreadable or
oversized threads are recorded as skipped, not interpreted as irrelevant mail.

The interface provides source review and the existing Snooze, Handled and Dismiss
actions. These actions are optional attention management, not a prerequisite for
Olympus to learn. There is no correction form, learning-management panel, or
Edit/Undo/Forget workflow in the console. Conversations require no categorization.

The internal `email_learning` store and revision checks remain for safe source-bound
state. Existing operator context can still be displayed with attribution; it is
not a verified fact or a global preference. Changed/expired source evidence stops
older context from applying. Attention decisions preserve compatible corrections
through snooze expiry; Handled does not establish real-world completion.

Normal chat now accepts bounded, explicit corrections following a saved email brief
or local acknowledgment. Statements such as "I already handled that" clear the
referenced recommendation; "Actually, the deadline is Friday, not Thursday" stores
the exact operator correction. Correction markers must introduce a bounded assertion about the deadline, due date,
meeting, appointment, amount, sender, recipient, request or status ("the ... is/was ...").
A discourse prefix alone, a request, question or conditional does not apply. This is
a conservative local recognizer, not qualified general semantic interpretation.
Other phrasing follows normal assistant routing.
No model is called for a recognized correction, and no extra controls appear.

A mixed or multiple-item brief asks a conversational clarification first. Duplicate
subjects cannot select an arbitrary email. References carry the connected account,
thread, source signature and learning revision; changed evidence requires a fresh
update. Only the latest saved, recent, non-imported user turn and immediately
preceding app context can apply. Attached-source turns, temporary chats and disabled
Learn/Use memory do not apply this path. Saved words, message IDs, feedback and an
idempotent turn receipt are retained atomically. A failed save cannot claim success.
Handled is an operator report about an email, not project-task completion.

Internal undo/forget operations remain available to existing callers with their
safeguards, without a console management workflow. The broader automatic memory
and semantic analysis systems remain separate.

Migration 3 adds the feedback store. Feedback/context revisions update atomically,
invalidating pending analyzer publication and prepared briefs. Thread mutation
revisions invalidate delivery suppression even across source changes. Logical
forgetting redacts this feature's feedback/history and preserves bounded source
suppression; existing mailbox/chat/backup retention is separate. Removing an
account's cache deletes these records. No provider call is made by these controls.

## Local analysis

The email-only Ollama adapter is opt-in through the private project .env:

```
OLYMPUS_EMAIL_ANALYSIS_PROVIDER=ollama
# Set this only after installing and evaluating the exact model:
# OLYMPUS_EMAIL_MODEL=qwen3:8b
# Optional: avoid contention with GPU applications (default: auto)
# OLYMPUS_LOCAL_DEVICE=cpu
```

Missing local model configuration fails visibly without cloud fallback. The legacy provider name `openai` selects the subscription-job route in development; it requires the same authenticated account confirmation and runtime eligibility as the explicit Claude route. No paid fallback is enabled. Chat/voice routes remain independent. Install Ollama and download/import a model, enter its exact installed tag, restart Olympus, and perform synthetic acceptance before live analysis. Olympus does not pull models. `OLYMPUS_LOCAL_DEVICE` supplies the default device for local tasks. `OLYMPUS_EMAIL_DEVICE`, `OLYMPUS_BRIEF_DEVICE`, and `OLYMPUS_MEMORY_DEVICE` override it for extraction, briefing, and memory respectively. Each accepts only `auto` (Ollama scheduling) or `cpu` (zero GPU layers); an unset override uses the global value, and an unset global defaults to `auto`. Invalid explicit values fail before inference without fallback. Requests are serialized within one Olympus process; these limits do not reserve machine resources from other applications.

Transport is fixed to http://127.0.0.1:11434 with proxies and redirects disabled. Local installed-model and remote-host metadata checks precede sending content. No cloud model tags, tools or fallback. Requests use JSON schema, 16K context, 4096 output tokens, 120-second timeout (300 seconds with explicit CPU execution) and 48KB serialized context ceiling. Oversized, malformed and incomplete results fail rather than publishing partial findings. Both local and subscription results pass the same bounded recursive contract
validator before completion. It supports the current type/object/array, required,
additional-properties, enum, anyOf and size/numeric-bound rules; unsupported schema
keywords fail explicitly. This is a deliberate JSON Schema subset, not a complete
implementation. Offline fixtures qualify envelope and structural validity, not
semantic accuracy. Machine-specific acceptance and remaining limits are recorded in `NEXT-SESSION.md`. An installed model is not proof of acceptable output quality or throughput.

This computer (2026-10-11): approximately 32 GB RAM, RTX 4070 SUPER with 12 GB VRAM, approximately 1.1 TB free disk. Example Qwen3 downloads: 8B 5.2 GB, 14B 9.3 GB. Initial planning allowance: 10–15 GB disk for an 8B setup; runtime memory exceeds weight size. These are estimates, not benchmarks. https://registry.ollama.com/library/qwen3/tags

## Gmail quota repair

Google's May 2026 quotas charge 20 units per messages.get, with 6,000 units per minute per user per project. Runtime 403 metadata confirmed totalQueryCostPerMinutePerUser=6000. The old 100 ms pacing could use 12,000 units per minute. Shared 250 ms pacing budgets 4,800 units per minute, leaving 20% headroom. 2,000 reads require 500 seconds of base pacing. A rate-limit response imposes a shared 60-second cooldown and doubles spacing up to one second; workers claim slots only at send time. The import ceiling is 30 minutes to allow bounded recovery. Regression checks base quota headroom and pacing. Logging includes only route categories, allowlisted errors and quota metadata, never tokens or message content. https://developers.google.com/workspace/gmail/api/reference/quota

Only one native app should use a given operational database at once. Installed and development apps were both running during diagnosis; installed app was closed. This change does not introduce cross-process locking. Cache commits remain atomic; large imports or other activity may still require retries.

Each analysis run fixes its lower mail-horizon cutoff at snapshot time. Revalidation
still includes newly arrived messages and checks account, horizon, context revision
and content fingerprints. An unchanged older message aging past the rolling cutoff
during local inference does not by itself discard the run. Fresh display eligibility
continues to use the current horizon.

### Bounded local extraction requests

One refresh still selects at most six changed threads. When the explicit email
provider is Ollama, discovery processes them in sequential requests of at most
two threads, each with its own grounded schema and strict source validation.
Validated canonical situation IDs enter the next request's catalog; schema-issued
`new:N` labels are scoped to their request. Subscription extraction retains the
six-thread request bound. The local 4,096-token output limit is unchanged.

The existing single mapping-only repair remains bounded to the failing request.
Any request failure or selected-source change prevents publication of the whole
refresh; generated sources and situations commit together only after all checks.
Smaller requests are a reliability measure, not evidence that a local model is
qualified. A failed local model does not trigger another provider automatically.

Optional practical details are validated individually after the complete observation passes identity, cardinality, participant, relationship, attention and structural checks. Native validation withholds only unsupported optional details and preserves valid order references, amounts and other details unchanged; the retained observation then passes the original strict parser again. This does not relax quotation or source matching. Each source records bounded `omittedOptionalDetails` entries containing only the original detail index and a native reason code, plus an omission count; diagnostics never turn omissions into facts or copy rejected quote contents. At most six threads with ten details each can contribute omission metadata. Detail-only failures do not trigger a map-only model retry; existing bounded relationship/structure recovery remains separate, and invalid attention still fails closed.
