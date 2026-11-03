# Factual briefing foundation

Native opening and on-demand updates share `briefingIntelligence.ts` and
`briefingDelivery.ts`. This is a deterministic, source-grounded foundation;
it does not invoke a model or claim fresh semantic analysis.

Project input includes recorded blockers/reviews, saved next steps, commit
subjects and uncommitted work. Email input is existing account-scoped attention
with a current observation and matching message/thread/fingerprint reference.
Email recommendations are withheld for stale sync, account mismatch, unavailable
or paused/failed understanding, blocked analysis and missing source references.
Current operator corrections are explicitly attributed and replace the generated
next move even when model understanding is blocked. Fresh sync, account match and
valid current source references are still required. Learning revisions enter the
display digest, so editing or undoing feedback invalidates suppression; forgetting
removes the candidate and invalidates pending preparation. See `EMAIL-ATTENTION.md`.
Source text remains untrusted; a recommendation is never an operator commitment.

Conversation context comes from `briefing_conversation_context`, a read-only
SQLite projection of automatically learned chat summaries and their source IDs.
It selects up to three chats with recent user activity and successful learning
within seven days, excluding the open chat, imported/legacy chats, failed learning
and summaries whose watermark does not cover all current messages. One summary
can appear as "Remembered from" context, below concrete decisions and email
attention but above repository hygiene. It is a remembered summary, not a newly
verified fact or inferred association between sources. Source IDs stay attached
to the prepared item; the displayed text names the chat, without new controls.

Temporary scopes return before reading memory; disabled Use memory returns before
reading chats. An unreadable preference fails closed. Omitted frontend scope is
private. Failed collection becomes a coverage limitation, while intentional
exclusion is silent. This path consumes learned summaries from SQLite, not the
Obsidian memory note or vault index; their broader capture/retrieval/use audit
remains separate. `scripts/verify-briefing-pipeline.mjs` exercises the real quiet-chat
worker, persistence, recall and brief preparation using a synthetic analyzer and
temporary vault, without qualifying live inference.

Sync freshness is conservatively bounded to 15 minutes, understanding to 24 hours,
and email evidence to the account's configured horizon. These bounds describe
the selector, not a guarantee that every message was analyzed. Coverage failures
become explicit limitations. At most three highlights are selected, with material
coverage limitations, pending decisions and email attention above repository hygiene.

Preparation reads local status, existing situation snapshots and delivery receipts;
it never requests sync or analysis. Reads time out after three seconds. Mail/account, project/checkpoint
and situation revisions, memory preference and conversation projection digests are
checked again before display. Changed sources trigger
up to three fresh preparation attempts; failure does not consume the opening. Native requested briefs
refresh project/task/run facts; partial task/run failures remain visible.

The native `briefing_receipts` and `briefing_record_delivery` commands store only
bounded display receipts with SHA-256 revision digests under `briefing.displayed.v1` in the existing settings
table. A factual item/revision can reappear after 24 hours, immediately if evidence changes,
or in an explicit requested brief. At most 200 receipts are retained. Source prose is never stored in a receipt. Cache removal also purges the account’s
mail/coverage receipts, including older raw revisions. Invalid or
future receipts do not suppress selection. A quiet opening creates no new message.
Unchanged remembered context does not recur merely because a day elapsed; it
can return when revised or explicitly requested. Selection applies receipts before
choosing the most recent eligible context, so a seen chat does not hide unseen
ones. Display identity tracks title, summary and user evidence; an assistant-only
watermark advance does not make old context new. Complete bounded summaries are
preserved, including final corrections or qualifications; they are not clipped
to the shorter factual-item preview length.

Saved email briefs also carry bounded account/thread/source/revision references in
`conversation_turn_context`, beside the assistant message. They are immutable on
append replay and distinct from display receipts. A subsequent explicit correction
can resolve that source without inferring a project association; a mixed brief
requires conversational clarification. See `EMAIL-ATTENTION.md`. Temporary briefs
carry no persisted correction references.

The caller records delivery only after exposing and saving the message; failures
leave items eligible for retry. These are display receipts, not proof of speech
playback or user agreement. Temporary chats do not save delivery receipts. Existing
speech controls remain responsible for playback. The browser demo retains the
legacy project composer and never reads native state.

Gmail preferences expose analysis readiness separately from the connection. The
subscription generation gates remain closed; a configured local provider remains
unverified until separately exercised. No new provider, permission or startup
behavior is enabled.

Follow-on work from the approved design includes qualified semantic synthesis,
cross-source workflow learning and optional tray persistence. This
foundation does not establish live Gmail recovery or native briefing acceptance.
