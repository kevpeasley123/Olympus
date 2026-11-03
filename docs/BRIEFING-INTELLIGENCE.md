# Factual briefing foundation

Native opening and on-demand updates share `briefingIntelligence.ts` and
`briefingDelivery.ts`. This is a deterministic, source-grounded foundation;
it does not invoke a model or claim fresh semantic analysis.

Project input includes recorded blockers/reviews, saved next steps, commit
subjects and uncommitted work. Email input is existing account-scoped attention
with a current observation and matching message/thread/fingerprint reference.
Email recommendations are withheld for stale sync, account mismatch, unavailable
or paused/failed understanding, blocked analysis and missing source references.
Source text remains untrusted; a recommendation is never an operator commitment.

Sync freshness is conservatively bounded to 15 minutes, understanding to 24 hours,
and email evidence to the account's configured horizon. These bounds describe
the selector, not a guarantee that every message was analyzed. Coverage failures
become explicit limitations. At most three highlights are selected, with material
coverage limitations, pending decisions and email attention above repository hygiene.

Preparation reads local status, existing situation snapshots and delivery receipts;
it never requests sync or analysis. Reads time out after three seconds. Mail/account, project/checkpoint
and situation revisions are checked again before display. Changed sources trigger
up to three fresh preparation attempts; failure does not consume the opening. Native requested briefs
refresh project/task/run facts; partial task/run failures remain visible.

The native `briefing_receipts` and `briefing_record_delivery` commands store only
bounded display receipts with SHA-256 revision digests under `briefing.displayed.v1` in the existing settings
table. An item/revision can reappear after 24 hours, immediately if evidence changes,
or in an explicit requested brief. At most 200 receipts are retained. Source prose is never stored in a receipt. Cache removal also purges the account’s
mail/coverage receipts, including older raw revisions. Invalid or
future receipts do not suppress selection. A quiet opening creates no new message.

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
source-linked learning/correction/forget/undo and optional tray persistence. This
foundation does not establish live Gmail recovery or native briefing acceptance.
