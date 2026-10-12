# Operational workstream and actor dossiers

Status, 2026-10-12: describes the workstream and actor dossiers of document-backed Situation maps, released in 0.18.0 and part of the installed 0.30.0. Implemented September 13, 2026, from an operator-provided Renovation render. Situation maps as a whole are in [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md).

## Layout

The center stays a relationship map. A single Overview / Documents / Related / Timeline tab system controls the dossier in the inspector; Timeline appears only when the scope has dated milestones. The open tab is kept in session view state.

## Overview

Focused workstreams have a named dossier: current state, up to three clickable contextual actors, up to three open questions (Needs confirmation) and the source-linked useful next step from the review policy ([EXECUTIVE-PRIORITIZATION.md](EXECUTIVE-PRIORITIZATION.md)). The actor dossier has a parent back control, identity, contacts above the tabs, then Profile, how the relationship began, the business relationship, current status and a useful next step labelled as guidance, not a commitment. Two supporting documents and two relationship previews lead to the deeper tabs. The previews preserve uncertainty. Source details remain collapsed.

Actor dossier headings follow the recorded role: contractor, inspector, lender, insurer, utility, HOA or a generic fallback. Origin is shown only from saved notes or attributed facts that say how the relationship began; otherwise it reads as not recorded. A fact enters the actor's primary dossier only when it names a canonical member; facts that merely share a source stay in Documents as supporting workstream records. `relationshipDossier.ts` is a presentation projection with no model calls or canonical mutations.

There is no inferred Active badge: saved relationship status and current progress remain distinct. A scope description is not promoted to completed work. Existing qualifiers about estimates and payments remain intact.

## Documents

Documents is a first-class detail view. It contains the sources referenced by the selected contextual actor or workstream, deduplicated by source ID. File title, extension, explicit document date (or Date not recorded), origin and optional description are visible. Contracts, drafts, quotes, invoices and design archives coexist in a simple list; small groups are not manufactured.

The native `situation_document_status` and `situation_document_open` commands resolve situation ID + source ID against the current connected account's saved document registry. They do not accept paths from the frontend. Existence is checked; opening rechecks existence and permits a bounded set of document/image/archive extensions. Relative paths, URLs, network paths, executables, shortcuts and active HTML/SVG are not opened. This is local file access, not editing, uploading, or an external integration.

Availability is an existence check at the time of reading, not content verification.

## Related

The Related tab resolves canonical endpoint IDs into names and roles, then shows the saved relationship description. Documented / Reported / Unconfirmed labels preserve the evidence distinction. Overview previews show counterpart names and certainty. Contextual actors remain combined on the map; canonical members remain available in the relationship detail.

## Timeline

The optional milestone representation includes date, title, workstream, actor IDs, planned/reported/completed/verified/unknown state and source references. Timeline appears only when valid dated, source-linked events exist for the selected scope. Events sort chronologically. Invalid dates and unscoped/unreferenced events are excluded. There are no sync or graph-run events in this timeline.

A pack without structured milestones has no Timeline rather than one guessed from prose or filenames; the Home pack had none when it was imported on 2026-09-13. The synthetic dossier fixture demonstrates signed agreement, design received, quote received, work reported started and planned completion. There is no milestone-extraction workflow.

## Map

The contextual actor/role web stays central, with parent navigation and camera controls. Clusters come only from recorded workstreams and roles; file titles are not converted into categories or claims about current work.

## Source ownership

Optional document metadata distinguishes operator-created, received, local, generated and referenced material. Sender and date are shown only when recorded. Legacy local files say authorship not recorded. The supplied ChatGPT summary remains marked as generated/supplied context, not a contractor artifact. Source category/path and supporting qualifications remain inspectable behind the file or in the dossier's source disclosure.

Gmail attachment contents are not ingested, and an attachment mentioned in mail is not assumed to be locally available.

## Missing files

The native status route checks actual file existence. Missing entries say Referenced, file not currently available and have no Open button. Browser-only previews say availability has not been checked unless a fixture client supplies an explicitly synthetic result. An unsupported existing file type has no Open action and explains the limitation. Open failures report that the file may have moved or become unavailable.

## Verification

The pass's file list, test receipts and manual-review notes are in git history (`cb25daf`, 2026-09-13). Coverage: native tests for account/source scoping, nonlocal path rejection and document extension restrictions (`situations/documents.rs`); `scripts/test-dossier-details.mjs` and `scripts/test-relationship-dossier.mjs`; `relationship-dossier-harness.html` (synthetic actors, no real file viewer or model). Real-file shell opening is not automated.
