# Communications Celestial Observatory verification — November 4, 2026 UTC

## Outcome

Implemented the user-approved Focused map architecture with Celestial Observatory styling in the existing `olympus-skill-backbone` preview checkout, branch `codex/connected-command-map`, base `fee9503`. Product source remains uncommitted alongside preserved earlier work. This is development/browser evidence, not an installed release or native acceptance.

The left pane shows one bounded map neighborhood. Selecting a tile changes Summary/Conversations/Documents on the right; its branch arrow changes the neighborhood. Breadcrumbs, search, paging, scrolling and readable zoom handle expansion. Account/situation navigation state is memory-only. More retains local drafts, updates and management. Gmail controls are secondary; actual errors remain visible.

## Architecture and source boundaries

`focusedMap.ts` is a pure projection of saved context and observations. Stable source IDs keep shared documents canonical. Exact recorded mailbox addresses connect correspondence; similar names, shared files and uncertain annotations never establish identity. Unmatched participants stay reachable; inferred email associations remain qualified. The UI uses the existing source-review and native document-ID contracts. No backend/schema, attachment-ingestion, model/provider, authentication or briefing-synthesis changes belong to this task.

## Verification

- Production build passed after the final review fixes. Existing bundle-size warning remains.
- Pure focused projection tests passed, including stable identity, immutable inputs, scoping, mixed participants, uncertain contacts and bounded pages.
- Integrated browser acceptance passed at 1920×1080, 1440×960, 1280×800, 1000×900 and 760×900: selection versus focus, keyboard tabs, search, branch paging, pane containment, compact stacking and no page errors.
- Synthetic source acceptance passed: retained page/remount, exact document open IDs, inert source text, metadata-only attachments, account isolation, stale IDs and late availability responses.
- Review regressions passed: scrollable search, visible stale situation/thread warnings, deliberate keyboard focus after branch and actor-search navigation.
- Workflow smoke passed: unsaved draft text survives a mode remount, close/save remains explicit, operator updates work, Browse email remains accessible, connection controls remain reachable.
- Existing contextual-actor, dossier-details and relationship-dossier suites passed (23 / 14 / 22 checks).
- Full visual regression passed 21/21 captures, 14 functional checks and 22 Organizer checks. Receipts: `output/visual-review/latest/report.md`; focused captures: `output/observatory/`.

## Visual judgement

Inspected actual desktop, compact, whole-situation, inspections, paged-branch and document screens. Iterations removed excess toolbar rows, corrected inherited control styles, reduced branch spacing and fit both panes into the reading area. Static celestial arcs/stars remain behind the map; the detail surface is opaque. The narrow layout stacks rather than clipping. Search and the detail pane scroll internally; the page scrolls to the stacked detail on compact windows.

## Independent review and fixes

A fresh read-only reviewer inspected the exact task changes against pre-task file backups, plus the service, UI, CSS, tests and spec. No Critical issues. Three Important findings—compact specificity, unbounded search results, and hidden stale-source status—were reproduced RED and fixed GREEN. Keyboard focus loss was regraded Important because it interrupts keyboard navigation; actor-search and branch tests reproduced it before correction. No review finding remains deferred.

## Rulings and limitations

1. Existing approved design/implementation authority was sufficient; no repeat approval. The existing preview checkout was retained with exact backups and source left uncommitted to preserve earlier canyon/Gmail work. Cost: future commits must separate the mixed dirty tree carefully.
2. Detailed actor/workstream records remain behind Summary disclosures to preserve provenance/timelines without crowding the primary interface. Cost: deeper evidence takes an extra click.
3. Keyboard focus restoration was treated as required behavior. Cost: navigation intentionally moves focus to the branch root or selected detail.
4. Real Gmail, native WebView2 and shell-opening acceptance remain separate. Synthetic contracts/build do not prove those paths; native-specific issues may still exist. No ingestion loop, paid calls, deployment or installation was performed.
5. The reviewer could not launch Edge within its sandbox; the implementation session reproduced the reported search/keyboard failures with the authorized local browser. Final regression and documentation checks were completed by the implementation session.

The original comparison files and manifest are in the task workspace's `output/observatory-baseline`. The task ledger is retained because this source has not been committed; do not delete it as though Git already holds the change.
