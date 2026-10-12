# Executive prioritization and interface cohesion — September 13, 2026

Status, 2026-10-12: describes the review policy behind Situation maps' useful next step and workstream emphasis (`src/services/situationPriority.ts`, policy version 1), released in 0.18.0 and part of the installed 0.30.0. The Situation navigator uses the same levels for its priority chips; see [COMMUNICATIONS.md](COMMUNICATIONS.md#design-review-changes--september-28-2026).

## Executive briefing
The whole-situation next step comes from a structured review policy. A supported, unique priority produces an action, linked workstream, practical guidance and reason. Equal candidates explicitly remain tied. No supported candidate produces an honest limitation, not a claim that everything is resolved. The existing current-state synthesis and full-context disclosure remain; no new summarization/model path was added.

A payment-coordination question produces VERIFY. When its label names the servicer or payment portal, the guidance is to confirm the current servicer, payment portal and payment instructions using a recent servicing statement; otherwise to verify the current payment contact and instructions against an up-to-date statement. Other workstreams use REVIEW with their saved next step. On 2026-09-13 the saved Home context produced VERIFY · Mortgage from its unresolved servicing and payment portal record. The policy does not infer a due date or claim a missed payment.

## Prioritization
Pure `prioritizeSituation(context)` returns policyVersion, asOf, outcome, recommendedWorkstreamId, message, source-linked questions, and per-workstream status, classification, reason, action, guidance and references. Questions are saved facts with status `needs confirmation`. Workstream status is retained separately from priority.

Transparent classifications:
- Needs attention: an open, source-linked question explicitly identifies payment coordination (servicer, payment portal/instructions/recipient/routing/due-date subject or payee).
- Review soon: other source-linked open questions. Source conflicts receive a specific reconciliation explanation.
- Stable: an explicitly stable saved entity status with available source references and no open questions. Absence of questions alone is insufficient.
- Unassessed: no supported priority can be established, or questions lack usable references.

Payment coordination is a review-policy preference, not proof of financial exposure or urgency. Two workstreams in the highest applicable class remain a tie; counts, titles and array position do not manufacture a winner. No 1–100 score, deadline extraction, overdue inference or autonomous task is introduced. Questions in attention workstreams appear first; the first three are visible, with an exact additional count and expansion for the rest.

### Scope and future evaluation
This version uses the saved document-backed SituationContext. The model lacks typed current deadlines, balances and workstream linkage for arbitrary new correspondence, so those are not inferred. A Gmail refresh alone is not claimed to update this local document foundation. The projection recomputes when saved context changes; it does not mutate or persist new authoritative state. Stable IDs for the workstream, policy version, reasons and references make later evaluation possible. Navigation state exposes the opened workstream, but no new persistent click tracking, evaluation framework or learning system was added.

## Map state
Overview nodes retain their dimensions, provider previews and actor counts. Review soon uses a faint warm accent and a dim marker; needs attention a stronger accent and a full marker. The recommended workstream gets a slightly stronger border and connecting edge. Stable and unassessed nodes stay cool and neutral. Reasons are available through node descriptions/tooltips and Source details. The recommendation does not auto-select or drill into the graph.

## Useful next step and drill-down
Clicking the linked workstream is navigation only. It opens that workstream's existing map/briefing. Selecting its actor opens the existing relationship dossier. Actor-back returns to the workstream; the parent control returns to the overview. Camera reset remains independent and preserves hierarchy. No sends, updates, drafts or model runs occur through recommendation navigation.

## Secondary controls
**Add an update** opens and focuses the operator-context form, with a tooltip explaining that it adds context or corrections for the next analysis. Opening it does not save, draft or refresh; Save update persists the text explicitly.

Latest communication update contains the Gmail-derived situation interpretation. Activity & updates contains dated conversations, operator updates and secondary management/research/draft details, not a run history; conversations and operator updates are newest first. Closed & dismissed stays collapsed, while each record retains its actual state. Since 2026-09-28 Activity & updates and Add an update sit in the inspector's tab row; see [COMMUNICATIONS.md](COMMUNICATIONS.md#design-review-changes--september-28-2026).

## Verification

`scripts/test-situation-priority.mjs` checks the policy, and the Communications harness runs priority scenarios with `communications-harness.html?navigator&fit&run&priority=clear` (or `tied`, `none`, `many`). The pass's file list, test receipts and manual-review notes are in git history (`cb25daf`, 2026-09-13). Fixtures are synthetic.
