# Next session

## Olympus 0.46.0

Release candidate combines `codex/connected-command-map` and the completed
Gmail/briefing work in `codex/olympus-integration-review`, based on `55bfc321`.
Commit, GitHub merge and native installation status must be verified from Git
and the installed executable; the pre-release local build is 0.45.3.

## Included

- Communications Celestial Observatory: focused relationship map on the left;
  selected Summary, Conversations and Documents on the right. Selection and
  branch focus are independent. Breadcrumbs, bounded child pages and search
  accommodate large maps. Account-scoped navigation and canonical source IDs
  preserve evidence boundaries. See `docs/COMMUNICATION-SITUATIONS.md` and
  `docs/reviews/2026-11-04-communications-observatory.md`.
- Restrained canyon cleanup preserves the platform, Omega and Olympian avatars;
  spacing, engine selection and telemetry are updated. See
  `docs/reviews/2026-11-04-canyon-cleanup.md`.
- Gmail management in Armory Plugins, transient sync recovery and bounded startup
  grace. Factual briefs suppress routine/duplicate receipts and reconcile shipment
  updates only with explicit identity evidence. See `docs/GMAIL-LINK-RECOVERY.md`.
- Gated contextual synthesis with source provenance, project evidence, native
  scope revocation and displayed-brief receipt protection. Deterministic fallback
  is not represented as model reasoning. See `docs/BRIEFING-SYNTHESIS.md` and
  `docs/reviews/2026-11-04-whole-patch-review.md`.

## Verification and release

The integration review records previous offline and browser-fixture evidence:
`docs/reviews/2026-11-04-integration-candidate.md`. Fresh full release results are recorded
in `docs/reviews/2026-11-04-release-046.md`: build, 748 native tests, all 85 scripts,
21 visual captures, 14 functional checks and 22 Organizer checks passed. Browser fixtures
do not qualify WebView2, native IPC, real mail/document access or live inference.
No provider generation, paid API call or real Gmail mutation is part of release
validation. Native installation requires a verified operational DB backup first.

## Held back and next work

- `codex/olympus-oauth-binding` remains separate. Its test-only staged credential
  transaction prototype lacks the qualified storage/restart/lease integration
  required for production. Existing production consent and generation gates stay
  closed; installation does not grant persistent credentials or spending authority.
- Useful live contextual briefs, automatic relationship analysis, real account
  restart/network recovery, and seven-day grant durability remain unverified.
  Provider no-extra-spend assurance and trusted lifecycle integration remain live
  activation prerequisites. No Firefox or alternate settings access is authorized.
- The Obsidian memory audit and research-paper ingestion remain separate unfinished
  goals. Prepared research metadata is not proof of full-text/figure ingestion.
- Keep original donor worktrees and integration snapshots. Do not discard local
  history or resolve differences by overwriting newer files.
