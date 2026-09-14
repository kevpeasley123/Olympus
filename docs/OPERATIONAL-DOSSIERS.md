# Operational workstream and actor dossiers

Implemented September 13, 2026. Reference: operator-provided Renovation render.

## Reference translation

The center stays a relationship map. A single Overview / Documents / Related / Timeline tab system now controls the right dossier; no duplicate center tab strip was added. Amber selection, cool borders, compact type, identity, contacts, supporting files and progressive disclosure follow the render's organization. Whole Home composition remains unchanged.

## Overview

Focused workstreams now have a named dossier, concise saved summary, clickable contextual actors, open questions and the existing source-linked next step. The actor dossier retains Profile, relationship origin, business together, current status and next step, with contacts above the tabs. Two supporting documents and two relationship previews lead to the deeper tabs. The previews preserve uncertainty. Source details remain collapsed.

There is no inferred Active badge: saved relationship status and current progress remain distinct. A scope description is not promoted to completed work. Existing qualifiers about estimates and payments remain intact.

## Documents

Documents is a first-class detail view. It contains the sources referenced by the selected contextual actor or workstream, deduplicated by source ID. File title, extension, explicit document date (or Date not recorded), origin and optional description are visible. Contracts, drafts, quotes, invoices and design archives coexist in a simple list; small groups are not manufactured.

The new native status/open commands resolve situation ID + source ID against the current connected account's saved document registry. They do not accept paths from the frontend. Existence is checked; opening rechecks existence and permits a bounded set of document/image/archive extensions. Relative paths, URLs, network paths, executables, shortcuts and active HTML/SVG are not opened. This is local file access, not editing, uploading, or an external integration.

A fresh read-only inspection found all 58 existing Home source paths present. This is an existence observation, not content verification or a guarantee that a file will not subsequently move.

## Related

The Related tab resolves canonical endpoint IDs into names and roles, then shows the saved relationship description. Documented / Reported / Unconfirmed labels preserve the evidence distinction. Overview previews show counterpart names and certainty. Contextual actors remain combined on the map; canonical members remain available in the relationship detail.

## Timeline

The optional milestone representation includes date, title, workstream, actor IDs, planned/reported/completed/verified/unknown state and source references. Timeline appears only when valid dated, source-linked events exist for the selected scope. Events sort chronologically. Invalid dates and unscoped/unreferenced events are excluded. There are no sync or graph-run events in this timeline.

The existing Home document pack has no structured milestones. Its Timeline is therefore absent rather than filled by guessing dates from prose or filenames. The synthetic dossier demonstrates signed agreement, design received, quote received, work reported started and planned completion. This pass adds the supported presentation contract, not a new milestone-extraction loop.

## Map

The existing contextual actor/role web remains central, with parent navigation and camera controls preserved. No new design/payment/permit clusters were inferred from the reference image. The legacy pack does not contain explicit operational cluster membership, so this pass does not fabricate categories or convert file titles into claims about current work.

## Source ownership

Optional document metadata distinguishes operator-created, received, local, generated and referenced material. Sender and date are shown only when recorded. Legacy local files say authorship not recorded. The supplied ChatGPT summary remains marked as generated/supplied context, not a contractor artifact. Source category/path and supporting qualifications remain inspectable behind the file or in the dossier's source disclosure.

Gmail attachment contents are not newly ingested. This pass does not claim that an attachment mentioned in text is locally available.

## Missing files

The native status route checks actual file existence. Missing entries say Referenced, file not currently available and have no Open button. Browser-only previews say availability has not been checked unless a fixture client supplies an explicitly synthetic result. An unsupported existing file type has no Open action and explains the limitation. Open failures report that the file may have moved or become unavailable.

## Files changed

- src/components/panels/DossierTabs.tsx — new shared tabbed detail surface
- src/components/panels/WorkstreamDossier.tsx — new focused workstream dossier
- src/components/panels/RelationshipDossier.tsx
- src/components/panels/DocumentSituationMap.tsx
- src/components/panels/situations.css
- src/services/dossierDetails.ts — new scoped detail projection
- src/services/situationDocuments.ts — new native document client
- src/services/situations.ts — optional document metadata and milestones
- src/services/relationshipDossierFixture.ts
- src/relationship-dossier-harness.tsx
- src/situations-harness.tsx
- scripts/test-dossier-details.mjs — new projection tests
- scripts/test-relationship-dossier.mjs — expanded fixture relationship assertion
- src-tauri/src/commands/gmail/situations/documents.rs — new account-scoped file access and tests
- src-tauri/src/commands/gmail/situations.rs
- src-tauri/src/lib.rs
- docs/OPERATIONAL-DOSSIERS.md, docs/NEXT-SESSION.md, ARCHITECTURE.md

Existing unrelated worktree changes are preserved. No commit, push, release installation, or private-document copy was performed.

## Tests

Fresh npm run build: PASS, with existing dependency warnings (buffer externalization, gray-matter eval, large chunks).

Fresh requested cargo test --lib --manifest-path src-tauri/Cargo.toml: **316 passed, 0 failed, 2 ignored** on the standard parallel run. Three new native tests cover account/source scoping, nonlocal path rejection and document extension restrictions.

Pure checks: contextual actors 23, dossier projection 22, dossier details 14, priority 23, graph 19, briefing preview 6; all pass. Git diff --check passes with the pre-existing schema line-ending warning.

Final browser matrix: all 16 cases pass.

| Case | Passed checks |
| --- | ---: |
| Actor dossier including documents, related and timeline | 72 |
| Mortgage priority + navigation | 23 |
| Renovation priority | 13 |
| Comparable priorities | 12 |
| No priority | 12 |
| Many questions | 26 |
| 1755×950 overview | 36 |
| 1755×950 stress / expanded chat / reduced motion | 43 |
| 1920×1080 overview | 36 |
| 1280×900 stress | 40 |
| 1280×720 | 33 |
| Communications | 58 |
| Situations | 14 |
| Gmail | 19 |
| Navigator | 76 |
| Reduced-motion navigator | 76 |

Dossier cases include five mixed artifacts, missing rendering file, operator/received ownership, source-ID opening via fake client, one-source actors, 30+ documents, nine related entries, unknown origin, no contact fields, no dated events, planned versus reported milestones, and parent navigation. No fixture invokes a real file viewer or model.

## Manual review

Reviewed synthetic actor Overview, Documents and Timeline in the browser, plus the integrated navigation/viewport matrix. The separate dossier preview is relationship-dossier-harness.html; full composition remains communications-viewport-harness.html.

Native command compilation and tests pass. The running development executable and installed release have not been restarted/replaced during this pass, so the new native file-opening route requires the next development rebuild/relaunch or installation. Real-file shell opening was not exercised automatically. The frontend is available through the running Vite server; no Gmail writes or model workflows were added.
