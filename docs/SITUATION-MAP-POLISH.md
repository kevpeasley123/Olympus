# Situation Map polish — September 13, 2026

## Map polish and layout
Preserved the navigator/map/briefing composition, overview geometry, initial fit, traveling lights, bounded zoom and chat exclusion. Wide desktop inspector is now 50px narrower (430px at the normal 480px chat width, with a 370px floor), returning that space to the map. Smaller layouts retain their existing readable scrolling fallback. No Gmail capabilities, workflows, skills or model calls were added.

## Node typography
Overview nodes show up to two distinct representative provider names, additional actor count and total actors. Workstream title is strongest; provider names secondary; counts subdued. The deterministic formatter wraps at word boundaries into at most two lines with a 22-character line budget. Extremely long names use a whole-word shortened label; an unbreakable token uses Full name in details. Full originals remain in accessible actor labels and tooltips. Summary nodes and actor rectangles keep their original dimensions. Short-window CSS no longer hides all but one provider. Full name samples HomeServices Insurance and Northwest Exterminating are covered by fixtures.

## Edges and controls
Fine edges have slightly stronger contrast; existing endpoint lights remain. Hover, keyboard focus or actor selection strengthens connected edges with restrained amber. No extra motion is introduced; reduced motion still disables traveling lights. The framing-corners reset icon now has Reset view as both tooltip and accessible name. Five existing scales remain: 1, 1.2, 1.5, 1.9, 2.4. Reset restores current graph fit and pan, without changing hierarchy. The overview tab shows a compact parent-arrow label when drilled into a workstream; its accessible Whole situation name remains stable.

## Briefing
Existing four-section structure remains. Long paragraphs show a three-line excerpt explicitly labeled as an excerpt, with Read full context & qualifications / Show less. Expansion displays the unchanged complete text; this is presentation disclosure, not a model-generated or authoritative summary. No source qualification is removed from stored content. Dossier next steps use the same disclosure when long. Records and provenance remain separate and collapsed.

## Error UX
Primary refresh failure copy is Intelligence refresh failed · Showing previous analysis when saved situations exist. Details retains full background error text and available timestamp. The concise summary can wrap to two lines instead of ellipsizing away the fallback state. Situation action failures remain differentiated. Healthy status does not add a new banner.

## Workstream review
All seven workstreams pass anchor, bounded-actor, dossier and parent-back checks.

| Workstream | Review |
| --- | --- |
| Renovation | Organization and representative paired; contacts and scoped dossier retained. |
| Mortgage | Documented originator contact recognized. Distinct broker and processor roles remain two organization-led engagements. Unknown servicer remains separate. |
| Insurance | Important provider name remains complete; compact dossier and fit retained. |
| HOA | Sparse service relationship remains a graph with parent briefing. |
| Inspections & repairs | Dense actors remain paginated, confirmed affiliations combined, uncertain affiliations separate. |
| Utilities | Sparse fixture stays bounded; overview supports multiple providers without changing live data. |
| Closing | Multiple provider names including long-name stress fixture wrap and fit. |

The fixed focus arrangement was retained: bounds already fit the currently visible anchor, hubs and actors rather than preserving an empty world-size canvas.

## Contextual actors
Found a real mismatch in the saved Home foundation: Brandon is the originator contact on Barrett's worksheet. The existing explicit-contact rule recognized proposal contact but omitted originator contact. Added that narrow wording to the existing cited relationship rule, without hardcoded identities or weakening uncertainty/source requirements.

Verified against the local saved Home context that Barrett Financial + Brandon Fleming, Gastelum Renovations + Luis Gastelum, and True North Inspections + Paul Carlson project together. These were read-only local checks; no source pack or database was altered.

Multiple explicitly recorded representative roles now produce separate role-scoped contextual actors, retaining organization plus relevant person IDs and evidence. Same-role representatives remain grouped. A shared organization ID cannot arbitrarily route a recorded edge to one role; those ambiguous endpoint edges are omitted visually while underlying relationships remain inspectable in source details.

## Actor dossiers
All workstreams continue using the relationship dossier. Contacts remain near the top, absent contacts stay absent, parent navigation clears selection, and source details retain canonical identities. No inference of active work, payment or origin was added.

## Files changed in this pass
- src/components/panels/BriefingText.tsx
- src/components/panels/DocumentSituationMap.tsx
- src/components/panels/RelationshipDossier.tsx
- src/components/panels/SituationRelationshipWeb.tsx
- src/components/panels/SituationsWorkspace.tsx
- src/components/panels/situations.css
- src/services/mapTypography.ts
- src/services/contextualActors.ts
- src/services/situationGraph.ts
- src/services/situationNavigatorFixture.ts
- src/services/situationViewportChecks.ts
- src/situations-harness.tsx
- scripts/test-contextual-actors.mjs
- scripts/test-situation-graph.mjs
- scripts/test-map-typography.mjs
- docs/NEXT-SESSION.md
- docs/COMMUNICATION-SITUATIONS.md
- docs/SITUATION-MAP-POLISH.md

## Fresh verification
- npm run build: passed; existing dependency/chunk warnings remain.
- cargo test --lib --manifest-path src-tauri/Cargo.toml: 313 passed, 0 failed, 2 ignored, on the normal parallel run.
- Contextual actor tests: 23 passed.
- Dossier projection: 22 passed.
- Graph/zoom model: 19 passed.
- Typography: 6 passed.
- Dossier browser/contact fixtures: 53 passed.
- Navigator/all-workstream checks: 68 passed; reduced-motion variant: 68 passed.
- Communications: 58 passed. Situations: 14 passed. Gmail: 19 passed.
- Viewports: 1755×950 normal 36; stress/error/expanded-chat/reduced-motion 42; 1920×1080 normal 36; 1280×900 stress 39; 1280×720 short 33. All passed.
- Viewport checks now also verify summary text fits the compact node and long briefing qualifications expand intact.
- Manual browser check: separate mortgage roles and keyboard-focus edge highlight confirmed; whole overview visually inspected.

## Manual review
Use the full composition at http://127.0.0.1:31420/communications-viewport-harness.html. Whole situation opens with all seven workstreams. Inspect Insurance and Closing names, enter Mortgage to compare two roles, select a dossier, then use its parent control. Reset view should change only framing. Toggle the long-error fixture to inspect compact diagnostics and full briefing disclosure.

For actual Home data, use the native developer app and review the three verified organization/person pairings. Browser fixtures are synthetic, and native visual review remains a user step. Nothing was committed, pushed or installed in this pass.
