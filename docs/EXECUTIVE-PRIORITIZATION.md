# Executive prioritization and interface cohesion — September 13, 2026

## Executive briefing
The whole-situation next step now comes from a structured review policy instead of the previous choose-a-workstream fallback. A supported, unique priority produces an action, linked workstream, practical guidance and reason. Equal candidates explicitly remain tied. No supported candidate produces an honest limitation, not a claim that everything is resolved. The existing current-state synthesis and full-context disclosure remain; no new summarization/model path was added.

The saved Home context was checked read-only: its unresolved Servicing and payment portal record produces VERIFY · Mortgage. Its guidance is to verify current payment contact/instructions against an up-to-date statement. The policy does not infer a due date or claim a missed payment.

## Prioritization
Pure `prioritizeSituation(context)` returns policyVersion, asOf, outcome, recommendedWorkstreamId, source-linked questions, and per-workstream status, classification, reason, action, guidance and references. Workstream status is retained separately from priority.

Transparent classifications:
- Needs attention: an open, source-linked question explicitly identifies payment coordination (servicer, payment portal/instructions/recipient/routing/due-date subject or payee).
- Review soon: other source-linked open questions. Source conflicts receive a specific reconciliation explanation.
- Stable: an explicitly stable saved entity status with available source references and no open questions. Absence of questions alone is insufficient.
- Unassessed: no supported priority can be established, or questions lack usable references.

Payment coordination is a review-policy preference, not proof of financial exposure or urgency. Two workstreams in the highest applicable class remain a tie; counts, titles and array position do not manufacture a winner. No 1–100 score, deadline extraction, overdue inference or autonomous task is introduced. Questions in attention workstreams appear first; the first three are visible, with an exact additional count and expansion for the rest.

### Scope and future evaluation
This version uses the saved document-backed SituationContext. The model lacks typed current deadlines, balances and workstream linkage for arbitrary new correspondence, so those are not inferred. A Gmail refresh alone is not claimed to update this local document foundation. The projection recomputes when saved context changes; it does not mutate or persist new authoritative state. Stable IDs for the workstream, policy version, reasons and references make later evaluation possible. Navigation state exposes the opened workstream, but no new persistent click tracking, evaluation framework or learning system was added.

## Map state
Overview nodes retain their dimensions, provider previews and actor counts. Review soon uses a faint warm accent; needs attention adds a restrained marker. The recommended workstream gets a slightly stronger border and connecting edge. Stable and unassessed nodes stay cool and neutral. Reasons are available through node descriptions/tooltips and Source details. The recommendation does not auto-select or drill into the graph.

## Useful next step and drill-down
Clicking the linked workstream is navigation only. It opens that workstream's existing map/briefing. Selecting its actor opens the existing relationship dossier. Actor-back returns to the workstream; the parent control returns to the overview. Camera reset remains independent and preserves hierarchy. No sends, updates, drafts or model runs occur through recommendation navigation.

## Secondary controls
Verified Update Olympus only opened the operator-context form; renamed it Add an update, with a tooltip explaining that it adds context/corrections for the next analysis. Opening it focuses the form without saving, drafting or refreshing. Save update retains the existing explicit persistence behavior.

Latest communication update still contains the Gmail-derived situation interpretation, so its label is retained. Activity & updates contains dated conversations, operator updates and secondary management/research/draft details—not a new run history. Conversations remain newest first; operator updates are now explicitly sorted newest first. Add an update is visually separated from the information disclosures. Closed & dismissed stays quiet/collapsed, while each record retains its actual state internally and in the disclosure.

## Contextual actors and dossiers
No identity/projection changes were made. Existing dossier contacts, origin/business/status sections and source disclosures remain. A fresh read-only check confirms the saved Home pairings for Barrett/Brandon, Gastelum/Luis and True North/Paul. The full synthetic mortgage path preserves broker/processor engagements and contact details.

## Files changed
- src/services/situationPriority.ts
- src/services/situationPriorityFixture.ts
- src/services/situationPriorityChecks.ts
- src/services/situationGraph.ts (optional presentation metadata only)
- src/components/panels/DocumentSituationMap.tsx
- src/components/panels/SituationRelationshipWeb.tsx
- src/components/panels/SituationsWorkspace.tsx
- src/components/panels/situations.css
- src/communications-harness.tsx
- src/communications-viewport-harness.ts
- src/situations-harness.tsx (readiness-based startup for concurrent fixtures)
- scripts/test-situation-priority.mjs
- docs/EXECUTIVE-PRIORITIZATION.md
- docs/NEXT-SESSION.md
- docs/COMMUNICATION-SITUATIONS.md
- ARCHITECTURE.md
- OLYMPUS-MANUAL.md

## Fresh tests
- npm run build: passed; existing dependency/chunk warnings remain. Final harness-only readiness change also passed tsc --noEmit.
- Normal Rust run: 312 passed, 1 failed, 2 ignored. The previously seen `http_failure_does_not_switch_provider` assertion failed under parallel execution.
- Full serial Rust rerun: 313 passed, 0 failed, 2 ignored (`cargo test --lib --manifest-path src-tauri/Cargo.toml -- --test-threads=1`). No Rust source changed.
- Priority policy: 23 passed.
- Contextual actors: 23 passed. Dossier projection: 22 passed. Graph/zoom model: 19 passed. Typography: 6 passed.
- Priority browser scenarios: clear 17; tied 10; stable/no follow-up 10; many questions 20. All passed.
- Browser dossier/contact fixtures: 53 passed.
- Navigator/all workstreams: 76 passed; reduced-motion navigator: 76 passed.
- Communications: 58 passed; Situations: 14 passed; Gmail: 19 passed.
- Viewport checks: 1755×950 normal 36; same-size error/expanded-chat/reduced-motion stress 42; 1920×1080 normal 36; 1280×900 stress 39; 1280×720 short 33. All passed.
- Saved Home priority output and three contextual pairings verified locally without writes.

The browser matrix initially exposed cross-iframe focus competition and a fixed startup-delay assumption. Focus is now captured synchronously after the click, and navigator checks wait for the rendered briefing. The final matrix passed all scenarios.

## Manual review
The right preview remains the full composition at http://127.0.0.1:31420/communications-viewport-harness.html. Verify that Mortgage has the restrained cue and a linked recommendation, then follow it to the broker dossier and back. Open Add an update to see that it is a context-entry form. Priority scenarios are also available through the synthetic Communications harness with `?navigator&fit&run&priority=clear`, `priority=tied`, `priority=none`, or `priority=many` (all full paths start with `communications-harness.html`). Matrix results report each scenario separately.

Live native visual review remains a user step. Browser fixtures are synthetic; private Home source data was not copied into them. No commit, push or install was performed.
