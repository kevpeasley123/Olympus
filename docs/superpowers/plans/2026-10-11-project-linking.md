# Project linking implementation plan

> For agentic workers: use superpowers:executing-plans inline, as Kevin explicitly requested.

**Goal:** deliver the approved link → understand → clarify → choose-next-action workflow with reversible dashboard membership.
**Spec:** ../specs/2026-10-11-project-linking-and-assessment.md
**Architecture:** additive SQLite membership and source registry reconciled with the existing scanner; bounded Rust inspection; React management and assessment components; existing assistant/vault approval pathways.
**Stack:** current Tauri/Rust/SQLite/React/TypeScript. No new provider or paid verification.

## Constraints and review focus
Preserve existing IDs/work, prevent stale scan resurrection, canonicalize aliases, never infer identity from names, never execute source instructions, preserve drafts on errors, and keep confirmed vault intent separate from analysis. Private/unsupported repository links must explicitly remain uninspected. Membership failure must not reveal removed projects. Partial disk/database failures must remain recoverable.

## Task 1: Membership and scanner integration
- [x] Add failing storage tests for initialization, hide/restore, duplicates, same-name sources and revisions.
- [x] Add membership/source/draft tables and store module; canonical folder/URL identity; legacy bootstrap and discovered/removed listing.
- [x] Reconcile scans and registered outside-root projects; preserve legacy IDs and enforce active-run removal guard; update Organizer lookup.
- [x] Run focused Rust tests and commit the verified membership slice.

## Task 2: Assessment and confirmed brief
- [x] Add failing bounded-source and intake persistence tests.
- [x] Implement local allowlist and GitHub/GitLab public README adapters with limits; native picker; assessment drafts, answers, source revisions and save/review path.
- [x] Reuse explicit assistant context handoff and reviewed vault persistence. No automatic provider calls.
- [x] Test path boundaries, invalid URLs, unavailable sources, stale drafts and failed writes.

## Task 3: Product UI and integration
- [x] Add browser tests for add folder/URL/idea, duplicate/restore, removal, pending errors, persisted answers and assessment navigation.
- [x] Implement accessible Add dialog, project menu, Undo, discovered/removed lists and assessment panel.
- [x] Run production build, full Rust suite, focused scripts and full visual regression; inspect captures.
- [x] Request one final independent review, resolve important findings, commit and record memory. No release/install without a new request.
