# Relationship dossier — September 13, 2026

## Profile redesign
The selected actor inspector now renders a relationship dossier, with one purpose at a time. Without actor selection the existing ongoing briefing remains. Email-only situation/person filtering is unchanged; this pass targets the contextual actor inspector used by document-backed situation maps.

## Header compression
Removed ACTOR IN THIS SITUATION, the repeated breadcrumb and large Back to briefing control. A compact parent-workstream back control precedes the primary identity and representative/role line. Returning clears actor selection, retains map scope, and resets inspector scroll.

## Contact details
Existing canonical contact strings are deduplicated and displayed near the name as selectable text. No contacts are fabricated, synchronized, sent to, or opened automatically. Person-only profiles retain Organization unconfirmed. No empty contact block is rendered.

## Relationship flow
Profile → How we met/engaged/connected → Business/work relationship → Current progress/status → Useful next step. Compact labeled saved facts are shown where attribution is explicit. Recommendations retain their workstream scope, rather than implying an actor-specific model recommendation. Missing recommendations use a clearly labeled verification suggestion.

## Adaptation
One deterministic presentation model chooses headings for contractor, inspector, lender, insurer, utility, HOA and generic relationships using the existing role. No new API, model path, identity resolution, or data migration was introduced.

## Technical details
Documents & records retains full actor notes, cited source titles/locators/paths and supporting workstream facts. Related people & companies retains recorded relationships, endpoint names and citations. Source details retains canonical IDs, kinds, roles, status, contacts, per-entity references, projection state and context date. All three disclosures start collapsed. The complete situation document library remains available from the parent briefing.

## Label changes
- Actor in this situation: removed.
- Back to briefing + breadcrumb: compact parent-workstream back button.
- Evidence: Documents & records in the dossier.
- Recorded relationships: Related people & companies.
- Underlying identities and contacts: practical contacts at top; canonical detail in Source details.
- Status / uncertainty: Current progress or Current status.
- Briefing Uncertainty: What still needs confirmation.

## Truth / uncertainty
No timeline is inferred from filenames or undated references. Origin is shown only from explicit saved notes or an explicitly attributed fact; otherwise it is not recorded. Earliest documented interaction retains that precise wording. Source-sharing is not actor attribution: primary facts require a canonical member name, while shared workstream facts remain labeled supporting records. Contract/estimate/payment/completion wording and caveats are preserved verbatim. Long prose is deferred intact to records instead of clipping away caveats. Saved status is dated and not promoted into live progress, payment proof, or an Active badge. The context model still lacks typed origin, payment and progress fields, so unknowns remain visible rather than inventing a richer dossier. No new generated understanding is produced.

## Files changed in this pass
- src/services/relationshipDossier.ts
- src/components/panels/RelationshipDossier.tsx
- src/components/panels/DocumentSituationMap.tsx
- src/components/panels/situations.css
- src/services/relationshipDossierFixture.ts
- src/relationship-dossier-harness.tsx
- relationship-dossier-harness.html
- scripts/test-relationship-dossier.mjs
- src/situations-harness.tsx
- src/communications-viewport-harness.ts
- docs/NEXT-SESSION.md
- docs/COMMUNICATION-SITUATIONS.md
- docs/RELATIONSHIP-DOSSIER.md

Existing uncommitted work from prior passes remains intact. No commit, push or installation was performed.

## Fresh tests
- npm run build: passed. Existing dependency/chunk warnings remain.
- Rust initial parallel run: 312 passed, 1 failed, 2 ignored. The existing HTTP 401 fixture test failed its expected-error assertion.
- Failed HTTP fixture rerun alone: 1 passed.
- Full Rust serial rerun: 313 passed, 0 failed, 2 ignored (`cargo test --lib --manifest-path src-tauri/Cargo.toml -- --test-threads=1`). No Rust code changed in this pass.
- Dossier projection: 22 passed.
- Contextual actor projection: 20 passed.
- Graph model: 18 passed.
- Dossier browser/contact fixtures: 53 passed, covering all relationship types, missing contacts/origin, completed/uncertain status, long history, back and disclosures.
- Navigator: 36 passed; reduced-motion navigator: 36 passed.
- Communications: 58 passed; Situations: 14 passed; Gmail: 19 passed.
- Controlled viewport checks: 1755×950 normal 35; stress/expanded chat/reduced motion 39; 1920×1080 normal 35; 1280×900 stress 36; 1280×720 short 32. All passed.

## Manual review
Open http://127.0.0.1:31420/relationship-dossier-harness.html?run for synthetic examples. Compare Example Renovations, Northstar Inspections, Example Lending, and Robin Taylor; expand each record disclosure and try the parent-back control. These are invented identities and amounts, not live Home data.

In the native developer app, open Communications → Home → Renovation → the contractor node. Review real contacts and saved terms, current-status wording, and the workstream recommendation. The browser acceptance review used synthetic data; native visual inspection is still a user review step. Map geometry, traveling lights, existing inspector width, independent scrolling and measured chat exclusion are unchanged.
