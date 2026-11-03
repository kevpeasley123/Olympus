# Gmail and factual briefing foundation review

Dated November 2, 2026, America/Phoenix. Baseline: 51bc631.
Branch: codex/gmail-learning-intelligence. See ../NEXT-SESSION.md for dated checks.

Kevin approved the design and requested implementation. The first subsystem plan
retains provider and consent gates and is explicitly factual. This is a local
implementation checkpoint, not a release or proof of the full learning design.

## Review resolution

- Important: raw evidence in receipt revisions could persist after cache removal.
  Resolved with SHA-256 revisions, digest validation and transactional account-cache
  receipt removal. Regression tests reject raw revisions and verify purge.
- Important: opening marked consumed before evidence revalidation.
  Resolved with bounded re-preparation and delayed opening consumption. Source
  changes and exhausted retries are exercised by delivery tests.
- Important: project/checkpoint/root changes could publish obsolete evidence.
  Resolved with project-board-root guards, requested-source re-reads and active
  session checks. Checkpoint invalidation has a regression test.
- Minor upgraded to Important: an unbounded requested project read could hold the
  UI briefing lock. Resolved with bounded reads and partial-source fallback;
  rejected and hanging source tests pass.
- Minor deferred: readiness accepts any nonblank local model name as unverified,
  while the actual local adapter can reject unsupported names. This never grants
  readiness or bypasses adapter validation; qualify configuration next.

## Limits and evidence

No OAuth, credential changes, live model calls, production DB writes, app launch,
install, push or merge. Credential-free DNS and HTTPS reachability to Google's
OAuth endpoint succeeded; that does not prove authenticated sync has recovered.
Native library tests exercise isolated fixtures; browser review uses synthetic
sources. Neither proves WebView2 integration or useful real-email analysis.

The separate flagship review retains its baseline failure: it expects visible
inner rings although the unchanged flagship renderer hides them. Standard visual
regression passed; readable Gmail settings and Command geometry were inspected.
No unrelated renderer or assertion was changed to make the check green.

Follow-on work: diagnose current Gmail sync in the app, qualify an authorized
analysis route, implement source-linked correction/forget/undo learning and assess
representative briefs. Tray persistence remains a later optional milestone.
