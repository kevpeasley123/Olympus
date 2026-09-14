# Situation Maps — cohesion and drill-down quality

Implemented September 13, 2026. This is a refinement of the existing Home surface, not a layout redesign. No commit, push, or installation was requested for this pass.

## Home cohesion

The same structured priority selects the Home recommendation, its workstream card and its connecting edge. Existing restrained amber styling remains; unrelated nodes are not dimmed. Geometry, node sizes, navigator width, briefing placement and chat reservation are unchanged. Priority follows saved source-linked open questions, not scores or hardcoded names.

## Recommendation

The workstream name remains a keyboard-accessible navigation button. Opening it changes only view state. It neither verifies the record nor marks it complete, drafts, sends, or changes canonical situation data.

For servicing questions, the action now reads: “Confirm the current servicer, payment portal, and payment instructions using a recent servicing statement.” The concise reason remains visible and its supporting records remain inspectable. Focused workstream briefings and actor dossiers use this same supported guidance. In a dossier it remains explicitly a workstream recommendation, not an actor-specific obligation.

## Briefing text

Removed CSS-clamped paragraphs from BriefingText. A long paragraph now previews up to two complete source sentences within 300 characters, with Read full context. An oversized first sentence gets a short continuation invitation instead of an unfinished fragment. Expansion restores the original text without rewriting qualifiers. This is a source excerpt, not a newly generated summary. Short text is unchanged. Home retains three open-question bullets plus a collapsed exact remainder count.

## Mortgage drill-down

Recorded role labels form semantic groups: Broker, Lender, Lender contact, and Servicing / payment. Existing other role groups remain data-derived. The graph does not invent a chain of transactions between those actors. Existing cited relationships remain available; an unknown servicer/payment recipient stays unconfirmed. No separate payment actor is invented merely to complete a visual chain.

The hierarchy remains Home → Mortgage → relationship dossier. The dossier’s ← Mortgage and workstream’s ← Home navigate upward; Reset view changes the camera only.

## Contextual actors

Fresh read-only projection checks against the saved Home document pack confirm Barrett Financial + Brandon Fleming as one engagement, no redundant Brandon-only node, Mega Capital Funding as a distinct lender, and Current servicer unknown as unconfirmed. Every saved workstream has projected actors. The existing conservative citation/affiliation rules remain; this pass only normalizes explicit mortgage role labels for grouping.

## Actor dossier

The shared dossier remains the endpoint across all seven workstreams. Known contacts sit next to identity, above the five narrative sections. Documents, related people/companies and source details remain collapsed. Current status is not fabricated from a documented identity. The shared priority guidance now carries through to the dossier with its reason and workstream scope.

## Bottom controls

Camera controls remain at the map’s lower left. A quiet divider groups the secondary history area below the map. Add an update has its own warm bordered treatment at the action end of that row. Closed & dismissed remains a subdued secondary disclosure below the history area. No new toolbar or map height was introduced.

## Activity

Activity & updates begins with six recent human-readable correspondence/operator-update entries, sorted by date. Older records and detailed conversation logs remain below. Dates represent source correspondence or saved operator updates, not invented ingestion times. This is not a persisted history of priority changes: the current data has no such event log, so this pass does not manufacture “Mortgage flagged” events.

Add an update only opens and focuses the context-entry form. Save update explicitly persists the operator text for the existing next analysis refresh. Opening the form does not save, reconcile, draft, send, or trigger analysis. Gmail permissions and model request boundaries are unchanged.

## Edge cases

A synthetic resolved-Mortgage state moves the recommendation and emphasis to Renovation. Tied candidates retain the existing honest no-single-winner explanation. A no-priority state does not highlight any workstream or claim that all obligations are complete. Priority recomputes from changed saved context; this refinement does not add a new Gmail reconciliation path.

## Files changed in this pass

- src/services/briefingPreview.ts (new) and scripts/test-briefing-preview.mjs (new)
- src/components/panels/BriefingText.tsx
- src/components/panels/DocumentSituationMap.tsx
- src/components/panels/RelationshipDossier.tsx
- src/components/panels/SituationsWorkspace.tsx
- src/components/panels/situations.css
- src/services/contextualActors.ts
- src/services/situationPriority.ts
- src/services/situationPriorityFixture.ts
- src/services/situationPriorityChecks.ts
- src/services/situationViewportChecks.ts
- src/communications-viewport-harness.ts
- docs/SITUATION-COHESION.md and docs/NEXT-SESSION.md

Other uncommitted repository changes predate this pass and were preserved.

## Tests

Fresh production build: PASS. Existing dependency warnings remain (buffer externalization, gray-matter eval, large chunks).

Pure checks: priority 23, contextual actors 23, dossier projection 22, graph 19, map typography 6, sentence preview 6. All pass. Saved Home read-only projection: 6 pass.

Requested standard Rust command: 312 passed, 1 failed, 2 ignored. Failure: commands::responses::tests::http_failure_does_not_switch_provider, HTTP 401 assertion. This is the same parallel failure recorded in earlier sessions. Full serial rerun: 313 passed, 0 failed, 2 ignored. No Rust source changed in this pass.

Final browser matrix: all 16 cases passed.

| Case | Checks passed |
| --- | ---: |
| Mortgage priority + drill-down | 23 |
| Renovation priority | 13 |
| Comparable priorities | 12 |
| No priority | 12 |
| Many questions | 26 |
| Relationship dossier | 53 |
| 1755×950 overview | 36 |
| 1755×950 errors, long text, expanded chat, reduced motion | 43 |
| 1920×1080 overview | 36 |
| 1280×900 stress | 40 |
| 1280×720 short desktop | 33 |
| Communications | 58 |
| Situations | 14 |
| Gmail | 19 |
| Navigator | 76 |
| Reduced-motion navigator | 76 |

Wide desktop initial fit passes; narrow/short views preserve the established stacked/scrolling fallback. `git diff --check` passes with the pre-existing schema line-ending warning.

## Manual review

Browser review used synthetic Home at the 1755×950 acceptance size and inspected Mortgage’s semantic groups and recommendation. Automated fixtures cover all seven workstreams, dense and sparse branches, actor dossiers, unknown servicer, parent navigation, chat safe area, zoom/reset and reduced motion. Native installed-app visual review was not performed; the installed release was not replaced.

Review in development: Home → click Mortgage in Useful next step → select a relationship → ← Mortgage → ← Home. Inspect Activity & updates and open Add an update without saving. Use the acceptance matrix for the alternate priority states.
