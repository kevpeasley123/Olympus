# Celestial Observatory Implementation Plan
> Use superpowers:executing-plans to implement task by task.

**Goal:** Realize the approved focused relationship map with a source-safe detail panel.
**Architecture:** A pure graph projection uses existing identities/references; a bounded map view owns presentation only. A single detail panel consumes scoped source IDs and cached observations. Existing account-keyed session state keeps focus and selection through mode switches.
**Tech Stack:** Existing React, TypeScript, lucide-react and CSS; no dependencies.
**Spec:** ../specs/2026-11-03-communications-observatory.md

## Global constraints
Preserve dirty canyon, Gmail and briefing work; no source commits combining unrelated changes. Stay in the existing preview feature checkout with exact original-file backups. No live provider requests, ingestion, deployment or backend mutations. User explicitly authorized implementation/iteration; proceed inline without another plan approval.

## Review focus
- Shared documents and uncertain affiliations must not become ownership or email identity assertions.
- Large branches, long labels and narrow windows must stay navigable without clipping.
- Account/situation changes and async file results must not display the previous scope's material.
- Source availability, stale correspondence and empty results must be honest.
- Keyboard selection, branch focus, breadcrumbs, page position and drafts must remain usable through refresh/navigation.

## Task 1: Pure projection
- [x] Add scripts/test-focused-map.mjs covering bounded slices, stable IDs, shared documents, exact contact matching, cross-links and absent source links; observe RED.
- [x] Implement src/services/focusedMap.ts: buildFocusedMap(situation, observations), branchPage(graph, focus, page), searchFocusedMap(graph, query). No mutation or side effects.
- [x] Run projection tests and existing dossier/contextual-actor checks.

## Task 2: Focused view and source panel
- [x] Add browser acceptance for independent selection/focus, breadcrumbs, paging, search, keyboard tabs, account isolation and source retrieval; observe RED.
- [x] Add FocusedSituationMap.tsx, FocusedMapDetails.tsx and focusedMap.css; integrate into SituationsWorkspace and simplify Communications tools. Extend only in-memory account view state.
- [x] Retain native document status/open contract and existing SituationSourceReview; preserve secondary management/drafts.
- [x] Build and run targeted tests.

## Task 3: Evaluate and finish
- [x] Capture actual Communications at desktop/compact sizes and large/empty/stale states; inspect and iterate.
- [x] Fresh independent review of exact task delta; resolve findings with regression coverage.
- [x] Run full visual regression and guidance checks; update feature docs, handoff and Obsidian memory.

Ruling: work in the established development checkout with backups because it contains the approved canyon changes and ongoing preview; a new checkout would omit that dirty work. No automatic source commit or release. Final review is fresh-context per executing-plans; record any remaining limits honestly.
